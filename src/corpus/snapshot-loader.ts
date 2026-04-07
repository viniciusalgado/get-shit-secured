/**
 * Corpus Snapshot Loader
 *
 * Loads a corpus snapshot at runtime and provides lookup helpers.
 * Used by the planner and MCP tools to access corpus data without
 * consulting mapping.ts or fetching URLs.
 */

import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { SecurityDoc, CorpusSnapshot, WorkflowId } from '../core/types.js';

/** Maximum allowed corpus snapshot file size (50 MB) */
const MAX_CORPUS_SIZE = 50 * 1024 * 1024;

/**
 * Loaded snapshot with lookup indices.
 */
export interface LoadedSnapshot {
  /** The raw snapshot */
  snapshot: CorpusSnapshot;
  /** Documents indexed by ID */
  byId: Map<string, SecurityDoc>;
  /** Documents indexed by URI */
  byUri: Map<string, SecurityDoc>;
}

/**
 * Load a corpus snapshot from disk.
 *
 * @param snapshotPath - Path to owasp-corpus.snapshot.json
 * @returns Loaded snapshot with lookup indices
 */
export function loadCorpusSnapshot(snapshotPath: string): LoadedSnapshot {
  // Size guard before reading
  const stat = statSync(snapshotPath);
  if (stat.size > MAX_CORPUS_SIZE) {
    throw new Error(
      `Corpus snapshot exceeds maximum allowed size (${(stat.size / 1024 / 1024).toFixed(1)} MB > ${MAX_CORPUS_SIZE / 1024 / 1024} MB). ` +
      'The file may be corrupted or tampered with.'
    );
  }

  const raw = readFileSync(snapshotPath, 'utf-8');
  const snapshot = JSON.parse(raw) as CorpusSnapshot;

  const byId = new Map<string, SecurityDoc>();
  const byUri = new Map<string, SecurityDoc>();

  for (const doc of snapshot.documents) {
    byId.set(doc.id, doc);
    byUri.set(doc.uri, doc);
  }

  return { snapshot, byId, byUri };
}

/**
 * Get a document by its canonical ID.
 *
 * @param loaded - Loaded snapshot
 * @param id - Canonical document ID
 * @returns SecurityDoc or undefined
 */
export function getDocumentById(loaded: LoadedSnapshot, id: string): SecurityDoc | undefined {
  return loaded.byId.get(id);
}

/**
 * Get a document by its security:// URI.
 *
 * @param loaded - Loaded snapshot
 * @param uri - Document URI
 * @returns SecurityDoc or undefined
 */
export function getDocumentByUri(loaded: LoadedSnapshot, uri: string): SecurityDoc | undefined {
  const normalizedUri = uri.split('#')[0] ?? uri;
  return loaded.byUri.get(normalizedUri);
}

/**
 * Get all documents bound to a specific workflow.
 *
 * @param loaded - Loaded snapshot
 * @param workflowId - Workflow to filter by
 * @param priority - Optional priority filter
 * @returns Documents with bindings to the specified workflow
 */
export function getDocumentsForWorkflow(
  loaded: LoadedSnapshot,
  workflowId: WorkflowId,
  priority?: 'required' | 'optional' | 'followup'
): SecurityDoc[] {
  const results: SecurityDoc[] = [];

  for (const doc of loaded.snapshot.documents) {
    const binding = doc.workflowBindings.find(b => {
      if (b.workflowId !== workflowId) return false;
      if (priority && b.priority !== priority) return false;
      return true;
    });
    if (binding) {
      results.push(doc);
    }
  }

  return results;
}

/**
 * Get all documents matching a stack tag.
 *
 * @param loaded - Loaded snapshot
 * @param stack - Stack tag to match
 * @returns Documents with stack bindings matching the tag
 */
export function getDocumentsForStack(loaded: LoadedSnapshot, stack: string): SecurityDoc[] {
  const normalized = stack.toLowerCase();
  const results: SecurityDoc[] = [];

  for (const doc of loaded.snapshot.documents) {
    if (doc.stackBindings.some(sb => sb.stack === normalized)) {
      results.push(doc);
    }
  }

  return results;
}

/**
 * Get documents related to a given document (bidirectional lookup).
 *
 * @param loaded - Loaded snapshot
 * @param docId - Source document ID
 * @returns Related documents
 */
export function getRelatedDocuments(loaded: LoadedSnapshot, docId: string): SecurityDoc[] {
  const doc = loaded.byId.get(docId);
  if (!doc) return [];

  const related: SecurityDoc[] = [];
  const seen = new Set<string>([docId]);

  // Forward: docs listed in this doc's relatedDocIds
  for (const relatedId of doc.relatedDocIds) {
    if (!seen.has(relatedId)) {
      seen.add(relatedId);
      const relatedDoc = loaded.byId.get(relatedId);
      if (relatedDoc) related.push(relatedDoc);
    }
  }

  // Reverse: docs that reference this doc in their relatedDocIds
  for (const otherDoc of loaded.snapshot.documents) {
    if (!seen.has(otherDoc.id) && otherDoc.relatedDocIds.includes(docId)) {
      seen.add(otherDoc.id);
      related.push(otherDoc);
    }
  }

  return related;
}

/**
 * Compute SHA-256 hash of the corpus snapshot file.
 *
 * @param snapshotPath - Path to the corpus snapshot JSON file
 * @returns Hex-encoded SHA-256 hash
 */
export function computeCorpusHash(snapshotPath: string): string {
  const content = readFileSync(snapshotPath, 'utf-8');
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Verify corpus integrity by comparing a known hash against the file on disk.
 *
 * @param snapshotPath - Path to the corpus snapshot JSON file
 * @param expectedHash - Expected SHA-256 hash
 * @returns Verification result with valid flag and optional error message
 */
export function verifyCorpusIntegrity(
  snapshotPath: string,
  expectedHash: string
): { valid: boolean; error?: string } {
  try {
    const actualHash = computeCorpusHash(snapshotPath);
    if (actualHash !== expectedHash) {
      return {
        valid: false,
        error: `Corpus hash mismatch: expected ${expectedHash}, got ${actualHash}`,
      };
    }
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: `Failed to verify corpus integrity: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
