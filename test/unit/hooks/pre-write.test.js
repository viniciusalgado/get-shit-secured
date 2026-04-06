/**
 * Phase 8 — Pre-write hook tests
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getHookCommand, createTempDir, cleanupTempDir, executeHook, captureOutput, setupFullEnvironment } from './helpers.js';
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Sensitive path warnings (existing behavior)
// ---------------------------------------------------------------------------
describe('Pre-write — Sensitive path warnings', () => {

  it('write to .env file triggers warning', async () => {
    const tempDir = await createTempDir();
    try {
      const command = getHookCommand('pre-tool-write');
      const { warns } = captureOutput(() => {
        executeHook(command, { cwd: tempDir, toolInput: { path: '.env' } });
      });
      assert.ok(warns.some(w => w.includes('sensitive file')));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('write to .pem file triggers warning', async () => {
    const tempDir = await createTempDir();
    try {
      const command = getHookCommand('pre-tool-write');
      const { warns } = captureOutput(() => {
        executeHook(command, { cwd: tempDir, toolInput: { path: 'server.pem' } });
      });
      assert.ok(warns.some(w => w.includes('[GSS WARN] Path:')));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('write to .key file triggers warning', async () => {
    const tempDir = await createTempDir();
    try {
      const command = getHookCommand('pre-tool-write');
      const { warns } = captureOutput(() => {
        executeHook(command, { cwd: tempDir, toolInput: { path: 'private.key' } });
      });
      assert.ok(warns.some(w => w.includes('[GSS WARN] Path:')));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('write to secrets/ path triggers warning', async () => {
    const tempDir = await createTempDir();
    try {
      const command = getHookCommand('pre-tool-write');
      const { warns } = captureOutput(() => {
        executeHook(command, { cwd: tempDir, toolInput: { path: 'secrets/config.json' } });
      });
      assert.ok(warns.some(w => w.includes('[GSS WARN] Path:')));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('write to credentials/ path triggers warning', async () => {
    const tempDir = await createTempDir();
    try {
      const command = getHookCommand('pre-tool-write');
      const { warns } = captureOutput(() => {
        executeHook(command, { cwd: tempDir, toolInput: { path: 'credentials/aws.json' } });
      });
      assert.ok(warns.some(w => w.includes('[GSS WARN] Path:')));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('write to normal file: no path warning', async () => {
    const tempDir = await createTempDir();
    try {
      const command = getHookCommand('pre-tool-write');
      const { warns } = captureOutput(() => {
        executeHook(command, { cwd: tempDir, toolInput: { path: 'src/app.ts' } });
      });
      assert.ok(!warns.some(w => w.includes('[GSS WARN] Path:')));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

});

// ---------------------------------------------------------------------------
// Review-only workflow mode
// ---------------------------------------------------------------------------
describe('Pre-write — Review-only workflow mode', () => {

  it('code write during audit (review-only)', async () => {
    const tempDir = await createTempDir();
    try {
      const env = setupFullEnvironment(tempDir);
      writeFileSync(join(env.artifactsDir, 'active-workflow.json'), JSON.stringify({
        workflowId: 'audit',
        mode: 'review-only',
        startedAt: new Date().toISOString(),
      }));
      const command = getHookCommand('pre-tool-write');
      const { warns } = captureOutput(() => {
        executeHook(command, { cwd: tempDir, toolInput: { path: 'src/foo.ts' } });
      });
      assert.ok(warns.some(w => w.includes('review-only mode')));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('code write during map-codebase (review-only)', async () => {
    const tempDir = await createTempDir();
    try {
      const env = setupFullEnvironment(tempDir);
      writeFileSync(join(env.artifactsDir, 'active-workflow.json'), JSON.stringify({
        workflowId: 'map-codebase',
        mode: 'review-only',
        startedAt: new Date().toISOString(),
      }));
      const command = getHookCommand('pre-tool-write');
      const { warns } = captureOutput(() => {
        executeHook(command, { cwd: tempDir, toolInput: { path: 'lib/bar.js' } });
      });
      assert.ok(warns.some(w => w.includes('[GSS WARN] Workflow:')));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('code write during threat-model (review-only)', async () => {
    const tempDir = await createTempDir();
    try {
      const env = setupFullEnvironment(tempDir);
      writeFileSync(join(env.artifactsDir, 'active-workflow.json'), JSON.stringify({
        workflowId: 'threat-model',
        mode: 'review-only',
        startedAt: new Date().toISOString(),
      }));
      const command = getHookCommand('pre-tool-write');
      const { warns } = captureOutput(() => {
        executeHook(command, { cwd: tempDir, toolInput: { path: 'src/baz.py' } });
      });
      assert.ok(warns.some(w => w.includes('[GSS WARN] Workflow:')));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('write to .gss/ during review-only mode: no warning', async () => {
    const tempDir = await createTempDir();
    try {
      const env = setupFullEnvironment(tempDir);
      writeFileSync(join(env.artifactsDir, 'active-workflow.json'), JSON.stringify({
        workflowId: 'audit',
        mode: 'review-only',
        startedAt: new Date().toISOString(),
      }));
      const command = getHookCommand('pre-tool-write');
      const { warns } = captureOutput(() => {
        executeHook(command, { cwd: tempDir, toolInput: { path: '.gss/artifacts/audit/result.json' } });
      });
      assert.ok(!warns.some(w => w.includes('[GSS WARN] Workflow:')));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

});

// ---------------------------------------------------------------------------
// Write-capable mode (execute-remediation)
// ---------------------------------------------------------------------------
describe('Pre-write — Write-capable mode', () => {

  it('code write in execute-remediation with prior artifact: no warning', async () => {
    const tempDir = await createTempDir();
    try {
      const env = setupFullEnvironment(tempDir);
      writeFileSync(join(env.artifactsDir, 'active-workflow.json'), JSON.stringify({
        workflowId: 'execute-remediation',
        mode: 'write-capable',
        startedAt: new Date().toISOString(),
      }));
      mkdirSync(join(env.artifactsDir, 'plan-remediation'), { recursive: true });
      const command = getHookCommand('pre-tool-write');
      const { warns } = captureOutput(() => {
        executeHook(command, { cwd: tempDir, toolInput: { path: 'src/foo.ts' } });
      });
      assert.ok(!warns.some(w => w.includes('plan-remediation artifact found')));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('code write in execute-remediation without prior artifact: warning', async () => {
    const tempDir = await createTempDir();
    try {
      const env = setupFullEnvironment(tempDir);
      writeFileSync(join(env.artifactsDir, 'active-workflow.json'), JSON.stringify({
        workflowId: 'execute-remediation',
        mode: 'write-capable',
        startedAt: new Date().toISOString(),
      }));
      const planRemDir = join(env.artifactsDir, 'plan-remediation');
      if (existsSync(planRemDir)) { rmSync(planRemDir, { recursive: true, force: true }); }
      const command = getHookCommand('pre-tool-write');
      const { warns } = captureOutput(() => {
        executeHook(command, { cwd: tempDir, toolInput: { path: 'src/foo.ts' } });
      });
      assert.ok(warns.some(w => w.includes('no plan-remediation artifact found')));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

});

// ---------------------------------------------------------------------------
// No active workflow
// ---------------------------------------------------------------------------
describe('Pre-write — No active workflow', () => {

  it('no active-workflow.json: no workflow warning', async () => {
    const tempDir = await createTempDir();
    try {
      const command = getHookCommand('pre-tool-write');
      const { warns } = captureOutput(() => {
        executeHook(command, { cwd: tempDir, toolInput: { path: 'src/foo.ts' } });
      });
      assert.ok(!warns.some(w => w.includes('[GSS WARN] Workflow:')));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('sensitive path + no active workflow: path warning fires', async () => {
    const tempDir = await createTempDir();
    try {
      const command = getHookCommand('pre-tool-write');
      const { warns } = captureOutput(() => {
        executeHook(command, { cwd: tempDir, toolInput: { path: '.env' } });
      });
      assert.ok(warns.some(w => w.includes('[GSS WARN] Path:')));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

});

// ---------------------------------------------------------------------------
// Resilience
// ---------------------------------------------------------------------------
describe('Pre-write — Resilience', () => {

  it('malformed active-workflow.json: graceful skip', async () => {
    const tempDir = await createTempDir();
    try {
      const env = setupFullEnvironment(tempDir);
      writeFileSync(join(env.artifactsDir, 'active-workflow.json'), 'not-valid-json{');
      const command = getHookCommand('pre-tool-write');
      const { warns } = captureOutput(() => {
        executeHook(command, { cwd: tempDir, toolInput: { path: 'src/foo.ts' } });
      });
      assert.ok(!warns.some(w => w.includes('review-only') || w.includes('Workflow:')));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('hook catches error without throwing', async () => {
    const tempDir = await createTempDir();
    try {
      const command = getHookCommand('pre-tool-write');
      const output = captureOutput(() => {
        executeHook(command, { cwd: tempDir, toolInput: { path: 'src/foo.ts' } });
      });
      assert.ok(true, 'Hook completed without throwing');
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

});
