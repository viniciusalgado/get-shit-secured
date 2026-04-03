/**
 * DEPRECATED: This module is part of the legacy specialist pipeline.
 * Superseded by src/core/consultation-compliance.ts (Phase 4).
 * Retained for --legacy-specialists backward compatibility only.
 * Removal target: Release C (see migration-plan/retirement-checklist.md).
 *
 * Delegation Compliance Validator
 *
 * Validates workflow execution against the computed delegation plan.
 * Enforces required specialist consultations, detects unauthorized
 * consults, and produces a DelegationComplianceReport.
 */

import type {
  WorkflowId,
  DelegationPlan,
  SpecialistExecutionRecord,
  DelegationComplianceReport,
  DelegationComplianceIssue,
} from './types.js';
import { DELEGATION_COMPLIANCE_SCHEMA_VERSION } from './types.js';

/**
 * @deprecated Legacy delegation compliance. Superseded by consultation-compliance.ts.
 * Retained only for --legacy-specialists mode. Remove in Release C.
 * Replacement: validateConsultationCoverage() in consultation-compliance.ts
 *
 * Validate execution records against a delegation plan.
 *
 * @param plan - The delegation plan that was computed
 * @param executionRecords - Actual specialist consultations that occurred
 * @returns A compliance report with pass/fail status and issues
 */
export function validateCompliance(
  plan: DelegationPlan,
  executionRecords: SpecialistExecutionRecord[]
): DelegationComplianceReport {
  const issues: DelegationComplianceIssue[] = [];

  // Build lookup maps
  const planRequired = new Map<string, Set<string>>(); // specialistId -> subjectIds
  const planOptional = new Set<string>();
  const planFollowUp = new Set<string>();
  const planAllowed = new Set<string>();

  for (const entry of plan.entries) {
    planAllowed.add(entry.specialistId);

    switch (entry.requirement) {
      case 'required': {
        const subjects = planRequired.get(entry.specialistId) || new Set<string>();
        subjects.add(entry.subjectId);
        planRequired.set(entry.specialistId, subjects);
        break;
      }
      case 'optional':
        planOptional.add(entry.specialistId);
        break;
      case 'derived-follow-up':
        planFollowUp.add(entry.specialistId);
        break;
    }
  }

  // Track execution
  const executedSpecialists = new Map<string, SpecialistExecutionRecord[]>();

  for (const record of executionRecords) {
    const list = executedSpecialists.get(record.specialistId) || [];
    list.push(record);
    executedSpecialists.set(record.specialistId, list);
  }

  // Check for missing required consultations
  for (const [specialistId, subjectIds] of planRequired) {
    const records = executedSpecialists.get(specialistId);
    if (!records || records.length === 0) {
      for (const subjectId of subjectIds) {
        issues.push({
          type: 'missing-required',
          specialistId,
          subjectId,
          description: `Required specialist ${specialistId} was not consulted for subject ${subjectId}`,
        });
      }
    }
  }

  // Check execution records for validity
  for (const [specialistId, records] of executedSpecialists) {
    // Check for unauthorized consults
    if (!planAllowed.has(specialistId) && !plan.constraints.allowOutOfPlanConsults) {
      for (const record of records) {
        issues.push({
          type: 'unauthorized-consult',
          specialistId,
          subjectId: record.subjectId,
          description: `Specialist ${specialistId} was consulted but is not in the delegation plan`,
        });
      }
      continue;
    }

    // Check for malformed verdicts
    for (const record of records) {
      if (!record.verdict || typeof record.confidence !== 'number') {
        issues.push({
          type: 'malformed-verdict',
          specialistId,
          subjectId: record.subjectId,
          description: `Specialist ${specialistId} returned a malformed verdict (missing verdict or confidence)`,
        });
      }

      // Check for unsupported follow-ups
      if (record.followUpSpecialists) {
        for (const followUpId of record.followUpSpecialists) {
          if (!planAllowed.has(followUpId) && !planFollowUp.has(followUpId)) {
            issues.push({
              type: 'unsupported-follow-up',
              specialistId: followUpId,
              subjectId: record.subjectId,
              description: `Follow-up specialist ${followUpId} recommended by ${specialistId} is not in the delegation plan`,
            });
          }
        }
      }
    }

    // Check for duplicates (multiple records for same specialist+subject)
    const seenSubjectSpecialist = new Map<string, number>();
    for (const record of records) {
      const key = `${record.specialistId}::${record.subjectId}`;
      const count = seenSubjectSpecialist.get(key) || 0;
      if (count > 0) {
        issues.push({
          type: 'duplicate-consult',
          specialistId,
          subjectId: record.subjectId,
          description: `Specialist ${specialistId} was consulted ${count + 1} times for subject ${record.subjectId}`,
        });
      }
      seenSubjectSpecialist.set(key, count + 1);
    }
  }

  // Compute stats
  const requiredConsulted = [...planRequired.keys()].filter(id => executedSpecialists.has(id)).length;
  const requiredTotal = planRequired.size;
  const optionalConsulted = [...planOptional].filter(id => executedSpecialists.has(id)).length;
  const followUpConsulted = [...planFollowUp].filter(id => executedSpecialists.has(id)).length;
  const unauthorizedCount = issues.filter(i => i.type === 'unauthorized-consult').length;

  // Determine overall status
  const hasMissingRequired = issues.some(i => i.type === 'missing-required');
  const hasMalformed = issues.some(i => i.type === 'malformed-verdict');
  const status = (hasMissingRequired || hasMalformed) ? 'fail' : 'pass';

  return {
    schemaVersion: DELEGATION_COMPLIANCE_SCHEMA_VERSION,
    workflowId: plan.workflowId,
    checkedAt: new Date().toISOString(),
    status,
    issues,
    requiredConsulted,
    requiredTotal,
    optionalConsulted,
    followUpConsulted,
    unauthorizedCount,
  };
}
