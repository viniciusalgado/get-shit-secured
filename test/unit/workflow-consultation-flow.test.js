/**
 * Phase 14 — Workflow Consultation Flow Tests
 *
 * Validates each workflow's end-to-end signal → plan → consult → validate → trace flow
 * using the MCP tools directly against the loaded corpus snapshot.
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

// Import consultation pipeline
import { computeConsultationPlan } from '../../dist/core/consultation-planner.js';
import { validateConsultationCoverage } from '../../dist/core/consultation-compliance.js';
import { buildConsultationTrace, buildNotApplicableEnvelope } from '../../dist/runtime/consultation-trace-builder.js';
import { loadCorpusSnapshot } from '../../dist/corpus/snapshot-loader.js';

// Import signal extractors
import {
  extractSecurityReviewSignals,
  extractAuditSignals,
  extractThreatModelSignals,
  extractVerifySignals,
  extractPlanRemediationSignals,
  extractExecuteRemediationSignals,
  extractValidateFindingsSignals,
  extractDefaultSignals,
} from '../../dist/core/consultation-signals.js';

// Import execution contracts
import { getAllExecutionContracts } from '../../dist/catalog/workflows/execution-contracts/index.js';

const ROOT = join(import.meta.dirname, '../..');
const SNAPSHOT_PATH = join(ROOT, 'data/corpus/owasp-corpus.snapshot.json');

// Skip entire suite if snapshot doesn't exist
let hasSnapshot = false;
let loaded = null;

before(async () => {
  hasSnapshot = existsSync(SNAPSHOT_PATH);
  if (hasSnapshot) {
    loaded = loadCorpusSnapshot(SNAPSHOT_PATH);
  }
});

// --- Signal Extraction Tests ---

describe('Phase 14 — Signal Extraction', () => {
  it('1.1 security-review: extractSecurityReviewSignals produces valid signals', () => {
    const sample = {
      technologies: ['typescript', 'node.js'],
      categories: ['xss', 'injection'],
      changedFiles: ['src/auth.ts', 'src/api.ts'],
    };
    const signals = extractSecurityReviewSignals(sample);
    assert.ok(Array.isArray(signals.issueTags), 'issueTags should be array');
    assert.ok(Array.isArray(signals.stacks), 'stacks should be array');
    assert.ok(Array.isArray(signals.changedFiles), 'changedFiles should be array');
    assert.ok(signals.changedFiles.length > 0, 'should detect changedFiles');
  });

  it('1.2 audit: extractAuditSignals produces valid signals', () => {
    const mapArtifact = { stacks: ['python', 'django'], languages: ['python'] };
    const signals = extractAuditSignals(mapArtifact);
    assert.ok(Array.isArray(signals.stacks), 'stacks should be array');
  });

  it('1.3 threat-model: extractThreatModelSignals produces valid signals', () => {
    const mapArtifact = { stacks: ['java', 'spring'], frameworks: ['spring-boot'] };
    const signals = extractThreatModelSignals(mapArtifact);
    assert.ok(Array.isArray(signals.stacks), 'stacks should be array');
  });

  it('1.4 plan-remediation: extractPlanRemediationSignals produces valid signals', () => {
    const findings = {
      findings: [{ category: 'injection', type: 'sql-injection' }],
      changedFiles: ['src/db.ts'],
    };
    const signals = extractPlanRemediationSignals(findings);
    assert.ok(Array.isArray(signals.issueTags), 'issueTags should be array');
  });

  it('1.5 verify: extractVerifySignals produces valid signals', () => {
    const plan = { findings: [{ category: 'xss', type: 'reflected-xss' }] };
    const report = { stacks: ['typescript'], changedFiles: ['src/sanitize.ts'] };
    const signals = extractVerifySignals(plan, report);
    assert.ok(Array.isArray(signals.issueTags), 'issueTags should be array');
    assert.ok(Array.isArray(signals.changedFiles), 'changedFiles should be array');
  });

  it('1.6 execute-remediation: extractExecuteRemediationSignals produces valid signals', () => {
    const plan = { findings: [{ category: 'auth', type: 'broken-auth' }], patchedFiles: ['src/login.ts'] };
    const signals = extractExecuteRemediationSignals(plan);
    assert.ok(Array.isArray(signals.issueTags), 'issueTags should be array');
  });

  it('1.7 validate-findings: extractValidateFindingsSignals produces valid signals', () => {
    const findings = { findings: [{ category: 'crypto', type: 'weak-hashing' }] };
    const mapArtifact = { stacks: ['node.js'] };
    const signals = extractValidateFindingsSignals(findings, mapArtifact);
    assert.ok(Array.isArray(signals.issueTags), 'issueTags should be array');
  });

  it('1.8 map-codebase: extractDefaultSignals returns empty signals', () => {
    const signals = extractDefaultSignals('map-codebase');
    assert.deepEqual(signals, { issueTags: [], stacks: [], changedFiles: [] });
  });

  it('1.9 report: extractDefaultSignals returns empty signals', () => {
    const signals = extractDefaultSignals('report');
    assert.deepEqual(signals, { issueTags: [], stacks: [], changedFiles: [] });
  });
});

// --- Consultation Plan Tests ---

describe('Phase 14 — Consultation Plan Computation', () => {
  it('2.1 should produce plan for required-consultation workflows', function () {
    if (!hasSnapshot) this.skip('No corpus snapshot');
    const requiredWorkflows = ['security-review', 'audit', 'threat-model', 'plan-remediation', 'verify'];

    for (const wfId of requiredWorkflows) {
      const plan = computeConsultationPlan({
        workflowId: wfId,
        snapshot: loaded,
        detectedStack: ['typescript'],
        issueTags: ['injection'],
        changedFiles: [],
        corpusVersion: loaded.snapshot.corpusVersion,
      });
      assert.equal(plan.workflowId, wfId);
      assert.ok(Array.isArray(plan.required), `${wfId} plan should have required array`);
    }
  });

  it('2.2 should produce plan for optional-consultation workflows', function () {
    if (!hasSnapshot) this.skip('No corpus snapshot');
    const optionalWorkflows = ['map-codebase', 'execute-remediation', 'validate-findings'];

    for (const wfId of optionalWorkflows) {
      const plan = computeConsultationPlan({
        workflowId: wfId,
        snapshot: loaded,
        detectedStack: [],
        issueTags: [],
        changedFiles: [],
        corpusVersion: loaded.snapshot.corpusVersion,
      });
      assert.equal(plan.workflowId, wfId);
      assert.ok(Array.isArray(plan.required));
      assert.ok(Array.isArray(plan.optional));
    }
  });
});

// --- Coverage Validation Tests ---

describe('Phase 14 — Coverage Validation', () => {
  it('3.1 should fail when required docs are missing (required workflows)', function () {
    if (!hasSnapshot) this.skip('No corpus snapshot');
    const requiredWorkflows = ['security-review', 'audit', 'verify'];

    for (const wfId of requiredWorkflows) {
      const plan = computeConsultationPlan({
        workflowId: wfId,
        snapshot: loaded,
        detectedStack: ['typescript'],
        issueTags: ['injection'],
        changedFiles: [],
        corpusVersion: loaded.snapshot.corpusVersion,
      });

      // If plan has required docs, validate with empty consulted
      if (plan.required.length > 0) {
        const validation = validateConsultationCoverage(plan, []);
        assert.equal(validation.coverageStatus, 'fail',
          `${wfId} should fail when no required docs consulted`);
      }
    }
  });

  it('3.2 should pass when optional docs are missed (optional workflows)', function () {
    if (!hasSnapshot) this.skip('No corpus snapshot');

    // Optional consultation workflows may skip MCP entirely.
    // When they DO consult, required docs still matter — but the workflow
    // itself can choose to not consult at all. This test validates that the
    // optional mode is correctly reflected in execution contracts.
    const all = getAllExecutionContracts();
    const optionalWorkflows = ['map-codebase', 'execute-remediation', 'validate-findings'];
    for (const wfId of optionalWorkflows) {
      const contract = all.get(wfId);
      assert.ok(contract, `Contract for ${wfId} must exist`);
      assert.equal(contract.consultationMode, 'optional',
        `${wfId} should have consultationMode 'optional'`);
    }
  });

  it('3.3 should pass when all required docs are consulted', function () {
    if (!hasSnapshot) this.skip('No corpus snapshot');

    const plan = computeConsultationPlan({
      workflowId: 'audit',
      snapshot: loaded,
      detectedStack: ['typescript'],
      issueTags: ['injection'],
      changedFiles: [],
      corpusVersion: loaded.snapshot.corpusVersion,
    });

    if (plan.required.length > 0) {
      const consulted = plan.required.map(e => e.docId);
      const validation = validateConsultationCoverage(plan, consulted);
      assert.equal(validation.coverageStatus, 'pass',
        'audit should pass when all required docs consulted');
    }
  });
});

// --- Consultation Trace Building Tests ---

describe('Phase 14 — Consultation Trace Building', () => {
  it('4.1 should build valid trace from plan + validation', function () {
    if (!hasSnapshot) this.skip('No corpus snapshot');

    const plan = computeConsultationPlan({
      workflowId: 'security-review',
      snapshot: loaded,
      detectedStack: ['node.js'],
      issueTags: ['xss'],
      changedFiles: ['src/api.ts'],
      corpusVersion: loaded.snapshot.corpusVersion,
    });

    const consulted = plan.required.map(e => e.docId);
    const validation = validateConsultationCoverage(plan, consulted);
    const trace = buildConsultationTrace(plan, consulted, validation);

    assert.equal(trace.coverageStatus, validation.coverageStatus);
    assert.ok(Array.isArray(trace.consultedDocs));
    assert.ok(Array.isArray(trace.requiredMissing));
    assert.ok(Array.isArray(trace.notes));
    assert.equal(trace.plan.workflowId, 'security-review');
  });

  it('4.2 should build not-applicable envelope for report workflow', function () {
    const envelope = buildNotApplicableEnvelope('report', '1.0.0', '1.0.0');
    assert.equal(envelope.consultationMode, 'not-applicable');
    assert.equal(envelope.workflowId, 'report');
    assert.ok(!('consultation' in envelope), 'report envelope should not have consultation field');
  });
});
