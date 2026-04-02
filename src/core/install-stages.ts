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

import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
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
} from './types.js';
import { loadCorpusSnapshot, type LoadedSnapshot } from '../corpus/snapshot-loader.js';
import { isCorpusSnapshot } from '../corpus/schema.js';

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
 * Writes commands/agents, hooks, support files, and optionally copies the corpus snapshot.
 * When `legacySpecialists` is true, true, also fetches and generates specialist prompt files.
 */
export async function installRuntimeArtifacts(
  targets: TargetDetection,
  adapters: RuntimeAdapter[],
  corpus: CorpusResolution | null,
  options: { dryRun: boolean; legacySpecialists?: boolean; specialists?: unknown[] }
): Promise<InstalledArtifacts> {
  const { dryRun, legacySpecialists = false, specialists = [] } = options;
  const errors: string[] = [];
  const filesByRuntime: Partial<Record<RuntimeTarget, string[]>> = {};
  const rootsByRuntime: Partial<Record<RuntimeTarget, string>> = {};
  const managedConfigsByRuntime: Partial<Record<RuntimeTarget, ManagedConfigRecord[]>> = {};
  const hooksByRuntime: Partial<Record<RuntimeTarget, string[]>> = {};
  const runtimeManifestPaths: Partial<Record<RuntimeTarget, string>> = {};
  let totalFilesCreated = 0;

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
    const collected = collectAdapterOutput(
      adapter,
      specialists,
      DEFAULT_WORKFLOWS,
      legacySpecialists ?? false
    );
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
          mcpServerPath: corpus ? join(supportSubtreePath, 'mcp', 'server.js') : null,
          mcpConfigPath: join(rootPath, 'settings.json'),
          gssVersion: '0.1.0',
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
 * Stage 4: Verify the installation.
 */
export async function verifyInstall(
  targets: TargetDetection,
  corpus: CorpusResolution | null,
  options: { dryRun: boolean }
): Promise<VerificationResult> {
  if (options.dryRun) {
    return { healthy: true, errors: [] };
  }

  const errors: string[] = [];

  // Check corpus snapshot exists at destinations
  if (corpus) {
    for (const [runtime, destPath] of Object.entries(corpus.destinationPaths)) {
      if (!existsSync(destPath)) {
        errors.push(`${runtime}: Corpus snapshot not found at ${destPath}`);
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
  specialists: unknown[],
  workflows: WorkflowId[],
  legacySpecialists: boolean
): {
  entrypointFiles: RuntimeFile[];
  supportFiles: RuntimeFile[];
  managedJsonPatches: ManagedJsonPatch[];
  managedTextBlocks: ManagedTextBlock[];
  hooks: RuntimeHook[];
} {
  const entrypointFiles: RuntimeFile[] = [];
  const supportFiles: RuntimeFile[] = [];

  // Only inject specialists when legacy mode is active
  if (legacySpecialists) {
    const adapterWithExtras = adapter as unknown as {
      setSpecialists(specialists: unknown[]): void;
    };
    if (typeof adapterWithExtras.setSpecialists === 'function') {
      adapterWithExtras.setSpecialists(specialists);
    }
  }

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

  // Get specialist files only in legacy mode
  if (legacySpecialists) {
    const adapterWithExtras = adapter as unknown as {
      getSpecialistFiles?: () => InstallFile[];
    };
    if (typeof adapterWithExtras.getSpecialistFiles === 'function') {
      const specialistFiles = adapterWithExtras.getSpecialistFiles() ?? [];
      for (const file of specialistFiles) {
        entrypointFiles.push({
          relativePath: file.relativePath,
          content: file.content,
          category: 'entrypoint',
          overwritePolicy: file.merge ? 'merge-json' : 'create-only',
        });
      }
    }
  }

  // Get role agent/skill files
  const adapterWithRoles = adapter as unknown as {
    getRoleAgentFiles?: () => RuntimeFile[];
    getRoleSkillFiles?: () => RuntimeFile[];
  };
  if (typeof adapterWithRoles.getRoleAgentFiles === 'function') {
    entrypointFiles.push(...(adapterWithRoles.getRoleAgentFiles() ?? []));
  }
  if (typeof adapterWithRoles.getRoleSkillFiles === 'function') {
    entrypointFiles.push(...(adapterWithRoles.getRoleSkillFiles() ?? []));
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
