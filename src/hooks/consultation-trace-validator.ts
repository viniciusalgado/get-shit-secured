/**
 * Consultation trace validator.
 *
 * Validates the `consultation` section of a workflow artifact against the
 * expected structure. Used by the post-tool-write hook to verify that
 * consultation traces are well-formed and internally consistent.
 *
 * Phase 12 extension: respects `consultationMode` from the workflow
 * definition or from the artifact envelope.
 *
 * Supports two trace formats:
 * 1. ConsultationTrace format (flat): coverageStatus at consultation level
 * 2. Legacy validation format: coverageStatus nested under consultation.validation
 *
 * @module hooks/consultation-trace-validator
 */

import type { ConsultationMode, WorkflowId } from '../core/types.js';

/**
 * Consultation trace validation result.
 */
export interface ConsultationTraceValidation {
  /** Whether the trace passed all checks */
  valid: boolean;
  /** Error messages */
  errors: string[];
  /** Warning messages */
  warnings: string[];
  /** Coverage status extracted from the trace */
  coverageStatus: 'pass' | 'warn' | 'fail' | 'missing' | 'not-applicable';
}

/**
 * Get the consultation mode for a workflow.
 * Checks the artifact envelope first, then falls back to null.
 */
function getConsultationMode(
  artifact: Record<string, unknown>,
  _workflowId: string
): ConsultationMode | null {
  // Check envelope field first
  if ('consultationMode' in artifact && typeof artifact['consultationMode'] === 'string') {
    const mode = artifact['consultationMode'];
    if (['required', 'optional', 'not-applicable'].includes(mode)) {
      return mode as ConsultationMode;
    }
  }
  // Fall back to null — caller must resolve from registry if needed
  return null;
}

/**
 * Validate the consultation section of a workflow artifact.
 *
 * Phase 12 extension: respects `consultationMode`.
 * - not-applicable: returns immediately with valid=true, status 'not-applicable'
 * - optional: returns warnings instead of errors if trace is missing
 * - required: enforces strict validation (original behavior)
 *
 * Validation checks:
 * 1. `consultation` key exists
 * 2. `consultation.plan` is present and is a non-null object
 * 3. `consultation.validation` is present and contains `coverageStatus` (legacy format)
 *    OR `consultation.coverageStatus` is present (ConsultationTrace format)
 * 4. `consultation.consultedDocs` is an array of strings (or objects with id)
 * 5. `coverageStatus` is valid ('pass', 'warn', 'fail')
 * 6. If `coverageStatus` is 'fail', `requiredMissing` should be non-empty (consistency)
 *
 * Also validates `schemaVersion` field presence when present (Phase 12 envelope check).
 *
 * @param artifact - Parsed JSON artifact object
 * @param workflowId - Workflow ID for context in error messages
 * @returns Validation result
 */
export function validateConsultationTrace(
  artifact: Record<string, unknown>,
  workflowId: string
): ConsultationTraceValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Determine consultation mode
  const mode = getConsultationMode(artifact, workflowId);

  // Phase 12: validate schemaVersion presence
  if ('schemaVersion' in artifact) {
    if (typeof artifact['schemaVersion'] !== 'number') {
      errors.push('schemaVersion must be a number');
    }
  }

  // not-applicable: skip consultation checks entirely
  if (mode === 'not-applicable') {
    return {
      valid: true,
      errors: [],
      warnings: [],
      coverageStatus: 'not-applicable',
    };
  }

  // Check if consultation section is missing
  if (!('consultation' in artifact)) {
    // For optional mode, missing is not an error — just a warning
    if (mode === 'optional') {
      return {
        valid: true,
        errors: [],
        warnings: [`Artifact for workflow '${workflowId}' has no 'consultation' section (consultationMode is optional)`],
        coverageStatus: 'missing',
      };
    }
    // For required mode (or unknown), missing is an error
    return {
      valid: false,
      errors: [`Artifact for workflow '${workflowId}' is missing 'consultation' section`],
      warnings: [],
      coverageStatus: 'missing',
    };
  }

  const consultation = artifact['consultation'];
  if (!consultation || typeof consultation !== 'object' || Array.isArray(consultation)) {
    return {
      valid: false,
      errors: [`'consultation' must be a non-null object in workflow '${workflowId}'`],
      warnings: [],
      coverageStatus: 'missing',
    };
  }

  const consult = consultation as Record<string, unknown>;

  // 2. consultation.plan must be present and non-null
  if (!('plan' in consult) || consult['plan'] === null || consult['plan'] === undefined) {
    errors.push('Missing consultation.plan');
  } else if (typeof consult['plan'] !== 'object' || Array.isArray(consult['plan'])) {
    errors.push('consultation.plan must be a non-null object');
  }

  // 3. Determine if this is legacy format (validation sub-object) or ConsultationTrace format (flat)
  const hasValidationKey = 'validation' in consult;
  const hasValidationObj = hasValidationKey &&
    consult['validation'] !== null &&
    consult['validation'] !== undefined &&
    typeof consult['validation'] === 'object' &&
    !Array.isArray(consult['validation']);

  let coverageStatusValue: string | undefined;
  let requiredMissingValue: unknown;

  if (hasValidationObj) {
    // Legacy format: coverageStatus under consultation.validation
    const validationObj = consult['validation'] as Record<string, unknown>;

    // 4. consultation.consultedDocs must be an array (if present)
    if ('consultedDocs' in consult) {
      if (!Array.isArray(consult['consultedDocs'])) {
        errors.push('consultation.consultedDocs must be an array');
      } else {
        const docs = consult['consultedDocs'] as unknown[];
        for (let i = 0; i < docs.length; i++) {
          if (typeof docs[i] !== 'string') {
            errors.push(`consultation.consultedDocs[${i}] must be a string`);
            break;
          }
        }
      }
    }

    // 5. coverageStatus must be valid
    const status = validationObj['coverageStatus'];
    if (!status || typeof status !== 'string') {
      errors.push('Missing coverageStatus in consultation.validation');
      return {
        valid: false,
        errors,
        warnings,
        coverageStatus: 'missing',
      };
    }

    const validStatuses = ['pass', 'warn', 'fail'];
    if (!validStatuses.includes(status)) {
      errors.push(`Invalid coverageStatus: '${status}' (expected: pass, warn, or fail)`);
      return {
        valid: false,
        errors,
        warnings,
        coverageStatus: 'missing',
      };
    }

    coverageStatusValue = status;
    requiredMissingValue = validationObj['requiredMissing'];
  } else if (!hasValidationKey && 'coverageStatus' in consult && typeof consult['coverageStatus'] === 'string') {
    // ConsultationTrace format with plan sub-object but no validation sub-object
    // coverageStatus is at the consultation level (flat ConsultationTrace format)
    if ('consultedDocs' in consult) {
      if (!Array.isArray(consult['consultedDocs'])) {
        errors.push('consultation.consultedDocs must be an array');
      } else {
        const docs = consult['consultedDocs'] as unknown[];
        for (let i = 0; i < docs.length; i++) {
          const doc = docs[i];
          if (typeof doc !== 'string' && (typeof doc !== 'object' || doc === null || !('id' in (doc as Record<string, unknown>)))) {
            errors.push(`consultation.consultedDocs[${i}] must be a string or object with 'id' field`);
            break;
          }
        }
      }
    }

    const status = consult['coverageStatus'];
    const validStatuses = ['pass', 'warn', 'fail'];
    if (!validStatuses.includes(status)) {
      errors.push(`Invalid coverageStatus: '${status}' (expected: pass, warn, or fail)`);
      return {
        valid: false,
        errors,
        warnings,
        coverageStatus: 'missing',
      };
    }

    coverageStatusValue = status;
    requiredMissingValue = consult['requiredMissing'];
  } else if (!hasValidationKey && 'plan' in consult) {
    // Legacy format: plan exists but no validation sub-object and no flat coverageStatus — error
    errors.push('Missing consultation.validation');
    return {
      valid: false,
      errors,
      warnings,
      coverageStatus: 'missing',
    };
  } else if (hasValidationKey && !hasValidationObj) {
    // validation key exists but is null/invalid
    if (consult['validation'] === null || consult['validation'] === undefined) {
      errors.push('Missing consultation.validation');
      return {
        valid: false,
        errors,
        warnings,
        coverageStatus: 'missing',
      };
    }
    // validation is present but not an object — fall through to ConsultationTrace format check
    // Check flat coverageStatus
    if ('coverageStatus' in consult && typeof consult['coverageStatus'] === 'string') {
      coverageStatusValue = consult['coverageStatus'];
      requiredMissingValue = consult['requiredMissing'];
    }
  } else {
    // ConsultationTrace format: coverageStatus at consultation level
    if ('consultedDocs' in consult) {
      if (!Array.isArray(consult['consultedDocs'])) {
        errors.push('consultation.consultedDocs must be an array');
      } else {
        const docs = consult['consultedDocs'] as unknown[];
        for (let i = 0; i < docs.length; i++) {
          const doc = docs[i];
          if (typeof doc !== 'string' && (typeof doc !== 'object' || doc === null || !('id' in (doc as Record<string, unknown>)))) {
            errors.push(`consultation.consultedDocs[${i}] must be a string or object with 'id' field`);
            break;
          }
        }
      }
    }

    // Check coverageStatus at top level
    const status = consult['coverageStatus'];
    if (!status || typeof status !== 'string') {
      errors.push('Missing coverageStatus in consultation');
      return {
        valid: false,
        errors,
        warnings,
        coverageStatus: 'missing',
      };
    }

    const validStatuses = ['pass', 'warn', 'fail'];
    if (!validStatuses.includes(status)) {
      errors.push(`Invalid coverageStatus: '${status}' (expected: pass, warn, or fail)`);
      return {
        valid: false,
        errors,
        warnings,
        coverageStatus: 'missing',
      };
    }

    coverageStatusValue = status;
    requiredMissingValue = consult['requiredMissing'];
  }

  const coverageStatus = coverageStatusValue as 'pass' | 'warn' | 'fail';

  // 6. Consistency check: if coverageStatus is 'fail', requiredMissing should be non-empty
  if (coverageStatus === 'fail') {
    if (Array.isArray(requiredMissingValue) && requiredMissingValue.length === 0) {
      warnings.push('coverageStatus is "fail" but requiredMissing is empty — inconsistent state');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    coverageStatus,
  };
}
