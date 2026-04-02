/**
 * Integration tests for Phase 12 — diff-artifacts CLI with real file I/O.
 *
 * Validates end-to-end diffArtifacts CLI with real files on disk:
 *   write artifact → invoke CLI → check exit code and stdout.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';

import { diffArtifacts } from '../../dist/cli/diff-artifacts.js';
import { existsSync } from 'node:fs';

const distAvailable = existsSync('dist/core/types.js');

function createTempDir() {
  return mkdtemp(join(tmpdir(), 'gss-p12-diffint-'));
}

function writeArtifact(dir, name, data) {
  const path = join(dir, name);
  writeFileSync(path, JSON.stringify(data, null, 2));
  return path;
}

function makeEnvelope(overrides = {}) {
  return {
    schemaVersion: 1,
    workflowId: 'audit',
    gssVersion: '0.1.0',
    corpusVersion: '2026-03-31',
    generatedAt: '2026-04-02T12:00:00Z',
    consultationMode: 'required',
    consultation: {
      plan: { workflowId: 'audit', generatedAt: '2026-04-02T12:00:00Z', corpusVersion: '2026-03-31', requiredCount: 2, optionalCount: 0, followupCount: 0 },
      consultedDocs: [
        { id: 'sql-injection-prevention', title: 'SQL Injection', sourceUrl: 'https://...' },
        { id: 'input-validation', title: 'Input Validation', sourceUrl: 'https://...' },
      ],
      coverageStatus: 'pass',
      requiredMissing: [],
      notes: [],
    },
    ...overrides,
  };
}

function captureOutputAsync(fn) {
  const output = { stdout: '', stderr: '' };
  const origLog = console.log;
  const origWarn = console.warn;
  const origError = console.error;
  console.log = (...args) => { output.stdout += args.join(' ') + '\n'; };
  console.warn = (...args) => { output.stderr += args.join(' ') + '\n'; };
  console.error = (...args) => { output.stderr += args.join(' ') + '\n'; };
  return fn().then((result) => {
    console.log = origLog;
    console.warn = origWarn;
    console.error = origError;
    return { result, ...output };
  }).catch((err) => {
    console.log = origLog;
    console.warn = origWarn;
    console.error = origError;
    throw err;
  });
}

// ---------------------------------------------------------------------------
// Integration tests
// ---------------------------------------------------------------------------
describe('Phase 12 — diff-artifacts CLI integration', { skip: !distAvailable }, () => {

  it('should compare two valid artifact files and exit 0', async () => {
    const dir = await createTempDir();
    try {
      const artifact = makeEnvelope();
      const pathA = writeArtifact(dir, 'a.json', artifact);
      const pathB = writeArtifact(dir, 'b.json', artifact);

      const { result, stdout } = await captureOutputAsync(() => diffArtifacts(['--a', pathA, '--b', pathB]));
      assert.strictEqual(result, 0);
      assert.ok(stdout.includes('Artifact Trace Comparison'), `Expected header, got: ${stdout}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should show divergent coverage correctly', async () => {
    const dir = await createTempDir();
    try {
      const artifactA = makeEnvelope({
        consultation: {
          plan: { workflowId: 'audit', generatedAt: '2026-04-02T12:00:00Z', corpusVersion: '2026-03-31', requiredCount: 3, optionalCount: 0, followupCount: 0 },
          consultedDocs: [
            { id: 'sql-injection-prevention', title: 'SQL Injection', sourceUrl: 'https://...' },
            { id: 'input-validation', title: 'Input Validation', sourceUrl: 'https://...' },
            { id: 'xss-prevention', title: 'XSS Prevention', sourceUrl: 'https://...' },
          ],
          coverageStatus: 'pass',
          requiredMissing: [],
          notes: [],
        },
      });
      const artifactB = makeEnvelope({
        consultation: {
          plan: { workflowId: 'audit', generatedAt: '2026-04-02T12:00:00Z', corpusVersion: '2026-03-31', requiredCount: 1, optionalCount: 0, followupCount: 0 },
          consultedDocs: [
            { id: 'sql-injection-prevention', title: 'SQL Injection', sourceUrl: 'https://...' },
          ],
          coverageStatus: 'warn',
          requiredMissing: [],
          notes: [],
        },
      });

      const pathA = writeArtifact(dir, 'a.json', artifactA);
      const pathB = writeArtifact(dir, 'b.json', artifactB);

      const { result, stdout } = await captureOutputAsync(() => diffArtifacts(['--a', pathA, '--b', pathB]));
      assert.strictEqual(result, 0);
      assert.ok(stdout.includes('input-validation'), `Expected doc name in output, got: ${stdout}`);
      assert.ok(stdout.includes('xss-prevention'), `Expected doc name in output, got: ${stdout}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should exit 1 for non-JSON file', async () => {
    const dir = await createTempDir();
    try {
      const artifact = makeEnvelope();
      const pathA = writeArtifact(dir, 'a.json', artifact);
      const badPath = join(dir, 'bad.json');
      writeFileSync(badPath, 'not-json-content');

      const { result } = await captureOutputAsync(() => diffArtifacts(['--a', pathA, '--b', badPath]));
      assert.strictEqual(result, 1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should handle optional artifact without consultation', async () => {
    const dir = await createTempDir();
    try {
      const optArtifact = {
        schemaVersion: 1, workflowId: 'map-codebase', gssVersion: '0.1.0',
        corpusVersion: '2026-03-31', generatedAt: '2026-04-02T12:00:00Z',
        consultationMode: 'optional',
      };
      const reqArtifact = makeEnvelope({ workflowId: 'audit' });
      const pathA = writeArtifact(dir, 'opt.json', optArtifact);
      const pathB = writeArtifact(dir, 'req.json', reqArtifact);

      const { result, stdout } = await captureOutputAsync(() => diffArtifacts(['--a', pathA, '--b', pathB]));
      assert.strictEqual(result, 0);
      assert.ok(stdout.includes('none'), `Expected none status for A, got: ${stdout}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should show zero delta for identical artifacts', async () => {
    const dir = await createTempDir();
    try {
      const artifact = makeEnvelope();
      const pathA = writeArtifact(dir, 'a.json', artifact);
      const pathB = writeArtifact(dir, 'b.json', artifact);

      const { result, stdout } = await captureOutputAsync(() => diffArtifacts(['--a', pathA, '--b', pathB]));
      assert.strictEqual(result, 0);
      assert.ok(stdout.includes('0'), `Expected zero delta in output, got: ${stdout}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

});
