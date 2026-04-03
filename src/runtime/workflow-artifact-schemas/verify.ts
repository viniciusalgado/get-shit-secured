/**
 * Artifact validators: verify (Phase 14)
 *
 * Validates verify artifact shapes extending ArtifactEnvelope.
 * Consultation mode is required — trace must be present.
 */

import { validateArtifactEnvelope } from '../artifact-envelope-validator.js';
import { validateConsultationTracePresence, requireArray } from './shared-validators.js';
import type { ValidationResult } from './types.js';

/**
 * Validate a verify verification-report artifact.
 */
export function validateVerifyReport(artifact: unknown): ValidationResult {
  const envelopeResult = validateArtifactEnvelope(artifact, 'verify');
  if (!envelopeResult.valid) return { valid: false, errors: envelopeResult.errors };

  const traceResult = validateConsultationTracePresence(artifact, 'required');
  if (!traceResult.valid) return traceResult;

  const errors: string[] = [];
  const arrErr = requireArray(artifact, 'verifications');
  if (arrErr) errors.push(arrErr);
  return errors.length > 0 ? { valid: false, errors } : { valid: true, errors: [] };
}

/**
 * Validate a verify regression-analysis artifact.
 */
export function validateVerifyRegressionAnalysis(artifact: unknown): ValidationResult {
  const envelopeResult = validateArtifactEnvelope(artifact, 'verify');
  if (!envelopeResult.valid) return { valid: false, errors: envelopeResult.errors };

  const traceResult = validateConsultationTracePresence(artifact, 'required');
  if (!traceResult.valid) return traceResult;

  return { valid: true, errors: [] };
}

/**
 * Validate a verify test-coverage artifact.
 */
export function validateVerifyTestCoverage(artifact: unknown): ValidationResult {
  const envelopeResult = validateArtifactEnvelope(artifact, 'verify');
  if (!envelopeResult.valid) return { valid: false, errors: envelopeResult.errors };

  const traceResult = validateConsultationTracePresence(artifact, 'required');
  if (!traceResult.valid) return traceResult;

  return { valid: true, errors: [] };
}

/**
 * Validate a verify residual-risk artifact.
 */
export function validateVerifyResidualRisk(artifact: unknown): ValidationResult {
  const envelopeResult = validateArtifactEnvelope(artifact, 'verify');
  if (!envelopeResult.valid) return { valid: false, errors: envelopeResult.errors };

  const traceResult = validateConsultationTracePresence(artifact, 'required');
  if (!traceResult.valid) return traceResult;

  return { valid: true, errors: [] };
}
