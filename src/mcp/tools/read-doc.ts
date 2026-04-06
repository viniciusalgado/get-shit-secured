/**
 * Tool: read_security_doc
 */

import type { LoadedSnapshot } from '../../corpus/snapshot-loader.js';
import { getDocumentById, getDocumentByUri } from '../../corpus/snapshot-loader.js';
import { resolveDocAlias } from '../../corpus/ids.js';
import type { SecurityDoc, SecurityDocSection } from '../../core/types.js';

export interface ReadDocToolInput {
  id?: string;
  uri?: string;
  sectionAnchor?: string;
  headingQuery?: string;
  excerptQuery?: string;
}

export interface ReadDocToolResult {
  doc: SecurityDoc;
  selectedSection?: {
    heading: string;
    anchor: string;
    excerpt: string;
  };
}

export function handleReadDoc(
  input: ReadDocToolInput,
  loaded: LoadedSnapshot,
): SecurityDoc | ReadDocToolResult | null {
  const doc = resolveDoc(input, loaded);
  if (!doc) return null;

  const selectedSection = selectSection(doc, input);
  if (!selectedSection) {
    return doc;
  }
  return selectedSection
    ? {
        doc,
        selectedSection: {
          heading: selectedSection.heading,
          anchor: selectedSection.anchor,
          excerpt: selectedSection.text.slice(0, 400),
        },
      }
    : doc;
}

function resolveDoc(input: ReadDocToolInput, loaded: LoadedSnapshot): SecurityDoc | null {
  if (input.uri) {
    return getDocumentByUri(loaded, input.uri) ?? null;
  }

  if (input.id) {
    const resolved = resolveDocAlias(input.id);
    return getDocumentById(loaded, resolved ?? input.id) ?? null;
  }

  return null;
}

function selectSection(doc: SecurityDoc, input: ReadDocToolInput): SecurityDocSection | null {
  if (!input.sectionAnchor && !input.headingQuery && !input.excerptQuery) return null;
  const sections = doc.sections ?? [];

  if (input.sectionAnchor) {
    const byAnchor = sections.find(section => section.anchor === input.sectionAnchor);
    if (byAnchor) return byAnchor;
  }

  if (input.headingQuery) {
    const query = input.headingQuery.toLowerCase();
    const byHeading = [...sections].sort((a, b) => scoreText(b.heading, query) - scoreText(a.heading, query))[0];
    if (byHeading && scoreText(byHeading.heading, query) > 0) return byHeading;
  }

  if (input.excerptQuery) {
    const query = input.excerptQuery.toLowerCase();
    const byExcerpt = [...sections].sort((a, b) => {
      const aScore = scoreText(`${a.heading}\n${a.text}`, query);
      const bScore = scoreText(`${b.heading}\n${b.text}`, query);
      return bScore - aScore;
    })[0];
    if (byExcerpt && scoreText(`${byExcerpt.heading}\n${byExcerpt.text}`, query) > 0) return byExcerpt;
  }

  return null;
}

function scoreText(text: string, query: string): number {
  const normalized = text.toLowerCase();
  if (normalized === query) return 100;
  if (normalized.includes(query)) return 50;
  return query
    .split(/\s+/)
    .filter(Boolean)
    .reduce((sum, term) => sum + (normalized.includes(term) ? 10 : 0), 0);
}
