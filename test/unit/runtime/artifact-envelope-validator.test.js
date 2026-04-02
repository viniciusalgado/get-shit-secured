/**
 * Phase 12 — Unit Tests: Artifact Envelope Validator
 *
 * Tests isArtifactEnvelope() and validateArtifactEnvelope().
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  isArtifactEnvelope,
  validateArtifactEnvelope,
} from '../../../dist/runtime/artifact-envelope-validator.js';

function makeValidEnvelope(overrides = {}) {
  return {
    schemaVersion: 1,
    workflowId: 'audit',
    gssVersion: '0.1.0',
    corpusVersion: '2026-03-31',
    generatedAt: '2026-04-02T12:00:00Z',
    consultationMode: 'required',
    consultation: {
      plan: { workflowId: 'audit', generatedAt: '2026-04-02T12:00:00Z', corpusVersion: '2026-03-31', requiredCount: 1, optionalCount: 0, followupCount: 0 },
      consultedDocs: [{ id: 'sql-injection-prevention', title: 'SQL Injection Prevention', sourceUrl: 'https://...' }],
      coverageStatus: 'pass',
      requiredMissing: [],
      notes: [],
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// isArtifactEnvelope
// ---------------------------------------------------------------------------
describe('isArtifactEnvelope()', () => {

  it('should accept valid envelope', () => {
    assert.strictEqual(isArtifactEnvelope(makeValidEnvelope()), true);
  });

  it('should reject null', () => {
    assert.strictEqual(isArtifactEnvelope(null), false);
  });

  it('should reject string', () => {
    assert.strictEqual(isArtifactEnvelope('not an object'), false);
  });

  it('should reject array', () => {
    assert.strictEqual(isArtifactEnvelope([]), false);
  });

  it('should reject object missing schemaVersion', () => {
    const env = makeValidEnvelope();
    delete env.schemaVersion;
    assert.strictEqual(isArtifactEnvelope(env), false);
  });

  it('should reject object missing workflowId', () => {
    const env = makeValidEnvelope();
    delete env.workflowId;
    assert.strictEqual(isArtifactEnvelope(env), false);
  });

  it('should reject object missing gssVersion', () => {
    const env = makeValidEnvelope();
    delete env.gssVersion;
    assert.strictEqual(isArtifactEnvelope(env), false);
  });

  it('should reject object missing corpusVersion', () => {
    const env = makeValidEnvelope();
    delete env.corpusVersion;
    assert.strictEqual(isArtifactEnvelope(env), false);
  });

  it('should reject object missing generatedAt', () => {
    const env = makeValidEnvelope();
    delete env.generatedAt;
    assert.strictEqual(isArtifactEnvelope(env), false);
  });

  it('should reject object missing consultationMode', () => {
    const env = makeValidEnvelope();
    delete env.consultationMode;
    assert.strictEqual(isArtifactEnvelope(env), false);
  });

});

// ---------------------------------------------------------------------------
// validateArtifactEnvelope
// ---------------------------------------------------------------------------
describe('validateArtifactEnvelope()', () => {

  it('should return valid for valid envelope', () => {
    const result = validateArtifactEnvelope(makeValidEnvelope());
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.errors.length, 0);
  });

  it('should reject missing schemaVersion', () => {
    const env = makeValidEnvelope();
    delete env.schemaVersion;
    const result = validateArtifactEnvelope(env);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('schemaVersion')));
  });

  it('should reject wrong schema version with warning', () => {
    const env = makeValidEnvelope({ schemaVersion: 99 });
    const result = validateArtifactEnvelope(env);
    assert.ok(result.warnings.some(w => w.includes('99')));
  });

  it('should reject invalid workflowId', () => {
    const env = makeValidEnvelope({ workflowId: 'not-a-workflow' });
    const result = validateArtifactEnvelope(env);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('Invalid workflowId')));
  });

  it('should accept valid expectedWorkflowId', () => {
    const result = validateArtifactEnvelope(makeValidEnvelope(), 'audit');
    assert.strictEqual(result.valid, true);
  });

  it('should warn on workflowId mismatch', () => {
    const result = validateArtifactEnvelope(makeValidEnvelope(), 'verify');
    assert.ok(result.warnings.some(w => w.includes('expected')));
  });

  it('should error when consultationMode is required but no consultation', () => {
    const env = makeValidEnvelope();
    delete env.consultation;
    const result = validateArtifactEnvelope(env);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('required') && e.includes('consultation')));
  });

  it('should warn when consultationMode is not-applicable but consultation present', () => {
    const env = makeValidEnvelope({ consultationMode: 'not-applicable' });
    const result = validateArtifactEnvelope(env);
    assert.ok(result.warnings.some(w => w.includes('not-applicable')));
  });

  it('should accept optional mode without consultation', () => {
    const env = makeValidEnvelope({ consultationMode: 'optional' });
    delete env.consultation;
    const result = validateArtifactEnvelope(env);
    assert.strictEqual(result.valid, true);
  });

  it('should reject non-string generatedAt', () => {
    const env = makeValidEnvelope({ generatedAt: 12345 });
    const result = validateArtifactEnvelope(env);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('generatedAt')));
  });

  it('should warn on non-ISO generatedAt', () => {
    const env = makeValidEnvelope({ generatedAt: 'yesterday' });
    const result = validateArtifactEnvelope(env);
    assert.ok(result.warnings.some(w => w.includes('ISO 8601')));
  });

  // --- Gap-fill scenarios ---

  it('should reject invalid consultationMode value', () => {
    const env = makeValidEnvelope({ consultationMode: 'sometimes' });
    const result = validateArtifactEnvelope(env);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('sometimes')), `Expected error about 'sometimes', got: ${JSON.stringify(result.errors)}`);
  });

  it('should error when required mode has consultation as non-object string', () => {
    const env = makeValidEnvelope({ consultationMode: 'required', consultation: 'yes' });
    const result = validateArtifactEnvelope(env);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('consultation') && e.includes('non-null object')));
  });

  it('should report all errors for multiple missing required fields', () => {
    const env = {};
    const result = validateArtifactEnvelope(env);
    assert.strictEqual(result.valid, false);
    // Should report schemaVersion, workflowId, gssVersion, corpusVersion, generatedAt, consultationMode
    assert.ok(result.errors.length >= 5, `Expected >= 5 errors, got ${result.errors.length}: ${JSON.stringify(result.errors)}`);
    assert.ok(result.errors.some(e => e.includes('schemaVersion')));
    assert.ok(result.errors.some(e => e.includes('workflowId')));
    assert.ok(result.errors.some(e => e.includes('consultationMode')));
  });

  it('should accept optional mode with valid consultation present', () => {
    const env = makeValidEnvelope({ consultationMode: 'optional' });
    const result = validateArtifactEnvelope(env);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.errors.length, 0);
  });

  it('should accept envelope with extra fields via type guard', () => {
    const env = makeValidEnvelope({ extraField: 'hello', anotherField: 42 });
    assert.strictEqual(isArtifactEnvelope(env), true);
  });

  it('should handle undefined input gracefully', () => {
    const result = validateArtifactEnvelope(undefined);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('non-null object')));
  });

});
