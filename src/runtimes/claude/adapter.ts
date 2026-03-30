import { join } from 'node:path';
import type { InstallFile, InstallScope, RuntimeAdapter, WorkflowId, SpecialistDefinition } from '../../core/types.js';
import { resolveRuntimeRoot } from '../../core/paths.js';
import {
  getAllWorkflows,
  getWorkflow,
  getWorkflowSummary,
} from '../../catalog/workflows/registry.js';
import {
  renderClaudeCommand,
  renderClaudeAgent,
  renderCommandsReadme,
  renderAgentsReadme,
  renderHelpCommand,
  renderClaudeSpecialist,
  renderClaudeSpecialistsReadme,
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

  resolveRootPath(scope: InstallScope, cwd: string): string {
    return resolveRuntimeRoot('claude', scope, cwd);
  }

  getPlaceholderFiles(): InstallFile[] {
    const workflows = getAllWorkflows();
    const files: InstallFile[] = [
      {
        relativePath: 'commands/gss/README.md',
        content: renderCommandsReadme(workflows),
      },
      {
        relativePath: 'commands/gss/gss-help.md',
        content: renderHelpCommand(workflows),
      },
      {
        relativePath: 'agents/gss-README.md',
        content: renderAgentsReadme(workflows),
      },
      {
        relativePath: 'settings.json',
        content: SETTINGS_CONTENT,
        merge: true,
      },
    ];

    // Add specialists README if specialists are available
    if (this.specialists.length > 0) {
      files.push({
        relativePath: 'agents/gss-specialists-README.md',
        content: renderClaudeSpecialistsReadme(this.specialists),
      });
    }

    return files;
  }

  getFilesForWorkflow(workflowId: WorkflowId): InstallFile[] {
    const workflow = getWorkflow(workflowId);

    return [
      {
        relativePath: `commands/gss/${workflowId}.md`,
        content: renderClaudeCommand(workflow),
      },
      {
        relativePath: `agents/gss-${workflowId}.md`,
        content: renderClaudeAgent(workflow),
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
    }));
  }

  /**
   * Get files for specialists filtered by workflow.
   */
  getSpecialistFilesForWorkflow(workflowId: WorkflowId): InstallFile[] {
    return this.specialists
      .filter(s => s.primaryWorkflowIds.includes(workflowId))
      .map(specialist => ({
        relativePath: `agents/gss-specialist-${specialist.id}.md`,
        content: renderClaudeSpecialist(specialist),
      }));
  }

  getSettingsMerge(): { path: string; content: Record<string, unknown> } | null {
    return {
      path: 'settings.json',
      content: {
        gss: {
          version: '0.1.0',
          installedAt: new Date().toISOString(),
          specialists: this.specialists.map(s => s.id),
        },
      },
    };
  }
}

/**
 * Settings content with GSS configuration.
 */
const SETTINGS_CONTENT = `{
  "gss": {
    "version": "0.1.0",
    "enabled": true
  }
}
`;
