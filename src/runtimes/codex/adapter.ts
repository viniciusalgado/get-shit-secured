import type { InstallFile, InstallScope, RuntimeAdapter, WorkflowId } from '../../core/types.js';
import { resolveRuntimeRoot } from '../../core/paths.js';

/**
 * Codex runtime adapter.
 * Generates Codex-compatible skills.
 */
export class CodexAdapter implements RuntimeAdapter {
  readonly runtime = 'codex' as const;

  resolveRootPath(scope: InstallScope, cwd: string): string {
    return resolveRuntimeRoot('codex', scope, cwd);
  }

  getPlaceholderFiles(): InstallFile[] {
    return [
      {
        relativePath: 'skills/gss-README.md',
        content: PLACEHOLDER_SKILLS_README,
      },
    ];
  }

  getFilesForWorkflow(workflowId: WorkflowId): InstallFile[] {
    switch (workflowId) {
      case 'map-codebase':
        return this.getMapCodebaseFiles();
      case 'threat-model':
        return this.getThreatModelFiles();
      case 'audit':
        return this.getAuditFiles();
      case 'verify':
        return this.getVerifyFiles();
      case 'remediate':
        return this.getRemediateFiles();
      case 'report':
        return this.getReportFiles();
      default:
        return [];
    }
  }

  getSettingsMerge(): { path: string; content: Record<string, unknown> } | null {
    // Codex settings format is TBD - placeholder
    return null;
  }

  private getMapCodebaseFiles(): InstallFile[] {
    return [
      {
        relativePath: 'skills/gss-map-codebase/SKILL.md',
        content: MAP_CODEBASE_SKILL,
      },
    ];
  }

  private getThreatModelFiles(): InstallFile[] {
    return [
      {
        relativePath: 'skills/gss-threat-model/SKILL.md',
        content: THREAT_MODEL_SKILL,
      },
    ];
  }

  private getAuditFiles(): InstallFile[] {
    return [
      {
        relativePath: 'skills/gss-audit/SKILL.md',
        content: AUDIT_SKILL,
      },
    ];
  }

  private getVerifyFiles(): InstallFile[] {
    return [
      {
        relativePath: 'skills/gss-verify/SKILL.md',
        content: VERIFY_SKILL,
      },
    ];
  }

  private getRemediateFiles(): InstallFile[] {
    return [
      {
        relativePath: 'skills/gss-remediate/SKILL.md',
        content: REMEDIATE_SKILL,
      },
    ];
  }

  private getReportFiles(): InstallFile[] {
    return [
      {
        relativePath: 'skills/gss-report/SKILL.md',
        content: REPORT_SKILL,
      },
    ];
  }
}

// =============================================================================
// Placeholder skill templates
// =============================================================================

const PLACEHOLDER_SKILLS_README = `# get-shit-secured Skills for Codex

This directory contains security workflow skills for Codex.

## Available Skills

- \`gss-map-codebase\` - Map codebase for security analysis
- \`gss-threat-model\` - Generate threat models
- \`gss-audit\` - Run security audit
- \`gss-verify\` - Verify security fixes
- \`gss-remediate\` - Remediate security issues
- \`gss-report\` - Generate security report

These are placeholder skills. Full implementation coming soon.
`;

// Codex SKILL.md template format (placeholder - actual format TBD)
const createSkillTemplate = (name: string, description: string) => `# ${name}

${description}

## Skill: ${name}

**This is a placeholder skill.** Full implementation coming soon.

### Description
${description}

### Usage
\`\`\`
gss ${name.toLowerCase().replace(' ', '-')}
\`\`\`

### Implementation
Security analysis coming soon.
`;

const MAP_CODEBASE_SKILL = createSkillTemplate(
  'GSS Map Codebase',
  'Analyze and map codebase structure for security context.'
);

const THREAT_MODEL_SKILL = createSkillTemplate(
  'GSS Threat Model',
  'Generate threat models using STRIDE methodology.'
);

const AUDIT_SKILL = createSkillTemplate(
  'GSS Audit',
  'Run comprehensive security audit against the codebase.'
);

const VERIFY_SKILL = createSkillTemplate(
  'GSS Verify',
  'Verify that security fixes are properly implemented.'
);

const REMEDIATE_SKILL = createSkillTemplate(
  'GSS Remediate',
  'Apply security remediations for identified vulnerabilities.'
);

const REPORT_SKILL = createSkillTemplate(
  'GSS Report',
  'Generate comprehensive security posture report.'
);
