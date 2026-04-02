/**
 * Consultation trace validator.
 *
 * Validates the `consultation` section of a workflow artifact against the
 * expected structure. Used by the post-tool-write hook to verify that
 * consultation traces are well-formed and internally consistent.
 *
 * @module hooks/consultation-trace-validator
 */

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
 * Validate the consultation section of a workflow artifact.
 *
 * Expected structure (for consultation-requiring workflows):
 * ```json
 * {
 *   "consultation": {
 *     "plan": { ... ConsultationPlan fields },
 *     "validation": { ... ConsultationValidation fields },
 *     "consultedDocs": ["doc-id-1", "doc-id-2", ...]
 *   }
 * }
 * ```
 *
 * Validation checks:
 * 1. `consultation` key exists
 * 2. `consultation.plan` is present and is a non-null object
 * 3. `consultation.validation` is present and contains `coverageStatus`
 * 4. `consultation.consultedDocs` is an array of strings
 * 5. `consultation.validation.coverageStatus` is valid ('pass', 'warn', 'fail')
 * 6. If `coverageStatus` is 'fail', `requiredMissing` should be non-empty (consistency)
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

  // 1. consultation key must exist
  if (!('consultation' in artifact)) {
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

  // 3. consultation.validation must be present
  if (!('validation' in consult) || consult['validation'] === null || consult['validation'] === undefined) {
    errors.push('Missing consultation.validation');
    return {
      valid: false,
      errors,
      warnings,
      coverageStatus: 'missing',
    };
  }

  const validation = consult['validation'];
  if (typeof validation !== 'object' || Array.isArray(validation) || validation === null) {
    errors.push('consultation.validation must be a non-null object');
    return {
      valid: false,
      errors,
      warnings,
      coverageStatus: 'missing',
    };
  }

  const validationObj = validation as Record<string, unknown>;

  // 4. consultation.consultedDocs must be an array (if present in consultation)
  if ('consultedDocs' in consult) {
    if (!Array.isArray(consult['consultedDocs'])) {
      errors.push('consultation.consultedDocs must be an array');
    } else {
      // Check all entries are strings
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

  const coverageStatus = status as 'pass' | 'warn' | 'fail';

  // 6. Consistency check: if coverageStatus is 'fail', requiredMissing should be non-empty
  if (coverageStatus === 'fail') {
    const requiredMissing = validationObj['requiredMissing'];
    if (Array.isArray(requiredMissing) && requiredMissing.length === 0) {
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
