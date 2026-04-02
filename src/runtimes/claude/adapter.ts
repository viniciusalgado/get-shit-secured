import { join } from 'node:path';
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
  renderClaudeCommand,
  renderClaudeAgent,
  renderCommandsReadme,
  renderAgentsReadme,
  renderHelpCommand,
  renderRoleAgent,
} from '../../core/renderer.js';
import {
  getAllRoles,
} from '../../catalog/roles/registry.js';
import {
  ARTIFACT_VALIDATION_RULES,
} from '../../hooks/artifact-validator.js';

/**
 * Claude runtime adapter.
 * Generates Claude Code compatible commands and agents from workflow definitions.
 */
export class ClaudeAdapter implements RuntimeAdapter {
  readonly runtime = 'claude' as const;

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
   * Includes README and the artifact-validator module used by the post-write hook.
   */
  getSupportFiles(): RuntimeFile[] {
    return [
      {
        relativePath: 'README.md',
        content: SUPPORT_README,
        category: 'support',
        overwritePolicy: 'replace-managed',
      },
      {
        relativePath: 'hooks/artifact-validator.js',
        content: generateArtifactValidatorModule(),
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
          specialists: [],
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
   *
   * Phase 8: All hooks retargeted to be MCP/corpus-aware with:
   * - Session-start: Full runtime health checks (manifest, corpus, MCP, versions)
   * - Pre-write: Sensitive path warnings + workflow-mode-aware policies
   * - Pre-edit: Artifact edit warnings + scope-aware verify/edit checks
   * - Post-write: Structural artifact validation + consultation trace checks
   */
  getHooks(): RuntimeHook[] {
    return [
      {
        id: 'session-start',
        event: 'SessionStart',
        command: SESSION_START_HOOK,
        blocking: false,
        description: 'Verify runtime health: manifest, corpus, MCP, versions, artifact dirs',
      },
      {
        id: 'pre-tool-write',
        event: 'PreToolUse',
        matcher: '{"name": "write"}',
        command: PRE_TOOL_WRITE_HOOK,
        blocking: false,
        description: 'Warn on writes to sensitive files and code writes in review-only workflows',
      },
      {
        id: 'pre-tool-edit',
        event: 'PreToolUse',
        matcher: '{"name": "Edit"}',
        command: PRE_TOOL_EDIT_HOOK,
        blocking: false,
        description: 'Warn on artifact edits and scope-external edits in verify mode',
      },
      {
        id: 'post-tool-write',
        event: 'PostToolUse',
        matcher: '{"name": "write"}',
        command: POST_TOOL_WRITE_HOOK,
        blocking: false,
        description: 'Validate artifact structure, consultation traces, and coverage status',
      },
    ];
  }

  /**
   * Get role agent files using the shared role catalog.
   */
  getRoleFiles(): RuntimeFile[] {
    return getAllRoles().map(role => ({
      relativePath: `agents/${role.id}.md`,
      content: renderRoleAgent(role),
      category: 'entrypoint' as const,
      overwritePolicy: 'replace-managed' as const,
    }));
  }

  /**
   * @deprecated Use getRoleFiles() instead.
   * Kept for backward compatibility during transition.
   */
  getRoleAgentFiles(): RuntimeFile[] {
    return this.getRoleFiles();
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
- \`hooks/artifact-validator.js\` - Artifact structural validation module (used by post-write hook)
- \`runtime-manifest.json\` - Runtime-specific installation metadata
- \`corpus/\` - Packaged OWASP corpus snapshot

## Hooks

Hooks are JavaScript modules that run at specific points during Claude Code operation:

- **session-start.js**: Runs when a Claude session starts. Checks runtime manifest, corpus, MCP config, and artifact directories.
- **pre-tool-write.js**: Runs before a Write tool use. Warns on sensitive file writes and code writes during review-only workflows.
- **pre-tool-edit.js**: Runs before an Edit tool use. Warns on artifact edits and scope-external edits during verification.
- **post-tool-write.js**: Runs after a Write tool use. Validates artifact JSON structure, consultation traces, and coverage status.

## DO NOT MODIFY

Files in this directory are managed by GSS. Modifications may be overwritten during updates.
`;

// =============================================================================
// Phase 8 — Hook Command Strings
// =============================================================================

/**
 * Session-start hook command.
 *
 * Performs ordered health checks:
 * 1. Runtime manifest exists and is valid
 * 2. Corpus snapshot exists and is valid JSON
 * 3. MCP server binary exists
 * 4. MCP config registered in settings.json
 * 5. Version consistency between manifests
 * 6. Artifact directories exist
 * 7. Install staleness check
 * 8. Cleanup stale active-workflow.json
 * 9. Emit one-line diagnostic summary
 */
const SESSION_START_HOOK = `
const { existsSync, readFileSync, unlinkSync } = require('fs');
const { join } = require('path');

try {
  const cwd = context.cwd || process.cwd();
  const gssDir = join(cwd, '.gss');
  const artifactsDir = join(gssDir, 'artifacts');
  const reportsDir = join(gssDir, 'reports');

  // Locate support subtree — check standard Claude paths
  const supportCandidates = [
    join(cwd, '.claude', 'gss'),
    join(process.env.HOME || '', '.claude', 'gss'),
  ];
  let supportSubtree = null;
  for (const candidate of supportCandidates) {
    if (existsSync(candidate)) {
      supportSubtree = candidate;
      break;
    }
  }

  // 8. Cleanup stale active-workflow.json
  const activeWfPath = join(artifactsDir, 'active-workflow.json');
  if (existsSync(activeWfPath)) {
    console.warn('[GSS WARN] Workflow: Stale active-workflow.json found. Previous workflow may have been interrupted.');
    try { unlinkSync(activeWfPath); } catch {}
  }

  // If no support subtree found, fall back to basic checks only
  if (!supportSubtree) {
    // Basic directory checks (legacy behavior)
    const gssDirs = [artifactsDir, reportsDir];
    for (const dir of gssDirs) {
      if (!existsSync(dir)) {
        console.warn('[GSS WARN] Install: Missing directory ' + dir);
      }
    }
    console.log('[GSS] GSS session started (basic mode — support subtree not found)');
    return;
  }

  // 1. Runtime manifest exists
  const manifestPath = join(supportSubtree, 'runtime-manifest.json');
  if (!existsSync(manifestPath)) {
    console.error('[GSS ERROR] Install: Runtime manifest not found at ' + manifestPath);
    console.error('             Re-run: npx get-shit-secured --claude --local');
    return;
  }

  let runtimeManifest;
  try {
    runtimeManifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  } catch (e) {
    console.error('[GSS ERROR] Install: Runtime manifest is corrupt at ' + manifestPath);
    console.error('             Re-run: npx get-shit-secured --claude --local');
    return;
  }

  let mcpReady = false;
  let corpusReady = false;
  let docCount = 0;

  // 2. Corpus snapshot exists and is valid JSON
  const corpusPath = runtimeManifest.corpusPath;
  if (corpusPath && existsSync(corpusPath)) {
    try {
      const corpusData = JSON.parse(readFileSync(corpusPath, 'utf-8'));
      corpusReady = true;
      docCount = corpusData.stats?.totalDocs || (corpusData.documents?.length) || 0;
    } catch (e) {
      console.error('[GSS ERROR] Corpus: Snapshot is corrupt at ' + corpusPath);
      console.error('             Re-run: npx get-shit-secured --claude --local');
    }
  } else if (corpusPath) {
    console.warn('[GSS WARN] Corpus: Snapshot not found at ' + corpusPath);
    console.warn('           MCP consultation will be unavailable.');
  }

  // 3. MCP server binary exists
  const mcpServerPath = runtimeManifest.mcpServerPath;
  const serverBinaryPresent = mcpServerPath && existsSync(mcpServerPath);
  if (mcpServerPath && !serverBinaryPresent) {
    console.warn('[GSS WARN] MCP: Server binary not found at ' + mcpServerPath);
  }

  // 4. MCP config registered
  const mcpConfigPath = runtimeManifest.mcpConfigPath;
  let mcpRegistered = false;
  if (mcpConfigPath && existsSync(mcpConfigPath)) {
    try {
      const settings = JSON.parse(readFileSync(mcpConfigPath, 'utf-8'));
      mcpRegistered = !!(settings.mcpServers && settings.mcpServers['gss-security-docs']);
    } catch {}
  }
  if (!mcpRegistered) {
    console.warn('[GSS WARN] MCP: Server not registered in Claude config.');
    console.warn('           Run: npx get-shit-secured --claude --local');
  }
  mcpReady = serverBinaryPresent && mcpRegistered;

  // 5. Version consistency
  const installManifestPath = join(gssDir, 'install-manifest.json');
  if (existsSync(installManifestPath)) {
    try {
      const installManifest = JSON.parse(readFileSync(installManifestPath, 'utf-8'));
      const installCorpusVersion = installManifest.corpusVersion;
      const runtimeCorpusVersion = runtimeManifest.corpusVersion;
      if (installCorpusVersion && runtimeCorpusVersion && installCorpusVersion !== runtimeCorpusVersion) {
        console.warn('[GSS WARN] Install: Corpus version mismatch between manifests.');
        console.warn('           Runtime: ' + runtimeCorpusVersion + ', Install: ' + installCorpusVersion);
        console.warn('           Re-run: npx get-shit-secured --claude --local');
      }
    } catch {}
  }

  // 6. Artifact directories
  if (!existsSync(artifactsDir)) {
    console.warn('[GSS WARN] Install: Missing directory ' + artifactsDir);
  }
  if (!existsSync(reportsDir)) {
    console.warn('[GSS WARN] Install: Missing directory ' + reportsDir);
  }

  // 7. Install staleness
  if (runtimeManifest.installedAt) {
    const installed = new Date(runtimeManifest.installedAt);
    const daysSinceInstall = (Date.now() - installed.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceInstall > 30) {
      console.warn('[GSS WARN] Install: Installation is ' + Math.floor(daysSinceInstall) + ' days old. Consider re-running installer.');
    }
  }

  // 9. One-line diagnostic summary
  const gssVersion = runtimeManifest.gssVersion || 'unknown';
  const corpusVersion = runtimeManifest.corpusVersion || 'unknown';
  const workflowCount = (runtimeManifest.installedWorkflows || []).length;
  const roleCount = (runtimeManifest.installedRoles || []).length;
  const mcpName = runtimeManifest.mcpServerName || 'gss-security-docs';
  const legacyMode = runtimeManifest.legacyMode || false;
  if (mcpReady && corpusReady) {
    console.log('[GSS] v' + gssVersion + ' | corpus v' + corpusVersion + ' | ' + docCount + ' docs | MCP ready | ' + workflowCount + ' workflows | ' + roleCount + ' roles | ' + mcpName + ' | installed ' + runtimeManifest.installedAt.split('T')[0]);
  } else {
    const parts = ['v' + gssVersion];
    parts.push(corpusReady ? 'corpus v' + corpusVersion : 'corpus MISSING');
    parts.push(mcpReady ? 'MCP ready' : 'MCP unavailable');
    parts.push(workflowCount + ' workflows');
    parts.push(roleCount + ' roles');
    if (legacyMode) parts.push('legacy: on');
    parts.push('DEGRADED MODE');
    console.warn('[GSS] ' + parts.join(' | '));
    console.warn('[GSS] Running in degraded mode — MCP consultation unavailable.');
    console.warn('      Security workflows will proceed without OWASP document consultation.');
    console.warn('      To fix: npx get-shit-secured --claude --local');
  }
} catch (err) {
  // Hook failure must not block Claude operation
  console.error('[GSS ERROR] Hook session-start failed: ' + (err.message || err));
}
`;

/**
 * Workflow mode classification for hook policy enforcement.
 *
 * Map-codebase, threat-model, audit, validate-findings, plan-remediation,
 * security-review, and report are "review-only" — warn on code writes.
 * Execute-remediation is "write-capable" — confirm artifact context exists.
 * Verify is "verification" — discourage edits outside remediation scope.
 */
const REVIEW_ONLY_WORKFLOWS = [
  'map-codebase', 'threat-model', 'audit', 'validate-findings',
  'plan-remediation', 'security-review', 'report',
];

/**
 * Pre-tool-write hook command.
 *
 * Checks:
 * 1. Sensitive file path warnings (existing behavior, always active)
 * 2. Workflow-mode-aware warnings for code writes during review-only workflows
 * 3. Artifact context confirmation during execute-remediation
 */
const PRE_TOOL_WRITE_HOOK = `
try {
  const { existsSync, readFileSync } = require('fs');
  const { join } = require('path');
  const path = (context.toolInput && context.toolInput.path) || '';
  const cwd = context.cwd || process.cwd();

  // 1. Sensitive path checks (always active, regardless of workflow mode)
  const sensitive = ['.env', '.pem', '.key', 'secrets/', 'credentials/'];
  if (sensitive.some(s => path.includes(s))) {
    console.warn('[GSS WARN] Path: Attempting to write to potentially sensitive file: ' + path);
  }

  // 2. Workflow-mode detection via active-workflow.json
  const activeWfPath = join(cwd, '.gss', 'artifacts', 'active-workflow.json');
  if (existsSync(activeWfPath)) {
    try {
      const activeWf = JSON.parse(readFileSync(activeWfPath, 'utf-8'));
      const workflowId = activeWf.workflowId;
      const mode = activeWf.mode;

      // Writes to .gss/ are always allowed
      const normalizedPath = path.replace(/\\\\/g, '/');
      if (normalizedPath.includes('.gss/')) return;

      const reviewOnlyWorkflows = ['map-codebase','threat-model','audit','validate-findings','plan-remediation','security-review','report'];

      if (mode === 'review-only' || reviewOnlyWorkflows.includes(workflowId)) {
        // Code write during review-only workflow
        console.warn('[GSS WARN] Workflow: Active workflow is \\'' + workflowId + '\\' (review-only mode).');
        console.warn('           Writing to ' + path + ' may be unintentional.');
        console.warn('           To proceed, confirm this is deliberate.');
      }

      if (mode === 'write-capable' || workflowId === 'execute-remediation') {
        // Check that prior findings artifact exists
        const priorArtifactDir = join(cwd, '.gss', 'artifacts', 'plan-remediation');
        if (!existsSync(priorArtifactDir)) {
          console.warn('[GSS WARN] Workflow: In execute-remediation mode but no plan-remediation artifact found.');
          console.warn('           Ensure remediation plan exists before writing code changes.');
        }
      }
    } catch (e) {
      // Malformed active-workflow.json — ignore, don't block
    }
  }
} catch (err) {
  console.error('[GSS ERROR] Hook pre-tool-write failed: ' + (err.message || err));
}
`;

/**
 * Pre-tool-edit hook command.
 *
 * Checks:
 * 1. Artifact edit warnings (existing behavior)
 * 2. Scope-external edit warnings during verify mode
 * 3. Artifact context confirmation during execute-remediation
 */
const PRE_TOOL_EDIT_HOOK = `
try {
  const { existsSync, readFileSync, readdirSync } = require('fs');
  const { join } = require('path');
  const path = (context.toolInput && context.toolInput.file_path) || '';
  const cwd = context.cwd || process.cwd();

  // 1. Artifact edit warnings (always active)
  if (path.includes('.gss/artifacts/')) {
    console.warn('[GSS WARN] Artifact: Editing artifact file: ' + path);
  }

  // 2. Workflow-mode detection
  const activeWfPath = join(cwd, '.gss', 'artifacts', 'active-workflow.json');
  if (existsSync(activeWfPath)) {
    try {
      const activeWf = JSON.parse(readFileSync(activeWfPath, 'utf-8'));
      const workflowId = activeWf.workflowId;
      const mode = activeWf.mode;

      if (mode === 'verification' || workflowId === 'verify') {
        // Check if the edit target is in the remediation scope
        const scopeFiles = activeWf.scopeFiles;
        if (Array.isArray(scopeFiles) && scopeFiles.length > 0) {
          const normalizedPath = path.replace(/\\\\/g, '/');
          const inScope = scopeFiles.some(f => normalizedPath.includes(f.replace(/\\\\/g, '/')));
          if (!inScope) {
            console.warn('[GSS WARN] Workflow: In verify mode, editing ' + path + ' which was not in the remediation scope.');
            console.warn('           This may indicate scope creep.');
          }
        }
      }

      if (mode === 'write-capable' || workflowId === 'execute-remediation') {
        const priorArtifactDir = join(cwd, '.gss', 'artifacts', 'plan-remediation');
        if (!existsSync(priorArtifactDir)) {
          console.warn('[GSS WARN] Workflow: In execute-remediation mode but no plan-remediation artifact found.');
        }
      }
    } catch (e) {
      // Malformed active-workflow.json — ignore
    }
  }
} catch (err) {
  console.error('[GSS ERROR] Hook pre-tool-edit failed: ' + (err.message || err));
}
`;

/**
 * Post-tool-write hook command.
 *
 * Validates artifact writes:
 * 1. Detect writes to .gss/artifacts/{workflowId}/
 * 2. Parse the artifact as JSON
 * 3. Validate required top-level fields per workflow
 * 4. Validate consultation trace structure
 * 5. Report coverage status (pass/warn/fail)
 * 6. Ignore non-artifact writes
 */
const POST_TOOL_WRITE_HOOK = `
try {
  const { existsSync, readFileSync } = require('fs');
  const { join } = require('path');
  const writePath = (context.toolInput && context.toolInput.path) || '';
  const cwd = context.cwd || process.cwd();

  // Only validate writes to .gss/artifacts/
  const normalizedPath = writePath.replace(/\\\\/g, '/');
  const artifactsPrefix = '.gss/artifacts/';
  const artifactsIdx = normalizedPath.indexOf(artifactsPrefix);
  if (artifactsIdx === -1) return;

  // Extract workflow ID from path: .gss/artifacts/{workflowId}/...
  const afterPrefix = normalizedPath.substring(artifactsIdx + artifactsPrefix.length);
  const workflowId = afterPrefix.split('/')[0];
  if (!workflowId) return;

  // Resolve the full path and read the artifact
  const fullPath = writePath.startsWith('/') ? writePath : join(cwd, writePath);
  if (!existsSync(fullPath)) return;

  let artifact;
  try {
    artifact = JSON.parse(readFileSync(fullPath, 'utf-8'));
  } catch (e) {
    console.error('[GSS ERROR] Artifact: ' + writePath + ' is not valid JSON');
    return;
  }

  // Try to load the artifact validator support module
  let validator;
  try {
    const supportCandidates = [
      join(cwd, '.claude', 'gss'),
      join(process.env.HOME || '', '.claude', 'gss'),
    ];
    let supportDir = null;
    for (const candidate of supportCandidates) {
      if (existsSync(candidate)) { supportDir = candidate; break; }
    }
    if (supportDir) {
      validator = require(join(supportDir, 'hooks', 'artifact-validator.js'));
    }
  } catch {}

  if (validator && typeof validator.validateArtifact === 'function') {
    const result = validator.validateArtifact(artifact, workflowId);

    if (result.valid && result.errors.length === 0 && result.warnings.length === 0) {
      const coverage = result.coverageStatus !== 'not-applicable'
        ? ' (consultation: ' + result.coverageStatus + ')'
        : '';
      console.log('[GSS] Artifact validated: ' + normalizedPath + coverage);
    } else {
      for (const err of result.errors) {
        console.warn('[GSS WARN] Artifact: ' + normalizedPath + ' — ' + err);
      }
      for (const w of result.warnings) {
        console.warn('[GSS WARN] Artifact: ' + normalizedPath + ' — ' + w);
      }
      if (result.coverageStatus === 'fail') {
        console.warn('[GSS WARN] Coverage: FAIL — required docs missing in ' + normalizedPath);
      } else if (result.coverageStatus === 'warn') {
        console.warn('[GSS WARN] Coverage: WARN — ' + normalizedPath);
      }
    }
  } else {
    // Fallback: basic validation without the support module
    // Check consultation trace presence for known consultation-requiring workflows
    const consultationWorkflows = ['audit','verify','plan-remediation','execute-remediation','security-review','validate-findings'];
    if (consultationWorkflows.includes(workflowId)) {
      if (!artifact.consultation) {
        console.warn('[GSS WARN] Artifact: ' + normalizedPath + ' missing consultation trace');
      } else if (artifact.consultation.validation && artifact.consultation.validation.coverageStatus) {
        const status = artifact.consultation.validation.coverageStatus;
        if (status === 'fail') {
          console.warn('[GSS WARN] Coverage: FAIL — required docs missing in ' + normalizedPath);
        } else if (status === 'warn') {
          console.warn('[GSS WARN] Coverage: WARN — ' + normalizedPath);
        } else {
          console.log('[GSS] Artifact validated: ' + normalizedPath + ' (consultation: ' + status + ')');
        }
      } else {
        console.warn('[GSS WARN] Artifact: ' + normalizedPath + ' missing consultation coverage status');
      }
    } else {
      console.log('[GSS] Artifact written: ' + normalizedPath);
    }
  }
} catch (err) {
  console.error('[GSS ERROR] Hook post-tool-write failed: ' + (err.message || err));
}
`;

/**
 * Generate the artifact-validator.js support module content.
 *
 * This module is installed to {supportSubtree}/hooks/artifact-validator.js
 * and can be require()'d by the post-write hook for structured validation.
 *
 * The module is self-contained (no imports from GSS source) so it works
 * as a standalone CJS module in the installed hook directory.
 */
function generateArtifactValidatorModule(): string {
  // Build validation rules lookup from the TypeScript source
  const rulesEntries = Object.entries(ARTIFACT_VALIDATION_RULES).map(([id, rule]) =>
    `  '${id}': ${JSON.stringify(rule)}`
  ).join(',\n');

  return `// GSS Artifact Validator — installed support module
// Generated by get-shit-secured Phase 8
// This module is require()'d by the post-tool-write hook.

const ARTIFACT_VALIDATION_RULES = {
${rulesEntries}
};

function validateArtifact(artifact, workflowId) {
  var errors = [];
  var warnings = [];
  var rule = ARTIFACT_VALIDATION_RULES[workflowId];

  if (!rule) {
    return {
      valid: true,
      errors: [],
      warnings: ['No validation rule for workflow \\'' + workflowId + '\\''],
      coverageStatus: 'not-applicable'
    };
  }

  for (var i = 0; i < rule.requiredFields.length; i++) {
    var field = rule.requiredFields[i];
    if (!(field in artifact)) {
      errors.push('Missing required field: ' + field);
    }
  }

  var coverageStatus = 'not-applicable';

  if (rule.requiresConsultationTrace) {
    var consultation = artifact['consultation'];
    if (!consultation || typeof consultation !== 'object' || consultation === null) {
      errors.push('Missing consultation trace section');
      coverageStatus = 'missing';
    } else {
      for (var j = 0; j < rule.consultationFields.length; j++) {
        var cf = rule.consultationFields[j];
        if (!(cf in consultation)) {
          errors.push('Missing consultation field: ' + cf);
        }
      }

      if (rule.requiresCoverageStatus) {
        var validation = consultation['validation'];
        if (!validation || typeof validation !== 'object' || validation === null) {
          errors.push('Missing consultation.validation section');
          coverageStatus = 'missing';
        } else {
          var status = validation['coverageStatus'];
          if (!status || typeof status !== 'string') {
            errors.push('Missing coverageStatus in consultation.validation');
            coverageStatus = 'missing';
          } else if (['pass', 'warn', 'fail'].indexOf(status) === -1) {
            errors.push('Invalid coverageStatus: \\'' + status + '\\'');
            coverageStatus = 'missing';
          } else {
            coverageStatus = status;
            if (status === 'fail') {
              var missing = validation['requiredMissing'];
              if (Array.isArray(missing) && missing.length === 0) {
                warnings.push('coverageStatus is "fail" but requiredMissing is empty');
              }
            }
          }
        }
      }

      if (rule.consultationFields.indexOf('consultedDocs') !== -1 && 'consultedDocs' in consultation) {
        if (!Array.isArray(consultation['consultedDocs'])) {
          errors.push('consultation.consultedDocs must be an array');
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors,
    warnings: warnings,
    coverageStatus: coverageStatus
  };
}

module.exports = { validateArtifact: validateArtifact, ARTIFACT_VALIDATION_RULES: ARTIFACT_VALIDATION_RULES };
`;
}
