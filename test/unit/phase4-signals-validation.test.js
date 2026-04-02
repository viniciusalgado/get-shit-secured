/**
 * Phase 4 Validation — Signal Extraction Comprehensive Tests
 *
 * Validates all signal extraction functions across every workflow type,
 * classification correctness, normalization, purity, and edge cases.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  extractAuditSignals,
  extractSecurityReviewSignals,
  extractVerifySignals,
  extractThreatModelSignals,
  extractValidateFindingsSignals,
  extractPlanRemediationSignals,
  extractExecuteRemediationSignals,
  extractDefaultSignals,
} from '../../dist/core/consultation-signals.js';
import { normalizeStack } from '../../dist/core/stack-normalizer.js';
import { classifyFindings } from '../../dist/core/issue-taxonomy.js';

// =============================================================================
// 1. extractAuditSignals
// =============================================================================

describe('Phase 4 Validation — extractAuditSignals', () => {

  it('should extract stacks from map-codebase artifact', () => {
    const signals = extractAuditSignals({ stacks: ['Django', 'Python'] });
    assert.ok(signals.stacks.includes('django'));
    assert.ok(signals.stacks.includes('python'));
  });

  it('should extract issue tags from findings via second argument', () => {
    const signals = extractAuditSignals(
      { stacks: ['python'] },
      { findings: [{ category: 'SQL Injection' }, { type: 'XSS' }] },
    );
    assert.ok(signals.issueTags.length > 0);
    assert.ok(signals.issueTags.includes('sql-injection'));
    assert.ok(signals.issueTags.includes('xss'));
  });

  it('should return empty issueTags without findings artifact', () => {
    const signals = extractAuditSignals({ stacks: ['Django'] }, undefined);
    assert.deepEqual(signals.issueTags, []);
    assert.ok(signals.stacks.length > 0);
  });

  it('should handle null artifacts gracefully', () => {
    const signals = extractAuditSignals(null, null);
    assert.deepEqual(signals.issueTags, []);
    assert.deepEqual(signals.stacks, []);
    assert.deepEqual(signals.changedFiles, []);
  });

  it('should have empty changedFiles (full codebase audit)', () => {
    const signals = extractAuditSignals({ stacks: ['python'] });
    assert.deepEqual(signals.changedFiles, []);
  });

  it('should extract from technologies and languages fields too', () => {
    const signals = extractAuditSignals({ technologies: ['Node.js'], languages: ['TypeScript'] });
    assert.ok(signals.stacks.includes('nodejs'));
    assert.ok(signals.stacks.includes('javascript'));
  });
});

// =============================================================================
// 2. extractSecurityReviewSignals
// =============================================================================

describe('Phase 4 Validation — extractSecurityReviewSignals', () => {

  it('should extract all signal types from change scope', () => {
    const signals = extractSecurityReviewSignals({
      stacks: ['React'],
      findings: [{ category: 'XSS' }],
      changedFiles: ['src/auth/login.ts', 'src/api/users.ts'],
    });

    assert.ok(signals.stacks.length > 0);
    assert.ok(signals.issueTags.length > 0);
    assert.deepEqual(signals.changedFiles, ['src/auth/login.ts', 'src/api/users.ts']);
  });

  it('should handle empty change scope', () => {
    const signals = extractSecurityReviewSignals({});
    assert.deepEqual(signals.issueTags, []);
    assert.deepEqual(signals.stacks, []);
    assert.deepEqual(signals.changedFiles, []);
  });

  it('should handle null input', () => {
    const signals = extractSecurityReviewSignals(null);
    assert.deepEqual(signals.issueTags, []);
    assert.deepEqual(signals.stacks, []);
    assert.deepEqual(signals.changedFiles, []);
  });
});

// =============================================================================
// 3. extractVerifySignals
// =============================================================================

describe('Phase 4 Validation — extractVerifySignals', () => {

  it('should extract signals from patch plan and application report', () => {
    const signals = extractVerifySignals(
      { issueTags: ['sql-injection'], stacks: ['Node.js'] },
      { patchedFiles: ['src/db.ts'] },
    );
    assert.ok(signals.issueTags.length > 0);
    assert.ok(signals.stacks.length > 0);
    assert.deepEqual(signals.changedFiles, ['src/db.ts']);
  });

  it('should fall back to plan stacks when report has none', () => {
    const signals = extractVerifySignals(
      { technologies: ['Express'] },
      null,
    );
    assert.ok(signals.stacks.includes('express'));
  });

  it('should handle null inputs', () => {
    const signals = extractVerifySignals(null, null);
    assert.deepEqual(signals.issueTags, []);
    assert.deepEqual(signals.stacks, []);
    assert.deepEqual(signals.changedFiles, []);
  });

  it('should extract changedFiles from plan when report absent', () => {
    const signals = extractVerifySignals({ changedFiles: ['src/a.ts'] }, null);
    assert.deepEqual(signals.changedFiles, ['src/a.ts']);
  });
});

// =============================================================================
// 4. extractThreatModelSignals
// =============================================================================

describe('Phase 4 Validation — extractThreatModelSignals', () => {

  it('should extract stacks from map-codebase artifact', () => {
    const signals = extractThreatModelSignals({ stacks: ['Ruby', 'Docker'] });
    assert.ok(signals.stacks.includes('ruby'));
    assert.ok(signals.stacks.includes('docker'));
  });

  it('should return empty issue tags (threat modeling starts fresh)', () => {
    const signals = extractThreatModelSignals({ stacks: [] });
    assert.deepEqual(signals.issueTags, []);
    assert.deepEqual(signals.changedFiles, []);
  });

  it('should handle null input', () => {
    const signals = extractThreatModelSignals(null);
    assert.deepEqual(signals.stacks, []);
    assert.deepEqual(signals.issueTags, []);
  });
});

// =============================================================================
// 5. extractValidateFindingsSignals
// =============================================================================

describe('Phase 4 Validation — extractValidateFindingsSignals', () => {

  it('should extract issue tags and stacks', () => {
    const signals = extractValidateFindingsSignals(
      { categories: ['Cross-Site Scripting', 'SQL Injection'] },
      { stacks: ['django'] },
    );
    assert.ok(signals.issueTags.includes('xss'));
    assert.ok(signals.issueTags.includes('sql-injection'));
    assert.ok(signals.stacks.includes('django'));
  });

  it('should handle null findings artifact', () => {
    const signals = extractValidateFindingsSignals(null, { stacks: ['python'] });
    assert.deepEqual(signals.issueTags, []);
    assert.ok(signals.stacks.includes('python'));
  });

  it('should handle null map artifact', () => {
    const signals = extractValidateFindingsSignals(
      { findings: [{ category: 'XSS' }] },
      null,
    );
    assert.ok(signals.issueTags.length > 0);
    assert.deepEqual(signals.stacks, []);
  });

  it('should have no changedFiles', () => {
    const signals = extractValidateFindingsSignals({}, {});
    assert.deepEqual(signals.changedFiles, []);
  });
});

// =============================================================================
// 6. extractPlanRemediationSignals
// =============================================================================

describe('Phase 4 Validation — extractPlanRemediationSignals', () => {

  it('should extract signals from validated findings and map artifact', () => {
    const signals = extractPlanRemediationSignals(
      { findings: [{ category: 'XSS' }], targetFiles: ['src/views.py'] },
      { stacks: ['django'] },
    );
    assert.ok(signals.issueTags.length > 0);
    assert.deepEqual(signals.changedFiles, ['src/views.py']);
    assert.ok(signals.stacks.includes('django'));
  });

  it('should handle null inputs', () => {
    const signals = extractPlanRemediationSignals(null, null);
    assert.deepEqual(signals.issueTags, []);
    assert.deepEqual(signals.stacks, []);
    assert.deepEqual(signals.changedFiles, []);
  });
});

// =============================================================================
// 7. extractExecuteRemediationSignals
// =============================================================================

describe('Phase 4 Validation — extractExecuteRemediationSignals', () => {

  it('should extract signals from patch plan', () => {
    const signals = extractExecuteRemediationSignals({
      issueTags: ['sql-injection'],
      technologies: ['Django'],
      changedFiles: ['src/middleware.py'],
    });
    assert.ok(signals.issueTags.length > 0);
    assert.ok(signals.stacks.includes('django'));
    assert.deepEqual(signals.changedFiles, ['src/middleware.py']);
  });

  it('should fall back to plan stacks when map artifact has none', () => {
    const signals = extractExecuteRemediationSignals(
      { technologies: ['Node.js'] },
      null,
    );
    assert.ok(signals.stacks.includes('nodejs'));
  });

  it('should handle null inputs', () => {
    const signals = extractExecuteRemediationSignals(null, null);
    assert.deepEqual(signals.issueTags, []);
    assert.deepEqual(signals.stacks, []);
    assert.deepEqual(signals.changedFiles, []);
  });
});

// =============================================================================
// 8. extractDefaultSignals
// =============================================================================

describe('Phase 4 Validation — extractDefaultSignals', () => {

  it('should return empty signals for report workflow', () => {
    const signals = extractDefaultSignals('report');
    assert.deepEqual(signals.issueTags, []);
    assert.deepEqual(signals.stacks, []);
    assert.deepEqual(signals.changedFiles, []);
  });

  it('should return empty signals for map-codebase', () => {
    const signals = extractDefaultSignals('map-codebase');
    assert.deepEqual(signals.issueTags, []);
    assert.deepEqual(signals.stacks, []);
    assert.deepEqual(signals.changedFiles, []);
  });
});

// =============================================================================
// 9. Stack Normalization
// =============================================================================

describe('Phase 4 Validation — Stack Normalization', () => {

  it('should normalize common stack names to canonical tags', () => {
    const result = normalizeStack(['Django', 'PYTHON', 'PostgreSQL']);
    assert.ok(result.canonical.includes('django'));
    assert.ok(result.canonical.includes('python'));
    assert.ok(result.canonical.includes('sql'));
  });

  it('should preserve raw values in output', () => {
    const result = normalizeStack(['Node.js', 'React']);
    assert.deepEqual(result.raw, ['Node.js', 'React']);
  });

  it('should deduplicate canonical tags', () => {
    const result = normalizeStack(['node.js', 'nodejs', 'Node']);
    // All three map to 'nodejs'
    assert.equal(result.canonical.filter(s => s === 'nodejs').length, 1);
  });

  it('should sort canonical tags alphabetically', () => {
    const result = normalizeStack(['Docker', 'AWS', 'React']);
    const sorted = [...result.canonical].sort();
    assert.deepEqual(result.canonical, sorted);
  });

  it('should pass through unknown signals lowercased', () => {
    const result = normalizeStack(['Rust', 'COBOL']);
    assert.ok(result.canonical.includes('rust'));
    assert.ok(result.canonical.includes('cobol'));
  });

  it('should skip empty strings', () => {
    const result = normalizeStack(['', '  ', 'python']);
    assert.ok(!result.canonical.includes(''));
    assert.ok(!result.canonical.includes('  '));
    assert.ok(result.canonical.includes('python'));
  });

  it('should handle empty input array', () => {
    const result = normalizeStack([]);
    assert.deepEqual(result.canonical, []);
    assert.deepEqual(result.raw, []);
  });
});

// =============================================================================
// 10. Issue Taxonomy Classification
// =============================================================================

describe('Phase 4 Validation — Issue Taxonomy Classification', () => {

  it('should classify SQL Injection to canonical tags', () => {
    const result = classifyFindings(['SQL Injection']);
    assert.ok(result.tags.includes('sql-injection'));
    assert.ok(result.tags.includes('injection'));
  });

  it('should classify XSS variants', () => {
    const result = classifyFindings(['DOM XSS', 'Reflected XSS']);
    assert.ok(result.tags.includes('xss'));
    assert.ok(result.tags.includes('dom-xss'));
  });

  it('should classify CSRF', () => {
    const result = classifyFindings(['Cross-Site Request Forgery']);
    assert.ok(result.tags.includes('csrf'));
  });

  it('should deduplicate tags', () => {
    const result = classifyFindings(['SQL Injection', 'sqli']);
    const sqlInjectionCount = result.tags.filter(t => t === 'sql-injection').length;
    assert.equal(sqlInjectionCount, 1);
  });

  it('should sort tags alphabetically', () => {
    const result = classifyFindings(['XSS', 'SQL Injection']);
    const sorted = [...result.tags].sort();
    assert.deepEqual(result.tags, sorted);
  });

  it('should preserve raw inputs', () => {
    const result = classifyFindings(['SQL Injection', 'XSS']);
    assert.deepEqual(result.raw, ['SQL Injection', 'XSS']);
  });

  it('should handle empty input', () => {
    const result = classifyFindings([]);
    assert.deepEqual(result.tags, []);
    assert.deepEqual(result.raw, []);
  });

  it('should classify OWASP Top 10 category codes', () => {
    const result = classifyFindings(['a03:2021']);
    assert.ok(result.tags.includes('injection'));
    assert.ok(result.tags.includes('sql-injection'));
  });

  it('should classify via partial matching for unknown inputs', () => {
    const result = classifyFindings(['some sql injection variant']);
    // Should match because "sql injection" is contained in the input
    assert.ok(result.tags.includes('sql-injection'));
  });
});

// =============================================================================
// 11. Signal Extraction Purity
// =============================================================================

describe('Phase 4 Validation — Signal Extraction Purity', () => {

  it('should not mutate input objects', () => {
    const input = { stacks: ['Django'], findings: [{ category: 'SQL Injection' }] };
    const frozen = JSON.parse(JSON.stringify(input));

    extractAuditSignals(input);
    extractAuditSignals(input);

    assert.deepEqual(input, frozen);
  });

  it('should produce same output for same input (all extractors)', () => {
    const inputs = [
      () => extractAuditSignals({ stacks: ['python'] }, { findings: [{ category: 'XSS' }] }),
      () => extractSecurityReviewSignals({ stacks: ['django'], changedFiles: ['a.ts'] }),
      () => extractVerifySignals({ issueTags: ['sql-injection'] }, { patchedFiles: ['b.ts'] }),
      () => extractThreatModelSignals({ stacks: ['ruby'] }),
      () => extractDefaultSignals('report'),
    ];

    for (const fn of inputs) {
      assert.deepEqual(fn(), fn());
    }
  });
});
