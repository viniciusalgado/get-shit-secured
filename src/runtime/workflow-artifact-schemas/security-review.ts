/**
 * Artifact validators: security-review (Phase 14)
 *
 * Validates security-review artifact shapes extending ArtifactEnvelope.
 */

import { validateArtifactEnvelope } from '../artifact-envelope-validator.js';
import { validateConsultationTracePresence } from './shared-validators.js';
import type { ValidationResult } from './types.js';

/**
 * Validate a security-review change-scope artifact.
 */
export function validateSecurityReviewChangeScope(artifact: unknown): ValidationResult {
  const envelopeResult = validateArtifactEnvelope(artifact, 'security-review');
  if (!envelopeResult.valid) return { valid: false, errors: envelopeResult.errors };

  const traceResult = validateConsultationTracePresence(artifact, 'required');
  if (!traceResult.valid) return traceResult;

  const a = artifact as Record<string, unknown>;
  const errors: string[] = [];
  if (!Array.isArray(a['changedFiles'])) errors.push('changedFiles must be an array');
  return errors.length > 0 ? { valid: false, errors } : { valid: true, errors: [] };
}

/**
 * Validate a security-review findings artifact.
 */
export function validateSecurityReviewFindings(artifact: unknown): ValidationResult {
  const envelopeResult = validateArtifactEnvelope(artifact, 'security-review');
  if (!envelopeResult.valid) return { valid: false, errors: envelopeResult.errors };

  const traceResult = validateConsultationTracePresence(artifact, 'required');
  if (!traceResult.valid) return traceResult;

  const a = artifact as Record<string, unknown>;
  const errors: string[] = [];
  if (!Array.isArray(a['findings'])) errors.push('findings must be an array');
  return errors.length > 0 ? { valid: false, errors } : { valid: true, errors: [] };
}

/**
 * Validate a security-review delegation-plan artifact.
 */
export function validateSecurityReviewDelegationPlan(artifact: unknown): ValidationResult {
  const envelopeResult = validateArtifactEnvelope(artifact, 'security-review');
  if (!envelopeResult.valid) return { valid: false, errors: envelopeResult.errors };

  const traceResult = validateConsultationTracePresence(artifact, 'required');
  if (!traceResult.valid) return traceResult;

  return { valid: true, errors: [] };
}

/**
 * Validate a security-review validation-report artifact.
 */
export function validateSecurityReviewValidationReport(artifact: unknown): ValidationResult {
  const envelopeResult = validateArtifactEnvelope(artifact, 'security-review');
  if (!envelopeResult.valid) return { valid: false, errors: envelopeResult.errors };

  const traceResult = validateConsultationTracePresence(artifact, 'required');
  if (!traceResult.valid) return traceResult;

  return { valid: true, errors: [] };
}

/**
 * Validate a security-review security-test-specs artifact.
 */
export function validateSecurityReviewTestSpecs(artifact: unknown): ValidationResult {
  const envelopeResult = validateArtifactEnvelope(artifact, 'security-review');
  if (!envelopeResult.valid) return { valid: false, errors: envelopeResult.errors };

  const traceResult = validateConsultationTracePresence(artifact, 'required');
  if (!traceResult.valid) return traceResult;

  return { valid: true, errors: [] };
}
