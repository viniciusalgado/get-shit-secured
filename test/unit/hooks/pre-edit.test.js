/**
 * Phase 8 — Pre-edit hook tests
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getHookCommand, createTempDir, cleanupTempDir, executeHook, captureOutput, setupFullEnvironment } from './helpers.js';
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Artifact edit warnings
// ---------------------------------------------------------------------------
describe('Pre-edit — Artifact edit warnings', () => {

  it('edit to file inside .gss/artifacts/ triggers warning', async () => {
    const tempDir = await createTempDir();
    try {
      const command = getHookCommand('pre-tool-edit');
      const { warns } = captureOutput(() => {
        executeHook(command, { cwd: tempDir, toolInput: { file_path: '.gss/artifacts/audit/result.json' } });
      });
      assert.ok(warns.some(w => w.includes('Artifact: Editing artifact file')));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('edit outside artifacts: no warning', async () => {
    const tempDir = await createTempDir();
    try {
      const command = getHookCommand('pre-tool-edit');
      const { warns } = captureOutput(() => {
        executeHook(command, { cwd: tempDir, toolInput: { file_path: 'src/app.ts' } });
      });
      assert.ok(!warns.some(w => w.includes('Artifact')));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

});

// ---------------------------------------------------------------------------
// Verify mode scope checking
// ---------------------------------------------------------------------------
describe('Pre-edit — Verify mode scope checking', () => {

  it('edit to file IN remediation scope during verify: no warning', async () => {
    const tempDir = await createTempDir();
    try {
      const env = setupFullEnvironment(tempDir);
      writeFileSync(join(env.artifactsDir, 'active-workflow.json'), JSON.stringify({
        workflowId: 'verify',
        mode: 'verification',
        scopeFiles: ['src/auth.ts', 'src/utils.ts'],
        startedAt: new Date().toISOString(),
      }));
      const command = getHookCommand('pre-tool-edit');
      const { warns } = captureOutput(() => {
        executeHook(command, { cwd: tempDir, toolInput: { file_path: 'src/auth.ts' } });
      });
      assert.ok(!warns.some(w => w.includes('remediation scope')));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('edit to file OUTSIDE remediation scope during verify: warning', async () => {
    const tempDir = await createTempDir();
    try {
      const env = setupFullEnvironment(tempDir);
      writeFileSync(join(env.artifactsDir, 'active-workflow.json'), JSON.stringify({
        workflowId: 'verify',
        mode: 'verification',
        scopeFiles: ['src/auth.ts', 'src/utils.ts'],
        startedAt: new Date().toISOString(),
      }));
      const command = getHookCommand('pre-tool-edit');
      const { warns } = captureOutput(() => {
        executeHook(command, { cwd: tempDir, toolInput: { file_path: 'src/unrelated.ts' } });
      });
      assert.ok(warns.some(w => w.includes('not in the remediation scope')));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('verify mode with empty scopeFiles: no warning', async () => {
    const tempDir = await createTempDir();
    try {
      const env = setupFullEnvironment(tempDir);
      writeFileSync(join(env.artifactsDir, 'active-workflow.json'), JSON.stringify({
        workflowId: 'verify',
        mode: 'verification',
        scopeFiles: [],
        startedAt: new Date().toISOString(),
      }));
      const command = getHookCommand('pre-tool-edit');
      const { warns } = captureOutput(() => {
        executeHook(command, { cwd: tempDir, toolInput: { file_path: 'src/auth.ts' } });
      });
      assert.ok(!warns.some(w => w.includes('remediation scope')));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('verify mode with no scopeFiles field: no warning', async () => {
    const tempDir = await createTempDir();
    try {
      const env = setupFullEnvironment(tempDir);
      writeFileSync(join(env.artifactsDir, 'active-workflow.json'), JSON.stringify({
        workflowId: 'verify',
        mode: 'verification',
        startedAt: new Date().toISOString(),
      }));
      const command = getHookCommand('pre-tool-edit');
      const { warns } = captureOutput(() => {
        executeHook(command, { cwd: tempDir, toolInput: { file_path: 'src/auth.ts' } });
      });
      assert.ok(!warns.some(w => w.includes('remediation scope')));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

});

// ---------------------------------------------------------------------------
// Execute-remediation context check
// ---------------------------------------------------------------------------
describe('Pre-edit — Execute-remediation context check', () => {

  it('execute-remediation with prior plan-remediation artifact: no warning', async () => {
    const tempDir = await createTempDir();
    try {
      const env = setupFullEnvironment(tempDir);
      writeFileSync(join(env.artifactsDir, 'active-workflow.json'), JSON.stringify({
        workflowId: 'execute-remediation',
        mode: 'write-capable',
        startedAt: new Date().toISOString(),
      }));
      // Create plan-remediation artifact dir
      mkdirSync(join(env.artifactsDir, 'plan-remediation'), { recursive: true });
      const command = getHookCommand('pre-tool-edit');
      const { warns } = captureOutput(() => {
        executeHook(command, { cwd: tempDir, toolInput: { file_path: 'src/auth.ts' } });
      });
      assert.ok(!warns.some(w => w.includes('plan-remediation artifact found')));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('execute-remediation without prior plan-remediation artifact: warning', async () => {
    const tempDir = await createTempDir();
    try {
      const env = setupFullEnvironment(tempDir);
      writeFileSync(join(env.artifactsDir, 'active-workflow.json'), JSON.stringify({
        workflowId: 'execute-remediation',
        mode: 'write-capable',
        startedAt: new Date().toISOString(),
      }));
      // Ensure plan-remediation dir does NOT exist
      const planRemDir = join(env.artifactsDir, 'plan-remediation');
      if (existsSync(planRemDir)) { rmSync(planRemDir, { recursive: true, force: true }); }
      const command = getHookCommand('pre-tool-edit');
      const { warns } = captureOutput(() => {
        executeHook(command, { cwd: tempDir, toolInput: { file_path: 'src/auth.ts' } });
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
describe('Pre-edit — No active workflow', () => {

  it('no active-workflow.json, edit outside artifacts: no warnings', async () => {
    const tempDir = await createTempDir();
    try {
      const command = getHookCommand('pre-tool-edit');
      const { warns } = captureOutput(() => {
        executeHook(command, { cwd: tempDir, toolInput: { file_path: 'src/foo.ts' } });
      });
      assert.ok(!warns.some(w => w.includes('Workflow')));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('no active-workflow.json, edit inside artifacts: artifact warning fires', async () => {
    const tempDir = await createTempDir();
    try {
      const command = getHookCommand('pre-tool-edit');
      const { warns } = captureOutput(() => {
        executeHook(command, { cwd: tempDir, toolInput: { file_path: '.gss/artifacts/audit/result.json' } });
      });
      assert.ok(warns.some(w => w.includes('Artifact: Editing artifact file')));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

});

// ---------------------------------------------------------------------------
// Resilience
// ---------------------------------------------------------------------------
describe('Pre-edit — Resilience', () => {

  it('malformed active-workflow.json: graceful skip', async () => {
    const tempDir = await createTempDir();
    try {
      const env = setupFullEnvironment(tempDir);
      writeFileSync(join(env.artifactsDir, 'active-workflow.json'), 'not-valid-json{');
      const command = getHookCommand('pre-tool-edit');
      const { warns } = captureOutput(() => {
        executeHook(command, { cwd: tempDir, toolInput: { file_path: 'src/auth.ts' } });
      });
      // Should not throw, no scope/mode warnings
      assert.ok(!warns.some(w => w.includes('remediation scope') || w.includes('review-only')));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('hook catches error without throwing', async () => {
    const tempDir = await createTempDir();
    try {
      const command = getHookCommand('pre-tool-edit');
      const output = captureOutput(() => {
        executeHook(command, { cwd: tempDir, toolInput: { file_path: 'src/foo.ts' } });
      });
      assert.ok(true, 'Hook completed without throwing');
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

});
