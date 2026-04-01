/**
 * Unit tests for consultation signal extraction (Phase 4).
 *
 * Covers spec sections 5.1–5.12.
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

describe('Consultation Signal Extraction', () => {

  // 5.1 — extractAuditSignals produces correct ConsultationSignals
  describe('extractAuditSignals (5.1)', () => {
    it('should extract stacks and issue tags from artifacts', () => {
      const mapArtifact = {
        stacks: ['Django', 'Python'],
        technologies: ['PostgreSQL'],
        findings: { categories: ['SQL Injection', 'Cross-Site Scripting'] },
      };

      const signals = extractAuditSignals(mapArtifact);

      assert.ok(signals.stacks.includes('django'), 'Expected normalized "django"');
      assert.ok(signals.stacks.includes('python'), 'Expected normalized "python"');
      assert.deepEqual(signals.changedFiles, [], 'Audit signals should have no changed files');
    });

    it('should extract issue tags from findings via second argument', () => {
      const mapArtifact = { stacks: ['python'] };
      const findingsArtifact = {
        findings: [
          { category: 'SQL Injection' },
          { type: 'XSS' },
        ],
      };

      const signals = extractAuditSignals(mapArtifact, findingsArtifact);

      assert.ok(signals.issueTags.length > 0, 'Expected issue tags from findings');
    });
  });

  // 5.2 — extractAuditSignals without findings artifact (first pass)
  describe('extractAuditSignals without findings (5.2)', () => {
    it('should return empty issueTags when findingsArtifact is undefined', () => {
      const mapArtifact = { stacks: ['Django'] };

      const signals = extractAuditSignals(mapArtifact, undefined);

      assert.deepEqual(signals.issueTags, [], 'Expected empty issueTags without findings');
      assert.ok(signals.stacks.length > 0, 'Expected stacks from map artifact');
    });

    it('should handle null artifacts gracefully', () => {
      const signals = extractAuditSignals(null, null);

      assert.deepEqual(signals.issueTags, []);
      assert.deepEqual(signals.stacks, []);
      assert.deepEqual(signals.changedFiles, []);
    });
  });

  // 5.3 — extractSecurityReviewSignals from change scope
  describe('extractSecurityReviewSignals (5.3)', () => {
    it('should extract signals from change scope', () => {
      const changeScope = {
        stacks: ['React'],
        findings: [{ category: 'XSS' }],
        changedFiles: ['src/auth/login.ts', 'src/api/users.ts'],
      };

      const signals = extractSecurityReviewSignals(changeScope);

      assert.ok(signals.stacks.length > 0, 'Expected stacks');
      assert.ok(signals.issueTags.length > 0, 'Expected issue tags');
      assert.deepEqual(signals.changedFiles, ['src/auth/login.ts', 'src/api/users.ts']);
    });

    it('should handle empty change scope', () => {
      const signals = extractSecurityReviewSignals({});

      assert.deepEqual(signals.issueTags, []);
      assert.deepEqual(signals.stacks, []);
      assert.deepEqual(signals.changedFiles, []);
    });
  });

  // 5.4 — extractVerifySignals from patch plan and application report
  describe('extractVerifySignals (5.4)', () => {
    it('should extract signals from patch plan and application report', () => {
      const patchPlan = {
        issueTags: ['sql-injection'],
        stacks: ['Node.js'],
      };
      const applicationReport = {
        patchedFiles: ['src/db.ts'],
      };

      const signals = extractVerifySignals(patchPlan, applicationReport);

      assert.ok(signals.issueTags.length > 0, 'Expected issue tags');
      assert.ok(signals.stacks.length > 0, 'Expected stacks');
      assert.deepEqual(signals.changedFiles, ['src/db.ts'], 'Expected changed files from report');
    });

    it('should fall back to plan stacks when report has none', () => {
      const patchPlan = { technologies: ['Express'] };
      const signals = extractVerifySignals(patchPlan, null);

      assert.ok(signals.stacks.includes('express'));
    });

    it('should handle null inputs', () => {
      const signals = extractVerifySignals(null, null);

      assert.deepEqual(signals.issueTags, []);
      assert.deepEqual(signals.stacks, []);
      assert.deepEqual(signals.changedFiles, []);
    });
  });

  // 5.5 — extractThreatModelSignals from map-codebase artifact
  describe('extractThreatModelSignals (5.5)', () => {
    it('should extract stacks from map-codebase artifact', () => {
      const mapArtifact = { stacks: ['Ruby', 'Docker'] };

      const signals = extractThreatModelSignals(mapArtifact);

      assert.ok(signals.stacks.includes('ruby'), 'Expected normalized "ruby"');
      assert.ok(signals.stacks.includes('docker'), 'Expected normalized "docker"');
    });

    it('should return empty issue tags (threat modeling starts fresh)', () => {
      const signals = extractThreatModelSignals({ stacks: [] });

      assert.deepEqual(signals.issueTags, []);
      assert.deepEqual(signals.changedFiles, []);
    });
  });

  // 5.6 — extractDefaultSignals returns empty signals
  describe('extractDefaultSignals (5.6)', () => {
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

  // 5.7 — Signal extraction functions are pure
  describe('Signal extraction purity (5.7)', () => {
    it('should not mutate input objects', () => {
      const input = {
        stacks: ['Django'],
        findings: [{ category: 'SQL Injection' }],
      };
      const frozen = JSON.parse(JSON.stringify(input));

      extractAuditSignals(input);
      extractAuditSignals(input);

      assert.deepEqual(input, frozen, 'Input should not be mutated');
    });

    it('should produce same output for same input', () => {
      const input = { stacks: ['python'], findings: [{ category: 'XSS' }] };

      const s1 = extractAuditSignals(input);
      const s2 = extractAuditSignals(input);

      assert.deepEqual(s1, s2, 'Same input should produce same output');
    });
  });

  // 5.8 — Stack signals are normalized
  describe('Stack signal normalization (5.8)', () => {
    it('should normalize stack signals via normalizeStack()', () => {
      const signals = extractAuditSignals({
        stacks: ['Django', 'PYTHON', 'PostgreSQL'],
      });

      assert.ok(signals.stacks.includes('django'), 'Expected lowercase "django"');
      assert.ok(signals.stacks.includes('python'), 'Expected lowercase "python"');
      // Verify no raw uppercase values leaked through
      assert.ok(!signals.stacks.includes('Django'), 'Should not contain raw "Django"');
      assert.ok(!signals.stacks.includes('PYTHON'), 'Should not contain raw "PYTHON"');
    });
  });

  // 5.9 — Issue tags are classified via classifyFindings()
  describe('Issue tag classification (5.9)', () => {
    it('should classify raw categories to canonical tags', () => {
      const signals = extractAuditSignals(
        { stacks: [] },
        { categories: ['SQL Injection'] },
      );

      assert.ok(signals.issueTags.includes('sql-injection'),
        'Expected canonical "sql-injection" tag');
    });
  });

  // 5.10 — extractPlanRemediationSignals from validated findings
  describe('extractPlanRemediationSignals (5.10)', () => {
    it('should extract signals from validated findings and map artifact', () => {
      const findings = {
        findings: [{ category: 'XSS' }],
        targetFiles: ['src/views.py'],
      };
      const mapArtifact = { stacks: ['django'] };

      const signals = extractPlanRemediationSignals(findings, mapArtifact);

      assert.ok(signals.issueTags.length > 0, 'Expected issue tags');
      assert.deepEqual(signals.changedFiles, ['src/views.py'], 'Expected changed files');
      assert.ok(signals.stacks.includes('django'), 'Expected stacks');
    });
  });

  // 5.11 — extractExecuteRemediationSignals from patch plan
  describe('extractExecuteRemediationSignals (5.11)', () => {
    it('should extract signals from patch plan', () => {
      const patchPlan = {
        issueTags: ['sql-injection'],
        technologies: ['Django'],
        changedFiles: ['src/middleware.py'],
      };

      const signals = extractExecuteRemediationSignals(patchPlan);

      assert.ok(signals.issueTags.length > 0, 'Expected issue tags');
      assert.ok(signals.stacks.includes('django'), 'Expected stacks');
      assert.deepEqual(signals.changedFiles, ['src/middleware.py'], 'Expected changed files');
    });
  });

  // 5.12 — extractValidateFindingsSignals from findings artifact
  describe('extractValidateFindingsSignals (5.12)', () => {
    it('should extract issue tags and stacks from findings + map artifact', () => {
      const findings = {
        categories: ['Cross-Site Scripting', 'SQL Injection'],
      };
      const mapArtifact = { stacks: ['django'] };

      const signals = extractValidateFindingsSignals(findings, mapArtifact);

      assert.ok(signals.issueTags.includes('xss'), 'Expected "xss" tag');
      assert.ok(signals.issueTags.includes('sql-injection'), 'Expected "sql-injection" tag');
      assert.ok(signals.stacks.includes('django'), 'Expected "django" stack');
    });
  });
});
