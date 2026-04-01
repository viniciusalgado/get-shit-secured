/**
 * Unit tests for consultation signal extraction (Phase 4).
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
  describe('extractAuditSignals', () => {
    it('should extract stacks from map-codebase artifact', () => {
      const mapArtifact = {
        stacks: ['Django', 'Python'],
        technologies: ['PostgreSQL'],
      };

      const signals = extractAuditSignals(mapArtifact);

      assert.ok(signals.stacks.includes('django'), 'Expected normalized "django"');
      assert.ok(signals.stacks.includes('python'), 'Expected normalized "python"');
      // PostgreSQL normalizes to 'sql' per STACK_ALIASES
      assert.ok(signals.stacks.includes('sql'), 'Expected normalized "sql" (from PostgreSQL)');
    });

    it('should extract issue tags from findings artifact', () => {
      const mapArtifact = { stacks: [] };
      const findingsArtifact = {
        findings: [
          { category: 'SQL Injection' },
          { type: 'XSS' },
        ],
      };

      const signals = extractAuditSignals(mapArtifact, findingsArtifact);

      assert.ok(signals.issueTags.length > 0,
        'Expected issue tags from findings');
    });

    it('should return empty changedFiles for full audit', () => {
      const signals = extractAuditSignals({ stacks: [] });
      assert.deepEqual(signals.changedFiles, []);
    });

    it('should handle null artifacts gracefully', () => {
      const signals = extractAuditSignals(null, null);

      assert.deepEqual(signals.issueTags, []);
      assert.deepEqual(signals.stacks, []);
      assert.deepEqual(signals.changedFiles, []);
    });
  });

  describe('extractSecurityReviewSignals', () => {
    it('should extract signals from change scope', () => {
      const changeScope = {
        stacks: ['React'],
        findings: [{ category: 'XSS' }],
        changedFiles: ['src/App.tsx', 'src/utils.ts'],
      };

      const signals = extractSecurityReviewSignals(changeScope);

      assert.ok(signals.stacks.length > 0);
      assert.ok(signals.issueTags.length > 0);
      assert.deepEqual(signals.changedFiles, ['src/App.tsx', 'src/utils.ts']);
    });

    it('should handle empty change scope', () => {
      const signals = extractSecurityReviewSignals({});

      assert.deepEqual(signals.issueTags, []);
      assert.deepEqual(signals.stacks, []);
      assert.deepEqual(signals.changedFiles, []);
    });
  });

  describe('extractVerifySignals', () => {
    it('should extract signals from patch plan and application report', () => {
      const patchPlan = {
        issueTags: ['sql-injection'],
        stacks: ['Node.js'],
      };
      const applicationReport = {
        patchedFiles: ['src/db.ts'],
      };

      const signals = extractVerifySignals(patchPlan, applicationReport);

      assert.ok(signals.issueTags.length > 0);
      assert.ok(signals.stacks.length > 0);
      assert.deepEqual(signals.changedFiles, ['src/db.ts']);
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

  describe('extractThreatModelSignals', () => {
    it('should extract stacks from map-codebase artifact', () => {
      const mapArtifact = { stacks: ['Ruby', 'Docker'] };

      const signals = extractThreatModelSignals(mapArtifact);

      assert.ok(signals.stacks.includes('ruby'), 'Expected normalized "ruby"');
      assert.ok(signals.stacks.includes('docker'), 'Expected normalized "docker"');
    });

    it('should return empty issue tags (threat modeling starts fresh)', () => {
      const signals = extractThreatModelSignals({ stacks: [] });
      assert.deepEqual(signals.issueTags, []);
    });
  });

  describe('extractValidateFindingsSignals', () => {
    it('should extract issue tags from findings', () => {
      const findings = {
        findings: [{ category: 'Injection' }],
      };

      const signals = extractValidateFindingsSignals(findings);

      assert.ok(signals.issueTags.length > 0);
    });

    it('should extract stacks from map artifact when provided', () => {
      const findings = { findings: [] };
      const mapArtifact = { stacks: ['Flask'] };

      const signals = extractValidateFindingsSignals(findings, mapArtifact);

      // Flask normalizes to 'python' per STACK_ALIASES
      assert.ok(signals.stacks.includes('python'), 'Expected normalized "python" (from Flask)');
    });
  });

  describe('extractPlanRemediationSignals', () => {
    it('should extract issue tags and changed files from findings', () => {
      const findings = {
        findings: [{ category: 'XSS' }],
        targetFiles: ['src/sanitize.ts'],
      };

      const signals = extractPlanRemediationSignals(findings);

      assert.ok(signals.issueTags.length > 0);
      assert.deepEqual(signals.changedFiles, ['src/sanitize.ts']);
    });
  });

  describe('extractExecuteRemediationSignals', () => {
    it('should extract signals from patch plan', () => {
      const patchPlan = {
        issueTags: ['csrf'],
        technologies: ['Django'],
        changedFiles: ['src/middleware.py'],
      };

      const signals = extractExecuteRemediationSignals(patchPlan);

      assert.ok(signals.issueTags.length > 0);
      assert.ok(signals.stacks.includes('django'));
      assert.deepEqual(signals.changedFiles, ['src/middleware.py']);
    });
  });

  describe('extractDefaultSignals', () => {
    it('should return empty signals for any workflow', () => {
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
});
