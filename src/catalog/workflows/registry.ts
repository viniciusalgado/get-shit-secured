/**
 * Workflow Registry
 *
 * Central registry for all workflow definitions.
 * This is the single source of truth for workflow metadata and content.
 */

import type { WorkflowDefinition, WorkflowId } from '../../core/types.js';
import { mapCodebaseDefinition } from './map-codebase/definition.js';
import { threatModelDefinition } from './threat-model/definition.js';
import { auditDefinition } from './audit/definition.js';
import { planRemediationDefinition } from './plan-remediation/definition.js';
import { executeRemediationDefinition } from './execute-remediation/definition.js';
import { verifyDefinition } from './verify/definition.js';
import { reportDefinition } from './report/definition.js';

/**
 * Internal workflow registry map.
 */
const WORKFLOW_REGISTRY: Record<WorkflowId, WorkflowDefinition> = {
  'map-codebase': mapCodebaseDefinition,
  'threat-model': threatModelDefinition,
  'audit': auditDefinition,
  'plan-remediation': planRemediationDefinition,
  'execute-remediation': executeRemediationDefinition,
  'verify': verifyDefinition,
  'report': reportDefinition,
};

/**
 * All workflow IDs in order of typical execution.
 */
export const WORKFLOW_ORDER: WorkflowId[] = [
  'map-codebase',
  'threat-model',
  'audit',
  'plan-remediation',
  'execute-remediation',
  'verify',
  'report',
];

/**
 * Get a workflow definition by ID.
 * Throws if workflow ID is not recognized.
 */
export function getWorkflow(id: WorkflowId): WorkflowDefinition {
  const workflow = WORKFLOW_REGISTRY[id];
  if (!workflow) {
    throw new Error(`Unknown workflow ID: ${id}`);
  }
  return workflow;
}

/**
 * Get all workflow definitions.
 * Returns workflows in execution order.
 */
export function getAllWorkflows(): WorkflowDefinition[] {
  return WORKFLOW_ORDER.map((id) => WORKFLOW_REGISTRY[id]);
}

/**
 * Get workflows that have no dependencies (entry points).
 */
export function getEntryWorkflows(): WorkflowDefinition[] {
  return getAllWorkflows().filter((w) => w.dependencies.length === 0);
}

/**
 * Get workflows that can run after the given workflow.
 */
export function getNextWorkflows(workflowId: WorkflowId): WorkflowDefinition[] {
  const workflow = getWorkflow(workflowId);
  return workflow.handoffs.map((h: { nextWorkflow: WorkflowId; outputsToPass: string[] }) =>
    getWorkflow(h.nextWorkflow)
  );
}

/**
 * Check if a workflow's dependencies are satisfied.
 */
export function areDependenciesSatisfied(
  workflowId: WorkflowId,
  completedWorkflows: WorkflowId[]
): boolean {
  const workflow = getWorkflow(workflowId);
  return workflow.dependencies.every((dep: { workflowId: WorkflowId; requiredOutputs: string[] }) =>
    completedWorkflows.includes(dep.workflowId)
  );
}

/**
 * Get workflows in executable order (topological sort).
 */
export function getExecutableOrder(): WorkflowDefinition[] {
  const completed: WorkflowId[] = [];
  const result: WorkflowDefinition[] = [];
  const remaining = new Set(WORKFLOW_ORDER);

  // Simple topological sort - in case of cycles, just return all
  let lastAddedCount = 0;
  while (remaining.size > 0) {
    for (const id of remaining) {
      if (areDependenciesSatisfied(id, completed)) {
        result.push(WORKFLOW_REGISTRY[id]);
        completed.push(id);
        remaining.delete(id);
        lastAddedCount++;
      }
    }

    // If we couldn't add anything but still have items remaining,
    // there's a cycle or missing dependency. Add the rest anyway.
    if (lastAddedCount === 0 && remaining.size > 0) {
      for (const id of remaining) {
        result.push(WORKFLOW_REGISTRY[id]);
        completed.push(id);
      }
      remaining.clear();
    }
    lastAddedCount = 0;
  }

  return result;
}

/**
 * Get a summary of all workflows for help/readme generation.
 */
export function getWorkflowSummary(): Array<{
  id: WorkflowId;
  title: string;
  goal: string;
  inputs: string[];
  outputs: string[];
  dependencies: WorkflowId[];
}> {
  return getAllWorkflows().map((w) => ({
    id: w.id,
    title: w.title,
    goal: w.goal,
    inputs: w.inputs.map((i: { name: string }) => i.name),
    outputs: w.outputs.map((o: { name: string }) => o.name),
    dependencies: w.dependencies.map((d: { workflowId: WorkflowId }) => d.workflowId),
  }));
}

/**
 * Export the registry for direct access if needed.
 */
export { WORKFLOW_REGISTRY };
