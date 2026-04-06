/**
 * Unit tests for rollout mode computation.
 * Phase 11 — Workstream A: rollout mode.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeRolloutMode } from '../../dist/core/install-stages.js';

describe('computeRolloutMode', () => {
  it('returns "hybrid-shadow" when hybridShadow is true', () => {
    assert.equal(computeRolloutMode({ hybridShadow: true }), 'hybrid-shadow');
  });

  it('returns "mcp-only" by default when no flags are set', () => {
    assert.equal(computeRolloutMode({}), 'mcp-only');
  });

  it('returns "mcp-only" when hybridShadow is false', () => {
    assert.equal(computeRolloutMode({ hybridShadow: false }), 'mcp-only');
  });
});
