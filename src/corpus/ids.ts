/**
 * Corpus ID and URI Policy
 *
 * Provides deterministic ID generation, URI scheme, and alias resolution
 * for the OWASP security corpus.
 *
 * ID derivation wraps the existing urlToId() from owasp-ingestion.ts —
 * the same logic that has been producing stable IDs for all 113 URLs.
 */

import { urlToId, OWASP_CANONICAL_URLS } from '../core/owasp-ingestion.js';

/**
 * URI scheme prefix for security documents.
 */
const URI_PREFIX = 'security://owasp/cheatsheet/';

/**
 * Alias table for historical name variations.
 * Maps alternative names/abbreviations to the primary canonical ID.
 */
const DOC_ALIASES: Record<string, string> = {
  // Injection family
  'xss-prevention': 'cross-site-scripting-prevention',
  'csrf-prevention': 'cross-site-request-forgery-prevention',
  'ssrf-prevention': 'server-side-request-forgery-prevention',
  'xxe-prevention': 'xml-external-entity-prevention',
  'sql-injection': 'sql-injection-prevention',
  'cmd-injection': 'os-command-injection-defense',
  'command-injection': 'os-command-injection-defense',
  'ldap-injection': 'ldap-injection-prevention',
  'nosql-injection': 'nosql-security',
  'dom-xss': 'dom-based-xss-prevention',
  'dom-xss-prevention': 'dom-based-xss-prevention',

  // Auth family
  'auth': 'authentication',
  'authn': 'authentication',
  'authz': 'authorization',
  'access-control': 'access-control',
  'mfa': 'multifactor-authentication',
  'multi-factor-authentication': 'multifactor-authentication',

  // Session/crypto
  'session': 'session-management',
  'cookies': 'cookie-theft-mitigation',
  'jwt': 'json-web-token-for-java',
  'crypto': 'cryptographic-storage',
  'encryption': 'cryptographic-storage',
  'tls': 'transport-layer-security',
  'ssl': 'transport-layer-security',
  'hsts': 'http-strict-transport-security',

  // Supply chain
  'sbom': 'dependency-graph-sbom',
  'supply-chain': 'software-supply-chain-security',

  // AI
  'ai': 'ai-agent-security',
  'llm': 'llm-prompt-injection-prevention',
  'prompt-injection': 'llm-prompt-injection-prevention',
  'mcp': 'mcp-security',

  // Frameworks (common short names)
  'django': 'django-security',
  'drf': 'django-rest-framework',
  'rails': 'ruby-on-rails',
  'node': 'nodejs-security',
  'node-js': 'nodejs-security',
  'node-js-docker': 'nodejs-docker',
  'npm': 'npm-security',
  'dot-net': 'dotnet-security',
  'php': 'php-configuration',
  'k8s': 'kubernetes-security',
  'docker': 'docker-security',
  'iac': 'infrastructure-as-code-security',
  'serverless': 'serverless-faas-security',
  'graphql-security': 'graphql',
  'grpc-security': 'grpc-security',
  'rest': 'rest-security',
  'rest-assessment': 'rest-assessment',

  // Config
  'csp': 'content-security-policy',
  'input-validation': 'input-validation',
  'error-handling': 'error-handling',
  'logging': 'logging',
};

/**
 * All 113 canonical IDs derived from OWASP_CANONICAL_URLS.
 * Computed once at module load, then frozen.
 */
export const ALL_KNOWN_IDS: readonly string[] = Object.freeze(
  OWASP_CANONICAL_URLS.map(url => urlToId(url))
);

/**
 * Derive a canonical corpus ID from a cheat sheet URL.
 * Wraps the existing urlToId() logic — same deterministic output.
 *
 * @param url - OWASP cheat sheet URL
 * @returns kebab-case ID (e.g., "password-storage")
 */
export function docIdFromUrl(url: string): string {
  return urlToId(url);
}

/**
 * Construct a security:// URI from a corpus document ID.
 *
 * @param id - Canonical document ID
 * @returns URI string (e.g., "security://owasp/cheatsheet/password-storage")
 */
export function docUriFromId(id: string): string {
  return `${URI_PREFIX}${id}`;
}

/**
 * Resolve an alias or alternative name to a primary canonical ID.
 *
 * @param alias - Alternative name or abbreviation
 * @returns The primary canonical ID, or null if no alias match found
 */
export function resolveDocAlias(alias: string): string | null {
  const normalized = alias.toLowerCase().trim();
  if (normalized === '') return null;

  // Direct alias lookup
  const mapped = DOC_ALIASES[normalized];
  if (mapped) return mapped;

  // Check if it's already a known ID
  if (ALL_KNOWN_IDS.includes(normalized)) return normalized;

  return null;
}

/**
 * Check if a string is a known canonical ID.
 *
 * @param id - ID to check
 * @returns true if the ID exists in the canonical set
 */
export function isKnownId(id: string): boolean {
  return ALL_KNOWN_IDS.includes(id);
}

/**
 * Get all aliases mapped to a given canonical ID.
 *
 * @param canonicalId - The canonical ID
 * @returns Array of aliases that resolve to this ID
 */
export function getAliasesForId(canonicalId: string): string[] {
  const aliases: string[] = [];
  for (const [alias, target] of Object.entries(DOC_ALIASES)) {
    if (target === canonicalId) {
      aliases.push(alias);
    }
  }
  return aliases;
}
