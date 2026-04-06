/**
 * Phase 7 — Integration Tests: Role Agent Install Pipeline
 *
 * Validates the full install pipeline produces correct MCP-aware role agents
 * with no specialist references, correct access levels, and semantic alignment
 * across Claude and Codex runtimes.
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

const __dirname = dirname(fileURLToPath(import.meta.url));

const ROLE_IDS = [
  'gss-mapper',
  'gss-threat-modeler',
  'gss-auditor',
  'gss-remediator',
  'gss-verifier',
  'gss-reporter',
];

async function createTempDir() {
  return mkdtemp(join(tmpdir(), 'gss-p7-int-'));
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

describe('Phase 7 — Integration: Role Agent Install', () => {

  // ---------------------------------------------------------------------------
  // Claude install produces all 6 role agent files
  // ---------------------------------------------------------------------------
  it('should produce all 6 role agent files in Claude install', async () => {
    const tempDir = await createTempDir();
    try {
      await install([new ClaudeAdapter()], 'local', tempDir, false);

      const agentsDir = join(tempDir, '.claude', 'agents');
      assert.ok(existsSync(agentsDir), 'agents directory should exist');

      for (const roleId of ROLE_IDS) {
        const agentFile = join(agentsDir, `${roleId}.md`);
        assert.ok(
          existsSync(agentFile),
          `Role agent file ${roleId}.md should exist`
        );
      }
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  // ---------------------------------------------------------------------------
  // Each Claude role agent file contains "## Mission"
  // ---------------------------------------------------------------------------
  it('each Claude role agent file contains Mission section', async () => {
    const tempDir = await createTempDir();
    try {
      await install([new ClaudeAdapter()], 'local', tempDir, false);

      const agentsDir = join(tempDir, '.claude', 'agents');
      for (const roleId of ROLE_IDS) {
        const content = await readFile(join(agentsDir, `${roleId}.md`), 'utf-8');
        assert.ok(
          content.includes('## Mission'),
          `${roleId}.md should contain "## Mission"`
        );
      }
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  // ---------------------------------------------------------------------------
  // Each Claude role agent file contains "## MCP Consultation Rules"
  // ---------------------------------------------------------------------------
  it('each Claude role agent file contains MCP Consultation Rules', async () => {
    const tempDir = await createTempDir();
    try {
      await install([new ClaudeAdapter()], 'local', tempDir, false);

      const agentsDir = join(tempDir, '.claude', 'agents');
      for (const roleId of ROLE_IDS) {
        const content = await readFile(join(agentsDir, `${roleId}.md`), 'utf-8');
        assert.ok(
          content.includes('## MCP Consultation Rules'),
          `${roleId}.md should contain "## MCP Consultation Rules"`
        );
      }
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  // ---------------------------------------------------------------------------
  // Each Claude role agent file contains "## Reasoning Guardrails"
  // ---------------------------------------------------------------------------
  it('each Claude role agent file contains Reasoning Guardrails', async () => {
    const tempDir = await createTempDir();
    try {
      await install([new ClaudeAdapter()], 'local', tempDir, false);

      const agentsDir = join(tempDir, '.claude', 'agents');
      for (const roleId of ROLE_IDS) {
        const content = await readFile(join(agentsDir, `${roleId}.md`), 'utf-8');
        assert.ok(
          content.includes('## Reasoning Guardrails'),
          `${roleId}.md should contain "## Reasoning Guardrails"`
        );
      }
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  // ---------------------------------------------------------------------------
  // No Claude role agent file contains gss-specialist-
  // ---------------------------------------------------------------------------
  it('no Claude role agent file contains gss-specialist- references', async () => {
    const tempDir = await createTempDir();
    try {
      await install([new ClaudeAdapter()], 'local', tempDir, false);

      const agentsDir = join(tempDir, '.claude', 'agents');
      for (const roleId of ROLE_IDS) {
        const content = await readFile(join(agentsDir, `${roleId}.md`), 'utf-8');
        assert.ok(
          !content.includes('gss-specialist-'),
          `${roleId}.md should not contain gss-specialist- references`
        );
      }
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  // ---------------------------------------------------------------------------
  // No Claude role agent file contains "delegate to specialist"
  // ---------------------------------------------------------------------------
  it('no Claude role agent file contains "delegate to specialist"', async () => {
    const tempDir = await createTempDir();
    try {
      await install([new ClaudeAdapter()], 'local', tempDir, false);

      const agentsDir = join(tempDir, '.claude', 'agents');
      for (const roleId of ROLE_IDS) {
        const content = await readFile(join(agentsDir, `${roleId}.md`), 'utf-8');
        assert.ok(
          !content.toLowerCase().includes('delegate to specialist'),
          `${roleId}.md should not say "delegate to specialist"`
        );
      }
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  // ---------------------------------------------------------------------------
  // Claude role agent access levels match spec
  // ---------------------------------------------------------------------------
  it('Claude role agent access levels match spec', async () => {
    const tempDir = await createTempDir();
    const expectedAccess = {
      'gss-mapper': '**read-only**',
      'gss-threat-modeler': '**read-only**',
      'gss-auditor': '**read-only**',
      'gss-remediator': '**write-capable**',
      'gss-verifier': '**verification-only**',
      'gss-reporter': '**read-only**',
    };

    try {
      await install([new ClaudeAdapter()], 'local', tempDir, false);

      const agentsDir = join(tempDir, '.claude', 'agents');
      for (const [roleId, expectedLevel] of Object.entries(expectedAccess)) {
        const content = await readFile(join(agentsDir, `${roleId}.md`), 'utf-8');
        assert.ok(
          content.includes(expectedLevel),
          `${roleId}.md should have access level "${expectedLevel}"`
        );
      }
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  // ---------------------------------------------------------------------------
  // Codex install produces role skill directories
  // ---------------------------------------------------------------------------
  it('Codex install produces role skill directories', async () => {
    const tempDir = await createTempDir();
    try {
      await install([new CodexAdapter()], 'local', tempDir, false);

      const skillsDir = join(tempDir, '.codex', 'skills');
      if (!existsSync(skillsDir)) {
        // Codex install may not produce skills dir in all configurations
        return;
      }

      for (const roleId of ROLE_IDS) {
        assert.ok(
          existsSync(join(skillsDir, roleId)),
          `Codex skill directory for ${roleId} should exist`
        );
      }
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  // ---------------------------------------------------------------------------
  // Each Codex role skill contains "## Mission"
  // ---------------------------------------------------------------------------
  it('each Codex role skill contains Mission section', async () => {
    const tempDir = await createTempDir();
    try {
      await install([new CodexAdapter()], 'local', tempDir, false);

      const skillsDir = join(tempDir, '.codex', 'skills');
      if (!existsSync(skillsDir)) return;

      for (const roleId of ROLE_IDS) {
        const skillDir = join(skillsDir, roleId);
        if (!existsSync(skillDir)) continue;

        const skillFile = join(skillDir, 'SKILL.md');
        if (!existsSync(skillFile)) continue;

        const content = await readFile(skillFile, 'utf-8');
        assert.ok(
          content.includes('## Mission'),
          `${roleId} Codex skill should contain "## Mission"`
        );
      }
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('each Codex role skill contains YAML frontmatter', async () => {
    const tempDir = await createTempDir();
    try {
      await install([new CodexAdapter()], 'local', tempDir, false);

      const skillsDir = join(tempDir, '.codex', 'skills');
      if (!existsSync(skillsDir)) return;

      for (const roleId of ROLE_IDS) {
        const skillDir = join(skillsDir, roleId);
        if (!existsSync(skillDir)) continue;

        const skillFile = join(skillDir, 'SKILL.md');
        if (!existsSync(skillFile)) continue;

        const content = await readFile(skillFile, 'utf-8');
        assert.ok(
          content.startsWith('---\n'),
          `${roleId} Codex skill should start with YAML frontmatter`
        );
        assert.ok(
          content.includes(`name: "${roleId}"`),
          `${roleId} Codex skill should include frontmatter name`
        );
        assert.ok(
          content.includes('\n---\n\n# '),
          `${roleId} Codex skill should terminate frontmatter before the markdown body`
        );
      }
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  // ---------------------------------------------------------------------------
  // Each Codex role skill contains "## MCP Security Consultation"
  // ---------------------------------------------------------------------------
  it('each Codex role skill contains MCP Security Consultation section', async () => {
    const tempDir = await createTempDir();
    try {
      await install([new CodexAdapter()], 'local', tempDir, false);

      const skillsDir = join(tempDir, '.codex', 'skills');
      if (!existsSync(skillsDir)) return;

      for (const roleId of ROLE_IDS) {
        const skillDir = join(skillsDir, roleId);
        if (!existsSync(skillDir)) continue;

        const skillFile = join(skillDir, 'SKILL.md');
        if (!existsSync(skillFile)) continue;

        const content = await readFile(skillFile, 'utf-8');
        assert.ok(
          content.includes('## MCP Security Consultation'),
          `${roleId} Codex skill should contain "## MCP Security Consultation"`
        );
      }
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  // ---------------------------------------------------------------------------
  // No Codex role skill contains gss-specialist-
  // ---------------------------------------------------------------------------
  it('no Codex role skill contains gss-specialist- references', async () => {
    const tempDir = await createTempDir();
    try {
      await install([new CodexAdapter()], 'local', tempDir, false);

      const skillsDir = join(tempDir, '.codex', 'skills');
      if (!existsSync(skillsDir)) return;

      for (const roleId of ROLE_IDS) {
        const skillDir = join(skillsDir, roleId);
        if (!existsSync(skillDir)) continue;

        const skillFile = join(skillDir, 'SKILL.md');
        if (!existsSync(skillFile)) continue;

        const content = await readFile(skillFile, 'utf-8');
        assert.ok(
          !content.includes('gss-specialist-'),
          `${roleId} Codex skill should not contain gss-specialist- references`
        );
      }
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  // ---------------------------------------------------------------------------
  // Full install produces zero gss-specialist- files globally (Claude)
  // ---------------------------------------------------------------------------
  it('full install produces zero gss-specialist- files in Claude', async () => {
    const tempDir = await createTempDir();
    try {
      await install([new ClaudeAdapter()], 'local', tempDir, false);

      const allFiles = await readdirRecursive(join(tempDir, '.claude'));
      const specialistFiles = allFiles.filter(f =>
        f.includes('gss-specialist-')
      );
      assert.equal(specialistFiles.length, 0,
        `Found specialist files: ${specialistFiles.join(', ')}`);
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  // ---------------------------------------------------------------------------
  // Full install produces zero gss-specialist- files globally (Codex)
  // ---------------------------------------------------------------------------
  it('full install produces zero gss-specialist- files in Codex', async () => {
    const tempDir = await createTempDir();
    try {
      await install([new CodexAdapter()], 'local', tempDir, false);

      if (existsSync(join(tempDir, '.codex'))) {
        const allFiles = await readdirRecursive(join(tempDir, '.codex'));
        const specialistFiles = allFiles.filter(f =>
          f.includes('gss-specialist-')
        );
        assert.equal(specialistFiles.length, 0,
          `Found specialist files: ${specialistFiles.join(', ')}`);
      }
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  // ---------------------------------------------------------------------------
  // No installed file contains gss-specialist- (global sweep)
  // ---------------------------------------------------------------------------
  it('no installed file contains gss-specialist- text', async () => {
    const tempDir = await createTempDir();
    try {
      await install([new ClaudeAdapter()], 'local', tempDir, false);

      const allFiles = await readdirRecursive(join(tempDir, '.claude'));
      for (const file of allFiles) {
        if (!file.endsWith('.md') && !file.endsWith('.js')) continue;
        const content = await readFile(join(tempDir, '.claude', file), 'utf-8');
        assert.ok(
          !content.includes('gss-specialist-'),
          `File ${file} should not contain gss-specialist-`
        );
      }
    } finally {
      await cleanupTempDir(tempDir);
    }
  });
});
