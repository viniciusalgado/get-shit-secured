/**
 * Artifact validators: map-codebase (Phase 14)
 *
 * Validates map-codebase artifact shapes extending ArtifactEnvelope.
 * Consultation mode is optional — trace is not required.
 */

import { validateArtifactEnvelope } from '../artifact-envelope-validator.js';
import { requireArray } from './shared-validators.js';
import type { ValidationResult } from './types.js';

/**
 * Validate a map-codebase inventory artifact.
 */
export function validateMapCodebaseInventory(artifact: unknown): ValidationResult {
  const envelopeResult = validateArtifactEnvelope(artifact, 'map-codebase');
  if (!envelopeResult.valid) return { valid: false, errors: envelopeResult.errors };

  const errors: string[] = [];
  const arrErr = requireArray(artifact, 'components');
  if (arrErr) errors.push(arrErr);
  return errors.length > 0 ? { valid: false, errors } : { valid: true, errors: [] };
}

/**
 * Validate a map-codebase trust-boundaries artifact.
 */
export function validateMapCodebaseTrustBoundaries(artifact: unknown): ValidationResult {
  const envelopeResult = validateArtifactEnvelope(artifact, 'map-codebase');
  if (!envelopeResult.valid) return { valid: false, errors: envelopeResult.errors };

  const errors: string[] = [];
  const arrErr = requireArray(artifact, 'boundaries');
  if (arrErr) errors.push(arrErr);
  return errors.length > 0 ? { valid: false, errors } : { valid: true, errors: [] };
}

/**
 * Validate a map-codebase dependencies artifact.
 */
export function validateMapCodebaseDependencies(artifact: unknown): ValidationResult {
  const envelopeResult = validateArtifactEnvelope(artifact, 'map-codebase');
  if (!envelopeResult.valid) return { valid: false, errors: envelopeResult.errors };

  const errors: string[] = [];
  const arrErr = requireArray(artifact, 'dependencies');
  if (arrErr) errors.push(arrErr);
  return errors.length > 0 ? { valid: false, errors } : { valid: true, errors: [] };
}

/**
 * Validate a map-codebase data-flows artifact.
 */
export function validateMapCodebaseDataFlows(artifact: unknown): ValidationResult {
  const envelopeResult = validateArtifactEnvelope(artifact, 'map-codebase');
  if (!envelopeResult.valid) return { valid: false, errors: envelopeResult.errors };

  const errors: string[] = [];
  const arrErr = requireArray(artifact, 'flows');
  if (arrErr) errors.push(arrErr);
  return errors.length > 0 ? { valid: false, errors } : { valid: true, errors: [] };
}
