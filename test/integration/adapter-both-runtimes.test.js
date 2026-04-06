/**
 * Integration tests for both runtimes — Phase 10.
 * Tests that Claude and Codex can coexist and share the same corpus.
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
  distAvailable = true;
} catch {
  distAvailable = false;
}

const install = distAvailable ? (await import('../../dist/core/installer.js')).install : null;
const uninstallFn = distAvailable ? (await import('../../dist/core/installer.js')).uninstall : null;
const ClaudeAdapter = distAvailable ? (await import('../../dist/runtimes/claude/adapter.js')).ClaudeAdapter : null;
const CodexAdapter = distAvailable ? (await import('../../dist/runtimes/codex/adapter.js')).CodexAdapter : null;

const describeOrSkip = distAvailable ? describe : describe.skip;

/**
 * Create a temp directory with corpus data for both runtimes.
 */
async function setupBothRuntimesEnv() {
  const tempDir = await mkdtemp(join(tmpdir(), 'gss-p10-both-'));
  const claudeRoot = join(tempDir, '.claude');
  const codexRoot = join(tempDir, '.codex');

  // Create corpus data directory
  const dataDir = join(tempDir, 'data', 'corpus');
  mkdirSync(dataDir, { recursive: true });

  const corpusSnapshot = {
    schemaVersion: 1,
    corpusVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    documents: new Array(3).fill(null).map((_, i) => ({
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
    stats: { totalDocs: 3, readyDocs: 3, pendingDocs: 0, totalBindings: 0, totalRelatedEdges: 0 },
  };
  writeFileSync(join(dataDir, 'owasp-corpus.snapshot.json'), JSON.stringify(corpusSnapshot, null, 2));

  // Create MCP server binary
  const mcpDistDir = join(tempDir, 'pkg', 'dist', 'mcp');
  mkdirSync(mcpDistDir, { recursive: true });
  writeFileSync(join(mcpDistDir, 'server.js'), '// Test MCP server');

  return { tempDir, claudeRoot, codexRoot, pkgRoot: join(tempDir, 'pkg') };
}

describeOrSkip('Phase 10 — Both runtimes integration', () => {
  it('both runtimes can be installed simultaneously', async () => {
    const { tempDir, claudeRoot, codexRoot } = await setupBothRuntimesEnv();
    try {
      const claudeAdapter = new ClaudeAdapter();
      const codexAdapter = new CodexAdapter();
      const result = await install([claudeAdapter, codexAdapter], 'local', tempDir, false, { legacySpecialists: false });

      assert.ok(result.manifest, 'Should produce manifest');
      assert.ok(result.manifest.runtimes.includes('claude'), 'Should include Claude');
      assert.ok(result.manifest.runtimes.includes('codex'), 'Should include Codex');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('both runtimes share the same corpus version', async () => {
    const { tempDir, claudeRoot, codexRoot } = await setupBothRuntimesEnv();
    try {
      const claudeAdapter = new ClaudeAdapter();
      const codexAdapter = new CodexAdapter();
      await install([claudeAdapter, codexAdapter], 'local', tempDir, false, { legacySpecialists: false });

      // Read both runtime manifests
      const claudeManifestPath = join(claudeRoot, 'gss', 'runtime-manifest.json');
      const codexManifestPath = join(codexRoot, 'gss', 'runtime-manifest.json');

      if (existsSync(claudeManifestPath) && existsSync(codexManifestPath)) {
        const claudeManifest = JSON.parse(readFileSync(claudeManifestPath, 'utf-8'));
        const codexManifest = JSON.parse(readFileSync(codexManifestPath, 'utf-8'));

        assert.equal(claudeManifest.corpusVersion, codexManifest.corpusVersion,
          'Both runtimes should have the same corpus version');
      }
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('both runtimes have same role IDs', async () => {
    const { tempDir, claudeRoot, codexRoot } = await setupBothRuntimesEnv();
    try {
      const claudeAdapter = new ClaudeAdapter();
      const codexAdapter = new CodexAdapter();
      await install([claudeAdapter, codexAdapter], 'local', tempDir, false, { legacySpecialists: false });

      const claudeManifestPath = join(claudeRoot, 'gss', 'runtime-manifest.json');
      const codexManifestPath = join(codexRoot, 'gss', 'runtime-manifest.json');

      if (existsSync(claudeManifestPath) && existsSync(codexManifestPath)) {
        const claudeManifest = JSON.parse(readFileSync(claudeManifestPath, 'utf-8'));
        const codexManifest = JSON.parse(readFileSync(codexManifestPath, 'utf-8'));

        assert.deepEqual(claudeManifest.installedRoles, codexManifest.installedRoles,
          'Both runtimes should have the same installed roles');
      }
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('both MCP registrations present', async () => {
    const { tempDir, claudeRoot, codexRoot } = await setupBothRuntimesEnv();
    try {
      const claudeAdapter = new ClaudeAdapter();
      const codexAdapter = new CodexAdapter();
      await install([claudeAdapter, codexAdapter], 'local', tempDir, false, { legacySpecialists: false });

      const claudeMcpPath = join(tempDir, '.mcp.json');
      assert.ok(existsSync(claudeMcpPath), 'Claude MCP config should exist');
      const claudeMcp = JSON.parse(readFileSync(claudeMcpPath, 'utf-8'));
      assert.ok(claudeMcp.mcpServers?.['gss-security-docs'], 'Claude MCP entry should be registered');

      const codexConfigPath = join(codexRoot, 'config.toml');
      assert.ok(existsSync(codexConfigPath), 'Codex MCP config should exist');
      const codexConfig = readFileSync(codexConfigPath, 'utf-8');
      assert.ok(codexConfig.includes('[mcp_servers.gss-security-docs]'), 'Codex MCP entry should be registered');
      assert.ok(!existsSync(join(claudeRoot, 'config.toml')), 'Codex MCP config must not be written into Claude root');

      // Both adapters should produce the same MCP registration shape
      const claudeReg = claudeAdapter.getMcpRegistration('/server', '/corpus', { scope: 'local', cwd: tempDir });
      const codexReg = codexAdapter.getMcpRegistration('/server', '/corpus');
      assert.equal(claudeReg.content.command, codexReg.content.command,
        'Both adapters should use same MCP command');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('uninstall cleans both runtimes', async () => {
    const { tempDir } = await setupBothRuntimesEnv();
    try {
      const claudeAdapter = new ClaudeAdapter();
      const codexAdapter = new CodexAdapter();
      await install([claudeAdapter, codexAdapter], 'local', tempDir, false, { legacySpecialists: false });

      const uninstallResult = await uninstallFn(tempDir, false);
      assert.ok(uninstallResult.success, `Uninstall should succeed: ${uninstallResult.errors.join(', ')}`);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
