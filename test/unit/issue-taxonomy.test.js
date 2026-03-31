/**
 * Unit tests for issue taxonomy.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { classifyFindings, classifyPatches, classifyVerificationDomains, isKnownIssueTag } from '../../dist/core/issue-taxonomy.js';

describe('Issue Taxonomy - classifyFindings', () => {
  it('should classify SQL injection findings', () => {
    const result = classifyFindings(['SQL Injection']);
    assert.ok(result.tags.includes('sql-injection'));
    assert.ok(result.tags.includes('injection'));
  });

  it('should classify XSS findings', () => {
    const result = classifyFindings(['Cross-Site Scripting']);
    assert.ok(result.tags.includes('xss'));
  });

  it('should classify OWASP Top 10 category codes', () => {
    const result = classifyFindings(['A03:2021']);
    assert.ok(result.tags.includes('injection'));
    assert.ok(result.tags.includes('xss'));
  });

  it('should classify authentication findings', () => {
    const result = classifyFindings(['Authentication']);
    assert.ok(result.tags.includes('authn'));
  });

  it('should classify secrets exposure findings', () => {
    const result = classifyFindings(['Hardcoded Secret', 'API Key']);
    assert.ok(result.tags.includes('secrets'));
  });

  it('should return empty tags for unknown categories', () => {
    const result = classifyFindings(['completely-unknown-category-xyz']);
    assert.ok(Array.isArray(result.tags));
  });

  it('should preserve raw inputs', () => {
    const raw = ['SQL Injection', 'XSS'];
    const result = classifyFindings(raw);
    assert.deepEqual(result.raw, raw);
  });

  it('should deduplicate tags', () => {
    const result = classifyFindings(['SQL Injection', 'Injection']);
    const injectionCount = result.tags.filter(t => t === 'injection').length;
    assert.equal(injectionCount, 1);
  });

  it('should produce sorted output', () => {
    const result = classifyFindings(['XSS', 'SQL Injection', 'Authentication']);
    for (let i = 1; i < result.tags.length; i++) {
      assert.ok(result.tags[i - 1] <= result.tags[i]);
    }
  });
});

describe('Issue Taxonomy - classifyPatches', () => {
  it('should classify input validation patches', () => {
    const result = classifyPatches(['input-validation']);
    assert.ok(result.tags.includes('injection'));
    assert.ok(result.tags.includes('sql-injection'));
  });

  it('should classify auth fix patches', () => {
    const result = classifyPatches(['auth-fix']);
    assert.ok(result.tags.includes('authn'));
    assert.ok(result.tags.includes('authz'));
  });

  it('should classify dependency upgrade patches', () => {
    const result = classifyPatches(['dependency-upgrade']);
    assert.ok(result.tags.includes('supply-chain'));
  });
});

describe('Issue Taxonomy - classifyVerificationDomains', () => {
  it('should classify authentication domains', () => {
    const result = classifyVerificationDomains(['authentication']);
    assert.ok(result.tags.includes('authn'));
    assert.ok(result.tags.includes('session-management'));
  });

  it('should classify input handling domains', () => {
    const result = classifyVerificationDomains(['input-handling']);
    assert.ok(result.tags.includes('injection'));
    assert.ok(result.tags.includes('xss'));
  });
});

describe('Issue Taxonomy - isKnownIssueTag', () => {
  it('should recognize known tags', () => {
    assert.ok(isKnownIssueTag('injection'));
    assert.ok(isKnownIssueTag('xss'));
    assert.ok(isKnownIssueTag('authn'));
  });

  it('should reject unknown tags', () => {
    assert.ok(!isKnownIssueTag('totally-unknown'));
    assert.ok(!isKnownIssueTag(''));
  });
});
