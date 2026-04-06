/**
 * OWASP Corpus Ingestion Module
 *
 * DUAL-USE: This module serves both the corpus build pipeline and
 * (during --legacy-specialists mode) the install-time fetch path.
 *
 * Build-time use (active):
 *   - snapshot-builder.ts imports fetchCheatSheet(), parseCheatSheetHtml(),
 *     urlToId(), urlToTitle() for corpus construction
 *   - normalize.ts imports urlToId() and OWASP_CANONICAL_URLS
 *
 * Install-time use (legacy only):
 *   - installer.ts imports fetchAllCheatSheets() only when
 *     --legacy-specialists flag is set
 *
 * After Release C: fetchAllCheatSheets() and install-time imports
 * can be removed. Build-time imports remain.
 */

import type { OwaspCorpusEntry, WorkflowId } from './types.js';

export interface FetchCheatSheetOptions {
  timeoutMs?: number;
  maxAttempts?: number;
  retryableStatuses?: number[];
  fetchImpl?: typeof fetch;
}

export interface FetchCheatSheetResult {
  ok: boolean;
  html: string;
  fetchStatus: 'success' | 'timeout' | 'http-error' | 'parse-error';
  attempts: number;
  lastSuccessfulFetchAt?: string;
  statusCode?: number;
  error?: string;
}

const DEFAULT_FETCH_OPTIONS: Required<Omit<FetchCheatSheetOptions, 'fetchImpl'>> = {
  timeoutMs: 10_000,
  maxAttempts: 3,
  retryableStatuses: [408, 425, 429, 500, 502, 503, 504],
};

/**
 * Canonical seed URL for the OWASP Cheat Sheet Series.
 * The Index Alphabetical page lists all cheat sheets.
 */
export const OWASP_SEED_URL = 'https://cheatsheetseries.owasp.org/Glossary.html';

/**
 * All 113 canonical OWASP cheat sheet URLs.
 * These are the only URLs that become first-class specialists.
 */
export const OWASP_CANONICAL_URLS = [
  'https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/AJAX_Security_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Abuse_Case_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Access_Control_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Attack_Surface_Analysis_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Testing_Automation_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Automotive_Security_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Bean_Validation_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Browser_Extension_Vulnerabilities_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/C-Based_Toolchain_Hardening_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/CI_CD_Security_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Choosing_and_Using_Security_Questions_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Clickjacking_Defense_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Cookie_Theft_Mitigation_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Credential_Stuffing_Prevention_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/DOM_Clobbering_Prevention_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/DOM_based_XSS_Prevention_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Database_Security_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Dependency_Graph_SBOM_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Deserialization_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Django_REST_Framework_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Django_Security_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/DotNet_Security_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Drone_Security_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Email_Validation_and_Verification_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/GraphQL_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Strict_Transport_Security_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Infrastructure_as_Code_Security_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Injection_Prevention_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Injection_Prevention_in_Java_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/JAAS_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Java_Security_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Key_Management_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Kubernetes_Security_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/LDAP_Injection_Prevention_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Laravel_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Legacy_Application_Management_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Logging_Vocabulary_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/MCP_Security_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Microservices_Security_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Microservices_based_Security_Arch_Doc_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Mobile_Application_Security_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/NPM_Security_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Network_Segmentation_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/NoSQL_Security_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/NodeJS_Docker_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Nodejs_Security_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/OS_Command_Injection_Defense_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/PHP_Configuration_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Pinning_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Prototype_Pollution_Prevention_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Query_Parameterization_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/REST_Assessment_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Ruby_on_Rails_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/SAML_Security_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Secure_AI_Model_Ops_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Secure_Cloud_Architecture_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Secure_Code_Review_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Secure_Product_Design_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Securing_Cascading_Style_Sheets_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Security_Terminology_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Serverless_FaaS_Security_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Software_Supply_Chain_Security_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Subdomain_Takeover_Prevention_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Symfony_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/TLS_Cipher_String_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Third_Party_Javascript_Management_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Third_Party_Payment_Gateway_Integration_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Threat_Modeling_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Protection_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Security_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/User_Privacy_Protection_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Virtual_Patching_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Vulnerability_Disclosure_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Vulnerable_Dependency_Management_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Web_Service_Security_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/XML_External_Entity_Prevention_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/XML_Security_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/XSS_Filter_Evasion_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/XS_Leaks_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/Zero_Trust_Architecture_Cheat_Sheet.html',
  'https://cheatsheetseries.owasp.org/cheatsheets/gRPC_Security_Cheat_Sheet.html',
] as const;

/**
 * Extract a stable ID from a cheat sheet URL.
 * @param url - The cheat sheet URL
 * @returns A kebab-case ID (e.g., "password-storage")
 */
export function urlToId(url: string): string {
  const match = url.match(/cheatsheets\/(.+)\.html/);
  if (!match) {
    throw new Error(`Invalid OWASP cheat sheet URL: ${url}`);
  }
  // Extract the filename and remove the '_Cheat_Sheet' suffix if present
  const filename = match[1];
  const withoutSuffix = filename.replace(/_Cheat_Sheet$/, '');
  return withoutSuffix
    .replace(/_/g, '-')
    .toLowerCase();
}

/**
 * Extract title from a cheat sheet URL.
 * @param url - The cheat sheet URL
 * @returns A human-readable title
 */
export function urlToTitle(url: string): string {
  const id = urlToId(url);
  return id
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Parse HTML content and extract structured data.
 * @param html - The HTML content
 * @param url - The source URL
 * @returns A partial OwaspCorpusEntry
 */
export function parseCheatSheetHtml(html: string, url: string): Partial<OwaspCorpusEntry> {
  const id = urlToId(url);
  const title = urlToTitle(url);

  // Extract title from HTML if available
  const titleMatch = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
  const actualTitle = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : title;

  // Extract all headings (h2, h3)
  const headingRegex = /<h[23][^>]*>(.*?)<\/h[23]>/gi;
  const headings: string[] = [];
  let headingMatch;
  while ((headingMatch = headingRegex.exec(html)) !== null) {
    const headingText = headingMatch[1].replace(/<[^>]*>/g, '').trim();
    if (headingText && !headingText.startsWith('Introduction') && !headingText.startsWith('Related')) {
      headings.push(headingText);
    }
  }

  // Extract checklist items (li elements within content)
  const checklistRegex = /<li[^>]*>(.*?)<\/li>/gi;
  const checklistItems: string[] = [];
  let checklistMatch;
  while ((checklistMatch = checklistRegex.exec(html)) !== null) {
    const itemText = checklistMatch[1].replace(/<[^>]*>/g, '').trim();
    if (itemText && itemText.length > 10 && itemText.length < 500) {
      checklistItems.push(itemText);
    }
  }

  // Limit checklist items to most relevant
  const limitedChecklistItems = checklistItems
    .filter(item =>
      item.includes('should') ||
      item.includes('must') ||
      item.includes('ensure') ||
      item.includes('verify') ||
      item.includes('avoid') ||
      item.includes('use')
    )
    .slice(0, 20);

  // Extract intro paragraph
  const introMatch = html.match(/<p[^>]*>(.*?)<\/p>/i);
  const intentSummary = introMatch
    ? introMatch[1].replace(/<[^>]*>/g, '').trim().slice(0, 200)
    : `OWASP ${actualTitle} guidance`;

  // Extract canonical references to other cheat sheets
  const canonicalRefs: string[] = [];

  // Match both absolute paths (/cheatsheets/Foo.html) and relative links (Foo_Cheat_Sheet.html)
  const linkPatterns = [
    /href="\/cheatsheets\/([^"]+)\.html"/g,  // Absolute: /cheatsheets/Foo_Cheat_Sheet.html
    /href="([^"]+_Cheat_Sheet)\.html"/g,      // Relative: Foo_Cheat_Sheet.html
  ];

  for (const pattern of linkPatterns) {
    let linkMatch;
    // eslint-disable-next-line no-cond-assign
    while ((linkMatch = pattern.exec(html)) !== null) {
      let refId = linkMatch[1].replace(/_/g, '-').toLowerCase();
      // Remove 'cheat-sheet' suffix if present (from Foo_Cheat_Sheet -> Foo)
      refId = refId.replace(/-cheat-sheet$/, '');
      if (refId !== id && OWASP_CANONICAL_URLS.some(url => urlToId(url) === refId)) {
        canonicalRefs.push(refId);
      }
    }
  }

  return {
    id,
    title: actualTitle,
    sourceUrl: url,
    intentSummary,
    headings: headings.slice(0, 15),
    checklistItems: limitedChecklistItems,
    canonicalRefs: [...new Set(canonicalRefs)],
    workflowBindings: [],
    stackBindings: [],
    tags: extractTags(id, headings),
    status: 'parsed',
  };
}

/**
 * Extract tags from ID and headings.
 */
function extractTags(id: string, headings: string[]): string[] {
  const tags = new Set<string>();

  // Add base topic tags
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
 * Fetch a single cheat sheet page.
 * @param url - The cheat sheet URL
 * @returns HTML content
 */
export async function fetchCheatSheetWithMetadata(
  url: string,
  options: FetchCheatSheetOptions = {},
): Promise<FetchCheatSheetResult> {
  const opts = { ...DEFAULT_FETCH_OPTIONS, ...options };
  const fetchImpl = options.fetchImpl ?? fetch;
  let lastError: string | undefined;
  let lastStatusCode: number | undefined;
  let lastStatus: FetchCheatSheetResult['fetchStatus'] = 'http-error';

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), opts.timeoutMs);

    try {
      const response = await fetchImpl(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        lastStatusCode = response.status;
        lastError = `HTTP ${response.status} ${response.statusText}`.trim();
        lastStatus = 'http-error';

        if (attempt < opts.maxAttempts && opts.retryableStatuses.includes(response.status)) {
          await sleep(backoffMs(attempt));
          continue;
        }

        return {
          ok: false,
          html: '',
          fetchStatus: 'http-error',
          attempts: attempt,
          statusCode: response.status,
          error: lastError,
        };
      }

      const html = await response.text();
      return {
        ok: true,
        html,
        fetchStatus: 'success',
        attempts: attempt,
        lastSuccessfulFetchAt: new Date().toISOString(),
        statusCode: response.status,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      const isAbort = error instanceof Error && error.name === 'AbortError';
      lastStatus = isAbort ? 'timeout' : 'http-error';
      lastError = error instanceof Error ? error.message : String(error);

      if (attempt < opts.maxAttempts) {
        await sleep(backoffMs(attempt));
        continue;
      }
    }
  }

  return {
    ok: false,
    html: '',
    fetchStatus: lastStatus,
    attempts: opts.maxAttempts,
    ...(lastStatusCode ? { statusCode: lastStatusCode } : {}),
    ...(lastError ? { error: lastError } : {}),
  };
}

export async function fetchCheatSheet(
  url: string,
  options: FetchCheatSheetOptions = {},
): Promise<string> {
  const result = await fetchCheatSheetWithMetadata(url, options);
  if (!result.ok) {
    throw new Error(`Failed to fetch ${url}: ${result.error ?? result.fetchStatus}`);
  }
  return result.html;
}

/**
 * Fetch and parse all OWASP cheat sheets.
 * @returns Array of OwaspCorpusEntry
 */
export async function fetchAllCheatSheets(): Promise<OwaspCorpusEntry[]> {
  const results: OwaspCorpusEntry[] = [];

  for (const url of OWASP_CANONICAL_URLS) {
    try {
      const html = await fetchCheatSheet(url);
      const entry = createCorpusEntry(html, url);
      results.push(entry);
    } catch (error) {
      console.error(`Failed to fetch ${url}:`, error);
      // Create a placeholder entry with pending status
      // Use inferred bindings even for failed fetches
      const id = urlToId(url);
      const workflowBindings = inferWorkflowBindings(id, [], []);
      const stackBindings = inferStackBindings(id);
      results.push({
        id,
        title: urlToTitle(url),
        sourceUrl: url,
        intentSummary: `OWASP ${urlToTitle(url)} guidance`,
        headings: [],
        checklistItems: [],
        canonicalRefs: [],
        workflowBindings,
        stackBindings,
        tags: [],
        status: 'pending',
      });
    }
  }

  return results;
}

function backoffMs(attempt: number): number {
  return 250 * (2 ** Math.max(0, attempt - 1));
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get workflow bindings for a cheat sheet based on its ID and content.
 * @param id - Cheat sheet ID
 * @param headings - Section headings
 * @param tags - Extracted tags
 * @returns Array of workflow IDs
 */
export function inferWorkflowBindings(id: string, headings: string[], tags: string[]): WorkflowId[] {
  const bindings: WorkflowId[] = [];

  // Map-codebase binding: architecture, inventory, supply chain
  if (tags.includes('dependency') ||
      id.includes('attack-surface') ||
      id.includes('abuse-case') ||
      id.includes('sbom') ||
      id.includes('supply-chain') ||
      id.includes('cloud') ||
      id.includes('microservices') ||
      id.includes('network')) {
    bindings.push('map-codebase');
  }

  // Threat-model binding: threat modeling, abuse cases, design
  if (id.includes('threat-modeling') ||
      id.includes('abuse-case') ||
      id.includes('attack-surface') ||
      id.includes('secure-product-design') ||
      id.includes('multi-tenant') ||
      tags.includes('ai')) {
    bindings.push('threat-model');
  }

  // Audit binding: most security-related cheat sheets
  if (tags.includes('injection') ||
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
      id.includes('logging')) {
    bindings.push('audit');
  }

  // Remediate binding: same as audit (specialists switch from "find" to "fix")
  if (bindings.includes('audit')) {
    bindings.push('plan-remediation');
  }

  // Verify binding: testing and verification focused
  if (id.includes('authorization-testing') ||
      id.includes('rest-assessment') ||
      id.includes('transport-layer') ||
      id.includes('content-security-policy') ||
      id.includes('http-headers')) {
    bindings.push('verify');
  }

  // Report binding: disclosure, terminology
  if (id.includes('vulnerability-disclosure') ||
      id.includes('security-terminology') ||
      id.includes('logging-vocabulary')) {
    bindings.push('report');
  }

  return bindings;
}

/**
 * Get stack bindings for framework-specific cheat sheets.
 * @param id - Cheat sheet ID
 * @returns Array of stack identifiers
 */
export function inferStackBindings(id: string): string[] {
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
      return stacks;
    }
  }

  return [];
}

/**
 * Create a complete corpus entry with inferred bindings.
 * @param html - The HTML content
 * @param url - The source URL
 * @returns Complete OwaspCorpusEntry
 */
export function createCorpusEntry(html: string, url: string): OwaspCorpusEntry {
  const parsed = parseCheatSheetHtml(html, url);
  const workflowBindings = inferWorkflowBindings(
    parsed.id!,
    parsed.headings ?? [],
    parsed.tags ?? []
  );
  const stackBindings = inferStackBindings(parsed.id!);

  return {
    ...parsed,
    id: parsed.id!,
    title: parsed.title!,
    sourceUrl: url,
    intentSummary: parsed.intentSummary!,
    headings: parsed.headings ?? [],
    checklistItems: parsed.checklistItems ?? [],
    canonicalRefs: parsed.canonicalRefs ?? [],
    workflowBindings,
    stackBindings,
    tags: parsed.tags ?? [],
    status: 'parsed',
  };
}

/**
 * Get the corpus manifest (all URLs and IDs).
 * @returns Array of { id, url } objects
 */
export function getCorpusManifest(): Array<{ id: string; url: string }> {
  return OWASP_CANONICAL_URLS.map(url => ({
    id: urlToId(url),
    url,
  }));
}
