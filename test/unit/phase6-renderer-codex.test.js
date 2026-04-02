/**
 * Phase 6 — Codex Skill Renderer Tests
 *
 * Validates that rendered Codex skills use MCP consultation (not specialist
 * delegation), contain consultation traces, and have no specialist references.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  renderCodexSkill,
} from '../../dist/core/renderer.js';
import { getWorkflow, getAllWorkflows } from '../../dist/catalog/workflows/registry.js';

describe('Phase 6 — Codex Skill Renderer', () => {

  // ---------------------------------------------------------------------------
  // 4.1 Codex skill uses MCP consultation section
  // ---------------------------------------------------------------------------
  describe('MCP consultation section in Codex skills', () => {
    const mcpWorkflows = ['security-review', 'audit', 'verify'];

    for (const id of mcpWorkflows) {
      it(`${id} should include MCP Security Consultation section`, () => {
        const workflow = getWorkflow(id);
        const output = renderCodexSkill(workflow);

        assert.ok(output.includes('## MCP Security Consultation'),
          `${id} Codex skill missing MCP consultation section`);
      });
    }
  });

  // ---------------------------------------------------------------------------
  // 4.2 No gss-specialist-* references in ANY Codex skill (Definition of Done)
  // ---------------------------------------------------------------------------
  it('should have no gss-specialist-* references in any Codex skill', () => {
    const allWorkflows = getAllWorkflows();
    for (const workflow of allWorkflows) {
      const output = renderCodexSkill(workflow);
      const specialistRefs = output.match(/gss-specialist-[\w-]+/g);
      assert.equal(specialistRefs, null,
        `Codex skill for ${workflow.id} contains specialist references: ${specialistRefs?.join(', ')}`);
    }
  });

  // ---------------------------------------------------------------------------
  // 4.3 No cheatSheetUrls in rendered Codex skills
  // ---------------------------------------------------------------------------
  it('should not include Cheat Sheet URLs section in Codex skills', () => {
    const allWorkflows = getAllWorkflows();
    for (const workflow of allWorkflows) {
      const output = renderCodexSkill(workflow);
      assert.ok(!output.includes('Cheat Sheet URLs'),
        `${workflow.id} Codex skill still has "Cheat Sheet URLs" section`);
    }
  });

  // ---------------------------------------------------------------------------
  // 4.4 Codex skill still renders correctly for all 9 workflows
  // ---------------------------------------------------------------------------
  it('should render Codex skill for all 9 workflows without throwing', () => {
    const allWorkflows = getAllWorkflows();
    for (const workflow of allWorkflows) {
      assert.doesNotThrow(() => renderCodexSkill(workflow),
        `renderCodexSkill threw for ${workflow.id}`);
    }
  });

  // ---------------------------------------------------------------------------
  // 4.5 Codex skill includes consultation trace in done criteria
  // ---------------------------------------------------------------------------
  it('should include consultation trace in done criteria for workflows with signalDerivation', () => {
    const allWorkflows = getAllWorkflows();
    for (const workflow of allWorkflows) {
      if (workflow.signalDerivation) {
        const output = renderCodexSkill(workflow);
        assert.ok(
          output.includes('consultation') || output.includes('Consultation') || output.includes('coverageStatus'),
          `Codex skill for ${workflow.id} missing consultation trace in done criteria`
        );
      }
    }
  });

  // ---------------------------------------------------------------------------
  // 4.6 Claude and Codex renders produce consistent MCP instructions
  // ---------------------------------------------------------------------------
  it('should produce consistent MCP instructions between Claude and Codex renders', () => {
    const workflow = getWorkflow('audit');
    const claudeOutput = renderClaudeAgent(workflow);
    const codexOutput = renderCodexSkill(workflow);

    // Both should contain MCP section
    assert.ok(claudeOutput.includes('## MCP Security Consultation'),
      'Claude agent missing MCP section for audit');
    assert.ok(codexOutput.includes('## MCP Security Consultation'),
      'Codex skill missing MCP section for audit');

    // Both should contain the same tool references
    const toolRefs = ['get_workflow_consultation_plan', 'validate_security_consultation', 'get_related_security_docs'];
    for (const tool of toolRefs) {
      assert.ok(claudeOutput.includes(tool), `Claude agent missing ${tool}`);
      assert.ok(codexOutput.includes(tool), `Codex skill missing ${tool}`);
    }
  });

  // ---------------------------------------------------------------------------
  // 4.7 Codex skill still includes OWASP Standards
  // ---------------------------------------------------------------------------
  it('should still include OWASP Standards in Codex skills', () => {
    const allWorkflows = getAllWorkflows();
    for (const workflow of allWorkflows) {
      if (workflow.owaspTopics?.length > 0) {
        const output = renderCodexSkill(workflow);
        assert.ok(output.includes('## OWASP Standards') || output.includes('OWASP'),
          `${workflow.id} Codex skill missing OWASP Standards section`);
      }
    }
  });
});

// Helper imported inline for 4.6
import { renderClaudeAgent } from '../../dist/core/renderer.js';
