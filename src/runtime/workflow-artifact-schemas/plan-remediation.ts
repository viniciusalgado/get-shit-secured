/**
 * Artifact validators: plan-remediation (Phase 14)
 *
 * Validates plan-remediation artifact shapes extending ArtifactEnvelope.
 * Consultation mode is required — trace must be present.
 */

import { validateArtifactEnvelope } from '../artifact-envelope-validator.js';
import { validateConsultationTracePresence, requireArray } from './shared-validators.js';
import type { ValidationResult } from './types.js';

/**
 * Validate a plan-remediation patch-plan artifact.
 */
export function validatePlanRemediationPatchPlan(artifact: unknown): ValidationResult {
  const envelopeResult = validateArtifactEnvelope(artifact, 'plan-remediation');
  if (!envelopeResult.valid) return { valid: false, errors: envelopeResult.errors };

  const traceResult = validateConsultationTracePresence(artifact, 'required');
  if (!traceResult.valid) return traceResult;

  const errors: string[] = [];
  const arrErr = requireArray(artifact, 'patches');
  if (arrErr) errors.push(arrErr);
  return errors.length > 0 ? { valid: false, errors } : { valid: true, errors: [] };
}

/**
 * Validate a plan-remediation implementation-guide artifact (markdown).
 */
export function validatePlanRemediationGuide(artifact: unknown): ValidationResult {
  const envelopeResult = validateArtifactEnvelope(artifact, 'plan-remediation');
  if (!envelopeResult.valid) return { valid: false, errors: envelopeResult.errors };

  return { valid: true, errors: [] };
}

/**
 * Validate a plan-remediation test-specifications artifact.
 */
export function validatePlanRemediationTestSpecs(artifact: unknown): ValidationResult {
  const envelopeResult = validateArtifactEnvelope(artifact, 'plan-remediation');
  if (!envelopeResult.valid) return { valid: false, errors: envelopeResult.errors };

  const traceResult = validateConsultationTracePresence(artifact, 'required');
  if (!traceResult.valid) return traceResult;

  const errors: string[] = [];
  const arrErr = requireArray(artifact, 'tests');
  if (arrErr) errors.push(arrErr);
  return errors.length > 0 ? { valid: false, errors } : { valid: true, errors: [] };
}

/**
 * Validate a plan-remediation rollback-plan artifact.
 */
export function validatePlanRemediationRollbackPlan(artifact: unknown): ValidationResult {
  const envelopeResult = validateArtifactEnvelope(artifact, 'plan-remediation');
  if (!envelopeResult.valid) return { valid: false, errors: envelopeResult.errors };

  return { valid: true, errors: [] };
}
