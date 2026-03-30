import { join } from 'node:path';
import type { InstallFile, InstallScope, RuntimeAdapter, WorkflowId } from '../../core/types.js';
import { resolveRuntimeRoot } from '../../core/paths.js';

/**
 * Claude runtime adapter.
 * Generates Claude Code compatible commands and agents.
 */
export class ClaudeAdapter implements RuntimeAdapter {
  readonly runtime = 'claude' as const;

  resolveRootPath(scope: InstallScope, cwd: string): string {
    return resolveRuntimeRoot('claude', scope, cwd);
  }

  getPlaceholderFiles(): InstallFile[] {
    return [
      {
        relativePath: 'commands/gss/README.md',
        content: PLACEHOLDER_COMMANDS_README,
      },
      {
        relativePath: 'commands/gss/gss-help.md',
        content: PLACEHOLDER_HELP_COMMAND,
      },
      {
        relativePath: 'agents/gss-README.md',
        content: PLACEHOLDER_AGENTS_README,
      },
      {
        relativePath: 'settings.json',
        content: PLACEHOLDER_SETTINGS,
        merge: true,
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
    return {
      path: 'settings.json',
      content: {
        gss: {
          version: '0.1.0',
          installedAt: new Date().toISOString(),
        },
      },
    };
  }

  private getMapCodebaseFiles(): InstallFile[] {
    return [
      {
        relativePath: 'commands/gss/map-codebase.md',
        content: MAP_CODEBASE_COMMAND,
      },
      {
        relativePath: 'agents/gss-map-codebase.md',
        content: MAP_CODEBASE_AGENT,
      },
    ];
  }

  private getThreatModelFiles(): InstallFile[] {
    return [
      {
        relativePath: 'commands/gss/threat-model.md',
        content: THREAT_MODEL_COMMAND,
      },
      {
        relativePath: 'agents/gss-threat-model.md',
        content: THREAT_MODEL_AGENT,
      },
    ];
  }

  private getAuditFiles(): InstallFile[] {
    return [
      {
        relativePath: 'commands/gss/audit.md',
        content: AUDIT_COMMAND,
      },
      {
        relativePath: 'agents/gss-audit.md',
        content: AUDIT_AGENT,
      },
    ];
  }

  private getVerifyFiles(): InstallFile[] {
    return [
      {
        relativePath: 'commands/gss/verify.md',
        content: VERIFY_COMMAND,
      },
      {
        relativePath: 'agents/gss-verify.md',
        content: VERIFY_AGENT,
      },
    ];
  }

  private getRemediateFiles(): InstallFile[] {
    return [
      {
        relativePath: 'commands/gss/remediate.md',
        content: REMEDIATE_COMMAND,
      },
      {
        relativePath: 'agents/gss-remediate.md',
        content: REMEDIATE_AGENT,
      },
    ];
  }

  private getReportFiles(): InstallFile[] {
    return [
      {
        relativePath: 'commands/gss/report.md',
        content: REPORT_COMMAND,
      },
      {
        relativePath: 'agents/gss-report.md',
        content: REPORT_AGENT,
      },
    ];
  }
}

// =============================================================================
// Placeholder templates
// =============================================================================

const PLACEHOLDER_COMMANDS_README = `# get-shit-secured Commands

This directory contains security workflow slash commands for Claude Code.

## Available Commands

- \`/gss-help\` - Show available GSS commands
- \`/gss-map-codebase\` - Map codebase for security analysis
- \`/gss-threat-model\` - Generate threat models
- \`/gss-audit\` - Run security audit
- \`/gss-verify\` - Verify security fixes
- \`/gss-remediate\` - Remediate security issues
- \`/gss-report\` - Generate security report

These are placeholder commands. Full implementation coming soon.
`;

const PLACEHOLDER_HELP_COMMAND = `---
description: Show available get-shit-secured commands
---

# get-shit-secured Commands

The following security workflow commands are available:

| Command | Description |
|---------|-------------|
| \`/gss-map-codebase\` | Analyze and map codebase structure for security context |
| \`/gss-threat-model\` | Generate threat models for identified components |
| \`/gss-audit\` | Run comprehensive security audit |
| \`/gss-verify\` | Verify that security fixes are properly implemented |
| \`/gss-remediate\` | Apply security remediations |
| \`/gss-report\` | Generate security posture report |

This is a placeholder. Full security workflows coming soon.
`;

const PLACEHOLDER_AGENTS_README = `# get-shit-secured Agents

This directory contains security-focused agents for Claude Code.

## Available Agents

- \`gss-map-codebase\` - Codebase mapping and analysis
- \`gss-threat-model\` - Threat modeling agent
- \`gss-audit\` - Security audit agent
- \`gss-verify\` - Verification agent
- \`gss-remediate\` - Remediation agent
- \`gss-report\` - Reporting agent

These are placeholder agents. Full implementation coming soon.
`;

const PLACEHOLDER_SETTINGS = `{
  "gss": {
    "version": "0.1.0",
    "enabled": true
  }
}
`;

const MAP_CODEBASE_COMMAND = `---
description: Map codebase for security analysis
---

# Map Codebase for Security Analysis

Analyze the codebase to identify components, data flows, and security boundaries.

**This is a placeholder command.** Full implementation coming soon.
`;

const MAP_CODEBASE_AGENT = `# GSS Map Codebase Agent

**Placeholder agent for codebase security mapping.**

This agent will analyze the codebase structure to identify:
- Application components and modules
- Data flow between components
- Authentication and authorization boundaries
- External dependencies and their security implications
- API endpoints and their access controls

Coming soon.
`;

const THREAT_MODEL_COMMAND = `---
description: Generate threat models
---

# Threat Modeling

Generate threat models for identified components using STRIDE methodology.

**This is a placeholder command.** Full implementation coming soon.
`;

const THREAT_MODEL_AGENT = `# GSS Threat Model Agent

**Placeholder agent for threat modeling.**

This agent will generate threat models covering:
- Spoofing threats
- Tampering threats
- Repudiation threats
- Information disclosure threats
- Denial of service threats
- Elevation of privilege threats

Coming soon.
`;

const AUDIT_COMMAND = `---
description: Run security audit
---

# Security Audit

Run a comprehensive security audit against the codebase.

**This is a placeholder command.** Full implementation coming soon.
`;

const AUDIT_AGENT = `# GSS Audit Agent

**Placeholder agent for security auditing.**

This agent will perform:
- OWASP Top 10 vulnerability checks
- Dependency vulnerability scanning
- Configuration security review
- Secrets detection
- Authentication/authorization testing

Coming soon.
`;

const VERIFY_COMMAND = `---
description: Verify security fixes
---

# Verify Security Fixes

Verify that security remediations are properly implemented.

**This is a placeholder command.** Full implementation coming soon.
`;

const VERIFY_AGENT = `# GSS Verify Agent

**Placeholder agent for verification.**

This agent will:
- Confirm security fixes are in place
- Validate that no regressions were introduced
- Check test coverage for security fixes
- Verify configuration changes

Coming soon.
`;

const REMEDIATE_COMMAND = `---
description: Remediate security issues
---

# Remediate Security Issues

Apply security remediations for identified vulnerabilities.

**This is a placeholder command.** Full implementation coming soon.
`;

const REMEDIATE_AGENT = `# GSS Remediate Agent

**Placeholder agent for remediation.**

This agent will:
- Generate security patches
- Update configurations securely
- Add missing security controls
- Refactor unsafe code patterns

Coming soon.
`;

const REPORT_COMMAND = `---
description: Generate security report
---

# Security Report

Generate a comprehensive security posture report.

**This is a placeholder command.** Full implementation coming soon.
`;

const REPORT_AGENT = `# GSS Report Agent

**Placeholder agent for reporting.**

This agent will generate reports covering:
- Overall security posture
- Identified vulnerabilities by severity
- Compliance status (OWASP ASVS, etc.)
- Remediation progress
- Recommendations

Coming soon.
`;
