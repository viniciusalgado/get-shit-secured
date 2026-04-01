/**
 * Content Normalization Module
 *
 * Transforms raw HTML from OWASP cheat sheets into normalized SecurityDoc fields.
 * Reuses the extraction logic from parseCheatSheetHtml() in owasp-ingestion.ts
 * but outputs the v2 field names (summary, checklist, relatedDocIds).
 */

import type { DocProvenance, DocStackBinding, DocWorkflowBinding } from '../core/types.js';
import { docIdFromUrl, docUriFromId } from './ids.js';
import { urlToId, OWASP_CANONICAL_URLS } from '../core/owasp-ingestion.js';

/**
 * Normalized content extracted from HTML.
 * Contains the content fields of a SecurityDoc, before binding merge.
 */
export interface NormalizedContent {
  id: string;
  uri: string;
  title: string;
  sourceUrl: string;
  sourceType: 'owasp-cheatsheet' | 'owasp-glossary' | 'other';
  status: 'ready' | 'pending';
  summary: string;
  headings: string[];
  checklist: string[];
  tags: string[];
  relatedDocIds: string[];
  aliases: string[];
}

/**
 * Inferred bindings derived from ID/tags (before override merge).
 * These are the old heuristic bindings from owasp-ingestion.ts.
 */
export interface InferredBindings {
  workflowBindings: DocWorkflowBinding[];
  stackBindings: DocStackBinding[];
}

/**
 * Extract normalized content from raw HTML.
 * This is the core content normalization function.
 *
 * @param html - Raw HTML content (or empty string for failed fetches)
 * @param url - Source URL
 * @param corpusVersion - Snapshot version to stamp on the doc
 * @returns Normalized content fields
 */
export function normalizeContent(
  html: string,
  url: string,
  corpusVersion: string
): NormalizedContent {
  const id = docIdFromUrl(url);
  const uri = docUriFromId(id);

  // For failed fetches (empty HTML)
  if (!html || html.trim().length === 0) {
    return {
      id,
      uri,
      title: titleFromUrl(url),
      sourceUrl: url,
      sourceType: 'owasp-cheatsheet',
      status: 'pending',
      summary: '',
      headings: [],
      checklist: [],
      tags: [],
      relatedDocIds: [],
      aliases: [],
    };
  }

  // Title: from <h1> tag, fallback to URL-derived title
  const titleMatch = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
  const title = titleMatch
    ? titleMatch[1].replace(/<[^>]*>/g, '').trim()
    : titleFromUrl(url);

  // Headings: h2/h3, filtered
  const headings: string[] = [];
  const headingRegex = /<h[23][^>]*>(.*?)<\/h[23]>/gi;
  let headingMatch;
  while ((headingMatch = headingRegex.exec(html)) !== null) {
    const headingText = headingMatch[1].replace(/<[^>]*>/g, '').trim();
    if (headingText && !headingText.startsWith('Introduction') && !headingText.startsWith('Related')) {
      headings.push(headingText);
    }
  }

  // Checklist: <li> items filtered by length and keywords
  const checklistRegex = /<li[^>]*>(.*?)<\/li>/gi;
  const allChecklistItems: string[] = [];
  let checklistMatch;
  while ((checklistMatch = checklistRegex.exec(html)) !== null) {
    const itemText = checklistMatch[1].replace(/<[^>]*>/g, '').trim();
    if (itemText && itemText.length > 10 && itemText.length < 500) {
      allChecklistItems.push(itemText);
    }
  }
  const checklist = allChecklistItems
    .filter(item =>
      item.includes('should') ||
      item.includes('must') ||
      item.includes('ensure') ||
      item.includes('verify') ||
      item.includes('avoid') ||
      item.includes('use')
    )
    .slice(0, 20);

  // Summary: first <p> tag, truncated
  const introMatch = html.match(/<p[^>]*>(.*?)<\/p>/i);
  const summary = introMatch
    ? introMatch[1].replace(/<[^>]*>/g, '').trim().slice(0, 200)
    : `OWASP ${title} guidance`;

  // Related doc IDs: cross-references to other cheat sheets
  const relatedDocIds: string[] = [];
  const linkPatterns = [
    /href="\/cheatsheets\/([^"]+)\.html"/g,
    /href="([^"]+_Cheat_Sheet)\.html"/g,
  ];
  for (const pattern of linkPatterns) {
    let linkMatch;
    while ((linkMatch = pattern.exec(html)) !== null) {
      let refId = linkMatch[1].replace(/_/g, '-').toLowerCase();
      refId = refId.replace(/-cheat-sheet$/, '');
      if (refId !== id && OWASP_CANONICAL_URLS.some(u => urlToId(u) === refId)) {
        relatedDocIds.push(refId);
      }
    }
  }

  // Tags: topic-based extraction
  const tags = extractTags(id);

  return {
    id,
    uri,
    title,
    sourceUrl: url,
    sourceType: 'owasp-cheatsheet',
    status: 'ready',
    summary,
    headings: headings.slice(0, 15),
    checklist,
    tags,
    relatedDocIds: [...new Set(relatedDocIds)],
    aliases: [],
  };
}

/**
 * Infer workflow bindings from specialist ID and tags.
 * These are heuristic bindings that serve as fallbacks when
 * no curated override exists.
 *
 * @param id - Specialist ID
 * @param tags - Extracted tags
 * @returns Inferred workflow bindings with provenance markers
 */
export function inferWorkflowBindingsFromContent(
  id: string,
  tags: string[]
): InferredBindings {
  const workflowBindings: DocWorkflowBinding[] = [];
  const stackBindings: DocStackBinding[] = [];

  // Map-codebase
  if (
    tags.includes('dependency') ||
    id.includes('attack-surface') ||
    id.includes('abuse-case') ||
    id.includes('sbom') ||
    id.includes('supply-chain') ||
    id.includes('cloud') ||
    id.includes('microservices') ||
    id.includes('network')
  ) {
    workflowBindings.push({
      workflowId: 'map-codebase',
      priority: 'required',
      rationale: 'inferred: scope/architecture relevance',
    });
  }

  // Threat-model
  if (
    id.includes('threat-modeling') ||
    id.includes('abuse-case') ||
    id.includes('attack-surface') ||
    id.includes('secure-product-design') ||
    id.includes('multi-tenant') ||
    tags.includes('ai')
  ) {
    workflowBindings.push({
      workflowId: 'threat-model',
      priority: 'required',
      rationale: 'inferred: design/threat relevance',
    });
  }

  // Audit
  if (
    tags.includes('injection') ||
    tags.includes('xss') ||
    tags.includes('auth') ||
    tags.includes('authorization') ||
    tags.includes('crypto') ||
    tags.includes('session') ||
    tags.includes('api') ||
    tags.includes('framework') ||
    id.includes('input-validation') ||
    id.includes('file-upload') ||
    id.includes('deserialization') ||
    id.includes('ssrf') ||
    id.includes('xxe') ||
    id.includes('csrf') ||
    id.includes('logging')
  ) {
    workflowBindings.push({
      workflowId: 'audit',
      priority: 'required',
      rationale: 'inferred: vulnerability detection relevance',
    });
  }

  // Plan-remediation follows audit
  if (workflowBindings.some(b => b.workflowId === 'audit')) {
    workflowBindings.push({
      workflowId: 'plan-remediation',
      priority: 'required',
      rationale: 'inferred: mirrors audit binding',
    });
  }

  // Verify
  if (
    id.includes('authorization-testing') ||
    id.includes('rest-assessment') ||
    id.includes('transport-layer') ||
    id.includes('content-security-policy') ||
    id.includes('http-headers')
  ) {
    workflowBindings.push({
      workflowId: 'verify',
      priority: 'required',
      rationale: 'inferred: verification/testing relevance',
    });
  }

  // Report
  if (
    id.includes('vulnerability-disclosure') ||
    id.includes('security-terminology') ||
    id.includes('logging-vocabulary')
  ) {
    workflowBindings.push({
      workflowId: 'report',
      priority: 'required',
      rationale: 'inferred: reporting relevance',
    });
  }

  // Stack bindings
  const stackMap: Record<string, string[]> = {
    'django': ['python', 'django'],
    'django-rest-framework': ['python', 'django', 'drf'],
    'laravel': ['php', 'laravel'],
    'ruby-on-rails': ['ruby', 'rails'],
    'symfony': ['php', 'symfony'],
    'nodejs': ['javascript', 'nodejs', 'typescript'],
    'nodejs-docker': ['javascript', 'nodejs', 'docker'],
    'java': ['java'],
    'injection-prevention-in-java': ['java'],
    'json-web-token-for-java': ['java', 'jwt'],
    'jaas': ['java'],
    'dotnet': ['csharp', 'dotnet'],
    'php-configuration': ['php'],
    'npm-security': ['javascript', 'nodejs', 'npm'],
    'docker': ['docker'],
    'kubernetes': ['kubernetes', 'k8s'],
    'serverless': ['aws-lambda', 'serverless', 'faas'],
    'infrastructure-as-code': ['terraform', 'cloudformation', 'iac'],
    'graphql': ['graphql', 'api'],
    'rest': ['api', 'rest'],
    'grpc': ['grpc', 'api'],
    'websocket': ['websocket', 'api'],
  };

  for (const [key, stacks] of Object.entries(stackMap)) {
    if (id.includes(key.replace(/-/g, '_')) || id === key.replace(/_/g, '-')) {
      for (const stack of stacks) {
        stackBindings.push({ stack, condition: 'inferred: ID-based match' });
      }
      break;
    }
  }

  return { workflowBindings, stackBindings };
}

/**
 * Extract topic tags from a specialist ID.
 */
function extractTags(id: string): string[] {
  const tags = new Set<string>();

  const topicMap: Record<string, string[]> = {
    'injection': ['sql', 'nosql', 'ldap', 'os-command', 'injection'],
    'xss': ['xss', 'cross-site-scripting', 'dom', 'output-encoding'],
    'authentication': ['auth', 'authentication', 'password', 'mfa', 'credential'],
    'authorization': ['authorization', 'access-control', 'rbac', 'abac'],
    'crypto': ['crypto', 'encryption', 'key-management', 'tls', 'ssl'],
    'session': ['session', 'cookie', 'jwt'],
    'logging': ['logging', 'audit', 'monitoring'],
    'dependency': ['dependency', 'supply-chain', 'sbom'],
    'api': ['rest', 'graphql', 'api', 'web-service', 'grpc'],
    'framework': ['django', 'laravel', 'rails', 'symfony', 'nodejs', 'java', 'dotnet'],
    'infrastructure': ['docker', 'kubernetes', 'cloud', 'serverless', 'iac'],
    'ai': ['ai', 'llm', 'prompt-injection', 'mcp'],
  };

  for (const [topic, keywords] of Object.entries(topicMap)) {
    if (keywords.some(kw => id.includes(kw.replace(/-/g, '_')) || id.includes(kw.replace(/_/g, '-')))) {
      tags.add(topic);
    }
  }

  return Array.from(tags);
}

/**
 * Derive a human-readable title from a URL (fallback when HTML has no <h1>).
 */
function titleFromUrl(url: string): string {
  const id = urlToId(url);
  return id
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
