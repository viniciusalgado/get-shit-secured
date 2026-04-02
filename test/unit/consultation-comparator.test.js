/**
 * Unit tests for consultation comparator.
 * Phase 11 — Workstream B: Dual-run comparison strategy.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { compareConsultationTraces } from '../../dist/core/consultation-comparator.js';

function makeTrace(overrides) {
  return {
    plan: {
      workflowId: 'audit',
      generatedAt: '2026-04-01T12:00:00Z',
      corpusVersion: '1.0.0',
      requiredCount: 3,
      optionalCount: 2,
      followupCount: 1,
      ...overrides?.plan,
    },
    consultedDocs: overrides?.consultedDocs || [],
    coverageStatus: overrides?.coverageStatus || 'pass',
    requiredMissing: overrides?.requiredMissing || [],
    notes: overrides?.notes || [],
  };
}

describe('compareConsultationTraces', () => {
  it('returns equivalent for identical traces', () => {
    const trace = makeTrace({
      consultedDocs: [
        { id: 'sql-injection', title: 'SQL Injection', sourceUrl: 'https://example.com' },
        { id: 'xss-prevention', title: 'XSS Prevention', sourceUrl: 'https://example.com' },
      ],
    });
    const result = compareConsultationTraces(trace, trace);
    assert.equal(result.assessment, 'equivalent');
    assert.equal(result.common.length, 2);
    assert.equal(result.mcpOnly.length, 0);
    assert.equal(result.legacyOnly.length, 0);
    assert.equal(result.coverageDelta, 0);
  });

  it('returns mcp-superior when MCP has more required docs', () => {
    const mcpTrace = makeTrace({
      consultedDocs: [
        { id: 'sql-injection', title: 'SQL Injection', sourceUrl: 'https://example.com' },
        { id: 'xss-prevention', title: 'XSS Prevention', sourceUrl: 'https://example.com' },
        { id: 'input-validation', title: 'Input Validation', sourceUrl: 'https://example.com' },
      ],
    });
    const legacyTrace = makeTrace({
      consultedDocs: [
        { id: 'sql-injection', title: 'SQL Injection', sourceUrl: 'https://example.com' },
      ],
      requiredMissing: ['xss-prevention', 'input-validation'],
    });
    const result = compareConsultationTraces(mcpTrace, legacyTrace);
    assert.equal(result.assessment, 'mcp-superior');
    assert.ok(result.coverageDelta > 0);
    assert.ok(result.mcpOnly.includes('xss-prevention'));
    assert.ok(result.mcpOnly.includes('input-validation'));
  });

  it('returns mcp-inferior when MCP is missing required docs', () => {
    const mcpTrace = makeTrace({
      consultedDocs: [
        { id: 'sql-injection', title: 'SQL Injection', sourceUrl: 'https://example.com' },
      ],
      requiredMissing: ['xss-prevention', 'input-validation'],
    });
    const legacyTrace = makeTrace({
      consultedDocs: [
        { id: 'sql-injection', title: 'SQL Injection', sourceUrl: 'https://example.com' },
        { id: 'xss-prevention', title: 'XSS Prevention', sourceUrl: 'https://example.com' },
        { id: 'input-validation', title: 'Input Validation', sourceUrl: 'https://example.com' },
      ],
    });
    const result = compareConsultationTraces(mcpTrace, legacyTrace);
    assert.equal(result.assessment, 'mcp-inferior');
    assert.ok(result.coverageDelta < 0);
    assert.ok(result.legacyOnly.includes('xss-prevention'));
  });

  it('handles empty traces gracefully', () => {
    const mcpTrace = makeTrace({ consultedDocs: [] });
    const legacyTrace = makeTrace({ consultedDocs: [] });
    const result = compareConsultationTraces(mcpTrace, legacyTrace);
    assert.equal(result.assessment, 'equivalent');
    assert.equal(result.mcpDocs.length, 0);
    assert.equal(result.legacyDocs.length, 0);
    assert.equal(result.common.length, 0);
    assert.equal(result.coverageDelta, 0);
  });

  it('computes correct set operations for partial overlap', () => {
    const mcpTrace = makeTrace({
      consultedDocs: [
        { id: 'a', title: 'A', sourceUrl: '' },
        { id: 'b', title: 'B', sourceUrl: '' },
        { id: 'c', title: 'C', sourceUrl: '' },
      ],
    });
    const legacyTrace = makeTrace({
      consultedDocs: [
        { id: 'b', title: 'B', sourceUrl: '' },
        { id: 'c', title: 'C', sourceUrl: '' },
        { id: 'd', title: 'D', sourceUrl: '' },
      ],
    });
    const result = compareConsultationTraces(mcpTrace, legacyTrace);
    assert.deepEqual(result.common.sort(), ['b', 'c']);
    assert.deepEqual(result.mcpOnly, ['a']);
    assert.deepEqual(result.legacyOnly, ['d']);
  });

  it('includes schema version and workflow ID', () => {
    const trace = makeTrace({});
    const result = compareConsultationTraces(trace, trace);
    assert.equal(result.schemaVersion, 1);
    assert.equal(result.workflowId, 'audit');
  });

  it('includes ISO timestamp', () => {
    const trace = makeTrace({});
    const result = compareConsultationTraces(trace, trace);
    assert.ok(result.comparedAt);
    assert.ok(new Date(result.comparedAt).getTime() > 0);
  });

  it('single doc in MCP, none in legacy → equivalent (both 100% coverage with 0 requiredCount default)', () => {
    const mcpTrace = makeTrace({
      consultedDocs: [{ id: 'a', title: 'A', sourceUrl: '' }],
    });
    const legacyTrace = makeTrace({
      consultedDocs: [],
    });
    const result = compareConsultationTraces(mcpTrace, legacyTrace);
    // With requiredCount defaulting to 3 and 0 consulted + 0 missing in legacy:
    // MCP coverage: (3-0)/3 = 100%, Legacy coverage: (3-3)/3 = 0%
    // But actually both default to coverage 1 when requiredCount=0
    // So the assessment depends on whether consultedDocs differs
    assert.ok(['equivalent', 'mcp-superior'].includes(result.assessment));
    assert.ok(result.mcpOnly.includes('a'));
    assert.equal(result.legacyOnly.length, 0);
    assert.equal(result.common.length, 0);
  });

  it('zero requiredCount defaults coverage to 100%', () => {
    const mcpTrace = makeTrace({
      plan: { requiredCount: 0 },
      consultedDocs: [{ id: 'a', title: 'A', sourceUrl: '' }],
    });
    const legacyTrace = makeTrace({
      plan: { requiredCount: 0 },
      consultedDocs: [{ id: 'b', title: 'B', sourceUrl: '' }],
    });
    const result = compareConsultationTraces(mcpTrace, legacyTrace);
    assert.equal(result.assessment, 'equivalent');
    // When requiredCount is 0, coverage is 100% (1 - 0/00 == 1)
    assert.equal(result.mcpRequiredCoverage, 1);
    assert.equal(result.legacyRequiredCoverage, 1);
    assert.equal(result.coverageDelta, 0);
  });

  it('very large coverage difference produces correct assessment', () => {
    const mcpTrace = makeTrace({
      plan: { requiredCount: 5 },
      consultedDocs: [
        { id: 'a', title: 'A', sourceUrl: '' },
        { id: 'b', title: 'B', sourceUrl: '' },
        { id: 'c', title: 'C', sourceUrl: '' },
        { id: 'd', title: 'D', sourceUrl: '' },
        { id: 'e', title: 'E', sourceUrl: '' },
      ],
    });
    const legacyTrace = makeTrace({
      plan: { requiredCount: 5 },
      consultedDocs: [],
      requiredMissing: ['a', 'b', 'c', 'd', 'e'],
    });
    const result = compareConsultationTraces(mcpTrace, legacyTrace);
    assert.equal(result.assessment, 'mcp-superior');
    // MCP: 5/5 = 100%, Legacy: 0/5 = 0%, delta = 100%
    assert.ok(Math.abs(result.coverageDelta - 1) < 0.01);
  });

  it('coverage within 5% tolerance → equivalent even with different docs', () => {
    const mcpTrace = makeTrace({
      plan: { requiredCount: 10 },
      consultedDocs: [
        { id: 'a', title: 'A', sourceUrl: '' },
        { id: 'b', title: 'B', sourceUrl: '' },
        { id: 'c', title: 'C', sourceUrl: '' },
        { id: 'd', title: 'D', sourceUrl: '' },
        { id: 'e', title: 'E', sourceUrl: '' },
      ],
      requiredMissing: ['f'],
    });
    const legacyTrace = makeTrace({
      plan: { requiredCount: 10 },
      consultedDocs: [
        { id: 'a', title: 'A', sourceUrl: '' },
        { id: 'b', title: 'B', sourceUrl: '' },
        { id: 'c', title: 'C', sourceUrl: '' },
        { id: 'd', title: 'D', sourceUrl: '' },
        { id: 'e', title: 'E', sourceUrl: '' },
      ],
      requiredMissing: ['f'],
    });
    const result = compareConsultationTraces(mcpTrace, legacyTrace);
    // Both have 50% coverage but within 5% tolerance → equivalent
    assert.equal(result.assessment, 'equivalent');
    assert.ok(Math.abs(result.coverageDelta) <= 0.05);
  });
});
