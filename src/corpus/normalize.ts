/**
 * Content Normalization Module
 *
 * Extracts section-aware content from OWASP cheat sheets using conservative
 * HTML heuristics. The goal is retrieval quality, not perfect HTML fidelity.
 */

import type {
  DocStackBinding,
  DocWorkflowBinding,
  IssueTypeConfidence,
  SecurityDocSection,
} from '../core/types.js';
import { docIdFromUrl, docUriFromId } from './ids.js';
import { urlToId, OWASP_CANONICAL_URLS } from '../core/owasp-ingestion.js';

const CANONICAL_IDS = new Set(OWASP_CANONICAL_URLS.map(url => urlToId(url)));
const RELATED_SECTION_HINTS = /(related|reference|see also|further reading)/i;
const CHECKLIST_VERB_PATTERN =
  /\b(should|must|ensure|verify|avoid|use|prefer|disable|enable|validate|sanitize|encode|escape|limit|restrict|never|do not)\b/i;

const CANONICAL_ISSUE_TAGS = [
  'injection', 'sql-injection', 'nosql-injection', 'command-injection',
  'ldap-injection', 'xss', 'dom-xss', 'dom-clobbering', 'authn', 'authz',
  'access-control', 'session-management', 'password-storage', 'mfa',
  'secrets', 'crypto', 'key-management', 'file-upload', 'deserialization',
  'ssrf', 'xxe', 'csrf', 'config', 'security-headers', 'csp', 'hsts',
  'tls', 'logging', 'error-handling', 'supply-chain', 'dependency',
  'ai-security', 'mcp-security', 'prompt-injection', 'clickjacking', 'idor',
  'mass-assignment', 'prototype-pollution', 'subdomain-takeover', 'redirect',
  'privacy', 'virtual-patching', 'xss-evasion', 'xs-leaks',
  'disclosure', 'reporting', 'terminology',
] as const;

const ISSUE_TAG_RULES: Array<{
  tag: string;
  patterns: RegExp[];
  confidence: Exclude<IssueTypeConfidence, 'curated'>;
}> = [
  { tag: 'sql-injection', patterns: [/\bsql injection\b/i, /\bsqli\b/i], confidence: 'inferred-high' },
  { tag: 'nosql-injection', patterns: [/\bnosql\b/i], confidence: 'inferred-high' },
  { tag: 'command-injection', patterns: [/\bcommand injection\b/i, /\bos command\b/i], confidence: 'inferred-high' },
  { tag: 'ldap-injection', patterns: [/\bldap injection\b/i], confidence: 'inferred-high' },
  { tag: 'xss', patterns: [/\bcross.?site scripting\b/i, /\bxss\b/i], confidence: 'inferred-high' },
  { tag: 'dom-xss', patterns: [/\bdom-based xss\b/i, /\bdom xss\b/i], confidence: 'inferred-high' },
  { tag: 'dom-clobbering', patterns: [/\bdom clobber/i], confidence: 'inferred-high' },
  { tag: 'authn', patterns: [/\bauthentication\b/i, /\blogin\b/i, /\bcredential\b/i], confidence: 'inferred-medium' },
  { tag: 'authz', patterns: [/\bauthorization\b/i], confidence: 'inferred-medium' },
  { tag: 'access-control', patterns: [/\baccess control\b/i], confidence: 'inferred-high' },
  { tag: 'session-management', patterns: [/\bsession\b/i, /\bcookie theft\b/i], confidence: 'inferred-medium' },
  { tag: 'password-storage', patterns: [/\bpassword storage\b/i, /\bpassword hashing\b/i], confidence: 'inferred-high' },
  { tag: 'mfa', patterns: [/\bmulti.?factor\b/i, /\bmfa\b/i], confidence: 'inferred-high' },
  { tag: 'secrets', patterns: [/\bsecret(s)?\b/i], confidence: 'inferred-high' },
  { tag: 'crypto', patterns: [/\bcrypt/i, /\bencryption\b/i, /\bcryptograph/i], confidence: 'inferred-medium' },
  { tag: 'key-management', patterns: [/\bkey management\b/i], confidence: 'inferred-high' },
  { tag: 'file-upload', patterns: [/\bfile upload\b/i], confidence: 'inferred-high' },
  { tag: 'deserialization', patterns: [/\bdeseriali[sz]/i], confidence: 'inferred-high' },
  { tag: 'ssrf', patterns: [/\bssrf\b/i, /\bserver.?side request forgery\b/i], confidence: 'inferred-high' },
  { tag: 'xxe', patterns: [/\bxxe\b/i, /\bxml external entity\b/i], confidence: 'inferred-high' },
  { tag: 'csrf', patterns: [/\bcsrf\b/i, /\bcross.?site request forgery\b/i], confidence: 'inferred-high' },
  { tag: 'config', patterns: [/\bconfiguration\b/i, /\bconfig\b/i], confidence: 'inferred-medium' },
  { tag: 'security-headers', patterns: [/\bsecurity headers?\b/i, /\bhttp headers?\b/i], confidence: 'inferred-medium' },
  { tag: 'csp', patterns: [/\bcontent security policy\b/i, /\bcsp\b/i], confidence: 'inferred-high' },
  { tag: 'hsts', patterns: [/\bhsts\b/i, /\bhttp strict transport security\b/i], confidence: 'inferred-high' },
  { tag: 'tls', patterns: [/\btls\b/i, /\btransport layer security\b/i], confidence: 'inferred-high' },
  { tag: 'logging', patterns: [/\blogging\b/i, /\blog security events\b/i], confidence: 'inferred-medium' },
  { tag: 'error-handling', patterns: [/\berror handling\b/i], confidence: 'inferred-high' },
  { tag: 'supply-chain', patterns: [/\bsupply chain\b/i, /\bsbom\b/i], confidence: 'inferred-high' },
  { tag: 'dependency', patterns: [/\bdependency\b/i], confidence: 'inferred-medium' },
  { tag: 'ai-security', patterns: [/\bai agent\b/i, /\bmodel ops\b/i, /\bllm\b/i], confidence: 'inferred-medium' },
  { tag: 'mcp-security', patterns: [/\bmcp security\b/i, /\bmodel context protocol\b/i], confidence: 'inferred-high' },
  { tag: 'prompt-injection', patterns: [/\bprompt injection\b/i], confidence: 'inferred-high' },
  { tag: 'clickjacking', patterns: [/\bclickjacking\b/i], confidence: 'inferred-high' },
  { tag: 'idor', patterns: [/\bidor\b/i, /\binsecure direct object reference\b/i], confidence: 'inferred-high' },
  { tag: 'mass-assignment', patterns: [/\bmass assignment\b/i], confidence: 'inferred-high' },
  { tag: 'prototype-pollution', patterns: [/\bprototype pollution\b/i], confidence: 'inferred-high' },
  { tag: 'subdomain-takeover', patterns: [/\bsubdomain takeover\b/i], confidence: 'inferred-high' },
  { tag: 'redirect', patterns: [/\bredirect(s)?\b/i], confidence: 'inferred-medium' },
  { tag: 'privacy', patterns: [/\bprivacy\b/i], confidence: 'inferred-medium' },
  { tag: 'virtual-patching', patterns: [/\bvirtual patch/i], confidence: 'inferred-high' },
  { tag: 'xss-evasion', patterns: [/\bxss filter evasion\b/i], confidence: 'inferred-high' },
  { tag: 'xs-leaks', patterns: [/\bxs leaks?\b/i], confidence: 'inferred-high' },
  { tag: 'disclosure', patterns: [/\bdisclosure\b/i], confidence: 'inferred-medium' },
  { tag: 'reporting', patterns: [/\breport(ing)?\b/i], confidence: 'inferred-medium' },
  { tag: 'terminology', patterns: [/\bterminology\b/i, /\bvocabulary\b/i], confidence: 'inferred-medium' },
];

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
  sections: SecurityDocSection[];
  tags: string[];
  relatedDocIds: string[];
  aliases: string[];
  issueTypes: string[];
  issueTypeConfidence: Partial<Record<string, IssueTypeConfidence>>;
}

export interface InferredBindings {
  workflowBindings: DocWorkflowBinding[];
  stackBindings: DocStackBinding[];
  issueTypes: string[];
  issueTypeConfidence: Partial<Record<string, IssueTypeConfidence>>;
}

export function normalizeContent(
  html: string,
  url: string,
  corpusVersion: string,
): NormalizedContent {
  const id = docIdFromUrl(url);
  const uri = docUriFromId(id);
  const fallbackTitle = titleFromUrl(url);
  const fallbackSummary = `OWASP guidance for ${fallbackTitle}`;

  if (!html || html.trim().length === 0) {
    return {
      id,
      uri,
      title: fallbackTitle,
      sourceUrl: url,
      sourceType: 'owasp-cheatsheet',
      status: 'pending',
      summary: fallbackSummary,
      headings: [],
      checklist: [],
      sections: [],
      tags: extractTags(id, [], fallbackTitle),
      relatedDocIds: [],
      aliases: [],
      issueTypes: [],
      issueTypeConfidence: {},
    };
  }

  const articleHtml = isolateArticleHtml(html);
  const cleanArticleHtml = articleHtml || html;
  const title = extractTitle(cleanArticleHtml) || fallbackTitle;
  const sections = extractSections(cleanArticleHtml);
  const headings = sections.map(section => section.heading).filter(Boolean).slice(0, 20);
  const checklist = extractChecklist(cleanArticleHtml, sections);
  const tags = extractTags(id, headings, title);
  const summary = extractSummary(cleanArticleHtml, sections, title, tags);
  const { issueTypes, issueTypeConfidence } = inferIssueTypes(id, title, headings, checklist, sections, tags);
  const relatedDocIds = extractRelatedDocIds(cleanArticleHtml, id);

  return {
    id,
    uri,
    title,
    sourceUrl: url,
    sourceType: 'owasp-cheatsheet',
    status: 'ready',
    summary,
    headings,
    checklist,
    sections,
    tags,
    relatedDocIds,
    aliases: [],
    issueTypes,
    issueTypeConfidence,
  };
}

export function inferWorkflowBindingsFromContent(
  id: string,
  tags: string[],
  normalized?: Pick<NormalizedContent, 'title' | 'headings' | 'checklist' | 'sections'>,
): InferredBindings {
  const workflowBindings: DocWorkflowBinding[] = [];
  const stackBindings: DocStackBinding[] = [];

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

  if (workflowBindings.some(binding => binding.workflowId === 'audit')) {
    workflowBindings.push({
      workflowId: 'plan-remediation',
      priority: 'required',
      rationale: 'inferred: mirrors audit binding',
    });
  }

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

  if (
    id.includes('vulnerability-disclosure') ||
    id.includes('security-terminology') ||
    id.includes('logging-vocabulary')
  ) {
    workflowBindings.push({
      workflowId: 'report',
      priority: 'required',
      rationale: 'inferred: reporting/documentation relevance',
    });
  }

  const stackMap: Record<string, string[]> = {
    django: ['python', 'django'],
    'django-rest-framework': ['python', 'django', 'drf'],
    laravel: ['php', 'laravel'],
    'ruby-on-rails': ['ruby', 'rails'],
    symfony: ['php', 'symfony'],
    nodejs: ['javascript', 'nodejs', 'typescript'],
    'nodejs-docker': ['javascript', 'nodejs', 'docker'],
    java: ['java'],
    'injection-prevention-in-java': ['java'],
    'json-web-token-for-java': ['java', 'jwt'],
    jaas: ['java'],
    dotnet: ['csharp', 'dotnet'],
    'php-configuration': ['php'],
    'npm-security': ['javascript', 'nodejs', 'npm'],
    docker: ['docker'],
    kubernetes: ['kubernetes', 'k8s'],
    serverless: ['aws-lambda', 'serverless', 'faas'],
    'infrastructure-as-code': ['terraform', 'cloudformation', 'iac'],
    graphql: ['graphql', 'api'],
    rest: ['api', 'rest'],
    grpc: ['grpc', 'api'],
    websocket: ['websocket', 'api'],
  };

  for (const [key, stacks] of Object.entries(stackMap)) {
    if (id.includes(key.replace(/-/g, '_')) || id === key.replace(/_/g, '-')) {
      for (const stack of stacks) {
        stackBindings.push({
          stack,
          condition: `inferred: ${key} specific guidance`,
        });
      }
    }
  }

  const inferredIssueTypes = normalized
    ? inferIssueTypes(id, normalized.title, normalized.headings, normalized.checklist, normalized.sections, tags)
    : inferIssueTypes(id, titleFromId(id), [], [], [], tags);

  return {
    workflowBindings,
    stackBindings,
    issueTypes: inferredIssueTypes.issueTypes,
    issueTypeConfidence: inferredIssueTypes.issueTypeConfidence,
  };
}

function extractTitle(html: string): string {
  const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return titleMatch ? normalizeInlineText(titleMatch[1]) : '';
}

function isolateArticleHtml(html: string): string {
  const candidates = [
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<div[^>]+(?:class|id)="[^"]*(?:md-content__inner|md-content|content|article|main)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  ];

  for (const pattern of candidates) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1];
  }

  return html;
}

function extractSections(articleHtml: string): SecurityDocSection[] {
  const sections: SecurityDocSection[] = [];
  const headingRegex =
    /<(h2|h3)[^>]*(?:id="([^"]+)")?[^>]*>([\s\S]*?)<\/\1>([\s\S]*?)(?=<(?:h2|h3)\b|$)/gi;
  let match: RegExpExecArray | null;

  while ((match = headingRegex.exec(articleHtml)) !== null) {
    const heading = normalizeInlineText(match[3] ?? '');
    if (!heading) continue;
    const bodyHtml = match[4] ?? '';
    const text = normalizeBlockText(bodyHtml);
    if (!text) continue;
    const anchor = (match[2] && slugify(match[2])) || slugify(heading);
    const keywords = extractKeywords(`${heading}\n${text}`);
    sections.push({ heading, anchor, text, ...(keywords.length > 0 ? { keywords } : {}) });
  }

  if (sections.length > 0) {
    return sections.slice(0, 40);
  }

  const paragraphs = extractMeaningfulParagraphs(articleHtml);
  if (paragraphs.length === 0) return [];

  return [{
    heading: 'Overview',
    anchor: 'overview',
    text: paragraphs.slice(0, 5).join('\n'),
    keywords: extractKeywords(paragraphs.join(' ')),
  }];
}

function extractSummary(
  articleHtml: string,
  sections: SecurityDocSection[],
  title: string,
  tags: string[],
): string {
  const leadParagraphs = extractMeaningfulParagraphs(articleHtml);
  const lead = leadParagraphs[0];
  if (lead) return truncate(lead, 240);

  const sectionLead = sections
    .map(section => section.text.split('\n').find(line => line.trim().length > 40) ?? '')
    .find(Boolean);
  if (sectionLead) return truncate(sectionLead, 240);

  if (tags.length > 0) {
    return `OWASP ${title} guidance covering ${tags.slice(0, 3).join(', ')}`;
  }
  return `OWASP guidance for ${title}`;
}

function extractChecklist(articleHtml: string, sections: SecurityDocSection[]): string[] {
  const items = new Set<string>();
  const listRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let match: RegExpExecArray | null;

  while ((match = listRegex.exec(articleHtml)) !== null) {
    const item = normalizeInlineText(match[1] ?? '');
    if (!item || item.length < 10 || item.length > 400) continue;
    if (CHECKLIST_VERB_PATTERN.test(item)) {
      items.add(item);
    }
  }

  for (const section of sections) {
    for (const line of section.text.split('\n')) {
      const cleaned = line.replace(/^[-*]\s*/, '').trim();
      if (!cleaned || cleaned.length < 10 || cleaned.length > 220) continue;
      if (CHECKLIST_VERB_PATTERN.test(cleaned)) {
        items.add(cleaned);
      }
    }
  }

  return [...items].slice(0, 25);
}

function extractRelatedDocIds(articleHtml: string, docId: string): string[] {
  const related = new Set<string>();
  const scopedBlocks = collectRelatedHtmlBlocks(articleHtml);

  for (const block of scopedBlocks) {
    for (const refId of extractDocIdsFromLinks(block)) {
      if (refId !== docId) related.add(refId);
    }
  }

  if (related.size === 0) {
    for (const refId of extractDocIdsFromLinks(articleHtml)) {
      if (refId !== docId) related.add(refId);
    }
  }

  for (const section of extractSections(articleHtml)) {
    if (!RELATED_SECTION_HINTS.test(section.heading)) continue;
    for (const refId of extractDocIdsFromLinks(section.text)) {
      if (refId !== docId) related.add(refId);
    }
  }

  return [...related].slice(0, 12);
}

function collectRelatedHtmlBlocks(articleHtml: string): string[] {
  const blocks: string[] = [];
  const sectionRegex = /<(h2|h3)[^>]*>([\s\S]*?)<\/\1>([\s\S]*?)(?=<(?:h2|h3)\b|$)/gi;
  let match: RegExpExecArray | null;

  while ((match = sectionRegex.exec(articleHtml)) !== null) {
    const heading = normalizeInlineText(match[2] ?? '');
    if (RELATED_SECTION_HINTS.test(heading)) {
      blocks.push(match[3] ?? '');
    }
  }

  if (blocks.length > 0) return blocks;

  const paragraphs = articleHtml.match(/<p[^>]*>[\s\S]*?<\/p>/gi) ?? [];
  return paragraphs.filter(paragraph =>
    /cheat sheet|see also|reference/i.test(normalizeInlineText(paragraph)),
  );
}

function extractDocIdsFromLinks(textOrHtml: string): string[] {
  const result = new Set<string>();
  const hrefRegex = /href="([^"]+)"/gi;
  let match: RegExpExecArray | null;

  while ((match = hrefRegex.exec(textOrHtml)) !== null) {
    const href = match[1] ?? '';
    const id = docIdFromHref(href);
    if (id) result.add(id);
  }

  return [...result];
}

function docIdFromHref(href: string): string | null {
  if (!/cheatsheet/i.test(href)) return null;
  const normalizedHref = href
    .replace(/^https?:\/\/cheatsheetseries\.owasp\.org\//i, '/')
    .replace(/^\/+/, '/');
  const absoluteLike = normalizedHref.startsWith('/cheatsheets/')
    ? `https://cheatsheetseries.owasp.org${normalizedHref}`
    : `https://cheatsheetseries.owasp.org/cheatsheets/${normalizedHref.replace(/^\/?/, '')}`;

  try {
    const id = urlToId(absoluteLike);
    return CANONICAL_IDS.has(id) ? id : null;
  } catch {
    return null;
  }
}

function inferIssueTypes(
  id: string,
  title: string,
  headings: string[],
  checklist: string[],
  sections: SecurityDocSection[],
  tags: string[],
): {
  issueTypes: string[];
  issueTypeConfidence: Partial<Record<string, IssueTypeConfidence>>;
} {
  const issueTypes = new Set<string>();
  const issueTypeConfidence: Partial<Record<string, IssueTypeConfidence>> = {};
  const searchableText = [
    id,
    title,
    ...tags,
    ...headings,
    ...checklist,
    ...sections.map(section => `${section.heading}\n${section.text}`),
  ].join('\n');

  for (const rule of ISSUE_TAG_RULES) {
    if (rule.patterns.some(pattern => pattern.test(searchableText))) {
      issueTypes.add(rule.tag);
      issueTypeConfidence[rule.tag] = rule.confidence;
    }
  }

  if ([...issueTypes].some(tag => tag.endsWith('-injection')) && !issueTypes.has('injection')) {
    issueTypes.add('injection');
    issueTypeConfidence['injection'] = 'inferred-medium';
  }

  return {
    issueTypes: [...issueTypes].filter(tag => (CANONICAL_ISSUE_TAGS as readonly string[]).includes(tag)).sort(),
    issueTypeConfidence,
  };
}

function extractTags(id: string, headings: string[], title: string): string[] {
  const tags = new Set<string>();
  const searchable = `${id} ${title} ${headings.join(' ')}`.toLowerCase();
  const topicMap: Record<string, string[]> = {
    injection: ['sql', 'nosql', 'ldap', 'os-command', 'injection'],
    xss: ['xss', 'cross-site-scripting', 'dom', 'output-encoding'],
    auth: ['auth', 'authentication', 'password', 'mfa', 'credential'],
    authorization: ['authorization', 'access-control', 'rbac', 'abac'],
    crypto: ['crypto', 'encryption', 'key-management', 'tls', 'ssl'],
    session: ['session', 'cookie', 'jwt'],
    logging: ['logging', 'audit', 'monitoring'],
    dependency: ['dependency', 'supply-chain', 'sbom'],
    api: ['rest', 'graphql', 'api', 'web-service', 'grpc'],
    framework: ['django', 'laravel', 'rails', 'symfony', 'nodejs', 'java', 'dotnet'],
    infrastructure: ['docker', 'kubernetes', 'cloud', 'serverless', 'iac'],
    ai: ['ai', 'llm', 'prompt-injection', 'mcp'],
  };

  for (const [topic, keywords] of Object.entries(topicMap)) {
    if (keywords.some(keyword => searchable.includes(keyword))) {
      tags.add(topic);
    }
  }

  return [...tags].sort();
}

function extractMeaningfulParagraphs(html: string): string[] {
  const paragraphs = html.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) ?? [];
  return paragraphs
    .map(paragraph => normalizeInlineText(paragraph))
    .filter(paragraph => paragraph.length > 40 && !/copyright|edit on github/i.test(paragraph))
    .slice(0, 8);
}

function extractKeywords(text: string): string[] {
  const words = normalizeBlockText(text)
    .toLowerCase()
    .split(/[^a-z0-9+#.-]+/)
    .filter(word => word.length > 3);
  return [...new Set(words)].slice(0, 12);
}

function normalizeInlineText(html: string): string {
  return decodeEntities(
    html
      .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, ' $1 ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

function normalizeBlockText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(br|\/p|\/li|\/ul|\/ol|\/pre|\/code)>/gi, '\n')
      .replace(/<(p|li|ul|ol|pre|code|blockquote)[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\r/g, '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim(),
  );
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trim()}...`;
}

function titleFromUrl(url: string): string {
  return titleFromId(docIdFromUrl(url));
}

function titleFromId(id: string): string {
  return id
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
