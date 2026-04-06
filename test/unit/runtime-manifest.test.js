/**
 * Unit tests for runtime manifest field population.
 * Phase 10 — Workstream C: Diagnostic metadata in runtime manifests.
 *
 * Tests that the runtime manifest includes the new Phase 10 fields:
 * - installedWorkflows
 * - installedRoles
 * - mcpServerName
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdtemp, readFile } from 'node:fs/promises';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

import { installRuntimeArtifacts, detectTargets, DEFAULT_WORKFLOWS } from '../../dist/core/install-stages.js';
import { ClaudeAdapter } from '../../dist/runtimes/claude/adapter.js';
import { CodexAdapter } from '../../dist/runtimes/codex/adapter.js';

/**
 * Create a minimal corpus resolution for testing.
 */
function createMockCorpus(tempDir, runtime) {
  const supportDir = join(tempDir, runtime === 'claude' ? '.claude' : '.codex', 'gss');
  const corpusDir = join(supportDir, 'corpus');
  mkdirSync(corpusDir, { recursive: true });
  const corpusPath = join(corpusDir, 'owasp-corpus.json');
  writeFileSync(corpusPath, JSON.stringify({
    schemaVersion: 1,
    corpusVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    documents: [],
    stats: { totalDocs: 0, readyDocs: 0, pendingDocs: 0, totalBindings: 0, totalRelatedEdges: 0 },
  }));

  return {
    snapshot: {
      schemaVersion: 1,
      corpusVersion: '1.0.0',
      generatedAt: new Date().toISOString(),
      documents: [],
      stats: { totalDocs: 0, readyDocs: 0, pendingDocs: 0, totalBindings: 0, totalRelatedEdges: 0 },
    },
    corpusVersion: '1.0.0',
    sourcePath: corpusPath,
    destinationPaths: { [runtime]: corpusPath },
  };
}

describe('Runtime Manifest — Phase 10 fields (Claude)', () => {
  it('includes installedWorkflows', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'gss-p10-mf-'));
    try {
      const adapter = new ClaudeAdapter();
      const targets = detectTargets([adapter], 'local', tempDir);
      const corpus = createMockCorpus(tempDir, 'claude');

      mkdirSync(join(tempDir, '.gss', 'artifacts'), { recursive: true });
      mkdirSync(join(tempDir, '.gss', 'reports'), { recursive: true });

      const result = await installRuntimeArtifacts(
        targets, [adapter], corpus, { dryRun: false }
      );

      const manifestPath = result.runtimeManifestPaths['claude'];
      assert.ok(manifestPath, 'Should have runtime manifest path');
      const manifest = JSON.parse(await readFile(manifestPath, 'utf-8'));

      assert.ok(Array.isArray(manifest.installedWorkflows), 'Should have installedWorkflows array');
      assert.equal(manifest.installedWorkflows.length, DEFAULT_WORKFLOWS.length);
      assert.ok(manifest.installedWorkflows.includes('audit'));
      assert.ok(manifest.installedWorkflows.includes('security-review'));
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('includes installedRoles', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'gss-p10-mf-'));
    try {
      const adapter = new ClaudeAdapter();
      const targets = detectTargets([adapter], 'local', tempDir);
      const corpus = createMockCorpus(tempDir, 'claude');

      mkdirSync(join(tempDir, '.gss', 'artifacts'), { recursive: true });
      mkdirSync(join(tempDir, '.gss', 'reports'), { recursive: true });

      const result = await installRuntimeArtifacts(
        targets, [adapter], corpus, { dryRun: false }
      );

      const manifestPath = result.runtimeManifestPaths['claude'];
      const manifest = JSON.parse(await readFile(manifestPath, 'utf-8'));

      assert.ok(Array.isArray(manifest.installedRoles), 'Should have installedRoles array');
      assert.equal(manifest.installedRoles.length, 6);
      assert.ok(manifest.installedRoles.includes('gss-mapper'));
      assert.ok(manifest.installedRoles.includes('gss-auditor'));
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('includes mcpServerName', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'gss-p10-mf-'));
    try {
      const adapter = new ClaudeAdapter();
      const targets = detectTargets([adapter], 'local', tempDir);
      const corpus = createMockCorpus(tempDir, 'claude');

      mkdirSync(join(tempDir, '.gss', 'artifacts'), { recursive: true });
      mkdirSync(join(tempDir, '.gss', 'reports'), { recursive: true });

      const result = await installRuntimeArtifacts(
        targets, [adapter], corpus, { dryRun: false }
      );

      const manifestPath = result.runtimeManifestPaths['claude'];
      const manifest = JSON.parse(await readFile(manifestPath, 'utf-8'));

      assert.equal(manifest.mcpServerName, 'gss-security-docs');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe('Runtime Manifest — Backward compatibility', () => {
  it('old manifests without Phase 10 fields do not crash readers', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'gss-p10-mf-'));
    try {
      const supportDir = join(tempDir, '.claude', 'gss');
      mkdirSync(supportDir, { recursive: true });

      // Old-format manifest without Phase 10 fields
      const oldManifest = {
        runtime: 'claude',
        scope: 'local',
        installedAt: new Date().toISOString(),
        version: '0.1.0',
        corpusVersion: '1.0.0',
        hooks: [],
        managedConfigs: [],
        corpusPath: null,
        mcpServerPath: null,
        mcpConfigPath: '/tmp/settings.json',
        gssVersion: '0.1.0',
      };
      const manifestPath = join(supportDir, 'runtime-manifest.json');
      writeFileSync(manifestPath, JSON.stringify(oldManifest, null, 2));

      // Reading should not crash — fields are accessed with optional chaining
      const read = JSON.parse(await readFile(manifestPath, 'utf-8'));
      assert.equal(read.runtime, 'claude');
      assert.equal(read.installedWorkflows, undefined);
      assert.equal(read.installedRoles, undefined);
      assert.equal(read.mcpServerName, undefined);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
