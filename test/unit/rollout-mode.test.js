/**
 * Unit tests for rollout mode computation.
 * Phase 11 — Workstream A: Compatibility flags and rollout mode.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeRolloutMode } from '../../dist/core/install-stages.js';

describe('computeRolloutMode', () => {
  it('returns "legacy" when legacySpecialists is true', () => {
    assert.equal(computeRolloutMode({ legacySpecialists: true }), 'legacy');
  });

  it('returns "hybrid-shadow" when hybridShadow is true', () => {
    assert.equal(computeRolloutMode({ hybridShadow: true }), 'hybrid-shadow');
  });

  it('returns "mcp-only" by default when no flags are set', () => {
    assert.equal(computeRolloutMode({}), 'mcp-only');
  });

  it('returns "legacy" when both flags are true (legacy wins)', () => {
    assert.equal(computeRolloutMode({ legacySpecialists: true, hybridShadow: true }), 'legacy');
  });

  it('returns "mcp-only" when both flags are false', () => {
    assert.equal(computeRolloutMode({ legacySpecialists: false, hybridShadow: false }), 'mcp-only');
  });

  it('returns "legacy" when legacySpecialists is true and hybridShadow is false', () => {
    assert.equal(computeRolloutMode({ legacySpecialists: true, hybridShadow: false }), 'legacy');
  });

  it('returns "hybrid-shadow" when legacySpecialists is false and hybridShadow is true', () => {
    assert.equal(computeRolloutMode({ legacySpecialists: false, hybridShadow: true }), 'hybrid-shadow');
  });
});
