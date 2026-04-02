/**
 * Phase 8 — Unit Tests: Consultation Trace Validator
 *
 * Validates validateConsultationTrace() function for correct
 * validation of consultation trace structure and consistency checks.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  validateConsultationTrace,
} from '../../../dist/hooks/consultation-trace-validator.js';

function makeValidTrace(coverageStatus = 'pass', overrides = {}) {
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
// Valid traces
// ---------------------------------------------------------------------------
describe('validateConsultationTrace() — Valid traces', () => {

  it('full valid trace with coverageStatus pass should pass', () => {
    const artifact = { consultation: makeValidTrace('pass') };
    const result = validateConsultationTrace(artifact, 'audit');
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.errors.length, 0);
    assert.strictEqual(result.coverageStatus, 'pass');
  });

  it('full valid trace with coverageStatus warn should pass', () => {
    const artifact = { consultation: makeValidTrace('warn') };
    const result = validateConsultationTrace(artifact, 'audit');
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.coverageStatus, 'warn');
  });

  it('full valid trace with coverageStatus fail and non-empty requiredMissing should pass', () => {
    const artifact = {
      consultation: makeValidTrace('fail', { requiredMissing: ['doc-a', 'doc-b'] }),
    };
    const result = validateConsultationTrace(artifact, 'audit');
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.coverageStatus, 'fail');
  });

  it('valid trace with consultedDocs as string array should pass', () => {
    const artifact = {
      consultation: {
        plan: { docs: [] },
        validation: { coverageStatus: 'pass' },
        consultedDocs: ['doc-1', 'doc-2', 'doc-3'],
      },
    };
    const result = validateConsultationTrace(artifact, 'audit');
    assert.strictEqual(result.valid, true);
  });

});

// ---------------------------------------------------------------------------
// Missing consultation section
// ---------------------------------------------------------------------------
describe('validateConsultationTrace() — Missing consultation section', () => {

  it('artifact with no consultation key should fail', () => {
    const result = validateConsultationTrace({ findings: [] }, 'audit');
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => /missing.*consultation/i.test(e)),
      'Should report missing consultation');
    assert.strictEqual(result.coverageStatus, 'missing');
  });

  it('consultation set to null should fail', () => {
    const result = validateConsultationTrace({ consultation: null }, 'audit');
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.coverageStatus, 'missing');
  });

  it('consultation set to array should fail', () => {
    const result = validateConsultationTrace({ consultation: [1, 2, 3] }, 'audit');
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.coverageStatus, 'missing');
  });

});

// ---------------------------------------------------------------------------
// Missing sub-fields
// ---------------------------------------------------------------------------
describe('validateConsultationTrace() — Missing sub-fields', () => {

  it('missing consultation.plan should produce error', () => {
    const artifact = {
      consultation: {
        validation: { coverageStatus: 'pass' },
      },
    };
    const result = validateConsultationTrace(artifact, 'audit');
    assert.ok(result.errors.some(e => e.includes('Missing consultation.plan')));
  });

  it('consultation.plan set to null should produce error', () => {
    const artifact = {
      consultation: {
        plan: null,
        validation: { coverageStatus: 'pass' },
      },
    };
    const result = validateConsultationTrace(artifact, 'audit');
    assert.ok(result.errors.some(e => e.includes('Missing consultation.plan')));
  });

  it('consultation.plan set to array should produce error', () => {
    const artifact = {
      consultation: {
        plan: [1, 2],
        validation: { coverageStatus: 'pass' },
      },
    };
    const result = validateConsultationTrace(artifact, 'audit');
    assert.ok(result.errors.some(e => e.includes('must be a non-null object')));
  });

  it('missing consultation.validation should produce error with missing status', () => {
    const artifact = {
      consultation: {
        plan: {},
      },
    };
    const result = validateConsultationTrace(artifact, 'audit');
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('Missing consultation.validation')));
    assert.strictEqual(result.coverageStatus, 'missing');
  });

  it('consultation.validation set to null should fail', () => {
    const artifact = {
      consultation: {
        plan: {},
        validation: null,
      },
    };
    const result = validateConsultationTrace(artifact, 'audit');
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.coverageStatus, 'missing');
  });

});

// ---------------------------------------------------------------------------
// Invalid coverageStatus
// ---------------------------------------------------------------------------
describe('validateConsultationTrace() — Invalid coverageStatus', () => {

  it('missing coverageStatus in validation should fail', () => {
    const artifact = {
      consultation: {
        plan: {},
        validation: {},
      },
    };
    const result = validateConsultationTrace(artifact, 'audit');
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.coverageStatus, 'missing');
  });

  it('empty string coverageStatus should fail', () => {
    const artifact = {
      consultation: {
        plan: {},
        validation: { coverageStatus: '' },
      },
    };
    const result = validateConsultationTrace(artifact, 'audit');
    assert.strictEqual(result.valid, false);
  });

  it('unknown coverageStatus value should fail', () => {
    const artifact = {
      consultation: {
        plan: {},
        validation: { coverageStatus: 'unknown' },
      },
    };
    const result = validateConsultationTrace(artifact, 'audit');
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('Invalid coverageStatus')));
  });

  it('numeric coverageStatus should fail', () => {
    const artifact = {
      consultation: {
        plan: {},
        validation: { coverageStatus: 42 },
      },
    };
    const result = validateConsultationTrace(artifact, 'audit');
    assert.strictEqual(result.valid, false);
  });

});

// ---------------------------------------------------------------------------
// Consistency checks
// ---------------------------------------------------------------------------
describe('validateConsultationTrace() — Consistency checks', () => {

  it('coverageStatus fail with empty requiredMissing should produce inconsistency warning', () => {
    const artifact = {
      consultation: {
        plan: {},
        validation: { coverageStatus: 'fail', requiredMissing: [] },
      },
    };
    const result = validateConsultationTrace(artifact, 'audit');
    assert.ok(
      result.warnings.some(w => w.includes('inconsistent') || w.includes('requiredMissing is empty')),
      'Should warn about inconsistent state'
    );
  });

  it('coverageStatus fail with non-empty requiredMissing should not produce inconsistency warning', () => {
    const artifact = {
      consultation: {
        plan: {},
        validation: { coverageStatus: 'fail', requiredMissing: ['doc-1'] },
      },
    };
    const result = validateConsultationTrace(artifact, 'audit');
    assert.ok(
      !result.warnings.some(w => w.includes('inconsistent') || w.includes('requiredMissing is empty')),
      'Should NOT warn about inconsistency when requiredMissing is populated'
    );
  });

  it('coverageStatus pass with empty requiredMissing should not produce inconsistency warning', () => {
    const artifact = {
      consultation: {
        plan: {},
        validation: { coverageStatus: 'pass', requiredMissing: [] },
      },
    };
    const result = validateConsultationTrace(artifact, 'audit');
    assert.ok(
      !result.warnings.some(w => w.includes('inconsistent')),
      'Should NOT warn about inconsistency for pass with empty requiredMissing'
    );
  });

});

// ---------------------------------------------------------------------------
// consultedDocs validation
// ---------------------------------------------------------------------------
describe('validateConsultationTrace() — consultedDocs validation', () => {

  it('consultedDocs not an array should produce error', () => {
    const artifact = {
      consultation: {
        plan: {},
        validation: { coverageStatus: 'pass' },
        consultedDocs: 'not-array',
      },
    };
    const result = validateConsultationTrace(artifact, 'audit');
    assert.ok(result.errors.some(e => e.includes('must be an array')));
  });

  it('consultedDocs with non-string element should produce error', () => {
    const artifact = {
      consultation: {
        plan: {},
        validation: { coverageStatus: 'pass' },
        consultedDocs: ['valid-doc', 42, 'another-doc'],
      },
    };
    const result = validateConsultationTrace(artifact, 'audit');
    assert.ok(result.errors.some(e => e.includes('must be a string')));
  });

  it('consultedDocs as valid string array should produce no consultedDocs errors', () => {
    const artifact = {
      consultation: {
        plan: {},
        validation: { coverageStatus: 'pass' },
        consultedDocs: ['doc-1', 'doc-2'],
      },
    };
    const result = validateConsultationTrace(artifact, 'audit');
    assert.ok(
      !result.errors.some(e => e.includes('consultedDocs')),
      'Should not have consultedDocs-related errors'
    );
  });

  it('absent consultedDocs should produce no error (optional)', () => {
    const artifact = {
      consultation: {
        plan: {},
        validation: { coverageStatus: 'pass' },
      },
    };
    const result = validateConsultationTrace(artifact, 'audit');
    assert.ok(
      !result.errors.some(e => e.includes('consultedDocs')),
      'consultedDocs is optional, should not error when absent'
    );
  });

});
