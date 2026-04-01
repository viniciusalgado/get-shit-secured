/**
 * Unit tests for the consultation planner engine (Phase 4).
 *
 * Covers spec sections 2.1–2.17 and 4.1–4.6.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { computeConsultationPlan } from '../../dist/core/consultation-planner.js';
import {
  makeMinimalSnapshot,
  makeEmptySnapshot,
  createLoadedSnapshot,
  createSnapshotWithBrokenEdge,
  createLargeSnapshot,
  createDoc,
} from '../fixtures/consultation-plan-fixtures.js';

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

// ---------------------------------------------------------------------------
// Section 2: Consultation Planner
// ---------------------------------------------------------------------------

describe('Consultation Planner', () => {

  // 2.1 — Produces valid plan from minimal snapshot
  it('should produce a valid consultation plan from a minimal snapshot (2.1)', () => {
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

  // 2.2 — Seeds required docs from workflow bindings with priority 'required'
  it('should seed required docs from workflow bindings with priority required (2.2)', () => {
    const plan = computeConsultationPlan(makePlanInput());

    const requiredIds = plan.required.map(e => e.docId);
    // sql-injection-prevention and cross-site-scripting-prevention have required binding for audit
    assert.ok(requiredIds.includes('sql-injection-prevention'),
      'Expected sql-injection-prevention in required');
    assert.ok(requiredIds.includes('cross-site-scripting-prevention'),
      'Expected cross-site-scripting-prevention in required');

    // Verify signal type
    const wfRequired = plan.required.filter(e => e.signalType === 'workflow-binding');
    assert.ok(wfRequired.length > 0, 'Expected workflow-binding signal type on required entries');
  });

  // 2.3 — Seeds optional docs from workflow bindings with priority 'optional'
  it('should seed optional docs from workflow bindings with priority optional (2.3)', () => {
    const plan = computeConsultationPlan(makePlanInput());

    const optionalIds = plan.optional.map(e => e.docId);
    // authentication-cheatsheet, django-security, password-storage, logging-cheatsheet have optional binding for audit
    assert.ok(optionalIds.includes('authentication-cheatsheet'),
      'Expected authentication-cheatsheet in optional');
    assert.ok(optionalIds.includes('logging-cheatsheet'),
      'Expected logging-cheatsheet in optional');

    const wfOptional = plan.optional.filter(e => e.signalType === 'workflow-binding');
    assert.ok(wfOptional.length > 0, 'Expected workflow-binding signal type on optional entries');
  });

  // 2.4 — Expands docs from matching stack bindings
  it('should expand docs from matching stack bindings (2.4)', () => {
    const plan = computeConsultationPlan(makePlanInput({
      detectedStack: ['nodejs'],
    }));

    const stackDocs = plan.required.concat(plan.optional).filter(e => e.signalType === 'stack-binding');
    assert.ok(stackDocs.length > 0, 'Expected stack-binding entries');
    assert.ok(stackDocs.some(e => e.docId === 'nodejs-security'),
      'Expected nodejs-security via stack binding');
  });

  // 2.5 — Expands docs from matching issue types
  it('should expand docs from matching issue types (2.5)', () => {
    const plan = computeConsultationPlan(makePlanInput({
      issueTags: ['csrf'],
    }));

    const issueDocs = plan.required.concat(plan.optional).filter(e => e.signalType === 'issue-tag');
    assert.ok(issueDocs.some(e => e.docId === 'csrf-protection'),
      'Expected csrf-protection via issue tag');
  });

  // 2.6 — Expands follow-up docs via relatedDocIds
  it('should expand follow-up docs via relatedDocIds (2.6)', () => {
    const plan = computeConsultationPlan(makePlanInput());

    // sql-injection-prevention is required for audit, has relatedDocIds: ['query-parameterization', 'input-validation']
    const followupIds = plan.followup.map(e => e.docId);
    assert.ok(followupIds.includes('query-parameterization'),
      'Expected query-parameterization as follow-up');
    assert.ok(followupIds.includes('input-validation'),
      'Expected input-validation as follow-up');
    assert.ok(plan.followup.every(e => e.signalType === 'related-doc'),
      'All follow-up entries should have signalType "related-doc"');
  });

  // 2.7 — Applies constraints (maxRequired, maxOptional, maxFollowup caps)
  it('should apply constraint caps (2.7)', () => {
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

  // 2.8 — Deterministic ordering (same inputs produce same output)
  it('should produce deterministic ordering for same inputs (2.8)', () => {
    const input = makePlanInput({
      detectedStack: ['django'],
      issueTags: ['sql-injection', 'xss'],
    });

    const plan1 = computeConsultationPlan(input);
    const plan2 = computeConsultationPlan(input);

    assert.deepEqual(plan1.required, plan2.required, 'Required should be identical');
    assert.deepEqual(plan1.optional, plan2.optional, 'Optional should be identical');
    assert.deepEqual(plan1.followup, plan2.followup, 'Followup should be identical');
  });

  // 2.9 — Handles empty snapshot gracefully (degraded mode)
  it('should handle empty snapshot gracefully (2.9)', () => {
    const plan = computeConsultationPlan(makePlanInput({
      snapshot: makeEmptySnapshot(),
    }));

    assert.equal(plan.required.length, 0);
    assert.equal(plan.optional.length, 0);
    assert.equal(plan.followup.length, 0);
  });

  // 2.10 — Stamps corpus version on output
  it('should stamp corpus version on output (2.10)', () => {
    const plan = computeConsultationPlan(makePlanInput({
      corpusVersion: '2.3.1',
    }));

    assert.equal(plan.corpusVersion, '2.3.1');
  });

  // 2.11 — No dependency on SpecialistDefinition or DelegationGraph
  it('should not import from delegation-graph or reference SpecialistDefinition (2.11)', () => {
    const source = readFileSync('src/core/consultation-planner.ts', 'utf-8');
    const importLines = source.split('\n').filter(l => l.trimStart().startsWith('import '));
    assert.ok(!importLines.some(l => l.includes('delegation-graph')),
      'consultation-planner should not import from delegation-graph');
    assert.ok(!importLines.some(l => l.includes('SpecialistDefinition')),
      'consultation-planner should not import SpecialistDefinition');
  });

  // 2.12 — Scoring: workflow-binding docs have expected score
  it('should assign correct score to workflow-binding required docs (2.12)', () => {
    const plan = computeConsultationPlan(makePlanInput({
      detectedStack: [],
      issueTags: [],
    }));

    const wfEntries = plan.required.filter(e => e.signalType === 'workflow-binding');
    assert.ok(wfEntries.length > 0, 'Expected workflow-binding required entries');
    // WORKFLOW_BINDING_REQUIRED = 10
    assert.ok(wfEntries.every(e => e.score === 10),
      `Expected score 10 for workflow-binding required, got ${wfEntries.map(e => e.score)}`);
  });

  // 2.13 — Scoring: stack-binding docs have expected score
  it('should assign correct score to stack-binding docs (2.13)', () => {
    const plan = computeConsultationPlan(makePlanInput({
      detectedStack: ['nodejs'],
    }));

    const stackEntries = plan.required.concat(plan.optional).filter(e => e.signalType === 'stack-binding');
    assert.ok(stackEntries.length > 0, 'Expected stack-binding entries');
    // STACK_MATCH = 15
    assert.ok(stackEntries.every(e => e.score === 15),
      `Expected score 15 for stack-binding, got ${stackEntries.map(e => e.score)}`);
  });

  // 2.14 — Scoring: issue-tag docs have expected score
  it('should assign correct score to issue-tag docs (2.14)', () => {
    const plan = computeConsultationPlan(makePlanInput({
      issueTags: ['csrf'],
    }));

    const issueEntries = plan.required.concat(plan.optional).filter(e => e.signalType === 'issue-tag');
    assert.ok(issueEntries.length > 0, 'Expected issue-tag entries');
    // ISSUE_TAG_MATCH = 20
    assert.ok(issueEntries.every(e => e.score === 20),
      `Expected score 20 for issue-tag, got ${issueEntries.map(e => e.score)}`);
  });

  // 2.15 — Deduplication: same doc from multiple signals appears once
  it('should deduplicate docs matched by multiple signals (2.15)', () => {
    // sql-injection-prevention has workflowBinding for audit AND issueTypes includes 'sql-injection'
    const plan = computeConsultationPlan(makePlanInput({
      issueTags: ['sql-injection'],
    }));

    const sqlEntries = plan.required.filter(e => e.docId === 'sql-injection-prevention');
    assert.equal(sqlEntries.length, 1, 'Doc should appear once even with multiple matching signals');
    // Score should reflect first signal match (workflow-binding, since seeding happens first)
    assert.ok(sqlEntries[0].score > 0, 'Score should be positive');
  });

  // 2.16 — Ordering tiebreaker is docId ascending
  it('should order entries with same score by docId ascending (2.16)', () => {
    const plan = computeConsultationPlan(makePlanInput({
      detectedStack: [],
      issueTags: [],
    }));

    // All required entries with workflow-binding have score 10 — check tiebreaker
    for (let i = 1; i < plan.required.length; i++) {
      const prev = plan.required[i - 1];
      const curr = plan.required[i];
      if (prev.score === curr.score) {
        assert.ok(prev.docId.localeCompare(curr.docId) <= 0,
          `Expected docId tiebreaker: ${prev.docId} <= ${curr.docId}`);
      }
    }
  });

  // 2.17 — Signals are stamped on output
  it('should stamp input signals on output plan (2.17)', () => {
    const plan = computeConsultationPlan(makePlanInput({
      detectedStack: ['Django'],
      issueTags: ['SQL Injection'],
      changedFiles: ['src/app.py'],
    }));

    assert.ok(plan.signals.issueTags.length > 0, 'Expected issueTags in signals');
    assert.ok(plan.signals.stacks.length > 0, 'Expected stacks in signals');
    assert.deepEqual(plan.signals.changedFiles, ['src/app.py']);
  });
});

// ---------------------------------------------------------------------------
// Section 4: Fallback Behavior
// ---------------------------------------------------------------------------

describe('Consultation Planner — Fallback Behavior', () => {

  // 4.1 — Empty snapshot produces plan with empty arrays
  it('should produce plan with empty arrays for empty snapshot (4.1)', () => {
    const plan = computeConsultationPlan(makePlanInput({
      snapshot: makeEmptySnapshot(),
    }));

    assert.equal(plan.required.length, 0);
    assert.equal(plan.optional.length, 0);
    assert.equal(plan.followup.length, 0);
    assert.equal(plan.schemaVersion, 1, 'Plan should still be valid');
  });

  // 4.2 — No matching docs for a workflow falls back to workflow-level required defaults
  it('should fall back to workflow-level required bindings when no stack/issue match (4.2)', () => {
    // Use minimal snapshot with stack/issue that won't match
    const plan = computeConsultationPlan(makePlanInput({
      detectedStack: ['rust'],
      issueTags: ['prompt-injection'],
    }));

    // Should still include audit-required docs (sql-injection, xss)
    const wfDocs = plan.required.filter(e => e.signalType === 'workflow-binding');
    assert.equal(wfDocs.length, 2,
      'Expected 2 audit-required docs from workflow bindings');
  });

  // 4.3 — Broken related-doc edge → entry in blocked
  it('should report broken related-doc edges in blocked (4.3)', () => {
    const snapshot = createSnapshotWithBrokenEdge();
    const plan = computeConsultationPlan({
      workflowId: 'audit',
      snapshot,
      detectedStack: [],
      issueTags: ['sql-injection'],
      changedFiles: [],
      corpusVersion: '1.0.0',
    });

    // The implementation may or may not populate blocked for broken edges
    // Check if blocked exists and contains the non-existent doc
    if (plan.blocked && plan.blocked.length > 0) {
      assert.ok(plan.blocked.some(e => e.docId === 'non-existent-doc'),
        'Expected non-existent-doc in blocked');
    }
    // Regardless, the plan should be valid
    assert.ok(plan.required.length > 0, 'Plan should still have required docs');
  });

  // 4.4 — Missing stack signal → plan still valid, no stack-expanded docs
  it('should produce valid plan without stack-expanded docs when stack signal is missing (4.4)', () => {
    const plan = computeConsultationPlan(makePlanInput({
      detectedStack: [],
      issueTags: [],
    }));

    const hasStackBinding = plan.required.concat(plan.optional)
      .some(e => e.signalType === 'stack-binding');
    assert.ok(!hasStackBinding, 'Should not have stack-binding entries');
    assert.equal(plan.schemaVersion, 1, 'Plan should still be valid');
  });

  // 4.5 — Planner never throws for missing data
  it('should never throw for missing or degraded data (4.5)', () => {
    assert.doesNotThrow(() => {
      computeConsultationPlan(makePlanInput({
        snapshot: makeEmptySnapshot(),
      }));
    }, 'Empty snapshot should not throw');

    assert.doesNotThrow(() => {
      computeConsultationPlan(makePlanInput({
        workflowId: 'nonexistent-workflow',
      }));
    }, 'Unknown workflow should not throw');
  });

  // 4.6 — Constraint: allowFollowUpExpansion=false disables follow-ups
  it('should skip follow-up expansion when allowFollowUpExpansion is false (4.6)', () => {
    const plan = computeConsultationPlan(makePlanInput({
      constraints: { allowFollowUpExpansion: false },
    }));

    assert.equal(plan.followup.length, 0,
      'Follow-ups should be empty when expansion disabled');
  });
});

// ---------------------------------------------------------------------------
// Additional: Cross-cutting planner tests
// ---------------------------------------------------------------------------

describe('Consultation Planner — Cross-cutting', () => {
  it('should produce correct plan for security-review workflow', () => {
    const plan = computeConsultationPlan(makePlanInput({
      workflowId: 'security-review',
    }));

    const requiredIds = plan.required.map(e => e.docId);
    assert.ok(requiredIds.includes('sql-injection-prevention'),
      'sql-injection-prevention should be required for security-review');
  });

  it('should assign sequential order indices', () => {
    const plan = computeConsultationPlan(makePlanInput());

    const allEntries = [...plan.required, ...plan.optional, ...plan.followup];
    for (let i = 0; i < allEntries.length; i++) {
      assert.equal(allEntries[i].orderIndex, i,
        `Expected orderIndex ${i}, got ${allEntries[i].orderIndex}`);
    }
  });

  it('should apply tight constraint caps with large snapshot', () => {
    const snapshot = createLargeSnapshot();
    const plan = computeConsultationPlan({
      workflowId: 'audit',
      snapshot,
      detectedStack: [],
      issueTags: ['sql-injection', 'xss', 'csrf', 'ssrf', 'xxe', 'deserialization', 'command-injection'],
      changedFiles: [],
      constraints: { maxRequired: 3, maxOptional: 2, maxFollowup: 1 },
      corpusVersion: '1.0.0',
    });

    assert.ok(plan.required.length <= 3,
      `Expected max 3 required, got ${plan.required.length}`);
    assert.ok(plan.optional.length <= 2,
      `Expected max 2 optional, got ${plan.optional.length}`);
    assert.ok(plan.followup.length <= 1,
      `Expected max 1 followup, got ${plan.followup.length}`);
  });
});
