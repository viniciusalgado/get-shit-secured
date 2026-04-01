/**
 * Tool: read_security_doc
 *
 * Retrieves a security document by canonical ID or security:// URI.
 * Supports alias resolution via corpus/ids.ts.
 */

import type { LoadedSnapshot } from '../../corpus/snapshot-loader.js';
import {
  getDocumentById,
  getDocumentByUri,
} from '../../corpus/snapshot-loader.js';
import { resolveDocAlias } from '../../corpus/ids.js';
import type { SecurityDoc } from '../../core/types.js';

/**
 * Input schema for the read-doc tool.
 */
export interface ReadDocToolInput {
  id?: string;
  uri?: string;
}

/**
 * Retrieve a security document by ID or URI.
 *
 * @param input - Tool input (id or uri, at least one required)
 * @param loaded - Loaded corpus snapshot
 * @returns The SecurityDoc, or null if not found
 */
export function handleReadDoc(
  input: ReadDocToolInput,
  loaded: LoadedSnapshot,
): SecurityDoc | null {
  if (input.uri) {
    return getDocumentByUri(loaded, input.uri) ?? null;
  }

  if (input.id) {
    // Try alias resolution first
    const resolved = resolveDocAlias(input.id);
    if (resolved) {
      return getDocumentById(loaded, resolved) ?? null;
    }
    // Try direct lookup
    return getDocumentById(loaded, input.id) ?? null;
  }

  return null;
}
