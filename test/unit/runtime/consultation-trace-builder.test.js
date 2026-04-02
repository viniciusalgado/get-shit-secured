/**
 * Phase 12 — Unit Tests: Consultation Trace Builder
 *
 * Tests buildConsultationTrace() and buildNotApplicableEnvelope().
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildConsultationTrace,
  buildNotApplicableEnvelope,
} from '../../../dist/runtime/consultation-trace-builder.js';

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

// ---------------------------------------------------------------------------
// buildConsultationTrace
// ---------------------------------------------------------------------------
describe('buildConsultationTrace()', () => {

  it('should produce valid trace for full coverage (pass)', () => {
    const plan = makePlan();
    const validation = makeValidation();
    const trace = buildConsultationTrace(plan, ['sql-injection-prevention'], validation);

    assert.strictEqual(trace.coverageStatus, 'pass');
    assert.strictEqual(trace.requiredMissing.length, 0);
    assert.strictEqual(trace.consultedDocs.length, 1);
    assert.strictEqual(trace.consultedDocs[0].id, 'sql-injection-prevention');
    assert.strictEqual(trace.plan.workflowId, 'audit');
    assert.strictEqual(trace.plan.requiredCount, 1);
    assert.strictEqual(trace.plan.optionalCount, 1);
    assert.strictEqual(trace.plan.followupCount, 0);
  });

  it('should produce warn for partial coverage', () => {
    const plan = makePlan();
    const validation = makeValidation({
      coverageStatus: 'warn',
      consulted: [],
      requiredMissing: ['sql-injection-prevention'],
      stats: { requiredTotal: 1, requiredConsulted: 0, optionalTotal: 1, optionalConsulted: 0 },
    });
    const trace = buildConsultationTrace(plan, [], validation);

    assert.strictEqual(trace.coverageStatus, 'warn');
    assert.strictEqual(trace.requiredMissing.length, 1);
    assert.strictEqual(trace.requiredMissing[0], 'sql-injection-prevention');
    assert.strictEqual(trace.consultedDocs.length, 0);
  });

  it('should produce fail for missing required docs', () => {
    const plan = makePlan();
    const validation = makeValidation({
      coverageStatus: 'fail',
      consulted: [],
      requiredMissing: ['sql-injection-prevention'],
      stats: { requiredTotal: 1, requiredConsulted: 0, optionalTotal: 1, optionalConsulted: 0 },
    });
    const trace = buildConsultationTrace(plan, [], validation);

    assert.strictEqual(trace.coverageStatus, 'fail');
    assert.strictEqual(trace.requiredMissing.length, 1);
  });

  it('should handle empty consulted docs', () => {
    const plan = makePlan({ required: [], optional: [] });
    const validation = makeValidation({
      coverageStatus: 'pass',
      consulted: [],
      requiredMissing: [],
      stats: { requiredTotal: 0, requiredConsulted: 0, optionalTotal: 0, optionalConsulted: 0 },
    });
    const trace = buildConsultationTrace(plan, [], validation);

    assert.strictEqual(trace.coverageStatus, 'pass');
    assert.strictEqual(trace.consultedDocs.length, 0);
    assert.strictEqual(trace.requiredMissing.length, 0);
  });

  it('should map consulted doc IDs to plan entries for title and sourceUrl', () => {
    const plan = makePlan();
    const validation = makeValidation();
    const trace = buildConsultationTrace(plan, ['sql-injection-prevention', 'input-validation'], validation);

    assert.strictEqual(trace.consultedDocs.length, 2);
    assert.strictEqual(trace.consultedDocs[0].id, 'sql-injection-prevention');
    assert.strictEqual(trace.consultedDocs[1].id, 'input-validation');
  });

  // --- Gap-fill scenarios ---

  it('should fall back to docId as title when plan entry lookup misses', () => {
    const plan = makePlan();
    const validation = makeValidation();
    // Consult a doc ID not present in plan entries
    const trace = buildConsultationTrace(plan, ['unknown-doc-x'], validation);

    assert.strictEqual(trace.consultedDocs.length, 1);
    assert.strictEqual(trace.consultedDocs[0].id, 'unknown-doc-x');
    assert.strictEqual(trace.consultedDocs[0].title, 'unknown-doc-x');
    assert.strictEqual(trace.consultedDocs[0].sourceUrl, 'security://owasp/unknown-doc-x');
  });

  it('should count followup docs consulted from plan entries', () => {
    const plan = makePlan({
      followup: [{ docId: 'logging-cheatsheet', docUri: 'security://owasp/cheatsheet/logging-cheatsheet', reason: 'follow-up', signalType: 'related', score: 0.5, orderIndex: 2 }],
    });
    const validation = makeValidation({
      consulted: ['sql-injection-prevention', 'logging-cheatsheet'],
      stats: { requiredTotal: 1, requiredConsulted: 1, optionalTotal: 1, optionalConsulted: 0 },
    });
    const trace = buildConsultationTrace(plan, ['sql-injection-prevention', 'logging-cheatsheet'], validation);

    assert.strictEqual(trace.consultedDocs.length, 2);
    assert.strictEqual(trace.plan.followupCount, 1);
  });

  it('should propagate notes from validation to trace', () => {
    const plan = makePlan();
    const validation = makeValidation({
      notes: ['Optional doc skipped', 'Budget exceeded'],
    });
    const trace = buildConsultationTrace(plan, ['sql-injection-prevention'], validation);

    assert.strictEqual(trace.notes.length, 2);
    assert.ok(trace.notes.includes('Optional doc skipped'));
    assert.ok(trace.notes.includes('Budget exceeded'));
  });

  it('should handle large plan with 20+ required entries all consulted', () => {
    const docs = Array.from({ length: 25 }, (_, i) => ({
      docId: `doc-${i}`,
      docUri: `security://owasp/cheatsheet/doc-${i}`,
      reason: 'test',
      signalType: 'workflow-binding',
      score: 1.0,
      orderIndex: i,
    }));
    const plan = makePlan({ required: docs, optional: [] });
    const validation = makeValidation({
      consulted: docs.map(d => d.docId),
      requiredMissing: [],
      stats: { requiredTotal: 25, requiredConsulted: 25, optionalTotal: 0, optionalConsulted: 0 },
    });
    const trace = buildConsultationTrace(plan, docs.map(d => d.docId), validation);

    assert.strictEqual(trace.consultedDocs.length, 25);
    assert.strictEqual(trace.plan.requiredCount, 25);
    assert.strictEqual(trace.coverageStatus, 'pass');
    assert.strictEqual(trace.requiredMissing.length, 0);
  });

});

// ---------------------------------------------------------------------------
// buildNotApplicableEnvelope
// ---------------------------------------------------------------------------
describe('buildNotApplicableEnvelope()', () => {

  it('should produce correct envelope shape', () => {
    const envelope = buildNotApplicableEnvelope('report', '0.1.0', '2026-03-31');

    assert.strictEqual(envelope.schemaVersion, 1);
    assert.strictEqual(envelope.workflowId, 'report');
    assert.strictEqual(envelope.gssVersion, '0.1.0');
    assert.strictEqual(envelope.corpusVersion, '2026-03-31');
    assert.strictEqual(envelope.consultationMode, 'not-applicable');
    assert.ok(envelope.generatedAt);
    assert.ok(!('consultation' in envelope));
  });

  it('should produce ISO 8601 generatedAt', () => {
    const envelope = buildNotApplicableEnvelope('report', '0.1.0', '2026-03-31');
    assert.ok(/\d{4}-\d{2}-\d{2}T/.test(envelope.generatedAt), 'generatedAt should be ISO 8601');
  });

});
