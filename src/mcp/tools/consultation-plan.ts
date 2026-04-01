/**
 * Tool: get_workflow_consultation_plan
 *
 * Wraps the Phase 4 consultation planner to produce deterministic
 * consultation plans from workflow ID + signals.
 */

import type { LoadedSnapshot } from '../../corpus/snapshot-loader.js';
import type { WorkflowId, ConsultationPlan } from '../../core/types.js';
import { computeConsultationPlan } from '../../core/consultation-planner.js';
import { normalizeStack } from '../../core/stack-normalizer.js';
import { classifyFindings } from '../../core/issue-taxonomy.js';

/**
 * Input schema for the consultation plan tool.
 */
export interface ConsultationPlanToolInput {
  workflowId: WorkflowId;
  stacks?: string[];
  issueTags?: string[];
  changedFiles?: string[];
}

/**
 * Compute a consultation plan for a workflow.
 *
 * @param input - Tool input
 * @param loaded - Loaded corpus snapshot
 * @returns Consultation plan
 */
export function handleConsultationPlan(
  input: ConsultationPlanToolInput,
  loaded: LoadedSnapshot,
): ConsultationPlan {
  // Normalize stack signals
  const normalizedStack = normalizeStack(input.stacks ?? []);

  // Classify issue tags
  const classified = classifyFindings(input.issueTags ?? []);

  return computeConsultationPlan({
    workflowId: input.workflowId,
    snapshot: loaded,
    detectedStack: normalizedStack.canonical,
    issueTags: classified.tags,
    changedFiles: input.changedFiles ?? [],
    corpusVersion: loaded.snapshot.corpusVersion,
  });
}
