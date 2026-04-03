/**
 * Tests for the legacy delegation compliance validator.
 *
 * TODO(remove-in-release-c): These tests cover the deprecated
 * delegation compliance pipeline. Remove alongside
 * src/core/delegation-compliance.ts when Release C ships.
 *
 * Active replacement tests: test/unit/consultation-compliance.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { validateCompliance } from '../../dist/core/delegation-compliance.js';

/** @type {import('../../dist/core/types.js').DelegationPlan} */
function makePlan(overrides = {}) {
  return {
    schemaVersion: 1,
    workflowId: 'audit',
    generatedAt: new Date().toISOString(),
    subjects: [{
      id: 'audit-workflow',
      type: 'workflow',
      description: 'Workflow-level delegation',
      sourceArtifact: 'runtime',
      sourceSignals: [],
    }],
    entries: [
      {
        specialistId: 'sql-injection-prevention',
        subjectId: 'audit-workflow',
        requirement: 'required',
        score: 25,
        reasons: [{ signalType: 'workflow-binding', signalValue: 'primary', score: 5, description: 'test' }],
        orderIndex: 0,
      },
      {
        specialistId: 'cross-site-scripting-prevention',
        subjectId: 'audit-workflow',
        requirement: 'required',
        score: 20,
        reasons: [{ signalType: 'workflow-binding', signalValue: 'primary', score: 5, description: 'test' }],
        orderIndex: 1,
      },
      {
        specialistId: 'clickjacking-defense',
        subjectId: 'audit-workflow',
        requirement: 'optional',
        score: 10,
        reasons: [{ signalType: 'workflow-binding', signalValue: 'optional', score: 3, description: 'test' }],
        orderIndex: 2,
      },
    ],
    constraints: {
      maxRequiredPerSubject: 3,
      maxOptionalPerSubject: 3,
      allowFollowUpSpecialists: true,
      maxFollowUpDepth: 1,
      failOnMissingRequired: true,
      allowOutOfPlanConsults: false,
    },
    sourceArtifactRefs: [],
    ...overrides,
  };
}

/** @type {import('../../dist/core/types.js').SpecialistExecutionRecord} */
function makeRecord(overrides = {}) {
  return {
    specialistId: 'sql-injection-prevention',
    subjectId: 'audit-workflow',
    requirement: 'required',
    verdict: 'pass',
    confidence: 0.95,
    evidenceRefs: ['src/auth/login.ts:42'],
    summary: 'No SQL injection found',
    followUpSpecialists: [],
    executedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('Delegation Compliance - validateCompliance', () => {
  it('should pass when all required specialists are consulted', () => {
    const plan = makePlan();
    const records = [
      makeRecord({ specialistId: 'sql-injection-prevention' }),
      makeRecord({ specialistId: 'cross-site-scripting-prevention' }),
    ];

    const report = validateCompliance(plan, records);
    assert.equal(report.status, 'pass');
    assert.equal(report.requiredConsulted, 2);
    assert.equal(report.requiredTotal, 2);
  });

  it('should fail when a required specialist is missing', () => {
    const plan = makePlan();
    const records = [
      makeRecord({ specialistId: 'sql-injection-prevention' }),
      // Missing cross-site-scripting-prevention
    ];

    const report = validateCompliance(plan, records);
    assert.equal(report.status, 'fail');
    assert.ok(report.issues.some(i => i.type === 'missing-required'));
    assert.ok(report.issues.some(i => i.specialistId === 'cross-site-scripting-prevention'));
  });

  it('should fail when a verdict is malformed', () => {
    const plan = makePlan();
    const records = [
      makeRecord({ specialistId: 'sql-injection-prevention', verdict: undefined, confidence: undefined }),
      makeRecord({ specialistId: 'cross-site-scripting-prevention' }),
    ];

    const report = validateCompliance(plan, records);
    assert.equal(report.status, 'fail');
    assert.ok(report.issues.some(i => i.type === 'malformed-verdict'));
  });

  it('should record unauthorized consults when not allowed', () => {
    const plan = makePlan();
    const records = [
      makeRecord({ specialistId: 'sql-injection-prevention' }),
      makeRecord({ specialistId: 'cross-site-scripting-prevention' }),
      makeRecord({ specialistId: 'rogue-specialist' }),
    ];

    const report = validateCompliance(plan, records);
    assert.equal(report.unauthorizedCount, 1);
    assert.ok(report.issues.some(i => i.type === 'unauthorized-consult'));
  });

  it('should record duplicate consults', () => {
    const plan = makePlan();
    const records = [
      makeRecord({ specialistId: 'sql-injection-prevention', confidence: 0.8 }),
      makeRecord({ specialistId: 'sql-injection-prevention', confidence: 0.95 }),
      makeRecord({ specialistId: 'cross-site-scripting-prevention' }),
    ];

    const report = validateCompliance(plan, records);
    assert.ok(report.issues.some(i => i.type === 'duplicate-consult'));
  });

  it('should pass with valid derived follow-up consults', () => {
    const plan = makePlan({
      entries: [
        ...makePlan().entries,
        {
          specialistId: 'query-parameterization',
          subjectId: 'audit-workflow',
          requirement: 'derived-follow-up',
          score: 12,
          reasons: [{ signalType: 'delegation-edge', signalValue: 'sql-injection-prevention', score: 12, description: 'test' }],
          orderIndex: 3,
        },
      ],
    });

    const records = [
      makeRecord({ specialistId: 'sql-injection-prevention' }),
      makeRecord({ specialistId: 'cross-site-scripting-prevention' }),
      makeRecord({ specialistId: 'query-parameterization', requirement: 'derived-follow-up' }),
    ];

    const report = validateCompliance(plan, records);
    assert.equal(report.status, 'pass');
    assert.equal(report.followUpConsulted, 1);
  });

  it('should handle empty execution records gracefully', () => {
    const plan = makePlan();
    const report = validateCompliance(plan, []);

    assert.equal(report.status, 'fail');
    assert.equal(report.requiredConsulted, 0);
    assert.equal(report.requiredTotal, 2);
  });

  it('should produce valid report with correct schema version', () => {
    const report = validateCompliance(makePlan(), [
      makeRecord({ specialistId: 'sql-injection-prevention' }),
      makeRecord({ specialistId: 'cross-site-scripting-prevention' }),
    ]);

    assert.equal(report.schemaVersion, 1);
    assert.ok(report.checkedAt);
    assert.equal(report.workflowId, 'audit');
  });
});
