/**
 * Corpus Validators
 *
 * Validates a corpus snapshot against a set of rules.
 * Hard errors cause the build to fail; warnings are logged but don't block.
 */

import type { CorpusSnapshot, SecurityDoc, WorkflowId } from '../core/types.js';
import { ALL_KNOWN_IDS } from './ids.js';

/**
 * Validation severity.
 */
type Severity = 'error' | 'warning';

/**
 * A single validation issue.
 */
export interface ValidationIssue {
  /** Validation rule that was violated */
  rule: string;
  /** Severity of the issue */
  severity: Severity;
  /** Human-readable description */
  message: string;
}

/**
 * Result of validating a corpus snapshot.
 */
export interface ValidationResult {
  /** Whether the snapshot passed all hard-error rules */
  valid: boolean;
  /** Hard errors (must fix) */
  errors: ValidationIssue[];
  /** Warnings (should fix) */
  warnings: ValidationIssue[];
}

/**
 * A single validation rule.
 */
interface ValidationRule {
  /** Rule identifier */
  id: string;
  /** Human-readable description */
  description: string;
  /** Default severity */
  defaultSeverity: Severity;
  /** Validation function */
  validate(snapshot: CorpusSnapshot): ValidationIssue[];
}

/**
 * All validation rules.
 */
const RULES: ValidationRule[] = [
  {
    id: 'unique-ids',
    description: 'No duplicate SecurityDoc.id values',
    defaultSeverity: 'error',
    validate(snapshot: CorpusSnapshot): ValidationIssue[] {
      const seen = new Map<string, number>();
      for (const doc of snapshot.documents) {
        seen.set(doc.id, (seen.get(doc.id) ?? 0) + 1);
      }
      const issues: ValidationIssue[] = [];
      for (const [id, count] of seen) {
        if (count > 1) {
          issues.push({
            rule: 'unique-ids',
            severity: 'error',
            message: `Duplicate ID: "${id}" appears ${count} times`,
          });
        }
      }
      return issues;
    },
  },

  {
    id: 'unique-uris',
    description: 'No duplicate SecurityDoc.uri values',
    defaultSeverity: 'error',
    validate(snapshot: CorpusSnapshot): ValidationIssue[] {
      const seen = new Map<string, number>();
      for (const doc of snapshot.documents) {
        seen.set(doc.uri, (seen.get(doc.uri) ?? 0) + 1);
      }
      const issues: ValidationIssue[] = [];
      for (const [uri, count] of seen) {
        if (count > 1) {
          issues.push({
            rule: 'unique-uris',
            severity: 'error',
            message: `Duplicate URI: "${uri}" appears ${count} times`,
          });
        }
      }
      return issues;
    },
  },

  {
    id: 'valid-related-edges',
    description: 'All relatedDocIds resolve to existing docs',
    defaultSeverity: 'error',
    validate(snapshot: CorpusSnapshot): ValidationIssue[] {
      const allIds = new Set(snapshot.documents.map(d => d.id));
      const issues: ValidationIssue[] = [];
      for (const doc of snapshot.documents) {
        for (const refId of doc.relatedDocIds) {
          if (!allIds.has(refId)) {
            issues.push({
              rule: 'valid-related-edges',
              severity: 'error',
              message: `Doc "${doc.id}" references non-existent relatedDocId "${refId}"`,
            });
          }
        }
      }
      return issues;
    },
  },

  {
    id: 'valid-workflow-ids',
    description: 'All workflowBindings[].workflowId are valid WorkflowId values',
    defaultSeverity: 'error',
    validate(snapshot: CorpusSnapshot): ValidationIssue[] {
      const validIds = new Set<string>([
        'security-review', 'map-codebase', 'threat-model', 'audit',
        'validate-findings', 'plan-remediation', 'execute-remediation',
        'verify', 'report',
      ]);
      const issues: ValidationIssue[] = [];
      for (const doc of snapshot.documents) {
        for (const wb of doc.workflowBindings) {
          if (!validIds.has(wb.workflowId)) {
            issues.push({
              rule: 'valid-workflow-ids',
              severity: 'error',
              message: `Doc "${doc.id}" has invalid workflowId "${wb.workflowId}"`,
            });
          }
        }
      }
      return issues;
    },
  },

  {
    id: 'valid-stack-tags',
    description: 'All stackBindings[].stack are known canonical tags',
    defaultSeverity: 'warning',
    validate(snapshot: CorpusSnapshot): ValidationIssue[] {
      // Known canonical tags from stack-normalizer.ts STACK_ALIASES values
      const knownTags = new Set([
        'nodejs', 'javascript', 'python', 'django', 'ruby', 'rails',
        'java', 'csharp', 'dotnet', 'php', 'laravel', 'symfony',
        'docker', 'kubernetes', 'aws', 'aws-lambda', 'serverless', 'faas',
        'azure', 'gcp', 'terraform', 'cloudformation', 'iac',
        'graphql', 'rest', 'grpc', 'soap',
        'mongodb', 'sql', 'redis', 'elasticsearch',
        // Additional tags from mapping.ts stack conditions
        'npm', 'drf', 'jwt', 'k8s',
      ]);
      const issues: ValidationIssue[] = [];
      for (const doc of snapshot.documents) {
        for (const sb of doc.stackBindings) {
          if (!knownTags.has(sb.stack)) {
            issues.push({
              rule: 'valid-stack-tags',
              severity: 'warning',
              message: `Doc "${doc.id}" has unknown stack tag "${sb.stack}"`,
            });
          }
        }
      }
      return issues;
    },
  },

  {
    id: 'required-fields',
    description: 'Required fields are present on all documents',
    defaultSeverity: 'error',
    validate(snapshot: CorpusSnapshot): ValidationIssue[] {
      const required = ['id', 'uri', 'title', 'sourceUrl', 'summary', 'status'];
      const issues: ValidationIssue[] = [];
      for (const doc of snapshot.documents) {
        for (const field of required) {
          const value = (doc as unknown as Record<string, unknown>)[field];
          if (value === undefined || value === null || value === '') {
            issues.push({
              rule: 'required-fields',
              severity: 'error',
              message: `Doc "${doc.id || '(unknown)'}" missing required field "${field}"`,
            });
          }
        }
      }
      return issues;
    },
  },

  {
    id: 'snapshot-metadata',
    description: 'Snapshot metadata fields are present',
    defaultSeverity: 'error',
    validate(snapshot: CorpusSnapshot): ValidationIssue[] {
      const issues: ValidationIssue[] = [];
      if (snapshot.schemaVersion !== 1) {
        issues.push({
          rule: 'snapshot-metadata',
          severity: 'error',
          message: `Invalid schemaVersion: expected 1, got ${snapshot.schemaVersion}`,
        });
      }
      if (!snapshot.corpusVersion) {
        issues.push({
          rule: 'snapshot-metadata',
          severity: 'error',
          message: 'Missing corpusVersion',
        });
      }
      if (!snapshot.generatedAt) {
        issues.push({
          rule: 'snapshot-metadata',
          severity: 'error',
          message: 'Missing generatedAt',
        });
      }
      return issues;
    },
  },

  {
    id: 'issue-type-validity',
    description: 'All issueTypes are valid IssueTag values',
    defaultSeverity: 'warning',
    validate(snapshot: CorpusSnapshot): ValidationIssue[] {
      const knownTags = new Set([
        'injection', 'sql-injection', 'nosql-injection', 'command-injection',
        'ldap-injection', 'xss', 'dom-xss', 'dom-clobbering', 'authn', 'authz',
        'access-control', 'session-management', 'password-storage', 'mfa',
        'secrets', 'crypto', 'key-management', 'file-upload', 'deserialization',
        'ssrf', 'xxe', 'csrf', 'config', 'security-headers', 'csp', 'hsts',
        'tls', 'logging', 'error-handling', 'supply-chain', 'dependency',
        'ai-security', 'mcp-security', 'prompt-injection', 'clickjacking', 'idor',
        'mass-assignment', 'prototype-pollution', 'subdomain-takeover', 'redirect',
        'privacy', 'virtual-patching', 'xss-evasion', 'xs-leaks',
        // Non-canonical tags from mapping.ts specialistDetails
        'disclosure', 'reporting', 'terminology',
      ]);
      const issues: ValidationIssue[] = [];
      for (const doc of snapshot.documents) {
        for (const tag of doc.issueTypes) {
          if (!knownTags.has(tag)) {
            issues.push({
              rule: 'issue-type-validity',
              severity: 'warning',
              message: `Doc "${doc.id}" has unknown issueType "${tag}"`,
            });
          }
        }
      }
      return issues;
    },
  },

  // Optional stronger checks
  {
    id: 'workflow-coverage',
    description: 'Each workflow has at least one required doc',
    defaultSeverity: 'warning',
    validate(snapshot: CorpusSnapshot): ValidationIssue[] {
      const workflowIds: WorkflowId[] = [
        'security-review', 'map-codebase', 'threat-model', 'audit',
        'validate-findings', 'plan-remediation', 'execute-remediation',
        'verify', 'report',
      ];
      const issues: ValidationIssue[] = [];

      for (const wfId of workflowIds) {
        const hasRequired = snapshot.documents.some(doc =>
          doc.workflowBindings.some(b => b.workflowId === wfId && b.priority === 'required')
        );
        if (!hasRequired) {
          issues.push({
            rule: 'workflow-coverage',
            severity: 'warning',
            message: `Workflow "${wfId}" has no required documents`,
          });
        }
      }
      return issues;
    },
  },

  {
    id: 'no-orphans',
    description: 'No doc is unbound to all workflows unless status is pending',
    defaultSeverity: 'warning',
    validate(snapshot: CorpusSnapshot): ValidationIssue[] {
      const issues: ValidationIssue[] = [];
      for (const doc of snapshot.documents) {
        if (doc.workflowBindings.length === 0 && doc.status !== 'pending') {
          issues.push({
            rule: 'no-orphans',
            severity: 'warning',
            message: `Doc "${doc.id}" has no workflow bindings and status is "${doc.status}"`,
          });
        }
      }
      return issues;
    },
  },
];

/**
 * Validate a corpus snapshot against all rules.
 *
 * @param snapshot - The snapshot to validate
 * @returns Validation result with errors and warnings
 */
export function validateSnapshot(snapshot: CorpusSnapshot): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  for (const rule of RULES) {
    const issues = rule.validate(snapshot);
    for (const issue of issues) {
      if (issue.severity === 'error') {
        errors.push(issue);
      } else {
        warnings.push(issue);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
