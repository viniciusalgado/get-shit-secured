/**
 * Phase 8 — Unit Tests: Artifact Validator
 *
 * Validates ARTIFACT_VALIDATION_RULES completeness and
 * validateArtifact() function for all 9 workflow types.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  ARTIFACT_VALIDATION_RULES,
  validateArtifact,
} from '../../../dist/hooks/artifact-validator.js';

const ALL_WORKFLOW_IDS = [
  'audit', 'verify', 'plan-remediation', 'execute-remediation',
  'security-review', 'validate-findings', 'threat-model', 'map-codebase', 'report',
];

const CONSULTATION_WORKFLOWS = [
  'audit', 'verify', 'plan-remediation', 'execute-remediation',
  'security-review', 'validate-findings',
];

const NON_CONSULTATION_WORKFLOWS = ['threat-model', 'map-codebase', 'report'];

function makeValidConsultation(coverageStatus = 'pass', overrides = {}) {
  return {
    plan: { requiredDocs: [], optionalDocs: [] },
    validation: {
      coverageStatus,
      requiredMissing: coverageStatus === 'fail' ? ['doc-1'] : [],
      ...overrides,
    },
    consultedDocs: ['security://owasp/cheatsheet/test'],
  };
}

// ---------------------------------------------------------------------------
// ARTIFACT_VALIDATION_RULES — Completeness
// ---------------------------------------------------------------------------
describe('ARTIFACT_VALIDATION_RULES — Completeness', () => {

  it('should have entries for all 9 workflow IDs', () => {
    const keys = Object.keys(ARTIFACT_VALIDATION_RULES);
    for (const id of ALL_WORKFLOW_IDS) {
      assert.ok(keys.includes(id), `Missing rule for workflow '${id}'`);
    }
    assert.strictEqual(keys.length, 9, 'Should have exactly 9 workflow rules');
  });

  it('each rule should have workflowId matching its key', () => {
    for (const [key, rule] of Object.entries(ARTIFACT_VALIDATION_RULES)) {
      assert.strictEqual(rule.workflowId, key,
        `Rule key '${key}' should match workflowId '${rule.workflowId}'`);
    }
  });

  it('each rule should have non-empty requiredFields array', () => {
    for (const [id, rule] of Object.entries(ARTIFACT_VALIDATION_RULES)) {
      assert.ok(Array.isArray(rule.requiredFields), `${id}: requiredFields should be array`);
      assert.ok(rule.requiredFields.length > 0, `${id}: requiredFields should not be empty`);
    }
  });

  it('each rule should have boolean requiresConsultationTrace', () => {
    for (const [id, rule] of Object.entries(ARTIFACT_VALIDATION_RULES)) {
      assert.strictEqual(typeof rule.requiresConsultationTrace, 'boolean',
        `${id}: requiresConsultationTrace should be boolean`);
    }
  });

  it('each rule should have boolean requiresCoverageStatus', () => {
    for (const [id, rule] of Object.entries(ARTIFACT_VALIDATION_RULES)) {
      assert.strictEqual(typeof rule.requiresCoverageStatus, 'boolean',
        `${id}: requiresCoverageStatus should be boolean`);
    }
  });

  it('each rule should have consultationFields array', () => {
    for (const [id, rule] of Object.entries(ARTIFACT_VALIDATION_RULES)) {
      assert.ok(Array.isArray(rule.consultationFields),
        `${id}: consultationFields should be array`);
    }
  });

  it('consultation-requiring workflows should list consultation in requiredFields', () => {
    for (const id of CONSULTATION_WORKFLOWS) {
      const rule = ARTIFACT_VALIDATION_RULES[id];
      assert.ok(rule.requiredFields.includes('consultation'),
        `${id}: should include 'consultation' in requiredFields`);
    }
  });

  it('non-consultation workflows should NOT list consultation in requiredFields', () => {
    for (const id of NON_CONSULTATION_WORKFLOWS) {
      const rule = ARTIFACT_VALIDATION_RULES[id];
      assert.ok(!rule.requiredFields.includes('consultation'),
        `${id}: should NOT include 'consultation' in requiredFields`);
    }
  });

  it('non-consultation workflows should have requiresConsultationTrace: false', () => {
    for (const id of NON_CONSULTATION_WORKFLOWS) {
      const rule = ARTIFACT_VALIDATION_RULES[id];
      assert.strictEqual(rule.requiresConsultationTrace, false,
        `${id}: should have requiresConsultationTrace: false`);
    }
  });

  it('consultation-requiring workflows should have requiresConsultationTrace: true', () => {
    for (const id of CONSULTATION_WORKFLOWS) {
      const rule = ARTIFACT_VALIDATION_RULES[id];
      assert.strictEqual(rule.requiresConsultationTrace, true,
        `${id}: should have requiresConsultationTrace: true`);
    }
  });

});

// ---------------------------------------------------------------------------
// validateArtifact() — Valid artifacts
// ---------------------------------------------------------------------------
describe('validateArtifact() — Valid artifacts', () => {

  it('valid audit artifact should pass', () => {
    const artifact = {
      findings: [],
      consultation: makeValidConsultation('pass'),
    };
    const result = validateArtifact(artifact, 'audit');
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.errors.length, 0);
    assert.strictEqual(result.coverageStatus, 'pass');
  });

  it('valid verify artifact should pass', () => {
    const artifact = {
      verdicts: [],
      consultation: makeValidConsultation('pass'),
    };
    const result = validateArtifact(artifact, 'verify');
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.errors.length, 0);
    assert.strictEqual(result.coverageStatus, 'pass');
  });

  it('valid plan-remediation artifact should pass', () => {
    const artifact = {
      patches: [],
      consultation: makeValidConsultation('pass'),
    };
    const result = validateArtifact(artifact, 'plan-remediation');
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.errors.length, 0);
  });

  it('valid map-codebase artifact should pass (no consultation)', () => {
    const artifact = {
      components: [],
      dependencies: [],
      dataFlows: [],
    };
    const result = validateArtifact(artifact, 'map-codebase');
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.errors.length, 0);
    assert.strictEqual(result.coverageStatus, 'not-applicable');
  });

  it('valid threat-model artifact should pass (no consultation)', () => {
    const artifact = {
      threats: [],
      components: [],
    };
    const result = validateArtifact(artifact, 'threat-model');
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.errors.length, 0);
    assert.strictEqual(result.coverageStatus, 'not-applicable');
  });

  it('valid report artifact should pass (no consultation)', () => {
    const artifact = {
      summary: 'Report summary',
      findings: [],
    };
    const result = validateArtifact(artifact, 'report');
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.errors.length, 0);
    assert.strictEqual(result.coverageStatus, 'not-applicable');
  });

});

// ---------------------------------------------------------------------------
// validateArtifact() — Missing required fields
// ---------------------------------------------------------------------------
describe('validateArtifact() — Missing required fields', () => {

  it('audit artifact missing findings should fail', () => {
    const artifact = { consultation: makeValidConsultation('pass') };
    const result = validateArtifact(artifact, 'audit');
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('Missing required field: findings')),
      'Should report missing findings');
  });

  it('audit artifact missing consultation should fail', () => {
    const artifact = { findings: [] };
    const result = validateArtifact(artifact, 'audit');
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('Missing required field: consultation')),
      'Should report missing consultation');
  });

  it('verify artifact missing verdicts should fail', () => {
    const artifact = { consultation: makeValidConsultation('pass') };
    const result = validateArtifact(artifact, 'verify');
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('Missing required field: verdicts')));
  });

  it('map-codebase missing dependencies should fail', () => {
    const artifact = { components: [], dataFlows: [] };
    const result = validateArtifact(artifact, 'map-codebase');
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('Missing required field: dependencies')));
  });

  it('multiple missing fields should produce multiple errors', () => {
    const result = validateArtifact({}, 'audit');
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.length >= 2, 'Should report at least 2 errors for empty audit artifact');
  });

});

// ---------------------------------------------------------------------------
// validateArtifact() — Consultation trace validation
// ---------------------------------------------------------------------------
describe('validateArtifact() — Consultation trace validation', () => {

  it('consultation missing plan should produce error', () => {
    const artifact = {
      findings: [],
      consultation: {
        validation: { coverageStatus: 'pass' },
        consultedDocs: [],
      },
    };
    const result = validateArtifact(artifact, 'audit');
    assert.ok(result.errors.some(e => e.includes('Missing consultation field: plan')),
      'Should report missing plan');
  });

  it('consultation missing validation should produce error', () => {
    const artifact = {
      findings: [],
      consultation: {
        plan: {},
        consultedDocs: [],
      },
    };
    const result = validateArtifact(artifact, 'audit');
    assert.ok(result.errors.some(e => e.includes('Missing consultation field: validation')),
      'Should report missing validation');
  });

  it('consultation missing consultedDocs for audit should produce error', () => {
    const artifact = {
      findings: [],
      consultation: {
        plan: {},
        validation: { coverageStatus: 'pass' },
      },
    };
    const result = validateArtifact(artifact, 'audit');
    assert.ok(result.errors.some(e => e.includes('Missing consultation field: consultedDocs')),
      'Should report missing consultedDocs');
  });

  it('consultedDocs not an array should produce error', () => {
    const artifact = {
      findings: [],
      consultation: {
        plan: {},
        validation: { coverageStatus: 'pass' },
        consultedDocs: 'not-array',
      },
    };
    const result = validateArtifact(artifact, 'audit');
    assert.ok(result.errors.some(e => e.includes('consultedDocs must be an array')),
      'Should report consultedDocs is not an array');
  });

  it('invalid coverageStatus should produce error', () => {
    const artifact = {
      findings: [],
      consultation: {
        plan: {},
        validation: { coverageStatus: 'unknown' },
        consultedDocs: [],
      },
    };
    const result = validateArtifact(artifact, 'audit');
    assert.ok(result.errors.some(e => e.includes('Invalid coverageStatus')),
      'Should report invalid coverageStatus');
  });

  it('coverageStatus pass should set result.coverageStatus to pass', () => {
    const artifact = {
      findings: [],
      consultation: makeValidConsultation('pass'),
    };
    const result = validateArtifact(artifact, 'audit');
    assert.strictEqual(result.coverageStatus, 'pass');
    assert.strictEqual(result.valid, true);
  });

  it('coverageStatus warn should set result.coverageStatus to warn', () => {
    const artifact = {
      findings: [],
      consultation: makeValidConsultation('warn'),
    };
    const result = validateArtifact(artifact, 'audit');
    assert.strictEqual(result.coverageStatus, 'warn');
    assert.strictEqual(result.valid, true);
  });

  it('coverageStatus fail with non-empty requiredMissing should pass', () => {
    const artifact = {
      findings: [],
      consultation: makeValidConsultation('fail', { requiredMissing: ['doc-1'] }),
    };
    const result = validateArtifact(artifact, 'audit');
    assert.strictEqual(result.coverageStatus, 'fail');
    assert.strictEqual(result.valid, true);
  });

  it('coverageStatus fail with empty requiredMissing should produce inconsistency warning', () => {
    const artifact = {
      findings: [],
      consultation: {
        plan: {},
        validation: { coverageStatus: 'fail', requiredMissing: [] },
        consultedDocs: [],
      },
    };
    const result = validateArtifact(artifact, 'audit');
    assert.ok(result.warnings.some(w => w.includes('inconsistent') || w.includes('requiredMissing is empty')),
      'Should warn about inconsistent fail status with empty requiredMissing');
  });

});

// ---------------------------------------------------------------------------
// validateArtifact() — Edge cases
// ---------------------------------------------------------------------------
describe('validateArtifact() — Edge cases', () => {

  it('unknown workflow ID should return not-applicable', () => {
    const result = validateArtifact({}, 'unknown-workflow');
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.coverageStatus, 'not-applicable');
    assert.ok(result.warnings.length > 0, 'Should include warning about unknown workflow');
  });

  it('artifact with extra fields should pass', () => {
    const artifact = {
      findings: [],
      consultation: makeValidConsultation('pass'),
      extraField: 'ignored',
    };
    const result = validateArtifact(artifact, 'audit');
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.errors.length, 0);
  });

  it('consultation set to null should fail', () => {
    const artifact = { findings: [], consultation: null };
    const result = validateArtifact(artifact, 'audit');
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('Missing consultation trace section')));
  });

  it('consultation set to string instead of object should fail', () => {
    const artifact = { findings: [], consultation: 'not-an-object' };
    const result = validateArtifact(artifact, 'audit');
    assert.strictEqual(result.valid, false);
  });

});
