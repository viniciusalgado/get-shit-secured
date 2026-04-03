/**
 * Artifact validators: report (Phase 14)
 *
 * Validates report artifact shapes extending ArtifactEnvelope.
 * Consultation mode is not-applicable — no trace expected.
 */

import { validateArtifactEnvelope } from '../artifact-envelope-validator.js';
import type { ValidationResult } from './types.js';

/**
 * Validate a report executive-summary artifact (markdown).
 */
export function validateReportExecutiveSummary(artifact: unknown): ValidationResult {
  const envelopeResult = validateArtifactEnvelope(artifact, 'report');
  if (!envelopeResult.valid) return { valid: false, errors: envelopeResult.errors };
  return { valid: true, errors: [] };
}

/**
 * Validate a report technical-findings artifact (markdown).
 */
export function validateReportTechnicalFindings(artifact: unknown): ValidationResult {
  const envelopeResult = validateArtifactEnvelope(artifact, 'report');
  if (!envelopeResult.valid) return { valid: false, errors: envelopeResult.errors };
  return { valid: true, errors: [] };
}

/**
 * Validate a report owasp-compliance artifact (markdown).
 */
export function validateReportOwaspCompliance(artifact: unknown): ValidationResult {
  const envelopeResult = validateArtifactEnvelope(artifact, 'report');
  if (!envelopeResult.valid) return { valid: false, errors: envelopeResult.errors };
  return { valid: true, errors: [] };
}

/**
 * Validate a report remediation-roadmap artifact (markdown).
 */
export function validateReportRemediationRoadmap(artifact: unknown): ValidationResult {
  const envelopeResult = validateArtifactEnvelope(artifact, 'report');
  if (!envelopeResult.valid) return { valid: false, errors: envelopeResult.errors };
  return { valid: true, errors: [] };
}
