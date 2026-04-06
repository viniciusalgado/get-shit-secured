/**
 * Standalone script to generate data/corpus/catalog.json and overrides.json
 * from the existing OWASP_CANONICAL_URLS and WORKFLOW_SPECIALIST_MAPPING.
 *
 * Run: node scripts/generate-catalog.mjs
 * (Works against dist/ — run npm run build first)
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Dynamic import from dist (must build first)
const { urlToId, OWASP_CANONICAL_URLS } = await import('../dist/core/owasp-ingestion.js');
const { WORKFLOW_SPECIALIST_MAPPING } = await import('../dist/catalog/specialists/mapping.js');

const ISSUE_TAG_RULES = [
  ['sql-injection', [/sql-injection/, /\bsqli\b/]],
  ['nosql-injection', [/nosql/]],
  ['command-injection', [/command-injection/, /os-command/]],
  ['ldap-injection', [/ldap-injection/]],
  ['xss', [/\bxss\b/, /cross-site-scripting/]],
  ['dom-xss', [/dom-xss/, /dom-based-xss/]],
  ['dom-clobbering', [/dom-clobbering/]],
  ['authn', [/authentication/, /\bauthn\b/]],
  ['authz', [/authorization/, /\bauthz\b/]],
  ['access-control', [/access-control/]],
  ['session-management', [/session-management/, /^session$/]],
  ['password-storage', [/password-storage/]],
  ['mfa', [/\bmfa\b/, /multifactor-authentication/]],
  ['secrets', [/secrets-management/, /^secrets$/]],
  ['crypto', [/cryptographic-storage/, /^crypto$/]],
  ['key-management', [/key-management/]],
  ['file-upload', [/file-upload/]],
  ['deserialization', [/deserialization/]],
  ['ssrf', [/\bssrf\b/, /server-side-request-forgery/]],
  ['xxe', [/\bxxe\b/, /xml-external-entity/]],
  ['csrf', [/\bcsrf\b/, /cross-site-request-forgery/]],
  ['config', [/configuration/]],
  ['security-headers', [/http-headers/]],
  ['csp', [/\bcsp\b/, /content-security-policy/]],
  ['hsts', [/\bhsts\b/, /http-strict-transport-security/]],
  ['tls', [/\btls\b/, /transport-layer-security/]],
  ['logging', [/logging/]],
  ['error-handling', [/error-handling/]],
  ['supply-chain', [/supply-chain/, /\bsbom\b/]],
  ['dependency', [/dependency/]],
  ['ai-security', [/ai-agent-security/, /secure-ai-model-ops/]],
  ['mcp-security', [/mcp-security/]],
  ['prompt-injection', [/prompt-injection/]],
  ['clickjacking', [/clickjacking/]],
  ['idor', [/\bidor\b/, /insecure-direct-object-reference/]],
  ['mass-assignment', [/mass-assignment/]],
  ['prototype-pollution', [/prototype-pollution/]],
  ['subdomain-takeover', [/subdomain-takeover/]],
  ['redirect', [/redirect/]],
  ['privacy', [/privacy/]],
  ['virtual-patching', [/virtual-patching/]],
  ['xss-evasion', [/xss-filter-evasion/]],
  ['xs-leaks', [/xs-leaks/]],
  ['disclosure', [/vulnerability-disclosure/]],
  ['reporting', [/vulnerability-disclosure/, /logging-vocabulary/]],
  ['terminology', [/security-terminology/, /logging-vocabulary/]],
];

// Alias detection: common shortenings
function detectAliases(id) {
  const aliases = [];

  // Common -prevention suffix removal
  if (id.endsWith('-prevention')) {
    aliases.push(id.replace(/-prevention$/, ''));
  }

  // Common -defense suffix removal
  if (id.endsWith('-defense')) {
    aliases.push(id.replace(/-defense$/, ''));
  }

  // Specific known aliases
  const knownAliases = {
    'cross-site-scripting-prevention': ['xss-prevention', 'xss'],
    'cross-site-request-forgery-prevention': ['csrf-prevention', 'csrf'],
    'server-side-request-forgery-prevention': ['ssrf-prevention', 'ssrf'],
    'xml-external-entity-prevention': ['xxe-prevention', 'xxe'],
    'os-command-injection-defense': ['cmd-injection', 'command-injection'],
    'sql-injection-prevention': ['sql-injection', 'sqli'],
    'dom-based-xss-prevention': ['dom-xss'],
    'dom-clobbering-prevention': ['dom-clobbering'],
    'ldap-injection-prevention': ['ldap-injection'],
    'nosql-security': ['nosql-injection'],
    'transport-layer-security': ['tls'],
    'transport-layer-protection': ['ssl'],
    'http-strict-transport-security': ['hsts'],
    'content-security-policy': ['csp'],
    'dependency-graph-sbom': ['sbom'],
    'software-supply-chain-security': ['supply-chain'],
    'ai-agent-security': ['ai-security'],
    'llm-prompt-injection-prevention': ['prompt-injection'],
    'mcp-security': ['mcp'],
    'multifactor-authentication': ['mfa'],
    'authentication': ['authn'],
    'authorization': ['authorization'],
    'access-control': ['access-control'],
    'session-management': ['session'],
    'password-storage': ['password'],
    'cryptographic-storage': ['crypto'],
    'key-management': ['key-mgmt'],
    'secrets-management': ['secrets'],
    'error-handling': ['error'],
    'logging-vocabulary': ['logging-vocab'],
    'vulnerability-disclosure': ['disclosure'],
    'security-terminology': ['terminology'],
    'vulnerable-dependency-management': ['dependency-management'],
    'insecure-direct-object-reference-prevention': ['idor'],
    'clickjacking-defense': ['clickjacking'],
    'prototype-pollution-prevention': ['prototype-pollution'],
    'subdomain-takeover-prevention': ['subdomain-takeover'],
    'unvalidated-redirects-and-forwards': ['open-redirect'],
    'user-privacy-protection': ['privacy'],
    'virtual-patching': ['virtual-patch'],
    'xss-filter-evasion': ['xss-evasion'],
    'xs-leaks': ['xs-leaks'],
    'mass-assignment': ['mass-assignment'],
    'cookie-theft-mitigation': ['cookies'],
    'credential-stuffing-prevention': ['credential-stuffing'],
    'pinning': ['certificate-pinning'],
    'input-validation': ['input-val'],
    'file-upload': ['upload'],
    'deserialization': ['deser'],
    'infrastructure-as-code-security': ['iac'],
    'serverless-faas-security': ['serverless'],
    'graphql': ['gql'],
    'rest-security': ['rest'],
    'grpc-security': ['grpc'],
    'websocket-security': ['ws'],
  };

  if (knownAliases[id]) {
    aliases.push(...knownAliases[id]);
  }

  return aliases;
}

function inferIssueTypes(id, aliases, curatedIssueTypes = []) {
  if (curatedIssueTypes.length > 0) {
    return {
      issueTypes: [...new Set(curatedIssueTypes)].sort(),
      issueTypeConfidence: Object.fromEntries(curatedIssueTypes.map(tag => [tag, 'curated'])),
    };
  }

  const searchable = [id, ...aliases].join(' ');
  const issueTypes = new Set();
  const confidence = {};

  for (const [tag, patterns] of ISSUE_TAG_RULES) {
    if (patterns.some(pattern => pattern.test(searchable))) {
      issueTypes.add(tag);
      confidence[tag] = aliases.includes(tag) || id === tag ? 'inferred-high' : 'inferred-medium';
    }
  }

  if ([...issueTypes].some(tag => tag.endsWith('-injection'))) {
    issueTypes.add('injection');
    confidence['injection'] = 'inferred-medium';
  }

  return {
    issueTypes: [...issueTypes].sort(),
    issueTypeConfidence: confidence,
  };
}

// --- Generate catalog.json ---
const catalogEntries = OWASP_CANONICAL_URLS.map(url => {
  const id = urlToId(url);
  const aliases = detectAliases(id);
  return {
    id,
    url,
    sourceType: 'owasp-cheatsheet',
    aliases,
  };
});

const catalog = {
  version: '1.0.0',
  generatedAt: new Date().toISOString(),
  sources: catalogEntries,
};

// --- Generate overrides.json ---
const overrides = {};

for (const [workflowId, binding] of Object.entries(WORKFLOW_SPECIALIST_MAPPING)) {
  // primarySpecialists → required
  for (const specialistId of binding.primarySpecialists) {
    if (!overrides[specialistId]) {
      overrides[specialistId] = { workflowBindings: [], stackBindings: [], issueTypes: [] };
    }
    overrides[specialistId].workflowBindings.push({
      workflowId,
      priority: 'required',
    });
  }

  // optionalSpecialists → optional
  for (const specialistId of binding.optionalSpecialists) {
    if (!overrides[specialistId]) {
      overrides[specialistId] = { workflowBindings: [], stackBindings: [], issueTypes: [] };
    }
    overrides[specialistId].workflowBindings.push({
      workflowId,
      priority: 'optional',
    });
  }

  // stackConditionedSpecialists → stack bindings
  for (const condition of binding.stackConditionedSpecialists) {
    const stacks = Array.isArray(condition.stack) ? condition.stack : [condition.stack];
    for (const specialistId of condition.specialists) {
      if (!overrides[specialistId]) {
        overrides[specialistId] = { workflowBindings: [], stackBindings: [], issueTypes: [] };
      }
      // Add stack binding for each stack in the condition
      for (const stack of stacks) {
        // Avoid duplicates
        if (!overrides[specialistId].stackBindings.some(sb => sb.stack === stack)) {
          overrides[specialistId].stackBindings.push({ stack });
        }
      }
    }
  }

  // specialistDetails → issueTypes
  if (binding.specialistDetails) {
    for (const [specialistId, detail] of Object.entries(binding.specialistDetails)) {
      if (!overrides[specialistId]) {
        overrides[specialistId] = { workflowBindings: [], stackBindings: [], issueTypes: [] };
      }
      if (detail.issueTags) {
        overrides[specialistId].issueTypes = detail.issueTags;
        overrides[specialistId].issueTypeConfidence = Object.fromEntries(
          detail.issueTags.map(tag => [tag, 'curated']),
        );
      }
    }
  }
}

for (const entry of catalogEntries) {
  if (!overrides[entry.id]) {
    overrides[entry.id] = { workflowBindings: [], stackBindings: [], issueTypes: [] };
  }
  const inferred = inferIssueTypes(
    entry.id,
    entry.aliases,
    overrides[entry.id].issueTypes ?? [],
  );
  if ((overrides[entry.id].issueTypes ?? []).length === 0) {
    overrides[entry.id].issueTypes = inferred.issueTypes;
    overrides[entry.id].issueTypeConfidence = inferred.issueTypeConfidence;
  } else if (!overrides[entry.id].issueTypeConfidence) {
    overrides[entry.id].issueTypeConfidence = inferred.issueTypeConfidence;
  }
}

const overridesDoc = {
  version: '1.0.0',
  overrides,
};

// --- Write files ---
const dataDir = join(__dirname, '..', 'data', 'corpus');
mkdirSync(dataDir, { recursive: true });

writeFileSync(
  join(dataDir, 'catalog.json'),
  JSON.stringify(catalog, null, 2) + '\n'
);

writeFileSync(
  join(dataDir, 'overrides.json'),
  JSON.stringify(overridesDoc, null, 2) + '\n'
);

console.log(`Generated catalog.json with ${catalogEntries.length} entries`);
console.log(`Generated overrides.json with ${Object.keys(overrides).length} specialist overrides`);
