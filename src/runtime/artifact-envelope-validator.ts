/**
 * Artifact envelope validator.
 *
 * Provides runtime type guards and detailed validation diagnostics
 * for the ArtifactEnvelope schema. Used by hooks and CLI tooling.
 *
 * @module runtime/artifact-envelope-validator
 */

import type {
  WorkflowId,
  ArtifactEnvelope,
  ConsultationMode,
} from '../core/types.js';
import { ARTIFACT_ENVELOPE_SCHEMA_VERSION } from '../core/types.js';

/** Valid workflow IDs */
const VALID_WORKFLOW_IDS: readonly string[] = [
  'security-review', 'map-codebase', 'threat-model', 'audit',
  'validate-findings', 'plan-remediation', 'execute-remediation',
  'verify', 'report',
];

/** Valid consultation modes */
const VALID_CONSULTATION_MODES: readonly string[] = [
  'required', 'optional', 'not-applicable',
];

/**
 * Runtime type guard for ArtifactEnvelope.
 * Returns true if the object has the minimum required envelope fields.
 *
 * @param obj - Object to check
 * @returns True if obj conforms to ArtifactEnvelope shape
 */
export function isArtifactEnvelope(obj: unknown): obj is ArtifactEnvelope {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return false;
  }
  const rec = obj as Record<string, unknown>;

  // Check required top-level fields
  if (typeof rec['schemaVersion'] !== 'number') return false;
  if (typeof rec['workflowId'] !== 'string') return false;
  if (typeof rec['gssVersion'] !== 'string') return false;
  if (typeof rec['corpusVersion'] !== 'string') return false;
  if (typeof rec['generatedAt'] !== 'string') return false;
  if (typeof rec['consultationMode'] !== 'string') return false;

  return true;
}

/**
 * Validate an artifact envelope and return detailed diagnostics.
 *
 * @param obj - Object to validate
 * @param expectedWorkflowId - Optional: verify the workflowId matches
 * @returns Validation result with errors and warnings
 */
export function validateArtifactEnvelope(
  obj: unknown,
  expectedWorkflowId?: WorkflowId
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    errors.push('Artifact must be a non-null object');
    return { valid: false, errors, warnings };
  }

  const rec = obj as Record<string, unknown>;

  // schemaVersion
  if (!('schemaVersion' in rec)) {
    errors.push('Missing required field: schemaVersion');
  } else if (typeof rec['schemaVersion'] !== 'number') {
    errors.push('schemaVersion must be a number');
  } else if (rec['schemaVersion'] !== ARTIFACT_ENVELOPE_SCHEMA_VERSION) {
    warnings.push(`schemaVersion is ${rec['schemaVersion']}, expected ${ARTIFACT_ENVELOPE_SCHEMA_VERSION}`);
  }

  // workflowId
  if (!('workflowId' in rec)) {
    errors.push('Missing required field: workflowId');
  } else if (typeof rec['workflowId'] !== 'string') {
    errors.push('workflowId must be a string');
  } else if (!VALID_WORKFLOW_IDS.includes(rec['workflowId'])) {
    errors.push(`Invalid workflowId: '${rec['workflowId']}'`);
  } else if (expectedWorkflowId && rec['workflowId'] !== expectedWorkflowId) {
    warnings.push(`workflowId is '${rec['workflowId']}', expected '${expectedWorkflowId}'`);
  }

  // gssVersion
  if (!('gssVersion' in rec)) {
    errors.push('Missing required field: gssVersion');
  } else if (typeof rec['gssVersion'] !== 'string') {
    errors.push('gssVersion must be a string');
  }

  // corpusVersion
  if (!('corpusVersion' in rec)) {
    errors.push('Missing required field: corpusVersion');
  } else if (typeof rec['corpusVersion'] !== 'string') {
    errors.push('corpusVersion must be a string');
  }

  // generatedAt
  if (!('generatedAt' in rec)) {
    errors.push('Missing required field: generatedAt');
  } else if (typeof rec['generatedAt'] !== 'string') {
    errors.push('generatedAt must be a string');
  } else {
    // Verify ISO 8601-ish format
    const iso = rec['generatedAt'] as string;
    if (!/\d{4}-\d{2}-\d{2}T/.test(iso)) {
      warnings.push('generatedAt does not appear to be ISO 8601 formatted');
    }
  }

  // consultationMode
  if (!('consultationMode' in rec)) {
    errors.push('Missing required field: consultationMode');
  } else if (typeof rec['consultationMode'] !== 'string') {
    errors.push('consultationMode must be a string');
  } else if (!VALID_CONSULTATION_MODES.includes(rec['consultationMode'])) {
    errors.push(`Invalid consultationMode: '${rec['consultationMode']}' (expected: required, optional, or not-applicable)`);
  } else {
    // Mode-specific checks
    const mode = rec['consultationMode'] as ConsultationMode;

    if (mode === 'required') {
      if (!('consultation' in rec)) {
        errors.push('consultationMode is "required" but "consultation" section is missing');
      } else if (typeof rec['consultation'] !== 'object' || rec['consultation'] === null) {
        errors.push('consultation must be a non-null object when consultationMode is "required"');
      }
    }

    if (mode === 'not-applicable' && 'consultation' in rec) {
      warnings.push('consultationMode is "not-applicable" but "consultation" section is present — should be omitted');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
