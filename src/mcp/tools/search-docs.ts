/**
 * Tool: search_security_docs
 */

import type { LoadedSnapshot } from '../../corpus/snapshot-loader.js';
import type { SecurityDoc, SecurityDocSection, WorkflowId } from '../../core/types.js';

export interface SearchDocsToolInput {
  query: string;
  sourceTypes?: string[];
  workflowId?: WorkflowId;
  stack?: string[];
  issueTags?: string[];
  topK?: number;
}

export interface MatchedSection {
  heading: string;
  anchor: string;
  snippet: string;
}

export interface SearchResult {
  doc: SecurityDoc;
  score: number;
  matchedFields: string[];
  matchedSections?: MatchedSection[];
}

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
    if (input.sourceTypes?.length && !input.sourceTypes.includes(doc.sourceType)) continue;
    if (input.workflowId && !doc.workflowBindings.some(binding => binding.workflowId === input.workflowId)) continue;
    if (input.stack?.length && !doc.stackBindings.some(binding => input.stack!.includes(binding.stack))) continue;
    if (input.issueTags?.length && !input.issueTags.some(tag => doc.issueTypes.includes(tag))) continue;

    const scored = scoreDocument(doc, query, queryTerms);
    if (scored.score > 0) {
      results.push(scored);
    }
  }

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.doc.id.localeCompare(b.doc.id);
  });

  return results.slice(0, topK);
}

function scoreDocument(doc: SecurityDoc, query: string, queryTerms: string[]): SearchResult {
  let score = 0;
  const matchedFields = new Set<string>();
  const matchedSections: Array<{ score: number; match: MatchedSection }> = [];

  const exactFieldValues = [
    ['id', doc.id],
    ['title', doc.title],
    ...doc.aliases.map(alias => ['aliases', alias] as const),
  ];

  for (const [field, value] of exactFieldValues) {
    const lower = value.toLowerCase();
    if (lower === query) {
      score += field === 'id' ? 120 : 90;
      matchedFields.add(field);
    } else if (lower.includes(query)) {
      score += field === 'title' ? 65 : 50;
      matchedFields.add(field);
    }
  }

  scoreArrayField(doc.tags, queryTerms, 'tags', matchedFields, term => term, value => value.toLowerCase(), scoreValue => {
    score += scoreValue;
  });
  scoreArrayField(doc.issueTypes, queryTerms, 'issueTypes', matchedFields, term => term, value => value.toLowerCase(), scoreValue => {
    score += scoreValue;
  });
  scoreArrayField(doc.headings, queryTerms, 'headings', matchedFields, term => term, value => value.toLowerCase(), scoreValue => {
    score += scoreValue;
  });
  scoreArrayField(doc.checklist, queryTerms, 'checklist', matchedFields, term => term, value => value.toLowerCase(), scoreValue => {
    score += Math.max(8, scoreValue - 5);
  });

  const summary = doc.summary.toLowerCase();
  if (summary.includes(query)) {
    score += 22;
    matchedFields.add('summary');
  } else if (queryTerms.some(term => summary.includes(term))) {
    score += 10;
    matchedFields.add('summary');
  }

  for (const section of doc.sections ?? []) {
    const sectionScore = scoreSection(section, query, queryTerms);
    if (sectionScore.score > 0) {
      matchedFields.add('sections');
      matchedSections.push({
        score: sectionScore.score,
        match: {
          heading: section.heading,
          anchor: section.anchor,
          snippet: sectionScore.snippet,
        },
      });
      score += sectionScore.score;
    }
  }

  matchedSections.sort((a, b) => b.score - a.score || a.match.heading.localeCompare(b.match.heading));

  return {
    doc,
    score,
    matchedFields: [...matchedFields],
    ...(matchedSections.length > 0
      ? { matchedSections: matchedSections.slice(0, 3).map(entry => entry.match) }
      : {}),
  };
}

function scoreArrayField(
  values: string[],
  queryTerms: string[],
  field: string,
  matchedFields: Set<string>,
  normalizeTerm: (term: string) => string,
  normalizeValue: (value: string) => string,
  addScore: (score: number) => void,
): void {
  for (const term of queryTerms) {
    const normalizedTerm = normalizeTerm(term);
    for (const value of values) {
      const normalizedValue = normalizeValue(value);
      if (normalizedValue === normalizedTerm) {
        matchedFields.add(field);
        addScore(field === 'headings' ? 30 : 40);
        break;
      }
      if (normalizedValue.includes(normalizedTerm)) {
        matchedFields.add(field);
        addScore(field === 'headings' ? 20 : 18);
        break;
      }
    }
  }
}

function scoreSection(
  section: SecurityDocSection,
  query: string,
  queryTerms: string[],
): { score: number; snippet: string } {
  const heading = section.heading.toLowerCase();
  const text = section.text.toLowerCase();
  let score = 0;

  if (heading.includes(query)) score += 42;
  if (text.includes(query)) score += 30;

  for (const term of queryTerms) {
    if (heading.includes(term)) score += 12;
    if (text.includes(term)) score += 8;
    if (section.keywords?.some(keyword => keyword.toLowerCase() === term)) score += 10;
  }

  return {
    score,
    snippet: buildSnippet(section.text, queryTerms),
  };
}

function buildSnippet(text: string, queryTerms: string[]): string {
  const lower = text.toLowerCase();
  const firstHit = queryTerms
    .map(term => lower.indexOf(term))
    .filter(index => index >= 0)
    .sort((a, b) => a - b)[0];

  if (firstHit === undefined) {
    return text.slice(0, 180);
  }

  const start = Math.max(0, firstHit - 60);
  const end = Math.min(text.length, firstHit + 120);
  return text.slice(start, end).trim();
}
