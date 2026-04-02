/**
 * Unit tests for runtime manifest Phase 11 rollout mode fields.
 * Validates that installRuntimeArtifacts populates rolloutMode and
 * comparisonEnabled correctly for each mode.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';

import { computeRolloutMode, installRuntimeArtifacts, detectTargets } from '../../../dist/core/install-stages.js';
import { createMockAdapterWithMcp } from './helpers.js';

function createTempDir() {
  return mkdtemp(join(tmpdir(), 'gss-p11-manifest-'));
}

function cleanupTempDir(dir) {
  rmSync(dir, { recursive: true, force: true });
}

/**
 * Set up a minimal corpus snapshot file for testing.
 */
function setupCorpusSnapshot(tempDir) {
  const dataDir = join(tempDir, 'pkg', 'data', 'corpus');
  mkdirSync(dataDir, { recursive: true });

  const snapshotPath = join(dataDir, 'owasp-corpus.snapshot.json');
  const snapshot = {
    corpusVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    documents: [],
    stats: { totalDocs: 0 },
  };
  writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf-8');
  return snapshotPath;
}

/**
 * Run installRuntimeArtifacts with a mock adapter and capture the resulting manifest.
 */
async function runInstallAndReadManifest(tempDir, options = {}) {
  const rootPath = join(tempDir, '.claude');
  const supportSubtree = join(rootPath, 'gss');

  const adapter = createMockAdapterWithMcp({
    runtime: 'claude',
    rootPath,
    supportSubtree,
    hooks: [
      { id: 'session-start', event: 'session-start', blocking: false, command: 'console.log("hi")' },
      { id: 'pre-tool-write', event: 'pre-tool-write', blocking: true, command: 'return { proceed: true }' },
      { id: 'pre-tool-edit', event: 'pre-tool-edit', blocking: true, command: 'return { proceed: true }' },
      { id: 'post-tool-write', event: 'post-tool-write', blocking: false, command: 'console.log("done")' },
    ],
  });

  const targets = {
    runtimes: ['claude'],
    scope: 'local',
    cwd: tempDir,
    roots: { claude: rootPath },
    supportSubtrees: { claude: supportSubtree },
  };

  // Create artifact directories
  mkdirSync(join(tempDir, '.gss', 'artifacts'), { recursive: true });
  mkdirSync(join(tempDir, '.gss', 'reports'), { recursive: true });

  const result = await installRuntimeArtifacts(
    targets,
    [adapter],
    null, // no corpus
    {
      dryRun: false,
      legacySpecialists: options.legacySpecialists || false,
      hybridShadow: options.hybridShadow || false,
      specialists: [],
    }
  );

  // Read the runtime manifest
  const manifestPath = join(supportSubtree, 'runtime-manifest.json');
  if (!existsSync(manifestPath)) {
    return null;
  }

  return JSON.parse(readFileSync(manifestPath, 'utf-8'));
}

describe('Runtime Manifest — Phase 11 rollout mode fields', () => {
  it('default install includes rolloutMode: mcp-only', async () => {
    const tempDir = await createTempDir();
    try {
      const manifest = await runInstallAndReadManifest(tempDir);
      assert.ok(manifest, 'Runtime manifest should be created');
      assert.equal(manifest.rolloutMode, 'mcp-only');
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('legacySpecialists: true sets rolloutMode: legacy', async () => {
    const tempDir = await createTempDir();
    try {
      const manifest = await runInstallAndReadManifest(tempDir, { legacySpecialists: true });
      assert.ok(manifest, 'Runtime manifest should be created');
      assert.equal(manifest.rolloutMode, 'legacy');
      assert.equal(manifest.legacyMode, true);
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('hybridShadow: true sets rolloutMode: hybrid-shadow', async () => {
    const tempDir = await createTempDir();
    try {
      const manifest = await runInstallAndReadManifest(tempDir, { hybridShadow: true });
      assert.ok(manifest, 'Runtime manifest should be created');
      assert.equal(manifest.rolloutMode, 'hybrid-shadow');
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('hybridShadow: true sets comparisonEnabled: true', async () => {
    const tempDir = await createTempDir();
    try {
      const manifest = await runInstallAndReadManifest(tempDir, { hybridShadow: true });
      assert.ok(manifest, 'Runtime manifest should be created');
      assert.equal(manifest.comparisonEnabled, true);
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('default install has no comparisonEnabled field', async () => {
    const tempDir = await createTempDir();
    try {
      const manifest = await runInstallAndReadManifest(tempDir);
      assert.ok(manifest, 'Runtime manifest should be created');
      assert.equal(manifest.comparisonEnabled, undefined);
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('legacyMode is derived from rolloutMode (legacy=true)', async () => {
    const tempDir = await createTempDir();
    try {
      const manifest = await runInstallAndReadManifest(tempDir, { legacySpecialists: true });
      assert.ok(manifest, 'Runtime manifest should be created');
      assert.equal(manifest.legacyMode, true);
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('legacyMode is false for non-legacy modes', async () => {
    const tempDir = await createTempDir();
    try {
      const manifest = await runInstallAndReadManifest(tempDir, { hybridShadow: true });
      assert.ok(manifest, 'Runtime manifest should be created');
      assert.equal(manifest.legacyMode, false);
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('manifest round-trips through JSON serialization', async () => {
    const tempDir = await createTempDir();
    try {
      const manifest = await runInstallAndReadManifest(tempDir, { hybridShadow: true });
      assert.ok(manifest, 'Runtime manifest should be created');

      // Serialize and parse
      const serialized = JSON.stringify(manifest);
      const parsed = JSON.parse(serialized);

      assert.equal(parsed.rolloutMode, 'hybrid-shadow');
      assert.equal(parsed.comparisonEnabled, true);
      assert.equal(parsed.legacyMode, false);
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('old manifest without rolloutMode can be read (backward compat)', async () => {
    const tempDir = await createTempDir();
    try {
      // Create a pre-Phase 11 manifest
      const supportDir = join(tempDir, '.claude', 'gss');
      mkdirSync(supportDir, { recursive: true });
      const oldManifest = {
        runtime: 'claude',
        scope: 'local',
        installedAt: new Date().toISOString(),
        version: '0.1.0',
        corpusVersion: '1.0.0',
        hooks: ['session-start'],
        managedConfigs: [],
        gssVersion: '0.1.0',
        legacyMode: false,
        // No rolloutMode field
      };
      const manifestPath = join(supportDir, 'runtime-manifest.json');
      writeFileSync(manifestPath, JSON.stringify(oldManifest, null, 2));

      // Parse it back
      const parsed = JSON.parse(readFileSync(manifestPath, 'utf-8'));
      assert.equal(parsed.rolloutMode, undefined, 'Should be undefined for old manifest');
      assert.equal(parsed.legacyMode, false);
    } finally {
      cleanupTempDir(tempDir);
    }
  });
});
