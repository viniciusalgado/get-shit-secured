import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { getWorkflow, getAllWorkflows } from '../../dist/catalog/workflows/registry.js';

describe('validate-findings workflow', () => {
  it('should exist in the registry and appear after audit', () => {
    const workflow = getWorkflow('validate-findings');
    assert.equal(workflow.id, 'validate-findings');
    assert.equal(workflow.title, 'Findings Validation');

    const orderedIds = getAllWorkflows().map((w) => w.id);
    assert.ok(orderedIds.indexOf('audit') < orderedIds.indexOf('validate-findings'));
    assert.ok(orderedIds.indexOf('validate-findings') < orderedIds.indexOf('plan-remediation'));
  });

  it('should depend on audit workflow', () => {
    const workflow = getWorkflow('validate-findings');
    assert.ok(workflow.dependencies.length > 0);
    assert.ok(workflow.dependencies.some((d) => d.workflowId === 'audit'));
  });

  it('should define required input artifacts', () => {
    const workflow = getWorkflow('validate-findings');

    const findingsReport = workflow.inputs.find((i) => i.name === 'findings-report');
    assert.ok(findingsReport);
    assert.equal(findingsReport.required, true);

    const remediationPriorities = workflow.inputs.find((i) => i.name === 'remediation-priorities');
    assert.ok(remediationPriorities);
    assert.equal(remediationPriorities.required, true);

    const owaspMapping = workflow.inputs.find((i) => i.name === 'owasp-mapping');
    assert.ok(owaspMapping);
    assert.equal(owaspMapping.required, false);
  });

  it('should define required output artifacts', () => {
    const workflow = getWorkflow('validate-findings');
    const outputNames = workflow.outputs.map((o) => o.name);
    const outputPaths = workflow.outputs.map((o) => o.path);

    assert.ok(outputNames.includes('validated-findings'));
    assert.ok(outputNames.includes('validation-report'));
    assert.ok(outputNames.includes('exploitation-tests'));
    assert.ok(outputNames.includes('re-evaluation-report'));
    assert.ok(outputNames.includes('tdd-test-document'));

    assert.ok(outputPaths.every((p) => p.startsWith('.gss/artifacts/validate-findings/')));
  });

  it('should hand off to plan-remediation and report', () => {
    const workflow = getWorkflow('validate-findings');

    const planRemediation = workflow.handoffs.find((h) => h.nextWorkflow === 'plan-remediation');
    assert.ok(planRemediation);
    assert.ok(planRemediation.outputsToPass.includes('validated-findings'));
    assert.ok(planRemediation.outputsToPass.includes('tdd-test-document'));

    const report = workflow.handoffs.find((h) => h.nextWorkflow === 'report');
    assert.ok(report);
    assert.ok(report.outputsToPass.includes('validation-report'));
  });

  it('should have 8 validation steps in correct order', () => {
    const workflow = getWorkflow('validate-findings');
    const stepIds = workflow.steps.map((s) => s.id);

    assert.deepEqual(stepIds, [
      'ingest-findings',
      'generate-exploitation-tests',
      'run-unit-validation',
      'run-integration-validation',
      'run-e2e-validation',
      'classify-findings',
      're-evaluate-unconfirmed',
      'compile-validated-findings',
    ]);
  });

  it('should have steps covering the validation pipeline', () => {
    const workflow = getWorkflow('validate-findings');
    const stepIds = workflow.steps.map((s) => s.id);
    assert.ok(stepIds.includes('ingest-findings'));
    assert.ok(stepIds.includes('classify-findings'));
    assert.ok(stepIds.includes('compile-validated-findings'));
  });

  it('should use gss-verifier as lead for validation phases in runtime prompts', () => {
    const workflow = getWorkflow('validate-findings');
    assert.ok(workflow.runtimePrompts.claude);
    assert.ok(workflow.runtimePrompts.claude.includes('MCP'));
  });

  it('should have appropriate guardrails', () => {
    const workflow = getWorkflow('validate-findings');
    const guardrailTypes = workflow.guardrails.map((g) => g.type);

    assert.ok(guardrailTypes.includes('preflight'));
    assert.ok(guardrailTypes.includes('mutation'));
    assert.ok(guardrailTypes.includes('approval'));
    assert.ok(guardrailTypes.includes('scope'));
  });

  it('should have on-detection signal derivation', () => {
    const workflow = getWorkflow('validate-findings');
    assert.ok(workflow.signalDerivation);
    assert.equal(workflow.signalDerivation.stacks, 'from-prior-artifact');
    assert.equal(workflow.signalDerivation.issueTags, 'from-findings');
    assert.equal(workflow.signalDerivation.changedFiles, 'none');
  });

  it('should have runtime prompts for both Claude and Codex', () => {
    const workflow = getWorkflow('validate-findings');
    assert.ok(workflow.runtimePrompts.claude);
    assert.ok(workflow.runtimePrompts.codex);
    assert.ok(workflow.runtimePrompts.claude.includes('validate'));
    assert.ok(workflow.runtimePrompts.claude.includes('.gss/artifacts/validate-findings/'));
  });
});
