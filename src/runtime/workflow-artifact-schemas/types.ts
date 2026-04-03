/**
 * Workflow Artifact Schema Validator Types (Phase 14)
 *
 * Shared types for per-workflow artifact validators.
 */

import type { WorkflowId } from '../../core/types.js';

/**
 * Validation result returned by all schema validators.
 */
export interface ValidationResult {
  /** Whether the artifact passed validation */
  valid: boolean;
  /** Validation error messages (empty when valid) */
  errors: string[];
}

/**
 * Typed validator function signature.
 */
export type ArtifactValidatorFn = (artifact: unknown) => ValidationResult;

/**
 * Registry entry mapping (workflowId, artifactName) to a validator function.
 */
export interface ValidatorRegistryEntry {
  workflowId: WorkflowId;
  artifactName: string;
  validator: ArtifactValidatorFn;
}
