/**
 * Phase 12 — Unit Tests: Trace Summary Formatter
 *
 * Tests formatTraceSummary() and formatTraceOneLiner().
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  formatTraceSummary,
  formatTraceOneLiner,
} from '../../../dist/runtime/trace-summary-formatter.js';

function makeTrace(overrides = {}) {
  return {
    plan: {
      workflowId: 'audit',
      generatedAt: '2026-04-02T12:00:00Z',
      corpusVersion: '2026-03-31',
      requiredCount: 3,
      optionalCount: 2,
      followupCount: 1,
    },
    consultedDocs: [
      { id: 'sql-injection-prevention', title: 'SQL Injection Prevention', sourceUrl: 'https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html' },
      { id: 'input-validation', title: 'Input Validation', sourceUrl: 'https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html' },
      { id: 'xss-prevention', title: 'XSS Prevention', sourceUrl: 'https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html' },
    ],
    coverageStatus: 'pass',
    requiredMissing: [],
    notes: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// formatTraceSummary
// ---------------------------------------------------------------------------
describe('formatTraceSummary()', () => {

  it('should format pass case correctly', () => {
    const trace = makeTrace();
    const summary = formatTraceSummary(trace);

    assert.ok(summary.includes('Required docs consulted: 3/3'), `Expected required count, got: ${summary}`);
    assert.ok(summary.includes('Coverage status: pass'), `Expected pass status, got: ${summary}`);
    assert.ok(summary.includes('Missing required docs: none'), `Expected none missing, got: ${summary}`);
  });

  it('should format fail case with missing docs', () => {
    const trace = makeTrace({
      coverageStatus: 'fail',
      consultedDocs: [{ id: 'sql-injection-prevention', title: 'SQL Injection Prevention', sourceUrl: 'https://...' }],
      requiredMissing: ['input-validation', 'xss-prevention'],
    });
    const summary = formatTraceSummary(trace);

    assert.ok(summary.includes('Required docs consulted: 1/3'), `Expected 1/3 consulted, got: ${summary}`);
    assert.ok(summary.includes('Coverage status: fail'), `Expected fail status, got: ${summary}`);
    assert.ok(summary.includes('input-validation'), `Expected missing doc listed, got: ${summary}`);
    assert.ok(summary.includes('xss-prevention'), `Expected missing doc listed, got: ${summary}`);
  });

  it('should include notes when present', () => {
    const trace = makeTrace({ notes: ['Optional doc skipped due to time budget'] });
    const summary = formatTraceSummary(trace);

    assert.ok(summary.includes('Notes:'), `Expected Notes section, got: ${summary}`);
    assert.ok(summary.includes('Optional doc skipped'), `Expected note content, got: ${summary}`);
  });

  it('should not include notes section when empty', () => {
    const trace = makeTrace();
    const summary = formatTraceSummary(trace);

    assert.ok(!summary.includes('Notes:'), `Expected no Notes section, got: ${summary}`);
  });

});

// ---------------------------------------------------------------------------
// formatTraceOneLiner
// ---------------------------------------------------------------------------
describe('formatTraceOneLiner()', () => {

  it('should produce compact single-line output for pass', () => {
    const trace = makeTrace();
    const oneLiner = formatTraceOneLiner(trace);

    assert.ok(oneLiner.includes('Coverage: pass'), `Expected coverage status, got: ${oneLiner}`);
    assert.ok(oneLiner.includes('3/3 required'), `Expected required count, got: ${oneLiner}`);
    assert.ok(!oneLiner.includes('\n'), `Expected single line, got: ${oneLiner}`);
  });

  it('should produce compact output for partial coverage', () => {
    const trace = makeTrace({
      coverageStatus: 'warn',
      consultedDocs: [{ id: 'sql-injection-prevention', title: 'SQL', sourceUrl: 'https://...' }],
      requiredMissing: ['input-validation', 'xss-prevention'],
    });
    const oneLiner = formatTraceOneLiner(trace);

    assert.ok(oneLiner.includes('Coverage: warn'), `Expected warn, got: ${oneLiner}`);
    assert.ok(oneLiner.includes('1/3 required'), `Expected 1/3, got: ${oneLiner}`);
  });

  // --- Gap-fill scenarios ---

  it('should handle zero required docs (0/0)', () => {
    const trace = makeTrace({
      plan: { ...makeTrace().plan, requiredCount: 0, optionalCount: 0, followupCount: 0 },
      consultedDocs: [],
      requiredMissing: [],
    });
    const summary = formatTraceSummary(trace);

    assert.ok(summary.includes('Required docs consulted: 0/0'), `Expected 0/0, got: ${summary}`);
    assert.ok(summary.includes('Coverage status: pass'), `Expected pass, got: ${summary}`);
  });

  it('should list all missing doc names in fail case', () => {
    const trace = makeTrace({
      coverageStatus: 'fail',
      consultedDocs: [],
      requiredMissing: ['input-validation', 'xss-prevention', 'auth-cheatsheet'],
    });
    const summary = formatTraceSummary(trace);

    assert.ok(summary.includes('input-validation'), `Expected input-validation, got: ${summary}`);
    assert.ok(summary.includes('xss-prevention'), `Expected xss-prevention, got: ${summary}`);
    assert.ok(summary.includes('auth-cheatsheet'), `Expected auth-cheatsheet, got: ${summary}`);
  });

  it('should handle all optional docs consulted with zero required', () => {
    const trace = makeTrace({
      plan: { ...makeTrace().plan, requiredCount: 0, optionalCount: 2, followupCount: 0 },
      consultedDocs: [
        { id: 'doc-a', title: 'A', sourceUrl: 'https://...' },
        { id: 'doc-b', title: 'B', sourceUrl: 'https://...' },
      ],
      requiredMissing: [],
    });
    const summary = formatTraceSummary(trace);

    assert.ok(summary.includes('Required docs consulted: 0/0'), `Expected 0/0 required, got: ${summary}`);
    assert.ok(summary.includes('Coverage status: pass'), `Expected pass, got: ${summary}`);
  });

  it('should include missing context in one-liner for warn status', () => {
    const trace = makeTrace({
      coverageStatus: 'warn',
      consultedDocs: [{ id: 'sql-injection-prevention', title: 'SQL', sourceUrl: 'https://...' }],
      requiredMissing: ['input-validation', 'xss-prevention'],
    });
    const oneLiner = formatTraceOneLiner(trace);

    assert.ok(oneLiner.includes('Coverage: warn'), `Expected warn, got: ${oneLiner}`);
    assert.ok(oneLiner.includes('1/3 required'), `Expected 1/3, got: ${oneLiner}`);
  });

});
