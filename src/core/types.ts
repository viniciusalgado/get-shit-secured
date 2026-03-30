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
  | 'verify'
  | 'remediate'
  | 'report';

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
   * List all files to create for a given workflow.
   * @param workflowId - The workflow to install
   * @returns Array of files to create, or empty if workflow not supported
   */
  getFilesForWorkflow(workflowId: WorkflowId): InstallFile[];
  /**
   * List all placeholder files to create for the runtime itself.
   * These are baseline commands/agents, not workflow-specific.
   */
  getPlaceholderFiles(): InstallFile[];
  /**
   * Optional: Runtime-specific settings to merge.
   * Returns path to settings file and partial content to merge.
   */
  getSettingsMerge?: () => { path: string; content: Record<string, unknown> } | null;
}

/**
 * Install manifest record.
 * Written to `.gss/install-manifest.json` to support uninstall/reinstall.
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
  manifest: InstallManifest | null;
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
