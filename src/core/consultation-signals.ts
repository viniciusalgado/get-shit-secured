/**
 * Consultation Signal Extraction (Phase 4)
 *
 * Per-workflow signal extraction functions that produce ConsultationSignals
 * from parsed workflow artifact JSON objects. Each function is pure:
 * takes parsed JSON, returns ConsultationSignals.
 *
 * Signal contracts per workflow:
 * - map-codebase: none (produces signals, doesn't consume them)
 * - threat-model: artifact-driven (from map-codebase artifact)
 * - security-review: on-detection (from diff inspection)
 * - audit: on-detection (from findings as they emerge)
 * - validate-findings: artifact-driven (from findings artifact)
 * - plan-remediation: artifact-driven (from validated findings)
 * - execute-remediation: artifact-driven (from patch plan)
 * - verify: artifact-driven (from remediation target)
 * - report: none (reporting doesn't consult)
 */

import type { WorkflowId, ConsultationSignals } from './types.js';
import { normalizeStack } from './stack-normalizer.js';
import { classifyFindings } from './issue-taxonomy.js';

/**
 * Extract signals for the audit workflow.
 *
 * @param mapCodebaseArtifact - Parsed .gss/artifacts/map-codebase/*.json
 * @param findingsArtifact - Optional parsed findings for re-planning
 * @returns Consultation signals for audit
 */
export function extractAuditSignals(
  mapCodebaseArtifact: unknown,
  findingsArtifact?: unknown,
): ConsultationSignals {
  const mapArtifact = mapCodebaseArtifact as Record<string, unknown> | null;
  const findings = findingsArtifact as Record<string, unknown> | null;

  // Stacks from map-codebase artifact
  const stacks = extractStacksFromArtifact(mapArtifact);

  // Issue tags from findings (if re-planning)
  const issueTags = extractIssueTagsFromFindings(findings);

  return {
    issueTags,
    stacks,
    changedFiles: [], // Full codebase audit, no specific changed files
  };
}

/**
 * Extract signals for the security-review workflow.
 *
 * @param changeScope - Parsed .gss/artifacts/security-review/change-scope.json
 * @returns Consultation signals for security-review
 */
export function extractSecurityReviewSignals(
  changeScope: unknown,
): ConsultationSignals {
  const scope = changeScope as Record<string, unknown> | null;

  const stacks = extractStacksFromArtifact(scope);
  const issueTags = extractIssueTagsFromFindings(scope);
  const changedFiles = extractChangedFiles(scope);

  return { issueTags, stacks, changedFiles };
}

/**
 * Extract signals for the verify workflow.
 *
 * @param patchPlan - Parsed .gss/artifacts/plan-remediation/*.json
 * @param applicationReport - Parsed .gss/artifacts/execute-remediation/*.json
 * @returns Consultation signals for verify
 */
export function extractVerifySignals(
  patchPlan: unknown,
  applicationReport?: unknown,
): ConsultationSignals {
  const plan = patchPlan as Record<string, unknown> | null;
  const report = applicationReport as Record<string, unknown> | null;

  // Issue tags from the patch plan
  const issueTags = extractIssueTagsFromFindings(plan);

  // Stacks from report or plan
  const reportStacks = extractStacksFromArtifact(report);
  const stacks = reportStacks.length > 0
    ? reportStacks
    : extractStacksFromArtifact(plan);

  // Changed files from the application report
  const changedFiles = report
    ? extractChangedFiles(report)
    : plan
      ? extractChangedFiles(plan)
      : [];

  return { issueTags, stacks, changedFiles };
}

/**
 * Extract signals for the threat-model workflow.
 *
 * @param mapCodebaseArtifact - Parsed .gss/artifacts/map-codebase/*.json
 * @returns Consultation signals for threat-model
 */
export function extractThreatModelSignals(
  mapCodebaseArtifact: unknown,
): ConsultationSignals {
  const mapArtifact = mapCodebaseArtifact as Record<string, unknown> | null;

  const stacks = extractStacksFromArtifact(mapArtifact);

  return {
    issueTags: [], // Threat modeling doesn't start from issue tags
    stacks,
    changedFiles: [],
  };
}

/**
 * Extract signals for the validate-findings workflow.
 *
 * @param findingsArtifact - Parsed findings artifact
 * @param mapCodebaseArtifact - Parsed map-codebase artifact
 * @returns Consultation signals for validate-findings
 */
export function extractValidateFindingsSignals(
  findingsArtifact: unknown,
  mapCodebaseArtifact?: unknown,
): ConsultationSignals {
  const findings = findingsArtifact as Record<string, unknown> | null;
  const mapArtifact = mapCodebaseArtifact as Record<string, unknown> | null;

  const issueTags = extractIssueTagsFromFindings(findings);
  const stacks = extractStacksFromArtifact(mapArtifact);

  return { issueTags, stacks, changedFiles: [] };
}

/**
 * Extract signals for the plan-remediation workflow.
 *
 * @param validatedFindings - Parsed validated findings artifact
 * @param mapCodebaseArtifact - Parsed map-codebase artifact
 * @returns Consultation signals for plan-remediation
 */
export function extractPlanRemediationSignals(
  validatedFindings: unknown,
  mapCodebaseArtifact?: unknown,
): ConsultationSignals {
  const findings = validatedFindings as Record<string, unknown> | null;
  const mapArtifact = mapCodebaseArtifact as Record<string, unknown> | null;

  const issueTags = extractIssueTagsFromFindings(findings);
  const stacks = extractStacksFromArtifact(mapArtifact);
  const changedFiles = extractChangedFiles(findings);

  return { issueTags, stacks, changedFiles };
}

/**
 * Extract signals for the execute-remediation workflow.
 *
 * @param patchPlan - Parsed patch plan artifact
 * @param mapCodebaseArtifact - Parsed map-codebase artifact
 * @returns Consultation signals for execute-remediation
 */
export function extractExecuteRemediationSignals(
  patchPlan: unknown,
  mapCodebaseArtifact?: unknown,
): ConsultationSignals {
  const plan = patchPlan as Record<string, unknown> | null;
  const mapArtifact = mapCodebaseArtifact as Record<string, unknown> | null;

  const issueTags = extractIssueTagsFromFindings(plan);
  const mapStacks = extractStacksFromArtifact(mapArtifact);
  const stacks = mapStacks.length > 0
    ? mapStacks
    : extractStacksFromArtifact(plan);
  const changedFiles = extractChangedFiles(plan);

  return { issueTags, stacks, changedFiles };
}

/**
 * Generic fallback for workflows that don't consult (map-codebase, report).
 * Returns empty signals.
 *
 * @param _workflowId - Workflow identifier (unused, for API consistency)
 * @returns Empty consultation signals
 */
export function extractDefaultSignals(
  _workflowId: WorkflowId,
): ConsultationSignals {
  return {
    issueTags: [],
    stacks: [],
    changedFiles: [],
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Extract stack tags from an artifact object.
 * Looks for common field names: 'stacks', 'stack', 'technologies', 'languages'.
 */
function extractStacksFromArtifact(
  artifact: Record<string, unknown> | null | undefined,
): string[] {
  if (!artifact) return [];

  const rawStacks: string[] = [];

  // Try common field names
  const stackFields = ['stacks', 'stack', 'technologies', 'languages', 'frameworks'];
  for (const field of stackFields) {
    const value = artifact[field];
    if (Array.isArray(value)) {
      rawStacks.push(...value.map(String));
    } else if (typeof value === 'string') {
      rawStacks.push(value);
    }
  }

  return normalizeStack(rawStacks).canonical;
}

/**
 * Extract issue tags from a findings artifact.
 * Looks for 'findings' array and classifies categories.
 */
function extractIssueTagsFromFindings(
  artifact: Record<string, unknown> | null | undefined,
): string[] {
  if (!artifact) return [];

  const categories: string[] = [];

  // Try to extract from findings array
  const findings = artifact['findings'];
  if (Array.isArray(findings)) {
    for (const finding of findings) {
      const f = finding as Record<string, unknown>;
      if (typeof f['category'] === 'string') categories.push(f['category']);
      if (typeof f['type'] === 'string') categories.push(f['type']);
      if (typeof f['vulnerabilityType'] === 'string') categories.push(f['vulnerabilityType']);
    }
  }

  // Try to extract from top-level issue tags
  const tags = artifact['issueTags'];
  if (Array.isArray(tags)) {
    categories.push(...tags.map(String));
  }

  // Try to extract from categories field
  const cats = artifact['categories'];
  if (Array.isArray(cats)) {
    categories.push(...cats.map(String));
  }

  if (categories.length === 0) return [];
  return classifyFindings(categories).tags;
}

/**
 * Extract changed file paths from an artifact.
 * Looks for 'changedFiles', 'files', 'targetFiles'.
 */
function extractChangedFiles(
  artifact: Record<string, unknown> | null | undefined,
): string[] {
  if (!artifact) return [];

  const fileFields = ['changedFiles', 'files', 'targetFiles', 'patchedFiles'];
  for (const field of fileFields) {
    const value = artifact[field];
    if (Array.isArray(value)) {
      return value.map(String);
    }
  }

  return [];
}
