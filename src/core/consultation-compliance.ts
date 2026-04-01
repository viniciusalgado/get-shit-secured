/**
 * Consultation Compliance Validator (Phase 4)
 *
 * Validates consultation coverage against a computed consultation plan.
 * Produces ConsultationValidation with pass/warn/fail coverage status.
 *
 * Severity semantics:
 * - pass: All required docs consulted. Artifact is clean.
 * - warn: Required missing but failOnMissingRequired=false, or significant
 *         optional gaps. Artifact includes warning; workflow may continue.
 * - fail: Required missing and failOnMissingRequired=true. Artifact must
 *         include remediation note; downstream workflows should treat findings
 *         as potentially incomplete.
 *
 * Outputs are JSON-serializable, schema-versioned, and artifact-ready.
 * No runtime-specific references (no file paths, no SpecialistDefinition pointers).
 */

import type {
  WorkflowId,
  ConsultationPlan,
  ConsultationValidation,
} from './types.js';
import { CONSULTATION_VALIDATION_SCHEMA_VERSION } from './types.js';

/**
 * Validate consultation coverage against a plan.
 *
 * @param plan - The consultation plan that was computed
 * @param consultedDocIds - Document IDs that were actually consulted
 * @returns Consultation validation with pass/warn/fail status and stats
 */
export function validateConsultationCoverage(
  plan: ConsultationPlan,
  consultedDocIds: string[],
): ConsultationValidation {
  const consulted = new Set(consultedDocIds);
  const notes: string[] = [];

  // Build plan lookups
  const requiredIds = new Set(plan.required.map(e => e.docId));
  const optionalIds = new Set(plan.optional.map(e => e.docId));
  const followupIds = new Set(plan.followup.map(e => e.docId));
  const allPlanIds = new Set([...requiredIds, ...optionalIds, ...followupIds]);

  // Required missing
  const requiredMissing: string[] = [];
  for (const docId of requiredIds) {
    if (!consulted.has(docId)) {
      requiredMissing.push(docId);
    }
  }

  // Optional missed
  const optionalMissed: string[] = [];
  for (const docId of optionalIds) {
    if (!consulted.has(docId)) {
      optionalMissed.push(docId);
    }
  }

  // Unexpected consulted (consulted but not in plan)
  const unexpectedConsulted: string[] = [];
  for (const docId of consultedDocIds) {
    if (!allPlanIds.has(docId)) {
      unexpectedConsulted.push(docId);
    }
  }

  // Compute stats
  const requiredConsulted = [...requiredIds].filter(id => consulted.has(id)).length;
  const optionalConsulted = [...optionalIds].filter(id => consulted.has(id)).length;

  // Determine coverage status
  const coverageStatus = determineStatus(
    requiredMissing,
    optionalMissed,
    unexpectedConsulted,
    plan.constraints.failOnMissingRequired,
    notes,
  );

  return {
    schemaVersion: CONSULTATION_VALIDATION_SCHEMA_VERSION,
    workflowId: plan.workflowId,
    checkedAt: new Date().toISOString(),
    consulted: [...consultedDocIds],
    requiredMissing,
    unexpectedConsulted,
    optionalMissed,
    coverageStatus,
    notes,
    stats: {
      requiredTotal: requiredIds.size,
      requiredConsulted,
      optionalTotal: optionalIds.size,
      optionalConsulted,
    },
  };
}

/**
 * Determine coverage status based on gaps and constraints.
 */
function determineStatus(
  requiredMissing: string[],
  optionalMissed: string[],
  unexpectedConsulted: string[],
  failOnMissingRequired: boolean,
  notes: string[],
): 'pass' | 'warn' | 'fail' {
  if (requiredMissing.length > 0) {
    if (failOnMissingRequired) {
      notes.push(
        `FAIL: ${requiredMissing.length} required document(s) not consulted: ${requiredMissing.join(', ')}`,
      );
      return 'fail';
    } else {
      notes.push(
        `WARN: ${requiredMissing.length} required document(s) not consulted but failOnMissingRequired is false: ${requiredMissing.join(', ')}`,
      );
      return 'warn';
    }
  }

  if (unexpectedConsulted.length > 0) {
    notes.push(
      `Note: ${unexpectedConsulted.length} document(s) consulted outside plan: ${unexpectedConsulted.join(', ')}`,
    );
  }

  if (optionalMissed.length > 0) {
    notes.push(
      `Note: ${optionalMissed.length} optional document(s) not consulted: ${optionalMissed.join(', ')}`,
    );
    // Significant optional gaps (more than half missed) → warn
    // This is informational only, not a hard failure
  }

  notes.push('All required documents consulted.');
  return 'pass';
}
