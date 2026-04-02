/**
 * Artifact structural validation rules.
 *
 * Used by the post-tool-write hook to validate artifact quality after
 * workflow writes. Each workflow defines:
 * - Required top-level JSON fields
 * - Whether a consultation section is expected
 * - Whether coverage status must be present
 *
 * @module hooks/artifact-validator
 */

/**
 * Validation rule for a single workflow's artifact structure.
 */
export interface ArtifactValidationRule {
  /** Workflow ID this rule applies to */
  workflowId: string;
  /** Required top-level JSON fields */
  requiredFields: string[];
  /** Whether a consultation section is required */
  requiresConsultationTrace: boolean;
  /** Whether coverage status must be present */
  requiresCoverageStatus: boolean;
  /** Fields expected inside the consultation section */
  consultationFields: string[];
}

/**
 * Validation result for a single artifact.
 */
export interface ArtifactValidationResult {
  /** Whether the artifact passed all checks */
  valid: boolean;
  /** Error messages (blocking issues) */
  errors: string[];
  /** Warning messages (non-blocking issues) */
  warnings: string[];
  /** Coverage status extracted from the artifact */
  coverageStatus: 'pass' | 'warn' | 'fail' | 'missing' | 'not-applicable';
}

/**
 * Artifact validation rules for all 9 GSS workflows.
 *
 * Consultation-requiring workflows (audit, verify, plan-remediation,
 * execute-remediation, security-review, validate-findings) must include
 * a structured consultation trace with plan, validation, and consultedDocs.
 *
 * Non-consultation workflows (map-codebase, threat-model, report) have
 * lighter structural checks.
 */
export const ARTIFACT_VALIDATION_RULES: Record<string, ArtifactValidationRule> = {
  'audit': {
    workflowId: 'audit',
    requiredFields: ['findings', 'consultation'],
    requiresConsultationTrace: true,
    requiresCoverageStatus: true,
    consultationFields: ['plan', 'validation', 'consultedDocs'],
  },
  'verify': {
    workflowId: 'verify',
    requiredFields: ['verdicts', 'consultation'],
    requiresConsultationTrace: true,
    requiresCoverageStatus: true,
    consultationFields: ['plan', 'validation', 'consultedDocs'],
  },
  'plan-remediation': {
    workflowId: 'plan-remediation',
    requiredFields: ['patches', 'consultation'],
    requiresConsultationTrace: true,
    requiresCoverageStatus: true,
    consultationFields: ['plan', 'validation', 'consultedDocs'],
  },
  'execute-remediation': {
    workflowId: 'execute-remediation',
    requiredFields: ['applied', 'consultation'],
    requiresConsultationTrace: true,
    requiresCoverageStatus: true,
    consultationFields: ['plan', 'validation', 'consultedDocs'],
  },
  'security-review': {
    workflowId: 'security-review',
    requiredFields: ['scope', 'findings', 'consultation'],
    requiresConsultationTrace: true,
    requiresCoverageStatus: true,
    consultationFields: ['plan', 'validation', 'consultedDocs'],
  },
  'validate-findings': {
    workflowId: 'validate-findings',
    requiredFields: ['validated', 'consultation'],
    requiresConsultationTrace: true,
    requiresCoverageStatus: true,
    consultationFields: ['plan', 'validation'],
  },
  'threat-model': {
    workflowId: 'threat-model',
    requiredFields: ['threats', 'components'],
    requiresConsultationTrace: false,
    requiresCoverageStatus: false,
    consultationFields: [],
  },
  'map-codebase': {
    workflowId: 'map-codebase',
    requiredFields: ['components', 'dependencies', 'dataFlows'],
    requiresConsultationTrace: false,
    requiresCoverageStatus: false,
    consultationFields: [],
  },
  'report': {
    workflowId: 'report',
    requiredFields: ['summary', 'findings'],
    requiresConsultationTrace: false,
    requiresCoverageStatus: false,
    consultationFields: [],
  },
};

/**
 * Validate an artifact against its workflow's structural expectations.
 *
 * @param artifact - Parsed JSON artifact object
 * @param workflowId - Workflow ID extracted from the artifact path
 * @returns Validation result with errors, warnings, and coverage status
 */
export function validateArtifact(
  artifact: Record<string, unknown>,
  workflowId: string
): ArtifactValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const rule = ARTIFACT_VALIDATION_RULES[workflowId];

  if (!rule) {
    // Unknown workflow — don't validate, just note it
    return {
      valid: true,
      errors: [],
      warnings: [`No validation rule for workflow '${workflowId}'`],
      coverageStatus: 'not-applicable',
    };
  }

  // Check required top-level fields
  for (const field of rule.requiredFields) {
    if (!(field in artifact)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Validate consultation trace if required
  let coverageStatus: ArtifactValidationResult['coverageStatus'] = 'not-applicable';

  if (rule.requiresConsultationTrace) {
    const consultation = artifact['consultation'];

    if (!consultation || typeof consultation !== 'object' || consultation === null) {
      errors.push('Missing consultation trace section');
      coverageStatus = 'missing';
    } else {
      const consultObj = consultation as Record<string, unknown>;

      // Check consultation sub-fields
      for (const field of rule.consultationFields) {
        if (!(field in consultObj)) {
          errors.push(`Missing consultation field: ${field}`);
        }
      }

      // Check coverage status
      if (rule.requiresCoverageStatus) {
        const validation = consultObj['validation'];
        if (!validation || typeof validation !== 'object' || validation === null) {
          errors.push('Missing consultation.validation section');
          coverageStatus = 'missing';
        } else {
          const validationObj = validation as Record<string, unknown>;
          const status = validationObj['coverageStatus'];

          if (!status || typeof status !== 'string') {
            errors.push('Missing coverageStatus in consultation.validation');
            coverageStatus = 'missing';
          } else if (!['pass', 'warn', 'fail'].includes(status)) {
            errors.push(`Invalid coverageStatus: '${status}' (expected pass/warn/fail)`);
            coverageStatus = 'missing';
          } else {
            coverageStatus = status as 'pass' | 'warn' | 'fail';

            // Consistency check: if coverageStatus is 'fail', requiredMissing should be non-empty
            if (status === 'fail') {
              const requiredMissing = validationObj['requiredMissing'];
              if (Array.isArray(requiredMissing) && requiredMissing.length === 0) {
                warnings.push('coverageStatus is "fail" but requiredMissing is empty — inconsistent');
              }
            }
          }
        }
      }

      // Check consultedDocs is an array
      if ('consultedDocs' in rule.consultationFields || rule.consultationFields.includes('consultedDocs')) {
        if ('consultedDocs' in consultObj) {
          if (!Array.isArray(consultObj['consultedDocs'])) {
            errors.push('consultation.consultedDocs must be an array');
          }
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    coverageStatus,
  };
}
