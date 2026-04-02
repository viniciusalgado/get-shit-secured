/**
 * Consultation trace builder.
 *
 * Provides the canonical way to assemble a ConsultationTrace from
 * plan + consulted docs + validation. Workflows should use this
 * helper instead of hand-rolling trace shapes to prevent drift.
 *
 * @module runtime/consultation-trace-builder
 */

import type {
  WorkflowId,
  ConsultationPlan,
  ConsultationValidation,
  ConsultationTrace,
  ConsultationMode,
  ArtifactEnvelope,
} from '../core/types.js';
import { ARTIFACT_ENVELOPE_SCHEMA_VERSION as ARTIFACT_ENVELOPE_SCHEMA_VERSION_import } from '../core/types.js';

// Re-export for convenience
/** Schema version constant */
export const ARTIFACT_ENVELOPE_SCHEMA_VERSION = ARTIFACT_ENVELOPE_SCHEMA_VERSION_import;

/**
 * Build a ConsultationTrace from plan, consulted doc IDs, and validation.
 *
 * This is the single canonical way to assemble a trace. Usage:
 * ```
 * const trace = buildConsultationTrace(plan, consultedDocIds, validation);
 * artifact.consultation = trace;
 * ```
 *
 * @param plan - Consultation plan from the planner
 * @param consultedDocIds - Document IDs that were actually consulted
 * @param validation - Validation result from compliance check
 * @returns A valid ConsultationTrace
 */
export function buildConsultationTrace(
  plan: ConsultationPlan,
  consultedDocIds: string[],
  validation: ConsultationValidation
): ConsultationTrace {
  // Build consulted docs with metadata from plan entries
  const allPlanEntries = [...plan.required, ...plan.optional, ...plan.followup];
  const consultedDocs = consultedDocIds.map((id) => {
    const entry = allPlanEntries.find((e) => e.docId === id);
    return {
      id,
      title: entry?.docId ?? id,
      sourceUrl: entry?.docUri ?? `security://owasp/${id}`,
    };
  });

  return {
    plan: {
      workflowId: plan.workflowId,
      generatedAt: plan.generatedAt,
      corpusVersion: plan.corpusVersion,
      requiredCount: plan.required.length,
      optionalCount: plan.optional.length,
      followupCount: plan.followup.length,
    },
    consultedDocs,
    coverageStatus: validation.coverageStatus,
    requiredMissing: validation.requiredMissing,
    notes: validation.notes,
  };
}

/**
 * Build a minimal ArtifactEnvelope for workflows that don't consult MCP
 * (consultationMode = 'not-applicable').
 *
 * @param workflowId - Which workflow is producing this artifact
 * @param gssVersion - GSS version from package.json
 * @param corpusVersion - Corpus version from runtime manifest or snapshot
 * @returns A minimal envelope without consultation trace
 */
export function buildNotApplicableEnvelope(
  workflowId: WorkflowId,
  gssVersion: string,
  corpusVersion: string
): Omit<ArtifactEnvelope, 'consultation'> {
  return {
    schemaVersion: ARTIFACT_ENVELOPE_SCHEMA_VERSION,
    workflowId,
    gssVersion,
    corpusVersion,
    generatedAt: new Date().toISOString(),
    consultationMode: 'not-applicable' as ConsultationMode,
  };
}
