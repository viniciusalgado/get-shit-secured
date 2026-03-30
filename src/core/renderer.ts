/**
 * Workflow Renderer
 *
 * Converts workflow definitions into runtime-specific file content.
 * Supports Claude commands/agents, Codex skills, and specialists.
 */

import type {
  WorkflowDefinition,
  WorkflowInput,
  WorkflowOutput,
  WorkflowDependency,
  WorkflowHandoff,
  Guardrail,
  WorkflowStep,
  SpecialistDefinition,
} from './types.js';

/**
 * Render a Claude command file for a workflow.
 */
export function renderClaudeCommand(workflow: WorkflowDefinition): string {
  const sections = [
    renderCommandFrontmatter(workflow),
    renderCommandDescription(workflow),
    renderCommandInputs(workflow),
    renderCommandOutputs(workflow),
    renderCommandDependencies(workflow),
    renderCommandGuardrails(workflow),
  ].filter(Boolean);

  return sections.join('\n\n');
}

/**
 * Render a Claude agent file for a workflow.
 */
export function renderClaudeAgent(workflow: WorkflowDefinition): string {
  const sections = [
    renderAgentHeader(workflow),
    renderAgentDescription(workflow),
    renderAgentOwaspTopics(workflow),
    renderAgentInputs(workflow),
    renderAgentOutputs(workflow),
    renderAgentHandoffs(workflow),
    renderAgentSteps(workflow),
    renderAgentGuardrails(workflow),
    renderAgentRuntimePrompts(workflow),
  ].filter(Boolean);

  return sections.join('\n\n');
}

/**
 * Render a Codex skill file for a workflow.
 */
export function renderCodexSkill(workflow: WorkflowDefinition): string {
  const sections = [
    renderSkillHeader(workflow),
    renderSkillDescription(workflow),
    renderSkillOwaspTopics(workflow),
    renderSkillInputs(workflow),
    renderSkillOutputs(workflow),
    renderSkillDependencies(workflow),
    renderSkillSteps(workflow),
    renderSkillGuardrails(workflow),
    renderSkillRuntimePrompts(workflow),
  ].filter(Boolean);

  return sections.join('\n\n');
}

/**
 * Render a placeholder README for commands.
 */
export function renderCommandsReadme(workflows: WorkflowDefinition[]): string {
  const workflowList = workflows
    .map(
      (w) => `- \`/gss-${w.id}\` - ${w.title}`
    )
    .join('\n');

  return `# get-shit-secured Commands

This directory contains security workflow slash commands for Claude Code.

## Available Commands

${workflowList}

## Workflow Execution Order

Workflows are designed to run in sequence. Each workflow consumes outputs from previous workflows:

${renderWorkflowChain(workflows)}

## Usage

Run workflows in order for complete security analysis:

1. \`/gss-map-codebase\` - Analyze codebase structure
2. \`/gss-threat-model\` - Generate threat models
3. \`/gss-audit\` - Run security audit
4. \`/gss-remediate\` - Apply security fixes
5. \`/gss-verify\` - Verify fixes
6. \`/gss-report\` - Generate reports

For more information on each workflow, see its command file.
`;
}

/**
 * Render a placeholder README for agents.
 */
export function renderAgentsReadme(workflows: WorkflowDefinition[]): string {
  const workflowList = workflows
    .map(
      (w) => `- \`gss-${w.id}\` - ${w.title}`
    )
    .join('\n');

  return `# get-shit-secured Agents

This directory contains security-focused agents for Claude Code.

## Available Agents

${workflowList}

## Agent Usage

Each agent specializes in a security workflow. Agents are invoked automatically by their corresponding commands or can be used directly for specific tasks.

## Workflow Chain

${renderWorkflowChain(workflows)}

## See Also

- [Commands README](../commands/gss/README.md)
- [GSS Documentation](https://github.com/viniciusalgado/get-shit-secured)
`;
}

/**
 * Render a placeholder README for skills.
 */
export function renderSkillsReadme(workflows: WorkflowDefinition[]): string {
  const workflowList = workflows
    .map(
      (w) => `- \`gss-${w.id}\` - ${w.title}`
    )
    .join('\n');

  return `# get-shit-secured Skills for Codex

This directory contains security workflow skills for Codex.

## Available Skills

${workflowList}

## Usage

Skills provide structured security workflows that can be invoked individually or as part of a complete security analysis pipeline.

## Workflow Execution Order

${renderWorkflowChain(workflows)}
`;
}

/**
 * Render the help command content.
 */
export function renderHelpCommand(workflows: WorkflowDefinition[]): string {
  const tableRows = workflows
    .map((w) => {
      const deps = w.dependencies.map((d) => d.workflowId).join(', ') || 'None';
      return `| \`/gss-${w.id}\` | ${w.title} | ${deps} |`;
    })
    .join('\n');

  return `---
description: Show available get-shit-secured commands
---

# get-shit-secured Commands

The following security workflow commands are available:

| Command | Description | Requires |
|---------|-------------|----------|
${tableRows}

## Quick Start

For a complete security analysis, run workflows in order:

1. \`/gss-map-codebase\` - Map your codebase structure
2. \`/gss-threat-model\` - Identify threats and risks
3. \`/gss-audit\` - Find security vulnerabilities
4. \`/gss-remediate\` - Apply security fixes
5. \`/gss-verify\` - Verify the fixes
6. \`/gss-report\` - Generate reports

## Artifacts

Each workflow generates artifacts in \`.gss/artifacts/<workflow-name>/\` that are consumed by subsequent workflows.

## OWASP Grounding

All workflows are grounded in OWASP standards including:
- OWASP Top 10
- OWASP ASVS
- OWASP Cheat Sheet Series
- OWASP Threat Modeling

For more information, see https://owasp.org/www-cheat-sheet-series/
`;
}

// =============================================================================
// Command Rendering
// =============================================================================

function renderCommandFrontmatter(workflow: WorkflowDefinition): string {
  return `---
description: ${workflow.goal}
---`;
}

function renderCommandDescription(workflow: WorkflowDefinition): string {
  return `# ${workflow.title}

${workflow.goal}`;
}

function renderCommandInputs(workflow: WorkflowDefinition): string {
  if (workflow.inputs.length === 0) {
    return '';
  }

  const items = workflow.inputs
    .map(
      (i) => `- **${i.name}** (${i.type}): ${i.description}`
    )
    .join('\n');

  return `## Inputs

${items}`;
}

function renderCommandOutputs(workflow: WorkflowDefinition): string {
  if (workflow.outputs.length === 0) {
    return '';
  }

  const items = workflow.outputs
    .map((o) => `- **${o.name}** (${o.type}): ${o.description}`)
    .join('\n');

  return `## Outputs

${items}`;
}

function renderCommandDependencies(workflow: WorkflowDefinition): string {
  if (workflow.dependencies.length === 0) {
    return `## Dependencies

This workflow has no dependencies and can be run first.`;
  }

  const items = workflow.dependencies
    .map(
      (d) => `- \`/gss-${d.workflowId}\` (requires: ${d.requiredOutputs.join(', ')})`
    )
    .join('\n');

  return `## Dependencies

This workflow requires the following workflows to be run first:

${items}`;
}

function renderCommandGuardrails(workflow: WorkflowDefinition): string {
  if (workflow.guardrails.length === 0) {
    return '';
  }

  const items = workflow.guardrails
    .map((g) => `- **${g.type}**: ${g.description}`)
    .join('\n');

  return `## Guardrails

${items}`;
}

// =============================================================================
// Agent Rendering
// =============================================================================

function renderAgentHeader(workflow: WorkflowDefinition): string {
  return `# ${workflow.title}

**Workflow ID:** \`gss-${workflow.id}\`

**Goal:** ${workflow.goal}`;
}

function renderAgentDescription(workflow: WorkflowDefinition): string {
  return `## Description

This agent specializes in ${workflow.title.toLowerCase()}. It follows OWASP-based practices and generates structured artifacts for use by other workflows in the security analysis pipeline.`;
}

function renderAgentOwaspTopics(workflow: WorkflowDefinition): string {
  if (workflow.owaspTopics.length === 0) {
    return '';
  }

  const items = workflow.owaspTopics
    .map((t) => {
      const refs = t.cheatSheetUrls?.length
        ? `\n  - ${t.cheatSheetUrls.join('\n  - ')}`
        : '';
      return `- **${t.name}**${refs}`;
    })
    .join('\n');

  return `## OWASP Topics

This workflow is grounded in the following OWASP standards:

${items}`;
}

function renderAgentInputs(workflow: WorkflowDefinition): string {
  if (workflow.inputs.length === 0) {
    return '';
  }

  const items = workflow.inputs
    .map((i) => {
      const req = i.required ? '**(required)**' : '(optional)';
      return `- **${i.name}** ${req}\n  - Type: ${i.type}\n  - ${i.description}`;
    })
    .join('\n');

  return `## Inputs

${items}`;
}

function renderAgentOutputs(workflow: WorkflowDefinition): string {
  if (workflow.outputs.length === 0) {
    return '';
  }

  const items = workflow.outputs
    .map((o) => {
      const path = o.path ? `\n  - Path: \`${o.path}\`` : '';
      return `- **${o.name}** (${o.type})\n  - ${o.description}${path}`;
    })
    .join('\n');

  return `## Outputs

${items}`;
}

function renderAgentHandoffs(workflow: WorkflowDefinition): string {
  if (workflow.handoffs.length === 0) {
    return '## Handoffs\n\nThis is the final workflow in the chain.';
  }

  const items = workflow.handoffs
    .map((h) => `- **${h.nextWorkflow}**: Passes ${h.outputsToPass.join(', ')}`)
    .join('\n');

  return `## Handoffs

${items}`;
}

function renderAgentSteps(workflow: WorkflowDefinition): string {
  if (workflow.steps.length === 0) {
    return '';
  }

  const items = workflow.steps
    .map((s, i) => {
      const topics = s.owaspTopics?.length
        ? `\n  *Topics: ${s.owaspTopics.join(', ')}*`
        : '';
      return `### ${i + 1}. ${s.title}${topics}

${s.instructions}`;
    })
    .join('\n\n');

  return `## Workflow Steps

${items}`;
}

function renderAgentGuardrails(workflow: WorkflowDefinition): string {
  if (workflow.guardrails.length === 0) {
    return '';
  }

  const items = workflow.guardrails
    .map((g) => `### ${g.type}

${g.description}

*Condition: ${g.condition}*`)
    .join('\n\n');

  return `## Guardrails

${items}`;
}

function renderAgentRuntimePrompts(workflow: WorkflowDefinition): string {
  if (!workflow.runtimePrompts.claude) {
    return '';
  }

  return `## Runtime Instructions

${workflow.runtimePrompts.claude}`;
}

// =============================================================================
// Skill Rendering
// =============================================================================

function renderSkillHeader(workflow: WorkflowDefinition): string {
  return `# ${workflow.title}

**Workflow ID:** \`gss-${workflow.id}\`

**Goal:** ${workflow.goal}`;
}

function renderSkillDescription(workflow: WorkflowDefinition): string {
  return `## Description

This skill implements ${workflow.title.toLowerCase()}, following OWASP-based security practices and generating structured artifacts.`;
}

function renderSkillOwaspTopics(workflow: WorkflowDefinition): string {
  if (workflow.owaspTopics.length === 0) {
    return '';
  }

  const items = workflow.owaspTopics
    .map((t) => {
      const refs = t.cheatSheetUrls?.length
        ? `\n  - ${t.cheatSheetUrls.join('\n  - ')}`
        : '';
      return `- **${t.name}**${refs}`;
    })
    .join('\n');

  return `## OWASP Standards

${items}`;
}

function renderSkillInputs(workflow: WorkflowDefinition): string {
  if (workflow.inputs.length === 0) {
    return '';
  }

  const items = workflow.inputs
    .map((i) => {
      const req = i.required ? '**Required**' : 'Optional';
      return `- \`${i.name}\` (${i.type}, ${req}): ${i.description}`;
    })
    .join('\n');

  return `## Inputs

${items}`;
}

function renderSkillOutputs(workflow: WorkflowDefinition): string {
  if (workflow.outputs.length === 0) {
    return '';
  }

  const items = workflow.outputs
    .map((o) => {
      const path = o.path ? ` → \`${o.path}\`` : '';
      return `- \`${o.name}\` (${o.type})${path}\n  - ${o.description}`;
    })
    .join('\n');

  return `## Outputs

${items}`;
}

function renderSkillDependencies(workflow: WorkflowDefinition): string {
  if (workflow.dependencies.length === 0) {
    return '## Prerequisites\n\nThis skill has no prerequisites.';
  }

  const items = workflow.dependencies
    .map((d) => `- Requires: \`gss-${d.workflowId}\` (outputs: ${d.requiredOutputs.join(', ')})`)
    .join('\n');

  return `## Prerequisites

${items}`;
}

function renderSkillSteps(workflow: WorkflowDefinition): string {
  if (workflow.steps.length === 0) {
    return '';
  }

  const items = workflow.steps
    .map((s, i) => {
      const topics = s.owaspTopics?.length
        ? `\n*OWASP: ${s.owaspTopics.join(', ')}*`
        : '';
      return `${i + 1}. **${s.title}**${topics}\n\n   ${s.instructions}`;
    })
    .join('\n\n');

  return `## Procedure

${items}`;
}

function renderSkillGuardrails(workflow: WorkflowDefinition): string {
  if (workflow.guardrails.length === 0) {
    return '';
  }

  const items = workflow.guardrails
    .map((g) => `- **${g.type}**: ${g.description} (when: ${g.condition})`)
    .join('\n');

  return `## Guardrails

${items}`;
}

function renderSkillRuntimePrompts(workflow: WorkflowDefinition): string {
  if (!workflow.runtimePrompts.codex) {
    return '';
  }

  return `## Runtime Guidance

${workflow.runtimePrompts.codex}`;
}

// =============================================================================
// Helper Functions
// =============================================================================

function renderWorkflowChain(workflows: WorkflowDefinition[]): string {
  const chains: string[] = [];

  for (const workflow of workflows) {
    const deps = workflow.dependencies.map((d) => d.workflowId);
    const next = workflow.handoffs.map((h) => h.nextWorkflow);

    const arrows: string[] = [];
    if (deps.length > 0) {
      arrows.push(`${deps.join(' + ')} →`);
    }
    arrows.push(`**${workflow.id}**`);
    if (next.length > 0) {
      arrows.push(`→ ${next.join(', ')}`);
    }

    chains.push(arrows.join(' '));
  }

  return chains.map((c) => `- ${c}`).join('\n');
}

// =============================================================================
// Specialist Rendering
// =============================================================================

/**
 * Render a Claude specialist agent file.
 */
export function renderClaudeSpecialist(specialist: SpecialistDefinition): string {
  const sections = [
    renderSpecialistHeader(specialist),
    renderSpecialistDescription(specialist),
    renderSpecialistBindings(specialist),
    renderSpecialistTriggers(specialist),
    renderSpecialistDelegates(specialist),
    renderSpecialistClaudePrompt(specialist),
  ].filter(Boolean);

  return sections.join('\n\n');
}

/**
 * Render a Codex specialist skill file.
 */
export function renderCodexSpecialist(specialist: SpecialistDefinition): string {
  const sections = [
    renderSpecialistHeader(specialist),
    renderSpecialistDescription(specialist),
    renderSpecialistBindings(specialist),
    renderSpecialistTriggers(specialist),
    renderSpecialistCodexPrompt(specialist),
  ].filter(Boolean);

  return sections.join('\n\n');
}

/**
 * Render a specialists README for Claude.
 */
export function renderClaudeSpecialistsReadme(specialists: SpecialistDefinition[]): string {
  const specialistList = specialists
    .map((s) => `- \`gss-specialist-${s.id}\` - ${s.title}`)
    .join('\n');

  return `# get-shit-secured Specialists

This directory contains OWASP-based security specialists for Claude Code.

Each specialist represents an OWASP Cheat Sheet and provides expert guidance for that domain.

## Available Specialists

${specialistList}

## Specialist Usage

Specialists are invoked automatically by workflow agents when:
1. The workflow step matches the specialist's bindings
2. An issue type triggers the specialist's activation rules
3. The detected stack matches the specialist's stack bindings
4. Another specialist delegates to this specialist

## Delegation Graph

Specialists can delegate to other specialists based on OWASP cheat sheet references.
This creates a knowledge graph where specialists consult each other for comprehensive coverage.

## See Also

- [Agents README](../agents/gss-README.md)
- [Commands README](../commands/gss/README.md)
`;
}

/**
 * Render a specialists README for Codex.
 */
export function renderCodexSpecialistsReadme(specialists: SpecialistDefinition[]): string {
  const specialistList = specialists
    .map((s) => `- \`gss-specialist-${s.id}\` - ${s.title}`)
    .join('\n');

  return `# get-shit-secured Specialists

OWASP-based security specialist skills for Codex.

## Available Specialists

${specialistList}

Each specialist encapsulates guidance from a specific OWASP Cheat Sheet.
`;
}

function renderSpecialistHeader(specialist: SpecialistDefinition): string {
  return `# ${specialist.title}

**Specialist ID:** \`gss-specialist-${specialist.id}\`

**Source:** [OWASP Cheat Sheet](${specialist.sourceUrl})`;
}

function renderSpecialistDescription(specialist: SpecialistDefinition): string {
  return `## Description

${specialist.intentSummary}`;
}

function renderSpecialistBindings(specialist: SpecialistDefinition): string {
  const workflowBindings = specialist.primaryWorkflowIds.map(w => `- \`${w}\``).join('\n');
  const stackBindings = specialist.stackBindings?.map(s => `- \`${s}\``).join('\n') || '';

  let output = `## Workflow Bindings\n\nThis specialist is used in these workflows:\n\n${workflowBindings}`;

  if (stackBindings) {
    output += `\n\n### Stack-Conditioned Activation\n\nThis specialist activates when these technologies are detected:\n\n${stackBindings}`;
  }

  return output;
}

function renderSpecialistTriggers(specialist: SpecialistDefinition): string {
  const triggerPhrases = specialist.activationRules
    .flatMap(r => r.triggerPhrases)
    .slice(0, 20)
    .map(p => `- \`${p}\``)
    .join('\n');

  return `## Activation Triggers\n\nThis specialist is activated by:\n\n${triggerPhrases}`;
}

function renderSpecialistDelegates(specialist: SpecialistDefinition): string {
  if (!specialist.delegatesTo || specialist.delegatesTo.length === 0) {
    return '';
  }

  const delegates = specialist.delegatesTo
    .map(d => `- \`gss-specialist-${d}\``)
    .join('\n');

  return `## Delegates To\n\nThis specialist may delegate to:\n\n${delegates}`;
}

function renderSpecialistClaudePrompt(specialist: SpecialistDefinition): string {
  return `## Specialist Instructions\n\n${specialist.runtimePrompts.claude || 'No specific instructions.'}`;
}

function renderSpecialistCodexPrompt(specialist: SpecialistDefinition): string {
  return `## Specialist Guidance\n\n${specialist.runtimePrompts.codex || 'No specific guidance.'}`;
}
