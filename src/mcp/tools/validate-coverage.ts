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
  /** Document IDs that were actually read via read_security_doc (cross-reference) */
  actuallyReadDocs?: string[];
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
): ConsultationValidation & { unreadDocs?: string[] } {
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
  const result = validateConsultationCoverage(plan, input.consultedDocs);

  // Cross-reference with actually read docs if available
  if (input.actuallyReadDocs && input.actuallyReadDocs.length > 0) {
    const readSet = new Set(input.actuallyReadDocs);
    const claimedButNotRead = input.consultedDocs.filter(id => !readSet.has(id));
    if (claimedButNotRead.length > 0) {
      return {
        ...result,
        unreadDocs: claimedButNotRead,
      };
    }
  }

  return result;
}
