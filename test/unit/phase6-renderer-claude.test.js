/**
 * Phase 6 — Claude Agent Renderer Tests
 *
 * Validates that rendered Claude agents use MCP consultation (not specialist
 * delegation), contain consultation traces in done criteria, and have no
 * specialist references.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  renderClaudeAgent,
  renderClaudeCommand,
} from '../../dist/core/renderer.js';
import { getWorkflow, getAllWorkflows } from '../../dist/catalog/workflows/registry.js';

describe('Phase 6 — Claude Agent Renderer', () => {

  // ---------------------------------------------------------------------------
  // 3.1 Claude agent uses MCP consultation section (not delegation plan)
  // ---------------------------------------------------------------------------
  describe('MCP consultation section in Claude agents', () => {
    const mcpWorkflows = ['security-review', 'audit', 'verify'];

    for (const id of mcpWorkflows) {
      it(`${id} should include MCP Security Consultation section`, () => {
        const workflow = getWorkflow(id);
        const output = renderClaudeAgent(workflow);

        assert.ok(output.includes('## MCP Security Consultation'),
          `${id} Claude agent missing MCP consultation section`);
      });
    }
  });

  // ---------------------------------------------------------------------------
  // 3.2 No gss-specialist-* references in ANY Claude agent (Definition of Done)
  // ---------------------------------------------------------------------------
  it('should have no gss-specialist-* references in any Claude agent', () => {
    const allWorkflows = getAllWorkflows();
    for (const workflow of allWorkflows) {
      const output = renderClaudeAgent(workflow);
      const specialistRefs = output.match(/gss-specialist-[\w-]+/g);
      assert.equal(specialistRefs, null,
        `Claude agent for ${workflow.id} contains specialist references: ${specialistRefs?.join(', ')}`);
    }
  });

  // ---------------------------------------------------------------------------
  // 3.3 No cheatSheetUrls (OWASP URL lists) in rendered Claude agents
  // ---------------------------------------------------------------------------
  it('should not include cheatSheetUrls or Cheat Sheet URLs section in Claude agents', () => {
    const allWorkflows = getAllWorkflows();
    for (const workflow of allWorkflows) {
      const output = renderClaudeAgent(workflow);
      assert.ok(!output.includes('Cheat Sheet URLs'),
        `${workflow.id} Claude agent still has "Cheat Sheet URLs" section`);
    }
  });

  // ---------------------------------------------------------------------------
  // 3.4 Claude agent done criteria include consultation trace
  // ---------------------------------------------------------------------------
  it('should include consultation trace in done criteria for all workflows with signalDerivation', () => {
    const allWorkflows = getAllWorkflows();
    for (const workflow of allWorkflows) {
      if (workflow.signalDerivation) {
        const output = renderClaudeAgent(workflow);
        assert.ok(
          output.includes('consultation') || output.includes('Consultation') || output.includes('coverageStatus'),
          `Claude agent for ${workflow.id} missing consultation trace in done criteria`
        );
      }
    }
  });

  // ---------------------------------------------------------------------------
  // 3.5 Claude agent still renders correctly (no throw) for all 9 workflows
  // ---------------------------------------------------------------------------
  it('should render Claude agent for all 9 workflows without throwing', () => {
    const allWorkflows = getAllWorkflows();
    for (const workflow of allWorkflows) {
      assert.doesNotThrow(() => renderClaudeAgent(workflow),
        `renderClaudeAgent threw for ${workflow.id}`);
    }
  });

  // ---------------------------------------------------------------------------
  // 3.6 Claude command does NOT expose MCP internals
  // ---------------------------------------------------------------------------
  it('should not expose MCP tool names in Claude commands', () => {
    const allWorkflows = getAllWorkflows();
    for (const workflow of allWorkflows) {
      const output = renderClaudeCommand(workflow);
      assert.ok(!output.includes('get_workflow_consultation_plan'),
        `${workflow.id} command exposes MCP tool name`);
      assert.ok(!output.includes('validate_security_consultation'),
        `${workflow.id} command exposes MCP validation tool`);
    }
  });

  // ---------------------------------------------------------------------------
  // 3.7 Claude agent includes artifact paths
  // ---------------------------------------------------------------------------
  it('should still include .gss/artifacts/ paths in Claude agents', () => {
    const allWorkflows = getAllWorkflows();
    for (const workflow of allWorkflows) {
      const output = renderClaudeAgent(workflow);
      assert.ok(output.includes('.gss/artifacts/'),
        `${workflow.id} Claude agent missing artifact path`);
    }
  });

  // ---------------------------------------------------------------------------
  // 3.8 Claude agent still includes workflow steps
  // ---------------------------------------------------------------------------
  it('should still include workflow steps in Claude agents', () => {
    const allWorkflows = getAllWorkflows();
    for (const workflow of allWorkflows) {
      const output = renderClaudeAgent(workflow);
      assert.ok(output.includes('## Workflow Steps'),
        `${workflow.id} Claude agent missing workflow steps`);
    }
  });

  // ---------------------------------------------------------------------------
  // 3.9 Claude agent still includes guardrails
  // ---------------------------------------------------------------------------
  it('should still include guardrails in Claude agents', () => {
    const allWorkflows = getAllWorkflows();
    for (const workflow of allWorkflows) {
      const output = renderClaudeAgent(workflow);
      if (workflow.guardrails.length > 0) {
        assert.ok(output.includes('## Guardrails'),
          `${workflow.id} Claude agent missing guardrails`);
      }
    }
  });
});
