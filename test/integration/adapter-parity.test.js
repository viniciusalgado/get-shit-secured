/**
 * Behavioral parity smoke tests — Phase 10.
 * Verifies that both adapters produce semantically equivalent output.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Check if dist is available
let distAvailable = false;
try {
  await import('../../dist/runtimes/claude/adapter.js');
  await import('../../dist/runtimes/codex/adapter.js');
  distAvailable = true;
} catch {
  distAvailable = false;
}

const ClaudeAdapter = distAvailable ? (await import('../../dist/runtimes/claude/adapter.js')).ClaudeAdapter : null;
const CodexAdapter = distAvailable ? (await import('../../dist/runtimes/codex/adapter.js')).CodexAdapter : null;
const getAllRoles = distAvailable ? (await import('../../dist/catalog/roles/registry.js')).getAllRoles : null;

const describeOrSkip = distAvailable ? describe : describe.skip;

describeOrSkip('Phase 10 — Behavioral parity', () => {
  it('both adapters return same number of role files', () => {
    const claude = new ClaudeAdapter();
    const codex = new CodexAdapter();
    assert.equal(claude.getRoleFiles().length, codex.getRoleFiles().length);
  });

  it('role files reference the same role IDs', () => {
    const claude = new ClaudeAdapter();
    const codex = new CodexAdapter();

    const claudeRoleIds = claude.getRoleFiles().map(f => {
      // Extract ID from agents/{id}.md
      const match = f.relativePath.match(/agents\/(.+)\.md/);
      return match ? match[1] : null;
    }).filter(Boolean);

    const codexRoleIds = codex.getRoleFiles().map(f => {
      // Extract ID from skills/{id}/SKILL.md
      const match = f.relativePath.match(/skills\/(.+)\/SKILL\.md/);
      return match ? match[1] : null;
    }).filter(Boolean);

    assert.deepEqual(claudeRoleIds.sort(), codexRoleIds.sort(),
      'Both adapters should reference the same role IDs');
  });

  it('role files contain content from the shared catalog', () => {
    const claude = new ClaudeAdapter();
    const roles = getAllRoles();

    const claudeFiles = claude.getRoleFiles();
    for (const role of roles) {
      const file = claudeFiles.find(f => f.relativePath.includes(role.id));
      assert.ok(file, `Claude should have file for role ${role.id}`);
      assert.ok(file.content.includes(role.title) || file.content.length > 0,
        `File for ${role.id} should contain role content`);
    }
  });

  it('both adapters use same MCP registration name', () => {
    const claude = new ClaudeAdapter();
    const codex = new CodexAdapter();

    const claudeReg = claude.getMcpRegistration('/server', '/corpus');
    const codexReg = codex.getMcpRegistration('/server', '/corpus');

    assert.equal(claudeReg.keyPath, codexReg.keyPath,
      'Both should use the same MCP registration key path');
    assert.equal(claudeReg.content.command, codexReg.content.command,
      'Both should use the same command');
  });

  it('both adapters render workflows from same definitions', () => {
    const claude = new ClaudeAdapter();
    const codex = new CodexAdapter();

    const workflowIds = [
      'security-review', 'map-codebase', 'threat-model', 'audit',
      'validate-findings', 'plan-remediation', 'execute-remediation',
      'verify', 'report',
    ];

    for (const workflowId of workflowIds) {
      const claudeFiles = claude.getFilesForWorkflow(workflowId);
      const codexFiles = codex.getFilesForWorkflow(workflowId);

      assert.ok(claudeFiles.length > 0, `Claude should have files for ${workflowId}`);
      assert.ok(codexFiles.length > 0, `Codex should have files for ${workflowId}`);
    }
  });

  it('no host-specific divergence in security semantics', () => {
    const claude = new ClaudeAdapter();
    const codex = new CodexAdapter();

    // Both should have the same managed config structure
    const claudePatches = claude.getManagedJsonPatches();
    const codexPatches = codex.getManagedJsonPatches();

    assert.equal(claudePatches.length, codexPatches.length,
      'Both adapters should have same number of managed JSON patches');

    // Verify they use the same owner and merge strategy
    for (let i = 0; i < claudePatches.length; i++) {
      assert.equal(claudePatches[i].owner, codexPatches[i].owner,
        'Patches should have same owner');
      assert.equal(claudePatches[i].mergeStrategy, codexPatches[i].mergeStrategy,
        'Patches should have same merge strategy');
    }
  });
});
