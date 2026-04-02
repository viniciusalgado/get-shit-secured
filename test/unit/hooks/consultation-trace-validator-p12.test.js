/**
 * Phase 12 — Unit Tests: Consultation Trace Validator (consultationMode-aware)
 *
 * Extended tests for the consultationMode parameter added in Phase 12.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  validateConsultationTrace,
} from '../../../dist/hooks/consultation-trace-validator.js';

// ---------------------------------------------------------------------------
// not-applicable mode
// ---------------------------------------------------------------------------
describe('Phase 12: consultationMode = not-applicable', () => {

  it('should skip validation and return valid with not-applicable status', () => {
    const result = validateConsultationTrace(
      { consultationMode: 'not-applicable' },
      'report'
    );
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.coverageStatus, 'not-applicable');
    assert.strictEqual(result.errors.length, 0);
    assert.strictEqual(result.warnings.length, 0);
  });

  it('should skip validation even if consultation section is missing', () => {
    const result = validateConsultationTrace(
      { consultationMode: 'not-applicable', findings: [] },
      'report'
    );
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.coverageStatus, 'not-applicable');
  });

});

// ---------------------------------------------------------------------------
// optional mode
// ---------------------------------------------------------------------------
describe('Phase 12: consultationMode = optional', () => {

  it('should return valid with warning when consultation is missing', () => {
    const result = validateConsultationTrace(
      { consultationMode: 'optional' },
      'map-codebase'
    );
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.coverageStatus, 'missing');
    assert.ok(result.warnings.length > 0, 'Should have warnings');
    assert.ok(result.warnings.some(w => w.includes('optional')));
  });

  it('should validate normally when consultation is present', () => {
    const result = validateConsultationTrace(
      {
        consultationMode: 'optional',
        consultation: {
          plan: { docs: [] },
          validation: { coverageStatus: 'pass' },
          consultedDocs: ['doc-1'],
        },
      },
      'map-codebase'
    );
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.coverageStatus, 'pass');
  });

});

// ---------------------------------------------------------------------------
// required mode (default behavior)
// ---------------------------------------------------------------------------
describe('Phase 12: consultationMode = required', () => {

  it('should fail when consultation is missing', () => {
    const result = validateConsultationTrace(
      { consultationMode: 'required' },
      'audit'
    );
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.coverageStatus, 'missing');
    assert.ok(result.errors.length > 0);
  });

  it('should pass with valid consultation', () => {
    const result = validateConsultationTrace(
      {
        consultationMode: 'required',
        consultation: {
          plan: { docs: [] },
          validation: { coverageStatus: 'pass' },
          consultedDocs: ['doc-1'],
        },
      },
      'audit'
    );
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.coverageStatus, 'pass');
  });

});

// ---------------------------------------------------------------------------
// ConsultationTrace flat format support
// ---------------------------------------------------------------------------
describe('Phase 12: ConsultationTrace flat format', () => {

  it('should accept flat coverageStatus at consultation level', () => {
    const result = validateConsultationTrace(
      {
        consultation: {
          plan: { workflowId: 'audit', generatedAt: '2026-04-02T12:00:00Z', corpusVersion: '2026-03-31', requiredCount: 1, optionalCount: 0, followupCount: 0 },
          consultedDocs: [{ id: 'doc-1', title: 'Doc 1', sourceUrl: 'https://...' }],
          coverageStatus: 'pass',
          requiredMissing: [],
          notes: [],
        },
      },
      'audit'
    );
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.coverageStatus, 'pass');
  });

  it('should accept flat format with coverageStatus warn', () => {
    const result = validateConsultationTrace(
      {
        consultation: {
          plan: {},
          consultedDocs: [],
          coverageStatus: 'warn',
          requiredMissing: ['doc-1'],
          notes: ['Could not access MCP'],
        },
      },
      'audit'
    );
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.coverageStatus, 'warn');
  });

  it('should reject invalid flat coverageStatus', () => {
    const result = validateConsultationTrace(
      {
        consultation: {
          plan: {},
          consultedDocs: [],
          coverageStatus: 'unknown',
          requiredMissing: [],
          notes: [],
        },
      },
      'audit'
    );
    assert.strictEqual(result.valid, false);
  });

  // --- Gap-fill scenarios ---

  it('should skip validation for not-applicable mode even if consultation section is present', () => {
    const result = validateConsultationTrace(
      {
        consultationMode: 'not-applicable',
        consultation: {
          plan: { docs: [] },
          validation: { coverageStatus: 'pass' },
          consultedDocs: ['doc-1'],
        },
      },
      'report'
    );
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.coverageStatus, 'not-applicable');
    assert.strictEqual(result.errors.length, 0);
  });

  it('should catch non-number schemaVersion type', () => {
    const result = validateConsultationTrace(
      {
        consultationMode: 'required',
        schemaVersion: 'one',
        consultation: {
          plan: { docs: [] },
          validation: { coverageStatus: 'pass' },
          consultedDocs: ['doc-1'],
        },
      },
      'audit'
    );
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('schemaVersion')));
  });

  it('should accept optional mode with flat format and warn status', () => {
    const result = validateConsultationTrace(
      {
        consultationMode: 'optional',
        consultation: {
          plan: {},
          consultedDocs: [],
          coverageStatus: 'warn',
          requiredMissing: ['doc-1'],
          notes: [],
        },
      },
      'map-codebase'
    );
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.coverageStatus, 'warn');
  });

  it('should accept consultedDocs as objects with id field', () => {
    const result = validateConsultationTrace(
      {
        consultationMode: 'required',
        consultation: {
          plan: { workflowId: 'audit', generatedAt: '2026-04-02T12:00:00Z', corpusVersion: '2026-03-31', requiredCount: 1, optionalCount: 0, followupCount: 0 },
          consultedDocs: [{ id: 'sql-injection-prevention', title: 'SQL Injection', sourceUrl: 'https://...' }],
          coverageStatus: 'pass',
          requiredMissing: [],
          notes: [],
        },
      },
      'audit'
    );
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.coverageStatus, 'pass');
  });

  it('should treat artifact without consultationMode as required (backward compat)', () => {
    const result = validateConsultationTrace(
      {
        consultation: {
          plan: { docs: [] },
          validation: { coverageStatus: 'pass' },
          consultedDocs: ['doc-1'],
        },
      },
      'audit'
    );
    // No consultationMode field — should default to required behavior
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.coverageStatus, 'pass');
  });

  it('should warn on fail with empty requiredMissing in flat format', () => {
    const result = validateConsultationTrace(
      {
        consultationMode: 'required',
        consultation: {
          plan: {},
          consultedDocs: [],
          coverageStatus: 'fail',
          requiredMissing: [],
          notes: [],
        },
      },
      'audit'
    );
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.coverageStatus, 'fail');
    assert.ok(result.warnings.some(w => w.includes('inconsistent')), `Expected inconsistency warning, got: ${result.warnings.join('; ')}`);
  });

});
