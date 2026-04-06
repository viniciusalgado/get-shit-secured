/**
 * Integration tests for Phase 11 — End-to-end migration path validation.
 * Validates the full lifecycle: install → migrate → doctor → verify.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';

import { migrateInstall } from '../../dist/cli/migrate-install.js';
import { doctor } from '../../dist/cli/doctor.js';
import { captureOutputAsync } from '../unit/install/helpers.js';

function createTempDir() {
  return mkdtemp(join(tmpdir(), 'gss-p11-upgrade-'));
}

function cleanupTempDir(dir) {
  rmSync(dir, { recursive: true, force: true });
}

/**
 * Set up a full install at a given rollout mode.
 */
function setupInstall(tempDir, options = {}) {
  const mode = options.rolloutMode || 'mcp-only';
  const gssDir = join(tempDir, '.gss');
  const claudeRoot = join(tempDir, '.claude');
  const claudeSupport = join(claudeRoot, 'gss');
  const artifactsDir = join(gssDir, 'artifacts');
  const reportsDir = join(gssDir, 'reports');
  const hooksDir = join(claudeSupport, 'hooks');
  const corpusDir = join(claudeSupport, 'corpus');
  const mcpDir = join(claudeSupport, 'mcp');

  mkdirSync(artifactsDir, { recursive: true });
  mkdirSync(reportsDir, { recursive: true });
  mkdirSync(hooksDir, { recursive: true });
  mkdirSync(corpusDir, { recursive: true });
  mkdirSync(mcpDir, { recursive: true });

  const corpusPath = join(corpusDir, 'owasp-corpus.json');
  const mcpServerPath = join(mcpDir, 'server.js');
  const mcpConfigPath = join(tempDir, '.mcp.json');
  const runtimeManifestPath = join(claudeSupport, 'runtime-manifest.json');
  const installManifestPath = join(gssDir, 'install-manifest.json');

  // Write corpus
  writeFileSync(corpusPath, JSON.stringify({
    corpusVersion: '1.0.0',
    documents: [],
    stats: { totalDocs: 113 },
  }, null, 2));

  // Write MCP server binary
  writeFileSync(mcpServerPath, '// MCP server', 'utf-8');

  // Write MCP config (local scope: .mcp.json at project root)
  writeFileSync(mcpConfigPath, JSON.stringify({
    mcpServers: {
      'gss-security-docs': {
        command: 'node',
        args: [mcpServerPath],
      },
    },
  }, null, 2));

  // Write hooks
  for (const hookId of ['session-start', 'pre-tool-write', 'pre-tool-edit', 'post-tool-write']) {
    writeFileSync(join(hooksDir, `${hookId}.js`), `// Hook: ${hookId}`, 'utf-8');
  }

  // Write runtime manifest with rollout mode
  const runtimeManifest = {
    runtime: 'claude',
    scope: 'local',
    installedAt: '2026-04-01T12:00:00Z',
    version: '0.1.0',
    corpusVersion: '1.0.0',
    hooks: ['session-start', 'pre-tool-write', 'pre-tool-edit', 'post-tool-write'],
    managedConfigs: [],
    corpusPath,
    mcpServerPath,
    mcpConfigPath,
    gssVersion: '0.1.0',
    installedWorkflows: ['security-review', 'map-codebase', 'audit'],
    installedRoles: ['gss-mapper', 'gss-auditor', 'gss-verifier'],
    mcpServerName: 'gss-security-docs',
    rolloutMode: mode,
    ...(mode === 'hybrid-shadow' ? { comparisonEnabled: true } : {}),
  };
  writeFileSync(runtimeManifestPath, JSON.stringify(runtimeManifest, null, 2));

  // Write install manifest
  const installManifest = {
    manifestVersion: 2,
    packageVersion: '0.1.0',
    corpusVersion: '1.0.0',
    installedAt: '2026-04-01T12:00:00Z',
    updatedAt: '2026-04-01T12:00:00Z',
    scope: 'local',
    runtimes: ['claude'],
    workflowIds: ['security-review', 'map-codebase', 'audit'],
    roots: { claude: claudeRoot },
    files: { claude: [] },
    managedConfigs: {},
    hooks: { claude: [join(hooksDir, 'session-start.js')] },
    runtimeManifests: { claude: runtimeManifestPath },
    mcpServerPaths: { claude: mcpServerPath },
    mcpConfigPaths: { claude: mcpConfigPath },
  };
  writeFileSync(installManifestPath, JSON.stringify(installManifest, null, 2));

  return {
    gssDir, claudeRoot, claudeSupport,
    artifactsDir, reportsDir,
    hooksDir, corpusDir, mcpDir,
    corpusPath, mcpServerPath, mcpConfigPath, runtimeManifestPath, installManifestPath,
  };
}

describe('Phase 11 — upgrade paths integration', () => {
  it('fresh install at mcp-only → doctor shows Release C', async () => {
    const tempDir = await createTempDir();
    try {
      setupInstall(tempDir, { rolloutMode: 'mcp-only' });
      const { result, logs } = await captureOutputAsync(() =>
        doctor(tempDir, { json: true })
      );
      assert.equal(result, 0);
      const output = logs.join('\n');
      assert.ok(output.includes('mcp-only') || output.includes('Release C') || output.includes('rollout'),
        `Expected rollout mode info. Got:\n${output}`);
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('mcp-only → migrate to hybrid-shadow → comparisonEnabled: true', async () => {
    const tempDir = await createTempDir();
    try {
      const { runtimeManifestPath } = setupInstall(tempDir, { rolloutMode: 'mcp-only' });

      const migration = await migrateInstall(tempDir, { targetMode: 'hybrid-shadow', dryRun: false });
      assert.equal(migration.migrated, true);

      const manifest = JSON.parse(readFileSync(runtimeManifestPath, 'utf-8'));
      assert.equal(manifest.rolloutMode, 'hybrid-shadow');
      assert.equal(manifest.comparisonEnabled, true);
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('hybrid-shadow → migrate back to mcp-only → comparisonEnabled removed', async () => {
    const tempDir = await createTempDir();
    try {
      const { runtimeManifestPath } = setupInstall(tempDir, { rolloutMode: 'hybrid-shadow' });

      const migration = await migrateInstall(tempDir, { targetMode: 'mcp-only', dryRun: false });
      assert.equal(migration.migrated, true);

      const manifest = JSON.parse(readFileSync(runtimeManifestPath, 'utf-8'));
      assert.equal(manifest.rolloutMode, 'mcp-only');
      assert.equal(manifest.comparisonEnabled, undefined);
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('round-trip: mcp-only → hybrid-shadow → mcp-only → idempotent', async () => {
    const tempDir = await createTempDir();
    try {
      const { runtimeManifestPath } = setupInstall(tempDir, { rolloutMode: 'mcp-only' });

      // Forward migration
      await migrateInstall(tempDir, { targetMode: 'hybrid-shadow', dryRun: false });
      let manifest = JSON.parse(readFileSync(runtimeManifestPath, 'utf-8'));
      assert.equal(manifest.rolloutMode, 'hybrid-shadow');

      // Reverse migration
      await migrateInstall(tempDir, { targetMode: 'mcp-only', dryRun: false });
      manifest = JSON.parse(readFileSync(runtimeManifestPath, 'utf-8'));
      assert.equal(manifest.rolloutMode, 'mcp-only');
      assert.equal(manifest.comparisonEnabled, undefined);
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('dry-run safety: no files modified', async () => {
    const tempDir = await createTempDir();
    try {
      const { runtimeManifestPath } = setupInstall(tempDir, { rolloutMode: 'mcp-only' });
      const beforeContent = readFileSync(runtimeManifestPath, 'utf-8');

      await migrateInstall(tempDir, { targetMode: 'hybrid-shadow', dryRun: true });

      const afterContent = readFileSync(runtimeManifestPath, 'utf-8');
      assert.equal(beforeContent, afterContent, 'Dry-run should not modify files');
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('doctor shows correct rollout mode after migration', async () => {
    const tempDir = await createTempDir();
    try {
      setupInstall(tempDir, { rolloutMode: 'mcp-only' });

      // Migrate to mcp-only
      await migrateInstall(tempDir, { targetMode: 'mcp-only', dryRun: false });

      // Doctor should now show mcp-only
      const { result, logs } = await captureOutputAsync(() =>
        doctor(tempDir, { json: true })
      );
      assert.equal(result, 0);
      const output = logs.join('\n');
      assert.ok(output.includes('mcp-only') || output.includes('Release C'),
        `Expected mcp-only after migration. Got:\n${output}`);
    } finally {
      cleanupTempDir(tempDir);
    }
  });
});
