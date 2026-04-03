/**
 * Execution Contract Registry (Phase 14)
 *
 * Central registry for all workflow execution contracts.
 * Provides lookup by workflow ID and bulk access.
 */

import type { WorkflowId } from '../../../core/types.js';
import type { WorkflowExecutionContract } from './types.js';
import { securityReviewContract } from './security-review.js';
import { mapCodebaseContract } from './map-codebase.js';
import { threatModelContract } from './threat-model.js';
import { auditContract } from './audit.js';
import { validateFindingsContract } from './validate-findings.js';
import { planRemediationContract } from './plan-remediation.js';
import { executeRemediationContract } from './execute-remediation.js';
import { verifyContract } from './verify.js';
import { reportContract } from './report.js';

/**
 * Internal registry mapping workflow IDs to execution contracts.
 */
const CONTRACT_REGISTRY: Record<WorkflowId, WorkflowExecutionContract> = {
  'security-review': securityReviewContract,
  'map-codebase': mapCodebaseContract,
  'threat-model': threatModelContract,
  'audit': auditContract,
  'validate-findings': validateFindingsContract,
  'plan-remediation': planRemediationContract,
  'execute-remediation': executeRemediationContract,
  'verify': verifyContract,
  'report': reportContract,
};

/**
 * Get the execution contract for a specific workflow.
 *
 * @param workflowId - Workflow identifier
 * @returns Execution contract for the workflow
 * @throws Error if workflow ID is not recognized
 */
export function getExecutionContract(workflowId: WorkflowId): WorkflowExecutionContract {
  const contract = CONTRACT_REGISTRY[workflowId];
  if (!contract) {
    throw new Error(`No execution contract for workflow: ${workflowId}`);
  }
  return contract;
}

/**
 * Get all execution contracts as a Map keyed by workflow ID.
 *
 * @returns Map of workflow IDs to execution contracts
 */
export function getAllExecutionContracts(): Map<WorkflowId, WorkflowExecutionContract> {
  return new Map(Object.entries(CONTRACT_REGISTRY) as Array<[WorkflowId, WorkflowExecutionContract]>);
}

/**
 * Get all handoff edges from all workflow execution contracts.
 * Each edge is a { producer, consumer, outputs } triple.
 */
export function getAllHandoffEdges(): Array<{
  producer: WorkflowId;
  consumer: WorkflowId;
  outputsToPass: string[];
}> {
  const edges: Array<{
    producer: WorkflowId;
    consumer: WorkflowId;
    outputsToPass: string[];
  }> = [];

  for (const [workflowId, contract] of Object.entries(CONTRACT_REGISTRY) as Array<[WorkflowId, WorkflowExecutionContract]>) {
    for (const handoff of contract.handoffs) {
      edges.push({
        producer: workflowId,
        consumer: handoff.targetWorkflowId,
        outputsToPass: handoff.outputsToPass,
      });
    }
  }

  return edges;
}

export {
  securityReviewContract,
  mapCodebaseContract,
  threatModelContract,
  auditContract,
  validateFindingsContract,
  planRemediationContract,
  executeRemediationContract,
  verifyContract,
  reportContract,
};
