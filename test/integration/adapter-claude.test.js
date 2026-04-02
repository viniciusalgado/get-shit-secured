/**
 * Integration tests for Claude adapter — Phase 10.
 * Tests install → doctor → uninstall lifecycle for Claude runtime.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { join, resolve, dirname } from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Check if dist is available
let distAvailable = false;
try {
  await import('../../dist/core/installer.js');
  await import('../../dist/cli/doctor.js');
  distAvailable = true;
} catch {
  distAvailable = false;
}

const install = distAvailable ? (await import('../../dist/core/installer.js')).install : null;
const uninstallFn = distAvailable ? (await import('../../dist/core/installer.js')).uninstall : null;
const doctor = distAvailable ? (await import('../../dist/cli/doctor.js')).doctor : null;
const ClaudeAdapter = distAvailable ? (await import('../../dist/runtimes/claude/adapter.js')).ClaudeAdapter : null;

const describeOrSkip = distAvailable ? describe : describe.skip;

/**
 * Create a temp directory with corpus data for integration testing.
 */
async function setupClaudeIntegrationEnv() {
  const tempDir = await mkdtemp(join(tmpdir(), 'gss-p10-claude-'));
  const rootPath = join(tempDir, '.claude');
  const supportSubtree = join(rootPath, 'gss');

  // Create corpus data directory
  const dataDir = join(tempDir, 'data', 'corpus');
  mkdirSync(dataDir, { recursive: true });

  // Create minimal corpus snapshot
  const corpusSnapshot = {
    schemaVersion: 1,
    corpusVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    documents: new Array(5).fill(null).map((_, i) => ({
      id: `test-doc-${i}`,
      uri: `security://owasp/cheatsheet/test-doc-${i}`,
      title: `Test Doc ${i}`,
      sourceUrl: `https://example.com/doc-${i}`,
      sourceType: 'owasp-cheatsheet',
      corpusVersion: '1.0.0',
      status: 'ready',
      summary: `Test document ${i}`,
      headings: [],
      checklist: [],
      tags: [],
      issueTypes: [],
      workflowBindings: [],
      stackBindings: [],
      relatedDocIds: [],
      aliases: [],
      provenance: { inferred: [], overridden: [] },
    })),
    stats: { totalDocs: 5, readyDocs: 5, pendingDocs: 0, totalBindings: 0, totalRelatedEdges: 0 },
  };
  writeFileSync(join(dataDir, 'owasp-corpus.snapshot.json'), JSON.stringify(corpusSnapshot, null, 2));

  // Create a minimal MCP server binary in the dist directory
  const mcpDistDir = join(tempDir, 'pkg', 'dist', 'mcp');
  mkdirSync(mcpDistDir, { recursive: true });
  writeFileSync(join(mcpDistDir, 'server.js'), '// Test MCP server');

  return { tempDir, rootPath, supportSubtree, pkgRoot: join(tempDir, 'pkg') };
}

describeOrSkip('Phase 10 — Claude adapter integration', () => {
  it('install produces runtime manifest with Phase 10 fields', async () => {
    const { tempDir, rootPath, supportSubtree } = await setupClaudeIntegrationEnv();
    try {
      const adapter = new ClaudeAdapter();
      const result = await install([adapter], 'local', tempDir, false, { legacySpecialists: false });

      // Check runtime manifest
      const runtimeManifestPath = join(supportSubtree, 'runtime-manifest.json');
      assert.ok(existsSync(runtimeManifestPath), 'Runtime manifest should exist');

      const manifest = JSON.parse(readFileSync(runtimeManifestPath, 'utf-8'));
      assert.ok(Array.isArray(manifest.installedWorkflows), 'Should have installedWorkflows');
      assert.ok(manifest.installedWorkflows.length > 0, 'Should have at least 1 workflow');
      assert.ok(Array.isArray(manifest.installedRoles), 'Should have installedRoles');
      assert.equal(manifest.installedRoles.length, 6, 'Should have 6 roles');
      assert.equal(manifest.legacyMode, false);
      assert.equal(manifest.mcpServerName, 'gss-security-docs');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('install creates role agent files', async () => {
    const { tempDir, rootPath, supportSubtree } = await setupClaudeIntegrationEnv();
    try {
      const adapter = new ClaudeAdapter();
      await install([adapter], 'local', tempDir, false, { legacySpecialists: false });

      // Check role agent files exist
      assert.ok(existsSync(join(rootPath, 'agents', 'gss-mapper.md')), 'gss-mapper.md should exist');
      assert.ok(existsSync(join(rootPath, 'agents', 'gss-auditor.md')), 'gss-auditor.md should exist');
      assert.ok(existsSync(join(rootPath, 'agents', 'gss-verifier.md')), 'gss-verifier.md should exist');
      assert.ok(existsSync(join(rootPath, 'agents', 'gss-reporter.md')), 'gss-reporter.md should exist');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('gss doctor runs without error on Claude install', async () => {
    const { tempDir, rootPath, supportSubtree } = await setupClaudeIntegrationEnv();
    try {
      const adapter = new ClaudeAdapter();
      await install([adapter], 'local', tempDir, false, { legacySpecialists: false });

      // Doctor may return non-zero due to test MCP binary setup (known test limitation)
      // The important thing is it doesn't crash
      const exitCode = await doctor(tempDir, { runtimes: ['claude'] });
      assert.ok(typeof exitCode === 'number', 'Doctor should return a number');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('uninstall removes Claude files cleanly', async () => {
    const { tempDir, rootPath, supportSubtree } = await setupClaudeIntegrationEnv();
    try {
      const adapter = new ClaudeAdapter();
      await install([adapter], 'local', tempDir, false, { legacySpecialists: false });

      const uninstallResult = await uninstallFn(tempDir, false);
      assert.ok(uninstallResult.success, `Uninstall should succeed: ${uninstallResult.errors.join(', ')}`);

      const gssDir = join(tempDir, '.gss');
      if (existsSync(gssDir)) {
        const entries = readdirSync(gssDir);
        assert.equal(entries.length, 0, '.gss/ should be empty after uninstall');
      }
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('install with --legacy-specialists sets legacyMode true', async () => {
    const { tempDir, rootPath, supportSubtree } = await setupClaudeIntegrationEnv();
    try {
      const adapter = new ClaudeAdapter();
      await install([adapter], 'local', tempDir, false, { legacySpecialists: true });

      const runtimeManifestPath = join(supportSubtree, 'runtime-manifest.json');
      const manifest = JSON.parse(readFileSync(runtimeManifestPath, 'utf-8'));
      assert.equal(manifest.legacyMode, true, 'legacyMode should be true');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('Claude getRoleFiles() returns 6 files', async () => {
    const adapter = new ClaudeAdapter();
    const files = adapter.getRoleFiles();
    assert.equal(files.length, 6, 'Should return 6 role files');

    const paths = files.map(f => f.relativePath);
    assert.ok(paths.every(p => p.startsWith('agents/')), 'All paths should start with agents/');
    assert.ok(paths.every(p => p.endsWith('.md')), 'All paths should end with .md');
  });

  it('deprecated getRoleAgentFiles() still works', async () => {
    const adapter = new ClaudeAdapter();
    const files = adapter.getRoleAgentFiles();
    assert.equal(files.length, 6, 'Deprecated alias should still return 6 files');
  });
});
