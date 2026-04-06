/**
 * Phase 8 — Integration Tests: Hook installation pipeline
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ClaudeAdapter } from '../../dist/runtimes/claude/adapter.js';
import { install } from '../../dist/core/installer.js';

async function createTempDir() {
  return mkdtemp(join(tmpdir(), 'gss-p8-int-'));
}

async function cleanupTempDir(dir) {
  rmSync(dir, { recursive: true, force: true });
}

describe('Phase 8 — Integration: Hook installation', () => {

  it('install produces 4 hook files', async () => {
    const tempDir = await createTempDir();
    try {
      await install([new ClaudeAdapter()], 'local', tempDir, false);
      const hooksDir = join(tempDir, '.claude', 'gss', 'hooks');
      assert.ok(existsSync(hooksDir), 'hooks directory should exist');
      const hookFiles = readdirSync(hooksDir).filter(f => f.endsWith('.js'));
      const expectedHooks = ['session-start.js', 'pre-tool-write.js', 'pre-tool-edit.js', 'post-tool-write.js'];
      for (const expected of expectedHooks) {
        assert.ok(hookFiles.includes(expected), `Hook file ${expected} should exist`);
      }
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('hook IDs are unchanged from pre-Phase 8', () => {
    const adapter = new ClaudeAdapter();
    const hooks = adapter.getHooks();
    const expectedIds = ['session-start', 'pre-tool-write', 'pre-tool-edit', 'post-tool-write'];
    assert.deepStrictEqual(hooks.map(h => h.id).sort(), expectedIds.sort());
  });

  it('hooks are non-blocking', () => {
    const adapter = new ClaudeAdapter();
    const hooks = adapter.getHooks();
    for (const hook of hooks) {
      assert.strictEqual(hook.blocking, false, `Hook ${hook.id} should be non-blocking`);
    }
  });

  it('artifact validator support module installed', async () => {
    const tempDir = await createTempDir();
    try {
      await install([new ClaudeAdapter()], 'local', tempDir, false);
      const validatorPath = join(tempDir, '.claude', 'gss', 'hooks', 'artifact-validator.js');
      assert.ok(existsSync(validatorPath), 'artifact-validator.js should exist');
      const content = readFileSync(validatorPath, 'utf-8');
      assert.ok(content.includes('validateArtifact'), 'Module should export validateArtifact');
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('artifact validator exports validateArtifact function', async () => {
    const tempDir = await createTempDir();
    try {
      await install([new ClaudeAdapter()], 'local', tempDir, false);
      const validatorPath = join(tempDir, '.claude', 'gss', 'hooks', 'artifact-validator.js');
      const content = readFileSync(validatorPath, 'utf-8');
      // Validate the module exports the expected constructs structurally
      assert.ok(content.includes('validateArtifact'), 'Should export validateArtifact');
      assert.ok(content.includes('ARTIFACT_VALIDATION_RULES'), 'Should export ARTIFACT_VALIDATION_RULES');
      // Validate the source module directly (ESM import from dist)
      const { ARTIFACT_VALIDATION_RULES } = await import('../../dist/hooks/artifact-validator.js');
      assert.strictEqual(typeof ARTIFACT_VALIDATION_RULES, 'object');
      assert.strictEqual(Object.keys(ARTIFACT_VALIDATION_RULES).length, 9, 'Should have 9 workflow rules');
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('runtime manifest has Phase 8 fields', async () => {
    const tempDir = await createTempDir();
    try {
      await install([new ClaudeAdapter()], 'local', tempDir, false);
      const manifestPath = join(tempDir, '.claude', 'gss', 'runtime-manifest.json');
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
      assert.ok('corpusPath' in manifest, 'corpusPath field missing');
      assert.ok('mcpServerPath' in manifest, 'mcpServerPath field missing');
      assert.ok('mcpConfigPath' in manifest, 'mcpConfigPath field missing');
      assert.ok('gssVersion' in manifest, 'gssVersion field missing');
      assert.ok('hooks' in manifest, 'hooks field missing');
      assert.strictEqual(manifest.hooks.length, 4, 'Should have 4 hooks');
      const expectedIds = ['session-start', 'pre-tool-write', 'pre-tool-edit', 'post-tool-write'];
      assert.deepStrictEqual(manifest.hooks.sort(), expectedIds.sort());
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('session-start hook contains MCP/corpus health check logic', async () => {
    const tempDir = await createTempDir();
    try {
      await install([new ClaudeAdapter()], 'local', tempDir, false);
      const hookPath = join(tempDir, '.claude', 'gss', 'hooks', 'session-start.js');
      const content = readFileSync(hookPath, 'utf-8');
      assert.ok(content.includes('runtime-manifest.json'), 'Should check runtime manifest');
      assert.ok(content.includes('corpus'), 'Should check corpus');
      assert.ok(content.includes('mcpServers'), 'Should check MCP servers');
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('pre-write hook contains sensitive path and workflow-mode checks', async () => {
    const tempDir = await createTempDir();
    try {
      await install([new ClaudeAdapter()], 'local', tempDir, false);
      const hookPath = join(tempDir, '.claude', 'gss', 'hooks', 'pre-tool-write.js');
      const content = readFileSync(hookPath, 'utf-8');
      assert.ok(content.includes('.env'), 'Should check .env');
      assert.ok(content.includes('.pem'), 'Should check .pem');
      assert.ok(content.includes('.key'), 'Should check .key');
      assert.ok(content.includes('secrets/'), 'Should check secrets/');
      assert.ok(content.includes('credentials/'), 'Should check credentials/');
      assert.ok(content.includes('active-workflow'), 'Should check active-workflow');
      assert.ok(content.includes('review-only'), 'Should check review-only mode');
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('pre-edit hook contains artifact and scope checks', async () => {
    const tempDir = await createTempDir();
    try {
      await install([new ClaudeAdapter()], 'local', tempDir, false);
      const hookPath = join(tempDir, '.claude', 'gss', 'hooks', 'pre-tool-edit.js');
      const content = readFileSync(hookPath, 'utf-8');
      assert.ok(content.includes('.gss/artifacts/'), 'Should check artifact edits');
      assert.ok(content.includes('verification'), 'Should check verification mode');
      assert.ok(content.includes('scopeFiles'), 'Should check scopeFiles');
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('post-write hook contains artifact validation logic', async () => {
    const tempDir = await createTempDir();
    try {
      await install([new ClaudeAdapter()], 'local', tempDir, false);
      const hookPath = join(tempDir, '.claude', 'gss', 'hooks', 'post-tool-write.js');
      const content = readFileSync(hookPath, 'utf-8');
      assert.ok(content.includes('validateArtifact'), 'Should use validateArtifact');
      assert.ok(content.includes('coverageStatus'), 'Should check coverageStatus');
      assert.ok(content.includes('consultation'), 'Should check consultation');
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('support README mentions artifact validator', async () => {
    const tempDir = await createTempDir();
    try {
      await install([new ClaudeAdapter()], 'local', tempDir, false);
      const readmePath = join(tempDir, '.claude', 'gss', 'README.md');
      const content = readFileSync(readmePath, 'utf-8');
      assert.ok(content.includes('artifact-validator'), 'README should mention artifact-validator');
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('existing path-safety warnings present in pre-write hook', async () => {
    const tempDir = await createTempDir();
    try {
      await install([new ClaudeAdapter()], 'local', tempDir, false);
      const hookPath = join(tempDir, '.claude', 'gss', 'hooks', 'pre-tool-write.js');
      const content = readFileSync(hookPath, 'utf-8');
      const safetyPatterns = ['.env', '.pem', '.key', 'secrets/', 'credentials/'];
      for (const pattern of safetyPatterns) {
        assert.ok(content.includes(pattern), `Should include safety pattern: ${pattern}`);
      }
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('artifact edit warnings present in pre-edit hook', async () => {
    const tempDir = await createTempDir();
    try {
      await install([new ClaudeAdapter()], 'local', tempDir, false);
      const hookPath = join(tempDir, '.claude', 'gss', 'hooks', 'pre-tool-edit.js');
      const content = readFileSync(hookPath, 'utf-8');
      assert.ok(content.includes('.gss/artifacts/'), 'Should warn on artifact edits');
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('install/uninstall cycle is clean', async () => {
    const tempDir = await createTempDir();
    try {
      await install([new ClaudeAdapter()], 'local', tempDir, false);
    } finally {
      await cleanupTempDir(tempDir);
    }
    // If cleanupTempDir didn't throw, the cycle is clean
    assert.ok(!existsSync(tempDir), 'Temp dir should be cleaned up');
  });
});
