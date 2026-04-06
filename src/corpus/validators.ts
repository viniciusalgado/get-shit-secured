/**
 * Corpus Validators
 */

import type { CorpusSnapshot, WorkflowId } from '../core/types.js';

type Severity = 'error' | 'warning';

export interface ValidationIssue {
  rule: string;
  severity: Severity;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

const WORKFLOW_IDS: WorkflowId[] = [
  'security-review', 'map-codebase', 'threat-model', 'audit',
  'validate-findings', 'plan-remediation', 'execute-remediation',
  'verify', 'report',
];

const MAX_AVERAGE_RELATED_DEGREE = 8;
const MAX_DOC_RELATED_PERCENTAGE = 0.25;
const NEAR_FULLY_CONNECTED_THRESHOLD = 0.9;
const MIN_ISSUE_TYPE_COVERAGE = 0.65;
const MIN_WORKFLOW_BINDING_COVERAGE = 0.7;
const MIN_CONTENT_COVERAGE = 0.75;
const MAX_REUSED_DOC_PERCENTAGE_WARNING = 0.4;

export function validateSnapshot(snapshot: CorpusSnapshot): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const push = (issue: ValidationIssue) => {
    (issue.severity === 'error' ? errors : warnings).push(issue);
  };

  const ids = new Set<string>();
  const uris = new Set<string>();
  const allIds = new Set(snapshot.documents.map(doc => doc.id));

  for (const doc of snapshot.documents) {
    const sections = doc.sections ?? [];
    const issueTypes = doc.issueTypes ?? [];
    const workflowBindings = doc.workflowBindings ?? [];
    const relatedDocIds = doc.relatedDocIds ?? [];

    if (ids.has(doc.id)) {
      push({ rule: 'unique-ids', severity: 'error', message: `Duplicate ID: "${doc.id}"` });
    }
    ids.add(doc.id);

    if (uris.has(doc.uri)) {
      push({ rule: 'unique-uris', severity: 'error', message: `Duplicate URI: "${doc.uri}"` });
    }
    uris.add(doc.uri);

    if (!doc.id || !doc.uri || !doc.title || !doc.sourceUrl || !doc.status) {
      push({ rule: 'required-fields', severity: 'error', message: `Doc "${doc.id || '(unknown)'}" is missing required fields` });
    }

    if (!doc.summary.trim()) {
      push({ rule: 'required-fields', severity: 'error', message: `Doc "${doc.id}" has an empty summary` });
    }

    if (doc.status === 'ready' && sections.length === 0 && doc.headings.length === 0 && doc.checklist.length === 0) {
      push({ rule: 'ready-doc-content', severity: 'error', message: `Ready doc "${doc.id}" has no normalized content` });
    }

    if (doc.status === 'pending' && !doc.summary.trim()) {
      push({ rule: 'pending-summary', severity: 'error', message: `Pending doc "${doc.id}" must provide a fallback summary` });
    }

    for (const relatedId of relatedDocIds) {
      if (!allIds.has(relatedId)) {
        push({
          rule: 'valid-related-edges',
          severity: 'error',
          message: `Doc "${doc.id}" references non-existent relatedDocId "${relatedId}"`,
        });
      }
    }

    for (const binding of workflowBindings) {
      if (!WORKFLOW_IDS.includes(binding.workflowId)) {
        push({
          rule: 'valid-workflow-ids',
          severity: 'error',
          message: `Doc "${doc.id}" has invalid workflowId "${binding.workflowId}"`,
        });
      }
    }

    if (workflowBindings.length === 0 && doc.status !== 'pending') {
      push({
        rule: 'no-orphans',
        severity: 'warning',
        message: `Doc "${doc.id}" has no workflow bindings and status is "${doc.status}"`,
      });
    }
  }

  if (snapshot.schemaVersion !== 2) {
    push({
      rule: 'snapshot-metadata',
      severity: 'error',
      message: `Invalid schemaVersion: expected 2, got ${snapshot.schemaVersion}`,
    });
  }

  for (const workflowId of WORKFLOW_IDS) {
    const hasRequired = snapshot.documents.some(doc =>
      doc.workflowBindings.some(binding => binding.workflowId === workflowId && binding.priority === 'required'),
    );
    if (!hasRequired) {
      push({
        rule: 'workflow-coverage',
        severity: 'warning',
        message: `Workflow "${workflowId}" has no required documents`,
      });
    }
  }

  applySemanticRules(snapshot, push);

  return { valid: errors.length === 0, errors, warnings };
}

function applySemanticRules(
  snapshot: CorpusSnapshot,
  push: (issue: ValidationIssue) => void,
): void {
  const totalDocs = snapshot.documents.length || 1;
  const totalEdges = snapshot.documents.reduce((sum, doc) => sum + doc.relatedDocIds.length, 0);
  const averageDegree = totalEdges / totalDocs;

  if (averageDegree > MAX_AVERAGE_RELATED_DEGREE) {
    push({
      rule: 'related-edge-density',
      severity: 'error',
      message: `Average related-doc degree ${averageDegree.toFixed(2)} exceeds threshold ${MAX_AVERAGE_RELATED_DEGREE}`,
    });
  }

  for (const doc of snapshot.documents) {
    const ratio = snapshot.documents.length > 0 ? doc.relatedDocIds.length / snapshot.documents.length : 0;
    if (ratio > MAX_DOC_RELATED_PERCENTAGE) {
      push({
        rule: 'related-doc-fanout',
        severity: 'warning',
        message: `Doc "${doc.id}" links to ${(ratio * 100).toFixed(1)}% of the corpus`,
      });
    }
  }

  const maxPossibleEdges = snapshot.documents.length * Math.max(snapshot.documents.length - 1, 0);
  if (maxPossibleEdges > 0 && totalEdges / maxPossibleEdges >= NEAR_FULLY_CONNECTED_THRESHOLD) {
    push({
      rule: 'related-graph-connectivity',
      severity: 'warning',
      message: 'Related-doc graph is fully connected or near fully connected',
    });
  }

  const issueCoverage = snapshot.documents.filter(doc => (doc.issueTypes ?? []).length > 0).length / totalDocs;
  if (issueCoverage < MIN_ISSUE_TYPE_COVERAGE) {
    push({
      rule: 'issue-type-coverage',
      severity: 'warning',
      message: `Issue-type coverage ${(issueCoverage * 100).toFixed(1)}% is below threshold ${(MIN_ISSUE_TYPE_COVERAGE * 100).toFixed(0)}%`,
    });
  }

  const workflowCoverage = snapshot.documents.filter(doc => (doc.workflowBindings ?? []).length > 0).length / totalDocs;
  if (workflowCoverage < MIN_WORKFLOW_BINDING_COVERAGE) {
    push({
      rule: 'workflow-binding-coverage',
      severity: 'warning',
      message: `Workflow-binding coverage ${(workflowCoverage * 100).toFixed(1)}% is below threshold ${(MIN_WORKFLOW_BINDING_COVERAGE * 100).toFixed(0)}%`,
    });
  }

  const contentCoverage = snapshot.documents.filter(doc =>
    (doc.sections ?? []).length > 0 || doc.headings.length > 0 || doc.checklist.length > 0,
  ).length / totalDocs;
  if (contentCoverage < MIN_CONTENT_COVERAGE) {
    push({
      rule: 'content-coverage',
      severity: 'warning',
      message: `Content coverage ${(contentCoverage * 100).toFixed(1)}% is below threshold ${(MIN_CONTENT_COVERAGE * 100).toFixed(0)}%`,
    });
  }

  const reusedRatio = snapshot.documents.filter(doc => doc.fetchMetadata?.fetchStatus === 'reused-cache').length / totalDocs;
  if (reusedRatio > MAX_REUSED_DOC_PERCENTAGE_WARNING) {
    push({
      rule: 'reused-doc-volume',
      severity: 'warning',
      message: `${(reusedRatio * 100).toFixed(1)}% of docs were reused from the prior snapshot`,
    });
  }

  const recomputedStats = {
    totalDocs: snapshot.documents.length,
    readyDocs: snapshot.documents.filter(doc => doc.status === 'ready').length,
    pendingDocs: snapshot.documents.filter(doc => doc.status === 'pending').length,
    totalBindings: snapshot.documents.reduce((sum, doc) => sum + (doc.workflowBindings ?? []).length, 0),
    totalRelatedEdges: snapshot.documents.reduce((sum, doc) => sum + (doc.relatedDocIds ?? []).length, 0),
    reusedDocs: snapshot.documents.filter(doc => doc.fetchMetadata?.fetchStatus === 'reused-cache').length,
    docsWithIssueTypes: snapshot.documents.filter(doc => (doc.issueTypes ?? []).length > 0).length,
    docsWithWorkflowBindings: snapshot.documents.filter(doc => (doc.workflowBindings ?? []).length > 0).length,
    docsWithSections: snapshot.documents.filter(doc => (doc.sections ?? []).length > 0).length,
    totalSections: snapshot.documents.reduce((sum, doc) => sum + (doc.sections ?? []).length, 0),
  };

  if (
    snapshot.stats.totalDocs !== recomputedStats.totalDocs ||
    snapshot.stats.readyDocs !== recomputedStats.readyDocs ||
    snapshot.stats.pendingDocs !== recomputedStats.pendingDocs ||
    snapshot.stats.totalBindings !== recomputedStats.totalBindings ||
    snapshot.stats.totalRelatedEdges !== recomputedStats.totalRelatedEdges ||
    snapshot.stats.reusedDocs !== recomputedStats.reusedDocs ||
    snapshot.stats.docsWithIssueTypes !== recomputedStats.docsWithIssueTypes ||
    snapshot.stats.docsWithWorkflowBindings !== recomputedStats.docsWithWorkflowBindings ||
    snapshot.stats.docsWithSections !== recomputedStats.docsWithSections ||
    snapshot.stats.totalSections !== recomputedStats.totalSections
  ) {
    push({
      rule: 'stats-consistency',
      severity: 'warning',
      message: 'Snapshot stats do not match recomputed document counts',
    });
  }
}
