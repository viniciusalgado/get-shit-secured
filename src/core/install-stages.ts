/**
 * * Install Stages — Explicit stage pipeline for GSS installation.
 *
 * Refactors the monolithic `install()` into named stage functions:
 *   Stage 0: Target detection
 *   Stage 1: Packaged corpus resolution
 *   Stage 2: Runtime artifact install
 *   Stage 3: MCP registration (implemented in Phase 5)
 *   Stage 4: Manifest and verification
 */

import { mkdir, writeFile, copyFile, readFile } from 'node:fs/promises';
import { existsSync, readdirSync, lstatSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import type {
  InstallScope,
  RuntimeAdapter,
  RuntimeTarget,
  WorkflowId,
  ManagedConfigRecord,
  CorpusSnapshot,
  RuntimeFile,
  ManagedJsonPatch,
  ManagedTextBlock,
  RuntimeHook,
  FileWriteResult,
  InstallFile,
  InstallPlan,
  RolloutMode,
} from './types.js';
import { loadCorpusSnapshot, type LoadedSnapshot } from '../corpus/snapshot-loader.js';
import { isCorpusSnapshot } from '../corpus/schema.js';
import { getAllRoles } from '../catalog/roles/registry.js';
import {
  getDefaultPackagedMcpServerPath,
  resolvePackagedMcpServerPath,
} from './mcp-server-path.js';
import { getHomeDir } from './paths.js';

/**
 * Default workflows to install.
 */
export const DEFAULT_WORKFLOWS: WorkflowId[] = [
  'security-review',
  'map-codebase',
  'threat-model',
  'audit',
  'validate-findings',
  'plan-remediation',
  'execute-remediation',
  'verify',
  'report',
];

/**
 * Compute the rollout mode from CLI flags.
 * Priority: hybridShadow > default (mcp-only)
 *
 * @param args - CLI flags relevant to rollout mode
 * @returns The computed RolloutMode
 */
export function computeRolloutMode(args: { hybridShadow?: boolean }): RolloutMode {
  if (args.hybridShadow) return 'hybrid-shadow';
  return 'mcp-only';
}

/**
 * Stage 0 output: detected installation targets.
 */
export interface TargetDetection {
  runtimes: RuntimeTarget[];
  scope: InstallScope;
  cwd: string;
  roots: Partial<Record<RuntimeTarget, string>>;
  supportSubtrees: Partial<Record<RuntimeTarget, string>>;
}

/**
 * Stage 1 output: resolved corpus snapshot.
 */
export interface CorpusResolution {
  snapshot: CorpusSnapshot;
  corpusVersion: string;
  sourcePath: string;
  destinationPaths: Partial<Record<RuntimeTarget, string>>;
}

/**
 * Stage 2 output: installed runtime artifacts.
 */
export interface InstalledArtifacts {
  filesByRuntime: Partial<Record<RuntimeTarget, string[]>>;
  rootsByRuntime: Partial<Record<RuntimeTarget, string>>;
  managedConfigsByRuntime: Partial<Record<RuntimeTarget, ManagedConfigRecord[]>>;
  hooksByRuntime: Partial<Record<RuntimeTarget, string[]>>;
  runtimeManifestPaths: Partial<Record<RuntimeTarget, string>>;
  totalFilesCreated: number;
  errors: string[];
}

/**
 * Stage 4 output: verification result.
 */
export interface VerificationResult {
  healthy: boolean;
  errors: string[];
}

/**
 * Stage 0: Detect installation targets.
 */
export function detectTargets(
  adapters: RuntimeAdapter[],
  scope: InstallScope,
  cwd: string
): TargetDetection {
  const roots: Partial<Record<RuntimeTarget, string>> = {};
  const supportSubtrees: Partial<Record<RuntimeTarget, string>> = {};

  for (const adapter of adapters) {
    roots[adapter.runtime] = adapter.resolveRootPath(scope, cwd);
    supportSubtrees[adapter.runtime] = adapter.resolveSupportSubtree(scope, cwd);
  }

  return {
    runtimes: adapters.map(a => a.runtime),
    scope,
    cwd,
    roots,
    supportSubtrees,
  };
}

/**
 * Stage 1: Resolve packaged corpus snapshot.
 *
 * Locates the bundled snapshot in the npm package, loads it, and computes
 * destination paths for each runtime target.
 *
 * @param targets - Stage 0 output
 * @param pkgRoot - Root directory of the GSS package (for locating bundled snapshot)
 */
export async function resolveCorpus(
  targets: TargetDetection,
  pkgRoot: string
): Promise<CorpusResolution> {
  // Locate bundled snapshot
  const candidatePaths = [
    join(pkgRoot, 'data', 'corpus', 'owasp-corpus.snapshot.json'),
    join(pkgRoot, 'data', 'owasp-corpus.snapshot.json'),
    join(process.cwd(), 'data', 'corpus', 'owasp-corpus.snapshot.json'),
  ];

  let snapshotPath: string | null = null;
  for (const candidate of candidatePaths) {
    if (existsSync(candidate)) {
      snapshotPath = candidate;
      break;
    }
  }

  if (!snapshotPath) {
    throw new Error(
      'Corpus snapshot not found. Run "npm run build-corpus" first, or ensure the package includes data/.'
    );
  }

  // Load and validate
  const loaded = loadCorpusSnapshot(snapshotPath);

  // Compute destination paths per runtime
  const destinationPaths: Partial<Record<RuntimeTarget, string>> = {};
  for (const runtime of targets.runtimes) {
    const supportSubtree = targets.supportSubtrees[runtime];
    if (supportSubtree) {
      destinationPaths[runtime] = join(supportSubtree, 'corpus', 'owasp-corpus.json');
    }
  }

  return {
    snapshot: loaded.snapshot,
    corpusVersion: loaded.snapshot.corpusVersion,
    sourcePath: snapshotPath,
    destinationPaths,
  };
}

/**
 * Stage 2: Install runtime artifacts.
 *
 * Writes commands/agents, hooks, support files, and copies the corpus snapshot.
 */
export async function installRuntimeArtifacts(
  targets: TargetDetection,
  adapters: RuntimeAdapter[],
  corpus: CorpusResolution | null,
  options: { dryRun: boolean; hybridShadow?: boolean; pkgRoot: string }
): Promise<InstalledArtifacts> {
  const { dryRun } = options;
  const errors: string[] = [];
  const filesByRuntime: Partial<Record<RuntimeTarget, string[]>> = {};
  const rootsByRuntime: Partial<Record<RuntimeTarget, string>> = {};
  const managedConfigsByRuntime: Partial<Record<RuntimeTarget, ManagedConfigRecord[]>> = {};
  const hooksByRuntime: Partial<Record<RuntimeTarget, string[]>> = {};
  const runtimeManifestPaths: Partial<Record<RuntimeTarget, string>> = {};
  let totalFilesCreated = 0;

  if (!dryRun) {
    await mkdir(join(targets.cwd, '.gss', 'artifacts'), { recursive: true });
    await mkdir(join(targets.cwd, '.gss', 'reports'), { recursive: true });
  }

  for (const adapter of adapters) {
    const runtime = adapter.runtime;
    const rootPath = targets.roots[runtime]!;
    const supportSubtreePath = targets.supportSubtrees[runtime]!;

    rootsByRuntime[runtime] = rootPath;
    const runtimeFilePaths: string[] = [];

    // Create support subtree
    if (!dryRun) {
      try {
        await mkdir(supportSubtreePath, { recursive: true });
      } catch (error) {
        errors.push(`${runtime}: Failed to create support subtree: ${error}`);
        continue;
      }
    }

    // Copy corpus snapshot to support subtree
    if (corpus && !dryRun) {
      const destPath = corpus.destinationPaths[runtime];
      if (destPath) {
        try {
          await mkdir(dirname(destPath), { recursive: true });
          await copyFile(corpus.sourcePath, destPath);
          runtimeFilePaths.push(destPath);
          totalFilesCreated++;
        } catch (error) {
          errors.push(`${runtime}: Failed to copy corpus snapshot: ${error}`);
        }
      }
    }

    // Collect adapter output
    const collected = collectAdapterOutput(adapter, DEFAULT_WORKFLOWS);
    const { entrypointFiles, supportFiles, managedJsonPatches, managedTextBlocks, hooks } = collected;

    // Write support files
    for (const file of supportFiles) {
      const result = dryRun
        ? mockFileWrite(supportSubtreePath, toInstallFile(file))
        : await writeFileSafe(supportSubtreePath, toInstallFile(file), targets.cwd);

      if (result.error) {
        errors.push(`${runtime}/gss/${file.relativePath}: ${result.error}`);
      } else if (result.created || result.merged) {
        totalFilesCreated++;
        runtimeFilePaths.push(join(supportSubtreePath, file.relativePath));
      }
    }

    // Write entrypoint files
    for (const file of entrypointFiles) {
      const result = dryRun
        ? mockFileWrite(rootPath, toInstallFile(file))
        : await writeFileSafe(rootPath, toInstallFile(file), targets.cwd);

      if (result.error) {
        errors.push(`${runtime}/${file.relativePath}: ${result.error}`);
      } else if (result.created || result.merged) {
        totalFilesCreated++;
        runtimeFilePaths.push(join(rootPath, file.relativePath));
      }
    }

    // Apply managed JSON merges
    const jsonConfigRecords: ManagedConfigRecord[] = [];
    for (const patch of managedJsonPatches) {
      if (dryRun) {
        jsonConfigRecords.push({
          path: join(rootPath, patch.path),
          owner: patch.owner,
          type: 'json',
          keyPath: patch.keyPath,
        });
        continue;
      }
      try {
        await applyManagedJsonPatch(rootPath, patch, targets.cwd);
        jsonConfigRecords.push({
          path: join(rootPath, patch.path),
          owner: patch.owner,
          type: 'json',
          keyPath: patch.keyPath,
        });
      } catch (error) {
        errors.push(`${runtime}: Failed to apply JSON patch to ${patch.path}: ${error}`);
      }
    }

    // Apply managed text blocks
    for (const block of managedTextBlocks) {
      if (dryRun) {
        continue;
      }
      try {
        await applyManagedTextBlock(rootPath, block, targets.cwd);
      } catch (error) {
        errors.push(`${runtime}: Failed to apply text block to ${block.path}: ${error}`);
      }
    }
    managedConfigsByRuntime[runtime] = jsonConfigRecords;

    // Register hooks
    const hookPaths: string[] = [];
    if (!dryRun) {
      const hooksDir = join(supportSubtreePath, 'hooks');
      try {
        await mkdir(hooksDir, { recursive: true });
      } catch (error) {
        errors.push(`${runtime}: Failed to create hooks directory: ${error}`);
      }
    }

    for (const hook of hooks) {
      const hooksDir = join(supportSubtreePath, 'hooks');
      const hookFilePath = join(hooksDir, `${hook.id}.js`);
      const hookContent = generateHookScript(hook);

      if (!dryRun) {
        try {
          await writeFile(hookFilePath, hookContent, 'utf-8');
          hookPaths.push(hookFilePath);
        } catch (error) {
          errors.push(`${runtime}: Failed to write hook ${hook.id}: ${error}`);
        }
      } else {
        hookPaths.push(hookFilePath);
      }
    }
    hooksByRuntime[runtime] = hookPaths;

    // Write runtime manifest
    const runtimeManifestPath = join(supportSubtreePath, 'runtime-manifest.json');
    runtimeManifestPaths[runtime] = runtimeManifestPath;

    if (!dryRun) {
      try {
        const rolloutMode = computeRolloutMode({ hybridShadow: options.hybridShadow });
        const packagedMcpServerPath = resolvePackagedMcpServerPath(options.pkgRoot);
        const runtimeManifest = {
          runtime,
          scope: targets.scope,
          installedAt: new Date().toISOString(),
          version: '0.1.0',
          corpusVersion: corpus?.corpusVersion ?? 'legacy',
          hooks: hooks.map(h => h.id),
          managedConfigs: jsonConfigRecords.map(r => r.path),
          // Phase 8 additions for session-start health checks:
          corpusPath: corpus?.destinationPaths[runtime] ?? null,
          mcpServerPath: corpus ? packagedMcpServerPath : null,
          mcpConfigPath: runtime === 'codex'
            ? join(rootPath, 'config.toml')
            : (targets.scope === 'local' ? join(targets.cwd, '.mcp.json') : join(getHomeDir(), '.claude.json')),
          gssVersion: '0.1.0',
          // Phase 10 additions for diagnostic metadata:
          installedWorkflows: DEFAULT_WORKFLOWS,
          installedRoles: getAllRoles().map(r => r.id),
          mcpServerName: 'gss-security-docs',
          rolloutMode,
          ...(rolloutMode === 'hybrid-shadow' ? { comparisonEnabled: true } : {}),
        };
        await writeFile(runtimeManifestPath, JSON.stringify(runtimeManifest, null, 2), 'utf-8');
      } catch (error) {
        errors.push(`${runtime}: Failed to write runtime manifest: ${error}`);
      }
    }

    // Handle legacy settings merge if supported
    const adapterWithSettings = adapter as unknown as {
      getSettingsMerge?: () => { path: string; content: Record<string, unknown> } | null;
    };
    const settingsMerge = adapterWithSettings.getSettingsMerge?.();
    if (settingsMerge && managedJsonPatches.length === 0) {
      const settingsPath = join(rootPath, settingsMerge.path);
      await mergeSettingsSafe(settingsPath, settingsMerge.content, dryRun);
    }

    filesByRuntime[runtime] = runtimeFilePaths;
  }

  return {
    filesByRuntime,
    rootsByRuntime,
    managedConfigsByRuntime,
    hooksByRuntime,
    runtimeManifestPaths,
    totalFilesCreated,
    errors,
  };
}

/**
 * Resolve the complete install plan without executing.
 * Used for dry-run reporting and plan inspection.
 * Does NOT perform any I/O — purely a computation.
 */
export function resolveInstallPlan(
  targets: TargetDetection,
  adapters: RuntimeAdapter[],
  corpus: CorpusResolution | null,
  options: { dryRun: boolean; pkgRoot: string }
): InstallPlan {
  const fileOps: InstallPlan['fileOps'] = [];
  const configOps: InstallPlan['configOps'] = [];
  const cleanupOps: InstallPlan['cleanupOps'] = [];

  for (const adapter of adapters) {
    const runtime = adapter.runtime;
    const rootPath = targets.roots[runtime]!;
    const supportSubtreePath = targets.supportSubtrees[runtime]!;

    // Collect file lists from adapter
    const entrypointFiles: string[] = [];
    const supportFiles: string[] = [];
    const hooks: string[] = [];

    const placeholders = adapter.getPlaceholderFiles();
    for (const file of placeholders) {
      if (file.category === 'support') {
        supportFiles.push(join(supportSubtreePath, file.relativePath));
      } else {
        entrypointFiles.push(join(rootPath, file.relativePath));
      }
    }

    for (const workflow of DEFAULT_WORKFLOWS) {
      const workflowFiles = adapter.getFilesForWorkflow(workflow);
      for (const file of workflowFiles) {
        if (file.category === 'support') {
          supportFiles.push(join(supportSubtreePath, file.relativePath));
        } else {
          entrypointFiles.push(join(rootPath, file.relativePath));
        }
      }
    }

    for (const file of adapter.getSupportFiles()) {
      supportFiles.push(join(supportSubtreePath, file.relativePath));
    }

    // Role agent/skill files (via RuntimeAdapter interface)
    for (const file of adapter.getRoleFiles()) {
      entrypointFiles.push(join(rootPath, file.relativePath));
    }

    // Hooks
    const adapterHooks = adapter.getHooks();
    for (const hook of adapterHooks) {
      hooks.push(join(supportSubtreePath, 'hooks', `${hook.id}.js`));
    }

    fileOps.push({
      runtime,
      rootPath,
      supportSubtreePath,
      entrypointFiles,
      supportFiles,
      hooks,
    });

    // Config operations
    const jsonPatches = adapter.getManagedJsonPatches();
    const textBlocks = adapter.getManagedTextBlocks();

    // MCP operations
    let mcpServerCopy: { src: string; dest: string } | null = null;
    let mcpConfigPatch: ManagedJsonPatch | null = null;

    const adapterWithMcp = adapter as unknown as {
      getMcpRegistration?: (
        serverPath: string,
        corpusPath: string,
        opts?: { scope: string; cwd: string },
      ) => ManagedJsonPatch;
    };
    if (typeof adapterWithMcp.getMcpRegistration === 'function' && corpus) {
      const srcServerPath = resolvePackagedMcpServerPath(options.pkgRoot)
        ?? getDefaultPackagedMcpServerPath(options.pkgRoot);

      const corpusDestPath = corpus.destinationPaths[runtime]!;
      mcpConfigPatch = adapterWithMcp.getMcpRegistration(srcServerPath, corpusDestPath, {
        scope: targets.scope,
        cwd: targets.cwd,
      });
    }

    configOps.push({
      runtime,
      jsonPatches,
      textBlocks,
      mcpServerCopy,
      mcpConfigPatch,
    });

    const adapterWithExtras = adapter as unknown as {
      getSpecialistFiles?: () => InstallFile[];
    };
    if (typeof adapterWithExtras.getSpecialistFiles === 'function') {
      const specialistFiles = adapterWithExtras.getSpecialistFiles() ?? [];
      if (specialistFiles.length > 0) {
        cleanupOps.push({
          runtime,
          files: specialistFiles.map(f => join(rootPath, f.relativePath)),
          description: `${specialistFiles.length} retired specialist files`,
        });
      }
    }
  }

  return {
    scope: targets.scope,
    runtimes: targets.runtimes,
    corpus: corpus ? {
      version: corpus.corpusVersion,
      sourcePath: corpus.sourcePath,
      destinations: Object.entries(corpus.destinationPaths)
        .filter(([, path]) => path)
        .map(([runtime, path]) => ({ runtime: runtime as RuntimeTarget, path: path! })),
    } : null,
    fileOps,
    configOps,
    cleanupOps,
    dryRun: options.dryRun,
  };
}

/**
 * Stage 4: Verify the installation with comprehensive health checks.
 *
 * Checks:
 * 1. Corpus snapshot — exists at each destination path, valid JSON, has corpusVersion
 * 2. MCP server binary — exists at expected path in support subtree
 * 3. MCP config — settings.json contains mcpServers.gss-security-docs
 * 4. Runtime manifest — exists in support subtree, has expected fields
 * 5. Hooks — each expected hook has a corresponding .js file
 * 6. Artifact directories — .gss/artifacts/ and .gss/reports/ exist
 * 7. Manifest consistency — install-manifest.json and runtime-manifest.json agree on corpus version
 */
export async function verifyInstall(
  targets: TargetDetection,
  corpus: CorpusResolution | null,
  mcpResult?: { configPaths?: Partial<Record<string, string>>; serverBinaryPaths?: Partial<Record<string, string>>; errors?: string[] } | null,
  options?: { dryRun: boolean }
): Promise<VerificationResult> {
  const dryRun = options?.dryRun ?? false;
  if (dryRun) {
    return { healthy: true, errors: [] };
  }

  const errors: string[] = [];
  const { readFile: readFileFn } = await import('node:fs/promises');

  for (const runtime of targets.runtimes) {
    const supportSubtree = targets.supportSubtrees[runtime];
    if (!supportSubtree) continue;

    // Check 1: Corpus snapshot exists and is valid
    if (corpus) {
      const destPath = corpus.destinationPaths[runtime];
      if (destPath) {
        if (!existsSync(destPath)) {
          errors.push(`[verify] ${runtime}: corpus snapshot not found at ${destPath}`);
        } else {
          try {
            const content = await readFileFn(destPath, 'utf-8');
            const parsed = JSON.parse(content);
            if (!parsed.corpusVersion) {
              errors.push(`[verify] ${runtime}: corpus snapshot at ${destPath} missing corpusVersion`);
            }
          } catch {
            errors.push(`[verify] ${runtime}: corpus snapshot at ${destPath} is not valid JSON`);
          }
        }
      }
    }

    // Check 2: MCP server binary
    const expectedServerPath = join(supportSubtree, 'mcp', 'server.js');
    if (mcpResult?.serverBinaryPaths?.[runtime]) {
      const serverPath = mcpResult.serverBinaryPaths[runtime]!;
      if (!existsSync(serverPath)) {
        errors.push(`[verify] ${runtime}: MCP server binary not found at ${serverPath}`);
      }
    } else if (existsSync(dirname(expectedServerPath))) {
      // If the mcp directory exists, the server should be there
      if (!existsSync(expectedServerPath)) {
        errors.push(`[verify] ${runtime}: MCP server binary not found at ${expectedServerPath}`);
      }
    }

    // Check 3: MCP config registration
    if (mcpResult?.configPaths?.[runtime]) {
      const configPath = mcpResult.configPaths[runtime]!;
      if (!existsSync(configPath)) {
        errors.push(`[verify] ${runtime}: MCP config not found at ${configPath}`);
      } else {
        try {
          const content = await readFileFn(configPath, 'utf-8');
          const config = JSON.parse(content);
          const mcpServers = config?.mcpServers as Record<string, unknown> | undefined;
          if (!mcpServers || !('gss-security-docs' in mcpServers)) {
            errors.push(`[verify] ${runtime}: MCP not registered in ${configPath} (missing mcpServers.gss-security-docs)`);
          }
        } catch {
          errors.push(`[verify] ${runtime}: MCP config at ${configPath} is not valid JSON`);
        }
      }
    }

    // Check 4: Runtime manifest exists and has expected fields
    const runtimeManifestPath = join(supportSubtree, 'runtime-manifest.json');
    if (!existsSync(runtimeManifestPath)) {
      errors.push(`[verify] ${runtime}: runtime manifest not found at ${runtimeManifestPath}`);
    } else {
      try {
        const content = await readFileFn(runtimeManifestPath, 'utf-8');
        const manifest = JSON.parse(content);
        if (!manifest.version || !manifest.runtime || !manifest.gssVersion) {
          errors.push(`[verify] ${runtime}: runtime manifest at ${runtimeManifestPath} missing required fields`);
        }
      } catch {
        errors.push(`[verify] ${runtime}: runtime manifest at ${runtimeManifestPath} is not valid JSON`);
      }
    }

    // Check 5: Hooks
    const hooksDir = join(supportSubtree, 'hooks');
    const expectedHookIds = runtime === 'claude'
      ? ['session-start', 'pre-tool-write', 'pre-tool-edit', 'post-tool-write']
      : [];
    if (expectedHookIds.length === 0) {
      // Runtime has no hook support.
    } else if (existsSync(hooksDir)) {
      try {
        const hookFiles = readdirSync(hooksDir).filter(f => f.endsWith('.js'));
        const foundHookIds = hookFiles.map(f => f.replace(/\.js$/, ''));
        const missingHooks = expectedHookIds.filter(h => !foundHookIds.includes(h));
        if (missingHooks.length > 0) {
          errors.push(`[verify] ${runtime}: hooks missing: ${missingHooks.join(', ')} (${foundHookIds.length}/${expectedHookIds.length} present)`);
        }
      } catch {
        errors.push(`[verify] ${runtime}: cannot read hooks directory at ${hooksDir}`);
      }
    } else {
      errors.push(`[verify] ${runtime}: hooks directory not found at ${hooksDir}`);
    }

    // Check 6: Artifact directories
    const artifactsDir = join(targets.cwd, '.gss', 'artifacts');
    const reportsDir = join(targets.cwd, '.gss', 'reports');
    if (!existsSync(artifactsDir)) {
      errors.push(`[verify] ${runtime}: artifact directory not found at ${artifactsDir}`);
    }
    if (!existsSync(reportsDir)) {
      errors.push(`[verify] ${runtime}: reports directory not found at ${reportsDir}`);
    }

    // Check 7: Manifest consistency
    if (corpus && existsSync(runtimeManifestPath)) {
      try {
        const rmContent = await readFileFn(runtimeManifestPath, 'utf-8');
        const rmParsed = JSON.parse(rmContent);
        const installManifestPath = join(targets.cwd, '.gss', 'install-manifest.json');
        if (existsSync(installManifestPath)) {
          const imContent = await readFileFn(installManifestPath, 'utf-8');
          const imParsed = JSON.parse(imContent);
          if (imParsed.corpusVersion && rmParsed.corpusVersion && imParsed.corpusVersion !== rmParsed.corpusVersion) {
            errors.push(
              `[verify] ${runtime}: corpus version mismatch — install manifest: ${imParsed.corpusVersion}, runtime manifest: ${rmParsed.corpusVersion}`
            );
          }
        }
      } catch {
        // Non-fatal — version consistency is best-effort
      }
    }
  }

  return {
    healthy: errors.length === 0,
    errors,
  };
}

// --- Internal helpers (extracted from installer.ts) ---

/**
 * Collect all output from an adapter.
 */
function collectAdapterOutput(
  adapter: RuntimeAdapter,
  workflows: WorkflowId[]
): {
  entrypointFiles: RuntimeFile[];
  supportFiles: RuntimeFile[];
  managedJsonPatches: ManagedJsonPatch[];
  managedTextBlocks: ManagedTextBlock[];
  hooks: RuntimeHook[];
} {
  const entrypointFiles: RuntimeFile[] = [];
  const supportFiles: RuntimeFile[] = [];

  // Get placeholder files
  const placeholderFiles = adapter.getPlaceholderFiles();
  for (const file of placeholderFiles) {
    if (file.category === 'support') {
      supportFiles.push(file);
    } else {
      entrypointFiles.push(file);
    }
  }

  // Get workflow files
  for (const workflow of workflows) {
    const workflowFiles = adapter.getFilesForWorkflow(workflow);
    for (const file of workflowFiles) {
      if (file.category === 'support') {
        supportFiles.push(file);
      } else {
        entrypointFiles.push(file);
      }
    }
  }

  // Get support files
  const adapterSupportFiles = adapter.getSupportFiles();
  supportFiles.push(...adapterSupportFiles);

  // Get role files via the RuntimeAdapter interface method
  for (const file of adapter.getRoleFiles()) {
    entrypointFiles.push(file);
  }

  // Get managed configs and hooks
  const managedJsonPatches = adapter.getManagedJsonPatches();
  const managedTextBlocks = adapter.getManagedTextBlocks();
  const hooks = adapter.getHooks();

  return {
    entrypointFiles,
    supportFiles,
    managedJsonPatches,
    managedTextBlocks,
    hooks,
  };
}

/**
 * Write a file safely.
 */
async function writeFileSafe(
  rootPath: string,
  file: InstallFile,
  cwd: string
): Promise<FileWriteResult> {
  const fullPath = join(rootPath, file.relativePath);
  try {
    const resolvedRoot = resolve(cwd, rootPath);
    const resolvedFull = resolve(cwd, fullPath);
    if (!isWithin(resolvedRoot, resolvedFull)) {
      throw new Error(`Path ${file.relativePath} escapes runtime root`);
    }
  } catch (error) {
    return {
      path: fullPath,
      created: false,
      merged: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const dir = dirname(fullPath);
  try {
    await mkdir(dir, { recursive: true });
    const exists = existsSync(fullPath);

    if (exists && file.merge) {
      const { readFile: readFileFn } = await import('node:fs/promises');
      const existingContent = await readFileFn(fullPath, 'utf-8');
      const existing = existingContent.trim() ? JSON.parse(existingContent) : {};
      const newContent = typeof file.content === 'string' ? JSON.parse(file.content) : file.content;
      const merged = { ...existing, ...newContent };
      await writeFile(fullPath, JSON.stringify(merged, null, 2), 'utf-8');
      return { path: fullPath, created: false, merged: true };
    }

    if (exists) {
      return { path: fullPath, created: false, merged: false };
    }

    await writeFile(fullPath, file.content, 'utf-8');
    return { path: fullPath, created: true, merged: false };
  } catch (error) {
    return {
      path: fullPath,
      created: false,
      merged: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function isWithin(parent: string, child: string): boolean {
  const relative = parent.split(/[\\/]/).length <= child.split(/[\\/]/).length;
  return relative && child.startsWith(parent);
}

function toInstallFile(file: RuntimeFile): InstallFile {
  return {
    relativePath: file.relativePath,
    content: file.content,
    merge: file.overwritePolicy === 'merge-json',
  };
}

function mockFileWrite(rootPath: string, file: InstallFile): FileWriteResult {
  const fullPath = join(rootPath, file.relativePath);
  const exists = existsSync(fullPath);
  return {
    path: fullPath,
    created: !exists,
    merged: exists && file.merge === true,
  };
}

async function applyManagedJsonPatch(
  rootPath: string,
  patch: ManagedJsonPatch,
  cwd: string
): Promise<void> {
  const fullPath = join(rootPath, patch.path);
  const resolvedRoot = resolve(cwd, rootPath);
  const resolvedFull = resolve(cwd, fullPath);
  if (!isWithin(resolvedRoot, resolvedFull)) {
    throw new Error(`Path ${patch.path} escapes runtime root`);
  }

  const { readFile: readFileFn } = await import('node:fs/promises');
  await mkdir(dirname(fullPath), { recursive: true });

  let existing: Record<string, unknown> = {};
  if (existsSync(fullPath)) {
    const content = await readFileFn(fullPath, 'utf-8');
    existing = content.trim() ? JSON.parse(content) : {};
  }

  if (patch.mergeStrategy === 'deep') {
    const keys = patch.keyPath ? patch.keyPath.split('.') : [];
    let target = existing;
    for (const key of keys.slice(0, -1)) {
      if (!(key in target)) target[key] = {};
      target = target[key] as Record<string, unknown>;
    }
    const finalKey = keys[keys.length - 1] || patch.owner;
    target[finalKey] = deepMerge(target[finalKey] as Record<string, unknown> ?? {}, patch.content);
  } else {
    Object.assign(existing, patch.content);
  }

  await writeFile(fullPath, JSON.stringify(existing, null, 2), 'utf-8');
}

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const sv = source[key];
    const tv = target[key];
    if (typeof sv === 'object' && sv !== null && !Array.isArray(sv)) {
      if (typeof tv === 'object' && tv !== null && !Array.isArray(tv)) {
        result[key] = deepMerge(tv as Record<string, unknown>, sv as Record<string, unknown>);
      } else {
        result[key] = sv;
      }
    } else {
      result[key] = sv;
    }
  }
  return result;
}

async function applyManagedTextBlock(
  rootPath: string,
  block: ManagedTextBlock,
  cwd: string
): Promise<void> {
  const fullPath = join(rootPath, block.path);
  const resolvedRoot = resolve(cwd, rootPath);
  const resolvedFull = resolve(cwd, fullPath);
  if (!isWithin(resolvedRoot, resolvedFull)) {
    throw new Error(`Path ${block.path} escapes runtime root`);
  }

  const { readFile: readFileFn } = await import('node:fs/promises');
  await mkdir(dirname(fullPath), { recursive: true });

  let content = '';
  if (existsSync(fullPath)) {
    content = await readFileFn(fullPath, 'utf-8');
  }

  const regex = new RegExp(
    `${escapeRegex(block.startMarker)}[\\s\\S]*?${escapeRegex(block.endMarker)}`,
    'g'
  );
  content = content.replace(regex, '').trim();

  const newBlock = `\n${block.startMarker}\n${block.content}\n${block.endMarker}\n`;
  content = content ? content + newBlock : newBlock.trim();

  await writeFile(fullPath, content, 'utf-8');
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function generateHookScript(hook: RuntimeHook): string {
  return `// GSS Hook: ${hook.id}
// Event: ${hook.event}
// Blocking: ${hook.blocking}
${hook.description ? `// ${hook.description}\n` : ''}

module.exports = async function(context) {
  // Hook implementation for ${hook.id}
  // Context includes: { eventName, toolName, toolInput, cwd, env }

  ${hook.command}
};
`;
}

async function mergeSettingsSafe(
  path: string,
  newContent: Record<string, unknown>,
  dryRun: boolean
): Promise<void> {
  if (dryRun) return;
  await mkdir(dirname(path), { recursive: true });
  const { readFile: readFileFn } = await import('node:fs/promises');
  let existing: Record<string, unknown> = {};
  if (existsSync(path)) {
    const content = await readFileFn(path, 'utf-8');
    existing = content.trim() ? JSON.parse(content) : {};
  }
  const merged = { ...existing, ...newContent };
  await writeFile(path, JSON.stringify(merged, null, 2), 'utf-8');
}
