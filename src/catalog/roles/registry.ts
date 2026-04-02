/**
 * Shared role definition catalog.
 *
 * Centralizes role metadata that both Claude and Codex adapters consume.
 * Phase 10 — Workstream A: Eliminates inline role duplication between adapters.
 *
 * Each role maps to a primary workflow and provides a human-readable title
 * and description used in agent/skill rendering.
 */

import type { WorkflowId } from '../../core/types.js';

/**
 * A role definition representing a fixed judgment mode in the GSS framework.
 */
export interface RoleDefinition {
  /** Unique role identifier (e.g., 'gss-mapper') */
  id: string;
  /** Human-readable title */
  title: string;
  /** One-sentence description of the role's purpose */
  description: string;
  /** Primary workflow this role is associated with */
  primaryWorkflow: WorkflowId;
}

/**
 * Canonical list of GSS role definitions.
 * Both Claude (agents) and Codex (skills) consume this single source of truth.
 *
 * Changes to this list must be reflected in:
 * - RoleAgentId type in types.ts
 * - Role rendering tests in test/unit/catalog/roles-registry.test.js
 */
export const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    id: 'gss-mapper',
    title: 'Codebase Mapper',
    description: 'Analyzes codebase structure, dependencies, and security-relevant patterns',
    primaryWorkflow: 'map-codebase',
  },
  {
    id: 'gss-threat-modeler',
    title: 'Threat Modeler',
    description: 'Generates threat models and identifies security risks',
    primaryWorkflow: 'threat-model',
  },
  {
    id: 'gss-auditor',
    title: 'Security Auditor',
    description: 'Performs security audits based on OWASP standards',
    primaryWorkflow: 'audit',
  },
  {
    id: 'gss-remediator',
    title: 'Security Remediator',
    description: 'Plans and applies security fixes with minimal safe changes',
    primaryWorkflow: 'plan-remediation',
  },
  {
    id: 'gss-verifier',
    title: 'Security Verifier',
    description: 'Verifies security fixes and runs validation checks',
    primaryWorkflow: 'verify',
  },
  {
    id: 'gss-reporter',
    title: 'Security Reporter',
    description: 'Generates comprehensive security reports',
    primaryWorkflow: 'report',
  },
];

/**
 * Look up a role definition by ID.
 */
export function getRoleDefinition(id: string): RoleDefinition | undefined {
  return ROLE_DEFINITIONS.find(r => r.id === id);
}

/**
 * Get all role definitions.
 * Returns a shallow copy to prevent external mutation.
 */
export function getAllRoles(): RoleDefinition[] {
  return [...ROLE_DEFINITIONS];
}
