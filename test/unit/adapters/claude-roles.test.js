/**
 * Unit tests for Claude adapter role file rendering — Phase 10.
 * Validates Claude-specific role file detail: paths, content structure,
 * catalog consistency, and absence of specialist remnants.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Check if dist is available
let distAvailable = false;
try {
  await import('../../../dist/runtimes/claude/adapter.js');
  distAvailable = true;
} catch {
  distAvailable = false;
}

const ClaudeAdapter = distAvailable ? (await import('../../../dist/runtimes/claude/adapter.js')).ClaudeAdapter : null;
const getAllRoles = distAvailable ? (await import('../../../dist/catalog/roles/registry.js')).getAllRoles : null;

const describeOrSkip = distAvailable ? describe : describe.skip;

describeOrSkip('Claude adapter — Role file rendering', () => {
  it('each role file has agents/{roleId}.md path pattern', () => {
    const adapter = new ClaudeAdapter();
    const roles = getAllRoles();
    const files = adapter.getRoleFiles();

    for (const role of roles) {
      const file = files.find(f => f.relativePath === `agents/${role.id}.md`);
      assert.ok(file, `Should have file at agents/${role.id}.md`);
    }
  });

  it('each role file has category: entrypoint', () => {
    const adapter = new ClaudeAdapter();
    const files = adapter.getRoleFiles();

    for (const file of files) {
      assert.equal(file.category, 'entrypoint', `${file.relativePath} should be entrypoint`);
    }
  });

  it('each role file has overwritePolicy: replace-managed', () => {
    const adapter = new ClaudeAdapter();
    const files = adapter.getRoleFiles();

    for (const file of files) {
      assert.equal(file.overwritePolicy, 'replace-managed', `${file.relativePath} should be replace-managed`);
    }
  });

  it('each role file content includes the role title', () => {
    const adapter = new ClaudeAdapter();
    const roles = getAllRoles();
    const files = adapter.getRoleFiles();

    for (const role of roles) {
      const file = files.find(f => f.relativePath.includes(role.id));
      assert.ok(file, `Should find file for role ${role.id}`);
      assert.ok(file.content.includes(role.title),
        `File for ${role.id} should include title "${role.title}"`);
    }
  });

  it('each role file content references the primary workflow', () => {
    const adapter = new ClaudeAdapter();
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
    const adapter = new ClaudeAdapter();
    const files = adapter.getRoleFiles();

    for (const file of files) {
      assert.equal(typeof file.content, 'string', `${file.relativePath} content should be string`);
      assert.ok(file.content.length > 0, `${file.relativePath} content should not be empty`);
    }
  });

  it('getRoleFiles() and deprecated getRoleAgentFiles() return identical arrays', () => {
    const adapter = new ClaudeAdapter();
    const newFiles = adapter.getRoleFiles();
    const oldFiles = adapter.getRoleAgentFiles();

    assert.equal(newFiles.length, oldFiles.length, 'Same number of files');

    for (let i = 0; i < newFiles.length; i++) {
      assert.equal(newFiles[i].relativePath, oldFiles[i].relativePath,
        `Path match at index ${i}`);
      assert.equal(newFiles[i].content, oldFiles[i].content,
        `Content match at index ${i}`);
    }
  });

  it('no role file references specialist generation', () => {
    const adapter = new ClaudeAdapter();
    const files = adapter.getRoleFiles();

    for (const file of files) {
      assert.ok(!file.content.includes('gss-specialist-'),
        `${file.relativePath} should not reference gss-specialist-`);
      assert.ok(!file.content.includes('renderClaudeSpecialist'),
        `${file.relativePath} should not reference renderClaudeSpecialist`);
    }
  });

  it('Claude MCP registration uses correct key path', () => {
    const adapter = new ClaudeAdapter();
    const reg = adapter.getMcpRegistration('/server', '/corpus');
    assert.equal(reg.keyPath, 'mcpServers.gss-security-docs');
  });

  it('Claude MCP registration uses node command', () => {
    const adapter = new ClaudeAdapter();
    const reg = adapter.getMcpRegistration('/server', '/corpus');
    assert.equal(reg.content.command, 'node');
  });

  it('Claude MCP registration passes corpus path in args', () => {
    const adapter = new ClaudeAdapter();
    const reg = adapter.getMcpRegistration('/path/to/server.js', '/path/to/corpus.json');
    assert.ok(reg.content.args.includes('--corpus-path'),
      'Args should include --corpus-path');
    assert.ok(reg.content.args.includes('/path/to/corpus.json'),
      'Args should include the corpus path');
  });
});
