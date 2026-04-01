import type {
  InstallFile,
  InstallScope,
  RuntimeAdapter,
  WorkflowId,
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
  renderCodexSkill,
  renderSkillsReadme,
  renderCodexRoleSkill,
} from '../../core/renderer.js';

/**
 * Codex runtime adapter.
 * Generates Codex-compatible skills from workflow definitions.
 */
export class CodexAdapter implements RuntimeAdapter {
  readonly runtime = 'codex' as const;

  /**
   * Get adapter capabilities.
   */
  getCapabilities(): RuntimeAdapterCapabilities {
    return {
      supportsHooks: false, // Codex doesn't support hooks yet
      supportsSubagents: true,
      supportsManagedConfig: true,
      supportsRoleAgents: true,
      hasConfigFormat: true,
    };
  }

  resolveRootPath(scope: InstallScope, cwd: string): string {
    return resolveRuntimeRoot('codex', scope, cwd);
  }

  resolveSupportSubtree(scope: InstallScope, cwd: string): string {
    return resolveSupportSubtree('codex', scope, cwd);
  }

  getPlaceholderFiles(): RuntimeFile[] {
    const workflows = getAllWorkflows();
    const files: RuntimeFile[] = [
      {
        relativePath: 'skills/gss-README.md',
        content: renderSkillsReadme(workflows),
        category: 'entrypoint',
        overwritePolicy: 'create-only',
      },
    ];

    return files;
  }

  getFilesForWorkflow(workflowId: WorkflowId): RuntimeFile[] {
    const workflow = getWorkflow(workflowId);

    return [
      {
        relativePath: `skills/gss-${workflowId}/SKILL.md`,
        content: renderCodexSkill(workflow),
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
   * Get managed JSON config patches for Codex.
   * This is now real config support, not a placeholder.
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
          specialists: [],
        },
        mergeStrategy: 'deep',
        keyPath: 'gss',
      },
    ];
  }

  /**
   * Get MCP server registration for Codex settings.
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
   * Get hook definitions.
   * Codex doesn't support hooks yet, so return empty.
   */
  getHooks(): RuntimeHook[] {
    return [];
  }

  /**
   * Get role skill files for Codex.
   */
  getRoleSkillFiles(): RuntimeFile[] {
    const roleSkills: Array<{id: string; title: string; description: string}> = [
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

    return roleSkills.map(skill => ({
      relativePath: `skills/${skill.id}/SKILL.md`,
      content: renderCodexRoleSkill(skill),
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

This directory contains internal GSS support files for the Codex runtime.

## Structure

- \`runtime-manifest.json\` - Runtime-specific installation metadata

## DO NOT MODIFY

Files in this directory are managed by GSS. Modifications may be overwritten during updates.
`;
