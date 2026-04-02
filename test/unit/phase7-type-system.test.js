/**
 * Phase 7 — Type System Tests
 *
 * Validates that the new Phase 7 types (RoleMcpConsultationLevel, RoleMcpConfig)
 * are correctly used by the renderer. Since TypeScript types are erased at runtime,
 * we verify the runtime behavior matches the type contract.
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

const VALID_LEVELS = ['full', 'moderate', 'minimal', 'none'];

const KNOWN_MCP_TOOLS = [
  'get_workflow_consultation_plan',
  'read_security_doc',
  'get_related_security_docs',
  'validate_security_consultation',
];

const ROLE_AGENTS = ROLE_IDS.map(id => ({
  id,
  title: `GSS ${id.replace('gss-', '').replace(/-/g, ' ')}`,
  description: `Role agent for ${id}`,
}));

/**
 * Extract the MCP consultation level from rendered output.
 * The template renders: "at the **{level}** level"
 */
function extractMcpLevel(output) {
  const match = output.match(/at the \*\*(\w+)\*\* level/);
  return match ? match[1] : null;
}

describe('Phase 7 — Type System Verification', () => {

  describe('RoleMcpConsultationLevel — all 4 valid values are used', () => {
    it('full is used by auditor and remediator', () => {
      const auditorLevel = extractMcpLevel(renderRoleAgent(ROLE_AGENTS.find(a => a.id === 'gss-auditor')));
      const remediatorLevel = extractMcpLevel(renderRoleAgent(ROLE_AGENTS.find(a => a.id === 'gss-remediator')));
      assert.strictEqual(auditorLevel, 'full');
      assert.strictEqual(remediatorLevel, 'full');
    });

    it('moderate is used by threat-modeler and verifier', () => {
      const threatLevel = extractMcpLevel(renderRoleAgent(ROLE_AGENTS.find(a => a.id === 'gss-threat-modeler')));
      const verifierLevel = extractMcpLevel(renderRoleAgent(ROLE_AGENTS.find(a => a.id === 'gss-verifier')));
      assert.strictEqual(threatLevel, 'moderate');
      assert.strictEqual(verifierLevel, 'moderate');
    });

    it('minimal is used by mapper', () => {
      const mapperLevel = extractMcpLevel(renderRoleAgent(ROLE_AGENTS.find(a => a.id === 'gss-mapper')));
      assert.strictEqual(mapperLevel, 'minimal');
    });

    it('none is used by reporter', () => {
      const reporterLevel = extractMcpLevel(renderRoleAgent(ROLE_AGENTS.find(a => a.id === 'gss-reporter')));
      assert.strictEqual(reporterLevel, 'none');
    });
  });

  describe('RoleMcpConfig — every role returns valid config', () => {
    for (const agent of ROLE_AGENTS) {
      it(`${agent.id} has a valid MCP level`, () => {
        const level = extractMcpLevel(renderRoleAgent(agent));
        assert.ok(level, `${agent.id} should have an MCP level`);
        assert.ok(VALID_LEVELS.includes(level), `${agent.id} level "${level}" should be one of: ${VALID_LEVELS.join(', ')}`);
      });

      it(`${agent.id} MCP level is consistent between Claude and Codex`, () => {
        const claudeLevel = extractMcpLevel(renderRoleAgent(agent));
        const codexLevel = extractMcpLevel(renderCodexRoleSkill(agent));
        assert.strictEqual(claudeLevel, codexLevel, `${agent.id} should have same MCP level in both templates`);
      });
    }
  });

  describe('MCP tool names are from known set', () => {
    for (const agent of ROLE_AGENTS) {
      it(`${agent.id} only references known MCP tools`, () => {
        const output = renderRoleAgent(agent);
        // Find all tool references in backticks that look like MCP tool names
        const toolRefs = output.match(/`([a-z_]+)`/g) || [];
        const mcpToolRefs = toolRefs
          .map(ref => ref.replace(/`/g, ''))
          .filter(ref => ref.includes('_'));

        for (const toolRef of mcpToolRefs) {
          assert.ok(
            KNOWN_MCP_TOOLS.includes(toolRef),
            `Unknown MCP tool "${toolRef}" in ${agent.id} — not in known set: ${KNOWN_MCP_TOOLS.join(', ')}`
          );
        }
      });
    }
  });
});
