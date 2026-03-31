import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { getAllWorkflows, getEntryWorkflows, getWorkflow } from '../../dist/catalog/workflows/registry.js';
import { getSpecialistsForWorkflow } from '../../dist/catalog/specialists/mapping.js';

describe('security-review workflow', () => {
  it('should exist as an entry workflow and appear before map-codebase', () => {
    const workflow = getWorkflow('security-review');
    assert.equal(workflow.id, 'security-review');
    assert.equal(workflow.dependencies.length, 0);

    const entryIds = getEntryWorkflows().map((w) => w.id);
    assert.ok(entryIds.includes('security-review'));

    const orderedIds = getAllWorkflows().map((w) => w.id);
    assert.ok(orderedIds.indexOf('security-review') < orderedIds.indexOf('map-codebase'));
  });

  it('should define diff and commit input semantics', () => {
    const workflow = getWorkflow('security-review');

    const changeSet = workflow.inputs.find((i) => i.name === 'change-set');
    const commitRef = workflow.inputs.find((i) => i.name === 'commit-ref');

    assert.ok(changeSet);
    assert.equal(changeSet.required, true);
    assert.ok(commitRef);
    assert.equal(commitRef.required, false);

    assert.ok(workflow.runtimePrompts.claude.includes('uncommitted'));
    assert.ok(workflow.runtimePrompts.claude.includes('commit-ref'));
  });

  it('should define required output artifacts', () => {
    const workflow = getWorkflow('security-review');
    const outputNames = workflow.outputs.map((o) => o.name);
    const outputPaths = workflow.outputs.map((o) => o.path);

    assert.ok(outputNames.includes('change-scope'));
    assert.ok(outputNames.includes('delegation-plan'));
    assert.ok(outputNames.includes('findings'));
    assert.ok(outputNames.includes('validation-report'));
    assert.ok(outputNames.includes('security-test-specs'));

    assert.ok(outputPaths.includes('.gss/artifacts/security-review/change-scope.json'));
    assert.ok(outputPaths.includes('.gss/artifacts/security-review/security-test-specs.json'));
  });

  it('should include deterministic orchestration phases in order', () => {
    const workflow = getWorkflow('security-review');
    const phaseIds = workflow.orchestration.phases.map((p) => p.id);

    assert.deepEqual(phaseIds, [
      'collect-change-set',
      'security-relevance-gate',
      'impact-pass',
      'audit-pass',
      'specialist-pass',
      'validation-and-tdd',
      'finalize',
    ]);
  });

  it('should include core and stack-conditioned specialists', () => {
    const base = getSpecialistsForWorkflow('security-review');
    assert.ok(base.includes('secure-code-review'));
    assert.ok(base.includes('threat-modeling'));
    assert.ok(base.includes('attack-surface-analysis'));

    const django = getSpecialistsForWorkflow('security-review', ['django']);
    assert.ok(django.includes('django-security'));
    assert.ok(django.includes('django-rest-framework'));
  });
});
