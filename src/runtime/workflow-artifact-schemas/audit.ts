/**
 * Artifact validators: audit (Phase 14)
 *
 * Validates audit artifact shapes extending ArtifactEnvelope.
 * Consultation mode is required — trace must be present.
 */

import { validateArtifactEnvelope } from '../artifact-envelope-validator.js';
import { validateConsultationTracePresence, requireArray } from './shared-validators.js';
import type { ValidationResult } from './types.js';

/**
 * Validate an audit findings-report artifact.
 */
export function validateAuditFindingsReport(artifact: unknown): ValidationResult {
  const envelopeResult = validateArtifactEnvelope(artifact, 'audit');
  if (!envelopeResult.valid) return { valid: false, errors: envelopeResult.errors };

  const traceResult = validateConsultationTracePresence(artifact, 'required');
  if (!traceResult.valid) return traceResult;

  const errors: string[] = [];
  const arrErr = requireArray(artifact, 'findings');
  if (arrErr) errors.push(arrErr);
  return errors.length > 0 ? { valid: false, errors } : { valid: true, errors: [] };
}

/**
 * Validate an audit owasp-mapping artifact.
 */
export function validateAuditOwaspMapping(artifact: unknown): ValidationResult {
  const envelopeResult = validateArtifactEnvelope(artifact, 'audit');
  if (!envelopeResult.valid) return { valid: false, errors: envelopeResult.errors };

  const traceResult = validateConsultationTracePresence(artifact, 'required');
  if (!traceResult.valid) return traceResult;

  return { valid: true, errors: [] };
}

/**
 * Validate an audit evidence artifact (markdown).
 */
export function validateAuditEvidence(artifact: unknown): ValidationResult {
  const envelopeResult = validateArtifactEnvelope(artifact, 'audit');
  if (!envelopeResult.valid) return { valid: false, errors: envelopeResult.errors };

  return { valid: true, errors: [] };
}

/**
 * Validate an audit priorities artifact.
 */
export function validateAuditPriorities(artifact: unknown): ValidationResult {
  const envelopeResult = validateArtifactEnvelope(artifact, 'audit');
  if (!envelopeResult.valid) return { valid: false, errors: envelopeResult.errors };

  const traceResult = validateConsultationTracePresence(artifact, 'required');
  if (!traceResult.valid) return traceResult;

  const errors: string[] = [];
  const arrErr = requireArray(artifact, 'priorities');
  if (arrErr) errors.push(arrErr);
  return errors.length > 0 ? { valid: false, errors } : { valid: true, errors: [] };
}
