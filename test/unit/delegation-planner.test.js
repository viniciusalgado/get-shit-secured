/**
 * Unit tests for the delegation planner engine.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { computeDelegationPlan } from '../../dist/core/delegation-planner.js';

/** @type {import('../../dist/core/delegation-planner.js').DelegationPlanInput} */
function makeMinimalInput(overrides = {}) {
  return {
    workflowId: 'audit',
    policy: {
      mode: 'on-detection',
      subjectSource: 'finding clusters',
      constraints: {
        maxRequiredPerSubject: 3,
        maxOptionalPerSubject: 3,
        allowFollowUpSpecialists: true,
        maxFollowUpDepth: 1,
        failOnMissingRequired: true,
        allowOutOfPlanConsults: false,
      },
    },
    primarySpecialists: ['sql-injection-prevention', 'cross-site-scripting-prevention'],
    optionalSpecialists: ['clickjacking-defense'],
    stackConditionedSpecialists: [
      { stack: 'django', specialists: ['django-security'] },
    ],
    detectedStack: [],
    issueTags: [],
    changedFiles: [],
    specialists: [],
    graph: { rules: {}, reverseLookup: {}, specialistIds: [] },
    sourceArtifactRefs: ['.gss/artifacts/audit/findings.json'],
    ...overrides,
  };
}

describe('Delegation Planner - computeDelegationPlan', () => {
  it('should produce a valid plan with empty inputs', () => {
    const plan = computeDelegationPlan(makeMinimalInput());

    assert.equal(plan.schemaVersion, 1);
    assert.equal(plan.workflowId, 'audit');
    assert.ok(plan.generatedAt);
    assert.ok(Array.isArray(plan.subjects));
    assert.ok(plan.subjects.length >= 1); // At least the workflow-level subject
    assert.ok(Array.isArray(plan.entries));
    assert.ok(Array.isArray(plan.sourceArtifactRefs));
  });

  it('should seed required specialists from primary bindings', () => {
    const plan = computeDelegationPlan(makeMinimalInput());

    const required = plan.entries.filter(e => e.requirement === 'required');
    const specialistIds = required.map(e => e.specialistId);

    assert.ok(specialistIds.includes('sql-injection-prevention'));
    assert.ok(specialistIds.includes('cross-site-scripting-prevention'));
  });

  it('should seed optional specialists from optional bindings', () => {
    const plan = computeDelegationPlan(makeMinimalInput());

    const optional = plan.entries.filter(e => e.requirement === 'optional');
    const specialistIds = optional.map(e => e.specialistId);

    assert.ok(specialistIds.includes('clickjacking-defense'));
  });

  it('should activate stack-conditioned specialists when stack matches', () => {
    const plan = computeDelegationPlan(makeMinimalInput({
      detectedStack: ['django'],
    }));

    const specialistIds = plan.entries.map(e => e.specialistId);
    assert.ok(specialistIds.includes('django-security'));
  });

  it('should NOT activate stack-conditioned specialists when stack does not match', () => {
    const plan = computeDelegationPlan(makeMinimalInput({
      detectedStack: ['ruby'],
    }));

    const specialistIds = plan.entries.map(e => e.specialistId);
    assert.ok(!specialistIds.includes('django-security'));
  });

  it('should produce deterministic ordering for identical inputs', () => {
    const input = makeMinimalInput({
      detectedStack: ['django'],
    });

    const plan1 = computeDelegationPlan(input);
    const plan2 = computeDelegationPlan(input);

    const ids1 = plan1.entries.map(e => e.specialistId);
    const ids2 = plan2.entries.map(e => e.specialistId);

    assert.deepEqual(ids1, ids2);
  });

  it('should produce deterministic order indices', () => {
    const input = makeMinimalInput();
    const plan = computeDelegationPlan(input);

    const orderIndices = plan.entries.map(e => e.orderIndex);
    const expected = orderIndices.map((_, i) => i);
    assert.deepEqual(orderIndices, expected);
  });

  it('should include reasons for each specialist entry', () => {
    const plan = computeDelegationPlan(makeMinimalInput());

    for (const entry of plan.entries) {
      assert.ok(Array.isArray(entry.reasons));
      assert.ok(entry.reasons.length > 0);
      for (const reason of entry.reasons) {
            assert.ok(reason.signalType);
            assert.ok(reason.description);
          }
    }
  });

  it('should respect maxRequiredPerSubject cap', () => {
    const plan = computeDelegationPlan(makeMinimalInput({
      primarySpecialists: ['a', 'b', 'c', 'd', 'e'],
      policy: {
        mode: 'on-detection',
        subjectSource: 'test',
        constraints: {
          maxRequiredPerSubject: 2,
          maxOptionalPerSubject: 3,
          allowFollowUpSpecialists: true,
          maxFollowUpDepth: 1,
          failOnMissingRequired: true,
          allowOutOfPlanConsults: false,
        },
      },
    }));

    const required = plan.entries.filter(e => e.requirement === 'required');
    assert.ok(required.length <= 2, `Expected at most 2 required, got ${required.length}`);
  });

  it('should expand follow-up specialists via delegation graph', () => {
    const plan = computeDelegationPlan(makeMinimalInput({
      graph: {
        rules: {
          'sql-injection-prevention': [{
            parentSpecialistId: 'sql-injection-prevention',
            childSpecialistId: 'query-parameterization',
            reason: 'SQL injection often requires query parameterization',
            triggerPhrases: ['parameterized query'],
          }],
        },
        reverseLookup: { 'query-parameterization': ['sql-injection-prevention'] },
        specialistIds: ['sql-injection-prevention', 'query-parameterization'],
      },
    }));

    const specialistIds = plan.entries.map(e => e.specialistId);
    assert.ok(specialistIds.includes('query-parameterization'));

    const followUp = plan.entries.find(e => e.specialistId === 'query-parameterization');
    assert.equal(followUp?.requirement, 'derived-follow-up');
  });

  it('should NOT expand follow-ups when disabled', () => {
    const plan = computeDelegationPlan(makeMinimalInput({
      policy: {
        mode: 'on-detection',
        subjectSource: 'test',
        constraints: {
          maxRequiredPerSubject: 3,
          maxOptionalPerSubject: 3,
          allowFollowUpSpecialists: false,
          maxFollowUpDepth: 0,
          failOnMissingRequired: true,
          allowOutOfPlanConsults: false,
        },
      },
      graph: {
        rules: {
          'sql-injection-prevention': [{
            parentSpecialistId: 'sql-injection-prevention',
            childSpecialistId: 'query-parameterization',
            reason: 'test',
            triggerPhrases: [],
          }],
        },
        reverseLookup: { 'query-parameterization': ['sql-injection-prevention'] },
        specialistIds: ['sql-injection-prevention', 'query-parameterization'],
      },
    }));

    const specialistIds = plan.entries.map(e => e.specialistId);
    assert.ok(!specialistIds.includes('query-parameterization'));
  });

  it('should dedupe specialist entries', () => {
    const plan = computeDelegationPlan(makeMinimalInput({
      primarySpecialists: ['sql-injection-prevention'],
      optionalSpecialists: ['sql-injection-prevention'],
    }));

    const count = plan.entries.filter(e => e.specialistId === 'sql-injection-prevention').length;
    assert.equal(count, 1, 'Duplicate specialist should be deduped');
  });

  it('should produce valid empty plan when no specialists apply', () => {
    const plan = computeDelegationPlan(makeMinimalInput({
      primarySpecialists: [],
      optionalSpecialists: [],
      stackConditionedSpecialists: [],
      detectedStack: [],
      issueTags: [],
      specialists: [],
    }));

    assert.equal(plan.entries.length, 0);
    assert.equal(plan.workflowId, 'audit');
    assert.equal(plan.schemaVersion, 1);
  });
});
