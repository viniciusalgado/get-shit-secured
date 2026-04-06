/**
 * Integration tests for installation.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

import { ClaudeAdapter } from '../../dist/runtimes/claude/adapter.js';
import { CodexAdapter } from '../../dist/runtimes/codex/adapter.js';
import { install, uninstall } from '../../dist/core/installer.js';
import { readManifest } from '../../dist/core/manifest.js';
import { getAllWorkflows } from '../../dist/catalog/workflows/registry.js';

async function createTempDir() {
  const dir = `${tmpdir()}/gss-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await mkdtemp(dir);
  return dir;
}

async function cleanupTempDir(dir) {
  await rm(dir, { recursive: true, force: true });
}

describe('install', () => {

  it('should install claude runtime locally', async () => {
    const tempDir = await createTempDir();
    try {
      const adapters = [new ClaudeAdapter()];
      const result = await install(adapters, 'local', tempDir, false);

      assert.ok(result.success);
      assert.ok(result.manifest);
      assert.equal(result.manifest.runtimes.length, 1);
      assert.equal(result.manifest.runtimes[0], 'claude');
      assert.ok(result.filesCreated > 0);

      // Check Claude directory exists
      const claudeDir = join(tempDir, '.claude');
      assert.ok(existsSync(claudeDir), 'Claude directory should exist');

      // Check commands directory exists
      const commandsDir = join(claudeDir, 'commands/gss');
      assert.ok(existsSync(commandsDir), 'Commands directory should exist');

      // Check agents directory exists
      const agentsDir = join(claudeDir, 'agents');
      assert.ok(existsSync(agentsDir), 'Agents directory should exist');

      // Check README files
      const commandsReadme = join(commandsDir, 'README.md');
      assert.ok(existsSync(commandsReadme), 'Commands README should exist');
      const readmeContent = await readFile(commandsReadme, 'utf-8');
      assert.ok(readmeContent.includes('get-shit-secured Commands'));
      assert.ok(readmeContent.includes('/gss-map-codebase'));

      // Check help command
      const helpCommand = join(commandsDir, 'gss-help.md');
      assert.ok(existsSync(helpCommand), 'Help command should exist');
      const helpContent = await readFile(helpCommand, 'utf-8');
      assert.ok(helpContent.includes('Quick Start'));
      assert.ok(helpContent.includes('OWASP'));

      // Check agents README
      const agentsReadme = join(agentsDir, 'gss-README.md');
      assert.ok(existsSync(agentsReadme), 'Agents README should exist');
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('should install codex runtime locally', async () => {
    const tempDir = await createTempDir();
    try {
      const adapters = [new CodexAdapter()];
      const result = await install(adapters, 'local', tempDir, false);

      assert.ok(result.success);
      assert.ok(result.manifest);
      assert.equal(result.manifest.runtimes.length, 1);
      assert.equal(result.manifest.runtimes[0], 'codex');
      assert.ok(result.filesCreated > 0);

      // Check Codex directory exists
      const codexDir = join(tempDir, '.codex');
      assert.ok(existsSync(codexDir), 'Codex directory should exist');

      // Check skills directory exists
      const skillsDir = join(codexDir, 'skills');
      assert.ok(existsSync(skillsDir), 'Skills directory should exist');

      // Check skills README
      const skillsReadme = join(skillsDir, 'gss-README.md');
      assert.ok(existsSync(skillsReadme), 'Skills README should exist');
      const readmeContent = await readFile(skillsReadme, 'utf-8');
      assert.ok(readmeContent.includes('get-shit-secured Skills'));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('should install both runtimes', async () => {
    const tempDir = await createTempDir();
    try {
      const adapters = [new ClaudeAdapter(), new CodexAdapter()];
      const result = await install(adapters, 'local', tempDir, false);

      assert.ok(result.success);
      assert.ok(result.manifest);
      assert.equal(result.manifest.runtimes.length, 2);
      assert.ok(result.manifest.runtimes.includes('claude'));
      assert.ok(result.manifest.runtimes.includes('codex'));

      // Check both directories exist
      assert.ok(existsSync(join(tempDir, '.claude')));
      assert.ok(existsSync(join(tempDir, '.codex')));

      const claudeMcp = JSON.parse(await readFile(join(tempDir, '.mcp.json'), 'utf-8'));
      assert.ok(claudeMcp.mcpServers?.['gss-security-docs']);

      const codexConfig = await readFile(join(tempDir, '.codex', 'config.toml'), 'utf-8');
      assert.ok(codexConfig.includes('[mcp_servers.gss-security-docs]'));
      assert.ok(!existsSync(join(tempDir, '.claude', 'config.toml')));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('should write install manifest', async () => {
    const tempDir = await createTempDir();
    try {
      const adapters = [new ClaudeAdapter()];
      await install(adapters, 'local', tempDir, false);

      const manifest = await readManifest(tempDir);
      assert.ok(manifest);
      // Support both v1 (version) and v2 (packageVersion) manifests
      const version = manifest.manifestVersion === 2 ? manifest.packageVersion : manifest.version;
      assert.equal(version, '0.1.0');
      assert.equal(manifest.scope, 'local');
      assert.ok(Array.isArray(manifest.runtimes));
      // Support both v1 (workflows) and v2 (workflowIds) manifests
      const workflows = manifest.manifestVersion === 2 ? manifest.workflowIds : manifest.workflows;
      assert.ok(Array.isArray(workflows));
      assert.ok(manifest.files);
      assert.ok(manifest.roots);
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('should generate all workflow files for Claude', async () => {
    const tempDir = await createTempDir();
    try {
      const adapters = [new ClaudeAdapter()];
      await install(adapters, 'local', tempDir, false);

      const workflows = getAllWorkflows();
      const commandsDir = join(tempDir, '.claude/commands/gss');
      const agentsDir = join(tempDir, '.claude/agents');

      for (const workflow of workflows) {
        // Check command file exists
        const commandFile = join(commandsDir, `${workflow.id}.md`);
        assert.ok(existsSync(commandFile), `Command file for ${workflow.id} should exist`);

        // Check agent file exists
        const agentFile = join(agentsDir, `gss-${workflow.id}.md`);
        assert.ok(existsSync(agentFile), `Agent file for ${workflow.id} should exist`);

        // Verify content has key elements
        const agentContent = await readFile(agentFile, 'utf-8');
        assert.ok(agentContent.includes('## OWASP'), 'Should include OWASP topics');
        assert.ok(agentContent.includes('## Inputs'), 'Should include inputs section');
        assert.ok(agentContent.includes('## Outputs'), 'Should include outputs section');
      }
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('should generate all workflow files for Codex', async () => {
    const tempDir = await createTempDir();
    try {
      const adapters = [new CodexAdapter()];
      await install(adapters, 'local', tempDir, false);

      const workflows = getAllWorkflows();
      const skillsDir = join(tempDir, '.codex/skills');

      for (const workflow of workflows) {
        // Check skill directory and file exist
        const skillFile = join(skillsDir, `gss-${workflow.id}`, 'SKILL.md');
        assert.ok(existsSync(skillFile), `Skill file for ${workflow.id} should exist`);

        // Verify content has key elements
        const skillContent = await readFile(skillFile, 'utf-8');
        assert.ok(skillContent.startsWith('---\n'), 'Skill should start with YAML frontmatter');
        assert.ok(skillContent.includes(`name: "gss-${workflow.id}"`), 'Skill should declare frontmatter name');
        assert.ok(skillContent.includes(`description: "${workflow.goal}"`), 'Skill should declare frontmatter description');
        assert.ok(skillContent.includes('\n---\n\n# '), 'Skill should end frontmatter before markdown body');
        assert.ok(
          skillContent.includes('## OWASP') || skillContent.includes('## Prerequisites'),
          'Should include OWASP or prerequisites'
        );
      }
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('should preserve existing settings.json', async () => {
    const tempDir = await createTempDir();
    try {
      // Create existing settings.json
      const claudeDir = join(tempDir, '.claude');
      const settingsFile = join(claudeDir, 'settings.json');
      await mkdir(claudeDir, { recursive: true });
      await writeFile(settingsFile, JSON.stringify({ existing: 'value' }), 'utf-8');

      const adapters = [new ClaudeAdapter()];
      await install(adapters, 'local', tempDir, false);

      // Settings should still exist and contain both original and GSS data
      assert.ok(existsSync(settingsFile));
      const settingsContent = await readFile(settingsFile, 'utf-8');
      const settings = JSON.parse(settingsContent);
      assert.equal(settings.existing, 'value');
      assert.ok(settings.gss);
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('should support reinstall without overwrite', async () => {
    const tempDir = await createTempDir();
    try {
      const adapters = [new ClaudeAdapter()];

      // First install
      const result1 = await install(adapters, 'local', tempDir, false);
      assert.ok(result1.success);

      // Second install should not overwrite existing files (installer skips existing files)
      // Note: The manifest file is updated on reinstall, so at least 1 file will be "created"
      const result2 = await install(adapters, 'local', tempDir, false);
      assert.ok(result2.success);
      // Should create far fewer files on reinstall (only manifest is updated)
      assert.ok(result2.filesCreated < result1.filesCreated);
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('should write settings merge data', async () => {
    const tempDir = await createTempDir();
    try {
      const adapters = [new ClaudeAdapter()];
      await install(adapters, 'local', tempDir, false);

      const settingsFile = join(tempDir, '.claude/settings.json');
      assert.ok(existsSync(settingsFile));

      const settingsContent = await readFile(settingsFile, 'utf-8');
      const settings = JSON.parse(settingsContent);
      assert.ok(settings.gss);
      assert.equal(settings.gss.version, '0.1.0');
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('should include OWASP content in generated files', async () => {
    const tempDir = await createTempDir();
    try {
      const adapters = [new ClaudeAdapter()];
      await install(adapters, 'local', tempDir, false);

      // Check a specific workflow file for OWASP content
      const threatModelAgent = join(tempDir, '.claude/agents/gss-threat-model.md');
      const content = await readFile(threatModelAgent, 'utf-8');

      assert.ok(content.includes('OWASP'), 'Should mention OWASP');
      assert.ok(content.includes('owasp.org'), 'Should include OWASP URLs');
      assert.ok(content.includes('Threat Modeling'), 'Should include Threat Modeling topic');
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('should include artifact paths in workflow outputs', async () => {
    const tempDir = await createTempDir();
    try {
      const adapters = [new ClaudeAdapter()];
      await install(adapters, 'local', tempDir, false);

      const mapCodebaseAgent = join(tempDir, '.claude/agents/gss-map-codebase.md');
      const content = await readFile(mapCodebaseAgent, 'utf-8');

      assert.ok(content.includes('.gss/artifacts/'), 'Should include artifact paths');
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('should show workflow dependencies in generated content', async () => {
    const tempDir = await createTempDir();
    try {
      const adapters = [new ClaudeAdapter()];
      await install(adapters, 'local', tempDir, false);

      const auditCommand = join(tempDir, '.claude/commands/gss/audit.md');
      const content = await readFile(auditCommand, 'utf-8');

      assert.ok(content.includes('Dependencies'), 'Should include dependencies section');
      assert.ok(content.includes('map-codebase'), 'Should reference map-codebase workflow');
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('should include guardrails in generated content', async () => {
    const tempDir = await createTempDir();
    try {
      const adapters = [new ClaudeAdapter()];
      await install(adapters, 'local', tempDir, false);

      const planRemediationAgent = join(tempDir, '.claude/agents/gss-plan-remediation.md');
      const content = await readFile(planRemediationAgent, 'utf-8');

      assert.ok(content.includes('Guardrails'), 'Should include guardrails section');
      assert.ok(content.includes('preflight') || content.includes('approval'), 'Should include guardrail types');
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('should include MCP consultation in workflow agents for Claude', async () => {
    const tempDir = await createTempDir();
    try {
      const adapters = [new ClaudeAdapter()];
      await install(adapters, 'local', tempDir, false);

      const agentsDir = join(tempDir, '.claude/agents');

      // Phase 5+: MCP consultation replaced specialist agent files.
      // Workflow agents should include MCP consultation sections.
      const auditAgent = join(agentsDir, 'gss-audit.md');
      assert.ok(existsSync(auditAgent), 'Audit agent should exist');

      const auditContent = await readFile(auditAgent, 'utf-8');
      assert.ok(auditContent.includes('MCP Security Consultation'), 'Should include MCP consultation section');
      assert.ok(auditContent.includes('get_workflow_consultation_plan'), 'Should reference consultation tool');
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('should include MCP consultation in workflow skills for Codex', async () => {
    const tempDir = await createTempDir();
    try {
      const adapters = [new CodexAdapter()];
      await install(adapters, 'local', tempDir, false);

      const skillsDir = join(tempDir, '.codex/skills');

      // Phase 5+: MCP consultation replaces specialist skill files.
      // Workflow skills should include MCP consultation sections.
      const auditSkill = join(skillsDir, 'gss-audit', 'SKILL.md');
      assert.ok(existsSync(auditSkill), 'Audit skill should exist');

      const auditContent = await readFile(auditSkill, 'utf-8');
      assert.ok(auditContent.includes('MCP Security Consultation'), 'Should include MCP consultation section');
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('should include GSS settings in manifest', async () => {
    const tempDir = await createTempDir();
    try {
      const adapters = [new ClaudeAdapter()];
      await install(adapters, 'local', tempDir, false);

      const settingsFile = join(tempDir, '.claude/settings.json');
      const settingsContent = await readFile(settingsFile, 'utf-8');
      const settings = JSON.parse(settingsContent);

      // Phase 5+: Settings include GSS config with MCP-based architecture
      assert.ok(settings.gss, 'Should have GSS settings');
      assert.ok(settings.gss.version, 'Should have version');
      assert.ok(settings.gss.enabled, 'Should be enabled');
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('should install role agents for security workflows', async () => {
    const tempDir = await createTempDir();
    try {
      const adapters = [new ClaudeAdapter()];
      await install(adapters, 'local', tempDir, false);

      const agentsDir = join(tempDir, '.claude/agents');

      // Phase 7: Role agents replace specialists for each workflow
      const roleAgents = [
        'gss-mapper.md',
        'gss-threat-modeler.md',
        'gss-auditor.md',
        'gss-remediator.md',
        'gss-verifier.md',
        'gss-reporter.md',
      ];

      for (const agent of roleAgents) {
        const agentPath = join(agentsDir, agent);
        assert.ok(existsSync(agentPath), `Role agent ${agent} should exist`);

        // Verify role agent has Phase 7 MCP-aware template sections
        const content = await readFile(agentPath, 'utf-8');
        assert.ok(content.includes('## Mission'), `${agent} should have mission section`);
        assert.ok(content.includes('## MCP Consultation Rules'), `${agent} should have MCP rules`);
      }
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('should verify agents README is created', async () => {
    const tempDir = await createTempDir();
    try {
      const adapters = [new ClaudeAdapter()];
      await install(adapters, 'local', tempDir, false);

      const agentsReadme = join(tempDir, '.claude/agents/gss-README.md');
      assert.ok(existsSync(agentsReadme), 'Agents README should exist');

      const content = await readFile(agentsReadme, 'utf-8');
      assert.ok(content.includes('get-shit-secured Agents'), 'Should have title');
      assert.ok(content.includes('gss-'), 'Should list agent files');
      assert.ok(content.includes('Workflow'), 'Should mention workflows');
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  describe('role agents', () => {
    it('should install role agent files for Claude', async () => {
      const tempDir = await createTempDir();
      try {
        const adapters = [new ClaudeAdapter()];
        await install(adapters, 'local', tempDir, false);

        const roleAgents = ['gss-mapper', 'gss-threat-modeler', 'gss-auditor', 'gss-remediator', 'gss-verifier', 'gss-reporter'];
        const agentsDir = join(tempDir, '.claude/agents');

        for (const agentId of roleAgents) {
          const agentFile = join(agentsDir, `${agentId}.md`);
          assert.ok(existsSync(agentFile), `Role agent ${agentId} should exist`);

          // Verify content has key elements (Phase 7 MCP-aware role template)
          const agentContent = await readFile(agentFile, 'utf-8');
          assert.ok(agentContent.includes('# '), 'Should have title heading');
          assert.ok(agentContent.includes('## Mission'), 'Should have mission section');
          assert.ok(agentContent.includes('**Access Level:**'), 'Should have access level info');
        }
      } finally {
        await cleanupTempDir(tempDir);
      }
    });

    it('should install role skill files for Codex', async () => {
      const tempDir = await createTempDir();
      try {
        const adapters = [new CodexAdapter()];
        await install(adapters, 'local', tempDir, false);

        const roleSkills = ['gss-mapper', 'gss-threat-modeler', 'gss-auditor', 'gss-remediator', 'gss-verifier', 'gss-reporter'];
        const skillsDir = join(tempDir, '.codex/skills');

        for (const skillId of roleSkills) {
          const skillFile = join(skillsDir, skillId, 'SKILL.md');
          assert.ok(existsSync(skillFile), `Role skill ${skillId} should exist`);

          // Verify content has key elements (Phase 7 MCP-aware role template)
          const skillContent = await readFile(skillFile, 'utf-8');
          assert.ok(skillContent.includes('# '), 'Should have title heading');
          assert.ok(skillContent.includes('## Mission'), 'Should have mission section');
          assert.ok(skillContent.includes('## Completion Criteria'), 'Should have completion criteria');
        }
      } finally {
        await cleanupTempDir(tempDir);
      }
    });
  });
});

describe('uninstall', () => {
  it('should uninstall installed files', async () => {
    const tempDir = await createTempDir();
    try {
      // First install
      const adapters = [new ClaudeAdapter()];
      await install(adapters, 'local', tempDir, false);

      // Verify files exist
      assert.ok(existsSync(join(tempDir, '.claude')));
      assert.ok(existsSync(join(tempDir, '.gss')));

      // Now uninstall
      const result = await uninstall(tempDir, false);
      assert.ok(result.success);
      assert.ok(result.filesCreated > 0);

      // Verify directories are removed
      assert.ok(!existsSync(join(tempDir, '.claude/commands/gss/README.md')));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('should return error when no manifest exists', async () => {
    const tempDir = await createTempDir();
    try {
      const result = await uninstall(tempDir, false);
      assert.ok(!result.success);
      assert.ok(result.errors.length > 0);
      assert.ok(result.errors[0].includes('No install manifest'));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });
});
