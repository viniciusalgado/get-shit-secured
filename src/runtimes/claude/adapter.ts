import { join } from 'node:path';
import type {
  InstallFile,
  InstallScope,
  RuntimeAdapter,
  WorkflowId,
  SpecialistDefinition,
  RuntimeFile,
  ManagedJsonPatch,
  ManagedTextBlock,
  RuntimeHook,
  RuntimeAdapterCapabilities,
} from '../../core/types.js';
import {
  resolveRuntimeRoot,
  resolveSupportSubtree,
} from '../../core/paths.js';
import {
  getAllWorkflows,
  getWorkflow,
} from '../../catalog/workflows/registry.js';
import {
  renderClaudeCommand,
  renderClaudeAgent,
  renderCommandsReadme,
  renderAgentsReadme,
  renderHelpCommand,
  renderClaudeSpecialist,
  renderClaudeSpecialistsReadme,
  renderRoleAgent,
} from '../../core/renderer.js';

/**
 * Claude runtime adapter.
 * Generates Claude Code compatible commands and agents from workflow definitions.
 */
export class ClaudeAdapter implements RuntimeAdapter {
  readonly runtime = 'claude' as const;
  private specialists: SpecialistDefinition[] = [];

  /**
   * Set specialists to be installed.
   */
  setSpecialists(specialists: SpecialistDefinition[]): void {
    this.specialists = specialists;
  }

  /**
   * Get adapter capabilities.
   */
  getCapabilities(): RuntimeAdapterCapabilities {
    return {
      supportsHooks: true,
      supportsSubagents: true,
      supportsManagedConfig: true,
      supportsRoleAgents: true,
      hasConfigFormat: true,
    };
  }

  resolveRootPath(scope: InstallScope, cwd: string): string {
    return resolveRuntimeRoot('claude', scope, cwd);
  }

  resolveSupportSubtree(scope: InstallScope, cwd: string): string {
    return resolveSupportSubtree('claude', scope, cwd);
  }

  getPlaceholderFiles(): RuntimeFile[] {
    const workflows = getAllWorkflows();
    const files: RuntimeFile[] = [
      {
        relativePath: 'commands/gss/README.md',
        content: renderCommandsReadme(workflows),
        category: 'entrypoint',
        overwritePolicy: 'create-only',
      },
      {
        relativePath: 'commands/gss/gss-help.md',
        content: renderHelpCommand(workflows),
        category: 'entrypoint',
        overwritePolicy: 'replace-managed',
      },
      {
        relativePath: 'agents/gss-README.md',
        content: renderAgentsReadme(workflows),
        category: 'entrypoint',
        overwritePolicy: 'create-only',
      },
    ];

    // Add specialists README if specialists are available
    if (this.specialists.length > 0) {
      files.push({
        relativePath: 'agents/gss-specialists-README.md',
        content: renderClaudeSpecialistsReadme(this.specialists),
        category: 'entrypoint',
        overwritePolicy: 'replace-managed',
      });
    }

    return files;
  }

  getFilesForWorkflow(workflowId: WorkflowId): RuntimeFile[] {
    const workflow = getWorkflow(workflowId);

    return [
      {
        relativePath: `commands/gss/${workflowId}.md`,
        content: renderClaudeCommand(workflow),
        category: 'entrypoint',
        overwritePolicy: 'replace-managed',
      },
      {
        relativePath: `agents/gss-${workflowId}.md`,
        content: renderClaudeAgent(workflow),
        category: 'entrypoint',
        overwritePolicy: 'replace-managed',
      },
    ];
  }

  /**
   * Get support files for the runtime.
   */
  getSupportFiles(): RuntimeFile[] {
    return [
      {
        relativePath: 'README.md',
        content: SUPPORT_README,
        category: 'support',
        overwritePolicy: 'replace-managed',
      },
    ];
  }

  /**
   * Get managed JSON config patches.
   */
  getManagedJsonPatches(): ManagedJsonPatch[] {
    return [
      {
        path: 'settings.json',
        owner: 'gss',
        content: {
          version: '0.1.0',
          enabled: true,
          installedAt: new Date().toISOString(),
          specialists: this.specialists.map(s => s.id),
        },
        mergeStrategy: 'deep',
        keyPath: 'gss',
      },
    ];
  }

  /**
   * Get MCP server registration for Claude settings.json.
   *
   * @param serverPath - Absolute path to the compiled MCP server entrypoint
   * @param corpusPath - Absolute path to the corpus snapshot
   */
  getMcpRegistration(serverPath: string, corpusPath: string): ManagedJsonPatch {
    return {
      path: 'settings.json',
      owner: 'gss',
      content: {
        command: 'node',
        args: [serverPath, '--corpus-path', corpusPath],
      },
      mergeStrategy: 'deep',
      keyPath: 'mcpServers.gss-security-docs',
    };
  }

  /**
   * Get managed text blocks.
   */
  getManagedTextBlocks(): ManagedTextBlock[] {
    return [];
  }

  /**
   * Get hook definitions for Claude.
   */
  getHooks(): RuntimeHook[] {
    return [
      {
        id: 'session-start',
        event: 'SessionStart',
        command: `
  // Check if required directories exist
  const { existsSync } = require('fs');
  const gssDirs = ['.gss/artifacts', '.gss/reports'];
  for (const dir of gssDirs) {
    if (!existsSync(dir)) {
      console.warn('[GSS] Missing directory: ' + dir);
    }
  }

  // Check if install is stale
  const manifestPath = '.gss/install-manifest.json';
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(require('fs').readFileSync(manifestPath, 'utf-8'));
    const installed = new Date(manifest.installedAt || manifest.packageUpdatedAt);
    const daysSinceInstall = (Date.now() - installed.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceInstall > 30) {
      console.warn('[GSS] Installation may be stale. Consider re-running installer.');
    }
  }
        `,
        blocking: false,
        description: 'Environment sanity check on session start',
      },
      {
        id: 'pre-tool-write',
        event: 'PreToolUse',
        matcher: '{"name": "write"}',
        command: `
  // Check if write target is sensitive
  const sensitive = ['.env', '.pem', '.key', 'secrets/', 'credentials/'];
  const path = context.toolInput?.path || '';
  if (sensitive.some(s => path.includes(s))) {
    console.warn('[GSS] Attempting to write to potentially sensitive file: ' + path);
  }
        `,
        blocking: false,
        description: 'Warn on writes to sensitive files',
      },
      {
        id: 'pre-tool-edit',
        event: 'PreToolUse',
        matcher: '{"name": "Edit"}',
        command: `
  // Check if edit target is in .gss/artifacts
  const path = context.toolInput?.file_path || '';
  if (path.includes('.gss/artifacts/')) {
    console.warn('[GSS] Editing artifact file: ' + path);
  }
        `,
        blocking: false,
        description: 'Warn on edits to artifact files',
      },
      {
        id: 'post-tool-write',
        event: 'PostToolUse',
        matcher: '{"name": "write"}',
        command: `
  // Validate expected artifact shape after workflow writes
  const path = context.toolInput?.path || '';
  if (path.includes('.gss/artifacts/')) {
    console.log('[GSS] Artifact written: ' + path);
  }
        `,
        blocking: false,
        description: 'Log artifact writes for validation',
      },
    ];
  }

  /**
   * Get files for all specialists.
   */
  getSpecialistFiles(): InstallFile[] {
    return this.specialists.map(specialist => ({
      relativePath: `agents/gss-specialist-${specialist.id}.md`,
      content: renderClaudeSpecialist(specialist),
      merge: false,
    }));
  }

  /**
   * Get role agent files.
   */
  getRoleAgentFiles(): RuntimeFile[] {
    const roleAgents: Array<{id: string; title: string; description: string}> = [
      {
        id: 'gss-mapper',
        title: 'Codebase Mapper',
        description: 'Analyzes codebase structure, dependencies, and security-relevant patterns',
      },
      {
        id: 'gss-threat-modeler',
        title: 'Threat Modeler',
        description: 'Generates threat models and identifies security risks',
      },
      {
        id: 'gss-auditor',
        title: 'Security Auditor',
        description: 'Performs security audits based on OWASP standards',
      },
      {
        id: 'gss-remediator',
        title: 'Security Remediator',
        description: 'Plans and applies security fixes with minimal safe changes',
      },
      {
        id: 'gss-verifier',
        title: 'Security Verifier',
        description: 'Verifies security fixes and runs validation checks',
      },
      {
        id: 'gss-reporter',
        title: 'Security Reporter',
        description: 'Generates comprehensive security reports',
      },
    ];

    return roleAgents.map(agent => ({
      relativePath: `agents/${agent.id}.md`,
      content: renderRoleAgent(agent),
      category: 'entrypoint',
      overwritePolicy: 'replace-managed',
    }));
  }

  getSettingsMerge(): { path: string; content: Record<string, unknown> } | null {
    // Deprecated - use getManagedJsonPatches() instead
    return null;
  }
}

/**
 * Support subtree README content.
 */
const SUPPORT_README = `# get-shit-secured Support

This directory contains internal GSS support files for the Claude runtime.

## Structure

- \`hooks/\` - Runtime hook scripts for session lifecycle events
- \`runtime-manifest.json\` - Runtime-specific installation metadata

## Hooks

Hooks are JavaScript modules that run at specific points during Claude Code operation:

- **session-start.js**: Runs when a Claude session starts
- **pre-tool-*.js**: Runs before a tool is used
- **post-tool-*.js**: Runs after a tool is used

See individual hook files for implementation details.

## DO NOT MODIFY

Files in this directory are managed by GSS. Modifications may be overwritten during updates.
`;
