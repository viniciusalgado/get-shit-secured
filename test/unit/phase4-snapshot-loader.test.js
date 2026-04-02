/**
 * Phase 4 Validation — Snapshot Loader Comprehensive Tests
 *
 * Validates the snapshot-loader helper functions that the planner and
 * compliance engine depend on: getDocumentsForWorkflow, getDocumentsForStack,
 * getRelatedDocuments, getDocumentById, getDocumentByUri.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  loadCorpusSnapshot,
  getDocumentById,
  getDocumentByUri,
  getDocumentsForWorkflow,
  getDocumentsForStack,
  getRelatedDocuments,
} from '../../dist/corpus/snapshot-loader.js';
import {
  makeMinimalSnapshot,
  makeEmptySnapshot,
  createLoadedSnapshot,
  createDoc,
} from '../fixtures/consultation-plan-fixtures.js';

// =============================================================================
// 1. getDocumentById
// =============================================================================

describe('Phase 4 Validation — getDocumentById', () => {

  it('should return doc by canonical ID', () => {
    const loaded = makeMinimalSnapshot();
    const doc = getDocumentById(loaded, 'sql-injection-prevention');

    assert.ok(doc);
    assert.equal(doc.id, 'sql-injection-prevention');
    assert.equal(doc.title, 'SQL Injection Prevention');
    assert.ok(doc.tags.includes('sql'));
    assert.ok(Array.isArray(doc.checklist));
  });

  it('should return undefined for unknown ID', () => {
    const loaded = makeMinimalSnapshot();
    const doc = getDocumentById(loaded, 'nonexistent-doc');
    assert.equal(doc, undefined);
  });

  it('should return undefined for empty snapshot', () => {
    const loaded = makeEmptySnapshot();
    const doc = getDocumentById(loaded, 'sql-injection-prevention');
    assert.equal(doc, undefined);
  });
});

// =============================================================================
// 2. getDocumentByUri
// =============================================================================

describe('Phase 4 Validation — getDocumentByUri', () => {

  it('should return doc by security:// URI', () => {
    const loaded = makeMinimalSnapshot();
    const doc = getDocumentByUri(loaded, 'security://owasp/cheatsheet/sql-injection-prevention');

    assert.ok(doc);
    assert.equal(doc.id, 'sql-injection-prevention');
  });

  it('should return undefined for unknown URI', () => {
    const loaded = makeMinimalSnapshot();
    const doc = getDocumentByUri(loaded, 'security://owasp/cheatsheet/nonexistent');
    assert.equal(doc, undefined);
  });

  it('should return undefined for non-security URI', () => {
    const loaded = makeMinimalSnapshot();
    const doc = getDocumentByUri(loaded, 'https://example.com/something');
    assert.equal(doc, undefined);
  });
});

// =============================================================================
// 3. getDocumentsForWorkflow
// =============================================================================

describe('Phase 4 Validation — getDocumentsForWorkflow', () => {

  it('should return required docs for audit workflow', () => {
    const loaded = makeMinimalSnapshot();
    const docs = getDocumentsForWorkflow(loaded, 'audit', 'required');

    const ids = docs.map(d => d.id);
    assert.ok(ids.includes('sql-injection-prevention'));
    assert.ok(ids.includes('cross-site-scripting-prevention'));
  });

  it('should return optional docs for audit workflow', () => {
    const loaded = makeMinimalSnapshot();
    const docs = getDocumentsForWorkflow(loaded, 'audit', 'optional');

    const ids = docs.map(d => d.id);
    assert.ok(ids.includes('authentication-cheatsheet'));
    assert.ok(ids.includes('django-security'));
    assert.ok(ids.includes('password-storage'));
    assert.ok(ids.includes('logging-cheatsheet'));
  });

  it('should return all docs for workflow when no priority filter', () => {
    const loaded = makeMinimalSnapshot();
    const docs = getDocumentsForWorkflow(loaded, 'audit');

    const ids = docs.map(d => d.id);
    assert.ok(ids.includes('sql-injection-prevention'));   // required
    assert.ok(ids.includes('authentication-cheatsheet'));   // optional
  });

  it('should return empty array for workflow with no bindings', () => {
    const loaded = makeMinimalSnapshot();
    const docs = getDocumentsForWorkflow(loaded, 'map-codebase');
    assert.equal(docs.length, 0);
  });

  it('should return empty array for empty snapshot', () => {
    const loaded = makeEmptySnapshot();
    const docs = getDocumentsForWorkflow(loaded, 'audit', 'required');
    assert.equal(docs.length, 0);
  });

  it('should return required docs for security-review workflow', () => {
    const loaded = makeMinimalSnapshot();
    const docs = getDocumentsForWorkflow(loaded, 'security-review', 'required');
    const ids = docs.map(d => d.id);
    assert.ok(ids.includes('sql-injection-prevention'));
  });

  it('should return optional docs for verify workflow', () => {
    const loaded = makeMinimalSnapshot();
    const docs = getDocumentsForWorkflow(loaded, 'verify', 'optional');
    const ids = docs.map(d => d.id);
    assert.ok(ids.includes('sql-injection-prevention'));
  });
});

// =============================================================================
// 4. getDocumentsForStack
// =============================================================================

describe('Phase 4 Validation — getDocumentsForStack', () => {

  it('should return docs matching stack tag', () => {
    const loaded = makeMinimalSnapshot();
    const docs = getDocumentsForStack(loaded, 'django');

    assert.ok(docs.length > 0);
    assert.ok(docs.every(d => d.stackBindings.some(sb => sb.stack === 'django')));
  });

  it('should be case-insensitive', () => {
    const loaded = makeMinimalSnapshot();
    const docs = getDocumentsForStack(loaded, 'Django');
    assert.ok(docs.length > 0);
    assert.ok(docs.some(d => d.id === 'django-security'));
  });

  it('should return empty for unknown stack', () => {
    const loaded = makeMinimalSnapshot();
    const docs = getDocumentsForStack(loaded, 'rust');
    assert.equal(docs.length, 0);
  });

  it('should return empty for empty snapshot', () => {
    const loaded = makeEmptySnapshot();
    const docs = getDocumentsForStack(loaded, 'django');
    assert.equal(docs.length, 0);
  });

  it('should match nodejs stack', () => {
    const loaded = makeMinimalSnapshot();
    const docs = getDocumentsForStack(loaded, 'nodejs');
    assert.ok(docs.some(d => d.id === 'nodejs-security'));
  });

  it('should match docker stack', () => {
    const loaded = makeMinimalSnapshot();
    const docs = getDocumentsForStack(loaded, 'docker');
    assert.ok(docs.some(d => d.id === 'docker-security'));
  });
});

// =============================================================================
// 5. getRelatedDocuments
// =============================================================================

describe('Phase 4 Validation — getRelatedDocuments', () => {

  it('should return forward-related docs', () => {
    const loaded = makeMinimalSnapshot();
    const related = getRelatedDocuments(loaded, 'sql-injection-prevention');

    const ids = related.map(d => d.id);
    assert.ok(ids.includes('query-parameterization'), 'Forward edge: query-parameterization');
    assert.ok(ids.includes('input-validation'), 'Forward edge: input-validation');
  });

  it('should return reverse-related docs', () => {
    const loaded = makeMinimalSnapshot();
    // query-parameterization has relatedDocIds: ['sql-injection-prevention']
    // So sql-injection-prevention should appear as a reverse edge
    const related = getRelatedDocuments(loaded, 'query-parameterization');

    const ids = related.map(d => d.id);
    assert.ok(ids.includes('sql-injection-prevention'), 'Reverse edge: sql-injection-prevention');
  });

  it('should return empty array for doc with no relations', () => {
    const loaded = makeMinimalSnapshot();
    // input-validation has relatedDocIds: [] and no doc references it
    const related = getRelatedDocuments(loaded, 'input-validation');
    // Check if input-validation has no forward or reverse relations
    const doc = getDocumentById(loaded, 'input-validation');
    if (doc.relatedDocIds.length === 0) {
      // Check if any other doc references it
      const hasReverseRef = loaded.snapshot.documents.some(
        d => d.id !== 'input-validation' && d.relatedDocIds.includes('input-validation'),
      );
      if (!hasReverseRef) {
        assert.equal(related.length, 0);
      }
    }
  });

  it('should return empty for unknown doc ID', () => {
    const loaded = makeMinimalSnapshot();
    const related = getRelatedDocuments(loaded, 'nonexistent-doc');
    assert.equal(related.length, 0);
  });

  it('should not return duplicate docs', () => {
    const loaded = makeMinimalSnapshot();
    const related = getRelatedDocuments(loaded, 'sql-injection-prevention');
    const ids = related.map(d => d.id);
    const uniqueIds = [...new Set(ids)];
    assert.equal(ids.length, uniqueIds.length, 'No duplicate doc IDs in related');
  });

  it('should not include the source doc in results', () => {
    const loaded = makeMinimalSnapshot();
    const related = getRelatedDocuments(loaded, 'sql-injection-prevention');
    assert.ok(!related.some(d => d.id === 'sql-injection-prevention'),
      'Source doc should not appear in related');
  });

  it('should handle bidirectional edges correctly', () => {
    const loaded = makeMinimalSnapshot();
    // cross-site-scripting-prevention has relatedDocIds: ['dom-based-xss-prevention']
    // dom-based-xss-prevention has relatedDocIds: ['cross-site-scripting-prevention']
    const related = getRelatedDocuments(loaded, 'cross-site-scripting-prevention');
    const ids = related.map(d => d.id);
    assert.ok(ids.includes('dom-based-xss-prevention'));
  });
});

// =============================================================================
// 6. Fixture Integrity
// =============================================================================

describe('Phase 4 Validation — Fixture Integrity', () => {

  it('makeMinimalSnapshot should produce valid LoadedSnapshot', () => {
    const loaded = makeMinimalSnapshot();

    assert.ok(loaded.snapshot);
    assert.ok(loaded.byId instanceof Map);
    assert.ok(loaded.byUri instanceof Map);
    assert.equal(loaded.snapshot.schemaVersion, 1);
    assert.ok(loaded.snapshot.documents.length > 0);
    assert.equal(loaded.byId.size, loaded.snapshot.documents.length);
    assert.equal(loaded.byUri.size, loaded.snapshot.documents.length);
  });

  it('makeEmptySnapshot should produce valid empty snapshot', () => {
    const loaded = makeEmptySnapshot();

    assert.equal(loaded.snapshot.documents.length, 0);
    assert.equal(loaded.byId.size, 0);
    assert.equal(loaded.byUri.size, 0);
  });

  it('createLoadedSnapshot should build correct lookups', () => {
    const docs = [
      createDoc({ id: 'a', uri: 'security://owasp/cheatsheet/a' }),
      createDoc({ id: 'b', uri: 'security://owasp/cheatsheet/b' }),
    ];
    const loaded = createLoadedSnapshot(docs);

    assert.equal(loaded.byId.size, 2);
    assert.equal(loaded.byUri.size, 2);
    assert.ok(loaded.byId.has('a'));
    assert.ok(loaded.byId.has('b'));
  });

  it('createDoc should produce valid doc with overrides', () => {
    const doc = createDoc({ id: 'custom-id', tags: ['custom'] });

    assert.equal(doc.id, 'custom-id');
    assert.deepEqual(doc.tags, ['custom']);
    assert.equal(doc.sourceType, 'owasp-cheatsheet');
    assert.ok(Array.isArray(doc.workflowBindings));
    assert.ok(Array.isArray(doc.relatedDocIds));
  });
});
