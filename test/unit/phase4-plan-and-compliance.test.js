/**
 * Phase 4 Validation — Consultation Planner + Compliance Engine
 *
 * Exhaustive validation tests modeled after the Phase 5 test plan (sections 3–4)
 * but exercising the modules directly rather than through an MCP server.
 *
 * Test conventions:
 * - Framework: node:test (describe/it)
 * - Assertions: node:assert/strict
 * - Imports from dist/ (compiled output)
 * - Fixtures from test/fixtures/
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { computeConsultationPlan } from '../../dist/core/consultation-planner.js';
import { validateConsultationCoverage } from '../../dist/core/consultation-compliance.js';
import {
  CONSULTATION_PLAN_SCHEMA_VERSION,
  CONSULTATION_VALIDATION_SCHEMA_VERSION,
  DEFAULT_CONSULTATION_CONSTRAINTS,
} from '../../dist/core/types.js';
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

/** Helper: compute a plan and validate it in one call */
function planAndValidate(inputOverrides = {}, consultedDocIds = []) {
  const plan = computeConsultationPlan(makePlanInput(inputOverrides));
  const validation = validateConsultationCoverage(plan, consultedDocIds);
  return { plan, validation };
}

// =============================================================================
// 1. Consultation Plan — Schema and Structure
// =============================================================================

describe('Phase 4 Validation — Consultation Plan Schema', () => {

  it('should return valid plan for audit workflow with no signals', () => {
    const plan = computeConsultationPlan(makePlanInput());

    assert.equal(plan.schemaVersion, CONSULTATION_PLAN_SCHEMA_VERSION);
    assert.equal(plan.schemaVersion, 1);
    assert.equal(plan.workflowId, 'audit');
    assert.equal(typeof plan.generatedAt, 'string');
    assert.ok(!isNaN(Date.parse(plan.generatedAt)), 'generatedAt should be valid ISO');
    assert.equal(plan.corpusVersion, '1.0.0');
    assert.ok(Array.isArray(plan.required));
    assert.ok(Array.isArray(plan.optional));
    assert.ok(Array.isArray(plan.followup));
    assert.ok(plan.required.length >= 2, 'Audit should have >= 2 required (sql-injection, xss)');
    assert.deepEqual(plan.signals.stacks, []);
    assert.ok(plan.constraints);
    assert.equal(typeof plan.constraints.maxRequired, 'number');
    assert.equal(typeof plan.constraints.maxOptional, 'number');
    assert.equal(typeof plan.constraints.maxFollowup, 'number');
  });

  it('should include stack-conditioned docs when stacks provided', () => {
    // Use nodejs stack — nodejs-security has NO workflow binding, only a stack binding.
    // This avoids the precedence issue where django-security has both a workflow-binding
    // and a stack-binding (workflow-binding takes priority in seeding).
    const plan = computeConsultationPlan(makePlanInput({
      detectedStack: ['nodejs'],
    }));

    const allDocs = [...plan.required, ...plan.optional];
    const nodejsEntry = allDocs.find(e => e.docId === 'nodejs-security');
    assert.ok(nodejsEntry, 'Expected nodejs-security in plan');
    assert.equal(nodejsEntry.signalType, 'stack-binding');
  });

  it('should include issue-tag docs when issueTags provided', () => {
    const plan = computeConsultationPlan(makePlanInput({
      issueTags: ['password-storage'],
    }));

    const allDocs = [...plan.required, ...plan.optional];
    const pwEntry = allDocs.find(e => e.docId === 'password-storage');
    assert.ok(pwEntry, 'Expected password-storage in plan');
    assert.ok(['issue-tag', 'workflow-binding'].includes(pwEntry.signalType),
      'password-storage should be matched via issue-tag or workflow-binding');
  });

  it('should return followup docs from related doc edges', () => {
    const plan = computeConsultationPlan(makePlanInput());

    const followupIds = plan.followup.map(e => e.docId);
    // sql-injection-prevention is required for audit, has relatedDocIds: query-parameterization, input-validation
    assert.ok(followupIds.includes('query-parameterization'),
      'Expected query-parameterization as followup');
    assert.ok(followupIds.includes('input-validation'),
      'Expected input-validation as followup');
    assert.ok(plan.followup.every(e => e.signalType === 'related-doc'),
      'All followup entries should have signalType "related-doc"');
  });

  it('should produce identical plans for identical inputs (determinism)', () => {
    const input = makePlanInput({ detectedStack: ['django'], issueTags: ['xss'] });

    const plan1 = computeConsultationPlan(input);
    const plan2 = computeConsultationPlan(input);

    assert.deepEqual(plan1.required, plan2.required);
    assert.deepEqual(plan1.optional, plan2.optional);
    assert.deepEqual(plan1.followup, plan2.followup);
  });

  it('should respect max constraints on plan output', () => {
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

    assert.ok(plan.required.length <= 3, `max 3 required, got ${plan.required.length}`);
    assert.ok(plan.optional.length <= 2, `max 2 optional, got ${plan.optional.length}`);
    assert.ok(plan.followup.length <= 1, `max 1 followup, got ${plan.followup.length}`);
  });

  it('should handle unknown workflowId gracefully', () => {
    assert.doesNotThrow(() => {
      const plan = computeConsultationPlan(makePlanInput({
        workflowId: 'nonexistent-workflow',
      }));
      assert.equal(plan.required.length, 0);
      assert.equal(plan.optional.length, 0);
      assert.equal(plan.followup.length, 0);
    }, 'Unknown workflow should not throw');
  });

  it('should stamp input signals on output plan', () => {
    const plan = computeConsultationPlan(makePlanInput({
      detectedStack: ['Django'],
      issueTags: ['SQL Injection'],
      changedFiles: ['src/app.py'],
    }));

    assert.ok(plan.signals.stacks.length > 0, 'Expected stacks in signals');
    assert.ok(plan.signals.issueTags.length > 0, 'Expected issueTags in signals');
    assert.deepEqual(plan.signals.changedFiles, ['src/app.py']);
  });
});

// =============================================================================
// 2. Consultation Plan — Workflow-Specific Plans
// =============================================================================

describe('Phase 4 Validation — Workflow-Specific Plans', () => {

  it('should produce correct plan for security-review workflow', () => {
    const plan = computeConsultationPlan(makePlanInput({ workflowId: 'security-review' }));

    const requiredIds = plan.required.map(e => e.docId);
    assert.ok(requiredIds.includes('sql-injection-prevention'),
      'sql-injection-prevention should be required for security-review');

    const optionalIds = plan.optional.map(e => e.docId);
    assert.ok(optionalIds.includes('cross-site-scripting-prevention'),
      'cross-site-scripting-prevention should be optional for security-review');
  });

  it('should produce correct plan for verify workflow', () => {
    const plan = computeConsultationPlan(makePlanInput({ workflowId: 'verify' }));

    const optionalIds = plan.optional.map(e => e.docId);
    assert.ok(optionalIds.includes('sql-injection-prevention'),
      'sql-injection-prevention should be optional for verify');
  });

  it('should produce empty plan for map-codebase (no bindings)', () => {
    const plan = computeConsultationPlan(makePlanInput({ workflowId: 'map-codebase' }));

    assert.equal(plan.required.length, 0);
    assert.equal(plan.optional.length, 0);
  });

  it('should include stack-conditioned docs across all workflows', () => {
    const plan = computeConsultationPlan(makePlanInput({
      workflowId: 'security-review',
      detectedStack: ['nodejs'],
    }));

    const allDocs = [...plan.required, ...plan.optional];
    assert.ok(allDocs.some(e => e.docId === 'nodejs-security'),
      'nodejs-security should appear when nodejs stack is detected');
  });
});

// =============================================================================
// 3. Consultation Plan — Scoring and Ordering
// =============================================================================

describe('Phase 4 Validation — Plan Scoring and Ordering', () => {

  it('should assign score 10 to workflow-binding required docs', () => {
    const plan = computeConsultationPlan(makePlanInput());
    const wfRequired = plan.required.filter(e => e.signalType === 'workflow-binding');
    assert.ok(wfRequired.length > 0);
    assert.ok(wfRequired.every(e => e.score === 10));
  });

  it('should assign score 15 to stack-binding docs', () => {
    const plan = computeConsultationPlan(makePlanInput({ detectedStack: ['nodejs'] }));
    const stackEntries = [...plan.required, ...plan.optional].filter(e => e.signalType === 'stack-binding');
    assert.ok(stackEntries.length > 0);
    assert.ok(stackEntries.every(e => e.score === 15));
  });

  it('should assign score 20 to issue-tag docs', () => {
    const plan = computeConsultationPlan(makePlanInput({ issueTags: ['csrf'] }));
    const issueEntries = [...plan.required, ...plan.optional].filter(e => e.signalType === 'issue-tag');
    assert.ok(issueEntries.length > 0);
    assert.ok(issueEntries.every(e => e.score === 20));
  });

  it('should assign score 8 to related-doc followups', () => {
    const plan = computeConsultationPlan(makePlanInput());
    assert.ok(plan.followup.length > 0);
    assert.ok(plan.followup.every(e => e.score === 8));
  });

  it('should deduplicate docs matched by multiple signals', () => {
    const plan = computeConsultationPlan(makePlanInput({ issueTags: ['sql-injection'] }));
    const sqlEntries = [...plan.required, ...plan.optional].filter(e => e.docId === 'sql-injection-prevention');
    assert.equal(sqlEntries.length, 1, 'Doc should appear once even with multiple matching signals');
  });

  it('should order entries with same score by docId ascending (tiebreaker)', () => {
    const plan = computeConsultationPlan(makePlanInput());
    for (let i = 1; i < plan.required.length; i++) {
      const prev = plan.required[i - 1];
      const curr = plan.required[i];
      if (prev.score === curr.score) {
        assert.ok(prev.docId.localeCompare(curr.docId) <= 0,
          `Expected docId tiebreaker: ${prev.docId} <= ${curr.docId}`);
      }
    }
  });

  it('should assign sequential order indices across all tiers', () => {
    const plan = computeConsultationPlan(makePlanInput());
    const allEntries = [...plan.required, ...plan.optional, ...plan.followup];
    for (let i = 0; i < allEntries.length; i++) {
      assert.equal(allEntries[i].orderIndex, i,
        `Expected orderIndex ${i}, got ${allEntries[i].orderIndex}`);
    }
  });
});

// =============================================================================
// 4. Consultation Plan — Fallback and Edge Cases
// =============================================================================

describe('Phase 4 Validation — Plan Fallbacks and Edge Cases', () => {

  it('should produce plan with empty arrays for empty snapshot', () => {
    const plan = computeConsultationPlan(makePlanInput({ snapshot: makeEmptySnapshot() }));
    assert.equal(plan.required.length, 0);
    assert.equal(plan.optional.length, 0);
    assert.equal(plan.followup.length, 0);
    assert.equal(plan.schemaVersion, 1);
  });

  it('should still include workflow-required docs when stack/issue do not match', () => {
    const plan = computeConsultationPlan(makePlanInput({
      detectedStack: ['rust'],
      issueTags: ['prompt-injection'],
    }));
    const wfDocs = plan.required.filter(e => e.signalType === 'workflow-binding');
    assert.ok(wfDocs.length >= 2, 'Should still include audit-required docs');
  });

  it('should handle broken related-doc edges gracefully', () => {
    const snapshot = createSnapshotWithBrokenEdge();
    assert.doesNotThrow(() => {
      computeConsultationPlan({
        workflowId: 'audit',
        snapshot,
        detectedStack: [],
        issueTags: ['sql-injection'],
        changedFiles: [],
        corpusVersion: '1.0.0',
      });
    }, 'Broken edges should not throw');
  });

  it('should skip follow-up expansion when allowFollowUpExpansion is false', () => {
    const plan = computeConsultationPlan(makePlanInput({
      constraints: { allowFollowUpExpansion: false },
    }));
    assert.equal(plan.followup.length, 0);
  });

  it('should never throw for missing or degraded data', () => {
    assert.doesNotThrow(() => {
      computeConsultationPlan(makePlanInput({ snapshot: makeEmptySnapshot() }));
    }, 'Empty snapshot should not throw');

    assert.doesNotThrow(() => {
      computeConsultationPlan(makePlanInput({ workflowId: 'nonexistent-workflow' }));
    }, 'Unknown workflow should not throw');
  });

  it('should not import from delegation-graph or SpecialistDefinition', () => {
    const source = readFileSync('src/core/consultation-planner.ts', 'utf-8');
    const imports = source.split('\n').filter(l => l.trimStart().startsWith('import '));
    assert.ok(!imports.some(l => l.includes('delegation-graph')));
    assert.ok(!imports.some(l => l.includes('SpecialistDefinition')));
  });
});

// =============================================================================
// 5. Compliance Validation — Happy Paths
// =============================================================================

describe('Phase 4 Validation — Compliance Happy Paths', () => {

  it('should pass when all required docs are consulted', () => {
    const { plan, validation } = planAndValidate({}, (function () {
      // We'll set consulted after plan creation
      return [];
    })());

    // Re-do with proper consulted docs
    const plan2 = computeConsultationPlan(makePlanInput());
    const consulted = plan2.required.map(e => e.docId);
    const result = validateConsultationCoverage(plan2, consulted);

    assert.equal(result.coverageStatus, 'pass');
    assert.equal(result.requiredMissing.length, 0);
    assert.equal(result.stats.requiredConsulted, result.stats.requiredTotal);
  });

  it('should pass when all required and optional docs are consulted', () => {
    const plan = computeConsultationPlan(makePlanInput());
    const allDocIds = [...plan.required, ...plan.optional, ...plan.followup].map(e => e.docId);
    const result = validateConsultationCoverage(plan, allDocIds);

    assert.equal(result.coverageStatus, 'pass');
    assert.equal(result.requiredMissing.length, 0);
    assert.equal(result.optionalMissed.length, 0);
    assert.equal(result.unexpectedConsulted.length, 0);
  });

  it('should pass even if optional docs are missed (informational only)', () => {
    const plan = computeConsultationPlan(makePlanInput());
    const consulted = plan.required.map(e => e.docId);
    const result = validateConsultationCoverage(plan, consulted);

    assert.equal(result.coverageStatus, 'pass');
    if (plan.optional.length > 0) {
      assert.ok(result.optionalMissed.length > 0, 'Should report optional misses');
    }
  });

  it('should report unexpected consulted docs without failing', () => {
    const plan = computeConsultationPlan(makePlanInput());
    const consulted = [...plan.required.map(e => e.docId), 'totally-fake-doc'];
    const result = validateConsultationCoverage(plan, consulted);

    assert.ok(result.unexpectedConsulted.includes('totally-fake-doc'));
    assert.equal(result.coverageStatus, 'pass');
  });
});

// =============================================================================
// 6. Compliance Validation — Failure Paths
// =============================================================================

describe('Phase 4 Validation — Compliance Failure Paths', () => {

  it('should fail when required docs are missing (failOnMissingRequired=true)', () => {
    const plan = computeConsultationPlan(makePlanInput({
      constraints: { failOnMissingRequired: true },
    }));
    const result = validateConsultationCoverage(plan, []);

    assert.equal(result.coverageStatus, 'fail');
    assert.ok(result.requiredMissing.length > 0);
    assert.ok(result.requiredMissing.includes('sql-injection-prevention'));
    assert.ok(result.notes.some(n => n.includes('FAIL')));
  });

  it('should warn when required docs are missing (failOnMissingRequired=false)', () => {
    const plan = computeConsultationPlan(makePlanInput({
      constraints: { failOnMissingRequired: false },
    }));
    const result = validateConsultationCoverage(plan, []);

    assert.equal(result.coverageStatus, 'warn');
    assert.ok(result.requiredMissing.length > 0);
    assert.ok(result.notes.some(n => n.includes('WARN')));
  });

  it('should fail validation when only partial required docs consulted', () => {
    const plan = computeConsultationPlan(makePlanInput({
      constraints: { failOnMissingRequired: true },
    }));
    // Consult only first required doc
    const consulted = plan.required.slice(0, 1).map(e => e.docId);
    const result = validateConsultationCoverage(plan, consulted);

    assert.equal(result.coverageStatus, 'fail');
    assert.ok(result.requiredMissing.length > 0);
    assert.equal(result.stats.requiredConsulted, 1);
    assert.ok(result.stats.requiredConsulted < result.stats.requiredTotal);
  });

  it('should handle empty consulted list', () => {
    const plan = computeConsultationPlan(makePlanInput());
    const result = validateConsultationCoverage(plan, []);

    assert.equal(result.stats.requiredConsulted, 0);
    assert.equal(result.stats.optionalConsulted, 0);
    assert.ok(result.requiredMissing.length > 0);
    assert.equal(result.coverageStatus, 'fail');
  });
});

// =============================================================================
// 7. Compliance Validation — Stats and Metadata
// =============================================================================

describe('Phase 4 Validation — Compliance Stats and Metadata', () => {

  it('should produce accurate stats', () => {
    const plan = computeConsultationPlan(makePlanInput());
    const consultedDocIds = plan.required.slice(0, 1).map(e => e.docId);
    const result = validateConsultationCoverage(plan, consultedDocIds);

    assert.equal(result.stats.requiredTotal, plan.required.length);
    assert.equal(result.stats.requiredConsulted, 1);
    assert.equal(result.stats.optionalTotal, plan.optional.length);
    assert.equal(result.stats.optionalConsulted, 0);
  });

  it('should include correct schema version and metadata', () => {
    const plan = computeConsultationPlan(makePlanInput());
    const consulted = plan.required.map(e => e.docId);
    const result = validateConsultationCoverage(plan, consulted);

    assert.equal(result.schemaVersion, CONSULTATION_VALIDATION_SCHEMA_VERSION);
    assert.equal(result.schemaVersion, 1);
    assert.equal(result.workflowId, 'audit');
    assert.ok(typeof result.checkedAt === 'string');
    assert.ok(!isNaN(Date.parse(result.checkedAt)), 'checkedAt should be valid ISO');
    assert.ok(Array.isArray(result.consulted));
  });

  it('should reflect consulted doc IDs in output', () => {
    const plan = computeConsultationPlan(makePlanInput());
    const consulted = plan.required.map(e => e.docId);
    const result = validateConsultationCoverage(plan, consulted);
    assert.deepEqual(result.consulted, consulted);
  });

  it('should produce JSON-serializable output with no undefined fields', () => {
    const plan = computeConsultationPlan(makePlanInput());
    const result = validateConsultationCoverage(plan, []);

    const serialized = JSON.stringify(result);
    assert.ok(!serialized.includes('undefined'), 'Output should not contain undefined');

    const parsed = JSON.parse(serialized);
    assert.deepEqual(parsed, result);
  });

  it('should have no runtime-specific fields in output', () => {
    const plan = computeConsultationPlan(makePlanInput());
    const result = validateConsultationCoverage(plan, []);

    const serialized = JSON.stringify(result);
    assert.ok(!serialized.includes('SpecialistDefinition'));
    assert.ok(!serialized.includes('DelegationComplianceReport'));
  });

  it('should populate notes with relevant messages on failure', () => {
    const plan = computeConsultationPlan(makePlanInput());
    const result = validateConsultationCoverage(plan, []);

    assert.ok(Array.isArray(result.notes));
    assert.ok(result.notes.length > 0);
    assert.ok(result.notes.some(n => n.includes('missing') || n.includes('FAIL')));
  });

  it('should not import from delegation modules', () => {
    const source = readFileSync('src/core/consultation-compliance.ts', 'utf-8');
    const imports = source.split('\n').filter(l => l.trimStart().startsWith('import '));
    assert.ok(!imports.some(l => l.includes('delegation-graph')));
    assert.ok(!imports.some(l => l.includes('delegation-compliance')));
    assert.ok(!imports.some(l => l.includes('SpecialistDefinition')));
  });
});

// =============================================================================
// 8. Compliance — Severity Semantics
// =============================================================================

describe('Phase 4 Validation — Severity Semantics', () => {

  it('pass: all required consulted, optional misses are informational', () => {
    const plan = computeConsultationPlan(makePlanInput());
    const result = validateConsultationCoverage(plan, plan.required.map(e => e.docId));

    assert.equal(result.coverageStatus, 'pass');
    assert.equal(result.requiredMissing.length, 0);
    assert.ok(result.notes.some(n => n.includes('All required')));
  });

  it('warn: required missing and failOnMissingRequired=false', () => {
    const plan = computeConsultationPlan(makePlanInput({ constraints: { failOnMissingRequired: false } }));
    const result = validateConsultationCoverage(plan, []);

    assert.equal(result.coverageStatus, 'warn');
    assert.ok(result.notes.some(n => n.includes('failOnMissingRequired') || n.includes('WARN')));
  });

  it('fail: required missing and failOnMissingRequired=true', () => {
    const plan = computeConsultationPlan(makePlanInput({ constraints: { failOnMissingRequired: true } }));
    const result = validateConsultationCoverage(plan, []);

    assert.equal(result.coverageStatus, 'fail');
    assert.ok(result.notes.some(n => n.includes('FAIL')));
  });

  it('severity semantics should be documented in source code', () => {
    const source = readFileSync('src/core/consultation-compliance.ts', 'utf-8');
    assert.ok(source.includes('pass'), 'Should document pass semantics');
    assert.ok(source.includes('warn'), 'Should document warn semantics');
    assert.ok(source.includes('fail'), 'Should document fail semantics');
  });
});

// =============================================================================
// 9. Compliance — Validation with Signals
// =============================================================================

describe('Phase 4 Validation — Compliance with Signal-Driven Plans', () => {

  it('should validate coverage correctly with stack signals', () => {
    const plan = computeConsultationPlan(makePlanInput({
      detectedStack: ['django'],
    }));
    const allDocs = [...plan.required, ...plan.optional].map(e => e.docId);
    const result = validateConsultationCoverage(plan, allDocs);

    assert.equal(result.coverageStatus, 'pass');
  });

  it('should validate coverage correctly with issue-tag signals', () => {
    const plan = computeConsultationPlan(makePlanInput({
      issueTags: ['csrf'],
    }));
    const allDocs = [...plan.required, ...plan.optional].map(e => e.docId);
    const result = validateConsultationCoverage(plan, allDocs);

    assert.equal(result.coverageStatus, 'pass');
  });

  it('should validate coverage correctly with combined signals', () => {
    const plan = computeConsultationPlan(makePlanInput({
      detectedStack: ['django', 'nodejs'],
      issueTags: ['csrf', 'xss'],
    }));
    const allDocs = [...plan.required, ...plan.optional].map(e => e.docId);
    const result = validateConsultationCoverage(plan, allDocs);

    assert.equal(result.coverageStatus, 'pass');
    assert.equal(result.requiredMissing.length, 0);
  });
});

// =============================================================================
// 10. Default Constraints
// =============================================================================

describe('Phase 4 Validation — Default Constraints', () => {

  it('should have correct default constraint values', () => {
    assert.equal(DEFAULT_CONSULTATION_CONSTRAINTS.maxRequired, 5);
    assert.equal(DEFAULT_CONSULTATION_CONSTRAINTS.maxOptional, 8);
    assert.equal(DEFAULT_CONSULTATION_CONSTRAINTS.maxFollowup, 3);
    assert.equal(DEFAULT_CONSULTATION_CONSTRAINTS.allowFollowUpExpansion, true);
    assert.equal(DEFAULT_CONSULTATION_CONSTRAINTS.failOnMissingRequired, true);
  });

  it('should apply default constraints when no override provided', () => {
    const plan = computeConsultationPlan(makePlanInput());
    assert.deepEqual(plan.constraints, {
      ...DEFAULT_CONSULTATION_CONSTRAINTS,
    });
  });

  it('should merge partial constraint overrides with defaults', () => {
    const plan = computeConsultationPlan(makePlanInput({
      constraints: { maxRequired: 2 },
    }));
    assert.equal(plan.constraints.maxRequired, 2);
    assert.equal(plan.constraints.maxOptional, DEFAULT_CONSULTATION_CONSTRAINTS.maxOptional);
    assert.equal(plan.constraints.maxFollowup, DEFAULT_CONSULTATION_CONSTRAINTS.maxFollowup);
    assert.equal(plan.constraints.allowFollowUpExpansion, DEFAULT_CONSULTATION_CONSTRAINTS.allowFollowUpExpansion);
    assert.equal(plan.constraints.failOnMissingRequired, DEFAULT_CONSULTATION_CONSTRAINTS.failOnMissingRequired);
  });
});
