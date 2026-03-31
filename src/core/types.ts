/**
 * Runtime targets that get-shit-secured can install to.
 * Each runtime has its own directory structure and file formats.
 */
export type RuntimeTarget = 'claude' | 'codex';

/**
 * Installation scope determines where files are written.
 * - local: Project-specific installation (e.g., .claude/ in project root)
 * - global: User-level installation (e.g., ~/.claude/ or ~/$XDG_CONFIG_HOME)
 */
export type InstallScope = 'local' | 'global';

/**
 * Security workflow identifiers.
 * These correspond to high-level security activities that can be composed.
 */
export type WorkflowId =
  | 'map-codebase'
  | 'threat-model'
  | 'audit'
  | 'plan-remediation'
  | 'execute-remediation'
  | 'verify'
  | 'report';

/**
 * File category for distinguishing entrypoint from support files.
 */
export type FileCategory = 'entrypoint' | 'support';

/**
 * Overwrite policy for file writes.
 */
export type OverwritePolicy = 'create-only' | 'replace-managed' | 'merge-json';

/**
 * A single file to be created by the installer.
 * Used by runtime adapters to specify what should be written.
 */
export interface InstallFile {
  /** Relative path from the runtime root (e.g., "commands/gss/audit.md") */
  relativePath: string;
  /** File content to write */
  content: string;
  /** Whether to merge if file exists (for config files) */
  merge?: boolean;
  /** File category - entrypoint or support */
  category?: FileCategory;
  /** Overwrite policy for this file */
  overwritePolicy?: OverwritePolicy;
}

/**
 * Runtime file with explicit category and overwrite policy.
 * Enhanced version of InstallFile for the v2 adapter contract.
 */
export interface RuntimeFile {
  /** Relative path from the runtime root or support subtree */
  relativePath: string;
  /** File content to write */
  content: string;
  /** File category - entrypoint or support */
  category: FileCategory;
  /** Overwrite policy */
  overwritePolicy: OverwritePolicy;
  /** Support subtree path (if category is 'support') */
  supportSubtree?: string;
}

/**
 * Merge strategy for JSON patches.
 */
export type JsonMergeStrategy = 'shallow' | 'deep';

/**
 * Managed JSON config patch.
 * Used to merge GSS-owned config sections into existing JSON files.
 */
export interface ManagedJsonPatch {
  /** Relative path from runtime root */
  path: string;
  /** Owner identifier (e.g., "gss") */
  owner: string;
  /** Content to merge */
  content: Record<string, unknown>;
  /** Merge strategy */
  mergeStrategy: JsonMergeStrategy;
  /** Key path where content should be merged (e.g., "gss.hooks") */
  keyPath?: string;
}

/**
 * Text format for managed blocks.
 */
export type TextFormat = 'toml' | 'markdown' | 'jsonc';

/**
 * Managed text block with ownership markers.
 * Used to insert GSS-owned sections into text config files.
 */
export interface ManagedTextBlock {
  /** Relative path from runtime root */
  path: string;
  /** Owner identifier (e.g., "gss") */
  owner: string;
  /** Format of the text file */
  format: TextFormat;
  /** Start marker (e.g., "# GSS: BEGIN") */
  startMarker: string;
  /** End marker (e.g., "# GSS: END") */
  endMarker: string;
  /** Content to insert between markers */
  content: string;
}

/**
 * Hook event types.
 */
export type HookEvent = 'SessionStart' | 'SessionEnd' | 'PreToolUse' | 'PostToolUse' | 'PreCommand' | 'PostCommand';

/**
 * Hook definition for runtime integration.
 */
export interface RuntimeHook {
  /** Unique hook identifier */
  id: string;
  /** Event that triggers this hook */
  event: HookEvent;
  /** Optional matcher for conditional execution (regex pattern) */
  matcher?: string;
  /** Command or script to execute */
  command: string;
  /** Whether this hook blocks execution until complete */
  blocking: boolean;
  /** Hook description */
  description?: string;
}

/**
 * Runtime adapter capabilities.
 * Indicates what features the runtime adapter supports.
 */
export interface RuntimeAdapterCapabilities {
  /** Supports hook registration */
  supportsHooks: boolean;
  /** Supports subagent generation */
  supportsSubagents: boolean;
  /** Supports managed config merging */
  supportsManagedConfig: boolean;
  /** Supports role-based agents */
  supportsRoleAgents: boolean;
  /** Has runtime-specific config format */
  hasConfigFormat: boolean;
}

/**
 * Runtime adapter interface.
 * Each runtime (Claude, Codex, etc.) implements this to provide its
 * specific file layouts and templates.
 */
export interface RuntimeAdapter {
  /** Runtime identifier */
  readonly runtime: RuntimeTarget;
  /**
   * Resolve the root directory where runtime files should be installed.
   * @param scope - local or global installation
   * @param cwd - Current working directory for local installs
   */
  resolveRootPath(scope: InstallScope, cwd: string): string;
  /**
   * Resolve the support subtree path for runtime-specific assets.
   * @param scope - local or global installation
   * @param cwd - Current working directory for local installs
   */
  resolveSupportSubtree(scope: InstallScope, cwd: string): string;
  /**
   * Get runtime adapter capabilities.
   */
  getCapabilities(): RuntimeAdapterCapabilities;
  /**
   * List all files to create for a given workflow.
   * @param workflowId - The workflow to install
   * @returns Array of files to create, or empty if workflow not supported
   */
  getFilesForWorkflow(workflowId: WorkflowId): RuntimeFile[];
  /**
   * List all placeholder files to create for the runtime itself.
   * These are baseline commands/agents, not workflow-specific.
   */
  getPlaceholderFiles(): RuntimeFile[];
  /**
   * Get support files for the runtime (hooks, helpers, etc.).
   */
  getSupportFiles(): RuntimeFile[];
  /**
   * Get managed JSON config patches.
   */
  getManagedJsonPatches(): ManagedJsonPatch[];
  /**
   * Get managed text blocks.
   */
  getManagedTextBlocks(): ManagedTextBlock[];
  /**
   * Get hook definitions.
   */
  getHooks(): RuntimeHook[];
  /**
   * Optional: Runtime-specific settings to merge.
   * Returns path to settings file and partial content to merge.
   * @deprecated Use getManagedJsonPatches instead.
   */
  getSettingsMerge?: () => { path: string; content: Record<string, unknown> } | null;
}

/**
 * Install manifest record version 2.
 * Written to `.gss/install-manifest.json` to support uninstall/reinstall.
 */
export interface InstallManifestV2 {
  /** Manifest format version */
  manifestVersion: 2;
  /** Package version that created this install */
  packageVersion: string;
  /** Timestamp of installation (ISO 8601) */
  installedAt: string;
  /** Timestamp of last update (ISO 8601) */
  updatedAt: string;
  /** Installation scope */
  scope: InstallScope;
  /** Runtimes that were installed */
  runtimes: RuntimeTarget[];
  /** Workflow IDs that were installed */
  workflowIds: WorkflowId[];
  /** Absolute path to the install root for each runtime */
  roots: Partial<Record<RuntimeTarget, string>>;
  /** All files that were created, keyed by runtime */
  files: Partial<Record<RuntimeTarget, string[]>>;
  /** Managed config paths by runtime */
  managedConfigs: Partial<Record<RuntimeTarget, ManagedConfigRecord[]>>;
  /** Registered hooks by runtime */
  hooks: Partial<Record<RuntimeTarget, string[]>>;
  /** Runtime-specific manifest paths */
  runtimeManifests: Partial<Record<RuntimeTarget, string>>;
}

/**
 * Managed config record for manifest tracking.
 */
export interface ManagedConfigRecord {
  /** Path to the config file */
  path: string;
  /** Owner identifier */
  owner: string;
  /** Type of managed config */
  type: 'json' | 'text-block';
  /** Key path for JSON configs */
  keyPath?: string;
}

/**
 * Install manifest record.
 * Written to `.gss/install-manifest.json` to support uninstall/reinstall.
 * @deprecated Use InstallManifestV2 for new installs.
 */
export interface InstallManifest {
  /** Version of gss that created this install */
  version: string;
  /** Timestamp of installation (ISO 8601) */
  installedAt: string;
  /** Installation scope */
  scope: InstallScope;
  /** Runtimes that were installed */
  runtimes: RuntimeTarget[];
  /** Workflows that were installed */
  workflows: WorkflowId[];
  /** All files that were created, keyed by runtime */
  files: Partial<Record<RuntimeTarget, string[]>>;
  /** Absolute path to the install root for each runtime */
  roots: Partial<Record<RuntimeTarget, string>>;
}

/**
 * Parsed command-line arguments.
 */
export interface CliArgs {
  /** Selected runtime targets */
  runtimes: RuntimeTarget[];
  /** Installation scope */
  scope: InstallScope;
  /** Dry run - don't write files */
  dryRun: boolean;
  /** Uninstall mode (future) */
  uninstall: boolean;
  /** Install all supported runtimes */
  all: boolean;
  /** Show help message */
  showHelp?: boolean;
  /** Show version */
  showVersion?: boolean;
}

/**
 * Result of an installation operation.
 */
export interface InstallResult {
  success: boolean;
  manifest: InstallManifest | InstallManifestV2 | null;
  filesCreated: number;
  errors: string[];
}

/**
 * Result of a file write operation.
 */
export interface FileWriteResult {
  path: string;
  created: boolean;
  merged: boolean;
  error?: string;
}

/**
 * OWASP topic reference with links to relevant cheat sheets.
 * @deprecated Use OwaspCorpusEntry for canonical cheat sheet references.
 * This is kept for backward compatibility with existing workflow definitions.
 */
export interface OwaspTopic {
  /** Topic name from OWASP glossary */
  name: string;
  /** URL to OWASP glossary entry */
  glossaryUrl?: string;
  /** URLs to relevant OWASP cheat sheets */
  cheatSheetUrls?: string[];
}

/**
 * Stack detection result for conditional specialist activation.
 */
export interface StackDetection {
  /** Language detected (e.g., "typescript", "python", "java") */
  language?: string;
  /** Frameworks detected (e.g., "django", "express", "spring") */
  frameworks: string[];
  /** Platforms detected (e.g., "docker", "kubernetes", "aws") */
  platforms: string[];
  /** Package managers detected (e.g., "npm", "pip", "maven") */
  packageManagers: string[];
}

/**
 * Normalized OWASP cheat sheet corpus entry.
 * Represents one canonical cheat sheet from the OWASP Cheat Sheet Series.
 */
export interface OwaspCorpusEntry {
  /** Unique identifier derived from cheat sheet filename (e.g., "password-storage") */
  id: string;
  /** Full title of the cheat sheet */
  title: string;
  /** Canonical URL to the cheat sheet */
  sourceUrl: string;
  /** One-sentence summary of the cheat sheet's purpose */
  intentSummary: string;
  /** Major section headings in order */
  headings: string[];
  /** Checklist items or action points extracted from content */
  checklistItems: string[];
  /** Canonical OWASP references (links to other cheat sheets in corpus) */
  canonicalRefs: string[];
  /** Workflow IDs where this specialist is primarily used */
  workflowBindings: WorkflowId[];
  /** Stack conditions for activation (e.g., ["django"], ["docker"]) */
  stackBindings: string[];
  /** Tags for categorization and search */
  tags: string[];
  /** Processing status */
  status: 'pending' | 'fetched' | 'parsed' | 'validated';
}

/**
 * Specialist definition for OWASP-based security specialists.
 * Each specialist represents one OWASP cheat sheet as an installable agent/skill.
 */
export interface SpecialistDefinition {
  /** Unique identifier (same as OwaspCorpusEntry.id) */
  id: string;
  /** Human-readable title */
  title: string;
  /** Source cheat sheet URL */
  sourceUrl: string;
  /** One-sentence intent summary */
  intentSummary: string;
  /** Primary workflow IDs where this specialist applies */
  primaryWorkflowIds: WorkflowId[];
  /** Other specialist IDs this specialist delegates to */
  delegatesTo: string[];
  /** Rules that trigger this specialist's activation */
  activationRules: ActivationRule[];
  /** Expected inputs for this specialist */
  inputs: SpecialistInput[];
  /** Outputs produced by this specialist */
  outputs: SpecialistOutput[];
  /** Runtime-specific prompt templates */
  runtimePrompts: RuntimePrompts;
  /** Stack conditions for conditional activation */
  stackBindings?: string[];
}

/**
 * Activation rule for specialist delegation.
 */
export interface ActivationRule {
  /** Rule type */
  type: 'workflow-step' | 'issue-type' | 'checklist-trigger' | 'stack-condition' | 'delegation-edge';
  /** Trigger phrases that match this rule */
  triggerPhrases: string[];
  /** Tags that trigger this rule */
  triggerTags?: string[];
  /** Workflow context where this applies */
  workflowContext?: WorkflowId;
  /** Confidence score for this trigger (0-1) */
  confidence: number;
}

/**
 * Specialist input specification.
 */
export interface SpecialistInput {
  /** Input name */
  name: string;
  /** Input type */
  type: string;
  /** Description */
  description: string;
  /** Whether this input is required */
  required: boolean;
}

/**
 * Specialist output specification.
 */
export interface SpecialistOutput {
  /** Output name */
  name: string;
  /** Output type (e.g., "verdict", "finding", "guidance") */
  type: string;
  /** Description */
  description: string;
}

/**
 * Delegation rule between specialists.
 * Defines when one specialist should delegate to another.
 */
export interface DelegationRule {
  /** Parent specialist ID that delegates */
  parentSpecialistId: string;
  /** Child specialist ID to receive delegation */
  childSpecialistId: string;
  /** Reason for delegation */
  reason: string;
  /** Phrases that trigger this delegation */
  triggerPhrases: string[];
  /** Tags that trigger this delegation */
  triggerTags?: string[];
  /** Workflow context where delegation applies */
  workflowContext?: WorkflowId;
}

/**
 * Extended workflow definition with specialist metadata.
 * Extends the base WorkflowDefinition with specialist-aware fields.
 */
export interface ExtendedWorkflowDefinition extends WorkflowDefinition {
  /** Primary specialists for this workflow */
  primarySpecialists?: string[];
  /** Optional specialists that may be invoked */
  optionalSpecialists?: string[];
  /** Stack-conditioned specialists (activate when stack matches) */
  stackConditionedSpecialists?: string[];
  /** Default delegation behavior */
  defaultDelegationBehavior?: 'always' | 'on-detection' | 'manual';
}

/**
 * Structured output from a specialist.
 */
export interface SpecialistVerdict {
  /** Pass/fail/needs-review verdict */
  verdict: 'pass' | 'fail' | 'needs-review';
  /** Confidence score (0-1) */
  confidence: number;
  /** Evidence for the verdict */
  evidence: string[];
  /** Affected files (if applicable) */
  affectedFiles: Array<{
    path: string;
    line?: number;
    snippet?: string;
  }>;
  /** OWASP source that governed this verdict */
  owaspSourceUrl: string;
  /** Follow-up specialists to consult */
  followUpSpecialists?: string[];
  /** Remediation notes */
  remediationNotes?: string;
  /** Verification notes */
  verificationNotes?: string;
}

/**
 * Workflow input specification.
 */
export interface WorkflowInput {
  /** Input name/description */
  name: string;
  /** Expected input type or format */
  type: string;
  /** Whether this input is required */
  required: boolean;
  /** Description of what this input provides */
  description: string;
}

/**
 * Workflow output artifact specification.
 */
export interface WorkflowOutput {
  /** Artifact name */
  name: string;
  /** Artifact type (e.g., "json", "markdown", "diagram") */
  type: string;
  /** Description of the artifact */
  description: string;
  /** File path where artifact is typically stored */
  path?: string;
}

/**
 * Workflow dependency - which workflows must run first.
 */
export interface WorkflowDependency {
  /** Workflow ID that must run first */
  workflowId: WorkflowId;
  /** Which outputs from that workflow are consumed */
  requiredOutputs: string[];
}

/**
 * Workflow handoff - what to pass to the next workflow.
 */
export interface WorkflowHandoff {
  /** Next workflow ID */
  nextWorkflow: WorkflowId;
  /** Which outputs this workflow produces that the next one consumes */
  outputsToPass: string[];
}

/**
 * Workflow step - a discrete phase of the workflow.
 */
export interface WorkflowStep {
  /** Step identifier */
  id: string;
  /** Step title */
  title: string;
  /** Detailed instructions for this step */
  instructions: string;
  /** OWASP topics relevant to this step */
  owaspTopics?: string[];
}

/**
 * Guardrail - safety constraints for the workflow.
 */
export interface Guardrail {
  /** Guardrail type: preflight, approval, mutation, scope */
  type: 'preflight' | 'approval' | 'mutation' | 'scope';
  /** Guardrail description */
  description: string;
  /** When this guardrail applies */
  condition: string;
}

/**
 * Runtime-specific prompt sections.
 * Each runtime can customize how the workflow is presented.
 */
export interface RuntimePrompts {
  /** Claude-specific prompt additions */
  claude?: string;
  /** Codex-specific prompt additions */
  codex?: string;
}

/**
 * Complete workflow definition.
 * This is the shared source of truth for generating runtime-specific files.
 */
export interface WorkflowDefinition {
  /** Unique workflow identifier */
  id: WorkflowId;
  /** Human-readable title */
  title: string;
  /** One-sentence goal of this workflow */
  goal: string;
  /** OWASP topics this workflow is grounded in */
  owaspTopics: OwaspTopic[];
  /** Required inputs for this workflow */
  inputs: WorkflowInput[];
  /** Artifacts this workflow produces */
  outputs: WorkflowOutput[];
  /** Workflows that must run before this one */
  dependencies: WorkflowDependency[];
  /** Workflows that should consume this workflow's outputs */
  handoffs: WorkflowHandoff[];
  /** Step-by-step workflow execution */
  steps: WorkflowStep[];
  /** Safety constraints and pauses */
  guardrails: Guardrail[];
  /** Runtime-specific prompt customizations */
  runtimePrompts: RuntimePrompts;
}

/**
 * Role agent identifiers for GSS's fixed role-agent set.
 */
export type RoleAgentId =
  | 'gss-mapper'
  | 'gss-threat-modeler'
  | 'gss-auditor'
  | 'gss-remediator'
  | 'gss-verifier'
  | 'gss-reporter';

/**
 * Access level for role agents.
 */
export type AgentAccessLevel = 'read-only' | 'write-capable' | 'verification-only';

/**
 * Role agent definition.
 * Represents a fixed specialist agent within the GSS framework.
 */
export interface RoleAgentDefinition {
  /** Unique role agent identifier */
  id: RoleAgentId;
  /** Human-readable title */
  title: string;
  /** Description of the agent's purpose */
  description: string;
  /** Access level for this agent */
  accessLevel: AgentAccessLevel;
  /** What the agent may read (file patterns, scopes) */
  readPermissions: string[];
  /** What the agent may write (file patterns, scopes) */
  writePermissions: string[];
  /** Required artifact format for outputs */
  requiredOutputFormat: string;
  /** When the agent must delegate to other agents */
  delegationRules: string[];
  /** When the agent must stop and escalate */
  escalationRules: string[];
  /** Evidence quality requirements */
  evidenceRequirements: string[];
  /** Tests or verification that must be included */
  verificationRequirements: string[];
  /** Workflow this agent is primarily associated with */
  primaryWorkflow: WorkflowId;
}
