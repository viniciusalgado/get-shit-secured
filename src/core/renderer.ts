/**
 * Workflow Renderer
 *
 * Converts workflow definitions into runtime-specific file content.
 * Supports Claude commands/agents, Codex skills, and role agents.
 */

import type {
  WorkflowDefinition,
  WorkflowInput,
  WorkflowOutput,
  WorkflowDependency,
  WorkflowHandoff,
  Guardrail,
  WorkflowStep,
  WorkflowId,
  RoleAgentDefinition,
  AgentAccessLevel,
  RoleMcpConsultationLevel,
  RoleMcpConfig,
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
    renderMcpConsultationSection(workflow),
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
    renderMcpConsultationSection(workflow),
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
5. \`/gss-validate-findings\` - Validate findings with exploitation tests
6. \`/gss-plan-remediation\` - Plan security fixes
7. \`/gss-execute-remediation\` - Apply approved fixes
8. \`/gss-verify\` - Verify the fixes
9. \`/gss-report\` - Generate reports

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
5. \`/gss-validate-findings\` - Validate findings with exploitation tests
6. \`/gss-plan-remediation\` - Plan security fixes
7. \`/gss-execute-remediation\` - Apply approved fixes
8. \`/gss-verify\` - Verify the fixes
9. \`/gss-report\` - Generate reports

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
    'validate-findings',
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
      const glossary = t.glossaryUrl ? ` ([Glossary](${t.glossaryUrl}))` : '';
      return `- **${t.name}**${glossary}`;
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
  const mcpTrace = workflow.signalDerivation
    ? '\n' + (workflow.signalDerivation ? '0. Consultation trace is included in all artifacts with coverageStatus' : '')
    : '';

  const doneCriteria: Record<WorkflowId, string> = {
    'security-review': `
1. Change scope is captured from uncommitted set or commit-ref
2. Security relevance gate outcome is explicit and deterministic
3. Findings include evidence, OWASP mapping, severity, and confidence
4. Validation is performed without mutating tracked files
5. TDD remediation specs are generated in .gss/artifacts/security-review/
${mcpTrace}
`,
    'map-codebase': `
1. All major code components are identified and catalogued
2. Dependencies (direct and transitive) are listed
3. Authentication and authorization boundaries are documented
4. Data flows between components are mapped
5. External integrations and API endpoints are listed
6. Artifacts are saved in \`.gss/artifacts/map-codebase/\`
${mcpTrace}
`,
    'threat-model': `
1. All identified threat surfaces have been analyzed
2. At least one threat model exists per major component
3. Threats are prioritized by likelihood and impact
4. Mitigation recommendations are documented
5. Artifacts are saved in \`.gss/artifacts/threat-model/\`
${mcpTrace}
`,
    'audit': `
1. All findings include: file path, line number, severity, and evidence
2. Findings are mapped to OWASP Top 10 and relevant cheat sheets
3. Each finding includes specific remediation guidance
4. Confidence levels are stated for each finding
5. Artifacts are saved in \`.gss/artifacts/audit/\`
${mcpTrace}
`,
    'validate-findings': `
1. All audit findings have been tested with exploitation test cases
2. Each finding is classified as confirmed, unconfirmed, or hallucinated
3. Unconfirmed and hallucinated findings have been re-evaluated by specialists
4. Validated findings include adjusted confidence scores
5. TDD test document is generated for downstream remediation
6. Artifacts are saved in \`.gss/artifacts/validate-findings/\`
${mcpTrace}
`,
    'plan-remediation': `
1. All validated findings have a corresponding remediation plan
2. Plans include specific code changes with file paths
3. Potential side effects are documented
4. Verification steps are specified for each remediation
5. User approval is obtained BEFORE applying any changes
6. Artifacts are saved in \`.gss/artifacts/plan-remediation/\`
${mcpTrace}
`,
    'execute-remediation': `
1. All approved remediations are applied
2. Changes are tested for regressions
3. Failed patches are documented with reasons
4. Artifacts are saved in \`.gss/artifacts/execute-remediation/\`
${mcpTrace}
`,
    'verify': `
1. All remediations are verified against original findings
2. Verification includes test results or manual check results
3. Any regressions are documented
4. Confidence levels are stated for each verification
5. Artifacts are saved in \`.gss/artifacts/verify/\`
${mcpTrace}
`,
    'report': `
1. Executive summary includes key findings and priorities
2. Technical details reference all previous artifacts
3. Action items are prioritized with clear ownership
4. Final report is saved in \`.gss/artifacts/report/\`
${mcpTrace}
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
    .map((phase, index) => {
      const modeLabel = phase.mcpConsultation
        ? `MCP Consultation: \`${phase.mcpConsultation}\``
        : `Specialist Mode: \`${phase.specialistMode}\``;
      return `### ${index + 1}. ${phase.title} (\`${phase.id}\`)

- Lead: \`${phase.lead}\`
- Execution: \`${phase.execution}\`
- Inputs: ${phase.inputs.map((i) => `\`${i}\``).join(', ') || 'None'}
- Outputs: ${phase.outputs.map((o) => `\`${o}\``).join(', ') || 'None'}
- ${modeLabel}`;
    })
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
      const glossary = t.glossaryUrl ? ` ([Glossary](${t.glossaryUrl}))` : '';
      return `- **${t.name}**${glossary}`;
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
   - Specialist mode: \`${phase.specialistMode}\`
   - MCP consultation: \`${phase.mcpConsultation ?? 'inherit'}\``
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
    'validate-findings',
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
// Role Agent Rendering (Phase 7 — MCP-aware role template)
// =============================================================================

/**
 * Map a role agent ID to its primary workflow.
 */
function getPrimaryWorkflowForRole(agentId: string): WorkflowId {
  const mapping: Record<string, WorkflowId> = {
    'gss-mapper': 'map-codebase',
    'gss-threat-modeler': 'threat-model',
    'gss-auditor': 'audit',
    'gss-remediator': 'plan-remediation',
    'gss-verifier': 'verify',
    'gss-reporter': 'report',
  };
  return mapping[agentId] || 'security-review';
}

/**
 * Get MCP consultation configuration for a role.
 */
function getRoleMcpConfig(agentId: string): RoleMcpConfig {
  const configs: Record<string, RoleMcpConfig> = {
    'gss-mapper': {
      level: 'minimal',
      when: 'After identifying the tech stack, request stack-relevant security documents to inform the inventory',
      tools: ['get_workflow_consultation_plan', 'read_security_doc'],
    },
    'gss-threat-modeler': {
      level: 'moderate',
      when: 'After STRIDE analysis begins, consult threat-modeling-relevant documents from the MCP',
      tools: ['get_workflow_consultation_plan', 'read_security_doc', 'get_related_security_docs'],
    },
    'gss-auditor': {
      level: 'full',
      when: 'Before, during, and after audit reasoning — this is the heaviest MCP user',
      tools: ['get_workflow_consultation_plan', 'read_security_doc', 'get_related_security_docs', 'validate_security_consultation'],
    },
    'gss-remediator': {
      level: 'full',
      when: 'Before planning remediation and during fix design — reads remediation-relevant docs',
      tools: ['get_workflow_consultation_plan', 'read_security_doc', 'get_related_security_docs', 'validate_security_consultation'],
    },
    'gss-verifier': {
      level: 'moderate',
      when: 'Before verification — reads the SAME documents that governed the original findings',
      tools: ['get_workflow_consultation_plan', 'read_security_doc', 'validate_security_consultation'],
    },
    'gss-reporter': {
      level: 'none',
      when: 'Does not initiate new MCP consultation — reads consultation traces from prior workflow artifacts',
      tools: [],
    },
  };

  return configs[agentId] || {
    level: 'minimal',
    when: 'As needed for security knowledge',
    tools: ['get_workflow_consultation_plan'],
  };
}

/**
 * Get the mission statement for a role agent.
 */
function getRoleMission(agentId: string): string {
  const missions: Record<string, string> = {
    'gss-mapper': 'Produce a comprehensive, structured inventory of the codebase — including components, dependencies, trust boundaries, data flows, and external integrations — that downstream security workflows can build on.',
    'gss-threat-modeler': 'Identify and assess security threats against the codebase using STRIDE methodology, producing a prioritized threat register with risk scores and mitigation recommendations.',
    'gss-auditor': 'Find and document security vulnerabilities with precision — every finding must include file path, line number, code snippet, severity, OWASP mapping, and confidence level. Never fix issues; only document them.',
    'gss-remediator': 'Design minimal, safe code changes that address validated security findings while preserving user code style and conventions. Always obtain explicit user approval before writing any changes.',
    'gss-verifier': 'Confirm that remediations correctly address the reported findings by verifying against the SAME security documents that identified the original issues. Run tests and check for regressions.',
    'gss-reporter': 'Aggregate all workflow artifacts into comprehensive reports with executive summaries, technical details, and prioritized action items. Include consultation coverage from all prior workflows.',
  };

  return missions[agentId] || 'Execute specialized security analysis tasks within the GSS framework.';
}

/**
 * Get required context inputs for a role agent.
 */
function getRoleContextInputs(agentId: string): string {
  const inputs: Record<string, string> = {
    'gss-mapper': `- Access to the project source code and configuration files
- Dependency manifests (package.json, requirements.txt, pom.xml, etc.)
- Build and deployment configuration files`,
    'gss-threat-modeler': `- The codebase inventory from \`.gss/artifacts/map-codebase/\`
- Detected stack tags (languages, frameworks, platforms) from the mapper
- MCP consultation plan for threat-model workflow`,
    'gss-auditor': `- The codebase inventory from \`.gss/artifacts/map-codebase/\`
- The threat register from \`.gss/artifacts/threat-model/\` (if available)
- Detected stack signals and issue tag candidates
- MCP consultation plan for audit workflow`,
    'gss-remediator': `- Validated findings from \`.gss/artifacts/validate-findings/\` or \`.gss/artifacts/audit/\`
- Issue tags and target files from findings
- MCP consultation plan for plan-remediation workflow
- Explicit user approval before any code write`,
    'gss-verifier': `- Original findings from \`.gss/artifacts/audit/\` or \`.gss/artifacts/validate-findings/\`
- Applied changes from \`.gss/artifacts/execute-remediation/\`
- The SAME MCP consultation plan that governed the original findings
- Test suite access`,
    'gss-reporter': `- All prior workflow artifacts from \`.gss/artifacts/\`
- Consultation traces from all prior workflows
- Findings, remediation plans, and verification results`,
  };

  return inputs[agentId] || '- Relevant project context and artifacts';
}

/**
 * Get MCP consultation rules for a role agent.
 */
function getRoleMcpRules(agentId: string): string {
  const config = getRoleMcpConfig(agentId);
  const primaryWorkflow = getPrimaryWorkflowForRole(agentId);

  const rules: Record<string, string> = {
    'gss-mapper': `1. After identifying the tech stack: Call \`get_workflow_consultation_plan\` with \`workflowId="map-codebase"\` and detected stacks
2. Read stack-relevant security documents to inform the inventory
3. No full consultation needed — mapping is primarily discovery
4. No coverage validation required — this is a lightweight consultation`,
    'gss-threat-modeler': `1. After STRIDE analysis begins: Call \`get_workflow_consultation_plan\` with \`workflowId="threat-model"\` and stack signals from map-codebase
2. Read threat-modeling-relevant documents (Threat Modeling Cheat Sheet, Attack Surface Analysis)
3. No issue-tag-driven consultation — threat modeling is pre-finding
4. No coverage validation required — consultation is advisory`,
    'gss-auditor': `1. **Before audit**: Call \`get_workflow_consultation_plan\` with \`workflowId="audit"\`, stacks from map-codebase, and issue tags from findings
2. Read ALL required documents from the plan
3. For each finding, cross-reference against consulted documents
4. **Before finalizing**: Call \`validate_security_consultation\` with \`workflowId="audit"\` and the list of consulted docs
5. Include consultation trace in findings artifact`,
    'gss-remediator': `1. **Before planning**: Call \`get_workflow_consultation_plan\` with \`workflowId="plan-remediation"\`, issue tags from validated findings, and target files
2. Read required documents for remediation guidance
3. Design minimal fixes grounded in consulted documents
4. **Before finalizing**: Call \`validate_security_consultation\` with \`workflowId="plan-remediation"\` and consulted docs
5. Include consultation trace in patch plan artifact
6. ALWAYS get user approval before writing any code`,
    'gss-verifier': `1. **Before verification**: Call \`get_workflow_consultation_plan\` with \`workflowId="verify"\` and issue tags from original findings
2. Read the SAME documents that governed the original findings
3. Verify each remediation against those documents
4. **Before finalizing**: Call \`validate_security_consultation\` with \`workflowId="verify"\` and consulted docs
5. Include consultation trace in verification artifact`,
    'gss-reporter': `1. This role does NOT call MCP for new consultation
2. Read consultation traces from ALL prior workflow artifacts
3. Aggregate consultation coverage across the full pipeline
4. Report overall coverage status in the final report
5. Flag any workflows that had warn/fail coverage status`,
  };

  return rules[agentId] || 'Use MCP consultation tools as specified by the workflow context.';
}

/**
 * Get reasoning guardrails for a role agent.
 */
function getRoleReasoningGuardrails(agentId: string): string {
  const guardrails: Record<string, string> = {
    'gss-mapper': `- Focus on discovery and documentation, not assessment
- Identify all trust boundaries, even if they seem minor
- Document assumptions explicitly
- Flag any components that could not be analyzed`,
    'gss-threat-modeler': `- Apply STRIDE systematically to EVERY identified component
- Distinguish theoretical from practical threats
- Score both impact and likelihood with rationale
- Consider the application's specific threat context`,
    'gss-auditor': `- Every finding MUST include: file path, line number, code snippet, severity, confidence level
- Every finding MUST be mapped to at least one OWASP Top 10 category
- Severity MUST be justified with an exploit scenario
- Never fix issues during audit — only document them
- State confidence as high/medium/low for each finding
- Use Grep strategically; confirm issues by reading actual source files`,
    'gss-remediator': `- Minimal changes only — fix the security issue, nothing else
- Preserve user code style and conventions
- Prefer configuration changes over code changes when possible
- Apply defense in depth where the fix warrants layers
- Generate verification tests for each remediation
- Document side effects of every change`,
    'gss-verifier': `- Verify against the SAME OWASP documents that identified the original finding
- Each verification MUST include: test results OR manual check evidence
- Document regressions explicitly
- State confidence level for each verification
- Run existing test suite — flag any new failures
- Aim for >80% line coverage on fixed code`,
    'gss-reporter': `- Separate executive summary from technical detail
- Every finding in the technical report must reference its source artifact
- Include consultation coverage summary showing which OWASP docs were consulted
- Note any gaps where coverage was incomplete`,
  };

  return guardrails[agentId] || '- Reason carefully and document all findings with evidence';
}

/**
 * Get output schema for a role agent.
 */
function getRoleOutputSchema(agentId: string): string {
  const schemas: Record<string, string> = {
    'gss-mapper': `Structured codebase inventory containing:
- Component list with types and purposes
- Dependency map (direct and transitive)
- Trust boundary diagram
- Data flow descriptions
- External integration catalog
- Detected stack signals for downstream workflows

Saved to \`.gss/artifacts/map-codebase/\``,
    'gss-threat-modeler': `Threat register containing:
- Per-component STRIDE analysis
- Threat descriptions with attack vectors
- Impact and likelihood scores with rationale
- Prioritized risk ranking
- Mitigation recommendations

Saved to \`.gss/artifacts/threat-model/\``,
    'gss-auditor': `\`\`\`json
{
  "findings": [{
    "title": "string",
    "severity": "critical|high|medium|low|info",
    "owaspCategory": "string",
    "location": { "file": "string", "line": "number" },
    "evidence": "string",
    "confidence": "high|medium|low",
    "remediationHint": "string",
    "consultedDocs": ["string"]
  }],
  "consultation": { /* ConsultationTrace */ }
}
\`\`\`

Saved to \`.gss/artifacts/audit/\``,
    'gss-remediator': `\`\`\`json
{
  "remediationPlans": [{
    "findingId": "string",
    "targetFiles": ["string"],
    "changes": [{
      "file": "string",
      "description": "string",
      "type": "config|code|dependency"
    }],
    "sideEffects": ["string"],
    "verificationSteps": ["string"],
    "userApproval": "pending|approved|rejected",
    "consultedDocs": ["string"]
  }],
  "consultation": { /* ConsultationTrace */ }
}
\`\`\`

Saved to \`.gss/artifacts/plan-remediation/\``,
    'gss-verifier': `\`\`\`json
{
  "verifications": [{
    "findingId": "string",
    "status": "verified|partial|failed",
    "evidence": "string",
    "regressions": ["string"],
    "confidence": "high|medium|low",
    "testResults": ["string"],
    "consultedDocs": ["string"]
  }],
  "consultation": { /* ConsultationTrace */ }
}
\`\`\`

Saved to \`.gss/artifacts/verify/\``,
    'gss-reporter': `Comprehensive security report containing:
- Executive summary with key findings and risk overview
- Technical findings with evidence and OWASP mappings
- Remediation status and verification results
- Prioritized action items with ownership
- Consultation coverage summary across all workflows
- Gaps where coverage was incomplete

Saved to \`.gss/artifacts/report/\``,
  };

  return schemas[agentId] || 'Structured output following GSS artifact conventions.';
}

/**
 * Get refusal and escalation conditions for a role agent.
 * Merges previous escalation rules with explicit refusal conditions.
 */
function getRoleRefusalConditions(agentId: string): string {
  const conditions: Record<string, string> = {
    'gss-mapper': `This role MUST stop and escalate when:
- The codebase is too large to analyze in one session
- Critical dependencies cannot be resolved or accessed
- The project structure is ambiguous and cannot be reliably catalogued`,
    'gss-threat-modeler': `This role MUST stop and escalate when:
- Critical threats are identified that require immediate attention
- Insufficient information exists to assess a component's threat surface
- The threat landscape exceeds the scope of available security documents`,
    'gss-auditor': `This role MUST stop and escalate when:
- Critical vulnerabilities are found that pose immediate exploit risk
- The scope of the audit exceeds the available consultation coverage
- Evidence is insufficient to confirm or deny a suspected vulnerability
- Confidence in any critical finding is below acceptable thresholds`,
    'gss-remediator': `This role MUST refuse to proceed when:
- User has NOT given explicit approval for code changes
- The remediation requires architectural changes beyond the finding scope
- Side effects cannot be adequately assessed
- The fix would introduce new vulnerabilities or break existing functionality
This role MUST stop and escalate when:
- Remediation requires architectural changes
- Multiple findings interact in ways that complicate isolation`,
    'gss-verifier': `This role MUST stop and escalate when:
- Verification fails or reveals new issues not in the original findings
- The remediation cannot be verified against the original security documents
- Test infrastructure is unavailable or broken
- Regressions are found that cannot be attributed to the remediation`,
    'gss-reporter': `This role MUST stop and escalate when:
- Critical findings remain unaddressed in prior workflow artifacts
- Required workflow artifacts are missing
- Consultation coverage across the pipeline shows systematic gaps`,
  };

  return conditions[agentId] || '- Stop and escalate if uncertain or blocked';
}

/**
 * Get handoff expectations for a role agent.
 * Replaces the old delegation rules with workflow handoff descriptions.
 */
function getRoleHandoffs(agentId: string): string {
  const handoffs: Record<string, string> = {
    'gss-mapper': `**Passes to downstream workflows:**
- Codebase inventory → threat-model workflow
- Trust boundary map → audit workflow
- Dependency map → all downstream workflows
- Detected stack signals → all downstream workflows

**Artifact location:** \`.gss/artifacts/map-codebase/\``,
    'gss-threat-modeler': `**Passes to downstream workflows:**
- Threat register → audit workflow
- Risk assessment with scores → plan-remediation workflow
- Mitigation requirements → plan-remediation workflow

**Artifact location:** \`.gss/artifacts/threat-model/\``,
    'gss-auditor': `**Passes to downstream workflows:**
- Findings report with OWASP mapping → validate-findings workflow
- Remediation priorities → plan-remediation workflow
- Consultation trace → all downstream workflows

**Uses MCP for:** All security knowledge. No specialist delegation.

**Artifact location:** \`.gss/artifacts/audit/\``,
    'gss-remediator': `**Passes to downstream workflows:**
- Patch plan with specific changes → execute-remediation workflow
- Test specifications → verify workflow
- Consultation trace → all downstream workflows

**Uses MCP for:** Remediation guidance and coverage validation.

**Artifact location:** \`.gss/artifacts/plan-remediation/\``,
    'gss-verifier': `**Passes to downstream workflows:**
- Verification report → report workflow
- Regression analysis → report workflow
- Test coverage summary → report workflow
- Consultation trace → report workflow

**Validates:** MCP coverage from prior workflows.

**Artifact location:** \`.gss/artifacts/verify/\``,
    'gss-reporter': `**Consumes all prior artifacts:**
- map-codebase inventory
- threat-model register
- audit findings
- validate-findings results
- plan-remediation patch plans
- execute-remediation applied changes
- verify verification reports

**Aggregates:** Consultation traces from all workflows into final report.

**Artifact location:** \`.gss/artifacts/report/\``,
  };

  return handoffs[agentId] || '- Pass outputs to the next workflow in sequence';
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
 * Render a role agent file for Claude.
 *
 * Phase 7 template: 8-section MCP-aware role agent.
 * Sections: Mission, Context Inputs, MCP Consultation Rules, Reasoning Guardrails,
 * Output Schema, Refusal/Escalation Conditions, Handoff Expectations, Done Criteria.
 */
export function renderRoleAgent(agent: {
  id: string;
  title: string;
  description: string;
}): string {
  const primaryWorkflow = getPrimaryWorkflowForRole(agent.id);
  const mcpConfig = getRoleMcpConfig(agent.id);

  return `# ${agent.title}

**Agent ID:** \`${agent.id}\`
**Primary Workflow:** \`${primaryWorkflow}\`
**Access Level:** ${getAccessLevelText(agent.id)}

## Mission

${getRoleMission(agent.id)}

## Required Context Inputs

${getRoleContextInputs(agent.id)}

## MCP Consultation Rules

This role uses the GSS MCP server for security knowledge at the **${mcpConfig.level}** level.

${getRoleMcpRules(agent.id)}

## Reasoning Guardrails

${getRoleReasoningGuardrails(agent.id)}

## Output Schema

${getRoleOutputSchema(agent.id)}

## Refusal and Escalation Conditions

${getRoleRefusalConditions(agent.id)}

## Handoff Expectations

${getRoleHandoffs(agent.id)}

## Permissions

**May read:**
${getReadPermissions(agent.id)}

**May write to:**
${getWritePermissions(agent.id)}

## "Done" Means

This workflow is **complete** when:
${getDoneCriteria(agent.id)}
`;

}

/**
 * Render a Codex role skill file.
 *
 * Semantically aligned with the Claude role agent template but formatted
 * for the Codex skill structure. Same mission, same MCP rules, same guardrails.
 */
export function renderCodexRoleSkill(agent: {
  id: string;
  title: string;
  description: string;
}): string {
  const primaryWorkflow = getPrimaryWorkflowForRole(agent.id);
  const mcpConfig = getRoleMcpConfig(agent.id);

  return `# ${agent.title}

**Skill ID:** \`${agent.id}\`
**Primary Workflow:** \`${primaryWorkflow}\`
**Access Level:** ${getCodexAccessLevelText(agent.id)}

## Mission

${getRoleMission(agent.id)}

## MCP Security Consultation

This role uses the GSS MCP server for security knowledge at the **${mcpConfig.level}** level.

${getRoleMcpRules(agent.id)}

## Output Requirements

${getRoleOutputSchema(agent.id)}

## Constraints

${getRoleReasoningGuardrails(agent.id)}

${getRoleRefusalConditions(agent.id)}

## Completion Criteria

This skill is **complete** when:
${getDoneCriteria(agent.id)}
`;
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
    'gss-verifier': 'Verification-only. Run tests and verify fixes.',
    'gss-reporter': 'Read-only. Aggregate and format existing artifacts.',
  };

  return levels[agentId] || 'Full permissions with user approval required for writes.';
}

// =============================================================================
// MCP Consultation Section (Phase 6)
// =============================================================================

/**
 * Render the MCP consultation section for a workflow.
 * This replaces the old delegation plan sections for MCP-aware workflows.
 */
export function renderMcpConsultationSection(workflow: WorkflowDefinition): string {
  const sig = workflow.signalDerivation;
  if (!sig) {
    return '';
  }

  const stackSource = sig.stacks === 'from-codebase' ? 'Analyze the codebase to detect languages, frameworks, and platforms'
    : sig.stacks === 'from-prior-artifact' ? 'Read stack tags from the prior workflow artifact'
    : sig.stacks === 'from-diff-heuristics' ? 'Infer stack from changed file extensions and patterns in the diff'
    : 'No stack derivation for this workflow';

  const issueTagSource = sig.issueTags === 'from-findings' ? 'Extract issue tags from findings (e.g., "sql-injection", "xss")'
    : sig.issueTags === 'from-diff-heuristics' ? 'Infer issue categories from the types of changes in the diff'
    : 'No issue tag derivation for this workflow';

  const changedFilesSource = sig.changedFiles === 'from-diff' ? 'Extract file paths from the current diff or change set'
    : sig.changedFiles === 'from-prior-artifact' ? 'Read changed file paths from the prior workflow artifact'
    : 'No changed file derivation for this workflow';

  return `## MCP Security Consultation

This workflow uses the GSS MCP server for deterministic security knowledge access.

### Step 1: Derive Signals

Before consulting the MCP, derive these signals from the current context:

- **stacks**: ${stackSource}
- **issueTags**: ${issueTagSource}
- **changedFiles**: ${changedFilesSource}

### Step 2: Get Consultation Plan

Call the MCP tool:
\`\`\`
get_workflow_consultation_plan(workflowId="${workflow.id}", stacks=<derived>, issueTags=<derived>, changedFiles=<derived>)
\`\`\`

This returns required, optional, and followup documents.

### Step 3: Read Required Documents

For each required document, read via MCP resource:
\`\`\`
security://owasp/cheatsheet/{docId}
\`\`\`

### Step 4: Optionally Expand

If a required doc references related topics, call:
\`\`\`
get_related_security_docs(id=<docId>)
\`\`\`

### Step 5: Perform Reasoning

Use the consulted documents as grounding for workflow-specific analysis.

### Step 6: Validate Coverage

Before finalizing, call:
\`\`\`
validate_security_consultation(workflowId="${workflow.id}", consultedDocs=[<ids>], stacks=<derived>, issueTags=<derived>)
\`\`\`

### Step 7: Include Consultation Trace

Every artifact MUST include a consultation trace section:
\`\`\`json
{
  "consultation": {
    "plan": {
      "workflowId": "${workflow.id}",
      "generatedAt": "<timestamp>",
      "corpusVersion": "<version>",
      "requiredCount": <n>,
      "optionalCount": <n>,
      "followupCount": <n>
    },
    "consultedDocs": [
      { "id": "<doc-id>", "title": "<doc-title>", "sourceUrl": "<url>" }
    ],
    "coverageStatus": "pass" | "warn" | "fail",
    "requiredMissing": [],
    "notes": []
  }
}
\`\`\`

### Fallback

If the MCP server is unavailable, proceed with workflow-specific analysis and note in the consultation trace that MCP was unavailable. Do not block on MCP failure.`;
}

/**
 * Render the consultation trace requirement for a workflow.
 */
export function renderConsultationTraceRequirement(workflowId: string): string {
  return `**Consultation trace is included in all artifacts** with coverageStatus (pass/warn/fail). Workflow: ${workflowId}.`;
}
