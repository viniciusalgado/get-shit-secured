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
      assert.equal(manifest.version, '0.1.0');
      assert.equal(manifest.scope, 'local');
      assert.ok(Array.isArray(manifest.runtimes));
      assert.ok(Array.isArray(manifest.workflows));
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

      const remediateAgent = join(tempDir, '.claude/agents/gss-remediate.md');
      const content = await readFile(remediateAgent, 'utf-8');

      assert.ok(content.includes('Guardrails'), 'Should include guardrails section');
      assert.ok(content.includes('preflight') || content.includes('approval'), 'Should include guardrail types');
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('should install specialist agents for Claude', async () => {
    const tempDir = await createTempDir();
    try {
      const adapters = [new ClaudeAdapter()];
      await install(adapters, 'local', tempDir, false);

      const agentsDir = join(tempDir, '.claude/agents');

      // Check that specialist files exist (not just workflow agents)
      // We should see gss-specialist-* files alongside gss-* workflow agents
      const agentFiles = await readdir(agentsDir);
      const specialistFiles = agentFiles.filter(f => f.startsWith('gss-specialist-'));

      assert.ok(specialistFiles.length > 0, 'Should install specialist agent files');

      // Check a specific specialist exists
      const passwordStorageSpecialist = join(agentsDir, 'gss-specialist-password-storage.md');
      assert.ok(existsSync(passwordStorageSpecialist), 'Password storage specialist should exist');

      // Verify specialist has proper structure
      const specialistContent = await readFile(passwordStorageSpecialist, 'utf-8');
      assert.ok(specialistContent.includes('## Description'), 'Should have description section');
      assert.ok(specialistContent.includes('## Activation Triggers'), 'Should have activation triggers');
      assert.ok(specialistContent.includes('cheatsheetseries.owasp.org'), 'Should link to OWASP cheat sheet');
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('should install specialist skills for Codex', async () => {
    const tempDir = await createTempDir();
    try {
      const adapters = [new CodexAdapter()];
      await install(adapters, 'local', tempDir, false);

      const skillsDir = join(tempDir, '.codex/skills');

      // Check that specialist directories exist
      const skillDirs = await readdir(skillsDir);
      const specialistDirs = skillDirs.filter(d => d.startsWith('gss-specialist-'));

      assert.ok(specialistDirs.length > 0, 'Should install specialist skill directories');

      // Check a specific specialist exists
      const sqlInjectionSpecialist = join(skillsDir, 'gss-specialist-sql-injection-prevention', 'SKILL.md');
      assert.ok(existsSync(sqlInjectionSpecialist), 'SQL injection prevention specialist should exist');

      // Verify specialist has proper structure
      const specialistContent = await readFile(sqlInjectionSpecialist, 'utf-8');
      assert.ok(specialistContent.includes('## Description'), 'Should have description section');
      assert.ok(specialistContent.includes('## Activation Triggers'), 'Should have activation triggers');
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('should include specialists in manifest', async () => {
    const tempDir = await createTempDir();
    try {
      const adapters = [new ClaudeAdapter()];
      await install(adapters, 'local', tempDir, false);

      const settingsFile = join(tempDir, '.claude/settings.json');
      const settingsContent = await readFile(settingsFile, 'utf-8');
      const settings = JSON.parse(settingsContent);

      // Settings should include list of installed specialists
      assert.ok(settings.gss, 'Should have GSS settings');
      assert.ok(Array.isArray(settings.gss.specialists), 'Should have specialists array');
      assert.ok(settings.gss.specialists.length > 0, 'Should have at least one specialist');
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('should install audit workflow specialists', async () => {
    const tempDir = await createTempDir();
    try {
      const adapters = [new ClaudeAdapter()];
      await install(adapters, 'local', tempDir, false);

      const agentsDir = join(tempDir, '.claude/agents');

      // Key audit specialists should be installed
      const auditSpecialists = [
        'gss-specialist-secure-code-review.md',
        'gss-specialist-input-validation.md',
        'gss-specialist-sql-injection-prevention.md',
        'gss-specialist-cross-site-scripting-prevention.md',
        'gss-specialist-authentication.md',
        'gss-specialist-authorization.md',
        'gss-specialist-password-storage.md',
      ];

      for (const specialist of auditSpecialists) {
        const specialistPath = join(agentsDir, specialist);
        assert.ok(existsSync(specialistPath), `Audit specialist ${specialist} should exist`);
      }
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('should verify specialist README is created', async () => {
    const tempDir = await createTempDir();
    try {
      const adapters = [new ClaudeAdapter()];
      await install(adapters, 'local', tempDir, false);

      const specialistsReadme = join(tempDir, '.claude/agents/gss-specialists-README.md');
      assert.ok(existsSync(specialistsReadme), 'Specialists README should exist');

      const content = await readFile(specialistsReadme, 'utf-8');
      assert.ok(content.includes('get-shit-secured Specialists'), 'Should have title');
      assert.ok(content.includes('gss-specialist-'), 'Should list specialist files');
      assert.ok(content.includes('Delegation'), 'Should mention delegation');
    } finally {
      await cleanupTempDir(tempDir);
    }
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
