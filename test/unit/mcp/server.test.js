/**
 * Unit tests for the MCP server, resources, and tools.
 *
 * Tests the tool/resource handlers directly (no stdio transport needed).
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

import { computeDiagnostics } from '../../../dist/mcp/diagnostics.js';
import { readResource, buildResourceList } from '../../../dist/mcp/resources.js';
import { handleConsultationPlan } from '../../../dist/mcp/tools/consultation-plan.js';
import { handleValidateCoverage } from '../../../dist/mcp/tools/validate-coverage.js';
import { handleReadDoc } from '../../../dist/mcp/tools/read-doc.js';
import { handleRelatedDocs } from '../../../dist/mcp/tools/related-docs.js';
import { handleSearchDocs } from '../../../dist/mcp/tools/search-docs.js';
import { handleListWorkflows, handleListStacks } from '../../../dist/mcp/tools/diagnostics.js';
import { makeMinimalSnapshot, makeEmptySnapshot } from '../../fixtures/consultation-plan-fixtures.js';

describe('MCP Server', () => {

  describe('Diagnostics', () => {
    it('computes diagnostics from loaded snapshot', () => {
      const loaded = makeMinimalSnapshot();
      const diag = computeDiagnostics(loaded);

      assert.equal(diag.corpusVersion, '1.0.0');
      assert.equal(diag.totalDocs, 12);
      assert.ok(diag.readyDocs > 0);
      assert.ok(diag.supportedWorkflows.length > 0);
      assert.ok(diag.supportedStacks.length > 0);
    });

    it('handles empty snapshot', () => {
      const loaded = makeEmptySnapshot();
      const diag = computeDiagnostics(loaded);

      assert.equal(diag.totalDocs, 0);
      assert.deepEqual(diag.supportedWorkflows, []);
      assert.deepEqual(diag.supportedStacks, []);
    });

    it('list_supported_workflows returns workflow list', () => {
      const loaded = makeMinimalSnapshot();
      const diag = computeDiagnostics(loaded);
      const result = handleListWorkflows(diag);

      assert.ok(result.workflows.includes('audit'));
      assert.ok(result.workflows.includes('security-review'));
      assert.equal(result.corpusVersion, '1.0.0');
    });

    it('list_supported_stacks returns stack tags', () => {
      const loaded = makeMinimalSnapshot();
      const diag = computeDiagnostics(loaded);
      const result = handleListStacks(diag);

      assert.ok(result.stacks.includes('nodejs'));
      assert.ok(result.stacks.includes('django'));
      assert.equal(result.corpusVersion, '1.0.0');
    });
  });

  describe('Resources', () => {
    it('builds resource list from diagnostics', () => {
      const loaded = makeMinimalSnapshot();
      const diag = computeDiagnostics(loaded);
      const resources = buildResourceList(diag);

      const catalogResource = resources.find(r => r.uri === 'security://catalog/index');
      assert.ok(catalogResource);
      assert.equal(catalogResource.mimeType, 'application/json');

      const auditResource = resources.find(r => r.uri === 'security://workflow/audit/defaults');
      assert.ok(auditResource);
    });

    it('reads catalog/index resource', () => {
      const loaded = makeMinimalSnapshot();
      const diag = computeDiagnostics(loaded);
      const content = readResource('security://catalog/index', loaded, diag);

      assert.equal(content.uri, 'security://catalog/index');
      assert.equal(content.mimeType, 'application/json');

      const data = JSON.parse(content.text);
      assert.equal(data.corpusVersion, '1.0.0');
      assert.ok(data.totalDocs > 0);
      assert.ok(Array.isArray(data.supportedWorkflows));
    });

    it('reads workflow defaults resource', () => {
      const loaded = makeMinimalSnapshot();
      const diag = computeDiagnostics(loaded);
      const content = readResource('security://workflow/audit/defaults', loaded, diag);

      const data = JSON.parse(content.text);
      assert.equal(data.workflowId, 'audit');
      assert.ok(Array.isArray(data.required));
      assert.ok(Array.isArray(data.optional));
    });

    it('reads cheatsheet resource by ID', () => {
      const loaded = makeMinimalSnapshot();
      const diag = computeDiagnostics(loaded);
      const content = readResource('security://owasp/cheatsheet/sql-injection-prevention', loaded, diag);

      const data = JSON.parse(content.text);
      assert.equal(data.id, 'sql-injection-prevention');
      assert.equal(data.title, 'SQL Injection Prevention');
    });

    it('throws on unknown document ID', () => {
      const loaded = makeMinimalSnapshot();
      const diag = computeDiagnostics(loaded);

      assert.throws(
        () => readResource('security://owasp/cheatsheet/nonexistent', loaded, diag),
        /not found/i,
      );
    });

    it('throws on unknown resource URI', () => {
      const loaded = makeMinimalSnapshot();
      const diag = computeDiagnostics(loaded);

      assert.throws(
        () => readResource('security://unknown/path', loaded, diag),
        /unknown resource/i,
      );
    });
  });

  describe('Tool: get_workflow_consultation_plan', () => {
    it('returns plan for audit workflow', () => {
      const loaded = makeMinimalSnapshot();
      const plan = handleConsultationPlan(
        { workflowId: 'audit' },
        loaded,
      );

      assert.equal(plan.schemaVersion, 1);
      assert.equal(plan.workflowId, 'audit');
      assert.ok(plan.required.length > 0);
      assert.ok(plan.generatedAt);
      assert.equal(plan.corpusVersion, '1.0.0');
    });

    it('includes stack-conditioned docs', () => {
      const loaded = makeMinimalSnapshot();
      const plan = handleConsultationPlan(
        { workflowId: 'audit', stacks: ['nodejs'] },
        loaded,
      );

      const allDocIds = [
        ...plan.required,
        ...plan.optional,
        ...plan.followup,
      ].map(e => e.docId);

      // nodejs-security should appear via stack binding
      assert.ok(
        allDocIds.includes('nodejs-security'),
        `Expected nodejs-security in plan, got: ${allDocIds.join(', ')}`,
      );
    });

    it('includes issue-tag-matched docs', () => {
      const loaded = makeMinimalSnapshot();
      const plan = handleConsultationPlan(
        { workflowId: 'audit', issueTags: ['xss'] },
        loaded,
      );

      const allDocIds = [
        ...plan.required,
        ...plan.optional,
        ...plan.followup,
      ].map(e => e.docId);

      assert.ok(
        allDocIds.includes('cross-site-scripting-prevention'),
        `Expected cross-site-scripting-prevention in plan`,
      );
    });

    it('plan is deterministic', () => {
      const loaded = makeMinimalSnapshot();

      const plan1 = handleConsultationPlan(
        { workflowId: 'audit' },
        loaded,
      );
      const plan2 = handleConsultationPlan(
        { workflowId: 'audit' },
        loaded,
      );

      assert.deepEqual(
        plan1.required.map(e => e.docId),
        plan2.required.map(e => e.docId),
      );
    });
  });

  describe('Tool: validate_security_consultation', () => {
    it('passes when all required docs consulted', () => {
      const loaded = makeMinimalSnapshot();

      // Get plan first to know required doc IDs
      const plan = handleConsultationPlan(
        { workflowId: 'audit' },
        loaded,
      );
      const requiredIds = plan.required.map(e => e.docId);

      const result = handleValidateCoverage(
        { workflowId: 'audit', consultedDocs: requiredIds },
        loaded,
      );

      assert.equal(result.coverageStatus, 'pass');
      assert.equal(result.requiredMissing.length, 0);
    });

    it('fails when required docs missing', () => {
      const loaded = makeMinimalSnapshot();

      const result = handleValidateCoverage(
        { workflowId: 'audit', consultedDocs: [] },
        loaded,
      );

      assert.equal(result.coverageStatus, 'fail');
      assert.ok(result.requiredMissing.length > 0);
    });

    it('warns when partial coverage', () => {
      const loaded = makeMinimalSnapshot();

      // Get plan and consult only half the required docs
      const plan = handleConsultationPlan(
        { workflowId: 'audit' },
        loaded,
      );
      const halfRequired = plan.required.slice(0, Math.max(1, Math.floor(plan.required.length / 2)));
      const consultedIds = halfRequired.map(e => e.docId);

      const result = handleValidateCoverage(
        { workflowId: 'audit', consultedDocs: consultedIds },
        loaded,
      );

      assert.equal(result.coverageStatus, 'fail');
      assert.ok(result.requiredMissing.length > 0);
    });

    it('returns schema version 1', () => {
      const loaded = makeMinimalSnapshot();
      const result = handleValidateCoverage(
        { workflowId: 'audit', consultedDocs: [] },
        loaded,
      );

      assert.equal(result.schemaVersion, 1);
    });
  });

  describe('Tool: read_security_doc', () => {
    it('reads doc by canonical ID', () => {
      const loaded = makeMinimalSnapshot();
      const doc = handleReadDoc({ id: 'sql-injection-prevention' }, loaded);

      assert.ok(doc);
      assert.equal(doc.id, 'sql-injection-prevention');
    });

    it('resolves alias to canonical doc', () => {
      const loaded = makeMinimalSnapshot();
      // 'xss-prevention' should resolve to cross-site-scripting-prevention
      const doc = handleReadDoc({ id: 'xss-prevention' }, loaded);

      assert.ok(doc);
      assert.equal(doc.id, 'cross-site-scripting-prevention');
    });

    it('reads doc by URI', () => {
      const loaded = makeMinimalSnapshot();
      const doc = handleReadDoc(
        { uri: 'security://owasp/cheatsheet/sql-injection-prevention' },
        loaded,
      );

      assert.ok(doc);
      assert.equal(doc.id, 'sql-injection-prevention');
    });

    it('returns null for nonexistent doc', () => {
      const loaded = makeMinimalSnapshot();
      const doc = handleReadDoc({ id: 'nonexistent' }, loaded);
      assert.equal(doc, null);
    });

    it('returns null when no id or uri provided', () => {
      const loaded = makeMinimalSnapshot();
      const doc = handleReadDoc({}, loaded);
      assert.equal(doc, null);
    });
  });

  describe('Tool: get_related_security_docs', () => {
    it('returns related docs for a document with edges', () => {
      const loaded = makeMinimalSnapshot();
      const docs = handleRelatedDocs({ id: 'sql-injection-prevention' }, loaded);

      assert.ok(docs.length > 0);
      const ids = docs.map(d => d.id);
      // sql-injection-prevention has relatedDocIds: ['query-parameterization', 'input-validation']
      assert.ok(ids.includes('query-parameterization'));
      assert.ok(ids.includes('input-validation'));
    });

    it('returns empty for nonexistent doc', () => {
      const loaded = makeMinimalSnapshot();
      const docs = handleRelatedDocs({ id: 'nonexistent' }, loaded);
      assert.deepEqual(docs, []);
    });

    it('includes reverse edges', () => {
      const loaded = makeMinimalSnapshot();
      // query-parameterization has relatedDocIds: ['sql-injection-prevention']
      // So sql-injection-prevention should appear as a reverse edge
      const docs = handleRelatedDocs({ id: 'query-parameterization' }, loaded);

      const ids = docs.map(d => d.id);
      assert.ok(ids.includes('sql-injection-prevention'));
    });
  });

  describe('Tool: search_security_docs', () => {
    it('finds docs by query', () => {
      const loaded = makeMinimalSnapshot();
      const results = handleSearchDocs({ query: 'SQL injection' }, loaded);

      assert.ok(results.length > 0);
      const ids = results.map(r => r.doc.id);
      assert.ok(ids.includes('sql-injection-prevention'));
    });

    it('returns scored results with matchedFields', () => {
      const loaded = makeMinimalSnapshot();
      const results = handleSearchDocs({ query: 'SQL injection' }, loaded);

      for (const result of results) {
        assert.ok(result.score > 0);
        assert.ok(result.matchedFields.length > 0);
      }
    });

    it('respects topK limit', () => {
      const loaded = makeMinimalSnapshot();
      const results = handleSearchDocs({ query: 'security', topK: 2 }, loaded);

      assert.ok(results.length <= 2);
    });

    it('filters by sourceType', () => {
      const loaded = makeMinimalSnapshot();
      const results = handleSearchDocs(
        { query: 'security', sourceTypes: ['owasp-cheatsheet'] },
        loaded,
      );

      for (const result of results) {
        assert.equal(result.doc.sourceType, 'owasp-cheatsheet');
      }
    });

    it('filters by workflowId', () => {
      const loaded = makeMinimalSnapshot();
      const results = handleSearchDocs(
        { query: 'security', workflowId: 'audit' },
        loaded,
      );

      for (const result of results) {
        const hasAudit = result.doc.workflowBindings.some(b => b.workflowId === 'audit');
        assert.ok(hasAudit);
      }
    });

    it('filters by stack', () => {
      const loaded = makeMinimalSnapshot();
      const results = handleSearchDocs(
        { query: 'security', stack: ['nodejs'] },
        loaded,
      );

      for (const result of results) {
        const hasStack = result.doc.stackBindings.some(sb => sb.stack === 'nodejs');
        assert.ok(hasStack);
      }
    });

    it('returns empty for empty query', () => {
      const loaded = makeMinimalSnapshot();
      const results = handleSearchDocs({ query: '' }, loaded);
      assert.deepEqual(results, []);
    });

    it('results are sorted by score desc', () => {
      const loaded = makeMinimalSnapshot();
      const results = handleSearchDocs({ query: 'sql' }, loaded);

      for (let i = 1; i < results.length; i++) {
        assert.ok(
          results[i - 1].score >= results[i].score,
          `Results not sorted: ${results[i - 1].score} < ${results[i].score}`,
        );
      }
    });
  });

  describe('Integration: full audit consultation flow', () => {
    it('plan -> read -> validate passes', () => {
      const loaded = makeMinimalSnapshot();

      // Step 1: Compute plan
      const plan = handleConsultationPlan(
        { workflowId: 'audit' },
        loaded,
      );

      // Step 2: Read all required docs
      const consultedDocs = [];
      for (const entry of plan.required) {
        const doc = handleReadDoc({ id: entry.docId }, loaded);
        assert.ok(doc, `Failed to read required doc: ${entry.docId}`);
        consultedDocs.push(entry.docId);
      }

      // Step 3: Validate coverage
      const validation = handleValidateCoverage(
        { workflowId: 'audit', consultedDocs },
        loaded,
      );

      assert.equal(validation.coverageStatus, 'pass');
      assert.equal(validation.requiredMissing.length, 0);
    });

    it('plan -> partial read -> validate fails with requiredMissing', () => {
      const loaded = makeMinimalSnapshot();

      const plan = handleConsultationPlan(
        { workflowId: 'audit' },
        loaded,
      );

      // Consult only first required doc
      const partial = plan.required.length > 0
        ? [plan.required[0].docId]
        : [];

      const validation = handleValidateCoverage(
        { workflowId: 'audit', consultedDocs: partial },
        loaded,
      );

      assert.equal(validation.coverageStatus, 'fail');
      assert.ok(validation.requiredMissing.length > 0);
    });
  });
});
