/**
 * Workflow Renderer
 *
 * Converts workflow definitions into runtime-specific file content.
 * Supports Claude commands/agents, Codex skills, specialists, and role agents.
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
  WorkflowId,
  RoleAgentDefinition,
  AgentAccessLevel,
  DelegationPolicy,
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
    renderCommandNextWorkflow(workflow),
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
    renderDoneMeans(workflow),
    renderAgentOwaspTopics(workflow),
    renderAgentInputs(workflow),
    renderAgentOutputs(workflow),
    renderAgentHandoffs(workflow),
    renderAgentNextWorkflow(workflow),
    renderAgentSteps(workflow),
    renderAgentOrchestration(workflow),
    renderAgentGuardrails(workflow),
    renderAgentRuntimePrompts(workflow),
    renderClaudeDelegationPlanSection(workflow),
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
    renderSkillDoneMeans(workflow),
    renderSkillOwaspTopics(workflow),
    renderSkillInputs(workflow),
    renderSkillOutputs(workflow),
    renderSkillDependencies(workflow),
    renderSkillNextWorkflow(workflow),
    renderSkillSteps(workflow),
    renderSkillOrchestration(workflow),
    renderSkillGuardrails(workflow),
    renderSkillRuntimePrompts(workflow),
    renderCodexDelegationPlanSection(workflow),
  ].filter(Boolean);

  return sections.join('\n\n');
}

/**
 * Render the "Done Means" section for Codex skills.
 */
function renderSkillDoneMeans(workflow: WorkflowDefinition): string {
  return `## Completion Criteria

This skill is **complete** when:${renderDoneMeans(workflow).replace('## "Done" Means\n\nThis workflow is **complete** when:', '').trim()}
`;
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

1. \`/gss-security-review\` - Review security-relevant diffs (recommended first for change-scoped checks)
2. \`/gss-map-codebase\` - Analyze codebase structure
3. \`/gss-threat-model\` - Generate threat models
4. \`/gss-audit\` - Run security audit
5. \`/gss-plan-remediation\` - Plan security fixes
6. \`/gss-execute-remediation\` - Apply approved fixes
7. \`/gss-verify\` - Verify the fixes
8. \`/gss-report\` - Generate reports

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

1. \`/gss-security-review\` - Review current diff or a commit patch for security issues
2. \`/gss-map-codebase\` - Map your codebase structure
3. \`/gss-threat-model\` - Identify threats and risks
4. \`/gss-audit\` - Find security vulnerabilities
5. \`/gss-plan-remediation\` - Plan security fixes
6. \`/gss-execute-remediation\` - Apply approved fixes
7. \`/gss-verify\` - Verify the fixes
8. \`/gss-report\` - Generate reports

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

function renderCommandNextWorkflow(workflow: WorkflowDefinition): string {
  const nextWorkflow = getNextWorkflowInSequence(workflow.id);
  if (!nextWorkflow) {
    return `## Next Workflow

This is the final workflow in the security analysis sequence. Run \`/gss-report\` to generate comprehensive reports.

When this workflow is done, remind the user to clear the context with \`/clear\`.`;
  }

  return `## Next Workflow

After completing this workflow, run:

\`\`\`
/gss-${nextWorkflow}
\`\`\`

Use the outputs from this workflow as inputs for the next one.

When this workflow is done, remind the user to clear the context with \`/clear\` before starting the next workflow.`;
}

/**
 * Get the next workflow ID in the canonical sequence.
 */
function getNextWorkflowInSequence(currentId: WorkflowId): WorkflowId | null {
  const sequence: WorkflowId[] = [
    'security-review',
    'map-codebase',
    'threat-model',
    'audit',
    'plan-remediation',
    'execute-remediation',
    'verify',
    'report',
  ];

  const index = sequence.indexOf(currentId);
  if (index === -1 || index === sequence.length - 1) {
    return null;
  }

  return sequence[index + 1];
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

function renderAgentNextWorkflow(workflow: WorkflowDefinition): string {
  const nextWorkflow = getNextWorkflowInSequence(workflow.id);
  if (!nextWorkflow) {
    return `## Next Recommended Workflow

This is the final workflow in the security analysis sequence. All workflows have been completed.

**Completion Guidance:**
- Direct the user to run \`/gss-report\` if they haven't already
- The report workflow aggregates all artifacts into comprehensive security reports
- After reports are generated, the full security analysis sequence is complete
- When this workflow completes, explicitly remind the user to clear the context with \`/clear\``;
  }

  return `## Next Recommended Workflow

After completing this workflow, the user should run:

\`\`\`
/gss-${nextWorkflow}
\`\`\`

**Completion Guidance:**
- When this workflow completes, explicitly tell the user to run \`/gss-${nextWorkflow}\` next
- When this workflow completes, explicitly remind the user to clear the context with \`/clear\` before starting the next workflow
- Reference the specific artifacts that should be passed to the next workflow
- Do not suggest running any other workflows - follow the canonical sequence strictly`;
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

/**
 * Render the "Done Means" section for workflow agents.
 */
function renderDoneMeans(workflow: WorkflowDefinition): string {
  const doneCriteria: Record<WorkflowId, string> = {
    'security-review': `
1. Change scope is captured from uncommitted set or commit-ref
2. Security relevance gate outcome is explicit and deterministic
3. Findings include evidence, OWASP mapping, severity, and confidence
4. Validation is performed without mutating tracked files
5. TDD remediation specs are generated in .gss/artifacts/security-review/
`,
    'map-codebase': `
1. All major code components are identified and catalogued
2. Dependencies (direct and transitive) are listed
3. Authentication and authorization boundaries are documented
4. Data flows between components are mapped
5. External integrations and API endpoints are listed
6. Artifacts are saved in \`.gss/artifacts/map-codebase/\`
`,
    'threat-model': `
1. All identified threat surfaces have been analyzed
2. At least one threat model exists per major component
3. Threats are prioritized by likelihood and impact
4. Mitigation recommendations are documented
5. Artifacts are saved in \`.gss/artifacts/threat-model/\`
`,
    'audit': `
1. All findings include: file path, line number, severity, and evidence
2. Findings are mapped to OWASP Top 10 and relevant cheat sheets
3. Each finding includes specific remediation guidance
4. Confidence levels are stated for each finding
5. Artifacts are saved in \`.gss/artifacts/audit/\`
`,
    'plan-remediation': `
1. All audit findings have a corresponding remediation plan
2. Plans include specific code changes with file paths
3. Potential side effects are documented
4. Verification steps are specified for each remediation
5. User approval is obtained BEFORE applying any changes
6. Artifacts are saved in \`.gss/artifacts/plan-remediation/\`
`,
    'execute-remediation': `
1. All approved remediations are applied
2. Changes are tested for regressions
3. Failed patches are documented with reasons
4. Artifacts are saved in \`.gss/artifacts/execute-remediation/\`
`,
    'verify': `
1. All remediations are verified against original findings
2. Verification includes test results or manual check results
3. Any regressions are documented
4. Confidence levels are stated for each verification
5. Artifacts are saved in \`.gss/artifacts/verify/\`
`,
    'report': `
1. Executive summary includes key findings and priorities
2. Technical details reference all previous artifacts
3. Action items are prioritized with clear ownership
4. Final report is saved in \`.gss/artifacts/report/\`
`,
  };

  return `## "Done" Means

This workflow is **complete** when:${doneCriteria[workflow.id] || `
1. All specified outputs are generated
2. Artifacts are saved in the appropriate directory
3. Success criteria are met
`}`;
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

function renderAgentOrchestration(workflow: WorkflowDefinition): string {
  if (!workflow.orchestration || workflow.orchestration.phases.length === 0) {
    return '';
  }

  const phaseLines = workflow.orchestration.phases
    .map((phase, index) => (
      `### ${index + 1}. ${phase.title} (\`${phase.id}\`)

- Lead: \`${phase.lead}\`
- Execution: \`${phase.execution}\`
- Inputs: ${phase.inputs.map((i) => `\`${i}\``).join(', ') || 'None'}
- Outputs: ${phase.outputs.map((o) => `\`${o}\``).join(', ') || 'None'}
- Specialist Mode: \`${phase.specialistMode}\``
    ))
    .join('\n\n');

  return `## Orchestration

Coordinator: \`${workflow.orchestration.coordinator}\`

${phaseLines}`;
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

function renderSkillNextWorkflow(workflow: WorkflowDefinition): string {
  const nextWorkflow = getNextWorkflowInSequence(workflow.id);
  if (!nextWorkflow) {
    return `## Next Step

This is the final workflow in the security analysis sequence. Run \`gss-report\` to generate comprehensive reports.

When this workflow is done, remind the user to clear the context with \`/clear\`.`;
  }

  return `## Next Step

After completing this workflow, run \`gss-${nextWorkflow}\` to continue the security analysis sequence.

When this workflow is done, remind the user to clear the context with \`/clear\` before starting the next workflow.`;
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

function renderSkillOrchestration(workflow: WorkflowDefinition): string {
  if (!workflow.orchestration || workflow.orchestration.phases.length === 0) {
    return '';
  }

  const phaseLines = workflow.orchestration.phases
    .map((phase, index) =>
      `${index + 1}. **${phase.title}** (\`${phase.id}\`)
   - Lead: \`${phase.lead}\`
   - Execution: \`${phase.execution}\`
   - Inputs: ${phase.inputs.map((i) => `\`${i}\``).join(', ') || 'None'}
   - Outputs: ${phase.outputs.map((o) => `\`${o}\``).join(', ') || 'None'}
   - Specialist mode: \`${phase.specialistMode}\``
    )
    .join('\n\n');

  return `## Orchestration

Coordinator: \`${workflow.orchestration.coordinator}\`

${phaseLines}`;
}

// =============================================================================
// Helper Functions
// =============================================================================

function renderWorkflowChain(workflows: WorkflowDefinition[]): string {
  const canonicalOrder: WorkflowId[] = [
    'security-review',
    'map-codebase',
    'threat-model',
    'audit',
    'plan-remediation',
    'execute-remediation',
    'verify',
    'report',
  ];

  const workflowMap = new Map(workflows.map((w) => [w.id, w]));

  const lines: string[] = [];
  for (let i = 0; i < canonicalOrder.length; i++) {
    const id = canonicalOrder[i];
    const workflow = workflowMap.get(id);
    if (!workflow) continue;

    const parts: string[] = [];

    // Add previous step arrow
    if (i > 0) {
      parts.push('  ↓');
    }

    // Add current step
    const arrow = i === 0 ? '▶' : '→';
    parts.push(`${i + 1}. **${id}** (${workflow.title})`);

    lines.push(parts.join('\n'));
  }

  return lines.join('\n');
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

// =============================================================================
// Role Agent Rendering
// =============================================================================

/**
 * Render a role agent file for Claude.
 */
export function renderRoleAgent(agent: {
  id: string;
  title: string;
  description: string;
}): string {
  return `# ${agent.title}

**Agent ID:** \`${agent.id}\`

## Description

${agent.description}

## Role and Responsibilities

This is a **role-based agent** within the get-shit-secured framework. You have specific, well-defined responsibilities:

${getRoleSpecificInstructions(agent.id)}

## Access Level

${getAccessLevelText(agent.id)}

## Read Permissions

You may read:
${getReadPermissions(agent.id)}

## Write Permissions

You may write to:
${getWritePermissions(agent.id)}

## Required Output Format

All outputs must follow the structured format specified in the execution procedure below.

## Delegation Rules

${getDelegationRules(agent.id)}

## Escalation Rules

${getEscalationRules(agent.id)}

## Evidence Quality Requirements

- All findings must include specific file paths and line numbers
- All recommendations must be grounded in OWASP standards
- All remediations must include verification steps
- Uncertainty must be explicitly stated with confidence levels

## "Done" Means

This workflow is **complete** when:
${getDoneCriteria(agent.id)}
`;

}

/**
 * Get role-specific instructions for each agent.
 */
function getRoleSpecificInstructions(agentId: string): string {
  const instructions: Record<string, string> = {
    'gss-mapper': `
- Analyze codebase structure and identify key components
- Map dependencies and their security relevance
- Identify authentication/authorization boundaries
- Document data flows between components
- Identify external integrations and API endpoints
- Produce a structured codebase inventory in \`.gss/artifacts/map-codebase/\`
`,
    'gss-threat-modeler': `
- Use the codebase map to identify threat surfaces
- Identify abuse cases and attack vectors
- Assess potential impact of each threat
- Prioritize threats by likelihood and impact
- Document threat models in \`.gss/artifacts/threat-model/\`
`,
    'gss-auditor': `
- Scan code for security vulnerabilities using OWASP checklists
- Assess severity of findings with evidence
- Map findings to OWASP Top 10 and ASVS
- Require specific file paths and line numbers for all findings
- Document findings in \`.gss/artifacts/audit/\`
`,
    'gss-remediator': `
- Plan minimal safe changes to address findings
- Prefer configuration changes over code changes when possible
- Preserve user changes and custom logic
- Document all planned changes with rationale
- Output remediation plans to \`.gss/artifacts/plan-remediation/\`
`,
    'gss-verifier': `
- Verify that remediations address the reported findings
- Run or specify tests to confirm fixes
- Check for regressions or new vulnerabilities
- Document verification results in \`.gss/artifacts/verify/\`
`,
    'gss-reporter': `
- Aggregate all artifacts into comprehensive reports
- Include executive summary and technical details
- Provide prioritized action items
- Generate reports in \`.gss/artifacts/report/\`
`,
  };

  return instructions[agentId] || '- Execute specialized security tasks\n- Document all findings and outputs\n';
}

/**
 * Get access level text for an agent.
 */
function getAccessLevelText(agentId: string): string {
  const levels: Record<string, { level: AgentAccessLevel; description: string }> = {
    'gss-mapper': { level: 'read-only', description: 'Read-only analysis. You do not modify code.' },
    'gss-threat-modeler': { level: 'read-only', description: 'Read-only analysis. You do not modify code.' },
    'gss-auditor': { level: 'read-only', description: 'Read-only analysis. You do not modify code.' },
    'gss-remediator': { level: 'write-capable', description: 'Write-capable. You plan but do NOT apply changes without user approval.' },
    'gss-verifier': { level: 'verification-only', description: 'Verification-focused. You run tests and verify fixes.' },
    'gss-reporter': { level: 'read-only', description: 'Read-only. You aggregate and format existing artifacts.' },
  };

  const info = levels[agentId];
  return info ? `**${info.level}** - ${info.description}` : '**write-capable** - Full agent permissions';
}

/**
 * Get read permissions for an agent.
 */
function getReadPermissions(agentId: string): string {
  const commonPermissions = [
    '- Project source code',
    '- Configuration files',
    '- \`.gss/artifacts/\` directory',
  ];

  const specificPermissions: Record<string, string[]> = {
    'gss-auditor': [
      ...commonPermissions,
      '- Dependency files (package.json, requirements.txt, etc.)',
      '- Build configurations',
    ],
    'gss-verifier': [
      ...commonPermissions,
      '- Test files',
      '- CI/CD configuration',
    ],
  };

  return (specificPermissions[agentId] || commonPermissions).join('\n');
}

/**
 * Get write permissions for an agent.
 */
function getWritePermissions(agentId: string): string {
  const writePermissions: Record<string, string[]> = {
    'gss-mapper': [
      '- \`.gss/artifacts/map-codebase/\` - Create and update mapping artifacts',
    ],
    'gss-threat-modeler': [
      '- \`.gss/artifacts/threat-model/\` - Create and update threat model artifacts',
    ],
    'gss-auditor': [
      '- \`.gss/artifacts/audit/\` - Create and update audit findings',
    ],
    'gss-remediator': [
      '- \`.gss/artifacts/plan-remediation/\` - Create remediation plans',
      '- Source code (ONLY with explicit user approval)',
    ],
    'gss-verifier': [
      '- \`.gss/artifacts/verify/\` - Create verification reports',
      '- Test files (to add verification tests)',
    ],
    'gss-reporter': [
      '- \`.gss/artifacts/report/\` - Create final reports',
    ],
  };

  return (writePermissions[agentId] || [
    '- \`.gss/artifacts/\` - Create artifacts in your domain',
  ]).join('\n');
}

/**
 * Get delegation rules for an agent.
 */
function getDelegationRules(agentId: string): string {
  const rules: Record<string, string> = {
    'gss-mapper': '- No delegation - you are the entry point agent',
    'gss-threat-modeler': '- Consult gss-auditor if code patterns suggest specific vulnerabilities',
    'gss-auditor': '- Delegate to OWASP specialists for domain-specific issues',
    'gss-remediator': '- Consult gss-verifier to plan verification steps',
    'gss-verifier': '- No delegation - you are the final check',
    'gss-reporter': '- No delegation - you aggregate completed work',
  };

  return rules[agentId] || '- May delegate to specialists as needed';
}

/**
 * Get escalation rules for an agent.
 */
function getEscalationRules(agentId: string): string {
  const rules: Record<string, string> = {
    'gss-mapper': '- Escalate if codebase is too large to analyze in one session',
    'gss-threat-modeler': '- Escalate if critical threats are identified',
    'gss-auditor': '- Escalate immediately if critical vulnerabilities are found',
    'gss-remediator': '- Escalate if remediation requires architectural changes',
    'gss-verifier': '- Escalate if verification fails or reveals new issues',
    'gss-reporter': '- Escalate if critical findings remain unaddressed',
  };

  return rules[agentId] || '- Escalate if uncertain or blocked';
}

/**
 * Get completion criteria for an agent.
 */
function getDoneCriteria(agentId: string): string {
  const criteria: Record<string, string> = {
    'gss-mapper': `
1. All major code components are identified
2. Dependencies are catalogued
3. Auth/authz boundaries are documented
4. Data flows are mapped
5. External integrations are listed
6. Artifacts exist in \`.gss/artifacts/map-codebase/\`
`,
    'gss-threat-modeler': `
1. All threat surfaces are identified
2. At least one threat model is documented per component
3. Threats are prioritized
4. Mitigation recommendations are included
5. Artifacts exist in \`.gss/artifacts/threat-model/\`
`,
    'gss-auditor': `
1. All findings include: file path, line number, severity, evidence
2. Findings are mapped to OWASP categories
3. Remediation recommendations are specific
4. Confidence levels are stated for each finding
5. Artifacts exist in \`.gss/artifacts/audit/\`
`,
    'gss-remediator': `
1. All findings have a remediation plan
2. Plans include specific changes with file paths
3. Potential side effects are documented
4. Verification steps are specified
5. User approval is obtained BEFORE applying changes
6. Artifacts exist in \`.gss/artifacts/plan-remediation/\`
`,
    'gss-verifier': `
1. All remediations are verified
2. Verification includes test results or manual checks
3. Regressions are documented if found
4. Confidence level is stated for each verification
5. Artifacts exist in \`.gss/artifacts/verify/\`
`,
    'gss-reporter': `
1. Executive summary includes key findings
2. Technical details are complete
3. Action items are prioritized
4. All previous artifacts are referenced
5. Final report exists in \`.gss/artifacts/report/\`
`,
  };

  return criteria[agentId] || `
1. Your specific outputs are complete
2. Artifacts are saved in the appropriate directory
3. Success criteria are met
`;
}

/**
 * Render a Codex role skill file.
 */
export function renderCodexRoleSkill(agent: {
  id: string;
  title: string;
  description: string;
}): string {
  return `# ${agent.title}

**Skill ID:** \`${agent.id}\`

## Description

${agent.description}

## Role and Responsibilities

This is a **role-based skill** within the get-shit-secured framework.

${getCodexRoleInstructions(agent.id)}

## Access Level

${getCodexAccessLevelText(agent.id)}

## Output Format

All outputs must follow the structured format specified in the execution procedure.

## "Done" Means

This skill is **complete** when:
${getCodexDoneCriteria(agent.id)}
`;
}

/**
 * Get Codex-specific role instructions.
 */
function getCodexRoleInstructions(agentId: string): string {
  const instructions: Record<string, string> = {
    'gss-mapper': '- Analyze codebase structure\n- Map dependencies and boundaries\n- Document data flows\n- Output to `.gss/artifacts/map-codebase/`',
    'gss-threat-modeler': '- Identify threat surfaces\n- Assess threat impact\n- Prioritize threats\n- Output to `.gss/artifacts/threat-model/`',
    'gss-auditor': '- Scan for vulnerabilities\n- Assess severity with evidence\n- Map to OWASP standards\n- Output to `.gss/artifacts/audit/`',
    'gss-remediator': '- Plan minimal safe changes\n- Preserve user changes\n- Document with rationale\n- Output to `.gss/artifacts/plan-remediation/`',
    'gss-verifier': '- Verify remediations\n- Run tests\n- Check for regressions\n- Output to `.gss/artifacts/verify/`',
    'gss-reporter': '- Aggregate artifacts\n- Create summaries\n- Provide action items\n- Output to `.gss/artifacts/report/`',
  };

  return instructions[agentId] || '- Execute specialized security tasks\n- Document all outputs\n';
}

/**
 * Get Codex access level text.
 */
function getCodexAccessLevelText(agentId: string): string {
  const levels: Record<string, string> = {
    'gss-mapper': 'Read-only analysis. Do not modify code.',
    'gss-threat-modeler': 'Read-only analysis. Do not modify code.',
    'gss-auditor': 'Read-only analysis. Do not modify code.',
    'gss-remediator': 'Write-capable. Plan changes but do NOT apply without user approval.',
    'gss-verifier': 'Verification-focused. Run tests and verify fixes.',
    'gss-reporter': 'Read-only. Aggregate and format existing artifacts.',
  };

  return levels[agentId] || 'Full permissions with user approval required for writes.';
}

/**
 * Get Codex completion criteria.
 */
function getCodexDoneCriteria(agentId: string): string {
  const criteria: Record<string, string> = {
    'gss-mapper': '1. All major components are identified\n2. Dependencies are catalogued\n3. Artifacts exist in `.gss/artifacts/map-codebase/`',
    'gss-threat-modeler': '1. Threat surfaces are identified\n2. Threats are prioritized\n3. Artifacts exist in `.gss/artifacts/threat-model/`',
    'gss-auditor': '1. All findings include file path, line, severity, evidence\n2. Mapped to OWASP categories\n3. Artifacts exist in `.gss/artifacts/audit/`',
    'gss-remediator': '1. All findings have remediation plans\n2. User approval obtained before changes\n3. Artifacts exist in `.gss/artifacts/plan-remediation/`',
    'gss-verifier': '1. All remediations are verified\n2. Test results documented\n3. Artifacts exist in `.gss/artifacts/verify/`',
    'gss-reporter': '1. Executive summary included\n2. Action items prioritized\n3. Final report in `.gss/artifacts/report/`',
  };

  return criteria[agentId] || '1. Outputs are complete\n2. Artifacts saved\n3. Success criteria met';
}

// =============================================================================
// Delegation Plan Rendering
// =============================================================================

/**
 * Render a delegation plan section for a Claude workflow agent.
 * This is a template section that instructs the runtime to compute and
 * follow the delegation plan at runtime.
 */
export function renderClaudeDelegationPlanSection(workflow: WorkflowDefinition): string {
  if (!workflow.delegationPolicy || workflow.delegationPolicy.mode === 'none') {
    return '';
  }

  const policy = workflow.delegationPolicy;
  const constraints = policy.constraints;

  return `## Delegation Plan

This workflow uses **deterministic delegation planning** to select specialists.

**Delegation Mode:** ${policy.mode}
**Subject Source:** ${policy.subjectSource}

### Required Specialist Consultations

Before consulting specialists, compute the delegation plan using the signals available in this workflow's artifacts. The plan determines which specialists MUST be consulted (required), MAY be consulted (optional), and are derived as follow-ups.

### Consultation Constraints

- Maximum required specialists per subject: **${constraints.maxRequiredPerSubject}**
- Maximum optional specialists per subject: **${constraints.maxOptionalPerSubject}**
- Follow-up specialists allowed: **${constraints.allowFollowUpSpecialists ? 'Yes' : 'No'}**
- Maximum follow-up depth: **${constraints.maxFollowUpDepth}**
- Fail if required specialist missing: **${constraints.failOnMissingRequired ? 'Yes' : 'No'}**
- Out-of-plan consults allowed: **${constraints.allowOutOfPlanConsults ? 'Yes' : 'No'}**

### Specialist Output Format

Each specialist consultation MUST produce:
- \`verdict\`: \`pass\` | \`fail\` | \`needs-review\`
- \`confidence\`: 0-1 score
- \`evidence\`: code snippets or configuration
- \`affectedFiles\`: files and line numbers
- \`remediationNotes\`: specific fix recommendations
- \`verificationNotes\`: how to verify the fix
- \`owaspSourceUrl\`: governing cheat sheet URL

### Required Output Capture

1. Every specialist response MUST be captured in \`.gss/artifacts/${workflow.id}/specialist-results.json\`
2. The delegation plan MUST be saved to \`.gss/artifacts/${workflow.id}/delegation-plan.json\`
3. Compliance validation MUST be saved to \`.gss/artifacts/${workflow.id}/delegation-compliance.json\`
4. A human-readable summary MUST be saved to \`.gss/artifacts/${workflow.id}/delegation-summary.md\`

### Compliance Rules

- Missing a required specialist consultation is a **hard failure** for this workflow
- Consulting a specialist not in the plan is recorded and excluded from aggregation
- Duplicate consultations are resolved by keeping the highest-confidence result
- The workflow MUST NOT self-certify as complete if delegation compliance fails`;
}

/**
 * Render a delegation plan section for a Codex workflow skill.
 */
export function renderCodexDelegationPlanSection(workflow: WorkflowDefinition): string {
  if (!workflow.delegationPolicy) {
    return '';
  }

  const policy = workflow.delegationPolicy;
  const constraints = policy.constraints;

  return `## Delegation Plan

This skill uses **deterministic delegation planning** for specialist selection.

**Mode:** ${policy.mode}
**Subject Source:** ${policy.subjectSource}

### Constraints

- Max required per subject: ${constraints.maxRequiredPerSubject}
- Max optional per subject: ${constraints.maxOptionalPerSubject}
- Follow-ups allowed: ${constraints.allowFollowUpSpecialists ? 'Yes' : 'No'} (depth: ${constraints.maxFollowUpDepth})
- Fail on missing required: ${constraints.failOnMissingRequired ? 'Yes' : 'No'}

### Output Requirements

1. Save specialist results to \`.gss/artifacts/${workflow.id}/specialist-results.json\`
2. Save delegation plan to \`.gss/artifacts/${workflow.id}/delegation-plan.json\`
3. Save compliance check to \`.gss/artifacts/${workflow.id}/delegation-compliance.json\`

### Compliance

- Required specialist consultations are mandatory
- Out-of-plan consults are recorded but excluded
- Highest-confidence result retained for duplicates`;
}
