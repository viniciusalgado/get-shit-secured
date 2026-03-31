/**
 * Unit tests for workflow registry.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Import from built dist
import {
  getWorkflow,
  getAllWorkflows,
  getEntryWorkflows,
  getNextWorkflows,
  areDependenciesSatisfied,
  getExecutableOrder,
  getWorkflowSummary,
  WORKFLOW_REGISTRY,
} from '../../dist/catalog/workflows/registry.js';

describe('Workflow Registry', () => {
  it('should have all 9 workflows registered', () => {
    const workflows = getAllWorkflows();
    assert.equal(workflows.length, 9);

    const workflowIds = workflows.map((w) => w.id);
    assert.ok(workflowIds.includes('security-review'));
    assert.ok(workflowIds.includes('map-codebase'));
    assert.ok(workflowIds.includes('threat-model'));
    assert.ok(workflowIds.includes('audit'));
    assert.ok(workflowIds.includes('validate-findings'));
    assert.ok(workflowIds.includes('plan-remediation'));
    assert.ok(workflowIds.includes('execute-remediation'));
    assert.ok(workflowIds.includes('verify'));
    assert.ok(workflowIds.includes('report'));
  });

  it('should return workflow by ID', () => {
    const workflow = getWorkflow('map-codebase');
    assert.equal(workflow.id, 'map-codebase');
    assert.equal(typeof workflow.title, 'string');
    assert.equal(typeof workflow.goal, 'string');
    assert.ok(Array.isArray(workflow.owaspTopics));
    assert.ok(Array.isArray(workflow.inputs));
    assert.ok(Array.isArray(workflow.outputs));
    assert.ok(Array.isArray(workflow.steps));
  });

  it('should throw for unknown workflow ID', () => {
    assert.throws(() => {
      getWorkflow('unknown-workflow');
    });
  });

  it('should identify entry workflows (no dependencies)', () => {
    const entryWorkflows = getEntryWorkflows();
    assert.ok(entryWorkflows.length > 0);

    // security-review should be an entry workflow
    const securityReview = entryWorkflows.find((w) => w.id === 'security-review');
    assert.ok(securityReview, 'security-review should be an entry workflow');
    assert.equal(securityReview.dependencies.length, 0);

    // map-codebase should also be an entry workflow
    const mapCodebase = entryWorkflows.find((w) => w.id === 'map-codebase');
    assert.ok(mapCodebase, 'map-codebase should be an entry workflow');
    assert.equal(mapCodebase.dependencies.length, 0);
  });

  it('should get next workflows after a given workflow', () => {
    const nextAfterMap = getNextWorkflows('map-codebase');
    assert.ok(nextAfterMap.length > 0);
    assert.ok(nextAfterMap.some((w) => w.id === 'threat-model'));
    assert.ok(nextAfterMap.some((w) => w.id === 'audit'));
  });

  it('should check if dependencies are satisfied', () => {
    // map-codebase has no dependencies
    assert.ok(areDependenciesSatisfied('map-codebase', []));

    // threat-model requires map-codebase
    assert.ok(!areDependenciesSatisfied('threat-model', []));
    assert.ok(areDependenciesSatisfied('threat-model', ['map-codebase']));

    // audit requires map-codebase
    assert.ok(!areDependenciesSatisfied('audit', []));
    assert.ok(areDependenciesSatisfied('audit', ['map-codebase']));
  });

  it('should return workflows in executable order', () => {
    const order = getExecutableOrder();
    assert.equal(order.length, 9);

    // First workflow should be security-review (entry + first in canonical order)
    assert.equal(order[0].id, 'security-review');
  });

  it('should provide workflow summary', () => {
    const summary = getWorkflowSummary();
    assert.equal(summary.length, 9);

    const mapSummary = summary.find((s) => s.id === 'map-codebase');
    assert.ok(mapSummary);
    assert.equal(typeof mapSummary.title, 'string');
    assert.equal(typeof mapSummary.goal, 'string');
    assert.ok(Array.isArray(mapSummary.inputs));
    assert.ok(Array.isArray(mapSummary.outputs));
    assert.ok(Array.isArray(mapSummary.dependencies));
  });
});

describe('Workflow Definition Structure', () => {
  it('should have complete workflow definition structure for map-codebase', () => {
    const workflow = getWorkflow('map-codebase');

    // Basic properties
    assert.equal(workflow.id, 'map-codebase');
    assert.ok(workflow.title.length > 0);
    assert.ok(workflow.goal.length > 0);

    // OWASP topics
    assert.ok(workflow.owaspTopics.length > 0);
    const firstTopic = workflow.owaspTopics[0];
    assert.ok(firstTopic.name);
    assert.ok(Array.isArray(firstTopic.cheatSheetUrls));

    // Inputs
    assert.ok(workflow.inputs.length > 0);
    const firstInput = workflow.inputs[0];
    assert.ok(firstInput.name);
    assert.ok(firstInput.type);
    assert.equal(typeof firstInput.required, 'boolean');
    assert.ok(firstInput.description);

    // Outputs
    assert.ok(workflow.outputs.length > 0);
    const firstOutput = workflow.outputs[0];
    assert.ok(firstOutput.name);
    assert.ok(firstOutput.type);
    assert.ok(firstOutput.description);
    assert.ok(firstOutput.path);

    // Dependencies
    assert.ok(Array.isArray(workflow.dependencies));

    // Handoffs
    assert.ok(workflow.handoffs.length > 0);
    const firstHandoff = workflow.handoffs[0];
    assert.ok(firstHandoff.nextWorkflow);
    assert.ok(Array.isArray(firstHandoff.outputsToPass));

    // Steps
    assert.ok(workflow.steps.length > 0);
    const firstStep = workflow.steps[0];
    assert.ok(firstStep.id);
    assert.ok(firstStep.title);
    assert.ok(firstStep.instructions.length > 0);

    // Guardrails
    assert.ok(workflow.guardrails.length > 0);
    const firstGuardrail = workflow.guardrails[0];
    assert.ok(['preflight', 'approval', 'mutation', 'scope'].includes(firstGuardrail.type));
    assert.ok(firstGuardrail.description);
    assert.ok(firstGuardrail.condition);

    // Runtime prompts
    assert.ok(workflow.runtimePrompts);
    assert.ok(workflow.runtimePrompts.claude || workflow.runtimePrompts.codex);
  });

  it('should have OWASP topics with cheat sheet URLs', () => {
    const workflow = getWorkflow('threat-model');

    const threatModelingTopic = workflow.owaspTopics.find(
      (t) => t.name === 'Threat Modeling'
    );
    assert.ok(threatModelingTopic, 'Should have Threat Modeling topic');
    assert.ok(threatModelingTopic.cheatSheetUrls);
    assert.ok(threatModelingTopic.cheatSheetUrls.length > 0);
    assert.ok(
      threatModelingTopic.cheatSheetUrls.some((url) => url.includes('owasp.org'))
    );
  });

  it('should have correct workflow chain dependencies', () => {
    const threatModel = getWorkflow('threat-model');
    assert.ok(threatModel.dependencies.some((d) => d.workflowId === 'map-codebase'));

    const audit = getWorkflow('audit');
    assert.ok(audit.dependencies.some((d) => d.workflowId === 'map-codebase'));

    const validateFindings = getWorkflow('validate-findings');
    assert.ok(validateFindings.dependencies.some((d) => d.workflowId === 'audit'));

    const planRemediation = getWorkflow('plan-remediation');
    assert.ok(planRemediation.dependencies.some((d) => d.workflowId === 'validate-findings'));

    const executeRemediation = getWorkflow('execute-remediation');
    assert.ok(executeRemediation.dependencies.some((d) => d.workflowId === 'plan-remediation'));

    const verify = getWorkflow('verify');
    assert.ok(verify.dependencies.some((d) => d.workflowId === 'plan-remediation'));
    assert.ok(verify.dependencies.some((d) => d.workflowId === 'execute-remediation'));
  });
});
