/**
 * Integration tests for Phase 9 — Full install pipeline.
 * Tests install → doctor → uninstall lifecycle.
 *
 * These tests verify end-to-end behavior against compiled dist/ output.
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

// Skip all tests if dist not available
const describeOrSkip = distAvailable ? describe : describe.skip;

/**
 * Create a mock Claude adapter that writes to temp directory.
 * Includes getMcpRegistration for full MCP support.
 */
function createTestAdapter(rootPath, supportSubtree) {
  return {
    runtime: 'claude',
    resolveRootPath: () => rootPath,
    resolveSupportSubtree: () => supportSubtree,
    getCapabilities: () => ({
      supportsHooks: true,
      supportsSubagents: true,
      supportsManagedConfig: true,
      supportsRoleAgents: true,
      hasConfigFormat: true,
    }),
    getPlaceholderFiles: () => [
      { relativePath: 'commands/gss/gss-help.md', content: '# GSS Help', category: 'entrypoint', overwritePolicy: 'create-only' },
    ],
    getFilesForWorkflow: () => [
      { relativePath: 'commands/gss/audit.md', content: '# Audit', category: 'entrypoint', overwritePolicy: 'create-only' },
    ],
    getSupportFiles: () => [],
    getManagedJsonPatches: () => [],
    getManagedTextBlocks: () => [],
    getHooks: () => [
      { id: 'session-start', event: 'SessionStart', command: '', blocking: false, description: 'Session start' },
      { id: 'pre-tool-write', event: 'PreToolUse', command: '', blocking: false, description: 'Pre-write' },
      { id: 'pre-tool-edit', event: 'PreToolUse', command: '', blocking: false, description: 'Pre-edit' },
      { id: 'post-tool-write', event: 'PostToolUse', command: '', blocking: false, description: 'Post-write' },
    ],
    getMcpRegistration: (serverPath, corpusPath) => ({
      path: 'settings.json',
      owner: 'gss',
      content: {
        command: 'node',
        args: [serverPath, '--corpus-path', corpusPath],
      },
      mergeStrategy: 'deep',
      keyPath: 'mcpServers.gss-security-docs',
    }),
  };
}

/**
 * Create a temp directory with corpus data for integration testing.
 */
async function setupIntegrationEnv() {
  const tempDir = await mkdtemp(join(tmpdir(), 'gss-p9-int-'));
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

describeOrSkip('Phase 9 — Integration: Install pipeline', () => {
  it('install produces v2 manifest with MCP path fields', async () => {
    const { tempDir, rootPath, supportSubtree } = await setupIntegrationEnv();
    try {
      const adapter = createTestAdapter(rootPath, supportSubtree);
      const result = await install([adapter], 'local', tempDir, false, { legacySpecialists: false });

      assert.ok(result.manifest, 'Should produce manifest');
      const manifest = result.manifest;

      // V2 manifest should have MCP fields
      assert.ok('mcpServerPaths' in manifest, 'Should have mcpServerPaths field');
      assert.ok('mcpConfigPaths' in manifest, 'Should have mcpConfigPaths field');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('install creates hooks', async () => {
    const { tempDir, rootPath, supportSubtree } = await setupIntegrationEnv();
    try {
      const adapter = createTestAdapter(rootPath, supportSubtree);
      await install([adapter], 'local', tempDir, false, { legacySpecialists: false });

      const hooksDir = join(supportSubtree, 'hooks');
      assert.ok(existsSync(join(hooksDir, 'session-start.js')), 'session-start.js should exist');
      assert.ok(existsSync(join(hooksDir, 'pre-tool-write.js')), 'pre-tool-write.js should exist');
      assert.ok(existsSync(join(hooksDir, 'pre-tool-edit.js')), 'pre-tool-edit.js should exist');
      assert.ok(existsSync(join(hooksDir, 'post-tool-write.js')), 'post-tool-write.js should exist');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('install creates runtime manifest with Phase 8 fields', async () => {
    const { tempDir, rootPath, supportSubtree } = await setupIntegrationEnv();
    try {
      const adapter = createTestAdapter(rootPath, supportSubtree);
      await install([adapter], 'local', tempDir, false, { legacySpecialists: false });

      const runtimeManifestPath = join(supportSubtree, 'runtime-manifest.json');
      assert.ok(existsSync(runtimeManifestPath), 'Runtime manifest should exist');
      const manifest = JSON.parse(readFileSync(runtimeManifestPath, 'utf-8'));
      assert.equal(manifest.runtime, 'claude');
      assert.equal(manifest.gssVersion, '0.1.0');
      assert.ok('corpusPath' in manifest, 'Should have corpusPath');
      assert.ok('mcpServerPath' in manifest, 'Should have mcpServerPath');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describeOrSkip('Phase 9 — Integration: Full lifecycle', () => {
  it('install → uninstall cycle is clean', async () => {
    const { tempDir, rootPath, supportSubtree } = await setupIntegrationEnv();
    try {
      const adapter = createTestAdapter(rootPath, supportSubtree);
      await install([adapter], 'local', tempDir, false, { legacySpecialists: false });

      // Uninstall
      const uninstallResult = await uninstallFn(tempDir, false);
      assert.ok(uninstallResult.success, `Uninstall should succeed: ${uninstallResult.errors.join(', ')}`);

      // .gss directory should be removed or empty
      const gssDir = join(tempDir, '.gss');
      if (existsSync(gssDir)) {
        const entries = readdirSync(gssDir);
        assert.equal(entries.length, 0, '.gss/ should be empty after uninstall');
      }
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('install → uninstall → doctor returns 1', async () => {
    const { tempDir, rootPath, supportSubtree } = await setupIntegrationEnv();
    try {
      const adapter = createTestAdapter(rootPath, supportSubtree);
      await install([adapter], 'local', tempDir, false, { legacySpecialists: false });
      await uninstallFn(tempDir, false);

      const exitCode = await doctor(tempDir, {});
      assert.equal(exitCode, 1, 'Doctor should return 1 after uninstall');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describeOrSkip('Phase 9 — Integration: Enriched dry-run', () => {
  it('dry-run produces manifest without writing files', async () => {
    const { tempDir, rootPath, supportSubtree } = await setupIntegrationEnv();
    try {
      const adapter = createTestAdapter(rootPath, supportSubtree);
      const result = await install([adapter], 'local', tempDir, true, { legacySpecialists: false });

      assert.ok(result.manifest, 'Dry-run should produce a manifest');
      assert.ok(result.manifest.runtimes.includes('claude'), 'Should show claude runtime');
      // No files should be written
      assert.ok(!existsSync(join(tempDir, '.gss', 'install-manifest.json')), 'Dry-run should not write manifest');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describeOrSkip('Phase 9 — Integration: Regression', () => {
  it('config merge is non-destructive', async () => {
    const { tempDir, rootPath, supportSubtree } = await setupIntegrationEnv();
    try {
      // Pre-create settings.json with existing content
      mkdirSync(rootPath, { recursive: true });
      writeFileSync(join(rootPath, 'settings.json'), JSON.stringify({
        existingKey: 'preserved',
        otherSetting: true,
      }, null, 2));

      const adapter = createTestAdapter(rootPath, supportSubtree);
      await install([adapter], 'local', tempDir, false, { legacySpecialists: false });

      // Check settings.json still has original content
      const settingsPath = join(rootPath, 'settings.json');
      if (existsSync(settingsPath)) {
        const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
        assert.equal(settings.existingKey, 'preserved', 'Existing settings should be preserved');
        assert.equal(settings.otherSetting, true, 'Other settings should be preserved');
      }
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
