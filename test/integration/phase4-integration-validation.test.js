/**
 * Phase 4 Integration Validation
 *
 * End-to-end flow tests validating the full plan → validate pipeline,
 * including signal-driven planning, cross-component consistency, and
 * degraded mode handling.
 *
 * Modeled after Phase 5 test plan sections 9.1–9.4 (integration flows)
 * but testing modules directly rather than through MCP.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { computeConsultationPlan } from '../../dist/core/consultation-planner.js';
import { validateConsultationCoverage } from '../../dist/core/consultation-compliance.js';
import {
  extractAuditSignals,
  extractSecurityReviewSignals,
  extractVerifySignals,
} from '../../dist/core/consultation-signals.js';
import {
  getDocumentById,
  getRelatedDocuments,
} from '../../dist/corpus/snapshot-loader.js';
import {
  makeMinimalSnapshot,
  makeEmptySnapshot,
  createLoadedSnapshot,
  createDoc,
} from '../fixtures/consultation-plan-fixtures.js';

// =============================================================================
// 1. Full Audit Consultation Flow (Happy Path)
// =============================================================================

describe('Phase 4 Integration — Full Audit Flow', () => {

  it('should plan, read, and validate audit consultation', () => {
    const snapshot = makeMinimalSnapshot();

    // Step 1: Compute consultation plan for audit
    const plan = computeConsultationPlan({
      workflowId: 'audit',
      snapshot,
      detectedStack: [],
      issueTags: [],
      changedFiles: [],
      corpusVersion: '1.0.0',
    });

    assert.ok(plan.required.length >= 2, 'Audit should have >= 2 required docs');

    // Step 2: "Read" each required doc (simulate by looking up in snapshot)
    const readDocs = [];
    for (const entry of plan.required) {
      const doc = getDocumentById(snapshot, entry.docId);
      assert.ok(doc, `Doc ${entry.docId} should exist in snapshot`);
      assert.equal(doc.id, entry.docId);
      readDocs.push(doc);
    }

    // Step 3: Validate with all required consulted
    const validation = validateConsultationCoverage(
      plan,
      plan.required.map(e => e.docId),
    );

    assert.equal(validation.coverageStatus, 'pass');
    assert.equal(validation.requiredMissing.length, 0);
    assert.equal(validation.stats.requiredConsulted, plan.required.length);
  });

  it('should fail validation when required docs not consulted', () => {
    const snapshot = makeMinimalSnapshot();

    // Step 1: Plan
    const plan = computeConsultationPlan({
      workflowId: 'audit',
      snapshot,
      detectedStack: [],
      issueTags: [],
      changedFiles: [],
      corpusVersion: '1.0.0',
    });

    // Step 2: Consult only 1 of the required docs
    const partialConsulted = plan.required.slice(0, 1).map(e => e.docId);

    // Step 3: Validate
    const validation = validateConsultationCoverage(plan, partialConsulted);

    assert.equal(validation.coverageStatus, 'fail');
    assert.ok(validation.requiredMissing.length > 0);
    assert.ok(validation.stats.requiredConsulted < validation.stats.requiredTotal);
  });

  it('should include stack-specific docs and validate correctly', () => {
    const snapshot = makeMinimalSnapshot();

    // Step 1: Plan with django stack
    const plan = computeConsultationPlan({
      workflowId: 'audit',
      snapshot,
      detectedStack: ['django'],
      issueTags: [],
      changedFiles: [],
      corpusVersion: '1.0.0',
    });

    // Step 2: Assert django-security is included
    const allDocs = [...plan.required, ...plan.optional];
    assert.ok(allDocs.some(e => e.docId === 'django-security'),
      'django-security should be in plan when django stack detected');

    // Step 3: Validate with all docs consulted
    const allDocIds = allDocs.map(e => e.docId);
    const validation = validateConsultationCoverage(plan, allDocIds);
    assert.equal(validation.coverageStatus, 'pass');
  });

  it('should expand consultation via related docs', () => {
    const snapshot = makeMinimalSnapshot();

    // Step 1: Read a doc
    const doc = getDocumentById(snapshot, 'sql-injection-prevention');
    assert.ok(doc);

    // Step 2: Get related docs
    const related = getRelatedDocuments(snapshot, 'sql-injection-prevention');
    assert.ok(related.length > 0, 'sql-injection-prevention should have related docs');

    const relatedIds = related.map(d => d.id);
    assert.ok(relatedIds.includes('query-parameterization'));
    assert.ok(relatedIds.includes('input-validation'));

    // Step 3: Plan should include these as followups
    const plan = computeConsultationPlan({
      workflowId: 'audit',
      snapshot,
      detectedStack: [],
      issueTags: [],
      changedFiles: [],
      corpusVersion: '1.0.0',
    });

    const followupIds = plan.followup.map(e => e.docId);
    assert.ok(followupIds.includes('query-parameterization'));
    assert.ok(followupIds.includes('input-validation'));
  });
});

// =============================================================================
// 2. Signal-Driven Planning Flow
// =============================================================================

describe('Phase 4 Integration — Signal-Driven Planning', () => {

  it('should produce correct plan from extracted audit signals', () => {
    // Simulate audit workflow: extract signals → plan → validate
    const mapArtifact = { stacks: ['Django', 'Python'] };
    const findingsArtifact = { findings: [{ category: 'SQL Injection' }] };

    // Step 1: Extract signals
    const signals = extractAuditSignals(mapArtifact, findingsArtifact);
    assert.ok(signals.stacks.includes('django'));
    assert.ok(signals.issueTags.includes('sql-injection'));

    // Step 2: Compute plan using extracted signals
    const plan = computeConsultationPlan({
      workflowId: 'audit',
      snapshot: makeMinimalSnapshot(),
      detectedStack: signals.stacks,
      issueTags: signals.issueTags,
      changedFiles: signals.changedFiles,
      corpusVersion: '1.0.0',
    });

    // Step 3: Validate plan includes expected docs
    const allDocs = [...plan.required, ...plan.optional];
    assert.ok(allDocs.some(e => e.docId === 'django-security'),
      'django stack should pull in django-security');
    assert.ok(plan.required.some(e => e.docId === 'sql-injection-prevention'),
      'sql-injection should be required for audit');

    // Step 4: Validate coverage
    const consulted = allDocs.map(e => e.docId);
    const validation = validateConsultationCoverage(plan, consulted);
    assert.equal(validation.coverageStatus, 'pass');
  });

  it('should produce correct plan from security-review signals', () => {
    const changeScope = {
      stacks: ['Node.js'],
      findings: [{ category: 'XSS' }],
      changedFiles: ['src/views/home.jsx'],
    };

    const signals = extractSecurityReviewSignals(changeScope);
    assert.ok(signals.stacks.includes('nodejs'));
    assert.ok(signals.issueTags.includes('xss'));

    const plan = computeConsultationPlan({
      workflowId: 'security-review',
      snapshot: makeMinimalSnapshot(),
      detectedStack: signals.stacks,
      issueTags: signals.issueTags,
      changedFiles: signals.changedFiles,
      corpusVersion: '1.0.0',
    });

    assert.ok(plan.required.some(e => e.docId === 'sql-injection-prevention'));
  });

  it('should produce correct plan from verify signals', () => {
    const patchPlan = { issueTags: ['sql-injection'], stacks: ['Node.js'] };
    const applicationReport = { patchedFiles: ['src/db.js'] };

    const signals = extractVerifySignals(patchPlan, applicationReport);
    assert.ok(signals.stacks.includes('nodejs'));
    assert.deepEqual(signals.changedFiles, ['src/db.js']);

    const plan = computeConsultationPlan({
      workflowId: 'verify',
      snapshot: makeMinimalSnapshot(),
      detectedStack: signals.stacks,
      issueTags: signals.issueTags,
      changedFiles: signals.changedFiles,
      corpusVersion: '1.0.0',
    });

    assert.ok(plan.required.length === 0 || plan.optional.length > 0,
      'Verify should have docs from bindings');
  });
});

// =============================================================================
// 3. Cross-Component Consistency
// =============================================================================

describe('Phase 4 Integration — Cross-Component Consistency', () => {

  it('plan entries should resolve to valid docs in snapshot', () => {
    const snapshot = makeMinimalSnapshot();
    const plan = computeConsultationPlan({
      workflowId: 'audit',
      snapshot,
      detectedStack: ['django'],
      issueTags: ['csrf'],
      changedFiles: [],
      corpusVersion: '1.0.0',
    });

    // Every plan entry should resolve to an actual doc
    for (const entry of [...plan.required, ...plan.optional, ...plan.followup]) {
      const doc = getDocumentById(snapshot, entry.docId);
      assert.ok(doc, `Entry ${entry.docId} should resolve to a doc`);
      assert.equal(doc.id, entry.docId);
      assert.equal(doc.uri, entry.docUri);
    }
  });

  it('plan doc URIs should be consistent with snapshot URIs', () => {
    const snapshot = makeMinimalSnapshot();
    const plan = computeConsultationPlan({
      workflowId: 'audit',
      snapshot,
      detectedStack: [],
      issueTags: [],
      changedFiles: [],
      corpusVersion: '1.0.0',
    });

    for (const entry of [...plan.required, ...plan.optional, ...plan.followup]) {
      const docByUri = snapshot.byUri.get(entry.docUri);
      assert.ok(docByUri, `URI ${entry.docUri} should resolve`);
      assert.equal(docByUri.id, entry.docId);
    }
  });

  it('validation against same plan should be idempotent', () => {
    const snapshot = makeMinimalSnapshot();
    const plan = computeConsultationPlan({
      workflowId: 'audit',
      snapshot,
      detectedStack: [],
      issueTags: [],
      changedFiles: [],
      corpusVersion: '1.0.0',
    });

    const consulted = plan.required.map(e => e.docId);
    const result1 = validateConsultationCoverage(plan, consulted);
    const result2 = validateConsultationCoverage(plan, consulted);

    // Same inputs → same outputs (except timestamps)
    assert.equal(result1.coverageStatus, result2.coverageStatus);
    assert.deepEqual(result1.requiredMissing, result2.requiredMissing);
    assert.deepEqual(result1.optionalMissed, result2.optionalMissed);
    assert.deepEqual(result1.stats, result2.stats);
  });
});

// =============================================================================
// 4. Degraded Mode Handling
// =============================================================================

describe('Phase 4 Integration — Degraded Modes', () => {

  it('should handle empty snapshot gracefully across pipeline', () => {
    const snapshot = makeEmptySnapshot();

    const plan = computeConsultationPlan({
      workflowId: 'audit',
      snapshot,
      detectedStack: ['django'],
      issueTags: ['csrf'],
      changedFiles: [],
      corpusVersion: '1.0.0',
    });

    assert.equal(plan.required.length, 0);
    assert.equal(plan.optional.length, 0);
    assert.equal(plan.followup.length, 0);

    const validation = validateConsultationCoverage(plan, []);
    assert.equal(validation.coverageStatus, 'pass');
    assert.equal(validation.stats.requiredTotal, 0);
  });

  it('should handle snapshot with docs but no workflow bindings', () => {
    const docs = [
      createDoc({ id: 'lonely-doc', tags: ['test'], issueTypes: ['injection'] }),
    ];
    const snapshot = createLoadedSnapshot(docs);

    const plan = computeConsultationPlan({
      workflowId: 'audit',
      snapshot,
      detectedStack: [],
      issueTags: [],
      changedFiles: [],
      corpusVersion: '1.0.0',
    });

    assert.equal(plan.required.length, 0);
    assert.ok(plan.schemaVersion === 1);
  });

  it('should handle snapshot with docs matching via issue types', () => {
    const docs = [
      createDoc({
        id: 'issue-doc',
        issueTypes: ['sql-injection'],
        relatedDocIds: [],
      }),
    ];
    const snapshot = createLoadedSnapshot(docs);

    const plan = computeConsultationPlan({
      workflowId: 'audit',
      snapshot,
      detectedStack: [],
      issueTags: ['sql-injection'],
      changedFiles: [],
      corpusVersion: '1.0.0',
    });

    // Should match via issue tag
    const allDocs = [...plan.required, ...plan.optional];
    assert.ok(allDocs.some(e => e.docId === 'issue-doc'),
      'Should match doc via issue type');
  });

  it('should handle mixed valid and broken edges', () => {
    const docs = [
      createDoc({
        id: 'doc-a',
        workflowBindings: [{ workflowId: 'audit', priority: 'required' }],
        relatedDocIds: ['doc-b', 'nonexistent-doc'],
      }),
      createDoc({
        id: 'doc-b',
        relatedDocIds: [],
      }),
    ];
    const snapshot = createLoadedSnapshot(docs);

    assert.doesNotThrow(() => {
      const plan = computeConsultationPlan({
        workflowId: 'audit',
        snapshot,
        detectedStack: [],
        issueTags: [],
        changedFiles: [],
        corpusVersion: '1.0.0',
      });

      assert.ok(plan.required.some(e => e.docId === 'doc-a'));
    }, 'Should handle broken edges gracefully');
  });
});

// =============================================================================
// 5. Full Pipeline with All Signals Combined
// =============================================================================

describe('Phase 4 Integration — Combined Signal Pipeline', () => {

  it('should produce comprehensive plan with all signal types', () => {
    const snapshot = makeMinimalSnapshot();

    const plan = computeConsultationPlan({
      workflowId: 'audit',
      snapshot,
      detectedStack: ['django', 'nodejs'],
      issueTags: ['csrf', 'xss', 'sql-injection'],
      changedFiles: ['src/views.py', 'src/api.ts'],
      corpusVersion: '1.0.0',
    });

    // Workflow-binding entries
    assert.ok(plan.required.some(e => e.signalType === 'workflow-binding'));
    // Stack-binding entries
    assert.ok(
      [...plan.required, ...plan.optional].some(e => e.signalType === 'stack-binding'),
      'Should have stack-binding entries',
    );
    // Related-doc entries
    assert.ok(plan.followup.some(e => e.signalType === 'related-doc'));

    // Validate with full coverage
    const allDocIds = [...plan.required, ...plan.optional, ...plan.followup].map(e => e.docId);
    const validation = validateConsultationCoverage(plan, allDocIds);

    assert.equal(validation.coverageStatus, 'pass');
    assert.equal(validation.requiredMissing.length, 0);
    assert.equal(validation.stats.requiredConsulted, validation.stats.requiredTotal);
  });

  it('should produce consistent results across multiple invocations', () => {
    const snapshot = makeMinimalSnapshot();
    const input = {
      workflowId: 'audit',
      snapshot,
      detectedStack: ['django'],
      issueTags: ['csrf'],
      changedFiles: [],
      corpusVersion: '1.0.0',
    };

    const plans = Array.from({ length: 5 }, () => computeConsultationPlan(input));

    for (let i = 1; i < plans.length; i++) {
      assert.deepEqual(plans[i].required, plans[0].required, `Plan ${i} required differs`);
      assert.deepEqual(plans[i].optional, plans[0].optional, `Plan ${i} optional differs`);
      assert.deepEqual(plans[i].followup, plans[0].followup, `Plan ${i} followup differs`);
    }
  });
});
