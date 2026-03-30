/**
 * Unit tests for workflow renderer.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Import from built dist
import {
  renderClaudeCommand,
  renderClaudeAgent,
  renderCodexSkill,
  renderCommandsReadme,
  renderAgentsReadme,
  renderSkillsReadme,
  renderHelpCommand,
} from '../../dist/core/renderer.js';
import { getWorkflow, getAllWorkflows } from '../../dist/catalog/workflows/registry.js';

describe('Renderer - Claude Command', () => {
  const workflow = getWorkflow('map-codebase');

  it('should render command frontmatter', () => {
    const output = renderClaudeCommand(workflow);
    assert.ok(output.startsWith('---'));
    assert.ok(output.includes('description:'));
  });

  it('should include workflow goal in description', () => {
    const output = renderClaudeCommand(workflow);
    assert.ok(output.includes(workflow.goal));
  });

  it('should include inputs section', () => {
    const output = renderClaudeCommand(workflow);
    assert.ok(output.includes('## Inputs'));
    for (const input of workflow.inputs) {
      assert.ok(output.includes(input.name));
    }
  });

  it('should include outputs section', () => {
    const output = renderClaudeCommand(workflow);
    assert.ok(output.includes('## Outputs'));
    for (const outputItem of workflow.outputs) {
      assert.ok(output.includes(outputItem.name));
    }
  });

  it('should include dependencies section', () => {
    const output = renderClaudeCommand(workflow);
    assert.ok(output.includes('## Dependencies'));
  });

  it('should include guardrails section if guardrails exist', () => {
    const output = renderClaudeCommand(workflow);
    assert.ok(output.includes('## Guardrails'));
    for (const guardrail of workflow.guardrails) {
      assert.ok(output.includes(guardrail.type));
    }
  });
});

describe('Renderer - Claude Agent', () => {
  const workflow = getWorkflow('threat-model');

  it('should render agent header', () => {
    const output = renderClaudeAgent(workflow);
    assert.ok(output.startsWith('# '));
    assert.ok(output.includes('**Workflow ID:**'));
    assert.ok(output.includes(workflow.id));
  });

  it('should include OWASP topics', () => {
    const output = renderClaudeAgent(workflow);
    assert.ok(output.includes('## OWASP Topics'));
    for (const topic of workflow.owaspTopics) {
      assert.ok(output.includes(topic.name));
    }
  });

  it('should include cheat sheet URLs', () => {
    const output = renderClaudeAgent(workflow);
    assert.ok(output.includes('owasp.org'));
  });

  it('should include inputs with types', () => {
    const output = renderClaudeAgent(workflow);
    assert.ok(output.includes('## Inputs'));
    for (const input of workflow.inputs) {
      assert.ok(output.includes(input.name));
      assert.ok(output.includes(input.type));
    }
  });

  it('should include outputs with paths', () => {
    const output = renderClaudeAgent(workflow);
    assert.ok(output.includes('## Outputs'));
    for (const outputItem of workflow.outputs) {
      assert.ok(output.includes(outputItem.name));
      if (outputItem.path) {
        assert.ok(output.includes(outputItem.path));
      }
    }
  });

  it('should include handoffs section', () => {
    const output = renderClaudeAgent(workflow);
    assert.ok(output.includes('## Handoffs'));
    for (const handoff of workflow.handoffs) {
      assert.ok(output.includes(handoff.nextWorkflow));
    }
  });

  it('should include workflow steps', () => {
    const output = renderClaudeAgent(workflow);
    assert.ok(output.includes('## Workflow Steps'));
    for (const step of workflow.steps) {
      assert.ok(output.includes(step.title));
      assert.ok(output.includes(step.instructions));
    }
  });

  it('should include guardrails by type', () => {
    const output = renderClaudeAgent(workflow);
    assert.ok(output.includes('## Guardrails'));
    for (const guardrail of workflow.guardrails) {
      assert.ok(output.includes(`### ${guardrail.type}`));
      assert.ok(output.includes(guardrail.description));
    }
  });

  it('should include runtime prompts for Claude', () => {
    const output = renderClaudeAgent(workflow);
    assert.ok(output.includes('## Runtime Instructions'));
    assert.ok(output.includes('artifacts to .gss/artifacts/'));
  });
});

describe('Renderer - Codex Skill', () => {
  const workflow = getWorkflow('audit');

  it('should render skill header', () => {
    const output = renderCodexSkill(workflow);
    assert.ok(output.startsWith('# '));
    assert.ok(output.includes('**Workflow ID:**'));
  });

  it('should include OWASP standards section', () => {
    const output = renderCodexSkill(workflow);
    assert.ok(output.includes('## OWASP Standards'));
  });

  it('should include prerequisites (dependencies)', () => {
    const output = renderCodexSkill(workflow);
    assert.ok(output.includes('## Prerequisites'));
    for (const dep of workflow.dependencies) {
      assert.ok(output.includes(dep.workflowId));
    }
  });

  it('should include procedure steps', () => {
    const output = renderCodexSkill(workflow);
    assert.ok(output.includes('## Procedure'));
    assert.ok(output.includes('**'));
  });

  it('should include guardrails section', () => {
    const output = renderCodexSkill(workflow);
    assert.ok(output.includes('## Guardrails'));
  });

  it('should include runtime guidance for Codex', () => {
    const output = renderCodexSkill(workflow);
    if (workflow.runtimePrompts.codex) {
      assert.ok(output.includes('## Runtime Guidance'));
    }
  });
});

describe('Renderer - README Files', () => {
  const allWorkflows = getAllWorkflows();

  it('should render commands README with all workflows', () => {
    const output = renderCommandsReadme(allWorkflows);
    assert.ok(output.includes('# get-shit-secured Commands'));
    assert.ok(output.includes('## Available Commands'));

    for (const workflow of allWorkflows) {
      assert.ok(output.includes(`/gss-${workflow.id}`));
      assert.ok(output.includes(workflow.title));
    }
  });

  it('should include workflow chain in commands README', () => {
    const output = renderCommandsReadme(allWorkflows);
    assert.ok(output.includes('## Workflow Execution Order'));
    assert.ok(output.includes('map-codebase'));
  });

  it('should render agents README with all workflows', () => {
    const output = renderAgentsReadme(allWorkflows);
    assert.ok(output.includes('# get-shit-secured Agents'));
    assert.ok(output.includes('## Available Agents'));

    for (const workflow of allWorkflows) {
      assert.ok(output.includes(`gss-${workflow.id}`));
    }
  });

  it('should render skills README with all workflows', () => {
    const output = renderSkillsReadme(allWorkflows);
    assert.ok(output.includes('# get-shit-secured Skills'));
    assert.ok(output.includes('## Available Skills'));

    for (const workflow of allWorkflows) {
      assert.ok(output.includes(`gss-${workflow.id}`));
    }
  });

  it('should render help command with table', () => {
    const output = renderHelpCommand(allWorkflows);
    assert.ok(output.includes('---'));
    assert.ok(output.includes('description:'));
    assert.ok(output.includes('| Command |'));
    assert.ok(output.includes('| Requires |'));
  });

  it('should include quick start in help command', () => {
    const output = renderHelpCommand(allWorkflows);
    assert.ok(output.includes('## Quick Start'));
    assert.ok(output.includes('/gss-map-codebase'));
    assert.ok(output.includes('/gss-report'));
  });

  it('should include OWASP reference in help command', () => {
    const output = renderHelpCommand(allWorkflows);
    assert.ok(output.includes('OWASP'));
    assert.ok(output.includes('owasp.org'));
  });
});

describe('Renderer Content Quality', () => {
  it('should generate proper markdown formatting', () => {
    const workflow = getWorkflow('remediate');
    const command = renderClaudeCommand(workflow);
    const agent = renderClaudeAgent(workflow);

    // Check for proper heading levels
    assert.ok(command.match(/^#+\s/m));
    assert.ok(agent.match(/^#+\s/m));

    // Check for lists
    assert.ok(command.match(/^-\s+/m));
    assert.ok(agent.match(/^-\s+/m));
  });

  it('should preserve OWASP URLs in rendered output', () => {
    const workflow = getWorkflow('threat-model');
    const agent = renderClaudeAgent(workflow);

    // Check for OWASP URLs
    assert.ok(agent.includes('https://cheatsheetseries.owasp.org/'));
  });

  it('should include artifact paths in outputs', () => {
    const workflow = getWorkflow('map-codebase');
    const agent = renderClaudeAgent(workflow);

    assert.ok(agent.includes('.gss/artifacts/'));
  });

  it('should show dependency information for workflows with dependencies', () => {
    const audit = getWorkflow('audit');
    const command = renderClaudeCommand(audit);

    assert.ok(command.includes('map-codebase'));
  });

  it('should show handoff information for workflows with next steps', () => {
    const mapCodebase = getWorkflow('map-codebase');
    const agent = renderClaudeAgent(mapCodebase);

    assert.ok(agent.includes('threat-model'));
    assert.ok(agent.includes('audit'));
  });
});
