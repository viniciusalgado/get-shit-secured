/**
 * Integration & cross-cutting tests for Phase 4 (Consultation Runtime Engine).
 *
 * Covers spec section 6.1–6.8.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { computeConsultationPlan } from '../../dist/core/consultation-planner.js';
import { validateConsultationCoverage } from '../../dist/core/consultation-compliance.js';
import {
  extractAuditSignals,
  extractSecurityReviewSignals,
  extractVerifySignals,
  extractDefaultSignals,
  extractThreatModelSignals,
  extractPlanRemediationSignals,
  extractExecuteRemediationSignals,
  extractValidateFindingsSignals,
} from '../../dist/core/consultation-signals.js';
import {
  makeMinimalSnapshot,
  makeEmptySnapshot,
} from '../fixtures/consultation-plan-fixtures.js';

describe('Phase 4 Integration Tests', () => {

  // 6.1 — Planner + Compliance end-to-end: audit workflow
  it('should pass end-to-end for audit workflow (6.1)', () => {
    const snapshot = makeMinimalSnapshot();
    const plan = computeConsultationPlan({
      workflowId: 'audit',
      snapshot,
      detectedStack: ['django'],
      issueTags: ['sql-injection', 'xss'],
      changedFiles: [],
      corpusVersion: '1.0.0',
    });

    // Simulate consulting all required + some optional
    const consulted = plan.required
      .map(e => e.docId)
      .concat(plan.optional.slice(0, 2).map(e => e.docId));

    const validation = validateConsultationCoverage(plan, consulted);

    assert.equal(validation.coverageStatus, 'pass');
    assert.equal(validation.requiredMissing.length, 0);
  });

  // 6.2 — Planner + Compliance end-to-end: verify workflow
  it('should produce valid coverage for verify workflow (6.2)', () => {
    const snapshot = makeMinimalSnapshot();
    const patchPlan = {
      issueTags: ['sql-injection'],
      stacks: ['django'],
    };
    const appReport = { patchedFiles: [] };

    const signals = extractVerifySignals(patchPlan, appReport);
    const plan = computeConsultationPlan({
      workflowId: 'verify',
      snapshot,
      detectedStack: signals.stacks,
      issueTags: signals.issueTags,
      changedFiles: signals.changedFiles,
      corpusVersion: '1.0.0',
    });

    const consulted = plan.required.map(e => e.docId);
    const validation = validateConsultationCoverage(plan, consulted);

    assert.ok(['pass', 'warn', 'fail'].includes(validation.coverageStatus),
      `Expected valid status, got ${validation.coverageStatus}`);
  });

  // 6.3 — Planner + Compliance: degraded path with empty snapshot
  it('should handle degraded path with empty snapshot (6.3)', () => {
    const emptySnapshot = makeEmptySnapshot();
    const plan = computeConsultationPlan({
      workflowId: 'audit',
      snapshot: emptySnapshot,
      detectedStack: [],
      issueTags: [],
      changedFiles: [],
      corpusVersion: '1.0.0',
    });

    const validation = validateConsultationCoverage(plan, []);

    assert.ok(['pass', 'warn', 'fail'].includes(validation.coverageStatus));
    // No crash is the primary assertion
  });

  // 6.4 — Old modules untouched
  it('should still have old delegation modules available (6.4)', async () => {
    // Verify old modules still exist and are importable
    const { computeDelegationPlan } = await import('../../dist/core/delegation-planner.js');
    const { validateCompliance } = await import('../../dist/core/delegation-compliance.js');

    assert.ok(typeof computeDelegationPlan === 'function',
      'computeDelegationPlan should still be a function');
    assert.ok(typeof validateCompliance === 'function',
      'validateCompliance should still be a function');
  });

  // 6.5 — Plan output is JSON-serializable
  it('should produce JSON-serializable plan output (6.5)', () => {
    const snapshot = makeMinimalSnapshot();
    const plan = computeConsultationPlan({
      workflowId: 'audit',
      snapshot,
      detectedStack: ['django'],
      issueTags: ['sql-injection'],
      changedFiles: [],
      corpusVersion: '1.0.0',
    });

    const serialized = JSON.parse(JSON.stringify(plan));
    assert.deepEqual(serialized, plan);
  });

  // 6.6 — Plan output has no runtime-specific fields
  it('should have no runtime-specific fields in plan output (6.6)', () => {
    const snapshot = makeMinimalSnapshot();
    const plan = computeConsultationPlan({
      workflowId: 'audit',
      snapshot,
      detectedStack: ['django'],
      issueTags: ['sql-injection'],
      changedFiles: [],
      corpusVersion: '1.0.0',
    });

    const serialized = JSON.stringify(plan);
    assert.ok(!serialized.includes('undefined'),
      'Plan should not contain undefined');
    assert.ok(!serialized.includes('function'),
      'Plan should not contain function references');
  });

  // 6.7 — ConsultationValidation is embeddable in artifact JSON
  it('should produce validation output that is artifact-ready (6.7)', () => {
    const snapshot = makeMinimalSnapshot();
    const plan = computeConsultationPlan({
      workflowId: 'audit',
      snapshot,
      detectedStack: ['django'],
      issueTags: ['sql-injection'],
      changedFiles: [],
      corpusVersion: '1.0.0',
    });

    const consulted = plan.required.map(e => e.docId);
    const validation = validateConsultationCoverage(plan, consulted);

    // Round-trip through JSON
    const artifact = JSON.stringify(validation, null, 2);
    const reparsed = JSON.parse(artifact);
    assert.deepEqual(reparsed, validation);
  });

  // 6.8 — Consultation plan is importable for Phase 5 consumption
  it('should export clean interfaces for Phase 5 consumption (6.8)', () => {
    assert.ok(typeof computeConsultationPlan === 'function',
      'computeConsultationPlan should be a function');
    assert.ok(typeof validateConsultationCoverage === 'function',
      'validateConsultationCoverage should be a function');
    assert.ok(typeof extractAuditSignals === 'function',
      'extractAuditSignals should be a function');
    assert.ok(typeof extractSecurityReviewSignals === 'function',
      'extractSecurityReviewSignals should be a function');
    assert.ok(typeof extractVerifySignals === 'function',
      'extractVerifySignals should be a function');
    assert.ok(typeof extractThreatModelSignals === 'function',
      'extractThreatModelSignals should be a function');
    assert.ok(typeof extractDefaultSignals === 'function',
      'extractDefaultSignals should be a function');
    assert.ok(typeof extractPlanRemediationSignals === 'function',
      'extractPlanRemediationSignals should be a function');
    assert.ok(typeof extractExecuteRemediationSignals === 'function',
      'extractExecuteRemediationSignals should be a function');
    assert.ok(typeof extractValidateFindingsSignals === 'function',
      'extractValidateFindingsSignals should be a function');
  });
});
