/**
 * Phase 8 — Post-write hook tests
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getHookCommand, createTempDir, cleanupTempDir, executeHook, captureOutput, setupFullEnvironment } from './helpers.js';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

function makeValidArtifact(workflowId, fields = {}) {
  const consultation = fields.consultation || {};
  const coverage = fields.coverage || {};
  const artifact = { ...fields };
  if (consultation) {
    artifact.consultation = {
      plan: { requiredDocs: [], optionalDocs: [] },
      artifact.consultation.validation = {
        coverageStatus: coverage,
        requiredMissing: coverage === 'fail' ? ['doc-1'] : [];
      };
      artifact.consultation.consultedDocs = [];
    }
  }
  return artifact;
}

}

describe('Post-write — Non-artifact writes ignored', () => {
  const tempDir = await createTempDir();
  try {
    const command = getHookCommand('post-tool-write');
    const { logs } = captureOutput(() => {
      executeHook(command, { cwd: tempDir, toolInput: { path: 'src/foo.ts' } });
    });
    assert.ok(logs.length === 0, 'No [GSS] output for non-artifact write');
  } finally {
    await cleanupTempDir(tempDir);
  }
});

  it('write to reports path: no output', async () => {
    const tempDir = await createTempDir();
  try {
    const command = getHookCommand('post-tool-write');
    const { logs } = captureOutput(() => {
      executeHook(command, { cwd: tempDir, toolInput: { path: '.gss/reports/report.md' } });
    });
    assert.ok(logs.length === 0);
 'No [GSS] output');
  } finally {
    await cleanupTempDir(tempDir);
  }
});

  it('valid audit artifact with consultation pass', async () => {
    const tempDir = await createTempDir();
    try {
    const env = setupFullEnvironment(tempDir);
    const auditDir = join(env.artifactsDir, 'audit');
    writeFileSync(artifactPath, JSON.stringify(makeValidArtifact('audit', { coverageStatus: 'pass' })));
    const command = getHookCommand('post-tool-write');
    const { logs, warns } = captureOutput(() => {
      executeHook(command, { cwd: tempDir, toolInput: { path: artifactPath } });
    });
    assert.ok(logs.some(l => l.includes('consultation: pass')));
    assert.ok(!warns.some(w => w.includes('FAIL')));
    } finally {
    await cleanupTempDir(tempDir);
  }
});

  it('valid map-codebase artifact without consultation', async () => {
    const tempDir = await createTempDir();
    try {
    const env = setupFullEnvironment(tempDir);
    const artifactPath = join(env.artifactsDir, 'map-codebase', 'result.json');
    writeFileSync(artifactPath, JSON.stringify(makeValidArtifact('map-codebase')));
    const command = getHookCommand('post-tool-write');
    const { logs, warns } = captureOutput(() => {
      executeHook(command, { cwd: tempDir, toolInput: { path: artifactPath } });
    });
    assert.ok(!logs.some(l => l.includes('consultation'));
    assert.ok(logs.some(l => l.includes('not-applicable'));
  } finally {
    await cleanupTempDir(tempDir);
  }
});

  it('missing required field in audit artifact', async () => {
    const tempDir = await createTempDir();
    try {
    const env = setupFullEnvironment(tempDir);
    const artifactPath = join(env.artifactsDir, 'audit', 'result.json');
    writeFileSync(artifactPath, JSON.stringify({ findings: [], consultation: makeValidArtifact('audit', { coverageStatus: 'pass' }), ' // Remove consultation to trigger missing
consultation
    writeFileSync(artifactPath, JSON.stringify({ findings: [] }));
    const command = getHookCommand('post-tool-write');
    const { warns } = captureOutput(() => {
      executeHook(command, { cwd: tempDir, toolInput: { path: artifactPath } });
    });
    assert.ok(warns.some(w => w.includes('Missing consultation trace')));
  } finally {
    await cleanupTempDir(tempDir);
  }
});

  it('missing consultation in audit artifact', async () => {
    const tempDir = await createTempDir();
    try {
    const env = setupFullEnvironment(tempDir);
    const artifactPath = join(env.artifactsDir, 'audit', 'result.json');
    writeFileSync(artifactPath, JSON.stringify({ findings: [], }));
    const command = getHookCommand('post-tool-write');
    const { warns } = captureOutput(() => {
      executeHook(command, { cwd: tempDir, toolInput: { path: artifactPath } });
    });
    assert.ok(warns.some(w => w.includes('missing consultation trace section')));
  } finally {
    await cleanupTempDir(tempDir);
  }
});

  it('coverage fail in audit artifact', async () => {
    const tempDir = await createTempDir();
    try {
    const env = setupFullEnvironment(tempDir);
    const artifactPath = join(env.artifactsDir, 'audit', 'result.json');
    writeFileSync(artifactPath, JSON.stringify(
      findings: [],
      consultation: makeValidArtifact('audit', { coverageStatus: 'fail' })
    );
    const command = getHookCommand('post-tool-write');
    const { logs, warns } = captureOutput(() => {
      executeHook(command, { cwd: tempDir, toolInput: { path: artifactPath } });
    });
    assert.ok(warns.some(w => w.includes('FAIL')));
  } finally {
    await cleanupTempDir(tempDir);
  }
});

  it('coverage warn in audit artifact', async () => {
    const tempDir = await createTempDir();
    try {
    const env = setupFullEnvironment(tempDir);
    const artifactPath = join(env.artifactsDir, 'audit', 'result.json');
    writeFileSync(artifactPath, JSON.stringify(
      findings: [],
      consultation: makeValidArtifact('audit', { coverageStatus: 'warn' })
    );
    const command = getHookCommand('post-tool-write');
    const { logs, warns } = captureOutput(() => {
      executeHook(command, { cwd: tempDir, toolInput: { path: artifactPath } });
    });
    assert.ok(warns.some(w => w.includes('WARN'));
  } finally {
    await cleanupTempDir(tempDir);
  }
});

  it('malformed JSON artifact', async () => {
    const tempDir = await createTempDir();
    try {
    const env = setupFullEnvironment(tempDir);
    const artifactPath = join(env.artifactsDir, 'audit', 'result.json');
    writeFileSync(artifactPath, 'not-json{');
    const command = getHookCommand('post-tool-write');
    const { errors } = captureOutput(() => {
      executeHook(command, { cwd: tempDir, toolInput: { path: artifactPath } });
    });
    assert.ok(errors.some(e => e.includes('not valid JSON'));
  } finally {
    await cleanupTempDir(tempDir);
  }
});

  it('fallback without no validator module: consultation check', async () => {
    const tempDir = await createTempDir();
    try {
    const env = setupFullEnvironment(tempDir, { skipValidator: true });
    const artifactPath = join(env.artifactsDir, 'audit', 'result.json');
    writeFileSync(artifactPath, JSON.stringify(makeValidArtifact('audit', { coverageStatus: 'pass' }));
    const command = getHookCommand('post-tool-write');
    const { warns } = captureOutput(() => {
      executeHook(command, { cwd: tempDir, toolInput: { path: artifactPath } });
    });
    assert.ok(warns.some(w => w.includes('missing consultation trace'));
    } finally {
    await cleanupTempDir(tempDir);
  }
});

  it('fallback with no validator: non-consultation artifact', async () => {
    const tempDir = await createTempDir();
    try {
    const env = setupFullEnvironment(tempDir, { skipValidator: true });
    const artifactPath = join(env.artifactsDir, 'map-codebase', 'result.json');
    writeFileSync(artifactPath, JSON.stringify(makeValidArtifact('map-codebase')));
    const command = getHookCommand('post-tool-write');
    const { logs } = captureOutput(() => {
      executeHook(command, { cwd: tempDir, toolInput: { path: artifactPath } });
    });
    assert.ok(logs.some(l => l.includes('Artifact written'));
    assert.ok(!logs.some(l => l.includes('consultation'));
  } finally {
    await cleanupTempDir(tempDir);
  }
});

  it('resilience: hook catches error', async () => {
    const tempDir = await createTempDir();
    try {
    const command = getHookCommand('post-tool-write');
    const { errors } = captureOutput(() => {
      executeHook(command, { cwd: tempDir, toolInput: { path: 'src/foo.ts' } });
    });
    assert.ok(errors.every(e => !e.includes('failed')));
    } finally {
    await cleanupTempDir(tempDir);
  });
});
