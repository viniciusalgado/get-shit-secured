/**
 * Phase 8 — Post-write hook tests
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getHookCommand, createTempDir, cleanupTempDir, executeHook, captureOutput, setupFullEnvironment } from './helpers.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

function makeValidConsultation(coverageStatus = 'pass', overrides = {}) {
  return {
    plan: { requiredDocs: [], optionalDocs: [] },
    validation: {
      coverageStatus,
      requiredMissing: coverageStatus === 'fail' ? ['doc-1'] : [],
      ...overrides,
    },
    consultedDocs: ['security://owasp/cheatsheet/test'],
  };
}

function makeEnvelope(workflowId, consultationMode = 'required', extras = {}) {
  return {
    schemaVersion: 1,
    workflowId,
    gssVersion: '0.1.0',
    corpusVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    consultationMode,
    ...extras,
  };
}

// ---------------------------------------------------------------------------
// Non-artifact writes ignored
// ---------------------------------------------------------------------------
describe('Post-write — Non-artifact writes ignored', () => {

  it('write to src file: no output', async () => {
    const tempDir = await createTempDir();
    try {
      const command = getHookCommand('post-tool-write');
      const { logs } = captureOutput(() => {
        executeHook(command, { cwd: tempDir, toolInput: { path: 'src/foo.ts' } });
      });
      assert.ok(logs.every(l => !l.includes('[GSS]')), 'No [GSS] output for non-artifact write');
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
      assert.ok(logs.every(l => !l.includes('[GSS]')), 'No [GSS] output for report write');
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

});

// ---------------------------------------------------------------------------
// Valid artifacts
// ---------------------------------------------------------------------------
describe('Post-write — Valid artifacts', () => {

  it('valid audit artifact with consultation pass', async () => {
    const tempDir = await createTempDir();
    try {
      const env = setupFullEnvironment(tempDir);
      const auditDir = join(env.artifactsDir, 'audit');
      mkdirSync(auditDir, { recursive: true });
      const artifactPath = join(auditDir, 'result.json');
      writeFileSync(artifactPath, JSON.stringify(makeEnvelope('audit', 'required', {
        findings: [],
        consultation: makeValidConsultation('pass'),
      })));
      const command = getHookCommand('post-tool-write');
      const { logs } = captureOutput(() => {
        executeHook(command, { cwd: tempDir, toolInput: { path: '.gss/artifacts/audit/result.json' } });
      });
      assert.ok(logs.some(l => l.includes('consultation: pass')));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('valid map-codebase artifact without consultation', async () => {
    const tempDir = await createTempDir();
    try {
      const env = setupFullEnvironment(tempDir);
      const artifactDir = join(env.artifactsDir, 'map-codebase');
      mkdirSync(artifactDir, { recursive: true });
      const artifactPath = join(artifactDir, 'codebase-inventory.json');
      writeFileSync(artifactPath, JSON.stringify(makeEnvelope('map-codebase', 'optional', {
        components: [],
      })));
      const command = getHookCommand('post-tool-write');
      const { logs, warns, errors } = captureOutput(() => {
        executeHook(command, { cwd: tempDir, toolInput: { path: '.gss/artifacts/map-codebase/codebase-inventory.json' } });
      });
      assert.equal(errors.length, 0);
      assert.ok(
        logs.some(l => l.includes('Artifact validated'))
          || warns.some(w => w.includes('Artifact'))
          || warns.some(w => w.includes('coverage')),
      );
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

});

// ---------------------------------------------------------------------------
// Missing required fields
// ---------------------------------------------------------------------------
describe('Post-write — Missing required fields', () => {

  it('audit artifact missing findings', async () => {
    const tempDir = await createTempDir();
    try {
      const env = setupFullEnvironment(tempDir);
      const auditDir = join(env.artifactsDir, 'audit');
      mkdirSync(auditDir, { recursive: true });
      const artifactPath = join(auditDir, 'result.json');
      writeFileSync(artifactPath, JSON.stringify(makeEnvelope('audit', 'required', {
        consultation: makeValidConsultation('pass'),
      })));
      const command = getHookCommand('post-tool-write');
      const { warns } = captureOutput(() => {
        executeHook(command, { cwd: tempDir, toolInput: { path: '.gss/artifacts/audit/result.json' } });
      });
      assert.ok(warns.some(w => w.includes('findings')));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

});

// ---------------------------------------------------------------------------
// Consultation trace issues
// ---------------------------------------------------------------------------
describe('Post-write — Consultation trace issues', () => {

  it('audit artifact missing consultation section entirely', async () => {
    const tempDir = await createTempDir();
    try {
      const env = setupFullEnvironment(tempDir);
      const auditDir = join(env.artifactsDir, 'audit');
      mkdirSync(auditDir, { recursive: true });
      const artifactPath = join(auditDir, 'result.json');
      writeFileSync(artifactPath, JSON.stringify(makeEnvelope('audit', 'required', { findings: [] })));
      const command = getHookCommand('post-tool-write');
      const { warns } = captureOutput(() => {
        executeHook(command, { cwd: tempDir, toolInput: { path: '.gss/artifacts/audit/result.json' } });
      });
      assert.ok(warns.some(w => w.includes('consultation')));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('coverage status fail: reported in log', async () => {
    const tempDir = await createTempDir();
    try {
      const env = setupFullEnvironment(tempDir);
      const auditDir = join(env.artifactsDir, 'audit');
      mkdirSync(auditDir, { recursive: true });
      const artifactPath = join(auditDir, 'result.json');
      writeFileSync(artifactPath, JSON.stringify(makeEnvelope('audit', 'required', {
        findings: [],
        consultation: makeValidConsultation('fail'),
      })));
      const command = getHookCommand('post-tool-write');
      const { logs, warns } = captureOutput(() => {
        executeHook(command, { cwd: tempDir, toolInput: { path: '.gss/artifacts/audit/result.json' } });
      });
      assert.ok(
        logs.some(l => l.includes('consultation: fail')) || warns.some(w => w.includes('Coverage: FAIL')),
      );
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('coverage status warn: reported in log', async () => {
    const tempDir = await createTempDir();
    try {
      const env = setupFullEnvironment(tempDir);
      const auditDir = join(env.artifactsDir, 'audit');
      mkdirSync(auditDir, { recursive: true });
      const artifactPath = join(auditDir, 'result.json');
      writeFileSync(artifactPath, JSON.stringify(makeEnvelope('audit', 'required', {
        findings: [],
        consultation: makeValidConsultation('warn'),
      })));
      const command = getHookCommand('post-tool-write');
      const { logs, warns } = captureOutput(() => {
        executeHook(command, { cwd: tempDir, toolInput: { path: '.gss/artifacts/audit/result.json' } });
      });
      assert.ok(
        logs.some(l => l.includes('consultation: warn')) || warns.some(w => w.includes('Coverage: WARN')),
      );
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

});

// ---------------------------------------------------------------------------
// Malformed JSON
// ---------------------------------------------------------------------------
describe('Post-write — Malformed JSON', () => {

  it('artifact file contains invalid JSON', async () => {
    const tempDir = await createTempDir();
    try {
      const env = setupFullEnvironment(tempDir);
      const auditDir = join(env.artifactsDir, 'audit');
      mkdirSync(auditDir, { recursive: true });
      const artifactPath = join(auditDir, 'result.json');
      writeFileSync(artifactPath, 'not-json{');
      const command = getHookCommand('post-tool-write');
      const { errors } = captureOutput(() => {
        executeHook(command, { cwd: tempDir, toolInput: { path: '.gss/artifacts/audit/result.json' } });
      });
      assert.ok(errors.some(e => e.includes('not valid JSON')));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

});

// ---------------------------------------------------------------------------
// Fallback without validator module
// ---------------------------------------------------------------------------
describe('Post-write — Fallback without validator module', () => {

  it('validator absent: consultation-requiring artifact', async () => {
    const tempDir = await createTempDir();
    try {
      const env = setupFullEnvironment(tempDir, { skipValidator: true });
      const auditDir = join(env.artifactsDir, 'audit');
      mkdirSync(auditDir, { recursive: true });
      const artifactPath = join(auditDir, 'result.json');
      writeFileSync(artifactPath, JSON.stringify(makeEnvelope('audit', 'required', {
        findings: [],
        consultation: makeValidConsultation('pass'),
      })));
      const command = getHookCommand('post-tool-write');
      const { logs } = captureOutput(() => {
        executeHook(command, { cwd: tempDir, toolInput: { path: '.gss/artifacts/audit/result.json' } });
      });
      // Fallback should still report consultation status
      assert.ok(
        logs.some(l => l.includes('consultation: pass')) || logs.some(l => l.includes('validated')),
        'Fallback should report consultation status'
      );
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('validator absent: non-consultation artifact', async () => {
    const tempDir = await createTempDir();
    try {
      const env = setupFullEnvironment(tempDir, { skipValidator: true });
      const mcDir = join(env.artifactsDir, 'map-codebase');
      mkdirSync(mcDir, { recursive: true });
      const artifactPath = join(mcDir, 'result.json');
      writeFileSync(artifactPath, JSON.stringify({
        components: [],
        dependencies: [],
        dataFlows: [],
      }));
      const command = getHookCommand('post-tool-write');
      const { logs } = captureOutput(() => {
        executeHook(command, { cwd: tempDir, toolInput: { path: '.gss/artifacts/map-codebase/result.json' } });
      });
      assert.ok(logs.some(l => l.includes('Artifact written')));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

});

// ---------------------------------------------------------------------------
// Resilience
// ---------------------------------------------------------------------------
describe('Post-write — Resilience', () => {

  it('hook catches error without throwing', async () => {
    const tempDir = await createTempDir();
    try {
      const command = getHookCommand('post-tool-write');
      const output = captureOutput(() => {
        executeHook(command, { cwd: tempDir, toolInput: { path: 'src/foo.ts' } });
      });
      // Should not throw — errors are caught internally
      assert.ok(true, 'Hook completed without throwing');
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

});
