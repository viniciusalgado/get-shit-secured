/**
 * Phase 7 — Role Helper Function Tests
 *
 * Unit tests for the individual helper functions used by the role agent
 * rendering pipeline. Tests verify content through rendered output since
 * helpers are module-private.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  renderRoleAgent,
  renderCodexRoleSkill,
} from '../../dist/core/renderer.js';

const ROLE_IDS = [
  'gss-mapper',
  'gss-threat-modeler',
  'gss-auditor',
  'gss-remediator',
  'gss-verifier',
  'gss-reporter',
];

const ROLE_AGENTS = ROLE_IDS.map(id => ({
  id,
  title: `GSS ${id.replace('gss-', '').replace(/-/g, ' ')}`,
  description: `Role agent for ${id}`,
}));

/**
 * Extract section content between two headings.
 */
function extractSection(output, sectionHeading) {
  const regex = new RegExp(`${escapeRegex(sectionHeading)}\\n\\n([\\s\\S]*?)\\n\\n## `);
  const match = output.match(regex);
  return match ? match[1].trim() : null;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// =============================================================================
// getPrimaryWorkflowForRole()
// =============================================================================

describe('Phase 7 — getPrimaryWorkflowForRole()', () => {
  const expectedMappings = {
    'gss-mapper': 'map-codebase',
    'gss-threat-modeler': 'threat-model',
    'gss-auditor': 'audit',
    'gss-remediator': 'plan-remediation',
    'gss-verifier': 'verify',
    'gss-reporter': 'report',
  };

  for (const [roleId, expectedWorkflow] of Object.entries(expectedMappings)) {
    it(`${roleId} maps to ${expectedWorkflow}`, () => {
      const agent = ROLE_AGENTS.find(a => a.id === roleId);
      const claude = renderRoleAgent(agent);
      const codex = renderCodexRoleSkill(agent);

      assert.ok(
        claude.includes(`**Primary Workflow:** \`${expectedWorkflow}\``),
        `Claude ${roleId} should map to ${expectedWorkflow}`
      );
      assert.ok(
        codex.includes(`**Primary Workflow:** \`${expectedWorkflow}\``),
        `Codex ${roleId} should map to ${expectedWorkflow}`
      );
    });
  }

  it('unknown role falls back to security-review', () => {
    const unknown = { id: 'gss-unknown', title: 'Unknown', description: '' };
    const output = renderRoleAgent(unknown);
    assert.ok(output.includes('**Primary Workflow:** `security-review`'));
  });
});

// =============================================================================
// getRoleMcpConfig()
// =============================================================================

describe('Phase 7 — getRoleMcpConfig()', () => {
  const expectedConfigs = {
    'gss-mapper': { level: 'minimal', mentionsConsultationPlan: true, mentionsValidation: false },
    'gss-threat-modeler': { level: 'moderate', mentionsConsultationPlan: true, mentionsValidation: false },
    'gss-auditor': { level: 'full', mentionsConsultationPlan: true, mentionsValidation: true },
    'gss-remediator': { level: 'full', mentionsConsultationPlan: true, mentionsValidation: true },
    'gss-verifier': { level: 'moderate', mentionsConsultationPlan: true, mentionsValidation: true },
    'gss-reporter': { level: 'none', mentionsConsultationPlan: false, mentionsValidation: false },
  };

  for (const [roleId, config] of Object.entries(expectedConfigs)) {
    it(`${roleId} has MCP level "${config.level}"`, () => {
      const agent = ROLE_AGENTS.find(a => a.id === roleId);
      const output = renderRoleAgent(agent);
      assert.ok(
        output.includes(`**${config.level}** level`),
        `${roleId} should have "${config.level}" level`
      );
    });

    it(`${roleId} MCP rules reference correct tools`, () => {
      const agent = ROLE_AGENTS.find(a => a.id === roleId);
      const output = renderRoleAgent(agent);

      if (config.mentionsConsultationPlan) {
        assert.ok(output.includes('get_workflow_consultation_plan'), `${roleId} should reference get_workflow_consultation_plan`);
      } else {
        assert.ok(!output.includes('get_workflow_consultation_plan'), `${roleId} should NOT reference get_workflow_consultation_plan`);
      }

      if (config.mentionsValidation) {
        assert.ok(output.includes('validate_security_consultation'), `${roleId} should reference validate_security_consultation`);
      }
    });
  }

  it('unknown role falls back to minimal level', () => {
    const unknown = { id: 'gss-unknown', title: 'Unknown', description: '' };
    const output = renderRoleAgent(unknown);
    assert.ok(output.includes('**minimal** level'), 'Unknown role should get minimal MCP level');
  });
});

// =============================================================================
// getRoleMission() — Non-empty and Distinct
// =============================================================================

describe('Phase 7 — getRoleMission()', () => {
  it('every role returns non-empty mission', () => {
    for (const agent of ROLE_AGENTS) {
      const output = renderRoleAgent(agent);
      const mission = extractSection(output, '## Mission');
      assert.ok(mission, `${agent.id} should have mission section`);
      assert.ok(mission.length > 20, `${agent.id} mission should be meaningful (>${20} chars), got "${mission.substring(0, 50)}"`);
    }
  });

  it('all 6 missions are distinct strings', () => {
    const missions = ROLE_AGENTS.map(agent => {
      const output = renderRoleAgent(agent);
      return extractSection(output, '## Mission');
    });

    const missionSet = new Set(missions);
    assert.strictEqual(missionSet.size, 6, 'All 6 missions should be distinct');
  });

  it('every mission mentions the role\'s primary activity', () => {
    const activityKeywords = {
      'gss-mapper': 'inventory',
      'gss-threat-modeler': 'threat',
      'gss-auditor': 'vulnerabilities',
      'gss-remediator': 'changes',
      'gss-verifier': 'Confirm',
      'gss-reporter': 'reports',
    };

    for (const agent of ROLE_AGENTS) {
      const output = renderRoleAgent(agent);
      const mission = extractSection(output, '## Mission');
      const keyword = activityKeywords[agent.id];
      assert.ok(
        mission.toLowerCase().includes(keyword.toLowerCase()),
        `${agent.id} mission should mention "${keyword}"`
      );
    }
  });
});

// =============================================================================
// getRoleReasoningGuardrails() — Non-empty and Distinct
// =============================================================================

describe('Phase 7 — getRoleReasoningGuardrails()', () => {
  it('every role returns non-empty guardrails', () => {
    for (const agent of ROLE_AGENTS) {
      const output = renderRoleAgent(agent);
      const guardrails = extractSection(output, '## Reasoning Guardrails');
      assert.ok(guardrails, `${agent.id} should have reasoning guardrails section`);
      assert.ok(guardrails.length > 10, `${agent.id} guardrails should be meaningful`);
    }
  });

  it('all 6 guardrail texts are distinct', () => {
    const guardrails = ROLE_AGENTS.map(agent => {
      const output = renderRoleAgent(agent);
      return extractSection(output, '## Reasoning Guardrails');
    });

    const guardrailSet = new Set(guardrails);
    assert.strictEqual(guardrailSet.size, 6, 'All 6 guardrail texts should be distinct');
  });
});

// =============================================================================
// getRoleRefusalConditions() — Non-empty and Distinct
// =============================================================================

describe('Phase 7 — getRoleRefusalConditions()', () => {
  it('every role returns non-empty refusal conditions', () => {
    for (const agent of ROLE_AGENTS) {
      const output = renderRoleAgent(agent);
      const refusal = extractSection(output, '## Refusal and Escalation Conditions');
      assert.ok(refusal, `${agent.id} should have refusal section`);
      assert.ok(refusal.length > 10, `${agent.id} refusal conditions should be meaningful`);
    }
  });

  it('all 6 refusal condition texts are distinct', () => {
    const conditions = ROLE_AGENTS.map(agent => {
      const output = renderRoleAgent(agent);
      return extractSection(output, '## Refusal and Escalation Conditions');
    });

    const conditionSet = new Set(conditions);
    assert.strictEqual(conditionSet.size, 6, 'All 6 refusal condition texts should be distinct');
  });

  it('every role\'s conditions include "MUST stop" or "MUST refuse"', () => {
    for (const agent of ROLE_AGENTS) {
      const output = renderRoleAgent(agent);
      const refusal = extractSection(output, '## Refusal and Escalation Conditions');
      assert.ok(
        refusal.includes('MUST stop') || refusal.includes('MUST refuse'),
        `${agent.id} should include "MUST stop" or "MUST refuse" in conditions`
      );
    }
  });
});

// =============================================================================
// getRoleHandoffs() — Non-empty and Correct Paths
// =============================================================================

describe('Phase 7 — getRoleHandoffs()', () => {
  it('every role returns non-empty handoffs', () => {
    for (const agent of ROLE_AGENTS) {
      const output = renderRoleAgent(agent);
      const handoffs = extractSection(output, '## Handoff Expectations');
      assert.ok(handoffs, `${agent.id} should have handoff section`);
      assert.ok(handoffs.length > 10, `${agent.id} handoffs should be meaningful`);
    }
  });

  it('every handoff references .gss/artifacts/<workflow>/', () => {
    const workflowPaths = {
      'gss-mapper': '.gss/artifacts/map-codebase/',
      'gss-threat-modeler': '.gss/artifacts/threat-model/',
      'gss-auditor': '.gss/artifacts/audit/',
      'gss-remediator': '.gss/artifacts/plan-remediation/',
      'gss-verifier': '.gss/artifacts/verify/',
      'gss-reporter': '.gss/artifacts/report/',
    };

    for (const agent of ROLE_AGENTS) {
      const output = renderRoleAgent(agent);
      const handoffs = extractSection(output, '## Handoff Expectations');
      assert.ok(
        handoffs.includes(workflowPaths[agent.id]),
        `${agent.id} handoff should reference ${workflowPaths[agent.id]}`
      );
    }
  });

  it('mapper handoff mentions threat-model and audit', () => {
    const mapper = ROLE_AGENTS.find(a => a.id === 'gss-mapper');
    const output = renderRoleAgent(mapper);
    const handoffs = extractSection(output, '## Handoff Expectations');
    assert.ok(handoffs.includes('threat-model'), 'Mapper should handoff to threat-model');
    assert.ok(handoffs.includes('audit'), 'Mapper should handoff to audit');
  });

  it('reporter handoff mentions all 7 prior workflow types', () => {
    const reporter = ROLE_AGENTS.find(a => a.id === 'gss-reporter');
    const output = renderRoleAgent(reporter);
    const handoffs = extractSection(output, '## Handoff Expectations');

    const expectedWorkflows = [
      'map-codebase',
      'threat-model',
      'audit',
      'validate-findings',
      'plan-remediation',
      'execute-remediation',
      'verify',
    ];

    for (const workflow of expectedWorkflows) {
      assert.ok(
        handoffs.includes(workflow),
        `Reporter should consume ${workflow} artifacts`
      );
    }
  });
});

// =============================================================================
// getRoleOutputSchema() — Non-empty and Correct
// =============================================================================

describe('Phase 7 — getRoleOutputSchema()', () => {
  it('every role returns non-empty output schema', () => {
    for (const agent of ROLE_AGENTS) {
      const output = renderRoleAgent(agent);
      const schema = extractSection(output, '## Output Schema');
      assert.ok(schema, `${agent.id} should have output schema section`);
      assert.ok(schema.length > 10, `${agent.id} schema should be meaningful`);
    }
  });

  it('data-heavy roles (auditor, remediator, verifier) include JSON example', () => {
    const dataRoles = ['gss-auditor', 'gss-remediator', 'gss-verifier'];
    for (const roleId of dataRoles) {
      const agent = ROLE_AGENTS.find(a => a.id === roleId);
      const output = renderRoleAgent(agent);
      const schema = extractSection(output, '## Output Schema');
      assert.ok(
        schema.includes('```json'),
        `${roleId} schema should include JSON example`
      );
    }
  });

  it('prose roles (mapper, threat-modeler, reporter) include text description', () => {
    const proseRoles = ['gss-mapper', 'gss-threat-modeler', 'gss-reporter'];
    for (const roleId of proseRoles) {
      const agent = ROLE_AGENTS.find(a => a.id === roleId);
      const output = renderRoleAgent(agent);
      const schema = extractSection(output, '## Output Schema');
      assert.ok(
        !schema.includes('```json'),
        `${roleId} schema should use prose description, not JSON`
      );
      assert.ok(
        schema.includes('.gss/artifacts/'),
        `${roleId} schema should reference artifact path`
      );
    }
  });
});

// =============================================================================
// Preserved Functions — Contract Tests
// =============================================================================

describe('Phase 7 — Preserved Function Contracts', () => {
  it('access levels unchanged for all 6 roles', () => {
    const expectedAccess = {
      'gss-mapper': '**read-only**',
      'gss-threat-modeler': '**read-only**',
      'gss-auditor': '**read-only**',
      'gss-remediator': '**write-capable**',
      'gss-verifier': '**verification-only**',
      'gss-reporter': '**read-only**',
    };

    for (const [roleId, expectedLevel] of Object.entries(expectedAccess)) {
      const agent = ROLE_AGENTS.find(a => a.id === roleId);
      const output = renderRoleAgent(agent);
      assert.ok(
        output.includes(expectedLevel),
        `${roleId} should have access level ${expectedLevel}`
      );
    }
  });

  it('read permissions include .gss/artifacts/ for all roles', () => {
    for (const agent of ROLE_AGENTS) {
      const output = renderRoleAgent(agent);
      // Read permissions section
      const readSection = output.match(/\*\*May read:\*\*\n([\s\S]*?)\n\n\*\*May write/);
      assert.ok(readSection, `${agent.id} should have read permissions section`);
      assert.ok(
        readSection[1].includes('.gss/artifacts/'),
        `${agent.id} should have .gss/artifacts/ in read permissions`
      );
    }
  });

  it('write permissions match role-specific artifact paths', () => {
    const writePaths = {
      'gss-mapper': '.gss/artifacts/map-codebase/',
      'gss-threat-modeler': '.gss/artifacts/threat-model/',
      'gss-auditor': '.gss/artifacts/audit/',
      'gss-remediator': '.gss/artifacts/plan-remediation/',
      'gss-verifier': '.gss/artifacts/verify/',
      'gss-reporter': '.gss/artifacts/report/',
    };

    for (const [roleId, expectedPath] of Object.entries(writePaths)) {
      const agent = ROLE_AGENTS.find(a => a.id === roleId);
      const output = renderRoleAgent(agent);
      const writeSection = output.match(/\*\*May write to:\*\*\n([\s\S]*?)\n\n##/);
      assert.ok(writeSection, `${roleId} should have write permissions section`);
      assert.ok(
        writeSection[1].includes(expectedPath),
        `${roleId} should have ${expectedPath} in write permissions`
      );
    }
  });

  it('done criteria include artifact path for all roles', () => {
    const artifactPaths = {
      'gss-mapper': '.gss/artifacts/map-codebase/',
      'gss-threat-modeler': '.gss/artifacts/threat-model/',
      'gss-auditor': '.gss/artifacts/audit/',
      'gss-remediator': '.gss/artifacts/plan-remediation/',
      'gss-verifier': '.gss/artifacts/verify/',
      'gss-reporter': '.gss/artifacts/report/',
    };

    for (const [roleId, expectedPath] of Object.entries(artifactPaths)) {
      const agent = ROLE_AGENTS.find(a => a.id === roleId);
      const output = renderRoleAgent(agent);
      // Done criteria section is the last section
      const doneMatch = output.match(/## "Done" Means\n\nThis workflow is \*\*complete\*\* when:\n([\s\S]*?)$/);
      assert.ok(doneMatch, `${roleId} should have done criteria`);
      assert.ok(
        doneMatch[1].includes(expectedPath),
        `${roleId} done criteria should reference ${expectedPath}`
      );
    }
  });
});
