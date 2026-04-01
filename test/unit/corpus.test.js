/**
 * Corpus Module Tests
 *
 * Tests for the new corpus modules: ids, schema, catalog, normalize, bindings, validators.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { docIdFromUrl, docUriFromId, resolveDocAlias, ALL_KNOWN_IDS, isKnownId, getAliasesForId } from '../../dist/corpus/ids.js';
import { isSecurityDoc, isCorpusSnapshot } from '../../dist/corpus/schema.js';
import { loadCatalog, loadOverrides, getCatalogEntry, getCatalogEntryByUrl, getOverride } from '../../dist/corpus/catalog.js';
import { normalizeContent, inferWorkflowBindingsFromContent } from '../../dist/corpus/normalize.js';
import { mergeBindings } from '../../dist/corpus/bindings.js';
import { validateSnapshot } from '../../dist/corpus/validators.js';
import { OWASP_CANONICAL_URLS, urlToId } from '../../dist/core/owasp-ingestion.js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── ids.ts ────────────────────────────────────────

describe('Corpus IDs', () => {
  it('should produce 113 unique IDs from canonical URLs', () => {
    assert.equal(ALL_KNOWN_IDS.length, 113);
    const uniqueIds = new Set(ALL_KNOWN_IDS);
    assert.equal(uniqueIds.size, 113);
  });

  it('should produce deterministic IDs via docIdFromUrl', () => {
    const url = 'https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html';
    assert.equal(docIdFromUrl(url), 'sql-injection-prevention');
  });

  it('should produce security:// URIs via docUriFromId', () => {
    assert.equal(docUriFromId('password-storage'), 'security://owasp/cheatsheet/password-storage');
    assert.equal(docUriFromId('xss-filter-evasion'), 'security://owasp/cheatsheet/xss-filter-evasion');
  });

  it('should resolve known aliases via resolveDocAlias', () => {
    assert.equal(resolveDocAlias('xss-prevention'), 'cross-site-scripting-prevention');
    assert.equal(resolveDocAlias('csrf-prevention'), 'cross-site-request-forgery-prevention');
    assert.equal(resolveDocAlias('sql-injection'), 'sql-injection-prevention');
  });

  it('should return a canonical ID as-is via resolveDocAlias', () => {
    assert.equal(resolveDocAlias('password-storage'), 'password-storage');
  });

  it('should return null for unknown aliases', () => {
    assert.equal(resolveDocAlias('totally-unknown-thing'), null);
    assert.equal(resolveDocAlias(''), null);
  });

  it('should identify known IDs via isKnownId', () => {
    assert.equal(isKnownId('password-storage'), true);
    assert.equal(isKnownId('sql-injection-prevention'), true);
    assert.equal(isKnownId('nonexistent-specialist'), false);
  });

  it('should get aliases for a canonical ID', () => {
    const aliases = getAliasesForId('cross-site-scripting-prevention');
    assert.ok(aliases.includes('xss-prevention'));
    assert.ok(aliases.length > 0);
  });
});

// ── schema.ts ─────────────────────────────────────

describe('Corpus Schema - type guards', () => {
  it('should validate a well-formed SecurityDoc', () => {
    const doc = {
      id: 'test-doc',
      uri: 'security://owasp/cheatsheet/test-doc',
      title: 'Test Doc',
      sourceUrl: 'https://example.com',
      sourceType: 'owasp-cheatsheet',
      corpusVersion: '1.0.0',
      status: 'ready',
      summary: 'A test doc',
      headings: ['Section 1'],
      checklist: ['Item 1'],
      tags: ['test'],
      issueTypes: ['injection'],
      workflowBindings: [{ workflowId: 'audit', priority: 'required' }],
      stackBindings: [{ stack: 'nodejs' }],
      relatedDocIds: [],
      aliases: [],
      provenance: { inferred: [], overridden: [] },
    };
    assert.equal(isSecurityDoc(doc), true);
  });

  it('should reject a malformed SecurityDoc', () => {
    assert.equal(isSecurityDoc(null), false);
    assert.equal(isSecurityDoc({}), false);
    assert.equal(isSecurityDoc({ id: 123 }), false);
    assert.equal(isSecurityDoc({ id: 'x', uri: 'x', title: 'x', sourceUrl: 'x', summary: 'x', sourceType: 'invalid' }), false);
  });

  it('should validate a well-formed CorpusSnapshot', () => {
    const snapshot = {
      schemaVersion: 1,
      corpusVersion: '1.0.0',
      generatedAt: '2026-03-31T00:00:00Z',
      documents: [],
      stats: { totalDocs: 0, readyDocs: 0, pendingDocs: 0, totalBindings: 0, totalRelatedEdges: 0 },
    };
    assert.equal(isCorpusSnapshot(snapshot), true);
  });

  it('should reject a malformed CorpusSnapshot', () => {
    assert.equal(isCorpusSnapshot(null), false);
    assert.equal(isCorpusSnapshot({}), false);
    assert.equal(isCorpusSnapshot({ schemaVersion: 2 }), false);
  });
});

// ── catalog.ts ────────────────────────────────────

describe('Corpus Catalog', () => {
  it('should load catalog.json and have 113 entries', () => {
    const data = JSON.parse(readFileSync(join(__dirname, '..', '..', 'data', 'corpus', 'catalog.json'), 'utf-8'));
    const catalog = loadCatalog(data);
    assert.equal(catalog.entries.length, 113);
  });

  it('should load overrides.json and have specialist overrides', () => {
    const data = JSON.parse(readFileSync(join(__dirname, '..', '..', 'data', 'corpus', 'overrides.json'), 'utf-8'));
    const overrides = loadOverrides(data);
    assert.ok(overrides.overrides.size > 0);
  });

  it('should look up catalog entry by ID', () => {
    const data = JSON.parse(readFileSync(join(__dirname, '..', '..', 'data', 'corpus', 'catalog.json'), 'utf-8'));
    const catalog = loadCatalog(data);
    const entry = getCatalogEntry(catalog, 'password-storage');
    assert.ok(entry);
    assert.equal(entry.id, 'password-storage');
  });

  it('should look up catalog entry by URL', () => {
    const data = JSON.parse(readFileSync(join(__dirname, '..', '..', 'data', 'corpus', 'catalog.json'), 'utf-8'));
    const catalog = loadCatalog(data);
    const entry = getCatalogEntryByUrl(catalog, 'https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html');
    assert.ok(entry);
    assert.equal(entry.id, 'password-storage');
  });

  it('should return undefined for non-existent ID', () => {
    const data = JSON.parse(readFileSync(join(__dirname, '..', '..', 'data', 'corpus', 'catalog.json'), 'utf-8'));
    const catalog = loadCatalog(data);
    assert.equal(getCatalogEntry(catalog, 'nonexistent'), undefined);
  });

  it('should have overrides for sql-injection-prevention', () => {
    const data = JSON.parse(readFileSync(join(__dirname, '..', '..', 'data', 'corpus', 'overrides.json'), 'utf-8'));
    const overrides = loadOverrides(data);
    const override = getOverride(overrides, 'sql-injection-prevention');
    assert.ok(override);
    assert.ok(override.workflowBindings.length > 0);
  });
});

// ── normalize.ts ──────────────────────────────────

describe('Corpus Normalize', () => {
  it('should produce pending content for empty HTML', () => {
    const result = normalizeContent('', 'https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html', '1.0.0');
    assert.equal(result.status, 'pending');
    assert.equal(result.id, 'password-storage');
    assert.equal(result.uri, 'security://owasp/cheatsheet/password-storage');
  });

  it('should extract content from HTML', () => {
    const html = `
      <h1>Password Storage</h1>
      <p>This cheat sheet provides guidance on password storage.</p>
      <h2>Introduction</h2>
      <h2>Hashing</h2>
      <ul>
        <li>You should use bcrypt for password hashing</li>
        <li>Ensure salt is unique per password</li>
        <li>Use a work factor of at least 12</li>
      </ul>
      <a href="/cheatsheets/Authentication_Cheat_Sheet.html">Authentication</a>
    `;
    const result = normalizeContent(html, 'https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html', '1.0.0');
    assert.equal(result.id, 'password-storage');
    assert.equal(result.title, 'Password Storage');
    assert.equal(result.status, 'ready');
    assert.ok(result.summary.length > 0);
    assert.ok(result.headings.length > 0);
    assert.ok(result.checklist.length > 0);
    assert.ok(result.relatedDocIds.includes('authentication'));
  });

  it('should infer workflow bindings from content', () => {
    const bindings = inferWorkflowBindingsFromContent('sql-injection-prevention', ['injection']);
    assert.ok(bindings.workflowBindings.length > 0);
    assert.ok(bindings.workflowBindings.some(b => b.workflowId === 'audit'));
  });

  it('should infer stack bindings for framework-specific docs', () => {
    const bindings = inferWorkflowBindingsFromContent('django-security', ['framework']);
    assert.ok(bindings.stackBindings.length > 0);
    assert.ok(bindings.stackBindings.some(b => b.stack === 'django'));
  });
});

// ── bindings.ts ───────────────────────────────────

describe('Corpus Bindings - merge', () => {
  it('should use curated override when available', () => {
    const inferred = {
      workflowBindings: [{ workflowId: 'audit', priority: 'required', rationale: 'inferred' }],
      stackBindings: [],
    };
    const override = {
      workflowBindings: [
        { workflowId: 'audit', priority: 'required' },
        { workflowId: 'plan-remediation', priority: 'required' },
      ],
      stackBindings: [{ stack: 'nodejs' }],
      issueTypes: ['sql-injection'],
    };
    const result = mergeBindings('sql-injection-prevention', inferred, override);
    assert.equal(result.workflowBindings.length, 2);
    assert.ok(result.workflowBindings.some(b => b.workflowId === 'plan-remediation'));
    assert.ok(result.provenance.overridden.length > 0);
  });

  it('should keep inferred bindings when no override exists', () => {
    const inferred = {
      workflowBindings: [{ workflowId: 'audit', priority: 'required', rationale: 'inferred' }],
      stackBindings: [],
    };
    const result = mergeBindings('some-unknown-doc', inferred, undefined);
    assert.equal(result.workflowBindings.length, 1);
    assert.ok(result.provenance.inferred.length > 0);
    assert.equal(result.provenance.overridden.length, 0);
  });

  it('should sort bindings by priority then workflowId', () => {
    const inferred = {
      workflowBindings: [
        { workflowId: 'verify', priority: 'optional', rationale: 'inferred' },
        { workflowId: 'audit', priority: 'required', rationale: 'inferred' },
      ],
      stackBindings: [],
    };
    const result = mergeBindings('test-doc', inferred, undefined);
    assert.equal(result.workflowBindings[0].workflowId, 'audit');
    assert.equal(result.workflowBindings[0].priority, 'required');
  });
});

// ── validators.ts ─────────────────────────────────

describe('Corpus Validators', () => {
  it('should pass a valid snapshot', () => {
    const snapshot = {
      schemaVersion: 1,
      corpusVersion: '1.0.0',
      generatedAt: '2026-03-31T00:00:00Z',
      documents: [
        {
          id: 'test-doc',
          uri: 'security://owasp/cheatsheet/test-doc',
          title: 'Test',
          sourceUrl: 'https://example.com',
          sourceType: 'owasp-cheatsheet',
          corpusVersion: '1.0.0',
          status: 'ready',
          summary: 'Test doc',
          headings: [],
          checklist: [],
          tags: [],
          issueTypes: [],
          workflowBindings: [{ workflowId: 'audit', priority: 'required' }],
          stackBindings: [],
          relatedDocIds: [],
          aliases: [],
          provenance: { inferred: [], overridden: [] },
        },
      ],
      stats: { totalDocs: 1, readyDocs: 1, pendingDocs: 0, totalBindings: 1, totalRelatedEdges: 0 },
    };
    const result = validateSnapshot(snapshot);
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
  });

  it('should fail on duplicate IDs', () => {
    const doc = {
      id: 'dup',
      uri: 'security://owasp/cheatsheet/dup',
      title: 'Dup',
      sourceUrl: 'https://example.com',
      sourceType: 'owasp-cheatsheet',
      corpusVersion: '1.0.0',
      status: 'ready',
      summary: 'Dup',
      headings: [],
      checklist: [],
      tags: [],
      issueTypes: [],
      workflowBindings: [],
      stackBindings: [],
      relatedDocIds: [],
      aliases: [],
      provenance: { inferred: [], overridden: [] },
    };
    const snapshot = {
      schemaVersion: 1,
      corpusVersion: '1.0.0',
      generatedAt: '2026-03-31T00:00:00Z',
      documents: [doc, { ...doc }],
      stats: { totalDocs: 2, readyDocs: 2, pendingDocs: 0, totalBindings: 0, totalRelatedEdges: 0 },
    };
    const result = validateSnapshot(snapshot);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.rule === 'unique-ids'));
  });

  it('should fail on invalid related edges', () => {
    const snapshot = {
      schemaVersion: 1,
      corpusVersion: '1.0.0',
      generatedAt: '2026-03-31T00:00:00Z',
      documents: [
        {
          id: 'test',
          uri: 'security://owasp/cheatsheet/test',
          title: 'Test',
          sourceUrl: 'https://example.com',
          sourceType: 'owasp-cheatsheet',
          corpusVersion: '1.0.0',
          status: 'ready',
          summary: 'Test',
          headings: [],
          checklist: [],
          tags: [],
          issueTypes: [],
          workflowBindings: [],
          stackBindings: [],
          relatedDocIds: ['nonexistent-doc'],
          aliases: [],
          provenance: { inferred: [], overridden: [] },
        },
      ],
      stats: { totalDocs: 1, readyDocs: 1, pendingDocs: 0, totalBindings: 0, totalRelatedEdges: 1 },
    };
    const result = validateSnapshot(snapshot);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.rule === 'valid-related-edges'));
  });

  it('should fail on invalid workflow ID', () => {
    const snapshot = {
      schemaVersion: 1,
      corpusVersion: '1.0.0',
      generatedAt: '2026-03-31T00:00:00Z',
      documents: [
        {
          id: 'test',
          uri: 'security://owasp/cheatsheet/test',
          title: 'Test',
          sourceUrl: 'https://example.com',
          sourceType: 'owasp-cheatsheet',
          corpusVersion: '1.0.0',
          status: 'ready',
          summary: 'Test',
          headings: [],
          checklist: [],
          tags: [],
          issueTypes: [],
          workflowBindings: [{ workflowId: 'invalid-workflow', priority: 'required' }],
          stackBindings: [],
          relatedDocIds: [],
          aliases: [],
          provenance: { inferred: [], overridden: [] },
        },
      ],
      stats: { totalDocs: 1, readyDocs: 1, pendingDocs: 0, totalBindings: 1, totalRelatedEdges: 0 },
    };
    const result = validateSnapshot(snapshot);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.rule === 'valid-workflow-ids'));
  });
});

// ── ID stability check ────────────────────────────

describe('Corpus ID Stability', () => {
  it('should produce the same IDs as urlToId for all canonical URLs', () => {
    for (const url of OWASP_CANONICAL_URLS) {
      assert.equal(docIdFromUrl(url), urlToId(url), `Mismatch for ${url}`);
    }
  });

  it('should have all 113 IDs in the catalog.json', () => {
    const data = JSON.parse(readFileSync(join(__dirname, '..', '..', 'data', 'corpus', 'catalog.json'), 'utf-8'));
    const catalogIds = data.sources.map(s => s.id);
    assert.equal(catalogIds.length, 113);
    const uniqueCatalogIds = new Set(catalogIds);
    assert.equal(uniqueCatalogIds.size, 113);
  });
});
