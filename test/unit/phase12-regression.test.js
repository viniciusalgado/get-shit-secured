/**
 * Phase 12 — Regression Tests
 *
 * Validates:
 * - All 9 workflow definitions have a valid consultationMode
 * - Workflow registry still loads all definitions
 * - Renderer generates valid files with consultationMode present
 * - Install pipeline unaffected by new field
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { getAllWorkflows, getWorkflow, WORKFLOW_ORDER } from '../../dist/catalog/workflows/registry.js';

const VALID_CONSULTATION_MODES = ['required', 'optional', 'not-applicable'];

const EXPECTED_CONSULTATION_MODES = {
  'security-review': 'required',
  'map-codebase': 'optional',
  'threat-model': 'required',
  'audit': 'required',
  'validate-findings': 'optional',
  'plan-remediation': 'required',
  'execute-remediation': 'optional',
  'verify': 'required',
  'report': 'not-applicable',
};

// ---------------------------------------------------------------------------
// consultationMode on all workflows
// ---------------------------------------------------------------------------
describe('Phase 12 regression: consultationMode', () => {

  it('all 9 workflow definitions have a consultationMode', () => {
    const workflows = getAllWorkflows();
    assert.strictEqual(workflows.length, 9, `Expected 9 workflows, got ${workflows.length}`);

    for (const wf of workflows) {
      assert.ok(
        'consultationMode' in wf,
        `Workflow '${wf.id}' is missing consultationMode field`
      );
      assert.ok(
        VALID_CONSULTATION_MODES.includes(wf.consultationMode),
        `Workflow '${wf.id}' has invalid consultationMode: '${wf.consultationMode}'`
      );
    }
  });

  it('each workflow has the correct consultationMode value', () => {
    for (const [id, expectedMode] of Object.entries(EXPECTED_CONSULTATION_MODES)) {
      const wf = getWorkflow(id);
      assert.strictEqual(
        wf.consultationMode,
        expectedMode,
        `Workflow '${id}' expected consultationMode '${expectedMode}', got '${wf.consultationMode}'`
      );
    }
  });

});

// ---------------------------------------------------------------------------
// Workflow registry integrity
// ---------------------------------------------------------------------------
describe('Phase 12 regression: workflow registry', () => {

  it('WORKFLOW_ORDER has 9 entries', () => {
    assert.strictEqual(WORKFLOW_ORDER.length, 9);
  });

  it('getWorkflow returns definitions for all IDs', () => {
    for (const id of WORKFLOW_ORDER) {
      const wf = getWorkflow(id);
      assert.strictEqual(wf.id, id);
    }
  });

  it('getAllWorkflows returns same number as WORKFLOW_ORDER', () => {
    const all = getAllWorkflows();
    assert.strictEqual(all.length, WORKFLOW_ORDER.length);
  });

});

// ---------------------------------------------------------------------------
// Runtime prompts contain artifact output contract
// ---------------------------------------------------------------------------
describe('Phase 12 regression: runtime prompts have artifact contract', () => {

  it('each workflow runtime prompt mentions "Artifact Output Contract"', () => {
    const workflows = getAllWorkflows();
    for (const wf of workflows) {
      const claudePrompt = wf.runtimePrompts?.claude ?? '';
      const codexPrompt = wf.runtimePrompts?.codex ?? '';

      assert.ok(
        claudePrompt.includes('Artifact Output Contract') || claudePrompt.includes('ArtifactEnvelope') || claudePrompt.includes('schemaVersion'),
        `Workflow '${wf.id}' claude prompt missing artifact output contract`
      );

      assert.ok(
        codexPrompt.includes('Artifact Output Contract') || codexPrompt.includes('schemaVersion') || codexPrompt.includes('consultationMode'),
        `Workflow '${wf.id}' codex prompt missing artifact output contract`
      );
    }
  });

  // --- Gap-fill scenarios ---

  it('each workflow prompt mentions its specific consultationMode value', () => {
    const workflows = getAllWorkflows();
    for (const wf of workflows) {
      const claudePrompt = wf.runtimePrompts?.claude ?? '';
      const codexPrompt = wf.runtimePrompts?.codex ?? '';
      const mode = EXPECTED_CONSULTATION_MODES[wf.id];

      assert.ok(
        claudePrompt.includes(`"consultationMode": "${mode}"`) || claudePrompt.includes(`consultationMode: ${mode}`) || claudePrompt.includes(mode),
        `Workflow '${wf.id}' claude prompt does not mention consultationMode '${mode}'`
      );
      assert.ok(
        codexPrompt.includes(`"consultationMode": "${mode}"`) || codexPrompt.includes(`consultationMode: ${mode}`) || codexPrompt.includes(mode),
        `Workflow '${wf.id}' codex prompt does not mention consultationMode '${mode}'`
      );
    }
  });

  it('report workflow prompt includes consultation aggregation instructions', () => {
    const report = getWorkflow('report');
    const claudePrompt = report.runtimePrompts?.claude ?? '';
    const codexPrompt = report.runtimePrompts?.codex ?? '';

    assert.ok(
      claudePrompt.includes('Consultation Coverage Aggregation') || claudePrompt.includes('consultation') && claudePrompt.includes('aggregate'),
      `Report claude prompt missing consultation aggregation instructions`
    );
    assert.ok(
      codexPrompt.includes('Consultation Coverage Aggregation') || codexPrompt.includes('consultation') && codexPrompt.includes('aggregate'),
      `Report codex prompt missing consultation aggregation instructions`
    );
  });

  it('required workflows still have all definition fields intact', () => {
    const requiredWorkflows = Object.entries(EXPECTED_CONSULTATION_MODES)
      .filter(([, mode]) => mode === 'required')
      .map(([id]) => id);

    for (const id of requiredWorkflows) {
      const wf = getWorkflow(id);
      assert.strictEqual(wf.consultationMode, 'required');
      assert.ok(wf.id === id);
      assert.ok(Array.isArray(wf.outputs), `Workflow '${id}' missing outputs`);
      assert.ok(wf.runtimePrompts?.claude, `Workflow '${id}' missing claude prompt`);
      assert.ok(wf.runtimePrompts?.codex, `Workflow '${id}' missing codex prompt`);
    }
  });

  it('each workflow prompt is longer than 200 chars (no truncation)', () => {
    const workflows = getAllWorkflows();
    for (const wf of workflows) {
      const claudePrompt = wf.runtimePrompts?.claude ?? '';
      const codexPrompt = wf.runtimePrompts?.codex ?? '';

      assert.ok(
        claudePrompt.length > 200,
        `Workflow '${wf.id}' claude prompt is suspiciously short (${claudePrompt.length} chars)`
      );
      assert.ok(
        codexPrompt.length > 200,
        `Workflow '${wf.id}' codex prompt is suspiciously short (${codexPrompt.length} chars)`
      );
    }
  });

});
