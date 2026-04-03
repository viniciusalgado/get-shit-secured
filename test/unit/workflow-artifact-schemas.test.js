/**
 * Phase 14 — Workflow Artifact Schema Tests
 *
 * Validates:
 * - Valid artifacts pass validation
 * - Invalid payloads fail validation
 * - Missing consultation trace fails when required
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateSecurityReviewChangeScope,
  validateSecurityReviewFindings,
  validateSecurityReviewDelegationPlan,
  validateSecurityReviewValidationReport,
  validateSecurityReviewTestSpecs,
} from '../../dist/runtime/workflow-artifact-schemas/security-review.js';

import {
  validateMapCodebaseInventory,
  validateMapCodebaseTrustBoundaries,
  validateMapCodebaseDependencies,
  validateMapCodebaseDataFlows,
} from '../../dist/runtime/workflow-artifact-schemas/map-codebase.js';

import {
  validateThreatModelThreatRegister,
  validateThreatModelRiskAssessment,
  validateThreatModelAbuseCases,
  validateThreatModelMitigationRequirements,
} from '../../dist/runtime/workflow-artifact-schemas/threat-model.js';

import {
  validateAuditFindingsReport,
  validateAuditOwaspMapping,
  validateAuditEvidence,
  validateAuditPriorities,
} from '../../dist/runtime/workflow-artifact-schemas/audit.js';

import {
  validateValidateFindingsReport,
  validateValidatedFindings,
  validateTddTestDocument,
} from '../../dist/runtime/workflow-artifact-schemas/validate-findings.js';

import {
  validatePlanRemediationPatchPlan,
  validatePlanRemediationGuide,
  validatePlanRemediationTestSpecs,
  validatePlanRemediationRollbackPlan,
} from '../../dist/runtime/workflow-artifact-schemas/plan-remediation.js';

import {
  validateExecuteRemediationAppReport,
  validateExecuteRemediationChangeSummary,
  validateExecuteRemediationDeviations,
} from '../../dist/runtime/workflow-artifact-schemas/execute-remediation.js';

import {
  validateVerifyReport,
  validateVerifyRegressionAnalysis,
  validateVerifyTestCoverage,
  validateVerifyResidualRisk,
} from '../../dist/runtime/workflow-artifact-schemas/verify.js';

import {
  validateReportExecutiveSummary,
  validateReportTechnicalFindings,
  validateReportOwaspCompliance,
  validateReportRemediationRoadmap,
} from '../../dist/runtime/workflow-artifact-schemas/report.js';

import {
  validateWorkflowArtifact,
  getRegisteredValidators,
} from '../../dist/runtime/workflow-artifact-schemas/index.js';

// --- Helper to make valid envelope ---

function makeEnvelope(workflowId, consultationMode, extras = {}) {
  return {
    schemaVersion: 1,
    workflowId,
    gssVersion: '0.1.0',
    corpusVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    consultationMode,
    ...extras,
  };
}

function makeRequiredEnvelope(workflowId, extras = {}) {
  return makeEnvelope(workflowId, 'required', {
    consultation: {
      plan: { workflowId, generatedAt: new Date().toISOString(), corpusVersion: '1.0.0', requiredCount: 1, optionalCount: 0, followupCount: 0 },
      consultedDocs: [{ id: 'test-doc', title: 'Test', sourceUrl: 'https://example.com' }],
      coverageStatus: 'pass',
      requiredMissing: [],
      notes: [],
    },
    ...extras,
  });
}

// ===========================================================
// Per-workflow tests
// ===========================================================

// --- security-review (required) ---

describe('Phase 14 — Artifact Schema: security-review', () => {
  it('valid change-scope passes', () => {
    const artifact = makeRequiredEnvelope('security-review', { changedFiles: ['src/a.ts'] });
    const result = validateSecurityReviewChangeScope(artifact);
    assert.ok(result.valid, result.errors.join(', '));
  });

  it('invalid change-scope (missing changedFiles) fails', () => {
    const artifact = makeRequiredEnvelope('security-review', {});
    const result = validateSecurityReviewChangeScope(artifact);
    assert.ok(!result.valid);
  });

  it('missing consultation trace fails', () => {
    const artifact = makeEnvelope('security-review', 'required', { changedFiles: ['src/a.ts'] });
    const result = validateSecurityReviewChangeScope(artifact);
    assert.ok(!result.valid);
  });
});

// --- map-codebase (optional) ---

describe('Phase 14 — Artifact Schema: map-codebase', () => {
  it('valid inventory passes', () => {
    const artifact = makeEnvelope('map-codebase', 'optional', { components: [] });
    const result = validateMapCodebaseInventory(artifact);
    assert.ok(result.valid, result.errors.join(', '));
  });

  it('invalid inventory (missing components) fails', () => {
    const artifact = makeEnvelope('map-codebase', 'optional', {});
    const result = validateMapCodebaseInventory(artifact);
    assert.ok(!result.valid);
  });

  it('no consultation trace is acceptable (optional mode)', () => {
    const artifact = makeEnvelope('map-codebase', 'optional', { components: [] });
    const result = validateMapCodebaseInventory(artifact);
    assert.ok(result.valid);
  });
});

// --- threat-model (required) ---

describe('Phase 14 — Artifact Schema: threat-model', () => {
  it('valid threat-register passes', () => {
    const artifact = makeRequiredEnvelope('threat-model', { threats: [] });
    const result = validateThreatModelThreatRegister(artifact);
    assert.ok(result.valid, result.errors.join(', '));
  });

  it('invalid threat-register (missing threats) fails', () => {
    const artifact = makeRequiredEnvelope('threat-model', {});
    const result = validateThreatModelThreatRegister(artifact);
    assert.ok(!result.valid);
  });

  it('missing consultation trace fails', () => {
    const artifact = makeEnvelope('threat-model', 'required', { threats: [] });
    const result = validateThreatModelThreatRegister(artifact);
    assert.ok(!result.valid);
  });
});

// --- audit (required) ---

describe('Phase 14 — Artifact Schema: audit', () => {
  it('valid findings-report passes', () => {
    const artifact = makeRequiredEnvelope('audit', { findings: [] });
    const result = validateAuditFindingsReport(artifact);
    assert.ok(result.valid, result.errors.join(', '));
  });

  it('invalid findings-report (missing findings) fails', () => {
    const artifact = makeRequiredEnvelope('audit', {});
    const result = validateAuditFindingsReport(artifact);
    assert.ok(!result.valid);
  });
});

// --- validate-findings (optional) ---

describe('Phase 14 — Artifact Schema: validate-findings', () => {
  it('valid report passes', () => {
    const artifact = makeEnvelope('validate-findings', 'optional', { findings: [] });
    const result = validateValidateFindingsReport(artifact);
    assert.ok(result.valid, result.errors.join(', '));
  });

  it('invalid report (missing findings) fails', () => {
    const artifact = makeEnvelope('validate-findings', 'optional', {});
    const result = validateValidateFindingsReport(artifact);
    assert.ok(!result.valid);
  });
});

// --- plan-remediation (required) ---

describe('Phase 14 — Artifact Schema: plan-remediation', () => {
  it('valid patch-plan passes', () => {
    const artifact = makeRequiredEnvelope('plan-remediation', { patches: [] });
    const result = validatePlanRemediationPatchPlan(artifact);
    assert.ok(result.valid, result.errors.join(', '));
  });

  it('invalid patch-plan (missing patches) fails', () => {
    const artifact = makeRequiredEnvelope('plan-remediation', {});
    const result = validatePlanRemediationPatchPlan(artifact);
    assert.ok(!result.valid);
  });
});

// --- execute-remediation (optional) ---

describe('Phase 14 — Artifact Schema: execute-remediation', () => {
  it('valid app-report passes', () => {
    const artifact = makeEnvelope('execute-remediation', 'optional', { applied: [] });
    const result = validateExecuteRemediationAppReport(artifact);
    assert.ok(result.valid, result.errors.join(', '));
  });

  it('invalid app-report (missing applied) fails', () => {
    const artifact = makeEnvelope('execute-remediation', 'optional', {});
    const result = validateExecuteRemediationAppReport(artifact);
    assert.ok(!result.valid);
  });
});

// --- verify (required) ---

describe('Phase 14 — Artifact Schema: verify', () => {
  it('valid verification-report passes', () => {
    const artifact = makeRequiredEnvelope('verify', { verifications: [] });
    const result = validateVerifyReport(artifact);
    assert.ok(result.valid, result.errors.join(', '));
  });

  it('invalid verification-report (missing verifications) fails', () => {
    const artifact = makeRequiredEnvelope('verify', {});
    const result = validateVerifyReport(artifact);
    assert.ok(!result.valid);
  });
});

// --- report (not-applicable) ---

describe('Phase 14 — Artifact Schema: report', () => {
  it('valid executive-summary passes', () => {
    const artifact = makeEnvelope('report', 'not-applicable', {});
    const result = validateReportExecutiveSummary(artifact);
    assert.ok(result.valid, result.errors.join(', '));
  });

  it('no consultation needed for report', () => {
    const artifact = makeEnvelope('report', 'not-applicable', {});
    const result = validateReportExecutiveSummary(artifact);
    assert.ok(result.valid);
  });
});

// --- Dispatch function tests ---

describe('Phase 14 — Artifact Schema Dispatch', () => {
  it('should have registered validators for key artifacts', () => {
    const keys = getRegisteredValidators();
    assert.ok(keys.length >= 20, `Expected at least 20 validators, got ${keys.length}`);
  });

  it('should validate via dispatch function', () => {
    const artifact = makeRequiredEnvelope('security-review', { changedFiles: ['a.ts'] });
    const result = validateWorkflowArtifact('security-review', 'change-scope', artifact);
    assert.ok(result.valid, result.errors.join(', '));
  });

  it('should return error for unknown validator', () => {
    const result = validateWorkflowArtifact('nonexistent', 'foo', {});
    assert.ok(!result.valid);
  });
});
