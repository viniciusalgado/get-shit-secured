/**
 * Integration tests for Phase 12 — Artifact envelope pipeline.
 *
 * Validates the end-to-end flow:
 *   buildConsultationTrace() → wrap in envelope → isArtifactEnvelope()
 *   → validateArtifactEnvelope() → formatTraceSummary()
 *   → compareArtifactTraces()
 *
 * Also validates file I/O round-trip persistence.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';

import { buildConsultationTrace, buildNotApplicableEnvelope } from '../../dist/runtime/consultation-trace-builder.js';
import { isArtifactEnvelope, validateArtifactEnvelope } from '../../dist/runtime/artifact-envelope-validator.js';
import { formatTraceSummary, formatTraceOneLiner } from '../../dist/runtime/trace-summary-formatter.js';
import { compareArtifactTraces } from '../../dist/runtime/artifact-diff.js';

function createTempDir() {
  return mkdtemp(join(tmpdir(), 'gss-p12-pipeline-'));
}

function makePlan(overrides = {}) {
  return {
    schemaVersion: 1,
    workflowId: 'audit',
    generatedAt: '2026-04-02T12:00:00Z',
    signals: { issueTags: ['sql-injection'], stacks: ['node'], changedFiles: [] },
    required: [{ docId: 'sql-injection-prevention', docUri: 'security://owasp/cheatsheet/sql-injection-prevention', reason: 'workflow binding', signalType: 'workflow-binding', score: 1.0, orderIndex: 0 }],
    optional: [{ docId: 'input-validation', docUri: 'security://owasp/cheatsheet/input-validation', reason: 'stack binding', signalType: 'stack-binding', score: 0.7, orderIndex: 1 }],
    followup: [],
    constraints: { maxRequired: 5, maxOptional: 8, maxFollowup: 3, allowFollowUpExpansion: true, failOnMissingRequired: true },
    corpusVersion: '2026-03-31',
    ...overrides,
  };
}

function makeValidation(overrides = {}) {
  return {
    schemaVersion: 1,
    workflowId: 'audit',
    checkedAt: '2026-04-02T12:01:00Z',
    consulted: ['sql-injection-prevention'],
    requiredMissing: [],
    unexpectedConsulted: [],
    optionalMissed: ['input-validation'],
    coverageStatus: 'pass',
    notes: [],
    stats: { requiredTotal: 1, requiredConsulted: 1, optionalTotal: 1, optionalConsulted: 0 },
    ...overrides,
  };
}

function wrapInEnvelope(trace, overrides = {}) {
  return {
    schemaVersion: 1,
    workflowId: 'audit',
    gssVersion: '0.1.0',
    corpusVersion: '2026-03-31',
    generatedAt: new Date().toISOString(),
    consultationMode: 'required',
    consultation: trace,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Integration tests
// ---------------------------------------------------------------------------
describe('Phase 12 — Artifact envelope pipeline integration', () => {

  it('should complete full pipeline for required workflow (pass)', () => {
    // Build trace from plan + docs + validation
    const plan = makePlan();
    const validation = makeValidation();
    const trace = buildConsultationTrace(plan, ['sql-injection-prevention'], validation);

    // Wrap in envelope
    const envelope = wrapInEnvelope(trace);

    // Validate with type guard
    assert.strictEqual(isArtifactEnvelope(envelope), true);

    // Detailed validation
    const result = validateArtifactEnvelope(envelope);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.errors.length, 0);

    // Format summary
    const summary = formatTraceSummary(trace);
    assert.ok(summary.includes('Coverage status: pass'), `Expected pass in summary, got: ${summary}`);
  });

  it('should complete full pipeline for not-applicable workflow', () => {
    const envelope = buildNotApplicableEnvelope('report', '0.1.0', '2026-03-31');

    assert.strictEqual(isArtifactEnvelope(envelope), true);

    const result = validateArtifactEnvelope(envelope);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.errors.length, 0);
    assert.strictEqual(envelope.consultationMode, 'not-applicable');
  });

  it('should handle pipeline with coverage failure', () => {
    const plan = makePlan();
    const validation = makeValidation({
      coverageStatus: 'fail',
      consulted: [],
      requiredMissing: ['sql-injection-prevention'],
      stats: { requiredTotal: 1, requiredConsulted: 0, optionalTotal: 1, optionalConsulted: 0 },
    });
    const trace = buildConsultationTrace(plan, [], validation);
    const envelope = wrapInEnvelope(trace);

    // Envelope is structurally valid even with failure trace
    const result = validateArtifactEnvelope(envelope);
    assert.strictEqual(result.valid, true);

    // Summary reflects failure
    const summary = formatTraceSummary(trace);
    assert.ok(summary.includes('Coverage status: fail'), `Expected fail, got: ${summary}`);
    assert.ok(summary.includes('sql-injection-prevention'), `Expected missing doc, got: ${summary}`);
  });

  it('should diff two envelopes through full pipeline', () => {
    const plan = makePlan();
    const validationA = makeValidation();
    const traceA = buildConsultationTrace(plan, ['sql-injection-prevention', 'input-validation', 'logging-cheatsheet'], validationA);
    const envelopeA = wrapInEnvelope(traceA);

    const validationB = makeValidation();
    const traceB = buildConsultationTrace(plan, ['sql-injection-prevention'], validationB);
    const envelopeB = wrapInEnvelope(traceB);

    const diff = compareArtifactTraces(envelopeA, envelopeB);

    assert.strictEqual(diff.docsInAOnly.length, 2, `Expected 2 docs in A only, got: ${diff.docsInAOnly}`);
    // Delta is proportional: A=1/3 overlap, B=1/1 overlap → delta = 0.33-1.0 = -0.67
    assert.ok(diff.coverageDelta < 0, `Expected negative delta (B proportionally better), got ${diff.coverageDelta}`);
  });

  it('should complete pipeline for optional workflow without consultation', () => {
    const envelope = {
      schemaVersion: 1,
      workflowId: 'map-codebase',
      gssVersion: '0.1.0',
      corpusVersion: '2026-03-31',
      generatedAt: new Date().toISOString(),
      consultationMode: 'optional',
    };

    assert.strictEqual(isArtifactEnvelope(envelope), true);
    const result = validateArtifactEnvelope(envelope);
    assert.strictEqual(result.valid, true);
  });

  it('should round-trip envelope through file I/O', async () => {
    const dir = await createTempDir();
    try {
      const plan = makePlan();
      const validation = makeValidation();
      const trace = buildConsultationTrace(plan, ['sql-injection-prevention'], validation);
      const envelope = wrapInEnvelope(trace);

      // Write to file
      const filePath = join(dir, 'test-envelope.json');
      writeFileSync(filePath, JSON.stringify(envelope, null, 2));

      // Read back
      const raw = readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);

      // Validate round-tripped envelope
      assert.strictEqual(isArtifactEnvelope(parsed), true);
      const result = validateArtifactEnvelope(parsed);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(parsed.consultation.coverageStatus, 'pass');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

});
