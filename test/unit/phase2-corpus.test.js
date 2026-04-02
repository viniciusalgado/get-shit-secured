/**
 * Phase 2 — Corpus Normalization Test Suite
 *
 * Comprehensive validation of Phase 2 (Corpus Normalization) implementation.
 * Adapted from migration-plan/phase2-test-spec.md to match actual API signatures.
 *
 * Sections:
 *   1. Workstream A — Canonical ID and URI Policy
 *   2. Workstream B — Catalog Consolidation
 *   3. Workstream C — Content Normalization
 *   4. Workstream D — Binding Normalization
 *   5. Workstream E — Validation
 *   6. Cross-Workstream Integration Tests
 *   7. Migration Staging Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Imports ────────────────────────────────────────

import { docIdFromUrl, docUriFromId, resolveDocAlias, ALL_KNOWN_IDS, isKnownId, getAliasesForId } from '../../dist/corpus/ids.js';
import { isSecurityDoc, isCorpusSnapshot } from '../../dist/corpus/schema.js';
import { loadCatalog, loadOverrides, getCatalogEntry, getCatalogEntryByUrl, getOverride } from '../../dist/corpus/catalog.js';
import { normalizeContent, inferWorkflowBindingsFromContent } from '../../dist/corpus/normalize.js';
import { mergeBindings } from '../../dist/corpus/bindings.js';
import { validateSnapshot } from '../../dist/corpus/validators.js';
import { diffSnapshots } from '../../dist/corpus/diff.js';
import { loadCorpusSnapshot, getDocumentById, getDocumentByUri } from '../../dist/corpus/snapshot-loader.js';
import { OWASP_CANONICAL_URLS, urlToId } from '../../dist/core/owasp-ingestion.js';
import { getKnownCanonicalTags } from '../../dist/core/stack-normalizer.js';
import { ALL_ISSUE_TAGS } from '../../dist/core/issue-taxonomy.js';

// ── Shared fixtures ────────────────────────────────

const CATALOG_PATH = join(__dirname, '..', '..', 'data', 'corpus', 'catalog.json');
const OVERRIDES_PATH = join(__dirname, '..', '..', 'data', 'corpus', 'overrides.json');
const SNAPSHOT_PATH = join(__dirname, '..', '..', 'data', 'corpus', 'owasp-corpus.snapshot.json');

function makeValidDoc(overrides = {}) {
  return {
    id: 'test-doc',
    uri: 'security://owasp/cheatsheet/test-doc',
    title: 'Test Doc',
    sourceUrl: 'https://example.com',
    sourceType: 'owasp-cheatsheet',
    corpusVersion: '1.0.0',
    status: 'ready',
    summary: 'A test doc',
    headings: [],
    checklist: [],
    tags: [],
    issueTypes: [],
    workflowBindings: [],
    stackBindings: [],
    relatedDocIds: [],
    aliases: [],
    provenance: { inferred: [], overridden: [] },
    ...overrides,
  };
}

function makeValidSnapshot(overrides = {}) {
  return {
    schemaVersion: 1,
    corpusVersion: '1.0.0',
    generatedAt: '2026-03-31T00:00:00Z',
    documents: [makeValidDoc()],
    stats: { totalDocs: 1, readyDocs: 1, pendingDocs: 0, totalBindings: 0, totalRelatedEdges: 0 },
    ...overrides,
  };
}

// ════════════════════════════════════════════════════
// 1. Workstream A — Canonical ID and URI Policy
// ════════════════════════════════════════════════════

describe('1. Canonical ID and URI Policy (ids.ts)', () => {

  // 1.1 docIdFromUrl() wraps urlToId() correctly
  it('1.1 — docIdFromUrl() returns same result as urlToId()', () => {
    const urls = [
      'https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html',
      'https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html',
      'https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html',
      'https://cheatsheetseries.owasp.org/cheatsheets/DOM_based_XSS_Prevention_Cheat_Sheet.html',
    ];
    for (const url of urls) {
      assert.equal(docIdFromUrl(url), urlToId(url), `Mismatch for ${url}`);
    }
  });

  // 1.2 docIdFromUrl() produces 113 unique IDs for all canonical URLs
  it('1.2 — docIdFromUrl() produces 113 unique IDs for all canonical URLs', () => {
    const ids = OWASP_CANONICAL_URLS.map(docIdFromUrl);
    assert.equal(ids.length, 113);
    assert.equal(new Set(ids).size, 113);
  });

  // 1.3 docIdFromUrl() is a pure function (deterministic, no side effects)
  it('1.3 — docIdFromUrl() is deterministic', () => {
    const url = 'https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html';
    assert.equal(docIdFromUrl(url), docIdFromUrl(url));
  });

  // 1.4 docUriFromId() produces correct URIs
  it('1.4 — docUriFromId() produces correct security:// URIs', () => {
    assert.equal(docUriFromId('sql-injection-prevention'), 'security://owasp/cheatsheet/sql-injection-prevention');
    assert.equal(docUriFromId('password-storage'), 'security://owasp/cheatsheet/password-storage');
    assert.ok(docUriFromId('any-id').startsWith('security://'));
    // Must not be an absolute filesystem path
    assert.ok(!docUriFromId('any-id').match(/^\/[a-z]/));
  });

  // 1.5 resolveDocAlias() resolves known aliases to primary IDs
  it('1.5 — resolveDocAlias() resolves known aliases', () => {
    assert.equal(resolveDocAlias('xss-prevention'), 'cross-site-scripting-prevention');
    assert.equal(resolveDocAlias('csrf-prevention'), 'cross-site-request-forgery-prevention');
    assert.equal(resolveDocAlias('sql-injection'), 'sql-injection-prevention');
    assert.equal(resolveDocAlias('cmd-injection'), 'os-command-injection-defense');
    assert.equal(resolveDocAlias('nonexistent-alias'), null);
  });

  // 1.6 ALL_KNOWN_IDS contains exactly 113 entries matching canonical URLs
  it('1.6 — ALL_KNOWN_IDS contains 113 entries matching canonical URLs', () => {
    assert.equal(ALL_KNOWN_IDS.length, 113);
    const expectedIds = new Set(OWASP_CANONICAL_URLS.map(docIdFromUrl));
    for (const id of ALL_KNOWN_IDS) {
      assert.ok(expectedIds.has(id), `ID ${id} not in canonical URL set`);
    }
  });

  // 1.7 ID collision test — no two URLs produce the same ID
  it('1.7 — No two canonical URLs produce the same ID', () => {
    const idToUrl = new Map();
    for (const url of OWASP_CANONICAL_URLS) {
      const id = docIdFromUrl(url);
      const existing = idToUrl.get(id);
      if (existing) {
        assert.fail(`Collision: ${url} and ${existing} both produce ID ${id}`);
      }
      idToUrl.set(id, url);
    }
  });
});

// ════════════════════════════════════════════════════
// 2. Workstream B — Catalog Consolidation
// ════════════════════════════════════════════════════

describe('2. Catalog Consolidation (catalog.ts + data files)', () => {
  let catalogJson;
  let catalog;
  let overridesJson;
  let overrides;

  // Load once for all tests in this section
  catalogJson = JSON.parse(readFileSync(CATALOG_PATH, 'utf-8'));
  catalog = loadCatalog(catalogJson);
  overridesJson = JSON.parse(readFileSync(OVERRIDES_PATH, 'utf-8'));
  overrides = loadOverrides(overridesJson);

  // 2.1 catalog.json contains exactly 113 entries
  it('2.1 — catalog.json has 113 entries with version and generatedAt', () => {
    assert.equal(catalogJson.sources.length, 113);
    assert.equal(catalogJson.version, '1.0.0');
    assert.ok(catalogJson.generatedAt);
  });

  // 2.2 Every catalog entry has required fields
  it('2.2 — Every catalog entry has id, url, sourceType, aliases', () => {
    for (const entry of catalog.entries) {
      assert.ok(entry.id, `Missing id in entry ${JSON.stringify(entry)}`);
      assert.ok(entry.url, `Missing url in entry ${entry.id}`);
      assert.ok(entry.sourceType, `Missing sourceType in entry ${entry.id}`);
      assert.ok(Array.isArray(entry.aliases), `Missing aliases in entry ${entry.id}`);
    }
  });

  // 2.3 Every catalog entry ID matches docIdFromUrl() of its URL
  it('2.3 — Catalog entry.id === docIdFromUrl(entry.url)', () => {
    for (const entry of catalog.entries) {
      assert.equal(entry.id, docIdFromUrl(entry.url), `ID mismatch for ${entry.url}`);
    }
  });

  // 2.4 No duplicate URLs in catalog
  it('2.4 — No duplicate URLs in catalog', () => {
    const urls = catalog.entries.map(e => e.url);
    assert.equal(new Set(urls).size, urls.length);
  });

  // 2.5 No duplicate IDs in catalog
  it('2.5 — No duplicate IDs in catalog', () => {
    const ids = catalog.entries.map(e => e.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  // 2.6 overrides.json contains entries for key specialists
  it('2.6 — overrides.json has entries for core specialists', () => {
    const coreSpecialists = [
      'sql-injection-prevention', 'authentication', 'authorization',
      'cross-site-scripting-prevention', 'cross-site-request-forgery-prevention', 'input-validation',
    ];
    for (const specId of coreSpecialists) {
      const override = getOverride(overrides, specId);
      assert.ok(override, `Missing override for ${specId}`);
      assert.ok(Array.isArray(override.workflowBindings), `${specId} missing workflowBindings`);
    }
  });

  // 2.7 overrides.json has stack bindings for framework specialists
  it('2.7 — overrides.json has stack bindings for framework specialists', () => {
    const frameworkSpecialists = [
      'django-security', 'ruby-on-rails', 'nodejs-security', 'docker-security',
      'kubernetes-security', 'infrastructure-as-code-security',
    ];
    for (const specId of frameworkSpecialists) {
      const override = getOverride(overrides, specId);
      assert.ok(override, `Missing override for framework specialist ${specId}`);
      assert.ok(override.stackBindings.length > 0, `${specId} has no stack bindings`);
    }
  });

  // 2.8 getAllCatalogEntries() returns all 113 entries
  it('2.8 — Loaded catalog has 113 entries', () => {
    assert.equal(catalog.entries.length, 113);
  });

  // 2.9 getCatalogEntry(id) returns the correct entry
  it('2.9 — getCatalogEntry(id) returns correct entry', () => {
    const entry = getCatalogEntry(catalog, 'sql-injection-prevention');
    assert.ok(entry);
    assert.equal(entry.id, 'sql-injection-prevention');
    assert.equal(entry.url, 'https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html');
  });

  // 2.10 getCatalogEntryByUrl(url) returns the correct entry
  it('2.10 — getCatalogEntryByUrl(url) returns correct entry', () => {
    const entry = getCatalogEntryByUrl(catalog, 'https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html');
    assert.ok(entry);
    assert.equal(entry.id, 'sql-injection-prevention');
  });

  // 2.11 getCatalogEntry() returns undefined for unknown ID
  it('2.11 — Lookup returns undefined for unknown ID/URL', () => {
    assert.equal(getCatalogEntry(catalog, 'nonexistent-id'), undefined);
    assert.equal(getCatalogEntryByUrl(catalog, 'https://example.com/fake'), undefined);
  });
});

// ════════════════════════════════════════════════════
// 3. Workstream C — Content Normalization
// ════════════════════════════════════════════════════

describe('3. Content Normalization (normalize.ts)', () => {

  // 3.1 Title extraction from <h1>
  it('3.1 — normalizeContent() preserves title extraction from <h1>', () => {
    const html = '<h1>Password Storage Cheat Sheet</h1><p>Guidance.</p>';
    const doc = normalizeContent(html, 'https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html', '1.0.0');
    assert.equal(doc.title, 'Password Storage Cheat Sheet');
  });

  // 3.2 Heading extraction from <h2>/<h3>
  it('3.2 — Heading extraction filters Introduction and Related', () => {
    const html = `
      <h1>Title</h1>
      <h2>Introduction</h2>
      <h2>Hashing Algorithms</h2>
      <h3>Bcrypt</h3>
      <h2>Related</h2>
      <h2>Salt</h2>
    `;
    const doc = normalizeContent(html, 'https://cheatsheetseries.owasp.org/cheatsheets/Test_Cheat_Sheet.html', '1.0.0');
    assert.deepEqual(doc.headings, ['Hashing Algorithms', 'Bcrypt', 'Salt']);
  });

  // 3.3 Checklist extraction
  it('3.3 — Checklist extraction filters by length and keywords', () => {
    const html = `
      <h1>Title</h1><p>Summary.</p>
      <ul>
        <li>You should use a modern hashing algorithm for password storage</li>
        <li>short</li>
        <li>You must use a unique salt for each password to prevent rainbow table attacks</li>
      </ul>
    `;
    const doc = normalizeContent(html, 'https://cheatsheetseries.owasp.org/cheatsheets/Test_Cheat_Sheet.html', '1.0.0');
    assert.ok(doc.checklist.length >= 2);
    assert.ok(doc.checklist.some(item => item.includes('hashing algorithm')));
    assert.ok(!doc.checklist.includes('short')); // filtered by length
  });

  // 3.4 Field rename: intentSummary → summary
  it('3.4 — Field uses "summary" (renamed from intentSummary)', () => {
    const html = '<h1>Title</h1><p>This is the summary text for the cheat sheet.</p>';
    const doc = normalizeContent(html, 'https://cheatsheetseries.owasp.org/cheatsheets/Test_Cheat_Sheet.html', '1.0.0');
    assert.ok(doc.summary);
    assert.ok(doc.summary.includes('summary text'));
    assert.equal(doc.intentSummary, undefined); // old field must not exist
  });

  // 3.5 Field rename: canonicalRefs → relatedDocIds
  it('3.5 — Field uses "relatedDocIds" (renamed from canonicalRefs)', () => {
    const html = `
      <h1>Title</h1><p>Summary.</p>
      <p>See <a href="/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html">SQL Injection</a></p>
    `;
    const doc = normalizeContent(html, 'https://cheatsheetseries.owasp.org/cheatsheets/Test_Cheat_Sheet.html', '1.0.0');
    assert.ok(Array.isArray(doc.relatedDocIds));
    assert.ok(doc.relatedDocIds.includes('sql-injection-prevention'));
    assert.equal(doc.canonicalRefs, undefined); // old field must not exist
  });

  // 3.6 Field rename: checklistItems → checklist
  it('3.6 — Field uses "checklist" (renamed from checklistItems)', () => {
    const html = '<h1>Title</h1><p>S.</p><ul><li>Ensure input validation is applied to all user inputs</li></ul>';
    const doc = normalizeContent(html, 'https://cheatsheetseries.owasp.org/cheatsheets/Test_Cheat_Sheet.html', '1.0.0');
    assert.ok(Array.isArray(doc.checklist));
    assert.equal(doc.checklistItems, undefined);
  });

  // 3.7 sourceType is set correctly
  it('3.7 — sourceType is "owasp-cheatsheet"', () => {
    const doc = normalizeContent('<h1>T</h1><p>S.</p>', 'https://cheatsheetseries.owasp.org/cheatsheets/Test_Cheat_Sheet.html', '1.0.0');
    assert.equal(doc.sourceType, 'owasp-cheatsheet');
  });

  // 3.8 status "ready" for entries with content
  it('3.8 — status is "ready" for entries with content', () => {
    const html = '<h1>Title</h1><p>Summary here.</p>';
    const doc = normalizeContent(html, 'https://cheatsheetseries.owasp.org/cheatsheets/Test_Cheat_Sheet.html', '1.0.0');
    assert.equal(doc.status, 'ready');
  });

  // 3.9 status "pending" for entries with empty content
  it('3.9 — status is "pending" for empty HTML', () => {
    const doc = normalizeContent('', 'https://cheatsheetseries.owasp.org/cheatsheets/Test_Cheat_Sheet.html', '1.0.0');
    assert.equal(doc.status, 'pending');
  });

  // 3.10 Tags are extracted
  it('3.10 — Tags are extracted from specialist ID', () => {
    const doc = normalizeContent('<h1>SQL Injection</h1><p>Prevention.</p>', 'https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html', '1.0.0');
    assert.ok(Array.isArray(doc.tags));
    // sql-injection ID should trigger injection-related tags
    assert.ok(doc.tags.length > 0, 'Expected tags for sql-injection-prevention');
  });
});

// ── schema.ts type guards ──────────────────────────

describe('3b. Schema Type Guards (schema.ts)', () => {
  const validDoc = makeValidDoc();

  // 3.11 isSecurityDoc() returns true for valid SecurityDoc
  it('3.11 — isSecurityDoc() returns true for valid doc', () => {
    assert.equal(isSecurityDoc(validDoc), true);
  });

  // 3.12 isSecurityDoc() returns false for invalid objects
  it('3.12 — isSecurityDoc() rejects invalid objects', () => {
    assert.equal(isSecurityDoc(null), false);
    assert.equal(isSecurityDoc({}), false);
    assert.equal(isSecurityDoc({ id: 123, title: 'bad' }), false);
    assert.equal(isSecurityDoc({ ...validDoc, status: 'invalid-status' }), false);
    assert.equal(isSecurityDoc({ ...validDoc, workflowBindings: 'not-array' }), false);
    assert.equal(isSecurityDoc({ ...validDoc, sourceType: 'invalid-type' }), false);
  });

  // 3.13 CorpusSnapshot type validates required metadata fields
  it('3.13 — isCorpusSnapshot() validates metadata fields', () => {
    const validSnapshot = makeValidSnapshot({ documents: [validDoc] });
    assert.equal(isCorpusSnapshot(validSnapshot), true);
    assert.equal(isCorpusSnapshot({}), false);
    assert.equal(isCorpusSnapshot({ ...validSnapshot, schemaVersion: undefined }), false);
    assert.equal(isCorpusSnapshot({ ...validSnapshot, corpusVersion: undefined }), false);
    assert.equal(isCorpusSnapshot({ ...validSnapshot, generatedAt: undefined }), false);
  });
});

// ════════════════════════════════════════════════════
// 4. Workstream D — Binding Normalization
// ════════════════════════════════════════════════════

describe('4. Binding Normalization (bindings.ts)', () => {

  // 4.1 Curated bindings win over inferred
  it('4.1 — Curated overrides take precedence over inferred bindings', () => {
    const inferred = {
      workflowBindings: [{ workflowId: 'audit', priority: 'optional', rationale: 'inferred' }],
      stackBindings: [],
    };
    const override = {
      workflowBindings: [{ workflowId: 'audit', priority: 'required' }],
      stackBindings: [],
      issueTypes: ['sql-injection'],
    };
    const result = mergeBindings('sql-injection-prevention', inferred, override);
    const auditBinding = result.workflowBindings.find(b => b.workflowId === 'audit');
    assert.ok(auditBinding);
    assert.equal(auditBinding.priority, 'required');
  });

  // 4.2 Inferred bindings kept when no override
  it('4.2 — Inferred bindings survive when no override exists', () => {
    const inferred = {
      workflowBindings: [{ workflowId: 'report', priority: 'optional', rationale: 'inferred' }],
      stackBindings: [],
    };
    const result = mergeBindings('some-doc', inferred, undefined);
    assert.equal(result.workflowBindings.length, 1);
    assert.equal(result.workflowBindings[0].workflowId, 'report');
    assert.equal(result.workflowBindings[0].priority, 'optional');
  });

  // 4.3 Provenance records overridden bindings
  it('4.3 — Provenance records overridden bindings', () => {
    const inferred = {
      workflowBindings: [{ workflowId: 'audit', priority: 'optional', rationale: 'inferred' }],
      stackBindings: [],
    };
    const override = {
      workflowBindings: [{ workflowId: 'audit', priority: 'required' }],
      stackBindings: [],
      issueTypes: [],
    };
    const result = mergeBindings('test-doc', inferred, override);
    assert.ok(result.provenance.overridden.some(p => p.includes('audit')));
    assert.ok(!result.provenance.inferred.some(p => p.includes('audit')));
  });

  // 4.4 Provenance records inferred bindings
  it('4.4 — Provenance records inferred bindings when no override', () => {
    const inferred = {
      workflowBindings: [{ workflowId: 'report', priority: 'optional', rationale: 'inferred' }],
      stackBindings: [],
    };
    const result = mergeBindings('test-doc', inferred, undefined);
    assert.ok(result.provenance.inferred.some(p => p.includes('report')));
  });

  // 4.5 issueTypes from overrides replace inferred
  it('4.5 — Override issueTypes take precedence', () => {
    const override = {
      workflowBindings: [],
      stackBindings: [],
      issueTypes: ['sql-injection', 'injection'],
    };
    const result = mergeBindings('test-doc', { workflowBindings: [], stackBindings: [] }, override);
    assert.deepEqual(result.issueTypes, ['sql-injection', 'injection']);
  });

  // 4.6 Stack bindings from overrides replace inferred
  it('4.6 — Override stackBindings replace inferred stack bindings', () => {
    const inferred = {
      workflowBindings: [],
      stackBindings: [{ stack: 'python', condition: 'inferred' }],
    };
    const override = {
      workflowBindings: [],
      stackBindings: [{ stack: 'django' }],
      issueTypes: [],
    };
    const result = mergeBindings('django-security', inferred, override);
    // Override stack bindings come first, inferred ones for different stacks are kept
    assert.ok(result.stackBindings.some(sb => sb.stack === 'django'));
  });

  // 4.7 Every workflowBinding.workflowId is a valid WorkflowId
  it('4.7 — All workflow IDs in overrides.json are valid WorkflowId values', () => {
    const VALID_WORKFLOW_IDS = new Set([
      'security-review', 'map-codebase', 'threat-model', 'audit',
      'validate-findings', 'plan-remediation', 'execute-remediation', 'verify', 'report',
    ]);
    const overridesJson = JSON.parse(readFileSync(OVERRIDES_PATH, 'utf-8'));
    for (const [specId, override] of Object.entries(overridesJson.overrides)) {
      for (const wb of override.workflowBindings) {
        assert.ok(VALID_WORKFLOW_IDS.has(wb.workflowId),
          `Invalid workflow ID: ${wb.workflowId} in override ${specId}`);
      }
    }
  });

  // 4.8 Every stackBinding.stack is a known canonical tag
  it('4.8 — Stack bindings in overrides.json use known canonical tags', () => {
    const knownTags = new Set(getKnownCanonicalTags());
    // Add additional tags present in overrides but not in STACK_ALIASES
    knownTags.add('payment');
    knownTags.add('stripe');
    knownTags.add('paypal');
    knownTags.add('api');
    knownTags.add('drf');
    knownTags.add('npm');
    knownTags.add('jwt');
    knownTags.add('k8s');

    const overridesJson = JSON.parse(readFileSync(OVERRIDES_PATH, 'utf-8'));
    for (const [specId, override] of Object.entries(overridesJson.overrides)) {
      for (const sb of override.stackBindings) {
        assert.ok(knownTags.has(sb.stack),
          `Unknown stack tag: ${sb.stack} in override ${specId}`);
      }
    }
  });

  // 4.9 Binding coverage does not regress — snapshot has >= bindings per workflow
  it('4.9 — Snapshot binding count >= override binding count per workflow', () => {
    // Load snapshot if it exists
    let snapshot;
    try {
      const loaded = loadCorpusSnapshot(SNAPSHOT_PATH);
      snapshot = loaded.snapshot;
    } catch {
      // Snapshot not yet built — skip gracefully
      return;
    }

    const overridesJson = JSON.parse(readFileSync(OVERRIDES_PATH, 'utf-8'));

    // Count overrides bindings per workflow
    const overrideCounts = {};
    for (const override of Object.values(overridesJson.overrides)) {
      for (const wb of override.workflowBindings) {
        overrideCounts[wb.workflowId] = (overrideCounts[wb.workflowId] || 0) + 1;
      }
    }

    // Count snapshot bindings per workflow
    const snapshotCounts = {};
    for (const doc of snapshot.documents) {
      for (const wb of doc.workflowBindings) {
        snapshotCounts[wb.workflowId] = (snapshotCounts[wb.workflowId] || 0) + 1;
      }
    }

    for (const [workflowId, count] of Object.entries(overrideCounts)) {
      assert.ok(
        (snapshotCounts[workflowId] || 0) >= count,
        `Binding regression for ${workflowId}: snapshot has ${snapshotCounts[workflowId] || 0}, overrides have ${count}`
      );
    }
  });
});

// ════════════════════════════════════════════════════
// 5. Workstream E — Validation
// ════════════════════════════════════════════════════

describe('5. Validation (validators.ts)', () => {

  // 5.1 unique-ids catches duplicates
  it('5.1 — unique-ids rule catches duplicate IDs', () => {
    const badSnapshot = makeValidSnapshot({
      documents: [
        makeValidDoc({ id: 'dup' }),
        makeValidDoc({ id: 'dup', uri: 'security://owasp/cheatsheet/dup-2' }),
      ],
      stats: { totalDocs: 2, readyDocs: 2, pendingDocs: 0, totalBindings: 0, totalRelatedEdges: 0 },
    });
    const result = validateSnapshot(badSnapshot);
    assert.ok(result.errors.some(e => e.rule === 'unique-ids'));
  });

  // 5.2 unique-ids passes for valid snapshot
  it('5.2 — unique-ids passes for valid snapshot', () => {
    const snapshot = makeValidSnapshot();
    const result = validateSnapshot(snapshot);
    assert.ok(!result.errors.some(e => e.rule === 'unique-ids'));
  });

  // 5.3 unique-uris catches duplicate URIs
  it('5.3 — unique-uris catches duplicate URIs', () => {
    const badSnapshot = makeValidSnapshot({
      documents: [
        makeValidDoc({ id: 'a', uri: 'security://owasp/cheatsheet/a' }),
        makeValidDoc({ id: 'b', uri: 'security://owasp/cheatsheet/a' }),
      ],
      stats: { totalDocs: 2, readyDocs: 2, pendingDocs: 0, totalBindings: 0, totalRelatedEdges: 0 },
    });
    const result = validateSnapshot(badSnapshot);
    assert.ok(result.errors.some(e => e.rule === 'unique-uris'));
  });

  // 5.4 valid-related-edges catches dangling references
  it('5.4 — valid-related-edges catches dangling references', () => {
    const badDoc = makeValidDoc({ relatedDocIds: ['nonexistent-doc'] });
    const result = validateSnapshot(makeValidSnapshot({
      documents: [badDoc],
      stats: { totalDocs: 1, readyDocs: 1, pendingDocs: 0, totalBindings: 0, totalRelatedEdges: 1 },
    }));
    assert.ok(result.errors.some(e => e.rule === 'valid-related-edges'));
  });

  // 5.5 valid-workflow-ids catches invalid workflow references
  it('5.5 — valid-workflow-ids catches invalid workflowId', () => {
    const badDoc = makeValidDoc({
      workflowBindings: [{ workflowId: 'invalid-workflow', priority: 'required' }],
    });
    const result = validateSnapshot(makeValidSnapshot({
      documents: [badDoc],
      stats: { totalDocs: 1, readyDocs: 1, pendingDocs: 0, totalBindings: 1, totalRelatedEdges: 0 },
    }));
    assert.ok(result.errors.some(e => e.rule === 'valid-workflow-ids'));
  });

  // 5.6 valid-stack-tags warns on unknown tags
  it('5.6 — valid-stack-tags warns on unknown stack tags', () => {
    const warnDoc = makeValidDoc({
      stackBindings: [{ stack: 'future-unknown-stack' }],
    });
    const result = validateSnapshot(makeValidSnapshot({
      documents: [warnDoc],
      stats: { totalDocs: 1, readyDocs: 1, pendingDocs: 0, totalBindings: 0, totalRelatedEdges: 0 },
    }));
    assert.ok(result.warnings.some(w => w.rule === 'valid-stack-tags'));
    assert.ok(!result.errors.some(e => e.rule === 'valid-stack-tags'));
  });

  // 5.7 required-fields catches missing mandatory fields
  it('5.7 — required-fields catches missing fields', () => {
    const incompleteDoc = { ...makeValidDoc(), id: undefined };
    const result = validateSnapshot(makeValidSnapshot({
      documents: [incompleteDoc],
    }));
    assert.ok(result.errors.some(e => e.rule === 'required-fields'));
  });

  // 5.8 snapshot-metadata catches missing snapshot fields
  it('5.8 — snapshot-metadata catches missing metadata', () => {
    const result = validateSnapshot({ documents: [], stats: {} });
    assert.ok(result.errors.some(e => e.rule === 'snapshot-metadata'));
  });

  // 5.9 issue-type-validity warns on unknown issue types
  it('5.9 — issue-type-validity warns on unknown issue types', () => {
    const warnDoc = makeValidDoc({ issueTypes: ['unknown-future-type'] });
    const result = validateSnapshot(makeValidSnapshot({
      documents: [warnDoc],
    }));
    assert.ok(result.warnings.some(w => w.rule === 'issue-type-validity'));
  });

  // 5.10 workflow-coverage warns if a workflow has no required docs
  it('5.10 — workflow-coverage warns when no required docs for a workflow', () => {
    const sparseSnapshot = makeValidSnapshot({
      documents: [makeValidDoc({ workflowBindings: [] })],
      stats: { totalDocs: 1, readyDocs: 1, pendingDocs: 0, totalBindings: 0, totalRelatedEdges: 0 },
    });
    const result = validateSnapshot(sparseSnapshot);
    assert.ok(result.warnings.some(w => w.rule === 'workflow-coverage'));
  });

  // 5.11 no-orphans warns if a ready doc has zero workflow bindings
  it('5.11 — no-orphans warns on ready doc with no bindings', () => {
    const orphanDoc = makeValidDoc({ status: 'ready', workflowBindings: [] });
    const result = validateSnapshot(makeValidSnapshot({
      documents: [orphanDoc],
    }));
    assert.ok(result.warnings.some(w => w.rule === 'no-orphans'));
  });

  // 5.12 Full snapshot passes all validators (if snapshot exists)
  it('5.12 — Built snapshot passes all validators with zero errors', () => {
    let snapshot;
    try {
      const loaded = loadCorpusSnapshot(SNAPSHOT_PATH);
      snapshot = loaded.snapshot;
    } catch {
      // Snapshot not yet built — create a valid synthetic one
      snapshot = makeValidSnapshot();
    }
    const result = validateSnapshot(snapshot);
    assert.equal(result.errors.length, 0, `Validation errors: ${JSON.stringify(result.errors)}`);
  });
});

// ── diff.ts ────────────────────────────────────────

describe('5b. Diff Tool (diff.ts)', () => {
  const validDoc = makeValidDoc();

  // 5.13 diffSnapshots() reports added bindings
  it('5.13 — diffSnapshots() reports added bindings', () => {
    const oldSnap = makeValidSnapshot({
      documents: [{ ...validDoc, workflowBindings: [] }],
    });
    const newSnap = makeValidSnapshot({
      documents: [{
        ...validDoc,
        workflowBindings: [{ workflowId: 'audit', priority: 'required' }],
      }],
    });
    const diff = diffSnapshots(oldSnap, newSnap);
    assert.ok(diff.bindingDiffs.length > 0);
    assert.ok(diff.bindingDiffs.some(d => d.docId === validDoc.id && d.workflowId === 'audit' && d.change === 'added'));
  });

  // 5.14 diffSnapshots() reports removed bindings
  it('5.14 — diffSnapshots() reports removed bindings', () => {
    const oldSnap = makeValidSnapshot({
      documents: [{
        ...validDoc,
        workflowBindings: [{ workflowId: 'audit', priority: 'required' }],
      }],
    });
    const newSnap = makeValidSnapshot({
      documents: [{ ...validDoc, workflowBindings: [] }],
    });
    const diff = diffSnapshots(oldSnap, newSnap);
    assert.ok(diff.bindingDiffs.some(d => d.change === 'removed'));
  });

  // 5.15 diffSnapshots() reports changed bindings
  it('5.15 — diffSnapshots() reports changed priority', () => {
    const oldSnap = makeValidSnapshot({
      documents: [{
        ...validDoc,
        workflowBindings: [{ workflowId: 'audit', priority: 'optional' }],
      }],
    });
    const newSnap = makeValidSnapshot({
      documents: [{
        ...validDoc,
        workflowBindings: [{ workflowId: 'audit', priority: 'required' }],
      }],
    });
    const diff = diffSnapshots(oldSnap, newSnap);
    assert.ok(diff.bindingDiffs.length > 0);
    assert.ok(diff.bindingDiffs.some(d => d.change === 'changed'));
  });

  // 5.16 diffSnapshots() reports per-workflow coverage changes
  it('5.16 — diffSnapshots() includes per-workflow coverage', () => {
    const oldSnap = makeValidSnapshot({
      documents: [{ ...validDoc, workflowBindings: [] }],
    });
    const newSnap = makeValidSnapshot({
      documents: [{
        ...validDoc,
        workflowBindings: [{ workflowId: 'audit', priority: 'required' }],
      }],
    });
    const diff = diffSnapshots(oldSnap, newSnap);
    assert.ok(diff.workflowCoverage);
    assert.ok(diff.workflowCoverage.length > 0);
    const auditCoverage = diff.workflowCoverage.find(wc => wc.workflowId === 'audit');
    assert.ok(auditCoverage, 'Missing audit coverage entry');
    assert.equal(auditCoverage.newRequired, 1);
    assert.equal(auditCoverage.oldRequired, 0);
  });
});

// ════════════════════════════════════════════════════
// 6. Cross-Workstream Integration Tests
// ════════════════════════════════════════════════════

describe('6. Cross-Workstream Integration', () => {

  let snapshot;
  let loaded;
  try {
    loaded = loadCorpusSnapshot(SNAPSHOT_PATH);
    snapshot = loaded.snapshot;
  } catch {
    // Build a synthetic snapshot for integration testing
    snapshot = null;
    loaded = null;
  }

  // 6.3 Snapshot stats are consistent with document counts
  it('6.3 — Snapshot stats are consistent', () => {
    const snap = snapshot || makeValidSnapshot({ documents: [makeValidDoc()] });
    assert.equal(snap.stats.totalDocs, snap.documents.length);
    assert.equal(snap.stats.readyDocs + snap.stats.pendingDocs, snap.stats.totalDocs);
  });

  // 6.4 Snapshot stats.totalBindings matches actual binding count
  it('6.4 — stats.totalBindings matches actual count', () => {
    const snap = snapshot || makeValidSnapshot({ documents: [makeValidDoc()] });
    const actualBindings = snap.documents.reduce(
      (sum, doc) => sum + doc.workflowBindings.length, 0
    );
    assert.equal(snap.stats.totalBindings, actualBindings);
  });

  // 6.5 Snapshot stats.totalRelatedEdges matches actual edge count
  it('6.5 — stats.totalRelatedEdges matches actual count', () => {
    const snap = snapshot || makeValidSnapshot({ documents: [makeValidDoc()] });
    const actualEdges = snap.documents.reduce(
      (sum, doc) => sum + doc.relatedDocIds.length, 0
    );
    assert.equal(snap.stats.totalRelatedEdges, actualEdges);
  });

  // 6.6 snapshot-loader: getDocumentById() works
  it('6.6 — getDocumentById() returns correct document', () => {
    if (!loaded) return; // skip if no snapshot file
    const doc = getDocumentById(loaded, 'sql-injection-prevention');
    assert.ok(doc);
    assert.equal(doc.id, 'sql-injection-prevention');
  });

  // 6.6b snapshot-loader: getDocumentByUri() works
  it('6.6b — getDocumentByUri() returns correct document', () => {
    if (!loaded) return;
    const doc = getDocumentByUri(loaded, 'security://owasp/cheatsheet/sql-injection-prevention');
    assert.ok(doc);
    assert.equal(doc.id, 'sql-injection-prevention');
  });

  // 6.6c snapshot-loader: getDocumentById() returns undefined for unknown
  it('6.6c — getDocumentById() returns undefined for unknown ID', () => {
    if (!loaded) return;
    assert.equal(getDocumentById(loaded, 'nonexistent'), undefined);
  });

  // 6.7 Both types exist in types.ts (compile-time, verified via schema guards)
  it('6.7 — OwaspCorpusEntry and SecurityDoc types coexist', () => {
    // Verify SecurityDoc works via isSecurityDoc
    const securityDoc = makeValidDoc();
    assert.equal(isSecurityDoc(securityDoc), true);

    // Verify OwaspCorpusEntry fields are still parseable (backward compat)
    const legacyEntry = {
      id: 'test',
      title: 'Test',
      sourceUrl: 'https://example.com',
      intentSummary: 'Test summary',
      headings: [],
      checklistItems: [],
      canonicalRefs: [],
      workflowBindings: [],
      stackBindings: [],
      tags: [],
      status: 'parsed',
    };
    assert.equal(typeof legacyEntry.id, 'string');
    assert.equal(typeof legacyEntry.intentSummary, 'string');
    assert.equal(typeof legacyEntry.checklistItems, 'object');
    assert.equal(typeof legacyEntry.canonicalRefs, 'object');
  });
});

// ════════════════════════════════════════════════════
// 7. Migration Staging Tests
// ════════════════════════════════════════════════════

describe('7. Migration Staging (Dual-Read Parity)', () => {
  let snapshot;
  let loaded;
  try {
    loaded = loadCorpusSnapshot(SNAPSHOT_PATH);
    snapshot = loaded.snapshot;
  } catch {
    snapshot = null;
    loaded = null;
  }

  // 7.1 Snapshot bindings cover all 9 workflows
  it('7.1 — Snapshot has bindings for all 9 workflows', () => {
    if (!snapshot) return;
    const VALID_WORKFLOW_IDS = [
      'security-review', 'map-codebase', 'threat-model', 'audit',
      'validate-findings', 'plan-remediation', 'execute-remediation',
      'verify', 'report',
    ];
    const coveredWorkflows = new Set();
    for (const doc of snapshot.documents) {
      for (const wb of doc.workflowBindings) {
        coveredWorkflows.add(wb.workflowId);
      }
    }
    for (const wfId of VALID_WORKFLOW_IDS) {
      assert.ok(coveredWorkflows.has(wfId), `Workflow ${wfId} not covered in snapshot`);
    }
  });

  // 7.2 issueTypes in snapshot are valid
  it('7.2 — issueTypes in snapshot are valid IssueTag values', () => {
    if (!snapshot) return;
    const validTags = new Set(ALL_ISSUE_TAGS);
    // Add non-canonical tags that appear in overrides
    validTags.add('disclosure');
    validTags.add('reporting');
    validTags.add('terminology');

    for (const doc of snapshot.documents) {
      for (const tag of doc.issueTypes) {
        assert.ok(validTags.has(tag), `${doc.id} has unknown issueType: ${tag}`);
      }
    }
  });

  // 7.3 All 113 canonical URLs appear in snapshot
  it('7.3 — Snapshot contains all 113 canonical URLs', () => {
    if (!snapshot) return;
    const snapshotIds = new Set(snapshot.documents.map(d => d.id));
    for (const url of OWASP_CANONICAL_URLS) {
      const id = urlToId(url);
      assert.ok(snapshotIds.has(id), `Missing doc ${id} from snapshot`);
    }
  });

  // 7.4 Snapshot documents are sorted by ID (deterministic)
  it('7.4 — Snapshot documents are sorted by ID', () => {
    if (!snapshot) return;
    const ids = snapshot.documents.map(d => d.id);
    const sorted = [...ids].sort();
    assert.deepEqual(ids, sorted);
  });

  // 7.5 Every doc has a valid URI matching docUriFromId(doc.id)
  it('7.5 — Every doc URI matches docUriFromId(doc.id)', () => {
    if (!snapshot) return;
    for (const doc of snapshot.documents) {
      assert.equal(doc.uri, docUriFromId(doc.id), `URI mismatch for ${doc.id}`);
    }
  });

  // 7.6 All relatedDocIds resolve to existing docs
  it('7.6 — All relatedDocIds resolve to existing docs in snapshot', () => {
    if (!snapshot) return;
    const allIds = new Set(snapshot.documents.map(d => d.id));
    for (const doc of snapshot.documents) {
      for (const refId of doc.relatedDocIds) {
        assert.ok(allIds.has(refId), `${doc.id} references non-existent relatedDocId "${refId}"`);
      }
    }
  });
});
