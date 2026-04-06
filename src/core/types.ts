/**
 * Runtime targets that get-shit-secured can install to.
 * Each runtime has its own directory structure and file formats.
 */
export type RuntimeTarget = 'claude' | 'codex';

/**
 * Rollout mode governing MCP-backed runtime behavior.
 * - hybrid-shadow: MCP-only runtime with comparison/reporting enabled
 * - mcp-only: MCP-only runtime
 */
export type RolloutMode = 'hybrid-shadow' | 'mcp-only';

/** Default rollout mode for new installs */
export const DEFAULT_ROLLOUT_MODE: RolloutMode = 'mcp-only';

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
  | 'security-review'
  | 'map-codebase'
  | 'threat-model'
  | 'audit'
  | 'validate-findings'
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
   * Get role agent/skill files for this runtime.
   * Returns RuntimeFile[] for each installed role.
   */
  getRoleFiles(): RuntimeFile[];
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
  /** Corpus snapshot version used for this install */
  corpusVersion?: string;
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
  /** MCP server binary paths per runtime (for uninstall) */
  mcpServerPaths?: Partial<Record<RuntimeTarget, string>>;
  /** MCP config file paths per runtime (for uninstall revert) */
  mcpConfigPaths?: Partial<Record<RuntimeTarget, string>>;
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

// =============================================================================
// Phase 9 — Installer Adaptation Types
// =============================================================================

/**
 * MCP registration result per runtime.
 * Returned by the registerMcpServers() stage module.
 */
export interface McpRegistrationResult {
  /** Per-runtime config paths that were modified */
  configPaths: Partial<Record<RuntimeTarget, string>>;
  /** Per-runtime server binary paths that were copied */
  serverBinaryPaths: Partial<Record<RuntimeTarget, string>>;
  /** Errors encountered during registration (non-fatal) */
  errors: string[];
}

/**
 * Install plan — describes all file and config operations before execution.
 * Produced by resolveInstallPlan() for inspection (dry-run) or execution.
 * Does NOT perform any I/O — purely a computation result.
 */
export interface InstallPlan {
  /** Scope of the install */
  scope: InstallScope;
  /** Runtime targets */
  runtimes: RuntimeTarget[];
  /** Corpus operations */
  corpus: {
    version: string;
    sourcePath: string;
    destinations: Array<{ runtime: RuntimeTarget; path: string }>;
  } | null;
  /** File operations per runtime */
  fileOps: Array<{
    runtime: RuntimeTarget;
    rootPath: string;
    supportSubtreePath: string;
    entrypointFiles: string[];
    supportFiles: string[];
    hooks: string[];
  }>;
  /** Config operations per runtime */
  configOps: Array<{
    runtime: RuntimeTarget;
    jsonPatches: ManagedJsonPatch[];
    textBlocks: ManagedTextBlock[];
    mcpServerCopy: { src: string; dest: string } | null;
    mcpConfigPatch: ManagedJsonPatch | null;
  }>;
  /** Legacy cleanup operations */
  cleanupOps: Array<{
    runtime: RuntimeTarget;
    files: string[];
    description: string;
  }>;
  /** Whether this is a dry run */
  dryRun: boolean;
}

/**
 * Legacy specialist artifact set.
 * Describes pre-migration specialist files found in the installed runtime.
 */
export interface LegacyArtifactSet {
  /** Specialist prompt files found */
  specialistFiles: string[];
  /** Specialist skill directories found (Codex) */
  specialistDirs: string[];
  /** Whether legacy specialists were detected */
  hasLegacyArtifacts: boolean;
  /** Total count */
  totalCount: number;
}

/**
 * Result of legacy specialist cleanup.
 */
export interface LegacyCleanupResult {
  /** Files successfully removed */
  removed: string[];
  /** Files skipped (not matching pattern, outside bounds, etc.) */
  skipped: string[];
  /** Errors during cleanup */
  errors: string[];
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
  /** Enable hybrid shadow mode (MCP-only comparison mode) */
  hybridShadow?: boolean;
  /** Verify installation without installing */
  verifyOnly?: boolean;
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
  /** URLs to relevant OWASP cheat sheets
   *  @deprecated Cheat sheet URLs are now managed by the MCP corpus. */
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
 * TODO(remove-in-release-c): Superseded by SecurityDoc in corpus v2.
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

// =============================================================================
// Corpus v2 Types (Phase 2 — Knowledge Boundary)
// =============================================================================

/**
 * Structured workflow binding within a SecurityDoc.
 * Replaces the flat WorkflowId[] in OwaspCorpusEntry.
 */
export interface DocWorkflowBinding {
  /** Which workflow this doc is bound to */
  workflowId: WorkflowId;
  /** Priority classification */
  priority: 'required' | 'optional' | 'followup';
  /** Why this binding exists */
  rationale?: string;
}

/**
 * Structured stack binding within a SecurityDoc.
 * Replaces the flat string[] in OwaspCorpusEntry.
 */
export interface DocStackBinding {
  /** Stack tag (e.g., "django", "java", "docker") */
  stack: string;
  /** Activation condition description */
  condition?: string;
}

/**
 * Provenance tracking for binding decisions.
 * Records which bindings were inferred vs curated.
 */
export interface DocProvenance {
  /** Fields that were inferred by heuristic logic */
  inferred: string[];
  /** Fields that were overridden from curated mapping.ts data */
  overridden: string[];
}

/**
 * Normalized security document replacing OwaspCorpusEntry for the v2 corpus.
 * This is the canonical data model for the Knowledge Boundary (Boundary C).
 *
 * Backward-compatible with OwaspCorpusEntry: every field in the old type
 * has a direct mapping to a SecurityDoc field.
 */
export interface SecurityDoc {
  /** Unique identifier derived from cheat sheet filename (e.g., "password-storage") */
  id: string;
  /** URI following the security:// scheme (e.g., "security://owasp/cheatsheet/password-storage") */
  uri: string;
  /** Full title of the cheat sheet */
  title: string;
  /** Canonical URL to the cheat sheet */
  sourceUrl: string;
  /** Source type classification */
  sourceType: 'owasp-cheatsheet' | 'owasp-glossary' | 'other';
  /** Semver of the corpus snapshot this doc belongs to */
  corpusVersion: string;
  /** Processing status (3-state, replacing 4-state OwaspCorpusEntry status) */
  status: 'ready' | 'pending' | 'deprecated';
  /** One-sentence summary (was intentSummary in OwaspCorpusEntry) */
  summary: string;
  /** Major section headings in order */
  headings: string[];
  /** Checklist items (was checklistItems in OwaspCorpusEntry) */
  checklist: string[];
  /** Tags for categorization and search */
  tags: string[];
  /** Issue taxonomy tags from issue-taxonomy.ts */
  issueTypes: string[];
  /** Structured workflow bindings (was flat WorkflowId[] in OwaspCorpusEntry) */
  workflowBindings: DocWorkflowBinding[];
  /** Structured stack bindings (was flat string[] in OwaspCorpusEntry) */
  stackBindings: DocStackBinding[];
  /** Related doc IDs (was canonicalRefs in OwaspCorpusEntry) */
  relatedDocIds: string[];
  /** Alternative names/abbreviations for this doc */
  aliases: string[];
  /** Provenance tracking for binding decisions */
  provenance: DocProvenance;
}

/**
 * Statistics summary embedded in a corpus snapshot.
 */
export interface CorpusSnapshotStats {
  /** Total documents in snapshot */
  totalDocs: number;
  /** Documents with status "ready" */
  readyDocs: number;
  /** Documents with status "pending" (fetch failed or no content) */
  pendingDocs: number;
  /** Total workflow bindings across all docs */
  totalBindings: number;
  /** Total related-doc edges across all docs */
  totalRelatedEdges: number;
}

/**
 * Versioned corpus snapshot — the single artifact produced by `build-corpus`.
 * Stored at data/owasp-corpus.snapshot.json.
 */
export interface CorpusSnapshot {
  /** Snapshot schema version (increment when format changes) */
  schemaVersion: 1;
  /** Corpus version (semver, e.g., "1.0.0") */
  corpusVersion: string;
  /** ISO 8601 timestamp of snapshot generation */
  generatedAt: string;
  /** All documents in the corpus */
  documents: SecurityDoc[];
  /** Aggregate statistics */
  stats: CorpusSnapshotStats;
}

// =============================================================================
// Consultation Planning Types (Phase 4 — Runtime Engine)
// =============================================================================

/**
 * Schema version for consultation plan artifacts.
 */
export const CONSULTATION_PLAN_SCHEMA_VERSION = 1;

/**
 * Schema version for consultation validation artifacts.
 */
export const CONSULTATION_VALIDATION_SCHEMA_VERSION = 1;

/**
 * Signal types that trigger a document's inclusion in a consultation plan.
 */
export type ConsultationSignalType =
  | 'workflow-binding'      // from DocWorkflowBinding
  | 'stack-binding'         // from DocStackBinding
  | 'issue-tag'             // from SecurityDoc.issueTypes
  | 'related-doc'           // from SecurityDoc.relatedDocIds
  | 'fallback-default';     // from workflow-level defaults

/**
 * Input signals for consultation plan computation.
 * Each workflow produces different signal profiles from its artifacts.
 */
export interface ConsultationSignals {
  /** Issue tags from findings/taxonomy classification */
  issueTags: string[];
  /** Normalized stack tags */
  stacks: string[];
  /** Changed file paths (for file-path-conditioned bindings) */
  changedFiles: string[];
}

/**
 * A single document entry in the consultation plan.
 */
export interface ConsultationEntry {
  /** Document ID (e.g., "sql-injection-prevention") */
  docId: string;
  /** Document URI (e.g., "security://owasp/cheatsheet/sql-injection-prevention") */
  docUri: string;
  /** Why this document was included */
  reason: string;
  /** Signal type that triggered inclusion */
  signalType: ConsultationSignalType;
  /** Score contribution */
  score: number;
  /** Stable ordering index */
  orderIndex: number;
}

/**
 * Constraints for consultation plan generation.
 * Controls fan-out and enforcement behavior.
 */
export interface ConsultationConstraints {
  /** Maximum required documents (default: 5) */
  maxRequired: number;
  /** Maximum optional documents (default: 8) */
  maxOptional: number;
  /** Maximum follow-up documents (default: 3) */
  maxFollowup: number;
  /** Whether to expand follow-ups via related-doc graph (default: true) */
  allowFollowUpExpansion: boolean;
  /** Whether to fail on missing required docs (default: true) */
  failOnMissingRequired: boolean;
}

/** Default constraint values for consultation plans */
export const DEFAULT_CONSULTATION_CONSTRAINTS: ConsultationConstraints = {
  maxRequired: 5,
  maxOptional: 8,
  maxFollowup: 3,
  allowFollowUpExpansion: true,
  failOnMissingRequired: true,
};

/**
 * Consultation plan — the planner's primary output.
 *
 * Replaces DelegationPlan for the corpus-native runtime engine.
 * Operates on document IDs instead of specialist IDs.
 */
export interface ConsultationPlan {
  /** Schema version */
  schemaVersion: typeof CONSULTATION_PLAN_SCHEMA_VERSION;
  /** Which workflow this plan is for */
  workflowId: WorkflowId;
  /** Timestamp of plan generation */
  generatedAt: string;
  /** Input signals used to compute the plan */
  signals: ConsultationSignals;
  /** Required documents — must be consulted */
  required: ConsultationEntry[];
  /** Optional documents — should be consulted if relevant */
  optional: ConsultationEntry[];
  /** Follow-up documents — consult if required docs reference them */
  followup: ConsultationEntry[];
  /** Documents that could not be resolved (corpus gaps) */
  blocked?: ConsultationEntry[];
  /** Constraints applied during plan generation */
  constraints: ConsultationConstraints;
  /** Corpus version used to generate this plan */
  corpusVersion: string;
}

/**
 * Consultation validation result.
 *
 * Replaces DelegationComplianceReport for the corpus-native runtime engine.
 *
 * Severity semantics:
 * - pass: All required docs consulted, no unexpected issues. Artifact is clean.
 * - warn: Required missing but failOnMissingRequired=false, or significant optional gaps.
 *         Artifact includes warning; workflow may continue.
 * - fail: Required missing and failOnMissingRequired=true.
 *         Artifact must include remediation note; downstream workflows should treat
 *         findings as potentially incomplete.
 *
 * JSON-serializable and artifact-friendly. No runtime-specific references.
 */
export interface ConsultationValidation {
  /** Schema version */
  schemaVersion: typeof CONSULTATION_VALIDATION_SCHEMA_VERSION;
  /** Which workflow this validation covers */
  workflowId: WorkflowId;
  /** Timestamp of validation */
  checkedAt: string;
  /** Documents that were actually consulted */
  consulted: string[];
  /** Required documents that were NOT consulted */
  requiredMissing: string[];
  /** Documents consulted that were not in the plan */
  unexpectedConsulted: string[];
  /** Optional documents that were missed (informational) */
  optionalMissed: string[];
  /** Overall coverage status */
  coverageStatus: 'pass' | 'warn' | 'fail';
  /** Individual notes about coverage decisions */
  notes: string[];
  /** Stats */
  stats: {
    requiredTotal: number;
    requiredConsulted: number;
    optionalTotal: number;
    optionalConsulted: number;
  };
}

// =============================================================================
// Phase 6 — MCP Consultation Types
// =============================================================================

/**
 * Signal derivation strategy for a workflow.
 * Replaces DelegationPolicy with explicit signal source declarations.
 */
export interface SignalDerivation {
  /** How stack signals are derived for this workflow */
  stacks: 'from-codebase' | 'from-prior-artifact' | 'from-diff-heuristics' | 'none';
  /** How issue tags are derived for this workflow */
  issueTags: 'from-findings' | 'from-diff-heuristics' | 'none';
  /** How changed files are derived for this workflow */
  changedFiles: 'from-diff' | 'from-prior-artifact' | 'none';
}

/**
 * Consultation trace embedded in workflow artifacts.
 * Every workflow must produce this as part of its output artifacts.
 */
export interface ConsultationTrace {
  /** Summary of the consultation plan that governed this run */
  plan: {
    workflowId: WorkflowId;
    generatedAt: string;
    corpusVersion: string;
    requiredCount: number;
    optionalCount: number;
    followupCount: number;
  };
  /** Document IDs actually consulted with metadata */
  consultedDocs: Array<{
    id: string;
    title: string;
    sourceUrl: string;
  }>;
  /** Coverage validation result */
  coverageStatus: 'pass' | 'warn' | 'fail';
  /** Required documents that were not consulted */
  requiredMissing: string[];
  /** Notes about coverage decisions */
  notes: string[];
}

// =============================================================================
// Phase 12 — Artifact Envelope and Consultation Mode
// =============================================================================

/**
 * Schema version for the artifact envelope.
 */
export const ARTIFACT_ENVELOPE_SCHEMA_VERSION = 1;

/**
 * Consultation relevance for a workflow.
 * - required: Workflow must include consultation trace (hook enforces)
 * - optional: Workflow may include trace; missing is not an error
 * - not-applicable: Workflow does not consult MCP (hook skips check)
 */
export type ConsultationMode = 'required' | 'optional' | 'not-applicable';

/**
 * Versioned artifact envelope.
 * Every JSON artifact produced by a GSS workflow must include these fields
 * at the top level, wrapping the workflow-specific payload.
 */
export interface ArtifactEnvelope {
  /** Envelope schema version */
  schemaVersion: typeof ARTIFACT_ENVELOPE_SCHEMA_VERSION;
  /** Which workflow produced this artifact */
  workflowId: WorkflowId;
  /** GSS version at time of artifact generation */
  gssVersion: string;
  /** Corpus version used for consultation */
  corpusVersion: string;
  /** Timestamp of artifact generation */
  generatedAt: string;
  /** Consultation mode for this workflow */
  consultationMode: ConsultationMode;
  /** Consultation trace (present if consultationMode is required or optional) */
  consultation?: ConsultationTrace;
}

// =============================================================================
// Phase 11 — Rollout Comparison Types
// =============================================================================

/**
 * Comparison between MCP and legacy consultation results.
 * Produced when running in hybrid-shadow mode or when comparing two runs.
 */
export interface ConsultationComparison {
  /** Schema version */
  schemaVersion: 1;
  /** Which workflow was compared */
  workflowId: WorkflowId;
  /** Timestamp of comparison */
  comparedAt: string;
  /** Documents consulted by MCP path */
  mcpDocs: string[];
  /** Documents consulted by legacy path */
  legacyDocs: string[];
  /** Documents in MCP but not legacy */
  mcpOnly: string[];
  /** Documents in legacy but not MCP */
  legacyOnly: string[];
  /** Documents in both paths */
  common: string[];
  /** Required docs covered by MCP (0-1 fraction) */
  mcpRequiredCoverage: number;
  /** Required docs covered by legacy (0-1 fraction) */
  legacyRequiredCoverage: number;
  /** Difference in coverage (positive = MCP superior) */
  coverageDelta: number;
  /** Assessment verdict */
  assessment: 'mcp-superior' | 'equivalent' | 'mcp-inferior';
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
 * Ordered orchestration phase metadata for coordinator-driven workflows.
 */
export interface WorkflowOrchestrationPhase {
  /** Stable phase identifier */
  id: string;
  /** Human-readable phase title */
  title: string;
  /** Lead role/agent for this phase */
  lead: string;
  /** Execution mode for this phase */
  execution: string;
  /** Input artifact or signal names consumed by this phase */
  inputs: string[];
  /** Output artifact names produced by this phase */
  outputs: string[];
  /** Specialist engagement mode for this phase
   *  @deprecated Use mcpConsultation instead. */
  specialistMode?: string;
  /** MCP consultation level for this phase */
  mcpConsultation?: 'full' | 'minimal' | 'none';
}

/**
 * Optional orchestration metadata for workflows that execute ordered subagent phases.
 */
export interface WorkflowOrchestration {
  /** Coordinator entity for the workflow orchestration */
  coordinator: 'workflow-agent';
  /** Ordered phases in execution sequence */
  phases: WorkflowOrchestrationPhase[];
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
  /** Optional coordinator orchestration metadata */
  orchestration?: WorkflowOrchestration;
  /** Signal derivation strategy for MCP consultation */
  signalDerivation?: SignalDerivation;
  /** Whether this workflow consults MCP and must produce a consultation trace */
  consultationMode: ConsultationMode;
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
 * MCP consultation interaction level for a role agent.
 * - 'full': Role reads all required + optional docs, validates coverage
 * - 'moderate': Role reads subset of docs relevant to its reasoning
 * - 'minimal': Role reads only stack-relevant docs for context
 * - 'none': Role does not initiate new MCP consultation
 */
export type RoleMcpConsultationLevel = 'full' | 'moderate' | 'minimal' | 'none';

/**
 * Role agent MCP consultation configuration.
 * Determines how each role interacts with the GSS MCP server.
 */
export interface RoleMcpConfig {
  /** MCP interaction level */
  level: RoleMcpConsultationLevel;
  /** When this role should consult the MCP */
  when: string;
  /** Which MCP tools this role uses */
  tools: string[];
}

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

// =============================================================================
// Phase 8 — Hook Retargeting Types
// =============================================================================

/**
 * Active workflow tracking file written by workflow commands.
 * Used by hooks to enforce mode-specific policies.
 *
 * Written to `.gss/artifacts/active-workflow.json` at workflow start.
 * Removed at workflow completion. If found at session start, indicates
 * an interrupted workflow and is cleaned up by the session-start hook.
 */
export interface ActiveWorkflow {
  /** Workflow ID currently running */
  workflowId: WorkflowId;
  /** ISO 8601 timestamp of workflow start */
  startedAt: string;
  /** Mode: review-only, write-capable, verification */
  mode: 'review-only' | 'write-capable' | 'verification';
  /** Files in scope for this workflow (from prior artifacts) */
  scopeFiles?: string[];
}

/**
 * Workflow mode classification for hook policy enforcement.
 */
export type WorkflowMode = ActiveWorkflow['mode'];

/**
 * Runtime manifest — written to {supportSubtree}/runtime-manifest.json.
 * Tracks per-runtime installation metadata for health checks and diagnostics.
 *
 * Extended in Phase 8 to include corpus/MCP paths and GSS version for
 * session-start hook health checks.
 */
export interface RuntimeManifest {
  /** Runtime target (claude | codex) */
  runtime: RuntimeTarget;
  /** Installation scope (local | global) */
  scope: InstallScope;
  /** ISO 8601 timestamp of installation */
  installedAt: string;
  /** Manifest format version */
  version: string;
  /** Corpus snapshot version used for this install */
  corpusVersion: string;
  /** Hook IDs registered for this runtime */
  hooks: string[];
  /** Managed config file paths */
  managedConfigs: string[];
  /** Absolute path to the corpus snapshot file */
  corpusPath: string | null;
  /** Absolute path to the MCP server binary */
  mcpServerPath: string | null;
  /** Absolute path to the runtime settings.json (for MCP registration check) */
  mcpConfigPath: string;
  /** GSS package version */
  gssVersion: string;
  /** List of installed workflow IDs */
  installedWorkflows: WorkflowId[];
  /** List of installed role IDs */
  installedRoles: string[];
  /** MCP server registration name */
  mcpServerName: string;
  /** Rollout mode governing consultation paths (Phase 11) */
  rolloutMode: RolloutMode;
  /** Whether comparison traces are expected (hybrid-shadow only, Phase 11) */
  comparisonEnabled?: boolean;
}
