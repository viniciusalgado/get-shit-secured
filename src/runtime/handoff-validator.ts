/**
 * Handoff Validator (Phase 14)
 *
 * Validates structural compatibility between a producing workflow's output
 * artifacts and a consuming workflow's expected inputs.
 *
 * Uses dependency injection for contract data to respect module boundaries:
 * callers provide handoff edges and consultation modes rather than this
 * module importing them from the workflow catalog.
 *
 * @module runtime/handoff-validator
 */

import type { WorkflowId } from '../core/types.js';
import { validateArtifactEnvelope } from './artifact-envelope-validator.js';
import { validateWorkflowArtifact } from './workflow-artifact-schemas/index.js';

/**
 * Result of a handoff validation check.
 */
export interface HandoffValidationResult {
  /** Whether the handoff passes validation */
  valid: boolean;
  /** Error messages for failed validations */
  errors: string[];
  /** Producer workflow */
  producer: WorkflowId;
  /** Consumer workflow */
  consumer: WorkflowId;
}

/**
 * Configuration for validateHandoff — contract data injected by caller.
 */
export interface HandoffConfig {
  /** Handoff declarations from the producer's execution contract */
  handoffs: Array<{ targetWorkflowId: string; outputsToPass: string[] }>;
  /** The producer's consultation mode ('required' | 'optional' | 'not-applicable') */
  consultationMode?: string;
}

/**
 * Validate that a producing workflow's output artifacts satisfy
 * a consuming workflow's input requirements.
 *
 * Checks all handoff edges from producer to consumer as declared
 * in the provided config.
 *
 * @param producerWorkflowId - The workflow producing artifacts
 * @param consumerWorkflowId - The workflow consuming artifacts
 * @param artifacts - Map of artifact name to artifact data
 * @param config - Producer's handoff declarations and consultation mode
 * @returns Handoff validation result
 */
export function validateHandoff(
  producerWorkflowId: WorkflowId,
  consumerWorkflowId: WorkflowId,
  artifacts: Map<string, unknown>,
  config?: HandoffConfig,
): HandoffValidationResult {
  const errors: string[] = [];

  // No config or no handoffs — nothing to validate
  if (!config || config.handoffs.length === 0) {
    return {
      valid: true,
      errors: [],
      producer: producerWorkflowId,
      consumer: consumerWorkflowId,
    };
  }

  // Find handoff edges from producer to this specific consumer
  const relevantHandoffs = config.handoffs.filter(
    h => h.targetWorkflowId === consumerWorkflowId,
  );

  if (relevantHandoffs.length === 0) {
    // No declared handoff edge — informational, not an error
    return {
      valid: true,
      errors: [],
      producer: producerWorkflowId,
      consumer: consumerWorkflowId,
    };
  }

  // Validate each handoff edge
  for (const handoff of relevantHandoffs) {
    const edgeResult = validateHandoffEdge(
      producerWorkflowId,
      consumerWorkflowId,
      handoff.outputsToPass,
      artifacts,
      config.consultationMode,
    );
    if (!edgeResult.valid) {
      errors.push(...edgeResult.errors);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    producer: producerWorkflowId,
    consumer: consumerWorkflowId,
  };
}

/**
 * Validate a specific handoff edge.
 *
 * Checks that:
 * 1. Required outputs exist in the artifacts map
 * 2. Each output has a valid ArtifactEnvelope
 * 3. If the producing workflow requires consultation, consultation trace is present
 *
 * @param from - Producer workflow ID
 * @param to - Consumer workflow ID
 * @param outputsToPass - Names of outputs that should be passed
 * @param artifacts - Map of artifact name to artifact data
 * @param producerConsultationMode - The producer's consultation mode
 * @returns Handoff validation result
 */
export function validateHandoffEdge(
  from: WorkflowId,
  to: WorkflowId,
  outputsToPass: string[],
  artifacts: Map<string, unknown>,
  producerConsultationMode?: string,
): HandoffValidationResult {
  const errors: string[] = [];

  for (const outputName of outputsToPass) {
    const artifact = artifacts.get(outputName);

    // Check existence
    if (artifact === undefined || artifact === null) {
      errors.push(`Missing required output artifact: ${outputName} (from ${from} to ${to})`);
      continue;
    }

    // Validate envelope
    const envelopeResult = validateArtifactEnvelope(artifact, from);
    if (!envelopeResult.valid) {
      errors.push(`Invalid envelope for ${outputName}: ${envelopeResult.errors.join(', ')}`);
      continue;
    }

    const artifactResult = validateWorkflowArtifact(from, outputName, artifact);
    if (!artifactResult.valid) {
      errors.push(`Invalid artifact payload for ${outputName}: ${artifactResult.errors.join(', ')}`);
      continue;
    }

    // Check consultation trace when required
    if (producerConsultationMode === 'required') {
      const a = artifact as Record<string, unknown>;
      if (!('consultation' in a)) {
        errors.push(`Missing consultation trace in ${outputName} (producer ${from} has consultationMode "required")`);
      } else if (typeof a['consultation'] !== 'object' || a['consultation'] === null) {
        errors.push(`Invalid consultation trace in ${outputName}: must be a non-null object`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    producer: from,
    consumer: to,
  };
}

/**
 * Validate all declared handoff edges across the entire workflow chain.
 *
 * @param artifactsByWorkflow - Map of producer workflow ID to its artifacts Map
 * @param edges - Array of handoff edges from execution contracts
 * @param consultationModes - Map of workflow ID to its consultation mode
 * @returns Array of validation results, one per handoff edge
 */
export function validateAllHandoffs(
  artifactsByWorkflow: Map<WorkflowId, Map<string, unknown>>,
  edges: Array<{ producer: WorkflowId; consumer: WorkflowId; outputsToPass: string[] }>,
  consultationModes?: Map<WorkflowId, string>,
): HandoffValidationResult[] {
  const results: HandoffValidationResult[] = [];

  for (const edge of edges) {
    const artifacts = artifactsByWorkflow.get(edge.producer) ?? new Map();
    const mode = consultationModes?.get(edge.producer);
    results.push(
      validateHandoffEdge(edge.producer, edge.consumer, edge.outputsToPass, artifacts, mode),
    );
  }

  return results;
}
