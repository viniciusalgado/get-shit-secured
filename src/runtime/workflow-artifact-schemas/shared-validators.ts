/**
 * Shared validation helpers for workflow artifact schemas (Phase 14).
 */

import type { ConsultationMode } from '../../core/types.js';
import type { ValidationResult } from './types.js';

/**
 * Validate that a consultation trace is present when required by the consultation mode.
 *
 * @param artifact - The artifact to check
 * @param mode - The consultation mode for the workflow
 * @returns Validation result
 */
export function validateConsultationTracePresence(
  artifact: unknown,
  mode: ConsultationMode | string,
): ValidationResult {
  if (mode !== 'required') return { valid: true, errors: [] };

  const a = artifact as Record<string, unknown>;
  if (!('consultation' in a)) {
    return { valid: false, errors: ['consultationMode is "required" but "consultation" section is missing'] };
  }
  if (typeof a['consultation'] !== 'object' || a['consultation'] === null) {
    return { valid: false, errors: ['consultation must be a non-null object when consultationMode is "required"'] };
  }

  return { valid: true, errors: [] };
}

/**
 * Validate that a field is an array.
 */
export function requireArray(artifact: unknown, field: string): string | null {
  const a = artifact as Record<string, unknown>;
  if (!(field in a)) return `${field} is missing`;
  if (!Array.isArray(a[field])) return `${field} must be an array`;
  return null;
}

/**
 * Validate that a field is a string.
 */
export function requireString(artifact: unknown, field: string): string | null {
  const a = artifact as Record<string, unknown>;
  if (!(field in a)) return `${field} is missing`;
  if (typeof a[field] !== 'string') return `${field} must be a string`;
  return null;
}
