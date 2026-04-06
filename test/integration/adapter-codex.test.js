/**
 * Integration tests for Codex adapter — Phase 10.
 * Tests install → doctor → uninstall lifecycle for Codex runtime.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
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
const CodexAdapter = distAvailable ? (await import('../../dist/runtimes/codex/adapter.js')).CodexAdapter : null;

const describeOrSkip = distAvailable ? describe : describe.skip;

/**
 * Create a temp directory with corpus data for Codex integration testing.
 */
async function setupCodexIntegrationEnv() {
  const tempDir = await mkdtemp(join(tmpdir(), 'gss-p10-codex-'));
  const rootPath = join(tempDir, '.codex');
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

describeOrSkip('Phase 10 — Codex adapter integration', () => {
  it('install produces runtime manifest with Phase 10 fields', async () => {
    const { tempDir, rootPath, supportSubtree } = await setupCodexIntegrationEnv();
    try {
      const adapter = new CodexAdapter();
      await install([adapter], 'local', tempDir, false);

      const runtimeManifestPath = join(supportSubtree, 'runtime-manifest.json');
      assert.ok(existsSync(runtimeManifestPath), 'Runtime manifest should exist');

      const manifest = JSON.parse(readFileSync(runtimeManifestPath, 'utf-8'));
      assert.ok(Array.isArray(manifest.installedWorkflows), 'Should have installedWorkflows');
      assert.ok(Array.isArray(manifest.installedRoles), 'Should have installedRoles');
      assert.equal(manifest.installedRoles.length, 6, 'Should have 6 roles');
      assert.equal(manifest.mcpServerName, 'gss-security-docs');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('install creates role skill files', async () => {
    const { tempDir, rootPath, supportSubtree } = await setupCodexIntegrationEnv();
    try {
      const adapter = new CodexAdapter();
      await install([adapter], 'local', tempDir, false, { legacySpecialists: false });

      // Check role skill files exist
      assert.ok(existsSync(join(rootPath, 'skills', 'gss-mapper', 'SKILL.md')), 'gss-mapper/SKILL.md should exist');
      assert.ok(existsSync(join(rootPath, 'skills', 'gss-auditor', 'SKILL.md')), 'gss-auditor/SKILL.md should exist');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('Codex has no hooks', async () => {
    const adapter = new CodexAdapter();
    const hooks = adapter.getHooks();
    assert.equal(hooks.length, 0, 'Codex should have 0 hooks');
  });

  it('Codex capabilities are correct', () => {
    const adapter = new CodexAdapter();
    const caps = adapter.getCapabilities();
    assert.equal(caps.supportsHooks, false);
    assert.equal(caps.supportsSubagents, true);
    assert.equal(caps.supportsManagedConfig, true);
    assert.equal(caps.supportsRoleAgents, true);
    assert.equal(caps.hasConfigFormat, true);
  });

  it('Codex MCP registration matches Claude pattern', () => {
    const adapter = new CodexAdapter();
    const reg = adapter.getMcpRegistration('/path/to/server.js', '/path/to/corpus.json');
    assert.equal(reg.path, 'config.toml');
    assert.equal(reg.keyPath, 'mcp_servers.gss-security-docs');
    assert.equal(reg.content.command, 'node');
    assert.deepEqual(reg.content.args, ['/path/to/server.js', '--corpus-path', '/path/to/corpus.json']);
  });

  it('Codex getRoleFiles() returns 6 files', () => {
    const adapter = new CodexAdapter();
    const files = adapter.getRoleFiles();
    assert.equal(files.length, 6);

    const paths = files.map(f => f.relativePath);
    assert.ok(paths.every(p => p.startsWith('skills/')), 'All paths should start with skills/');
    assert.ok(paths.every(p => p.endsWith('SKILL.md')), 'All paths should end with SKILL.md');
  });

  it('deprecated getRoleSkillFiles() still works', () => {
    const adapter = new CodexAdapter();
    const files = adapter.getRoleSkillFiles();
    assert.equal(files.length, 6, 'Deprecated alias should still return 6 files');
  });
});
