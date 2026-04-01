/**
 * Tool: validate_security_consultation
 *
 * Wraps the Phase 4 compliance validator to check consultation coverage
 * against a computed plan.
 */

import type { LoadedSnapshot } from '../../corpus/snapshot-loader.js';
import type { WorkflowId, ConsultationValidation } from '../../core/types.js';
import { validateConsultationCoverage } from '../../core/consultation-compliance.js';
import { handleConsultationPlan, type ConsultationPlanToolInput } from './consultation-plan.js';

/**
 * Input schema for the validation tool.
 */
export interface ValidateCoverageToolInput {
  workflowId: WorkflowId;
  consultedDocs: string[];
  stacks?: string[];
  issueTags?: string[];
  changedFiles?: string[];
}

/**
 * Validate consultation coverage.
 *
 * Computes the plan internally, then compares consultedDocs against
 * required/optional entries.
 *
 * @param input - Tool input
 * @param loaded - Loaded corpus snapshot
 * @returns Consultation validation result
 */
export function handleValidateCoverage(
  input: ValidateCoverageToolInput,
  loaded: LoadedSnapshot,
): ConsultationValidation {
  // Compute the plan for the same signals
  const plan = handleConsultationPlan(
    {
      workflowId: input.workflowId,
      stacks: input.stacks,
      issueTags: input.issueTags,
      changedFiles: input.changedFiles,
    },
    loaded,
  );

  // Validate coverage
  return validateConsultationCoverage(plan, input.consultedDocs);
}
