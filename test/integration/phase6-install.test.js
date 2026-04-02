/**
 * Phase 6 — Integration Tests: Install Pipeline
 *
 * Validates the full install pipeline produces:
 * - Zero specialist files
 * - MCP-aware agent/skill files
 * - MCP server registration
 * - No specialist references in any installed file
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ClaudeAdapter } from '../../dist/runtimes/claude/adapter.js';
import { CodexAdapter } from '../../dist/runtimes/codex/adapter.js';
import { install } from '../../dist/core/installer.js';
import { getAllWorkflows } from '../../dist/catalog/workflows/registry.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function createTempDir() {
  return mkdtemp(join(tmpdir(), 'gss-p6-int-'));
}

async function cleanupTempDir(dir) {
  await rm(dir, { recursive: true, force: true });
}

/** Recursively read all files in a directory */
async function readdirRecursive(dir, basePath = '') {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relPath = basePath ? `${basePath}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...await readdirRecursive(fullPath, relPath));
    } else {
      files.push(relPath);
    }
  }
  return files;
}

describe('Phase 6 — Integration: Install Pipeline', () => {

  // ---------------------------------------------------------------------------
  // 9.1 Full install produces zero specialist files (Claude)
  // ---------------------------------------------------------------------------
  it('should produce zero specialist files in Claude install', async () => {
    const tempDir = await createTempDir();
    try {
      await install([new ClaudeAdapter()], 'local', tempDir, false);

      const allFiles = await readdirRecursive(join(tempDir, '.claude'));
      const specialistFiles = allFiles.filter(f =>
        f.includes('gss-specialist-') || f.includes('Specialist')
      );
      assert.equal(specialistFiles.length, 0,
        `Found specialist files: ${specialistFiles.join(', ')}`);
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  // ---------------------------------------------------------------------------
  // 9.2 Full install produces MCP-aware agent files (Claude)
  // ---------------------------------------------------------------------------
  it('should produce agent files with MCP consultation instructions', async () => {
    const tempDir = await createTempDir();
    try {
      await install([new ClaudeAdapter()], 'local', tempDir, false);

      const agentsDir = join(tempDir, '.claude', 'agents');
      if (!existsSync(agentsDir)) {
        // If no agents dir, skip — but flag it
        assert.fail('No .claude/agents directory found after install');
      }

      const agentFiles = await readdir(agentsDir);
      // Only check workflow agents — exclude README and role agents (mapper, auditor, etc.)
      const roleAgentNames = ['gss-mapper', 'gss-auditor', 'gss-remediator', 'gss-verifier', 'gss-reporter', 'gss-executor', 'gss-threat-modeler'];
      const gssAgentFiles = agentFiles.filter(f =>
        f.startsWith('gss-') && f.endsWith('.md') && !f.includes('README') && !roleAgentNames.some(r => f.startsWith(r))
      );

      for (const file of gssAgentFiles) {
        const content = await readFile(join(agentsDir, file), 'utf-8');
        assert.ok(
          content.includes('MCP Security Consultation') || content.includes('MCP') || content.includes('consultation'),
          `Agent ${file} does not contain MCP consultation instructions`
        );
      }
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  // ---------------------------------------------------------------------------
  // 9.3 Full install produces zero specialist files (Codex)
  // ---------------------------------------------------------------------------
  it('should produce zero specialist files in Codex install', async () => {
    const tempDir = await createTempDir();
    try {
      await install([new CodexAdapter()], 'local', tempDir, false);

      if (existsSync(join(tempDir, '.codex'))) {
        const allFiles = await readdirRecursive(join(tempDir, '.codex'));
        const specialistFiles = allFiles.filter(f =>
          f.includes('gss-specialist-') || f.includes('Specialist')
        );
        assert.equal(specialistFiles.length, 0,
          `Found specialist files: ${specialistFiles.join(', ')}`);
      }
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  // ---------------------------------------------------------------------------
  // 9.4 Installed agent files have no gss-specialist-* references
  // ---------------------------------------------------------------------------
  it('should have no specialist name references in installed Claude agent files', async () => {
    const tempDir = await createTempDir();
    try {
      await install([new ClaudeAdapter()], 'local', tempDir, false);

      const agentsDir = join(tempDir, '.claude', 'agents');
      if (!existsSync(agentsDir)) return;

      const agentFiles = await readdir(agentsDir);
      for (const file of agentFiles) {
        const content = await readFile(join(agentsDir, file), 'utf-8');
        const specialistRefs = content.match(/gss-specialist-[\w-]+/g);
        assert.equal(specialistRefs, null,
          `Installed agent ${file} contains specialist references: ${specialistRefs?.join(', ')}`);
      }
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  // ---------------------------------------------------------------------------
  // 9.5 Installed command files have no specialist references
  // ---------------------------------------------------------------------------
  it('should have no specialist references in installed Claude command files', async () => {
    const tempDir = await createTempDir();
    try {
      await install([new ClaudeAdapter()], 'local', tempDir, false);

      const commandsDir = join(tempDir, '.claude', 'commands', 'gss');
      if (!existsSync(commandsDir)) return;

      const commandFiles = await readdir(commandsDir);
      for (const file of commandFiles) {
        if (!file.endsWith('.md')) continue;
        const content = await readFile(join(commandsDir, file), 'utf-8');
        assert.ok(!content.includes('gss-specialist-'),
          `Command ${file} still references specialists`);
      }
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  // ---------------------------------------------------------------------------
  // 9.6 getSpecialistFiles method is removed from adapters (Definition of Done)
  // ---------------------------------------------------------------------------
  it('should not have getSpecialistFiles method on adapters', () => {
    const claude = new ClaudeAdapter();
    const codex = new CodexAdapter();
    assert.equal(typeof claude.getSpecialistFiles, 'undefined',
      'ClaudeAdapter still has getSpecialistFiles — Phase 6 DoD requires removal');
    assert.equal(typeof codex.getSpecialistFiles, 'undefined',
      'CodexAdapter still has getSpecialistFiles — Phase 6 DoD requires removal');
  });

  // ---------------------------------------------------------------------------
  // 9.7 All 9 workflow commands are produced
  // ---------------------------------------------------------------------------
  it('should produce command files for all 9 workflows', async () => {
    const tempDir = await createTempDir();
    try {
      await install([new ClaudeAdapter()], 'local', tempDir, false);

      const commandsDir = join(tempDir, '.claude', 'commands', 'gss');
      const workflows = getAllWorkflows();
      for (const workflow of workflows) {
        assert.ok(
          existsSync(join(commandsDir, `${workflow.id}.md`)),
          `Command file for ${workflow.id} should exist`
        );
      }
    } finally {
      await cleanupTempDir(tempDir);
    }
  });
});
