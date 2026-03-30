import type { InstallFile, InstallScope, RuntimeAdapter, WorkflowId, SpecialistDefinition } from '../../core/types.js';
import { resolveRuntimeRoot } from '../../core/paths.js';
import {
  getAllWorkflows,
  getWorkflow,
} from '../../catalog/workflows/registry.js';
import {
  renderCodexSkill,
  renderSkillsReadme,
  renderCodexSpecialist,
  renderCodexSpecialistsReadme,
} from '../../core/renderer.js';

/**
 * Codex runtime adapter.
 * Generates Codex-compatible skills from workflow definitions.
 */
export class CodexAdapter implements RuntimeAdapter {
  readonly runtime = 'codex' as const;
  private specialists: SpecialistDefinition[] = [];

  /**
   * Set specialists to be installed.
   */
  setSpecialists(specialists: SpecialistDefinition[]): void {
    this.specialists = specialists;
  }

  resolveRootPath(scope: InstallScope, cwd: string): string {
    return resolveRuntimeRoot('codex', scope, cwd);
  }

  getPlaceholderFiles(): InstallFile[] {
    const workflows = getAllWorkflows();
    const files: InstallFile[] = [
      {
        relativePath: 'skills/gss-README.md',
        content: renderSkillsReadme(workflows),
      },
    ];

    // Add specialists README if specialists are available
    if (this.specialists.length > 0) {
      files.push({
        relativePath: 'skills/gss-specialists-README.md',
        content: renderCodexSpecialistsReadme(this.specialists),
      });
    }

    return files;
  }

  getFilesForWorkflow(workflowId: WorkflowId): InstallFile[] {
    const workflow = getWorkflow(workflowId);

    return [
      {
        relativePath: `skills/gss-${workflowId}/SKILL.md`,
        content: renderCodexSkill(workflow),
      },
    ];
  }

  /**
   * Get files for all specialists.
   */
  getSpecialistFiles(): InstallFile[] {
    return this.specialists.map(specialist => ({
      relativePath: `skills/gss-specialist-${specialist.id}/SKILL.md`,
      content: renderCodexSpecialist(specialist),
    }));
  }

  /**
   * Get files for specialists filtered by workflow.
   */
  getSpecialistFilesForWorkflow(workflowId: WorkflowId): InstallFile[] {
    return this.specialists
      .filter(s => s.primaryWorkflowIds.includes(workflowId))
      .map(specialist => ({
        relativePath: `skills/gss-specialist-${specialist.id}/SKILL.md`,
        content: renderCodexSpecialist(specialist),
      }));
  }

  getSettingsMerge(): { path: string; content: Record<string, unknown> } | null {
    // Codex settings format is TBD - placeholder
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
