/**
 * Issue Taxonomy
 *
 * Maps finding categories, patch types, and verification domains
 * into canonical vulnerability tags used for specialist matching.
 * Consumes existing audit artifacts when available.
 */

/**
 * Canonical issue tags used across the delegation system.
 */
export type IssueTag =
  | 'injection'
  | 'sql-injection'
  | 'nosql-injection'
  | 'command-injection'
  | 'ldap-injection'
  | 'xss'
  | 'dom-xss'
  | 'dom-clobbering'
  | 'authn'
  | 'authz'
  | 'access-control'
  | 'session-management'
  | 'password-storage'
  | 'mfa'
  | 'secrets'
  | 'crypto'
  | 'key-management'
  | 'file-upload'
  | 'deserialization'
  | 'ssrf'
  | 'xxe'
  | 'csrf'
  | 'config'
  | 'security-headers'
  | 'csp'
  | 'hsts'
  | 'tls'
  | 'logging'
  | 'error-handling'
  | 'supply-chain'
  | 'dependency'
  | 'ai-security'
  | 'mcp-security'
  | 'prompt-injection'
  | 'clickjacking'
  | 'idor'
  | 'mass-assignment'
  | 'prototype-pollution'
  | 'subdomain-takeover'
  | 'redirect'
  | 'privacy'
  | 'virtual-patching'
  | 'xss-evasion'
  | 'xs-leaks';

/**
 * All canonical issue tags as a readonly array.
 */
export const ALL_ISSUE_TAGS: readonly IssueTag[] = [
  'injection', 'sql-injection', 'nosql-injection', 'command-injection',
  'ldap-injection', 'xss', 'dom-xss', 'dom-clobbering', 'authn', 'authz',
  'access-control', 'session-management', 'password-storage', 'mfa',
  'secrets', 'crypto', 'key-management', 'file-upload', 'deserialization',
  'ssrf', 'xxe', 'csrf', 'config', 'security-headers', 'csp', 'hsts',
  'tls', 'logging', 'error-handling', 'supply-chain', 'dependency',
  'ai-security', 'mcp-security', 'prompt-injection', 'clickjacking', 'idor',
  'mass-assignment', 'prototype-pollution', 'subdomain-takeover', 'redirect',
  'privacy', 'virtual-patching', 'xss-evasion', 'xs-leaks',
];

/**
 * Mapping from raw finding categories to canonical issue tags.
 * Keys are lowercased for case-insensitive matching.
 */
const CATEGORY_TO_TAGS: Record<string, IssueTag[]> = {
  // OWASP Top 10 mappings
  'broken access control': ['access-control', 'authz'],
  'a01': ['access-control', 'authz'],
  'a01:2021': ['access-control', 'authz'],

  'cryptographic failures': ['crypto', 'key-management', 'tls'],
  'sensitive data exposure': ['crypto', 'secrets'],
  'a02': ['crypto', 'key-management', 'tls'],
  'a02:2021': ['crypto', 'key-management', 'tls'],

  'injection': ['injection', 'sql-injection', 'command-injection', 'xss'],
  'a03': ['injection', 'sql-injection', 'command-injection', 'xss'],
  'a03:2021': ['injection', 'sql-injection', 'command-injection', 'xss'],
  'sql injection': ['sql-injection', 'injection'],
  'sql-injection': ['sql-injection', 'injection'],
  'sqli': ['sql-injection', 'injection'],
  'nosql injection': ['nosql-injection', 'injection'],
  'nosql-injection': ['nosql-injection', 'injection'],
  'command injection': ['command-injection', 'injection'],
  'command-injection': ['command-injection', 'injection'],
  'os command injection': ['command-injection', 'injection'],
  'ldap injection': ['ldap-injection', 'injection'],
  'ldap-injection': ['ldap-injection', 'injection'],

  'insecure design': ['authn', 'authz', 'access-control'],
  'a04': ['authn', 'authz', 'access-control'],
  'a04:2021': ['authn', 'authz', 'access-control'],

  'security misconfiguration': ['config', 'security-headers', 'error-handling'],
  'a05': ['config', 'security-headers', 'error-handling'],
  'a05:2021': ['config', 'security-headers', 'error-handling'],

  'vulnerable components': ['supply-chain', 'dependency'],
  'vulnerable dependencies': ['supply-chain', 'dependency'],
  'a06': ['supply-chain', 'dependency'],
  'a06:2021': ['supply-chain', 'dependency'],

  'authentication failures': ['authn', 'session-management', 'password-storage', 'mfa'],
  'a07': ['authn', 'session-management', 'password-storage', 'mfa'],
  'a07:2021': ['authn', 'session-management', 'password-storage', 'mfa'],

  'data integrity failures': ['deserialization', 'supply-chain'],
  'a08': ['deserialization', 'supply-chain'],
  'a08:2021': ['deserialization', 'supply-chain'],

  'logging failures': ['logging', 'error-handling'],
  'security logging': ['logging', 'error-handling'],
  'a09': ['logging', 'error-handling'],
  'a09:2021': ['logging', 'error-handling'],

  'ssrf': ['ssrf'],
  'server-side request forgery': ['ssrf'],
  'a10': ['ssrf'],
  'a10:2021': ['ssrf'],

  // XSS family
  'xss': ['xss'],
  'cross-site scripting': ['xss'],
  'reflected xss': ['xss'],
  'stored xss': ['xss'],
  'dom xss': ['dom-xss', 'xss'],
  'dom-based xss': ['dom-xss', 'xss'],
  'dom clobbering': ['dom-clobbering'],

  // Auth family
  'authentication': ['authn'],
  'authorization': ['authz'],
  'session management': ['session-management'],
  'session': ['session-management'],
  'password': ['password-storage'],
  'password storage': ['password-storage'],
  'mfa': ['mfa'],
  'multi-factor': ['mfa'],
  'multifactor': ['mfa'],

  // Secrets & crypto
  'secrets': ['secrets'],
  'secret exposure': ['secrets'],
  'hardcoded secret': ['secrets'],
  'hardcoded credential': ['secrets'],
  'api key': ['secrets'],
  'cryptographic storage': ['crypto'],
  'encryption': ['crypto'],
  'key management': ['key-management'],

  // Other vuln types
  'file upload': ['file-upload'],
  'deserialization': ['deserialization'],
  'insecure deserialization': ['deserialization'],
  'xxe': ['xxe'],
  'xml external entity': ['xxe'],
  'csrf': ['csrf'],
  'cross-site request forgery': ['csrf'],
  'idor': ['idor'],
  'insecure direct object reference': ['idor'],
  'mass assignment': ['mass-assignment'],
  'clickjacking': ['clickjacking'],
  'prototype pollution': ['prototype-pollution'],
  'subdomain takeover': ['subdomain-takeover'],
  'open redirect': ['redirect'],
  'unvalidated redirect': ['redirect'],

  // Config & headers
  'security headers': ['security-headers'],
  'content security policy': ['csp'],
  'csp': ['csp'],
  'hsts': ['hsts'],
  'strict-transport-security': ['hsts'],
  'tls': ['tls'],
  'ssl': ['tls'],
  'transport layer': ['tls'],

  // AI security
  'ai agent': ['ai-security'],
  'ai security': ['ai-security'],
  'mcp security': ['mcp-security'],
  'prompt injection': ['prompt-injection'],

  // Misc
  'logging': ['logging'],
  'error handling': ['error-handling'],
  'privacy': ['privacy'],
};

/**
 * Mapping from patch/remediation types to issue tags.
 */
const PATCH_TYPE_TO_TAGS: Record<string, IssueTag[]> = {
  'input-validation': ['injection', 'sql-injection', 'nosql-injection', 'command-injection'],
  'parameterized-query': ['sql-injection'],
  'output-encoding': ['xss'],
  'auth-fix': ['authn', 'authz'],
  'session-fix': ['session-management'],
  'secret-rotation': ['secrets'],
  'crypto-upgrade': ['crypto', 'key-management'],
  'config-hardening': ['config', 'security-headers'],
  'header-fix': ['security-headers', 'csp', 'hsts'],
  'dependency-upgrade': ['supply-chain', 'dependency'],
  'file-upload-restriction': ['file-upload'],
  'deserialization-fix': ['deserialization'],
  'ssrf-fix': ['ssrf'],
  'xxe-fix': ['xxe'],
  'csrf-fix': ['csrf'],
};

/**
 * Mapping from verification domains to issue tags.
 */
const VERIFICATION_DOMAIN_TO_TAGS: Record<string, IssueTag[]> = {
  'authentication': ['authn', 'session-management', 'password-storage', 'mfa'],
  'authorization': ['authz', 'access-control'],
  'data-protection': ['crypto', 'secrets', 'key-management'],
  'input-handling': ['injection', 'sql-injection', 'xss'],
  'configuration': ['config', 'security-headers'],
  'logging': ['logging', 'error-handling'],
  'network': ['tls', 'ssrf'],
};

/**
 * Result of issue tag classification.
 */
export interface IssueClassification {
  /** Raw input values */
  raw: string[];
  /** Canonical issue tags (deduplicated, sorted) */
  tags: IssueTag[];
}

/**
 * Classify finding categories into canonical issue tags.
 *
 * @param categories - Raw finding categories or vulnerability types
 * @returns Classification with raw and canonical tag values
 */
export function classifyFindings(categories: string[]): IssueClassification {
  return classifyWithMapping(categories, CATEGORY_TO_TAGS);
}

/**
 * Classify patch/remediation types into canonical issue tags.
 *
 * @param patchTypes - Raw patch type identifiers
 * @returns Classification with raw and canonical tag values
 */
export function classifyPatches(patchTypes: string[]): IssueClassification {
  return classifyWithMapping(patchTypes, PATCH_TYPE_TO_TAGS);
}

/**
 * Classify verification domains into canonical issue tags.
 *
 * @param domains - Raw verification domain identifiers
 * @returns Classification with raw and canonical tag values
 */
export function classifyVerificationDomains(domains: string[]): IssueClassification {
  return classifyWithMapping(domains, VERIFICATION_DOMAIN_TO_TAGS);
}

/**
 * Generic classification using a lookup mapping.
 * Falls back to individual word matching for multi-word inputs.
 */
function classifyWithMapping(
  inputs: string[],
  mapping: Record<string, IssueTag[]>
): IssueClassification {
  const tags = new Set<IssueTag>();

  for (const input of inputs) {
    const key = input.toLowerCase().trim();
    if (key === '') continue;

    // Direct lookup
    const mapped = mapping[key];
    if (mapped) {
      for (const tag of mapped) {
        tags.add(tag);
      }
      continue;
    }

    // Try partial match: check if any mapping key is contained in the input
    for (const [mapKey, mapTags] of Object.entries(mapping)) {
      if (key.includes(mapKey) || mapKey.includes(key)) {
        for (const tag of mapTags) {
          tags.add(tag);
        }
      }
    }
  }

  return {
    raw: [...inputs],
    tags: [...tags].sort(),
  };
}

/**
 * Check if an issue tag is a known canonical tag.
 */
export function isKnownIssueTag(tag: string): tag is IssueTag {
  return (ALL_ISSUE_TAGS as readonly string[]).includes(tag);
}
