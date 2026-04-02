/**
 * Phase 6 — Type System Tests
 *
 * Validates that the new types (SignalDerivation, ConsultationTrace, mcpConsultation)
 * exist, are correctly shaped, and that deprecated fields are marked for removal.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { getWorkflow, getAllWorkflows } from '../../dist/catalog/workflows/registry.js';

describe('Phase 6 — Type System', () => {

  // ---------------------------------------------------------------------------
  // 1.1 All 9 workflow definitions exist
  // ---------------------------------------------------------------------------
  it('should have exactly 9 workflow definitions registered', () => {
    const allWorkflows = getAllWorkflows();
    assert.equal(allWorkflows.length, 9);
  });

  // ---------------------------------------------------------------------------
  // 1.2 SignalDerivation type — workflows with it have correct shape
  // ---------------------------------------------------------------------------
  it('should have signalDerivation with correct fields on workflows that define it', () => {
    const allWorkflows = getAllWorkflows();
    const validStacks = ['from-codebase', 'from-prior-artifact', 'from-diff-heuristics', 'none'];
    const validIssueTags = ['from-findings', 'from-diff-heuristics', 'none'];
    const validChangedFiles = ['from-diff', 'from-prior-artifact', 'none'];

    for (const workflow of allWorkflows) {
      if (workflow.signalDerivation) {
        assert.ok(validStacks.includes(workflow.signalDerivation.stacks),
          `${workflow.id}.signalDerivation.stacks="${workflow.signalDerivation.stacks}" is not a valid value`);
        assert.ok(validIssueTags.includes(workflow.signalDerivation.issueTags),
          `${workflow.id}.signalDerivation.issueTags="${workflow.signalDerivation.issueTags}" is not a valid value`);
        assert.ok(validChangedFiles.includes(workflow.signalDerivation.changedFiles),
          `${workflow.id}.signalDerivation.changedFiles="${workflow.signalDerivation.changedFiles}" is not a valid value`);
      }
    }
  });

  // ---------------------------------------------------------------------------
  // 1.3 ALL 9 workflows must have signalDerivation (Definition of Done)
  // ---------------------------------------------------------------------------
  it('should have signalDerivation on ALL 9 workflow definitions', () => {
    const allWorkflows = getAllWorkflows();
    for (const workflow of allWorkflows) {
      assert.ok(workflow.signalDerivation,
        `${workflow.id} is missing signalDerivation — Phase 6 DoD requires all 9 workflows to have it`);
    }
  });

  // ---------------------------------------------------------------------------
  // 1.4 ConsultationTrace type shape — verify the plan sub-object fields
  // ---------------------------------------------------------------------------
  it('should support ConsultationTrace-compatible objects with all required fields', () => {
    const trace = {
      plan: {
        workflowId: 'audit',
        generatedAt: new Date().toISOString(),
        corpusVersion: '1.0.0',
        requiredCount: 3,
        optionalCount: 2,
        followupCount: 1,
      },
      consultedDocs: [
        { id: 'sql-injection-prevention', title: 'SQL Injection Prevention', sourceUrl: 'https://example.com' },
      ],
      coverageStatus: 'pass',
      requiredMissing: [],
      notes: [],
    };

    assert.ok(trace.plan.workflowId);
    assert.ok(trace.plan.generatedAt);
    assert.ok(trace.plan.corpusVersion);
    assert.equal(typeof trace.plan.requiredCount, 'number');
    assert.equal(typeof trace.plan.optionalCount, 'number');
    assert.equal(typeof trace.plan.followupCount, 'number');
    assert.ok(Array.isArray(trace.consultedDocs));
    assert.ok(['pass', 'warn', 'fail'].includes(trace.coverageStatus));
    assert.ok(Array.isArray(trace.requiredMissing));
    assert.ok(Array.isArray(trace.notes));
  });

  // ---------------------------------------------------------------------------
  // 1.5 mcpConsultation on orchestration phases — where present, must be valid
  // ---------------------------------------------------------------------------
  it('should have valid mcpConsultation values on orchestration phases that define it', () => {
    const allWorkflows = getAllWorkflows();
    for (const workflow of allWorkflows) {
      if (workflow.orchestration?.phases) {
        for (const phase of workflow.orchestration.phases) {
          if (phase.mcpConsultation !== undefined) {
            assert.ok(['full', 'minimal', 'none'].includes(phase.mcpConsultation),
              `${workflow.id} phase "${phase.id}" has invalid mcpConsultation: "${phase.mcpConsultation}"`);
          }
        }
      }
    }
  });

  // ---------------------------------------------------------------------------
  // 1.6 No delegationPolicy should remain (Definition of Done)
  // ---------------------------------------------------------------------------
  it('should not have delegationPolicy on any workflow definition', () => {
    const allWorkflows = getAllWorkflows();
    for (const workflow of allWorkflows) {
      assert.equal(workflow.delegationPolicy, undefined,
        `${workflow.id} still has delegationPolicy — Phase 6 DoD requires removal`);
    }
  });

  // ---------------------------------------------------------------------------
  // 1.7 No cheatSheetUrls should remain (Definition of Done)
  // ---------------------------------------------------------------------------
  it('should not have cheatSheetUrls on any workflow topic', () => {
    const allWorkflows = getAllWorkflows();
    for (const workflow of allWorkflows) {
      if (workflow.owaspTopics) {
        for (const topic of workflow.owaspTopics) {
          assert.equal(topic.cheatSheetUrls, undefined,
            `${workflow.id} topic "${topic.name}" still has cheatSheetUrls — Phase 6 DoD requires removal`);
        }
      }
    }
  });

  // ---------------------------------------------------------------------------
  // 1.8 No specialistMode should remain on orchestration phases (Definition of Done)
  // ---------------------------------------------------------------------------
  it('should not have specialistMode on any orchestration phase', () => {
    const allWorkflows = getAllWorkflows();
    for (const workflow of allWorkflows) {
      if (workflow.orchestration?.phases) {
        for (const phase of workflow.orchestration.phases) {
          assert.equal(phase.specialistMode, undefined,
            `${workflow.id} phase "${phase.id}" still has specialistMode — Phase 6 DoD requires removal`);
        }
      }
    }
  });

  // ---------------------------------------------------------------------------
  // 1.9 Per-workflow signalDerivation values match the Phase 6 plan
  // ---------------------------------------------------------------------------
  describe('Per-workflow signal derivation values', () => {
    const expected = {
      'security-review':    { stacks: 'from-diff-heuristics', issueTags: 'from-diff-heuristics', changedFiles: 'from-diff' },
      'audit':              { stacks: 'from-prior-artifact',  issueTags: 'from-findings',        changedFiles: 'none' },
      'verify':             { stacks: 'from-prior-artifact',  issueTags: 'from-findings',        changedFiles: 'from-prior-artifact' },
      'validate-findings':  { stacks: 'from-prior-artifact',  issueTags: 'from-findings',        changedFiles: 'none' },
      'plan-remediation':   { stacks: 'from-prior-artifact',  issueTags: 'from-findings',        changedFiles: 'from-prior-artifact' },
      'map-codebase':       { stacks: 'from-codebase',        issueTags: 'none',                 changedFiles: 'none' },
      'threat-model':       { stacks: 'from-prior-artifact',  issueTags: 'none',                 changedFiles: 'none' },
      'execute-remediation':{ stacks: 'from-prior-artifact',  issueTags: 'from-findings',        changedFiles: 'from-prior-artifact' },
      'report':             { stacks: 'none',                 issueTags: 'none',                 changedFiles: 'none' },
    };

    for (const [id, sig] of Object.entries(expected)) {
      it(`${id} should have correct signalDerivation`, () => {
        const workflow = getWorkflow(id);
        assert.ok(workflow.signalDerivation, `${id} missing signalDerivation`);
        assert.equal(workflow.signalDerivation.stacks, sig.stacks,
          `${id}.stacks: expected "${sig.stacks}", got "${workflow.signalDerivation.stacks}"`);
        assert.equal(workflow.signalDerivation.issueTags, sig.issueTags,
          `${id}.issueTags: expected "${sig.issueTags}", got "${workflow.signalDerivation.issueTags}"`);
        assert.equal(workflow.signalDerivation.changedFiles, sig.changedFiles,
          `${id}.changedFiles: expected "${sig.changedFiles}", got "${workflow.signalDerivation.changedFiles}"`);
      });
    }
  });
});
