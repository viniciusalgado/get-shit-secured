/**
 * Corpus Schema — Runtime Type Guards
 *
 * Provides type guard functions for SecurityDoc and CorpusSnapshot.
 * Used by snapshot-builder (build-time) and snapshot-loader (runtime)
 * to validate data shape.
 */

import type {
  SecurityDoc,
  CorpusSnapshot,
  DocWorkflowBinding,
  DocStackBinding,
  DocProvenance,
  SecurityDocSection,
  SecurityDocFetchMetadata,
} from '../core/types.js';

/**
 * Required top-level string fields on a SecurityDoc.
 */
const REQUIRED_STRING_FIELDS = ['id', 'uri', 'title', 'sourceUrl', 'summary'] as const;

/**
 * Validate that a value is a valid DocWorkflowBinding.
 */
function isDocWorkflowBinding(obj: unknown): obj is DocWorkflowBinding {
  if (typeof obj !== 'object' || obj === null) return false;
  const record = obj as Record<string, unknown>;
  return (
    typeof record.workflowId === 'string' &&
    typeof record.priority === 'string' &&
    ['required', 'optional', 'followup'].includes(record.priority as string)
  );
}

/**
 * Validate that a value is a valid DocStackBinding.
 */
function isDocStackBinding(obj: unknown): obj is DocStackBinding {
  if (typeof obj !== 'object' || obj === null) return false;
  const record = obj as Record<string, unknown>;
  return typeof record.stack === 'string';
}

/**
 * Validate that a value is a valid DocProvenance.
 */
function isDocProvenance(obj: unknown): obj is DocProvenance {
  if (typeof obj !== 'object' || obj === null) return false;
  const record = obj as Record<string, unknown>;
  return (
    Array.isArray(record.inferred) &&
    record.inferred.every((v: unknown) => typeof v === 'string') &&
    Array.isArray(record.overridden) &&
    record.overridden.every((v: unknown) => typeof v === 'string') &&
    (record.reused === undefined ||
      (Array.isArray(record.reused) && record.reused.every((v: unknown) => typeof v === 'string')))
  );
}

function isSecurityDocSection(obj: unknown): obj is SecurityDocSection {
  if (typeof obj !== 'object' || obj === null) return false;
  const record = obj as Record<string, unknown>;
  return (
    typeof record.heading === 'string' &&
    typeof record.anchor === 'string' &&
    typeof record.text === 'string' &&
    (record.keywords === undefined ||
      (Array.isArray(record.keywords) && record.keywords.every((v: unknown) => typeof v === 'string')))
  );
}

function isSecurityDocFetchMetadata(obj: unknown): obj is SecurityDocFetchMetadata {
  if (typeof obj !== 'object' || obj === null) return false;
  const record = obj as Record<string, unknown>;
  return (
    typeof record.fetchStatus === 'string' &&
    ['success', 'timeout', 'http-error', 'parse-error', 'reused-cache'].includes(record.fetchStatus) &&
    typeof record.fetchAttempts === 'number' &&
    (record.lastSuccessfulFetchAt === undefined || typeof record.lastSuccessfulFetchAt === 'string') &&
    (record.sourceContentHash === undefined || typeof record.sourceContentHash === 'string')
  );
}

/**
 * Runtime type guard for SecurityDoc.
 * Checks that all required fields exist with correct types.
 *
 * @param obj - Value to check
 * @returns true if obj satisfies the SecurityDoc interface
 */
export function isSecurityDoc(obj: unknown): obj is SecurityDoc {
  if (typeof obj !== 'object' || obj === null) return false;
  const doc = obj as Record<string, unknown>;

  // Required string fields
  for (const field of REQUIRED_STRING_FIELDS) {
    if (typeof doc[field] !== 'string') return false;
  }

  // sourceType enum
  if (
    typeof doc.sourceType !== 'string' ||
    !['owasp-cheatsheet', 'owasp-glossary', 'other'].includes(doc.sourceType as string)
  ) {
    return false;
  }

  // corpusVersion and status
  if (typeof doc.corpusVersion !== 'string') return false;
  if (
    typeof doc.status !== 'string' ||
    !['ready', 'pending', 'deprecated'].includes(doc.status as string)
  ) {
    return false;
  }

  // String array fields
  const stringArrayFields = ['headings', 'checklist', 'tags', 'issueTypes', 'relatedDocIds', 'aliases'];
  for (const field of stringArrayFields) {
    if (!Array.isArray(doc[field])) return false;
    if (!(doc[field] as unknown[]).every((v: unknown) => typeof v === 'string')) return false;
  }

  if (!Array.isArray(doc.sections) || !(doc.sections as unknown[]).every(isSecurityDocSection)) {
    return false;
  }

  if (
    doc.issueTypeConfidence !== undefined &&
    (typeof doc.issueTypeConfidence !== 'object' || doc.issueTypeConfidence === null)
  ) {
    return false;
  }

  // workflowBindings: DocWorkflowBinding[]
  if (
    !Array.isArray(doc.workflowBindings) ||
    !(doc.workflowBindings as unknown[]).every(isDocWorkflowBinding)
  ) {
    return false;
  }

  // stackBindings: DocStackBinding[]
  if (
    !Array.isArray(doc.stackBindings) ||
    !(doc.stackBindings as unknown[]).every(isDocStackBinding)
  ) {
    return false;
  }

  // provenance: DocProvenance
  if (!isDocProvenance(doc.provenance)) return false;

  if (doc.fetchMetadata !== undefined && !isSecurityDocFetchMetadata(doc.fetchMetadata)) return false;

  return true;
}

/**
 * Runtime type guard for CorpusSnapshot.
 * Checks top-level metadata and validates all documents.
 *
 * @param obj - Value to check
 * @returns true if obj satisfies the CorpusSnapshot interface
 */
export function isCorpusSnapshot(obj: unknown): obj is CorpusSnapshot {
  if (typeof obj !== 'object' || obj === null) return false;
  const snap = obj as Record<string, unknown>;

  // Metadata fields
  if (snap.schemaVersion !== 2) return false;
  if (typeof snap.corpusVersion !== 'string') return false;
  if (typeof snap.generatedAt !== 'string') return false;

  // documents array
  if (!Array.isArray(snap.documents)) return false;
  if (!(snap.documents as unknown[]).every(isSecurityDoc)) return false;

  // stats object
  if (typeof snap.stats !== 'object' || snap.stats === null) return false;
  const stats = snap.stats as Record<string, unknown>;
  if (
    typeof stats.totalDocs !== 'number' ||
    typeof stats.readyDocs !== 'number' ||
    typeof stats.pendingDocs !== 'number' ||
    typeof stats.totalBindings !== 'number' ||
    typeof stats.totalRelatedEdges !== 'number' ||
    typeof stats.reusedDocs !== 'number' ||
    typeof stats.docsWithIssueTypes !== 'number' ||
    typeof stats.docsWithWorkflowBindings !== 'number' ||
    typeof stats.docsWithSections !== 'number' ||
    typeof stats.totalSections !== 'number' ||
    typeof stats.averageRelatedDocDegree !== 'number'
  ) {
    return false;
  }

  return true;
}
