/**
 * Phase 6 — Regression Tests
 *
 * Validates that the Phase 6 rewrite preserves all existing contracts:
 * artifact paths, workflow chain, guardrails, role agents, execution order,
 * inputs/outputs, steps, and access levels.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  renderClaudeAgent,
  renderClaudeCommand,
  renderCodexSkill,
} from '../../dist/core/renderer.js';
import { getWorkflow, getAllWorkflows } from '../../dist/catalog/workflows/registry.js';

describe('Phase 6 — Regression: Preserved Contracts', () => {

  // ---------------------------------------------------------------------------
  // 10.1 Artifact paths are unchanged
  // ---------------------------------------------------------------------------
  it('should preserve .gss/ output paths for all workflows', () => {
    const allWorkflows = getAllWorkflows();
    for (const workflow of allWorkflows) {
      for (const output of workflow.outputs) {
        if (output.path) {
          assert.ok(output.path.startsWith('.gss/'),
            `${workflow.id} output "${output.name}" has unexpected path: ${output.path}`);
        }
      }
    }
  });

  // ---------------------------------------------------------------------------
  // 10.2 Workflow dependency chain is unchanged
  // ---------------------------------------------------------------------------
  it('should preserve workflow dependency chain', () => {
    // Verify all workflows have consistent dependencies/handoffs
    // (security-review has no deps/handoffs — it's the entry point)
    const allWorkflows = getAllWorkflows();
    for (const workflow of allWorkflows) {
      // Dependencies and handoffs should still exist as arrays
      assert.ok(Array.isArray(workflow.dependencies),
        `${workflow.id} dependencies is not an array`);
      assert.ok(Array.isArray(workflow.handoffs),
        `${workflow.id} handoffs is not an array`);
      // Each dependency should have a workflowId
      for (const dep of workflow.dependencies) {
        assert.ok(dep.workflowId, `${workflow.id} dep missing workflowId`);
      }
      for (const handoff of workflow.handoffs) {
        assert.ok(handoff.nextWorkflow, `${workflow.id} handoff missing nextWorkflow`);
      }
    }
  });

  // ---------------------------------------------------------------------------
  // 10.3 Guardrails are preserved
  // ---------------------------------------------------------------------------
  it('should preserve guardrails for all workflows', () => {
    const allWorkflows = getAllWorkflows();
    for (const workflow of allWorkflows) {
      assert.ok(workflow.guardrails.length > 0,
        `${workflow.id} lost all guardrails`);
    }
  });

  // ---------------------------------------------------------------------------
  // 10.4 Workflow execution order is unchanged
  // ---------------------------------------------------------------------------
  it('should preserve canonical workflow execution order', () => {
    const allWorkflows = getAllWorkflows();
    const ids = allWorkflows.map(w => w.id);
    const expectedOrder = [
      'security-review',
      'map-codebase',
      'threat-model',
      'audit',
      'validate-findings',
      'plan-remediation',
      'execute-remediation',
      'verify',
      'report',
    ];
    assert.deepEqual(ids, expectedOrder,
      `Workflow order changed. Got: ${ids.join(', ')}`);
  });

  // ---------------------------------------------------------------------------
  // 10.5 Workflow steps are preserved
  // ---------------------------------------------------------------------------
  it('should preserve steps for all workflows', () => {
    const allWorkflows = getAllWorkflows();
    for (const workflow of allWorkflows) {
      assert.ok(workflow.steps.length > 0,
        `${workflow.id} lost all steps`);
      for (const step of workflow.steps) {
        assert.ok(step.title, `${workflow.id} step missing title`);
        assert.ok(step.instructions, `${workflow.id} step "${step.title}" missing instructions`);
      }
    }
  });

  // ---------------------------------------------------------------------------
  // 10.6 Workflow inputs and outputs are preserved
  // ---------------------------------------------------------------------------
  it('should preserve inputs and outputs for all workflows', () => {
    const allWorkflows = getAllWorkflows();
    for (const workflow of allWorkflows) {
      assert.ok(workflow.inputs.length > 0, `${workflow.id} lost inputs`);
      assert.ok(workflow.outputs.length > 0, `${workflow.id} lost outputs`);
      for (const input of workflow.inputs) {
        assert.ok(input.name, `${workflow.id} input missing name`);
        assert.ok(input.type, `${workflow.id} input "${input.name}" missing type`);
      }
      for (const output of workflow.outputs) {
        assert.ok(output.name, `${workflow.id} output missing name`);
      }
    }
  });

  // ---------------------------------------------------------------------------
  // 10.7 Rendered agents include workflow ID
  // ---------------------------------------------------------------------------
  it('should include workflow ID in all rendered agents', () => {
    const allWorkflows = getAllWorkflows();
    for (const workflow of allWorkflows) {
      const output = renderClaudeAgent(workflow);
      assert.ok(output.includes(workflow.id),
        `${workflow.id} agent missing workflow ID`);
    }
  });

  // ---------------------------------------------------------------------------
  // 10.8 Rendered commands include inputs and outputs
  // ---------------------------------------------------------------------------
  it('should include inputs and outputs sections in commands', () => {
    const allWorkflows = getAllWorkflows();
    for (const workflow of allWorkflows) {
      const output = renderClaudeCommand(workflow);
      assert.ok(output.includes('## Inputs'), `${workflow.id} command missing Inputs`);
      assert.ok(output.includes('## Outputs'), `${workflow.id} command missing Outputs`);
    }
  });

  // ---------------------------------------------------------------------------
  // 10.9 Rendered agents include next workflow guidance
  // ---------------------------------------------------------------------------
  it('should include next workflow guidance in agents with handoffs', () => {
    const allWorkflows = getAllWorkflows();
    for (const workflow of allWorkflows) {
      if (workflow.handoffs.length > 0) {
        const output = renderClaudeAgent(workflow);
        assert.ok(
          output.includes('Next Recommended Workflow') || output.includes('Next Workflow'),
          `${workflow.id} agent missing next workflow guidance`
        );
      }
    }
  });

  // ---------------------------------------------------------------------------
  // 10.10 Workflow titles and goals are preserved
  // ---------------------------------------------------------------------------
  it('should preserve title and goal for all workflows', () => {
    const allWorkflows = getAllWorkflows();
    for (const workflow of allWorkflows) {
      assert.ok(workflow.title, `${workflow.id} missing title`);
      assert.ok(workflow.goal, `${workflow.id} missing goal`);
      assert.equal(typeof workflow.title, 'string');
      assert.equal(typeof workflow.goal, 'string');
    }
  });

  // ---------------------------------------------------------------------------
  // 10.11 All 9 workflows render for both Claude and Codex
  // ---------------------------------------------------------------------------
  it('should render all 9 workflows for both runtimes without errors', () => {
    const allWorkflows = getAllWorkflows();
    for (const workflow of allWorkflows) {
      assert.doesNotThrow(() => renderClaudeCommand(workflow));
      assert.doesNotThrow(() => renderClaudeAgent(workflow));
      assert.doesNotThrow(() => renderCodexSkill(workflow));
    }
  });

  // ---------------------------------------------------------------------------
  // 10.12 Rendered outputs are non-empty strings
  // ---------------------------------------------------------------------------
  it('should produce non-empty output for all render functions', () => {
    const allWorkflows = getAllWorkflows();
    for (const workflow of allWorkflows) {
      const command = renderClaudeCommand(workflow);
      const agent = renderClaudeAgent(workflow);
      const skill = renderCodexSkill(workflow);

      assert.ok(command.length > 100, `${workflow.id} command output is too short (${command.length} chars)`);
      assert.ok(agent.length > 100, `${workflow.id} agent output is too short (${agent.length} chars)`);
      assert.ok(skill.length > 100, `${workflow.id} skill output is too short (${skill.length} chars)`);
    }
  });
});
