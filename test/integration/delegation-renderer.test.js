/**
 * Integration tests for MCP consultation rendering in workflow outputs.
 *
 * Phase 6 replaced delegation plans with MCP consultation sections.
 * These tests verify the new MCP-based consultation rendering.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  renderClaudeAgent,
  renderCodexSkill,
  renderMcpConsultationSection,
} from '../../dist/core/renderer.js';
import { getWorkflow } from '../../dist/catalog/workflows/registry.js';

describe('MCP Consultation Renderer - Claude Agent', () => {
  it('should include MCP consultation section for workflows with signal derivation', () => {
    const workflow = getWorkflow('audit');
    const output = renderClaudeAgent(workflow);

    assert.ok(output.includes('MCP Security Consultation'), 'Should include MCP Security Consultation heading');
    assert.ok(output.includes('get_workflow_consultation_plan'), 'Should mention consultation plan tool');
  });

  it('should include MCP consultation section for verify workflow', () => {
    const workflow = getWorkflow('verify');
    const output = renderClaudeAgent(workflow);

    assert.ok(output.includes('MCP Security Consultation'), 'Verify should include MCP consultation section');
  });

  it('should include MCP consultation section for report workflow (even with none derivation)', () => {
    const workflow = getWorkflow('report');
    const output = renderClaudeAgent(workflow);

    // Report has signalDerivation with all "none" values but still gets MCP section
    assert.ok(output.includes('MCP Security Consultation'), 'Report should include MCP consultation section');
  });
});

describe('MCP Consultation Renderer - Codex Skill', () => {
  it('should include MCP consultation section for workflows with signal derivation', () => {
    const workflow = getWorkflow('plan-remediation');
    const output = renderCodexSkill(workflow);

    assert.ok(output.includes('MCP Security Consultation'), 'Should include MCP Security Consultation heading');
  });

  it('should include consultation tool details in Codex output', () => {
    const workflow = getWorkflow('execute-remediation');
    const output = renderCodexSkill(workflow);

    assert.ok(output.includes('get_workflow_consultation_plan'), 'Should include consultation plan tool');
    assert.ok(output.includes('validate_security_consultation'), 'Should include validation tool');
  });
});

describe('MCP Consultation Renderer - renderMcpConsultationSection', () => {
  it('should return empty string for workflow without signal derivation', () => {
    // Create a minimal workflow object without signalDerivation
    const workflowWithoutSig = {
      ...getWorkflow('audit'),
      signalDerivation: undefined,
    };
    const result = renderMcpConsultationSection(workflowWithoutSig);
    assert.equal(result, '');
  });

  it('should return non-empty string for workflow with signal derivation', () => {
    const workflow = getWorkflow('audit');
    const result = renderMcpConsultationSection(workflow);
    assert.ok(result.length > 0);
    assert.ok(result.includes('MCP Security Consultation'));
    assert.ok(result.includes('get_workflow_consultation_plan'));
    assert.ok(result.includes('validate_security_consultation'));
    assert.ok(result.includes('consultation'));
  });
});

describe('MCP Consultation Renderer - Regression', () => {
  it('should render orchestration section for security-review workflow', () => {
    const workflow = getWorkflow('security-review');
    const claudeOutput = renderClaudeAgent(workflow);
    const codexOutput = renderCodexSkill(workflow);

    assert.ok(claudeOutput.includes('## Orchestration'));
    assert.ok(codexOutput.includes('## Orchestration'));
    assert.ok(claudeOutput.includes('collect-change-set'));
    assert.ok(codexOutput.includes('validation-and-tdd'));
  });

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
