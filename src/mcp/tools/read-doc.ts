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

  // SRV-003: Check for injection patterns in corpus content (defense-in-depth)
  const fullContent = JSON.stringify(doc);
  const injectionWarnings = detectInjectionPatterns(fullContent);

  const selectedSection = selectSection(doc, input);
  const result = selectedSection
    ? {
        doc,
        selectedSection: {
          heading: selectedSection.heading,
          anchor: selectedSection.anchor,
          excerpt: selectedSection.text.slice(0, 400),
        },
        ...(injectionWarnings.length > 0 ? { _injectionWarnings: injectionWarnings } : {}),
      }
    : { ...doc, ...(injectionWarnings.length > 0 ? { _injectionWarnings: injectionWarnings } : {}) };

  return result as SecurityDoc | ReadDocToolResult;
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

// ---------------------------------------------------------------------------
// SRV-003: Expanded injection detection per OWASP LLM Prompt Injection CS
// ---------------------------------------------------------------------------

/**
 * Known LLM injection patterns covering OWASP categories:
 * - Direct instruction override attempts
 * - Role-play / persona switching / DAN-style jailbreaks
 * - System prompt extraction
 * - Multi-turn persistent attack markers
 */
const INJECTION_PATTERNS = [
  // Direct instruction overrides
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /system\s+override/i,
  /disregard\s+(all\s+)?(previous\s+)?(instructions|security)/i,
  /you\s+are\s+now\s+/i,
  /new\s+instruction/i,
  /forget\s+(all\s+)?(previous\s+)?(instructions|rules)/i,
  /override\s+(all\s+)?(safety|security)\s+(guidelines|rules|checks)/i,
  /do\s+not\s+follow\s+(your|the)\s+(original|initial|system)\s+instructions/i,

  // Role-play / persona switching
  /you\s+are\s+(now\s+)?(a\s+)?(developer|admin|hacker|malicious|unrestricted|unfiltered)\s+(mode|ai|agent)/i,
  /act\s+as\s+if\s+you\s+(are|were)\s+(not\s+)?bound/i,
  /pretend\s+you\s+(are|have)\s+no\s+(restrictions|rules|safety)/i,
  /enter\s+(developer|admin|root)\s+mode/i,
  /jailbreak/i,

  // DAN-style attacks
  /do\s+anything\s+now/i,
  /DAN\s+(mode|prompt|attack)/i,
  /enable\s+(developer|god|admin)\s+mode/i,
  /bypass\s+(all\s+)?(safety|security|content)\s+(filters?|policies|guardrails)/i,

  // System prompt extraction
  /reveal\s+(your|the|system)\s+(prompt|instructions|config)/i,
  /repeat\s+(the\s+)?(text\s+)?above\s+starting\s+with/i,
  /what\s+(were|are)\s+your\s+(exact\s+)?instructions/i,
  /show\s+me\s+your\s+(system|initial)\s+prompt/i,

  // Multi-turn / persistent attack markers
  /remember\s+(this|that|the\s+following)\s+for\s+(later|next\s+time)/i,
  /when\s+i\s+(say|ask|type)\s+["']?X["']?\s*,\s*(you\s+)?(should|must|will)/i,
];

/**
 * Check content for known injection patterns.
 * Returns warning messages if patterns detected.
 */
function detectInjectionPatterns(content: string): string[] {
  const warnings: string[] = [];
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(content)) {
      warnings.push(`Potential injection pattern detected: ${pattern.source}`);
    }
  }
  return warnings;
}
