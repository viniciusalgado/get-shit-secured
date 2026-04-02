/**
 * Phase 6 — Renderer Cleanup Tests
 *
 * Validates that specialist rendering functions are removed (Definition of Done)
 * and new MCP functions exist.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import * as renderer from '../../dist/core/renderer.js';

describe('Phase 6 — Renderer Cleanup', () => {

  // ---------------------------------------------------------------------------
  // 4.1 Specialist rendering functions are removed (Definition of Done)
  // ---------------------------------------------------------------------------
  describe('Specialist functions must be removed', () => {
    const removedFunctions = [
      'renderClaudeSpecialist',
      'renderCodexSpecialist',
      'renderClaudeSpecialistsReadme',
      'renderCodexSpecialistsReadme',
    ];

    for (const fn of removedFunctions) {
      it(`should NOT export ${fn}`, () => {
        assert.equal(renderer[fn], undefined,
          `${fn} is still exported — Phase 6 DoD requires removal`);
      });
    }
  });

  // ---------------------------------------------------------------------------
  // 4.2 New MCP functions are exported
  // ---------------------------------------------------------------------------
  describe('New MCP functions must exist', () => {
    it('should export renderMcpConsultationSection', () => {
      assert.equal(typeof renderer.renderMcpConsultationSection, 'function',
        'renderMcpConsultationSection is not exported');
    });

    it('should export renderConsultationTraceRequirement', () => {
      assert.equal(typeof renderer.renderConsultationTraceRequirement, 'function',
        'renderConsultationTraceRequirement is not exported');
    });
  });

  // ---------------------------------------------------------------------------
  // 4.3 Delegation plan functions are removed or fully delegated (Definition of Done)
  // ---------------------------------------------------------------------------
  it('should NOT export renderClaudeDelegationPlanSection and renderCodexDelegationPlanSection', () => {
    assert.equal(renderer.renderClaudeDelegationPlanSection, undefined,
      'renderClaudeDelegationPlanSection still exported — Phase 6 DoD requires removal');
    assert.equal(renderer.renderCodexDelegationPlanSection, undefined,
      'renderCodexDelegationPlanSection still exported — Phase 6 DoD requires removal');
  });
});
