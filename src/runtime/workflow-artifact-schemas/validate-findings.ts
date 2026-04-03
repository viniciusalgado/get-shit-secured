/**
 * Artifact validators: validate-findings (Phase 14)
 *
 * Validates validate-findings artifact shapes extending ArtifactEnvelope.
 * Consultation mode is optional — trace is not required.
 */

import { validateArtifactEnvelope } from '../artifact-envelope-validator.js';
import { requireArray } from './shared-validators.js';
import type { ValidationResult } from './types.js';

/**
 * Validate a validate-findings validation-report artifact.
 */
export function validateValidateFindingsReport(artifact: unknown): ValidationResult {
  const envelopeResult = validateArtifactEnvelope(artifact, 'validate-findings');
  if (!envelopeResult.valid) return { valid: false, errors: envelopeResult.errors };

  const errors: string[] = [];
  const arrErr = requireArray(artifact, 'findings');
  if (arrErr) errors.push(arrErr);
  return errors.length > 0 ? { valid: false, errors } : { valid: true, errors: [] };
}

/**
 * Validate a validate-findings re-evaluation-report artifact.
 */
export function validateValidateFindingsReEvaluation(artifact: unknown): ValidationResult {
  const envelopeResult = validateArtifactEnvelope(artifact, 'validate-findings');
  if (!envelopeResult.valid) return { valid: false, errors: envelopeResult.errors };

  return { valid: true, errors: [] };
}

/**
 * Validate a validate-findings validated-findings artifact.
 */
export function validateValidatedFindings(artifact: unknown): ValidationResult {
  const envelopeResult = validateArtifactEnvelope(artifact, 'validate-findings');
  if (!envelopeResult.valid) return { valid: false, errors: envelopeResult.errors };

  const errors: string[] = [];
  const arrErr = requireArray(artifact, 'findings');
  if (arrErr) errors.push(arrErr);
  return errors.length > 0 ? { valid: false, errors } : { valid: true, errors: [] };
}

/**
 * Validate a validate-findings tdd-test-document artifact.
 */
export function validateTddTestDocument(artifact: unknown): ValidationResult {
  const envelopeResult = validateArtifactEnvelope(artifact, 'validate-findings');
  if (!envelopeResult.valid) return { valid: false, errors: envelopeResult.errors };

  const errors: string[] = [];
  const arrErr = requireArray(artifact, 'testSpecs');
  if (arrErr) errors.push(arrErr);
  return errors.length > 0 ? { valid: false, errors } : { valid: true, errors: [] };
}
