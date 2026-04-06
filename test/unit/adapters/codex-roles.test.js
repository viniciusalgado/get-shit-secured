/**
 * Unit tests for Codex adapter role file rendering — Phase 10.
 * Validates Codex-specific role file detail: paths, content structure,
 * catalog consistency, absence of specialist remnants, and Codex-specific
 * capability assertions.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Check if dist is available
let distAvailable = false;
try {
  await import('../../../dist/runtimes/codex/adapter.js');
  distAvailable = true;
} catch {
  distAvailable = false;
}

const CodexAdapter = distAvailable ? (await import('../../../dist/runtimes/codex/adapter.js')).CodexAdapter : null;
const getAllRoles = distAvailable ? (await import('../../../dist/catalog/roles/registry.js')).getAllRoles : null;

const describeOrSkip = distAvailable ? describe : describe.skip;

describeOrSkip('Codex adapter — Role file rendering', () => {
  it('each role file has skills/{roleId}/SKILL.md path pattern', () => {
    const adapter = new CodexAdapter();
    const roles = getAllRoles();
    const files = adapter.getRoleFiles();

    for (const role of roles) {
      const expectedPath = `skills/${role.id}/SKILL.md`;
      const file = files.find(f => f.relativePath === expectedPath);
      assert.ok(file, `Should have file at ${expectedPath}`);
    }
  });

  it('each role file has category: entrypoint', () => {
    const adapter = new CodexAdapter();
    const files = adapter.getRoleFiles();

    for (const file of files) {
      assert.equal(file.category, 'entrypoint', `${file.relativePath} should be entrypoint`);
    }
  });

  it('each role file has overwritePolicy: replace-managed', () => {
    const adapter = new CodexAdapter();
    const files = adapter.getRoleFiles();

    for (const file of files) {
      assert.equal(file.overwritePolicy, 'replace-managed', `${file.relativePath} should be replace-managed`);
    }
  });

  it('each role file content includes the role title', () => {
    const adapter = new CodexAdapter();
    const roles = getAllRoles();
    const files = adapter.getRoleFiles();

    for (const role of roles) {
      const file = files.find(f => f.relativePath.includes(role.id));
      assert.ok(file, `Should find file for role ${role.id}`);
      assert.ok(file.content.includes(role.title),
        `File for ${role.id} should include title "${role.title}"`);
    }
  });

  it('each role file content includes YAML frontmatter', () => {
    const adapter = new CodexAdapter();
    const roles = getAllRoles();
    const files = adapter.getRoleFiles();

    for (const role of roles) {
      const file = files.find(f => f.relativePath.includes(role.id));
      assert.ok(file, `Should find file for role ${role.id}`);
      assert.ok(file.content.startsWith('---\n'),
        `${file.relativePath} should start with YAML frontmatter`);
      assert.ok(file.content.includes(`name: "${role.id}"`),
        `${file.relativePath} should include skill name frontmatter`);
      assert.ok(file.content.includes(`description: "${role.description}"`),
        `${file.relativePath} should include skill description frontmatter`);
      assert.ok(file.content.includes('\n---\n\n# '),
        `${file.relativePath} should terminate frontmatter before the markdown body`);
    }
  });

  it('each role file content references the primary workflow', () => {
    const adapter = new CodexAdapter();
    const roles = getAllRoles();
    const files = adapter.getRoleFiles();

    for (const role of roles) {
      const file = files.find(f => f.relativePath.includes(role.id));
      assert.ok(file, `Should find file for role ${role.id}`);
      // The rendered content should reference the primary workflow
      assert.ok(file.content.includes(role.primaryWorkflow),
        `File for ${role.id} should reference primary workflow "${role.primaryWorkflow}"`);
    }
  });

  it('role file content is non-empty string', () => {
    const adapter = new CodexAdapter();
    const files = adapter.getRoleFiles();

    for (const file of files) {
      assert.equal(typeof file.content, 'string', `${file.relativePath} content should be string`);
      assert.ok(file.content.length > 0, `${file.relativePath} content should not be empty`);
    }
  });

  it('getRoleFiles() and deprecated getRoleSkillFiles() return identical arrays', () => {
    const adapter = new CodexAdapter();
    const newFiles = adapter.getRoleFiles();
    const oldFiles = adapter.getRoleSkillFiles();

    assert.equal(newFiles.length, oldFiles.length, 'Same number of files');

    for (let i = 0; i < newFiles.length; i++) {
      assert.equal(newFiles[i].relativePath, oldFiles[i].relativePath,
        `Path match at index ${i}`);
      assert.equal(newFiles[i].content, oldFiles[i].content,
        `Content match at index ${i}`);
    }
  });

  it('no role file references specialist generation', () => {
    const adapter = new CodexAdapter();
    const files = adapter.getRoleFiles();

    for (const file of files) {
      assert.ok(!file.content.includes('gss-specialist-'),
        `${file.relativePath} should not reference gss-specialist-`);
      assert.ok(!file.content.includes('renderCodexSpecialist'),
        `${file.relativePath} should not reference renderCodexSpecialist`);
    }
  });

  it('Codex MCP registration uses correct key path', () => {
    const adapter = new CodexAdapter();
    const reg = adapter.getMcpRegistration('/server', '/corpus');
    assert.equal(reg.keyPath, 'mcpServers.gss-security-docs');
  });

  it('Codex MCP registration uses node command', () => {
    const adapter = new CodexAdapter();
    const reg = adapter.getMcpRegistration('/server', '/corpus');
    assert.equal(reg.content.command, 'node');
  });

  it('Codex MCP registration passes corpus path in args', () => {
    const adapter = new CodexAdapter();
    const reg = adapter.getMcpRegistration('/path/to/server.js', '/path/to/corpus.json');
    assert.ok(reg.content.args.includes('--corpus-path'),
      'Args should include --corpus-path');
    assert.ok(reg.content.args.includes('/path/to/corpus.json'),
      'Args should include the corpus path');
  });

  it('Codex getHooks() returns empty array', () => {
    const adapter = new CodexAdapter();
    assert.equal(adapter.getHooks().length, 0, 'Codex should have 0 hooks');
  });

  it('Codex getCapabilities() returns supportsHooks: false', () => {
    const adapter = new CodexAdapter();
    const caps = adapter.getCapabilities();
    assert.equal(caps.supportsHooks, false, 'Codex should not support hooks');
  });
});
