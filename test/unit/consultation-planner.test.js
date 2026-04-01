/**
 * Unit tests for the consultation planner engine (Phase 4).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { computeConsultationPlan } from '../../dist/core/consultation-planner.js';
import { makeMinimalSnapshot, makeEmptySnapshot } from '../fixtures/consultation-plan-fixtures.js';

/** Helper: create plan input with defaults */
function makePlanInput(overrides = {}) {
  return {
    workflowId: 'audit',
    snapshot: makeMinimalSnapshot(),
    detectedStack: [],
    issueTags: [],
    changedFiles: [],
    corpusVersion: '1.0.0',
    ...overrides,
  };
}

describe('Consultation Planner', () => {
  // 1. Produces valid plan from minimal snapshot
  it('should produce a valid consultation plan from a minimal snapshot', () => {
    const plan = computeConsultationPlan(makePlanInput());

    assert.equal(plan.schemaVersion, 1);
    assert.equal(plan.workflowId, 'audit');
    assert.equal(typeof plan.generatedAt, 'string');
    assert.ok(plan.generatedAt.length > 0);
    assert.equal(plan.corpusVersion, '1.0.0');
    assert.ok(Array.isArray(plan.required));
    assert.ok(Array.isArray(plan.optional));
    assert.ok(Array.isArray(plan.followup));
    assert.ok(plan.signals);
    assert.ok(plan.constraints);
  });

  // 2. Seeds required docs from workflow bindings with priority 'required'
  it('should seed required docs from workflow bindings with priority required', () => {
    const plan = computeConsultationPlan(makePlanInput());

    const requiredIds = plan.required.map(e => e.docId);
    // sql-injection-prevention and cross-site-scripting-prevention have required binding for audit
    assert.ok(requiredIds.includes('sql-injection-prevention'),
      'Expected sql-injection-prevention in required');
    assert.ok(requiredIds.includes('cross-site-scripting-prevention'),
      'Expected cross-site-scripting-prevention in required');
  });

  // 3. Seeds optional docs from workflow bindings with priority 'optional'
  it('should seed optional docs from workflow bindings with priority optional', () => {
    const plan = computeConsultationPlan(makePlanInput());

    const optionalIds = plan.optional.map(e => e.docId);
    // authentication-cheatsheet, django-security, password-storage, logging-cheatsheet have optional binding for audit
    assert.ok(optionalIds.includes('authentication-cheatsheet'),
      'Expected authentication-cheatsheet in optional');
    assert.ok(optionalIds.includes('logging-cheatsheet'),
      'Expected logging-cheatsheet in optional');
  });

  // 4. Expands docs from matching stack bindings
  it('should expand docs from matching stack bindings', () => {
    const plan = computeConsultationPlan(makePlanInput({
      detectedStack: ['django'],
    }));

    const allDocIds = [
      ...plan.required.map(e => e.docId),
      ...plan.optional.map(e => e.docId),
      ...plan.followup.map(e => e.docId),
    ];

    assert.ok(allDocIds.includes('django-security'),
      'Expected django-security to be included via stack binding');
  });

  // 5. Expands docs from matching issue types
  it('should expand docs from matching issue types', () => {
    const plan = computeConsultationPlan(makePlanInput({
      issueTags: ['password-storage'],
    }));

    const allDocIds = [
      ...plan.required.map(e => e.docId),
      ...plan.optional.map(e => e.docId),
      ...plan.followup.map(e => e.docId),
    ];

    // password-storage doc has issueType 'password-storage'
    assert.ok(allDocIds.includes('password-storage'),
      'Expected password-storage to be included via issue tag match');
  });

  // 6. Expands follow-up docs via relatedDocIds
  it('should expand follow-up docs via relatedDocIds', () => {
    const plan = computeConsultationPlan(makePlanInput());

    // sql-injection-prevention is required for audit, and has relatedDocIds: ['query-parameterization', 'input-validation']
    // Those should appear as followup
    const followupIds = plan.followup.map(e => e.docId);
    assert.ok(followupIds.includes('query-parameterization'),
      'Expected query-parameterization as follow-up from sql-injection-prevention');
    assert.ok(followupIds.includes('input-validation'),
      'Expected input-validation as follow-up from sql-injection-prevention');
  });

  // 7. Applies constraints (maxRequired, maxOptional, maxFollowup caps)
  it('should apply constraints caps', () => {
    const plan = computeConsultationPlan(makePlanInput({
      constraints: { maxRequired: 1, maxOptional: 1, maxFollowup: 0 },
    }));

    assert.ok(plan.required.length <= 1,
      `Expected max 1 required, got ${plan.required.length}`);
    assert.ok(plan.optional.length <= 1,
      `Expected max 1 optional, got ${plan.optional.length}`);
    assert.equal(plan.followup.length, 0,
      'Expected 0 follow-ups when maxFollowup=0');
  });

  // 8. Deterministic ordering (same inputs → same output)
  it('should produce deterministic ordering for same inputs', () => {
    const input = makePlanInput({
      detectedStack: ['django'],
      issueTags: ['sql-injection', 'xss'],
    });

    const plan1 = computeConsultationPlan(input);
    const plan2 = computeConsultationPlan(input);

    const ids1 = [
      ...plan1.required,
      ...plan1.optional,
      ...plan1.followup,
    ].map(e => e.docId);

    const ids2 = [
      ...plan2.required,
      ...plan2.optional,
      ...plan2.followup,
    ].map(e => e.docId);

    assert.deepEqual(ids1, ids2, 'Same inputs should produce same doc ordering');
  });

  // 9. Handles empty snapshot gracefully (degraded mode)
  it('should handle empty snapshot gracefully', () => {
    const plan = computeConsultationPlan(makePlanInput({
      snapshot: makeEmptySnapshot(),
    }));

    assert.equal(plan.required.length, 0, 'Empty snapshot should produce empty required');
    assert.equal(plan.optional.length, 0, 'Empty snapshot should produce empty optional');
    assert.equal(plan.followup.length, 0, 'Empty snapshot should produce empty followup');
  });

  // 10. Stamps corpus version on output
  it('should stamp corpus version on output', () => {
    const plan = computeConsultationPlan(makePlanInput({
      corpusVersion: '2.3.1',
    }));

    assert.equal(plan.corpusVersion, '2.3.1');
  });

  // Fallback: required is empty without issue tags but workflow has required bindings
  it('should not need fallback when workflow has required bindings', () => {
    const plan = computeConsultationPlan(makePlanInput({
      issueTags: [],
      detectedStack: [],
    }));

    // audit has required bindings (sql-injection, xss) so fallback shouldn't trigger
    assert.ok(plan.required.length >= 2,
      'Audit workflow should have required docs from workflow bindings');
  });

  // Missing stack signal → plan still valid
  it('should produce valid plan when stack signal is missing', () => {
    const plan = computeConsultationPlan(makePlanInput({
      detectedStack: [],
    }));

    assert.ok(plan.required.length > 0, 'Should have required docs from workflow bindings');
  });

  // Constraint: allowFollowUpExpansion=false disables follow-ups
  it('should skip follow-up expansion when allowFollowUpExpansion is false', () => {
    const plan = computeConsultationPlan(makePlanInput({
      constraints: { allowFollowUpExpansion: false },
    }));

    assert.equal(plan.followup.length, 0,
      'Follow-ups should be empty when expansion disabled');
  });

  // Verify workflow produces correct bindings
  it('should produce correct plan for security-review workflow', () => {
    const plan = computeConsultationPlan(makePlanInput({
      workflowId: 'security-review',
    }));

    const requiredIds = plan.required.map(e => e.docId);
    assert.ok(requiredIds.includes('sql-injection-prevention'),
      'sql-injection-prevention should be required for security-review');
  });

  // Signal type tracking
  it('should record correct signal types on entries', () => {
    const plan = computeConsultationPlan(makePlanInput({
      detectedStack: ['django'],
      issueTags: ['password-storage'],
    }));

    const allEntries = [...plan.required, ...plan.optional, ...plan.followup];
    const signalTypes = new Set(allEntries.map(e => e.signalType));

    assert.ok(signalTypes.has('workflow-binding'),
      'Expected workflow-binding signal type');
  });

  // Order indices are stable and sequential
  it('should assign sequential order indices', () => {
    const plan = computeConsultationPlan(makePlanInput());

    const allEntries = [...plan.required, ...plan.optional, ...plan.followup];
    for (let i = 0; i < allEntries.length; i++) {
      assert.equal(allEntries[i].orderIndex, i,
        `Expected orderIndex ${i}, got ${allEntries[i].orderIndex}`);
    }
  });
});
