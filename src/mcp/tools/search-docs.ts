/**
 * Tool: search_security_docs
 *
 * In-memory search over the corpus snapshot.
 * Matches against title, summary, tags, issueTypes, aliases, and headings.
 * Simple scoring: exact tag > tag substring > heading match > summary substring.
 */

import type { LoadedSnapshot } from '../../corpus/snapshot-loader.js';
import type { SecurityDoc, WorkflowId } from '../../core/types.js';

/**
 * Input schema for the search-docs tool.
 */
export interface SearchDocsToolInput {
  query: string;
  sourceTypes?: string[];
  workflowId?: WorkflowId;
  stack?: string[];
  issueTags?: string[];
  topK?: number;
}

/**
 * Search result entry.
 */
export interface SearchResult {
  doc: SecurityDoc;
  score: number;
  matchedFields: string[];
}

/**
 * Search the corpus for matching documents.
 *
 * @param input - Tool input with query and optional filters
 * @param loaded - Loaded corpus snapshot
 * @returns Scored and ranked search results
 */
export function handleSearchDocs(
  input: SearchDocsToolInput,
  loaded: LoadedSnapshot,
): SearchResult[] {
  const query = input.query.toLowerCase().trim();
  const topK = input.topK ?? 5;

  if (!query) return [];

  const queryTerms = query.split(/\s+/).filter(Boolean);
  const results: SearchResult[] = [];

  for (const doc of loaded.snapshot.documents) {
    // Apply filters first
    if (input.sourceTypes?.length) {
      if (!input.sourceTypes.includes(doc.sourceType)) continue;
    }
    if (input.workflowId) {
      const hasBinding = doc.workflowBindings.some(
        b => b.workflowId === input.workflowId,
      );
      if (!hasBinding) continue;
    }
    if (input.stack?.length) {
      const hasStack = doc.stackBindings.some(sb =>
        input.stack!.includes(sb.stack),
      );
      if (!hasStack) continue;
    }
    if (input.issueTags?.length) {
      const hasIssue = input.issueTags.some(t =>
        doc.issueTypes.includes(t),
      );
      if (!hasIssue) continue;
    }

    // Score the document
    const { score, matchedFields } = scoreDocument(doc, queryTerms);
    if (score > 0) {
      results.push({ doc, score, matchedFields });
    }
  }

  // Sort by score descending, then by ID ascending for determinism
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.doc.id.localeCompare(b.doc.id);
  });

  return results.slice(0, topK);
}

/**
 * Score a document against query terms.
 *
 * Scoring weights:
 * - Exact ID match: 100
 * - Exact tag match: 50
 * - Tag substring: 30
 * - Title match: 40
 * - Title substring: 20
 * - Heading match: 25
 * - Summary substring: 10
 * - Alias match: 35
 * - Issue type match: 30
 */
function scoreDocument(
  doc: SecurityDoc,
  queryTerms: string[],
): { score: number; matchedFields: string[] } {
  let score = 0;
  const matchedFields = new Set<string>();

  const lowerTitle = doc.title.toLowerCase();
  const lowerSummary = doc.summary.toLowerCase();
  const lowerId = doc.id.toLowerCase();

  for (const term of queryTerms) {
    // Exact ID match
    if (lowerId === term) {
      score += 100;
      matchedFields.add('id');
      continue;
    }

    // Exact tag match
    if (doc.tags.some(t => t.toLowerCase() === term)) {
      score += 50;
      matchedFields.add('tags');
      continue;
    }

    // Alias match
    if (doc.aliases.some(a => a.toLowerCase() === term || a.toLowerCase().includes(term))) {
      score += 35;
      matchedFields.add('aliases');
      continue;
    }

    // Issue type match
    if (doc.issueTypes.some(t => t.toLowerCase() === term)) {
      score += 30;
      matchedFields.add('issueTypes');
      continue;
    }

    // Tag substring
    if (doc.tags.some(t => t.toLowerCase().includes(term))) {
      score += 30;
      matchedFields.add('tags');
      continue;
    }

    // Title match
    if (lowerTitle.includes(term)) {
      score += 20;
      matchedFields.add('title');
    }

    // Heading match
    if (doc.headings.some(h => h.toLowerCase().includes(term))) {
      score += 25;
      matchedFields.add('headings');
    }

    // Summary substring
    if (lowerSummary.includes(term)) {
      score += 10;
      matchedFields.add('summary');
    }
  }

  return { score, matchedFields: [...matchedFields] };
}
