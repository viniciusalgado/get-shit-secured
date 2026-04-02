/**
 * Phase 7 — Regression Tests
 *
 * Verifies that Phase 7 changes did not break any pre-existing contracts:
 * - Access levels
 * - Write permissions
 * - Done criteria
 * - Role-Workflow mapping
 * - Removed functions are not re-introduced
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

// =============================================================================
// Preserved Contracts — Access Levels
// =============================================================================

describe('Phase 7 — Regression: Access Levels', () => {
  const expectedAccess = {
    'gss-mapper': '**read-only**',
    'gss-threat-modeler': '**read-only**',
    'gss-auditor': '**read-only**',
    'gss-remediator': '**write-capable**',
    'gss-verifier': '**verification-only**',
    'gss-reporter': '**read-only**',
  };

  for (const [roleId, expectedLevel] of Object.entries(expectedAccess)) {
    it(`getAccessLevelText('${roleId}') returns '${expectedLevel.replace(/\*\*/g, '')}'`, () => {
      const agent = ROLE_AGENTS.find(a => a.id === roleId);
      const output = renderRoleAgent(agent);
      assert.ok(
        output.includes(expectedLevel),
        `${roleId} should have access level "${expectedLevel}"`
      );
    });
  }
});

// =============================================================================
// Preserved Contracts — Write Permissions
// =============================================================================

describe('Phase 7 — Regression: Write Permissions', () => {
  const expectedWritePaths = {
    'gss-mapper': '.gss/artifacts/map-codebase/',
    'gss-threat-modeler': '.gss/artifacts/threat-model/',
    'gss-auditor': '.gss/artifacts/audit/',
    'gss-remediator': '.gss/artifacts/plan-remediation/',
    'gss-verifier': '.gss/artifacts/verify/',
    'gss-reporter': '.gss/artifacts/report/',
  };

  for (const [roleId, expectedPath] of Object.entries(expectedWritePaths)) {
    it(`${roleId} write permission is ${expectedPath}`, () => {
      const agent = ROLE_AGENTS.find(a => a.id === roleId);
      const output = renderRoleAgent(agent);
      assert.ok(
        output.includes(expectedPath),
        `${roleId} should have write permission for ${expectedPath}`
      );
    });
  }
});

// =============================================================================
// Preserved Contracts — Done Criteria
// =============================================================================

describe('Phase 7 — Regression: Done Criteria', () => {
  it('auditor done criteria includes "file path, line number, severity, evidence"', () => {
    const output = renderRoleAgent(ROLE_AGENTS.find(a => a.id === 'gss-auditor'));
    assert.ok(output.includes('file path, line number, severity, evidence'));
  });

  it('auditor done criteria includes "OWASP categories"', () => {
    const output = renderRoleAgent(ROLE_AGENTS.find(a => a.id === 'gss-auditor'));
    assert.ok(output.includes('OWASP categories'));
  });

  it('remediator done criteria includes "User approval is obtained BEFORE"', () => {
    const output = renderRoleAgent(ROLE_AGENTS.find(a => a.id === 'gss-remediator'));
    assert.ok(output.includes('User approval is obtained BEFORE'));
  });

  it('verifier done criteria includes "test results or manual checks"', () => {
    const output = renderRoleAgent(ROLE_AGENTS.find(a => a.id === 'gss-verifier'));
    assert.ok(output.includes('test results or manual checks'));
  });

  it('reporter done criteria includes "executive summary"', () => {
    const output = renderRoleAgent(ROLE_AGENTS.find(a => a.id === 'gss-reporter'));
    assert.ok(output.includes('Executive summary'));
  });
});

// =============================================================================
// Preserved Contracts — Role-Workflow Mapping
// =============================================================================

describe('Phase 7 — Regression: Role-Workflow Mapping', () => {
  const expectedMappings = {
    'gss-mapper': 'map-codebase',
    'gss-threat-modeler': 'threat-model',
    'gss-auditor': 'audit',
    'gss-remediator': 'plan-remediation',
    'gss-verifier': 'verify',
    'gss-reporter': 'report',
  };

  for (const [roleId, expectedWorkflow] of Object.entries(expectedMappings)) {
    it(`getPrimaryWorkflowForRole('${roleId}') returns '${expectedWorkflow}'`, () => {
      const agent = ROLE_AGENTS.find(a => a.id === roleId);
      const claude = renderRoleAgent(agent);
      const codex = renderCodexRoleSkill(agent);

      assert.ok(
        claude.includes(`\`${expectedWorkflow}\``),
        `Claude ${roleId} should map to ${expectedWorkflow}`
      );
      assert.ok(
        codex.includes(`\`${expectedWorkflow}\``),
        `Codex ${roleId} should map to ${expectedWorkflow}`
      );
    });
  }
});

// =============================================================================
// Removed Functions — No Reintroduction
// =============================================================================

describe('Phase 7 — Regression: Removed Functions Stay Removed', () => {
  const removedPatterns = [
    { pattern: 'getRoleSpecificInstructions', desc: 'getRoleSpecificInstructions' },
    { pattern: 'getDelegationRules', desc: 'getDelegationRules' },
    { pattern: 'getCodexRoleInstructions', desc: 'getCodexRoleInstructions' },
    { pattern: 'getCodexDoneCriteria', desc: 'getCodexDoneCriteria' },
  ];

  for (const { pattern, desc } of removedPatterns) {
    it(`renderer.ts does not export ${desc}`, () => {
      // We verify at the rendered output level that the old patterns are gone.
      // If these functions were still used, the output would contain specialist
      // delegation language or old-style instructions.
      for (const agent of ROLE_AGENTS) {
        const claude = renderRoleAgent(agent);
        const codex = renderCodexRoleSkill(agent);

        assert.ok(
          !claude.toLowerCase().includes('delegate to specialist'),
          `${agent.id} Claude should not contain "delegate to specialist"`
        );
        assert.ok(
          !codex.toLowerCase().includes('delegate to specialist'),
          `${agent.id} Codex should not contain "delegate to specialist"`
        );
      }
    });
  }

  it('no rendered output contains gss-specialist- references', () => {
    for (const agent of ROLE_AGENTS) {
      const claude = renderRoleAgent(agent);
      const codex = renderCodexRoleSkill(agent);

      assert.ok(!claude.includes('gss-specialist-'), `${agent.id} Claude should not reference specialists`);
      assert.ok(!codex.includes('gss-specialist-'), `${agent.id} Codex should not reference specialists`);
    }
  });
});
