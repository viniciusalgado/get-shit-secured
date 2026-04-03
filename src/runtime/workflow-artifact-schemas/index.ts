/**
 * Workflow Artifact Schema Registry (Phase 14)
 *
 * Central dispatch for per-workflow artifact validators.
 * Re-exports all validators and provides a dispatch function.
 */

import type { WorkflowId } from '../../core/types.js';
import type { ValidationResult, ArtifactValidatorFn } from './types.js';

// Workflow-specific validators
import {
  validateSecurityReviewChangeScope,
  validateSecurityReviewFindings,
  validateSecurityReviewDelegationPlan,
  validateSecurityReviewValidationReport,
  validateSecurityReviewTestSpecs,
} from './security-review.js';

import {
  validateMapCodebaseInventory,
  validateMapCodebaseTrustBoundaries,
  validateMapCodebaseDependencies,
  validateMapCodebaseDataFlows,
} from './map-codebase.js';

import {
  validateThreatModelThreatRegister,
  validateThreatModelRiskAssessment,
  validateThreatModelAbuseCases,
  validateThreatModelMitigationRequirements,
} from './threat-model.js';

import {
  validateAuditFindingsReport,
  validateAuditOwaspMapping,
  validateAuditEvidence,
  validateAuditPriorities,
} from './audit.js';

import {
  validateValidateFindingsReport,
  validateValidateFindingsReEvaluation,
  validateValidatedFindings,
  validateTddTestDocument,
} from './validate-findings.js';

import {
  validatePlanRemediationPatchPlan,
  validatePlanRemediationGuide,
  validatePlanRemediationTestSpecs,
  validatePlanRemediationRollbackPlan,
} from './plan-remediation.js';

import {
  validateExecuteRemediationAppReport,
  validateExecuteRemediationChangeSummary,
  validateExecuteRemediationDeviations,
} from './execute-remediation.js';

import {
  validateVerifyReport,
  validateVerifyRegressionAnalysis,
  validateVerifyTestCoverage,
  validateVerifyResidualRisk,
} from './verify.js';

import {
  validateReportExecutiveSummary,
  validateReportTechnicalFindings,
  validateReportOwaspCompliance,
  validateReportRemediationRoadmap,
} from './report.js';

/**
 * Internal registry mapping (workflowId, artifactName) to validator function.
 */
const VALIDATOR_REGISTRY: Map<string, ArtifactValidatorFn> = new Map();

function registerValidator(workflowId: string, artifactName: string, fn: ArtifactValidatorFn): void {
  VALIDATOR_REGISTRY.set(`${workflowId}::${artifactName}`, fn);
}

// security-review
registerValidator('security-review', 'change-scope', validateSecurityReviewChangeScope);
registerValidator('security-review', 'findings', validateSecurityReviewFindings);
registerValidator('security-review', 'delegation-plan', validateSecurityReviewDelegationPlan);
registerValidator('security-review', 'validation-report', validateSecurityReviewValidationReport);
registerValidator('security-review', 'security-test-specs', validateSecurityReviewTestSpecs);

// map-codebase
registerValidator('map-codebase', 'codebase-inventory', validateMapCodebaseInventory);
registerValidator('map-codebase', 'trust-boundary-map', validateMapCodebaseTrustBoundaries);
registerValidator('map-codebase', 'dependency-map', validateMapCodebaseDependencies);
registerValidator('map-codebase', 'data-flow-map', validateMapCodebaseDataFlows);

// threat-model
registerValidator('threat-model', 'threat-register', validateThreatModelThreatRegister);
registerValidator('threat-model', 'risk-assessment', validateThreatModelRiskAssessment);
registerValidator('threat-model', 'abuse-cases', validateThreatModelAbuseCases);
registerValidator('threat-model', 'mitigation-requirements', validateThreatModelMitigationRequirements);

// audit
registerValidator('audit', 'findings-report', validateAuditFindingsReport);
registerValidator('audit', 'owasp-mapping', validateAuditOwaspMapping);
registerValidator('audit', 'evidence-artifacts', validateAuditEvidence);
registerValidator('audit', 'remediation-priorities', validateAuditPriorities);

// validate-findings
registerValidator('validate-findings', 'validation-report', validateValidateFindingsReport);
registerValidator('validate-findings', 're-evaluation-report', validateValidateFindingsReEvaluation);
registerValidator('validate-findings', 'validated-findings', validateValidatedFindings);
registerValidator('validate-findings', 'tdd-test-document', validateTddTestDocument);

// plan-remediation
registerValidator('plan-remediation', 'patch-plan', validatePlanRemediationPatchPlan);
registerValidator('plan-remediation', 'implementation-guide', validatePlanRemediationGuide);
registerValidator('plan-remediation', 'test-specifications', validatePlanRemediationTestSpecs);
registerValidator('plan-remediation', 'rollback-plan', validatePlanRemediationRollbackPlan);

// execute-remediation
registerValidator('execute-remediation', 'application-report', validateExecuteRemediationAppReport);
registerValidator('execute-remediation', 'change-summary', validateExecuteRemediationChangeSummary);
registerValidator('execute-remediation', 'deviations-log', validateExecuteRemediationDeviations);

// verify
registerValidator('verify', 'verification-report', validateVerifyReport);
registerValidator('verify', 'regression-analysis', validateVerifyRegressionAnalysis);
registerValidator('verify', 'test-coverage-report', validateVerifyTestCoverage);
registerValidator('verify', 'residual-risk-assessment', validateVerifyResidualRisk);

// report
registerValidator('report', 'executive-summary', validateReportExecutiveSummary);
registerValidator('report', 'technical-findings', validateReportTechnicalFindings);
registerValidator('report', 'owasp-compliance', validateReportOwaspCompliance);
registerValidator('report', 'remediation-roadmap', validateReportRemediationRoadmap);

/**
 * Validate a workflow artifact using the registered per-workflow schema validator.
 *
 * @param workflowId - Workflow that produced the artifact
 * @param artifactName - Artifact name (matching definition.outputs[].name)
 * @param artifact - Artifact data to validate
 * @returns Validation result with errors if invalid
 */
export function validateWorkflowArtifact(
  workflowId: WorkflowId,
  artifactName: string,
  artifact: unknown,
): ValidationResult {
  const key = `${workflowId}::${artifactName}`;
  const validator = VALIDATOR_REGISTRY.get(key);
  if (!validator) {
    return { valid: false, errors: [`No validator registered for ${key}`] };
  }
  return validator(artifact);
}

/**
 * Get all registered validator keys.
 */
export function getRegisteredValidators(): string[] {
  return [...VALIDATOR_REGISTRY.keys()];
}
