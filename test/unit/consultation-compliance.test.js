/**
 * Unit tests for the consultation compliance validator (Phase 4).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { validateConsultationCoverage } from '../../dist/core/consultation-compliance.js';
import { computeConsultationPlan } from '../../dist/core/consultation-planner.js';
import { makeMinimalSnapshot } from '../fixtures/consultation-plan-fixtures.js';

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

describe('Consultation Compliance', () => {
  // 1. Passes when all required docs consulted
  it('should pass when all required docs are consulted', () => {
    const plan = makeTestPlan();
    const consulted = plan.required.map(e => e.docId);

    const result = validateConsultationCoverage(plan, consulted);

    assert.equal(result.coverageStatus, 'pass');
    assert.equal(result.requiredMissing.length, 0);
    assert.equal(result.stats.requiredConsulted, result.stats.requiredTotal);
  });

  // 2. Fails when required docs missing
  it('should fail when required docs are missing', () => {
    const plan = makeTestPlan();
    const consulted = []; // Nothing consulted

    const result = validateConsultationCoverage(plan, consulted);

    assert.equal(result.coverageStatus, 'fail');
    assert.ok(result.requiredMissing.length > 0,
      'Expected missing required docs');
    assert.ok(result.notes.some(n => n.includes('FAIL')),
      'Expected FAIL note');
  });

  // 3. Warns when required docs missing and failOnMissingRequired=false
  it('should warn when required docs missing and failOnMissingRequired is false', () => {
    const plan = makeTestPlan({ failOnMissingRequired: false });
    const consulted = [];

    const result = validateConsultationCoverage(plan, consulted);

    assert.equal(result.coverageStatus, 'warn');
    assert.ok(result.notes.some(n => n.includes('WARN')),
      'Expected WARN note');
  });

  // 4. Reports unexpected consulted docs
  it('should report unexpected consulted docs', () => {
    const plan = makeTestPlan();
    const consulted = [
      ...plan.required.map(e => e.docId),
      'totally-unrelated-doc',
    ];

    const result = validateConsultationCoverage(plan, consulted);

    assert.ok(result.unexpectedConsulted.includes('totally-unrelated-doc'),
      'Expected unrelated doc in unexpectedConsulted');
    assert.equal(result.coverageStatus, 'pass');
  });

  // 5. Reports optional misses as informational
  it('should report optional misses as informational', () => {
    const plan = makeTestPlan();
    // Only consult required docs, skip optional
    const consulted = plan.required.map(e => e.docId);

    const result = validateConsultationCoverage(plan, consulted);

    if (plan.optional.length > 0) {
      assert.ok(result.optionalMissed.length > 0,
        'Expected optional misses');
    }
    assert.equal(result.coverageStatus, 'pass');
  });

  // 6. Stats are accurate
  it('should produce accurate stats', () => {
    const plan = makeTestPlan();
    const consultedDocIds = plan.required.slice(0, 1).map(e => e.docId);

    const result = validateConsultationCoverage(plan, consultedDocIds);

    assert.equal(result.stats.requiredTotal, plan.required.length);
    assert.equal(result.stats.requiredConsulted, 1);
    assert.equal(result.stats.optionalTotal, plan.optional.length);
    assert.equal(result.consulted.length, consultedDocIds.length);
  });

  // 7. Handles empty consulted list
  it('should handle empty consulted list', () => {
    const plan = makeTestPlan();

    const result = validateConsultationCoverage(plan, []);

    assert.equal(result.stats.requiredConsulted, 0);
    assert.equal(result.stats.optionalConsulted, 0);
    assert.ok(result.requiredMissing.length > 0);
    assert.equal(result.coverageStatus, 'fail');
  });

  // 8. Handles all docs consulted
  it('should handle all docs consulted (required + optional)', () => {
    const plan = makeTestPlan();
    const allDocIds = [
      ...plan.required,
      ...plan.optional,
      ...plan.followup,
    ].map(e => e.docId);

    const result = validateConsultationCoverage(plan, allDocIds);

    assert.equal(result.coverageStatus, 'pass');
    assert.equal(result.requiredMissing.length, 0);
    assert.equal(result.stats.requiredConsulted, result.stats.requiredTotal);
  });

  // Schema version
  it('should include correct schema version', () => {
    const plan = makeTestPlan();
    const consulted = plan.required.map(e => e.docId);

    const result = validateConsultationCoverage(plan, consulted);

    assert.equal(result.schemaVersion, 1);
  });

  // Workflow ID matches
  it('should carry correct workflow ID', () => {
    const plan = makeTestPlan();
    const result = validateConsultationCoverage(plan, []);

    assert.equal(result.workflowId, 'audit');
  });

  // CheckedAt is valid ISO timestamp
  it('should include valid checkedAt timestamp', () => {
    const plan = makeTestPlan();
    const result = validateConsultationCoverage(plan, []);

    assert.ok(typeof result.checkedAt === 'string');
    assert.ok(!isNaN(Date.parse(result.checkedAt)),
      'checkedAt should be a valid ISO timestamp');
  });
});
