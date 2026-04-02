/**
 * Phase 6 — MCP Consultation Section Renderer Tests
 *
 * Validates that renderMcpConsultationSection() and renderConsultationTraceRequirement()
 * produce correct MCP consultation instructions.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  renderMcpConsultationSection,
  renderConsultationTraceRequirement,
} from '../../dist/core/renderer.js';
import { getWorkflow, getAllWorkflows } from '../../dist/catalog/workflows/registry.js';

describe('Phase 6 — MCP Consultation Section Renderer', () => {

  // ---------------------------------------------------------------------------
  // 2.1 renderMcpConsultationSection produces all 7 MCP steps
  // ---------------------------------------------------------------------------
  describe('All 7 MCP steps', () => {
    const workflowsWithSignals = ['security-review', 'audit', 'verify'];

    for (const id of workflowsWithSignals) {
      it(`should render all 7 steps for ${id}`, () => {
        const workflow = getWorkflow(id);
        const output = renderMcpConsultationSection(workflow);

        assert.ok(output.includes('## MCP Security Consultation'),
          `Missing MCP header for ${id}`);
        assert.ok(output.includes('Step 1: Derive Signals'),
          `Missing Step 1 for ${id}`);
        assert.ok(output.includes('Step 2: Get Consultation Plan'),
          `Missing Step 2 for ${id}`);
        assert.ok(output.includes('Step 3: Read Required Documents'),
          `Missing Step 3 for ${id}`);
        assert.ok(output.includes('Step 4: Optionally Expand'),
          `Missing Step 4 for ${id}`);
        assert.ok(output.includes('Step 5: Perform Reasoning'),
          `Missing Step 5 for ${id}`);
        assert.ok(output.includes('Step 6: Validate Coverage'),
          `Missing Step 6 for ${id}`);
        assert.ok(output.includes('Step 7: Include Consultation Trace'),
          `Missing Step 7 for ${id}`);
      });
    }
  });

  // ---------------------------------------------------------------------------
  // 2.2 MCP section includes correct workflowId in tool calls
  // ---------------------------------------------------------------------------
  it('should include workflowId in get_workflow_consultation_plan call', () => {
    const workflow = getWorkflow('security-review');
    const output = renderMcpConsultationSection(workflow);

    assert.ok(output.includes(`workflowId="${workflow.id}"`),
      'Missing workflowId in MCP tool call');
    assert.ok(output.includes('get_workflow_consultation_plan'),
      'Missing get_workflow_consultation_plan tool reference');
    assert.ok(output.includes('validate_security_consultation'),
      'Missing validate_security_consultation tool reference');
  });

  // ---------------------------------------------------------------------------
  // 2.3 MCP section includes signal derivation instructions
  // ---------------------------------------------------------------------------
  it('should include signal derivation descriptions', () => {
    const workflow = getWorkflow('audit');
    const output = renderMcpConsultationSection(workflow);

    assert.ok(output.includes('stacks'), 'Missing stacks signal');
    assert.ok(output.includes('issueTags'), 'Missing issueTags signal');
    assert.ok(output.includes('changedFiles'), 'Missing changedFiles signal');
  });

  // ---------------------------------------------------------------------------
  // 2.4 MCP section includes consultation trace JSON schema
  // ---------------------------------------------------------------------------
  it('should include consultation trace JSON example', () => {
    const workflow = getWorkflow('audit');
    const output = renderMcpConsultationSection(workflow);

    assert.ok(output.includes('"consultation"'), 'Missing consultation key');
    assert.ok(output.includes('"plan"'), 'Missing plan key');
    assert.ok(output.includes('"consultedDocs"'), 'Missing consultedDocs key');
    assert.ok(output.includes('"coverageStatus"'), 'Missing coverageStatus key');
    assert.ok(output.includes('"requiredMissing"'), 'Missing requiredMissing key');
    assert.ok(output.includes('"notes"'), 'Missing notes key');
  });

  // ---------------------------------------------------------------------------
  // 2.5 MCP section includes security:// URI format
  // ---------------------------------------------------------------------------
  it('should include security:// URI for reading documents', () => {
    const workflow = getWorkflow('threat-model');
    const output = renderMcpConsultationSection(workflow);

    assert.ok(output.includes('security://owasp/cheatsheet/'),
      'Missing MCP resource URI format');
  });

  // ---------------------------------------------------------------------------
  // 2.6 renderConsultationTraceRequirement produces output
  // ---------------------------------------------------------------------------
  it('should render consultation trace requirement', () => {
    const output = renderConsultationTraceRequirement('audit');

    assert.ok(output.toLowerCase().includes('consultation'), 'Missing "consultation" in trace requirement');
    assert.ok(output.includes('coverageStatus'), 'Missing "coverageStatus" in trace requirement');
    assert.ok(output.includes('pass'), 'Missing "pass" in trace requirement');
    assert.ok(output.includes('warn'), 'Missing "warn" in trace requirement');
    assert.ok(output.includes('fail'), 'Missing "fail" in trace requirement');
  });

  // ---------------------------------------------------------------------------
  // 2.7 MCP section is host-neutral (no Claude/Codex-specific references)
  // ---------------------------------------------------------------------------
  it('should produce host-neutral MCP instructions', () => {
    const workflow = getWorkflow('audit');
    const output = renderMcpConsultationSection(workflow);

    // Should NOT contain host-specific formatting
    assert.ok(!output.includes('## Runtime Instructions'),
      'MCP section should not contain Claude-specific section headers');
    assert.ok(!output.includes('## Runtime Guidance'),
      'MCP section should not contain Codex-specific section headers');
  });

  // ---------------------------------------------------------------------------
  // 2.8 MCP section includes fallback guidance
  // ---------------------------------------------------------------------------
  it('should include fallback guidance for MCP unavailability', () => {
    const workflow = getWorkflow('audit');
    const output = renderMcpConsultationSection(workflow);

    assert.ok(output.includes('Fallback') || output.includes('unavailable'),
      'Missing fallback guidance for MCP unavailability');
  });

  // ---------------------------------------------------------------------------
  // 2.9 MCP section includes get_related_security_docs reference
  // ---------------------------------------------------------------------------
  it('should reference get_related_security_docs in expansion step', () => {
    const workflow = getWorkflow('audit');
    const output = renderMcpConsultationSection(workflow);

    assert.ok(output.includes('get_related_security_docs'),
      'Missing get_related_security_docs in expansion step');
  });

  // ---------------------------------------------------------------------------
  // 2.10 Empty output for workflows without signalDerivation (backward compat)
  // ---------------------------------------------------------------------------
  it('should return empty string for workflows without signalDerivation', () => {
    // If all 9 have signalDerivation, this tests the fallback gracefully
    const allWorkflows = getAllWorkflows();
    for (const workflow of allWorkflows) {
      if (!workflow.signalDerivation) {
        const output = renderMcpConsultationSection(workflow);
        assert.equal(output, '',
          `Expected empty output for ${workflow.id} without signalDerivation, got non-empty`);
      }
    }
    // If all have signalDerivation, the test passes vacuously
  });
});
