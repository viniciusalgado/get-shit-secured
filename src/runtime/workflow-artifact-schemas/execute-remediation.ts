/**
 * Artifact validators: execute-remediation (Phase 14)
 *
 * Validates execute-remediation artifact shapes extending ArtifactEnvelope.
 * Consultation mode is optional — trace is not required.
 */

import { validateArtifactEnvelope } from '../artifact-envelope-validator.js';
import { requireArray } from './shared-validators.js';
import type { ValidationResult } from './types.js';

/**
 * Validate an execute-remediation application-report artifact.
 */
export function validateExecuteRemediationAppReport(artifact: unknown): ValidationResult {
  const envelopeResult = validateArtifactEnvelope(artifact, 'execute-remediation');
  if (!envelopeResult.valid) return { valid: false, errors: envelopeResult.errors };

  const errors: string[] = [];
  const arrErr = requireArray(artifact, 'applied');
  if (arrErr) errors.push(arrErr);
  return errors.length > 0 ? { valid: false, errors } : { valid: true, errors: [] };
}

/**
 * Validate an execute-remediation change-summary artifact (markdown).
 */
export function validateExecuteRemediationChangeSummary(artifact: unknown): ValidationResult {
  const envelopeResult = validateArtifactEnvelope(artifact, 'execute-remediation');
  if (!envelopeResult.valid) return { valid: false, errors: envelopeResult.errors };

  return { valid: true, errors: [] };
}

/**
 * Validate an execute-remediation deviations artifact (markdown).
 */
export function validateExecuteRemediationDeviations(artifact: unknown): ValidationResult {
  const envelopeResult = validateArtifactEnvelope(artifact, 'execute-remediation');
  if (!envelopeResult.valid) return { valid: false, errors: envelopeResult.errors };

  return { valid: true, errors: [] };
}
