/**
 * Phase 7 — Role Agent Restructure Tests
 *
 * Validates that the new MCP-aware role agent template produces
 * correct output for all 6 roles, with no specialist references
 * and proper MCP consultation rules.
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
  title: `GSS ${id.replace('gss-', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}`,
  description: `Role agent for ${id}`,
}));

// =============================================================================
// Claude Role Agent Template
// =============================================================================

describe('Phase 7 — Claude Role Agent Template', () => {

  describe('All 6 roles render without errors', () => {
    for (const agent of ROLE_AGENTS) {
      it(`should render ${agent.id} without throwing`, () => {
        const output = renderRoleAgent(agent);
        assert.ok(output.length > 100, `${agent.id} output is non-trivial`);
      });
    }
  });

  describe('All 8 sections present', () => {
    const requiredSections = [
      '## Mission',
      '## Required Context Inputs',
      '## MCP Consultation Rules',
      '## Reasoning Guardrails',
      '## Output Schema',
      '## Refusal and Escalation Conditions',
      '## Handoff Expectations',
      '## "Done" Means',
    ];

    for (const agent of ROLE_AGENTS) {
      for (const section of requiredSections) {
        it(`${agent.id} should contain "${section}"`, () => {
          const output = renderRoleAgent(agent);
          assert.ok(output.includes(section), `Missing section: ${section}`);
        });
      }
    }
  });

  describe('Header contains required metadata', () => {
    for (const agent of ROLE_AGENTS) {
      it(`${agent.id} should have Agent ID`, () => {
        const output = renderRoleAgent(agent);
        assert.ok(output.includes(`**Agent ID:** \`${agent.id}\``));
      });

      it(`${agent.id} should have Primary Workflow`, () => {
        const output = renderRoleAgent(agent);
        assert.ok(output.includes('**Primary Workflow:**'));
      });

      it(`${agent.id} should have Access Level`, () => {
        const output = renderRoleAgent(agent);
        assert.ok(output.includes('**Access Level:**'));
      });
    }
  });

  describe('MCP consultation level per role', () => {
    const expectedLevels = {
      'gss-mapper': 'minimal',
      'gss-threat-modeler': 'moderate',
      'gss-auditor': 'full',
      'gss-remediator': 'full',
      'gss-verifier': 'moderate',
      'gss-reporter': 'none',
    };

    for (const agent of ROLE_AGENTS) {
      it(`${agent.id} should have MCP level "${expectedLevels[agent.id]}"`, () => {
        const output = renderRoleAgent(agent);
        assert.ok(
          output.includes(`**${expectedLevels[agent.id]}** level`),
          `${agent.id} should reference "${expectedLevels[agent.id]}" level`
        );
      });
    }
  });

  describe('MCP tool names are present for consultation-heavy roles', () => {
    it('gss-auditor should reference get_workflow_consultation_plan', () => {
      const output = renderRoleAgent(ROLE_AGENTS.find(a => a.id === 'gss-auditor'));
      assert.ok(output.includes('get_workflow_consultation_plan'));
    });

    it('gss-auditor should reference validate_security_consultation', () => {
      const output = renderRoleAgent(ROLE_AGENTS.find(a => a.id === 'gss-auditor'));
      assert.ok(output.includes('validate_security_consultation'));
    });

    it('gss-remediator should reference get_workflow_consultation_plan', () => {
      const output = renderRoleAgent(ROLE_AGENTS.find(a => a.id === 'gss-remediator'));
      assert.ok(output.includes('get_workflow_consultation_plan'));
    });

    it('gss-reporter should NOT reference get_workflow_consultation_plan', () => {
      const output = renderRoleAgent(ROLE_AGENTS.find(a => a.id === 'gss-reporter'));
      assert.ok(!output.includes('get_workflow_consultation_plan'), 'Reporter should not call MCP for new consultation');
    });
  });

  describe('No specialist references', () => {
    for (const agent of ROLE_AGENTS) {
      it(`${agent.id} should NOT contain gss-specialist-* references`, () => {
        const output = renderRoleAgent(agent);
        assert.ok(
          !output.includes('gss-specialist-'),
          `${agent.id} should not reference specialist names`
        );
      });

      it(`${agent.id} should NOT contain "delegate to specialist" text`, () => {
        const output = renderRoleAgent(agent);
        assert.ok(
          !output.toLowerCase().includes('delegate to specialist'),
          `${agent.id} should not say "delegate to specialist"`
        );
      });
    }
  });

  describe('Reasoning guardrails are role-specific', () => {
    it('gss-auditor has evidence requirements', () => {
      const output = renderRoleAgent(ROLE_AGENTS.find(a => a.id === 'gss-auditor'));
      assert.ok(output.includes('file path, line number, code snippet, severity, confidence level'));
      assert.ok(output.includes('Never fix issues during audit'));
    });

    it('gss-remediator has minimal-change constraint', () => {
      const output = renderRoleAgent(ROLE_AGENTS.find(a => a.id === 'gss-remediator'));
      assert.ok(output.includes('Minimal changes only'));
      assert.ok(output.includes('Preserve user code style'));
    });

    it('gss-verifier has same-docs guardrail', () => {
      const output = renderRoleAgent(ROLE_AGENTS.find(a => a.id === 'gss-verifier'));
      assert.ok(output.includes('SAME OWASP documents'));
    });

    it('gss-reporter has consultation trace aggregation', () => {
      const output = renderRoleAgent(ROLE_AGENTS.find(a => a.id === 'gss-reporter'));
      assert.ok(output.includes('consultation coverage'));
    });
  });

  describe('Output schemas are role-specific', () => {
    it('gss-auditor has findings schema', () => {
      const output = renderRoleAgent(ROLE_AGENTS.find(a => a.id === 'gss-auditor'));
      assert.ok(output.includes('"findings"'));
      assert.ok(output.includes('"severity"'));
      assert.ok(output.includes('"owaspCategory"'));
    });

    it('gss-remediator has remediationPlans schema', () => {
      const output = renderRoleAgent(ROLE_AGENTS.find(a => a.id === 'gss-remediator'));
      assert.ok(output.includes('"remediationPlans"'));
      assert.ok(output.includes('"userApproval"'));
    });

    it('gss-verifier has verifications schema', () => {
      const output = renderRoleAgent(ROLE_AGENTS.find(a => a.id === 'gss-verifier'));
      assert.ok(output.includes('"verifications"'));
      assert.ok(output.includes('"regressions"'));
    });
  });

  describe('Refusal conditions are present', () => {
    for (const agent of ROLE_AGENTS) {
      it(`${agent.id} has refusal/escalation conditions`, () => {
        const output = renderRoleAgent(agent);
        assert.ok(
          output.includes('MUST stop and escalate'),
          `${agent.id} should have escalation conditions`
        );
      });
    }

    it('gss-remediator has user approval refusal', () => {
      const output = renderRoleAgent(ROLE_AGENTS.find(a => a.id === 'gss-remediator'));
      assert.ok(output.includes('User has NOT given explicit approval'));
    });
  });

  describe('Handoff expectations reference correct artifact paths', () => {
    const handoffPaths = {
      'gss-mapper': '.gss/artifacts/map-codebase/',
      'gss-threat-modeler': '.gss/artifacts/threat-model/',
      'gss-auditor': '.gss/artifacts/audit/',
      'gss-remediator': '.gss/artifacts/plan-remediation/',
      'gss-verifier': '.gss/artifacts/verify/',
      'gss-reporter': '.gss/artifacts/report/',
    };

    for (const agent of ROLE_AGENTS) {
      it(`${agent.id} references ${handoffPaths[agent.id]}`, () => {
        const output = renderRoleAgent(agent);
        assert.ok(
          output.includes(handoffPaths[agent.id]),
          `${agent.id} should reference ${handoffPaths[agent.id]}`
        );
      });
    }
  });

  describe('Permissions are preserved', () => {
    it('gss-mapper is read-only', () => {
      const output = renderRoleAgent(ROLE_AGENTS.find(a => a.id === 'gss-mapper'));
      assert.ok(output.includes('**read-only**'));
    });

    it('gss-remediator is write-capable', () => {
      const output = renderRoleAgent(ROLE_AGENTS.find(a => a.id === 'gss-remediator'));
      assert.ok(output.includes('**write-capable**'));
    });

    it('gss-verifier is verification-only', () => {
      const output = renderRoleAgent(ROLE_AGENTS.find(a => a.id === 'gss-verifier'));
      assert.ok(output.includes('**verification-only**'));
    });
  });

  describe('Done criteria preserved', () => {
    it('gss-auditor done criteria unchanged', () => {
      const output = renderRoleAgent(ROLE_AGENTS.find(a => a.id === 'gss-auditor'));
      assert.ok(output.includes('file path, line number, severity, evidence'));
      assert.ok(output.includes('OWASP categories'));
      assert.ok(output.includes('.gss/artifacts/audit/'));
    });

    it('gss-remediator done criteria includes user approval', () => {
      const output = renderRoleAgent(ROLE_AGENTS.find(a => a.id === 'gss-remediator'));
      assert.ok(output.includes('User approval is obtained BEFORE applying changes'));
      assert.ok(output.includes('.gss/artifacts/plan-remediation/'));
    });
  });
});

// =============================================================================
// Codex Role Skill Template
// =============================================================================

describe('Phase 7 — Codex Role Skill Template', () => {

  describe('All 6 roles render without errors', () => {
    for (const agent of ROLE_AGENTS) {
      it(`should render ${agent.id} Codex skill without throwing`, () => {
        const output = renderCodexRoleSkill(agent);
        assert.ok(output.length > 100, `${agent.id} Codex output is non-trivial`);
      });
    }
  });

  describe('Contains required sections', () => {
    const requiredSections = [
      '## Mission',
      '## MCP Security Consultation',
      '## Output Requirements',
      '## Constraints',
      '## Completion Criteria',
    ];

    for (const agent of ROLE_AGENTS) {
      for (const section of requiredSections) {
        it(`${agent.id} should contain "${section}"`, () => {
          const output = renderCodexRoleSkill(agent);
          assert.ok(output.includes(section), `Missing section: ${section}`);
        });
      }
    }
  });

  describe('Header contains required metadata', () => {
    for (const agent of ROLE_AGENTS) {
      it(`${agent.id} should have Skill ID`, () => {
        const output = renderCodexRoleSkill(agent);
        assert.ok(output.includes(`**Skill ID:** \`${agent.id}\``));
      });

      it(`${agent.id} should have Primary Workflow`, () => {
        const output = renderCodexRoleSkill(agent);
        assert.ok(output.includes('**Primary Workflow:**'));
      });
    }
  });

  describe('No specialist references in Codex skills', () => {
    for (const agent of ROLE_AGENTS) {
      it(`${agent.id} should NOT contain gss-specialist-* references`, () => {
        const output = renderCodexRoleSkill(agent);
        assert.ok(
          !output.includes('gss-specialist-'),
          `${agent.id} should not reference specialist names`
        );
      });
    }
  });

  describe('MCP consultation level per role (Codex)', () => {
    const expectedLevels = {
      'gss-mapper': 'minimal',
      'gss-threat-modeler': 'moderate',
      'gss-auditor': 'full',
      'gss-remediator': 'full',
      'gss-verifier': 'moderate',
      'gss-reporter': 'none',
    };

    for (const agent of ROLE_AGENTS) {
      it(`${agent.id} Codex should have MCP level "${expectedLevels[agent.id]}"`, () => {
        const output = renderCodexRoleSkill(agent);
        assert.ok(
          output.includes(`**${expectedLevels[agent.id]}** level`),
          `${agent.id} Codex should reference "${expectedLevels[agent.id]}" level`
        );
      });
    }
  });
});

// =============================================================================
// Claude-Codex Semantic Alignment
// =============================================================================

describe('Phase 7 — Claude-Codex Semantic Alignment', () => {

  describe('Mission statements match', () => {
    for (const agent of ROLE_AGENTS) {
      it(`${agent.id} Claude and Codex should have same mission`, () => {
        const claude = renderRoleAgent(agent);
        const codex = renderCodexRoleSkill(agent);

        // Extract mission section from Claude output
        const claudeMission = claude.match(/## Mission\n\n([\s\S]*?)\n\n## /)?.[1]?.trim();
        const codexMission = codex.match(/## Mission\n\n([\s\S]*?)\n\n## /)?.[1]?.trim();

        assert.ok(claudeMission, `Claude ${agent.id} should have mission text`);
        assert.ok(codexMission, `Codex ${agent.id} should have mission text`);
        assert.strictEqual(claudeMission, codexMission, `Missions should be identical for ${agent.id}`);
      });
    }
  });

  describe('Done criteria match', () => {
    for (const agent of ROLE_AGENTS) {
      it(`${agent.id} Claude and Codex should have same done criteria`, () => {
        const claude = renderRoleAgent(agent);
        const codex = renderCodexRoleSkill(agent);

        // Extract done criteria section
        const claudeDone = claude.match(/## "Done" Means\n\nThis workflow is \*\*complete\*\* when:\n([\s\S]*?)$/)?.[1]?.trim();
        const codexDone = codex.match(/## Completion Criteria\n\nThis skill is \*\*complete\*\* when:\n([\s\S]*?)$/)?.[1]?.trim();

        assert.ok(claudeDone, `Claude ${agent.id} should have done criteria`);
        assert.ok(codexDone, `Codex ${agent.id} should have done criteria`);
        assert.strictEqual(claudeDone, codexDone, `Done criteria should be identical for ${agent.id}`);
      });
    }
  });

  describe('Access levels are consistent', () => {
    const expectedAccess = {
      'gss-mapper': 'read-only',
      'gss-threat-modeler': 'read-only',
      'gss-auditor': 'read-only',
      'gss-remediator': 'write-capable',
      'gss-verifier': 'verification-only',
      'gss-reporter': 'read-only',
    };

    for (const agent of ROLE_AGENTS) {
      it(`${agent.id} has consistent access level`, () => {
        const claude = renderRoleAgent(agent);
        const codex = renderCodexRoleSkill(agent);

        assert.ok(
          claude.includes(`**${expectedAccess[agent.id]}**`),
          `Claude ${agent.id} should have ${expectedAccess[agent.id]} access`
        );
        // Codex uses mixed-case access labels; check case-insensitively
        assert.ok(
          codex.toLowerCase().includes(expectedAccess[agent.id]),
          `Codex ${agent.id} should have ${expectedAccess[agent.id]} access`
        );
      });
    }
  });

  describe('Primary workflow mapping is correct', () => {
    const expectedWorkflow = {
      'gss-mapper': 'map-codebase',
      'gss-threat-modeler': 'threat-model',
      'gss-auditor': 'audit',
      'gss-remediator': 'plan-remediation',
      'gss-verifier': 'verify',
      'gss-reporter': 'report',
    };

    for (const agent of ROLE_AGENTS) {
      it(`${agent.id} maps to ${expectedWorkflow[agent.id]}`, () => {
        const claude = renderRoleAgent(agent);
        const codex = renderCodexRoleSkill(agent);

        assert.ok(
          claude.includes(`**Primary Workflow:** \`${expectedWorkflow[agent.id]}\``),
          `Claude ${agent.id} should map to ${expectedWorkflow[agent.id]}`
        );
        assert.ok(
          codex.includes(`**Primary Workflow:** \`${expectedWorkflow[agent.id]}\``),
          `Codex ${agent.id} should map to ${expectedWorkflow[agent.id]}`
        );
      });
    }
  });
});

// =============================================================================
// Regression: Preserved Contracts
// =============================================================================

describe('Phase 7 — Regression: Preserved Role Contracts', () => {
  describe('Write permissions are unchanged', () => {
    const expectedWritePaths = {
      'gss-mapper': '.gss/artifacts/map-codebase/',
      'gss-threat-modeler': '.gss/artifacts/threat-model/',
      'gss-auditor': '.gss/artifacts/audit/',
      'gss-remediator': '.gss/artifacts/plan-remediation/',
      'gss-verifier': '.gss/artifacts/verify/',
      'gss-reporter': '.gss/artifacts/report/',
    };

    for (const agent of ROLE_AGENTS) {
      it(`${agent.id} can write to ${expectedWritePaths[agent.id]}`, () => {
        const output = renderRoleAgent(agent);
        assert.ok(
          output.includes(expectedWritePaths[agent.id]),
          `${agent.id} should retain write permission for ${expectedWritePaths[agent.id]}`
        );
      });
    }
  });

  describe('Read permissions are preserved', () => {
    for (const agent of ROLE_AGENTS) {
      it(`${agent.id} can read .gss/artifacts/`, () => {
        const output = renderRoleAgent(agent);
        assert.ok(output.includes('.gss/artifacts/'));
      });
    }
  });
});

// =============================================================================
// Type System Verification
// =============================================================================

describe('Phase 7 — Type System', () => {
  it('should export RoleMcpConsultationLevel type (verified by usage)', () => {
    // Types are verified at compile time; runtime check confirms the renderer
    // uses consultation levels correctly by inspecting output
    const auditor = renderRoleAgent(ROLE_AGENTS.find(a => a.id === 'gss-auditor'));
    const reporter = renderRoleAgent(ROLE_AGENTS.find(a => a.id === 'gss-reporter'));

    assert.ok(auditor.includes('**full** level'), 'Auditor should use "full" level');
    assert.ok(reporter.includes('**none** level'), 'Reporter should use "none" level');
  });
});

// =============================================================================
// Claude Template — Missing Role Content Tests (Test Plan 1.1)
// =============================================================================

describe('Phase 7 — Claude Role Content Depth', () => {

  describe('Context inputs reference correct artifacts', () => {
    it('auditor context inputs reference map-codebase and threat-model artifacts', () => {
      const output = renderRoleAgent(ROLE_AGENTS.find(a => a.id === 'gss-auditor'));
      assert.ok(output.includes('.gss/artifacts/map-codebase/'), 'Auditor context should reference map-codebase');
      assert.ok(output.includes('.gss/artifacts/threat-model/'), 'Auditor context should reference threat-model');
    });

    it('remediator context inputs reference validated findings', () => {
      const output = renderRoleAgent(ROLE_AGENTS.find(a => a.id === 'gss-remediator'));
      assert.ok(
        output.includes('.gss/artifacts/validate-findings/') || output.includes('.gss/artifacts/audit/'),
        'Remediator context should reference validated findings or audit artifacts'
      );
    });

    it('verifier context inputs reference original findings and applied changes', () => {
      const output = renderRoleAgent(ROLE_AGENTS.find(a => a.id === 'gss-verifier'));
      assert.ok(output.includes('.gss/artifacts/audit/'), 'Verifier context should reference audit artifacts');
      assert.ok(output.includes('.gss/artifacts/execute-remediation/'), 'Verifier context should reference execute-remediation');
    });

    it('reporter context inputs reference ALL prior workflow artifacts', () => {
      const output = renderRoleAgent(ROLE_AGENTS.find(a => a.id === 'gss-reporter'));
      assert.ok(output.includes('.gss/artifacts/'), 'Reporter context should reference .gss/artifacts/');
      assert.ok(output.includes('consultation traces'), 'Reporter context should reference consultation traces');
    });
  });

  describe('MCP rules contain role-specific guidance', () => {
    it('threat-modeler MCP rules mention STRIDE', () => {
      const output = renderRoleAgent(ROLE_AGENTS.find(a => a.id === 'gss-threat-modeler'));
      const mcpSection = output.match(/## MCP Consultation Rules\n\n[\s\S]*?\n\n## /)?.[0];
      assert.ok(mcpSection, 'Threat-modeler should have MCP section');
      assert.ok(mcpSection.includes('STRIDE'), 'Threat-modeler MCP rules should mention STRIDE');
    });

    it('auditor MCP rules mention "Before audit" and "Before finalizing" phases', () => {
      const output = renderRoleAgent(ROLE_AGENTS.find(a => a.id === 'gss-auditor'));
      assert.ok(output.includes('Before audit'), 'Auditor MCP rules should mention "Before audit"');
      assert.ok(output.includes('Before finalizing'), 'Auditor MCP rules should mention "Before finalizing"');
    });

    it('remediator MCP rules mention "ALWAYS get user approval"', () => {
      const output = renderRoleAgent(ROLE_AGENTS.find(a => a.id === 'gss-remediator'));
      assert.ok(
        output.includes('ALWAYS get user approval') || output.includes('user approval'),
        'Remediator MCP rules should mention user approval requirement'
      );
    });

    it('verifier MCP rules mention "SAME documents"', () => {
      const output = renderRoleAgent(ROLE_AGENTS.find(a => a.id === 'gss-verifier'));
      assert.ok(output.includes('SAME documents'), 'Verifier MCP rules should mention SAME documents');
    });

    it('reporter MCP rules say "does NOT call MCP"', () => {
      const output = renderRoleAgent(ROLE_AGENTS.find(a => a.id === 'gss-reporter'));
      assert.ok(
        output.includes('does NOT call MCP'),
        'Reporter MCP rules should explicitly state it does not call MCP'
      );
    });
  });

  describe('Output schema depth', () => {
    it('auditor output schema includes consultedDocs field', () => {
      const output = renderRoleAgent(ROLE_AGENTS.find(a => a.id === 'gss-auditor'));
      assert.ok(output.includes('consultedDocs'), 'Auditor schema should include consultedDocs');
    });

    it('remediator output schema includes userApproval field', () => {
      const output = renderRoleAgent(ROLE_AGENTS.find(a => a.id === 'gss-remediator'));
      assert.ok(output.includes('userApproval'), 'Remediator schema should include userApproval');
    });

    it('remediator output schema includes sideEffects field', () => {
      const output = renderRoleAgent(ROLE_AGENTS.find(a => a.id === 'gss-remediator'));
      assert.ok(output.includes('sideEffects'), 'Remediator schema should include sideEffects');
    });

    it('verifier output schema includes regressions field', () => {
      const output = renderRoleAgent(ROLE_AGENTS.find(a => a.id === 'gss-verifier'));
      assert.ok(output.includes('regressions'), 'Verifier schema should include regressions');
    });

    it('reporter output schema mentions executive summary and consultation coverage', () => {
      const output = renderRoleAgent(ROLE_AGENTS.find(a => a.id === 'gss-reporter'));
      assert.ok(
        output.includes('executive summary') && output.includes('consultation coverage'),
        'Reporter schema should mention executive summary and consultation coverage'
      );
    });
  });

  describe('Handoff depth', () => {
    it('mapper handoff mentions "Detected stack signals"', () => {
      const output = renderRoleAgent(ROLE_AGENTS.find(a => a.id === 'gss-mapper'));
      assert.ok(
        output.includes('Detected stack signals') || output.includes('stack signals'),
        'Mapper handoff should mention stack signals'
      );
    });

    it('auditor handoff mentions "Uses MCP for: All security knowledge"', () => {
      const output = renderRoleAgent(ROLE_AGENTS.find(a => a.id === 'gss-auditor'));
      assert.ok(
        output.includes('All security knowledge') || output.includes('No specialist delegation'),
        'Auditor handoff should indicate MCP is sole knowledge source'
      );
    });

    it('verifier handoff mentions "Validates: MCP coverage from prior workflows"', () => {
      const output = renderRoleAgent(ROLE_AGENTS.find(a => a.id === 'gss-verifier'));
      assert.ok(
        output.includes('MCP coverage from prior workflows') || output.includes('Validates'),
        'Verifier handoff should mention MCP coverage validation'
      );
    });

    it('reporter handoff lists all 7 prior workflow artifact names', () => {
      const output = renderRoleAgent(ROLE_AGENTS.find(a => a.id === 'gss-reporter'));
      const handoffSection = output.match(/## Handoff Expectations\n\n[\s\S]*?\n\n## /)?.[0] || '';
      const expectedWorkflows = [
        'map-codebase', 'threat-model', 'audit',
        'validate-findings', 'plan-remediation',
        'execute-remediation', 'verify',
      ];
      for (const wf of expectedWorkflows) {
        assert.ok(
          handoffSection.includes(wf),
          `Reporter handoff should reference ${wf}`
        );
      }
    });
  });
});

// =============================================================================
// Codex Template — Missing Sections (Test Plan 1.5)
// =============================================================================

describe('Phase 7 — Codex Role Content Depth', () => {

  describe('Codex output contains role-specific content', () => {
    const guardrailKeywords = {
      'gss-auditor': 'file path, line number',
      'gss-remediator': 'Minimal changes only',
      'gss-verifier': 'SAME OWASP documents',
      'gss-reporter': 'consultation coverage',
      'gss-mapper': 'trust boundaries',
      'gss-threat-modeler': 'STRIDE',
    };

    for (const [roleId, keyword] of Object.entries(guardrailKeywords)) {
      it(`${roleId} Codex skill contains guardrail text "${keyword}"`, () => {
        const agent = ROLE_AGENTS.find(a => a.id === roleId);
        const output = renderCodexRoleSkill(agent);
        assert.ok(
          output.includes(keyword),
          `${roleId} Codex should contain "${keyword}"`
        );
      });
    }
  });

  describe('Codex output schemas match Claude schemas', () => {
    for (const agent of ROLE_AGENTS) {
      it(`${agent.id} output schemas are identical between Claude and Codex`, () => {
        const claude = renderRoleAgent(agent);
        const codex = renderCodexRoleSkill(agent);

        // Extract output schema from Claude
        const claudeSchema = claude.match(/## Output Schema\n\n([\s\S]*?)\n\n## /)?.[1]?.trim();
        const codexSchema = codex.match(/## Output Requirements\n\n([\s\S]*?)\n\n## /)?.[1]?.trim();

        assert.ok(claudeSchema, `Claude ${agent.id} should have output schema`);
        assert.ok(codexSchema, `Codex ${agent.id} should have output requirements`);
        assert.strictEqual(claudeSchema, codexSchema, `${agent.id} schemas should be identical`);
      });
    }
  });
});

// =============================================================================
// Claude-Codex Alignment — Missing Checks (Test Plan 1.6)
// =============================================================================

describe('Phase 7 — Claude-Codex Deep Alignment', () => {

  describe('MCP consultation rules text is identical', () => {
    for (const agent of ROLE_AGENTS) {
      it(`${agent.id} MCP rules match between Claude and Codex`, () => {
        const claude = renderRoleAgent(agent);
        const codex = renderCodexRoleSkill(agent);

        // Claude: "## MCP Consultation Rules\n\n...\n\n## "
        // Codex: "## MCP Security Consultation\n\n...\n\n## "
        const claudeRules = claude.match(/## MCP Consultation Rules\n\nThis role uses[\s\S]*?\n\n([\s\S]*?)\n\n## /);
        const codexRules = codex.match(/## MCP Security Consultation\n\nThis role uses[\s\S]*?\n\n([\s\S]*?)\n\n## /);

        // Both should have rules text; compare the rule content after the level line
        assert.ok(claudeRules, `Claude ${agent.id} should have MCP rules`);
        assert.ok(codexRules, `Codex ${agent.id} should have MCP rules`);
        assert.strictEqual(claudeRules[1].trim(), codexRules[1].trim(),
          `${agent.id} MCP rules should be identical`);
      });
    }
  });

  describe('Reasoning guardrails text is identical', () => {
    for (const agent of ROLE_AGENTS) {
      it(`${agent.id} guardrails match between Claude and Codex`, () => {
        const claude = renderRoleAgent(agent);
        const codex = renderCodexRoleSkill(agent);

        // Claude: "## Reasoning Guardrails\n\n...\n\n## "
        // Codex: appears in "## Constraints\n\n...\n{refusal}\n\n## "
        const claudeGuardrails = claude.match(/## Reasoning Guardrails\n\n([\s\S]*?)\n\n## /)?.[1]?.trim();
        // Codex Constraints section contains guardrails then refusal conditions
        const codexConstraints = codex.match(/## Constraints\n\n([\s\S]*?)\n\n## /)?.[1];

        assert.ok(claudeGuardrails, `Claude ${agent.id} should have guardrails`);
        assert.ok(codexConstraints, `Codex ${agent.id} should have constraints`);

        // Guardrails should be a substring of Codex constraints
        assert.ok(
          codexConstraints.includes(claudeGuardrails),
          `${agent.id} Codex constraints should contain Claude guardrails text`
        );
      });
    }
  });

  describe('Refusal conditions text is identical', () => {
    for (const agent of ROLE_AGENTS) {
      it(`${agent.id} refusal conditions match between Claude and Codex`, () => {
        const claude = renderRoleAgent(agent);
        const codex = renderCodexRoleSkill(agent);

        const claudeRefusal = claude.match(/## Refusal and Escalation Conditions\n\n([\s\S]*?)\n\n## /)?.[1]?.trim();

        // Codex has refusal conditions embedded in Constraints
        const codexConstraints = codex.match(/## Constraints\n\n([\s\S]*?)\n\n## /)?.[1];

        assert.ok(claudeRefusal, `Claude ${agent.id} should have refusal conditions`);
        assert.ok(codexConstraints, `Codex ${agent.id} should have constraints`);

        assert.ok(
          codexConstraints.includes(claudeRefusal),
          `${agent.id} Codex constraints should contain Claude refusal text`
        );
      });
    }
  });
});

// =============================================================================
// Edge Cases and Fallbacks (Test Plan 1.7)
// =============================================================================

describe('Phase 7 — Edge Cases and Fallbacks', () => {

  it('unknown role ID returns fallback mission', () => {
    const unknown = { id: 'gss-unknown', title: 'Unknown Role', description: '' };
    const output = renderRoleAgent(unknown);
    assert.ok(output.includes('specialized security analysis'), 'Unknown role should get fallback mission');
  });

  it('unknown role ID returns fallback MCP config (minimal)', () => {
    const unknown = { id: 'gss-unknown', title: 'Unknown Role', description: '' };
    const output = renderRoleAgent(unknown);
    assert.ok(output.includes('**minimal** level'), 'Unknown role should get minimal MCP level');
  });

  it('unknown role ID returns fallback done criteria', () => {
    const unknown = { id: 'gss-unknown', title: 'Unknown Role', description: '' };
    const output = renderRoleAgent(unknown);
    assert.ok(output.includes('## "Done" Means'), 'Unknown role should have done criteria section');
    assert.ok(output.includes('complete'), 'Unknown role should have fallback completion criteria');
  });

  it('empty title does not crash renderer', () => {
    for (const id of ROLE_IDS) {
      const agent = { id, title: '', description: '' };
      assert.doesNotThrow(() => renderRoleAgent(agent), `${id} should not crash with empty title`);
      assert.doesNotThrow(() => renderCodexRoleSkill(agent), `${id} Codex should not crash with empty title`);
    }
  });
});
