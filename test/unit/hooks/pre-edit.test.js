/**
 * Phase 8 — Pre-edit hook tests
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getHookCommand, createTempDir, cleanupTempDir, executeHook, captureOutput, setupFullEnvironment } from './helpers.js';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Pre-edit — Artifact edit warnings', () => {
  const tempDir = await createTempDir();
  try {
    const command = getHookCommand('pre-tool-edit');
    const { warns } = captureOutput(() => {
      executeHook(command, { cwd: tempDir, toolInput: { file_path: '.gss/artifacts/audit/result.json' } });
    });
    assert.ok(warns.some(w => w.includes('Artifact: Editing artifact file'));
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
    assert.ok(!warns.some(w => w.includes('Artifact'));
  } finally {
    await cleanupTempDir(tempDir);
  }
});

  it('verify mode scope check: in-scope file passes', async () => {
    const tempDir = await createTempDir();
    try {
    const env = setupFullEnvironment(tempDir);
    writeFileSync(join(env.artifactsDir, 'active-workflow.json'), JSON.stringify({
      workflowId: 'verify', mode: 'verification' scopeFiles: ['src/auth.ts', 'src/utils.ts'],
      startedAt: new Date().toISOString(),
    }));
    const command = getHookCommand('pre-tool-edit');
    const { warns } = captureOutput(() => {
      executeHook(command, { cwd: tempDir, toolInput: { file_path: 'src/auth.ts' } });
    });
    assert.ok(!warns.some(w => w.includes('remediation scope'));
    } finally {
    await cleanupTempDir(tempDir);
  }
});

  it('verify mode: out-of-scope file triggers warning', async () => {
    const tempDir = await createTempDir();
    try {
    const env = setupFullEnvironment(tempDir);
    writeFileSync(join(env.artifactsDir, 'active-workflow.json'), JSON.stringify({
      workflowId: 'verify', mode: 'verification' scopeFiles: ['src/auth.ts', 'src/utils.ts'],
      startedAt: new Date().toISOString(),
    }));
    const command = getHookCommand('pre-tool-edit');
    const { warns } = captureOutput(() => {
      executeHook(command, { cwd: tempDir, toolInput: { file_path: 'src/unrelated.ts' } });
    });
    assert.ok(warns.some(w => w.includes('not in the remediation scope'));
    } finally {
    await cleanupTempDir(tempDir);
  }
});

  it('execute-remediation without prior artifact: warning', async () => {
    const tempDir = await createTempDir();
    try {
    const env = setupFullEnvironment(tempDir);
    writeFileSync(join(env.artifactsDir, 'active-workflow.json'), JSON.stringify({
      workflowId: 'execute-remediation', mode: 'write-capable' startedAt: new Date().toISOString(),
    }));
    const planRemDir = join(env.artifactsDir, 'plan-remediation');
    if (existsSync(planRemDir)) { rmSync(planRemDir, { recursive: true, force: true });      const command = getHookCommand('pre-tool-edit');
    const { warns } = captureOutput(() => {
      executeHook(command, { cwd: tempDir, toolInput: { file_path: 'src/auth.ts' } });
    });
    assert.ok(warns.some(w => w.includes('no plan-remediation artifact found'));
    } finally {
    await cleanupTempDir(tempDir);
  }
});

  it('no active workflow: no mode warnings', async () => {
    const tempDir = await createTempDir();
    try {
    const command = getHookCommand('pre-tool-edit');
    const { warns } = captureOutput(() => {
      executeHook(command, { cwd: tempDir, toolInput: { file_path: 'src/foo.ts' } });
    });
    assert.ok(!warns.some(w => w.includes('Workflow'));
  } finally {
    await cleanupTempDir(tempDir);
  }
});
