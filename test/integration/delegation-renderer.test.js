/**
 * Integration tests for delegation plan rendering in workflow outputs.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  renderClaudeAgent,
  renderCodexSkill,
  renderClaudeDelegationPlanSection,
  renderCodexDelegationPlanSection,
} from '../../dist/core/renderer.js';
import { getWorkflow } from '../../dist/catalog/workflows/registry.js';

describe('Delegation Renderer - Claude Agent', () => {
  it('should include delegation plan section for workflows with delegation policy', () => {
    const workflow = getWorkflow('audit');
    const output = renderClaudeAgent(workflow);

    assert.ok(output.includes('Delegation Plan'), 'Should include Delegation Plan heading');
    assert.ok(output.includes('deterministic delegation planning'), 'Should mention deterministic planning');
  });

  it('should include consultation constraints in Claude agent output', () => {
    const workflow = getWorkflow('verify');
    const output = renderClaudeAgent(workflow);

    assert.ok(output.includes('Delegation Plan'), 'Verify should include delegation plan');
  });

  it('should NOT include delegation plan section for workflows without delegation policy', () => {
    const workflow = getWorkflow('report');
    const output = renderClaudeAgent(workflow);

    // Report has mode 'none' so delegation plan section should be empty or absent
    // The section should either not appear or be empty
    const hasDelegationPlan = output.includes('## Delegation Plan');
    // Since report has delegationPolicy with mode 'none', it should still render but show none mode
    // Actually with mode 'none', the function returns empty string
    assert.ok(!hasDelegationPlan, 'Report should not include delegation plan section');
  });
});

describe('Delegation Renderer - Codex Skill', () => {
  it('should include delegation plan section for workflows with delegation policy', () => {
    const workflow = getWorkflow('plan-remediation');
    const output = renderCodexSkill(workflow);

    assert.ok(output.includes('Delegation Plan'), 'Should include Delegation Plan heading');
  });

  it('should include constraint details in Codex output', () => {
    const workflow = getWorkflow('execute-remediation');
    const output = renderCodexSkill(workflow);

    assert.ok(output.includes('Constraints') || output.includes('constraint'), 'Should include constraint details');
  });
});

describe('Delegation Renderer - renderClaudeDelegationPlanSection', () => {
  it('should return empty string for workflow without delegation policy', () => {
    const workflow = getWorkflow('report');
    const result = renderClaudeDelegationPlanSection(workflow);
    assert.equal(result, '');
  });

  it('should return non-empty string for workflow with delegation policy', () => {
    const workflow = getWorkflow('audit');
    const result = renderClaudeDelegationPlanSection(workflow);
    assert.ok(result.length > 0);
    assert.ok(result.includes('Delegation Plan'));
    assert.ok(result.includes('specialist-results.json'));
    assert.ok(result.includes('delegation-plan.json'));
    assert.ok(result.includes('delegation-compliance.json'));
  });
});

describe('Delegation Renderer - Regression', () => {
  it('should not break existing Claude agent rendering', () => {
    const workflow = getWorkflow('map-codebase');
    const output = renderClaudeAgent(workflow);

    assert.ok(output.includes('## Description'));
    assert.ok(output.includes('## OWASP Topics'));
    assert.ok(output.includes('## "Done" Means'));
    assert.ok(output.includes('## Guardrails'));
  });

  it('should not break existing Codex skill rendering', () => {
    const workflow = getWorkflow('map-codebase');
    const output = renderCodexSkill(workflow);

    assert.ok(output.includes('## Description'));
    assert.ok(output.includes('## Completion Criteria'));
    assert.ok(output.includes('## Guardrails'));
  });
});
