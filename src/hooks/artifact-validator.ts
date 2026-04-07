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
import { appendFileSync, statSync, existsSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { canonicalize } from '../core/sanitize.js';

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
  /** SHA-256 content hash for audit trail */
  contentHash?: string;
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

  // Compute content hash for audit trail (SRV-001: uses canonicalize())
  const contentHash = computeHookContentHash(artifact);

  // Append audit log entry (SRV-002: path-aware, SRV-006: rotated)
  appendAuditLog(workflowId, rule.artifactName, contentHash, result.valid, options?.artifactPath);

  return {
    valid: result.valid,
    errors: result.errors,
    warnings: [],
    coverageStatus: getCoverageStatus(artifact),
    artifactName: rule.artifactName,
    contentHash,
  };
}

// ---------------------------------------------------------------------------
// SRV-001: Deterministic content hash via recursive canonicalization
// ---------------------------------------------------------------------------

/**
 * Compute content hash for an artifact (excluding contentHash field).
 * Uses canonicalize() for deterministic nested key ordering.
 */
function computeHookContentHash(artifact: Record<string, unknown>): string {
  const { contentHash, ...rest } = artifact;
  return createHash('sha256').update(canonicalize(rest)).digest('hex');
}

// ---------------------------------------------------------------------------
// SRV-002: Audit log path derivation (not process.cwd())
// SRV-006: Audit log rotation with size limit
// ---------------------------------------------------------------------------

const MAX_AUDIT_LOG_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_AUDIT_LOG_FILES = 3;

/**
 * Resolve the .gss root directory from available context.
 * Priority: GSS_ROOT env var → artifactPath walk-up → cwd fallback.
 */
function resolveGssRoot(artifactPath?: string): string | null {
  // 1. Explicit environment variable
  if (process.env.GSS_ROOT) {
    return process.env.GSS_ROOT;
  }

  // 2. Walk up from artifact path to find .gss directory
  if (artifactPath) {
    const normalized = artifactPath.replace(/\\/g, '/');
    const gssIdx = normalized.indexOf('.gss/');
    if (gssIdx !== -1) {
      const candidate = normalized.substring(0, gssIdx + 3) + '.gss';
      if (existsSync(candidate)) return candidate;
    }
  }

  // 3. cwd fallback
  const cwdGss = join(process.cwd(), '.gss');
  return existsSync(cwdGss) ? cwdGss : null;
}

/**
 * Rotate audit log when it exceeds the size limit.
 * Keeps up to MAX_AUDIT_LOG_FILES rotated copies.
 */
function rotateAuditLogIfNeeded(logPath: string): void {
  try {
    if (!existsSync(logPath)) return;
    const stat = statSync(logPath);
    if (stat.size < MAX_AUDIT_LOG_SIZE) return;

    // Shift existing rotated files: .N → .N+1
    for (let i = MAX_AUDIT_LOG_FILES - 1; i >= 1; i--) {
      const rotatedPath = join(dirname(logPath), `artifact-log.${i}.jsonl`);
      const nextRotatedPath = join(dirname(logPath), `artifact-log.${i + 1}.jsonl`);
      if (existsSync(rotatedPath)) {
        renameSync(rotatedPath, nextRotatedPath);
      }
    }

    // Move current log to .1
    const firstRotated = join(dirname(logPath), 'artifact-log.1.jsonl');
    renameSync(logPath, firstRotated);
  } catch {
    // Rotation failure must not block operation
  }
}

/**
 * Append an audit log entry to .gss/artifact-log.jsonl.
 *
 * SRV-002: Derives log path from GSS_ROOT env var or artifact path
 * instead of process.cwd(), which may be unreliable in hook context.
 * SRV-006: Applies log rotation when file exceeds size limit.
 */
function appendAuditLog(
  workflowId: string,
  artifactName: string,
  contentHash: string,
  valid: boolean,
  artifactPath?: string,
): void {
  const logEntry = JSON.stringify({
    timestamp: new Date().toISOString(),
    workflowId,
    artifactName,
    contentHash,
    valid,
  }) + '\n';

  try {
    const gssRoot = resolveGssRoot(artifactPath);
    if (!gssRoot) return;
    const logPath = join(gssRoot, 'artifact-log.jsonl');
    rotateAuditLogIfNeeded(logPath);
    appendFileSync(logPath, logEntry, 'utf-8');
  } catch {
    // Audit logging failure must not block operation
  }
}
