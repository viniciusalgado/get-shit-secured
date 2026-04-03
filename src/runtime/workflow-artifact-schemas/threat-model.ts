/**
 * Artifact validators: threat-model (Phase 14)
 *
 * Validates threat-model artifact shapes extending ArtifactEnvelope.
 * Consultation mode is required — trace must be present.
 */

import { validateArtifactEnvelope } from '../artifact-envelope-validator.js';
import { validateConsultationTracePresence, requireArray } from './shared-validators.js';
import type { ValidationResult } from './types.js';

/**
 * Validate a threat-model threat-register artifact.
 */
export function validateThreatModelThreatRegister(artifact: unknown): ValidationResult {
  const envelopeResult = validateArtifactEnvelope(artifact, 'threat-model');
  if (!envelopeResult.valid) return { valid: false, errors: envelopeResult.errors };

  const traceResult = validateConsultationTracePresence(artifact, 'required');
  if (!traceResult.valid) return traceResult;

  const errors: string[] = [];
  const arrErr = requireArray(artifact, 'threats');
  if (arrErr) errors.push(arrErr);
  return errors.length > 0 ? { valid: false, errors } : { valid: true, errors: [] };
}

/**
 * Validate a threat-model risk-assessment artifact.
 */
export function validateThreatModelRiskAssessment(artifact: unknown): ValidationResult {
  const envelopeResult = validateArtifactEnvelope(artifact, 'threat-model');
  if (!envelopeResult.valid) return { valid: false, errors: envelopeResult.errors };

  const traceResult = validateConsultationTracePresence(artifact, 'required');
  if (!traceResult.valid) return traceResult;

  const errors: string[] = [];
  const arrErr = requireArray(artifact, 'risks');
  if (arrErr) errors.push(arrErr);
  return errors.length > 0 ? { valid: false, errors } : { valid: true, errors: [] };
}

/**
 * Validate a threat-model abuse-cases artifact.
 */
export function validateThreatModelAbuseCases(artifact: unknown): ValidationResult {
  const envelopeResult = validateArtifactEnvelope(artifact, 'threat-model');
  if (!envelopeResult.valid) return { valid: false, errors: envelopeResult.errors };

  const traceResult = validateConsultationTracePresence(artifact, 'required');
  if (!traceResult.valid) return traceResult;

  return { valid: true, errors: [] };
}

/**
 * Validate a threat-model mitigation-requirements artifact.
 */
export function validateThreatModelMitigationRequirements(artifact: unknown): ValidationResult {
  const envelopeResult = validateArtifactEnvelope(artifact, 'threat-model');
  if (!envelopeResult.valid) return { valid: false, errors: envelopeResult.errors };

  // markdown artifact — no consultation trace required for this specific artifact
  return { valid: true, errors: [] };
}
