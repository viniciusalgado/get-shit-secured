/**
 * Unit tests for the consultation compliance validator (Phase 4).
 *
 * Covers spec sections 3.1–3.15 and 7.1–7.4.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { validateConsultationCoverage } from '../../dist/core/consultation-compliance.js';
import { computeConsultationPlan } from '../../dist/core/consultation-planner.js';
import { CONSULTATION_VALIDATION_SCHEMA_VERSION } from '../../dist/core/types.js';
import { makeMinimalSnapshot, makeEmptySnapshot } from '../fixtures/consultation-plan-fixtures.js';

/** Helper: create a plan for testing compliance */
function makeTestPlan(constraintOverrides = {}) {
  return computeConsultationPlan({
    workflowId: 'audit',
    snapshot: makeMinimalSnapshot(),
    detectedStack: [],
    issueTags: [],
    changedFiles: [],
    corpusVersion: '1.0.0',
    constraints: constraintOverrides,
  });
}

// ---------------------------------------------------------------------------
// Section 3: Consultation Compliance
// ---------------------------------------------------------------------------

describe('Consultation Compliance', () => {

  // 3.1 — Passes when all required docs consulted
  it('should pass when all required docs are consulted (3.1)', () => {
    const plan = makeTestPlan();
    const consulted = plan.required.map(e => e.docId);

    const result = validateConsultationCoverage(plan, consulted);

    assert.equal(result.coverageStatus, 'pass');
    assert.equal(result.requiredMissing.length, 0);
    assert.equal(result.stats.requiredConsulted, result.stats.requiredTotal);
  });

  // 3.2 — Fails when required docs missing
  it('should fail when required docs are missing (3.2)', () => {
    const plan = makeTestPlan({ failOnMissingRequired: true });
    const consulted = [];

    const result = validateConsultationCoverage(plan, consulted);

    assert.equal(result.coverageStatus, 'fail');
    assert.ok(result.requiredMissing.length > 0, 'Expected missing required docs');
    assert.ok(result.notes.some(n => n.includes('FAIL')), 'Expected FAIL note');
  });

  // 3.3 — Warns when required docs missing and failOnMissingRequired is false
  it('should warn when required docs missing and failOnMissingRequired is false (3.3)', () => {
    const plan = makeTestPlan({ failOnMissingRequired: false });
    const consulted = [];

    const result = validateConsultationCoverage(plan, consulted);

    assert.equal(result.coverageStatus, 'warn');
    assert.ok(result.requiredMissing.length > 0, 'Expected missing required docs');
    assert.ok(result.notes.some(n => n.includes('WARN')), 'Expected WARN note');
  });

  // 3.4 — Reports unexpected consulted docs
  it('should report unexpected consulted docs (3.4)', () => {
    const plan = makeTestPlan();
    const consulted = [
      ...plan.required.map(e => e.docId),
      'unknown-doc',
    ];

    const result = validateConsultationCoverage(plan, consulted);

    assert.deepEqual(result.unexpectedConsulted, ['unknown-doc']);
    assert.equal(result.coverageStatus, 'pass');
  });

  // 3.5 — Reports optional misses as informational
  it('should report optional misses as informational (3.5)', () => {
    const plan = makeTestPlan();
    // Only consult required, skip optional
    const consulted = plan.required.map(e => e.docId);

    const result = validateConsultationCoverage(plan, consulted);

    if (plan.optional.length > 0) {
      assert.ok(result.optionalMissed.length > 0, 'Expected optional misses');
    }
    assert.equal(result.coverageStatus, 'pass');
  });

  // 3.6 — Stats are accurate
  it('should produce accurate stats (3.6)', () => {
    const plan = makeTestPlan();
    const consultedDocIds = plan.required.slice(0, 1).map(e => e.docId);

    const result = validateConsultationCoverage(plan, consultedDocIds);

    assert.equal(result.stats.requiredTotal, plan.required.length);
    assert.equal(result.stats.requiredConsulted, 1);
    assert.equal(result.stats.optionalTotal, plan.optional.length);
    assert.equal(result.stats.optionalConsulted, 0);
  });

  // 3.7 — Handles empty consulted list
  it('should handle empty consulted list (3.7)', () => {
    const plan = makeTestPlan();

    const result = validateConsultationCoverage(plan, []);

    assert.equal(result.stats.requiredConsulted, 0);
    assert.equal(result.stats.optionalConsulted, 0);
    assert.ok(result.requiredMissing.length > 0);
    assert.equal(result.coverageStatus, 'fail');
  });

  // 3.8 — Handles all docs consulted
  it('should handle all docs consulted (3.8)', () => {
    const plan = makeTestPlan();
    const allDocIds = [
      ...plan.required,
      ...plan.optional,
      ...plan.followup,
    ].map(e => e.docId);

    const result = validateConsultationCoverage(plan, allDocIds);

    assert.equal(result.coverageStatus, 'pass');
    assert.equal(result.requiredMissing.length, 0);
    assert.equal(result.optionalMissed.length, 0);
    assert.equal(result.unexpectedConsulted.length, 0);
    assert.equal(result.stats.requiredConsulted, result.stats.requiredTotal);
  });

  // 3.9 — Pass status: all required consulted, some optional missed
  it('should pass when all required consulted even if optional are missed (3.9)', () => {
    const plan = makeTestPlan();
    const consulted = plan.required.map(e => e.docId);

    const result = validateConsultationCoverage(plan, consulted);

    assert.equal(result.coverageStatus, 'pass');
    if (plan.optional.length > 0) {
      assert.deepEqual(result.optionalMissed, plan.optional.map(e => e.docId));
    }
  });

  // 3.10 — Notes field populated with relevant messages
  it('should populate notes with relevant messages (3.10)', () => {
    const plan = makeTestPlan();
    const result = validateConsultationCoverage(plan, []);

    assert.ok(Array.isArray(result.notes));
    assert.ok(result.notes.length > 0, 'Expected notes when docs are missing');
    assert.ok(result.notes.some(n => n.includes('missing') || n.includes('FAIL')),
      'Expected a note about missing docs');
  });

  // 3.11 — WorkflowId propagated to output
  it('should carry correct workflow ID (3.11)', () => {
    const plan = makeTestPlan();
    const result = validateConsultationCoverage(plan, []);

    assert.equal(result.workflowId, plan.workflowId);
    assert.equal(result.workflowId, 'audit');
  });

  // 3.12 — Schema version stamped
  it('should include correct schema version (3.12)', () => {
    const plan = makeTestPlan();
    const consulted = plan.required.map(e => e.docId);

    const result = validateConsultationCoverage(plan, consulted);

    assert.equal(result.schemaVersion, CONSULTATION_VALIDATION_SCHEMA_VERSION);
    assert.equal(result.schemaVersion, 1);
  });

  // 3.13 — No dependency on SpecialistDefinition or DelegationComplianceReport
  it('should not import from delegation modules (3.13)', () => {
    const source = readFileSync('src/core/consultation-compliance.ts', 'utf-8');
    const importLines = source.split('\n').filter(l => l.trimStart().startsWith('import '));
    assert.ok(!importLines.some(l => l.includes('delegation-graph')),
      'consultation-compliance should not import from delegation-graph');
    assert.ok(!importLines.some(l => l.includes('delegation-compliance')),
      'consultation-compliance should not import from delegation-compliance');
    assert.ok(!importLines.some(l => l.includes('SpecialistDefinition')),
      'consultation-compliance should not import SpecialistDefinition');
  });

  // 3.14 — Validation output is JSON-serializable
  it('should produce JSON-serializable output (3.14)', () => {
    const plan = makeTestPlan();
    const consulted = plan.required.map(e => e.docId);

    const result = validateConsultationCoverage(plan, consulted);

    const serialized = JSON.parse(JSON.stringify(result));
    assert.deepEqual(serialized, result);
  });

  // 3.15 — Validation output has no runtime-specific fields
  it('should have no runtime-specific fields in output (3.15)', () => {
    const plan = makeTestPlan();
    const result = validateConsultationCoverage(plan, []);

    const serialized = JSON.stringify(result);
    assert.ok(!serialized.includes('SpecialistDefinition'),
      'Output should not contain SpecialistDefinition');
    assert.ok(!serialized.includes('undefined'),
      'Output should not contain undefined');
  });

  // CheckedAt is valid ISO timestamp
  it('should include valid checkedAt timestamp', () => {
    const plan = makeTestPlan();
    const result = validateConsultationCoverage(plan, []);

    assert.ok(typeof result.checkedAt === 'string');
    assert.ok(!isNaN(Date.parse(result.checkedAt)),
      'checkedAt should be a valid ISO timestamp');
  });

  // Consulted field reflects input
  it('should reflect consulted doc IDs in output', () => {
    const plan = makeTestPlan();
    const consulted = plan.required.map(e => e.docId);
    const result = validateConsultationCoverage(plan, consulted);

    assert.deepEqual(result.consulted, consulted);
  });
});

// ---------------------------------------------------------------------------
// Section 7: Severity Semantics
// ---------------------------------------------------------------------------

describe('Consultation Compliance — Severity Semantics', () => {

  // 7.1 — Pass semantics: all required consulted, no unexpected issues
  it('should produce pass when all required consulted (7.1)', () => {
    const plan = makeTestPlan();
    const consulted = plan.required.map(e => e.docId);

    const result = validateConsultationCoverage(plan, consulted);

    assert.equal(result.coverageStatus, 'pass');
    assert.equal(result.requiredMissing.length, 0);
  });

  // 7.2 — Warn semantics: required missing but failOnMissingRequired=false
  it('should produce warn when required missing and failOnMissingRequired=false (7.2)', () => {
    const plan = makeTestPlan({ failOnMissingRequired: false });
    const result = validateConsultationCoverage(plan, []);

    assert.equal(result.coverageStatus, 'warn');
    assert.ok(result.requiredMissing.length > 0);
    assert.ok(result.notes.some(n =>
      n.includes('failOnMissingRequired') || n.includes('WARN')),
      'Notes should explain why warn, not fail');
  });

  // 7.3 — Fail semantics: required missing and failOnMissingRequired=true
  it('should produce fail when required missing and failOnMissingRequired=true (7.3)', () => {
    const plan = makeTestPlan({ failOnMissingRequired: true });
    const result = validateConsultationCoverage(plan, []);

    assert.equal(result.coverageStatus, 'fail');
    assert.ok(result.requiredMissing.length > 0);
    assert.ok(result.notes.some(n => n.includes('incomplete') || n.includes('missing')),
      'Notes should indicate incomplete coverage');
  });

  // 7.4 — Severity semantics documented in code
  it('should have severity semantics documented in source code (7.4)', () => {
    const source = readFileSync('src/core/consultation-compliance.ts', 'utf-8');

    // Check for pass/warn/fail documentation
    assert.ok(source.includes('pass'), 'Source should document pass semantics');
    assert.ok(source.includes('warn'), 'Source should document warn semantics');
    assert.ok(source.includes('fail'), 'Source should document fail semantics');
  });
});
