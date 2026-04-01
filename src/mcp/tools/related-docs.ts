/**
 * Tool: get_related_security_docs
 *
 * Bidirectional related-document lookup via the corpus snapshot graph.
 */

import type { LoadedSnapshot } from '../../corpus/snapshot-loader.js';
import { getRelatedDocuments } from '../../corpus/snapshot-loader.js';
import type { SecurityDoc } from '../../core/types.js';

/**
 * Input schema for the related-docs tool.
 */
export interface RelatedDocsToolInput {
  id: string;
  reason?: string;
}

/**
 * Get documents related to the given document ID.
 *
 * @param input - Tool input
 * @param loaded - Loaded corpus snapshot
 * @returns Array of related SecurityDocs (may be empty)
 */
export function handleRelatedDocs(
  input: RelatedDocsToolInput,
  loaded: LoadedSnapshot,
): SecurityDoc[] {
  return getRelatedDocuments(loaded, input.id);
}
