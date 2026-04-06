/**
 * Artifact validation helpers for runtime hooks.
 *
 * Phase 14 uses the workflow artifact schema registry as the source of truth.
 * This module provides path-aware dispatch so runtime hooks can map a written
 * artifact back to its workflow artifact name before validating it.
 */

import type { WorkflowId } from '../core/types.js';
import { getAllWorkflows } from '../catalog/workflows/registry.js';
import { validateWorkflowArtifact } from '../runtime/workflow-artifact-schemas/index.js';

export interface HookArtifactRule {
  workflowId: WorkflowId;
  artifactName: string;
  path: string;
  requiresConsultationTrace: boolean;
}

export interface HookArtifactValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  coverageStatus: 'pass' | 'warn' | 'fail' | 'missing' | 'not-applicable';
  artifactName?: string;
}

export const ARTIFACT_VALIDATION_RULES: Record<string, HookArtifactRule[]> = Object.fromEntries(
  getAllWorkflows().map(workflow => [
    workflow.id,
    workflow.outputs.map(output => ({
      workflowId: workflow.id,
      artifactName: output.name,
      path: output.path,
      requiresConsultationTrace: workflow.id !== 'report' && output.name !== 'mitigation-requirements',
    })),
  ]),
) as Record<string, HookArtifactRule[]>;

function getCoverageStatus(artifact: Record<string, unknown>): HookArtifactValidationResult['coverageStatus'] {
  const consultation = artifact.consultation;
  if (!consultation || typeof consultation !== 'object') {
    return 'not-applicable';
  }

  const consultationRecord = consultation as Record<string, unknown>;
  const validation = consultationRecord.validation;
  if (validation && typeof validation === 'object') {
    const status = (validation as Record<string, unknown>).coverageStatus;
    if (status === 'pass' || status === 'warn' || status === 'fail') {
      return status;
    }
  }

  const flatStatus = consultationRecord.coverageStatus;
  if (flatStatus === 'pass' || flatStatus === 'warn' || flatStatus === 'fail') {
    return flatStatus;
  }

  return 'missing';
}

export function resolveArtifactRule(
  workflowId: WorkflowId,
  normalizedPath?: string,
  artifactName?: string,
): HookArtifactRule | null {
  const workflowRules = ARTIFACT_VALIDATION_RULES[workflowId] ?? [];

  if (artifactName) {
    return workflowRules.find(rule => rule.artifactName === artifactName) ?? null;
  }

  if (!normalizedPath) {
    return workflowRules[0] ?? null;
  }

  const normalized = normalizedPath.replace(/\\/g, '/');
  return workflowRules.find(rule => normalized.endsWith(rule.path)) ?? null;
}

export function validateArtifact(
  artifact: Record<string, unknown>,
  workflowId: WorkflowId,
  options?: { artifactName?: string; artifactPath?: string },
): HookArtifactValidationResult {
  const rule = resolveArtifactRule(workflowId, options?.artifactPath, options?.artifactName);
  if (!rule) {
    return {
      valid: true,
      errors: [],
      warnings: [`No artifact validation rule for workflow '${workflowId}'`],
      coverageStatus: 'not-applicable',
    };
  }

  const result = validateWorkflowArtifact(workflowId, rule.artifactName, artifact);
  return {
    valid: result.valid,
    errors: result.errors,
    warnings: [],
    coverageStatus: getCoverageStatus(artifact),
    artifactName: rule.artifactName,
  };
}
