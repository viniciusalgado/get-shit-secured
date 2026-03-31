import { mkdir, writeFile, readFile, unlink, rm } from 'node:fs/promises';
import { existsSync, lstatSync } from 'node:fs';
import { join, dirname, relative, resolve } from 'node:path';
import type {
  FileWriteResult,
  InstallFile,
  InstallManifest,
  InstallManifestV2,
  InstallResult,
  InstallScope,
  RuntimeAdapter,
  RuntimeTarget,
  WorkflowId,
  ManagedConfigRecord,
  RuntimeFile,
  ManagedJsonPatch,
  ManagedTextBlock,
  RuntimeHook,
} from './types.js';
import {
  resolveRuntimeRoot,
  resolveSupportSubtree,
  getRuntimeManifestPath,
  getHooksDir,
  validatePath,
  validateManifestPath,
  isWithin,
} from './paths.js';
import {
  createManifest,
  createManifestV2,
  readManifest,
  writeManifest,
  mergeManifest,
  deleteManifest,
  MANIFEST_VERSION,
} from './manifest.js';
import { fetchAllCheatSheets } from './owasp-ingestion.js';
import { generateAllSpecialists } from './specialist-generator.js';

/**
 * Default workflows to install if none specified.
 */
const DEFAULT_WORKFLOWS: WorkflowId[] = [
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
 * Sensitive file patterns that should be protected by default.
 */
const SENSITIVE_PATTERNS = [
  '.env',
  '*.pem',
  '*.key',
  'secrets/',
  'credentials/',
  '.aws/credentials',
  '.docker/config.json',
];

/**
 * Main installer function with staged pipeline.
 * Orchestrates the installation of runtime adapters and workflows.
 *
 * Pipeline stages:
 * 1. Resolve runtime root
 * 2. Validate all target paths
 * 3. Collect entrypoint files, support files, and managed config declarations
 * 4. Create support subtree
 * 5. Write support files
 * 6. Write entrypoint files
 * 7. Apply managed JSON merges
 * 8. Apply managed text blocks
 * 9. Register hooks
 * 10. Write runtime manifest
 * 11. Update top-level .gss/install-manifest.json
 */
export async function install(
  adapters: RuntimeAdapter[],
  scope: InstallScope,
  cwd: string,
  dryRun: boolean = false
): Promise<InstallResult> {
  const errors: string[] = [];
  const filesByRuntime: Partial<Record<RuntimeTarget, string[]>> = {};
  const rootsByRuntime: Partial<Record<RuntimeTarget, string>> = {};
  const managedConfigsByRuntime: Partial<Record<RuntimeTarget, ManagedConfigRecord[]>> = {};
  const hooksByRuntime: Partial<Record<RuntimeTarget, string[]>> = {};
  const runtimeManifestPaths: Partial<Record<RuntimeTarget, string>> = {};
  let totalFilesCreated = 0;

  // Generate OWASP specialists (in background, don't block install)
  const corpus = await fetchAllCheatSheets();
  const specialists = generateAllSpecialists(corpus);

  for (const adapter of adapters) {
    const runtime = adapter.runtime;

    // Stage 1: Resolve runtime root
    const rootPath = adapter.resolveRootPath(scope, cwd);
    const supportSubtreePath = adapter.resolveSupportSubtree(scope, cwd);

    rootsByRuntime[runtime] = rootPath;

    // Stage 2: Validate all paths
    try {
      validateInstallPaths(rootPath, supportSubtreePath, cwd);
    } catch (error) {
      errors.push(`${runtime}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }

    // Stage 3: Collect all files and configs
    const collected = await collectAdapterOutput(adapter, specialists, DEFAULT_WORKFLOWS);
    const { entrypointFiles, supportFiles, managedJsonPatches, managedTextBlocks, hooks } = collected;

    const runtimeFilePaths: string[] = [];

    // Stage 4: Create support subtree
    if (!dryRun) {
      try {
        await mkdir(supportSubtreePath, { recursive: true });
      } catch (error) {
        errors.push(`${runtime}: Failed to create support subtree: ${error}`);
        continue;
      }
    }

    // Stage 5: Write support files
    for (const file of supportFiles) {
      const result = dryRun
        ? mockFileWrite(supportSubtreePath, toInstallFile(file))
        : await writeFileWithPathValidation(supportSubtreePath, file, cwd);

      if (result.error) {
        errors.push(`${runtime}/gss/${file.relativePath}: ${result.error}`);
      } else if (result.created || result.merged) {
        totalFilesCreated++;
        runtimeFilePaths.push(join(supportSubtreePath, file.relativePath));
      }
    }

    // Stage 6: Write entrypoint files
    for (const file of entrypointFiles) {
      const result = dryRun
        ? mockFileWrite(rootPath, toInstallFile(file))
        : await writeFileWithPathValidation(rootPath, file, cwd);

      if (result.error) {
        errors.push(`${runtime}/${file.relativePath}: ${result.error}`);
      } else if (result.created || result.merged) {
        totalFilesCreated++;
        runtimeFilePaths.push(join(rootPath, file.relativePath));
      }
    }

    // Stage 7: Apply managed JSON merges
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
        await applyManagedJsonPatch(rootPath, patch, cwd);
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
    managedConfigsByRuntime[runtime] = jsonConfigRecords;

    // Stage 8: Apply managed text blocks
    for (const block of managedTextBlocks) {
      if (dryRun) {
        jsonConfigRecords.push({
          path: join(rootPath, block.path),
          owner: block.owner,
          type: 'text-block',
        });
        continue;
      }

      try {
        await applyManagedTextBlock(rootPath, block, cwd);
        if (!jsonConfigRecords.some(r => r.path === join(rootPath, block.path))) {
          jsonConfigRecords.push({
            path: join(rootPath, block.path),
            owner: block.owner,
            type: 'text-block',
          });
        }
      } catch (error) {
        errors.push(`${runtime}: Failed to apply text block to ${block.path}: ${error}`);
      }
    }

    // Stage 9: Register hooks
    const hooksDir = getHooksDir(runtime, scope, cwd);
    const registeredHookPaths: string[] = [];

    if (!dryRun) {
      try {
        await mkdir(hooksDir, { recursive: true });
      } catch (error) {
        errors.push(`${runtime}: Failed to create hooks directory: ${error}`);
      }
    }

    for (const hook of hooks) {
      const hookFilePath = join(hooksDir, `${hook.id}.js`);
      const hookContent = generateHookScript(hook);

      if (!dryRun) {
        try {
          await writeFile(hookFilePath, hookContent, 'utf-8');
          registeredHookPaths.push(hookFilePath);
        } catch (error) {
          errors.push(`${runtime}: Failed to write hook ${hook.id}: ${error}`);
        }
      } else {
        registeredHookPaths.push(hookFilePath);
      }
    }
    hooksByRuntime[runtime] = registeredHookPaths;

    // Stage 10: Write runtime manifest
    const runtimeManifestPath = getRuntimeManifestPath(runtime, scope, cwd);
    runtimeManifestPaths[runtime] = runtimeManifestPath;

    if (!dryRun) {
      try {
        const runtimeManifest = {
          runtime,
          scope,
          installedAt: new Date().toISOString(),
          version: '0.1.0',
          hooks: hooks.map(h => h.id),
          managedConfigs: jsonConfigRecords.map(r => r.path),
        };
        await writeFile(runtimeManifestPath, JSON.stringify(runtimeManifest, null, 2), 'utf-8');
      } catch (error) {
        errors.push(`${runtime}: Failed to write runtime manifest: ${error}`);
      }
    }

    // Handle legacy settings merge if supported and managed patches are not used
    const settingsMerge = adapter.getSettingsMerge?.();
    if (settingsMerge && managedJsonPatches.length === 0) {
      const settingsPath = join(rootPath, settingsMerge.path);
      await mergeSettingsSafe(settingsPath, settingsMerge.content, dryRun);
    }

    filesByRuntime[runtime] = runtimeFilePaths;
  }

  // Stage 11: Write or merge top-level manifest
  let manifest: InstallManifest | InstallManifestV2 | null = null;

  if (!dryRun) {
    const existing = await readManifest(cwd);
    const runtimeTargets = adapters.map((a) => a.runtime);

    if (existing) {
      manifest = mergeManifest(
        existing,
        runtimeTargets,
        DEFAULT_WORKFLOWS,
        filesByRuntime,
        rootsByRuntime,
        managedConfigsByRuntime,
        hooksByRuntime,
        runtimeManifestPaths
      );
    } else {
      manifest = createManifestV2(
        runtimeTargets,
        scope,
        DEFAULT_WORKFLOWS,
        rootsByRuntime,
        filesByRuntime,
        managedConfigsByRuntime,
        hooksByRuntime,
        runtimeManifestPaths
      );
    }

    await writeManifest(cwd, manifest);
  } else {
    // Dry run - create manifest but don't write it
    manifest = createManifestV2(
      adapters.map((a) => a.runtime),
      scope,
      DEFAULT_WORKFLOWS,
      rootsByRuntime,
      filesByRuntime,
      managedConfigsByRuntime,
      hooksByRuntime,
      runtimeManifestPaths
    );
  }

  return {
    success: errors.length === 0,
    manifest,
    filesCreated: totalFilesCreated,
    errors,
  };
}

/**
 * Validate install paths to prevent path traversal attacks.
 */
function validateInstallPaths(rootPath: string, supportSubtreePath: string, cwd: string): void {
  // Resolve root path to absolute
  const rootResolved = resolve(cwd, rootPath);

  // For local installs, ensure we're not escaping the project
  const isLocal = rootPath.startsWith('.claude') || rootPath.startsWith('.codex');
  if (isLocal && !isWithin(cwd, rootResolved)) {
    throw new Error(`Runtime root escapes project directory: ${rootPath}`);
  }

  // Ensure support subtree is within root
  const supportResolved = resolve(cwd, supportSubtreePath);
  if (!isWithin(rootResolved, supportResolved)) {
    throw new Error(`Support subtree escapes runtime root: ${supportSubtreePath}`);
  }
}

/**
 * Collect all output from an adapter.
 */
async function collectAdapterOutput(
  adapter: RuntimeAdapter,
  specialists: unknown[],
  workflows: WorkflowId[]
): Promise<{
  entrypointFiles: RuntimeFile[];
  supportFiles: RuntimeFile[];
  managedJsonPatches: ManagedJsonPatch[];
  managedTextBlocks: ManagedTextBlock[];
  hooks: RuntimeHook[];
}> {
  const entrypointFiles: RuntimeFile[] = [];
  const supportFiles: RuntimeFile[] = [];

  // Set specialists on adapter (if supported) and get specialist files
  const adapterWithExtras = adapter as unknown as {
    setSpecialists(specialists: unknown[]): void;
    getSpecialistFiles?: () => InstallFile[];
  };

  if (typeof adapterWithExtras.setSpecialists === 'function') {
    adapterWithExtras.setSpecialists(specialists);
  }

  // Get placeholder files and separate by category
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

  // Get specialist files (legacy support)
  if (typeof adapterWithExtras.getSpecialistFiles === 'function') {
    const specialistFiles = adapterWithExtras.getSpecialistFiles() ?? [];
    // Convert InstallFile[] to RuntimeFile[]
    for (const file of specialistFiles) {
      entrypointFiles.push({
        relativePath: file.relativePath,
        content: file.content,
        category: 'entrypoint' as const,
        overwritePolicy: file.merge ? 'merge-json' : 'create-only',
      });
    }
  }

  // Get role agent/skill files
  const adapterWithRoles = adapter as unknown as {
    getRoleAgentFiles?: () => RuntimeFile[];
    getRoleSkillFiles?: () => RuntimeFile[];
  };
  if (typeof adapterWithRoles.getRoleAgentFiles === 'function') {
    const roleFiles = adapterWithRoles.getRoleAgentFiles() ?? [];
    entrypointFiles.push(...roleFiles);
  }
  if (typeof adapterWithRoles.getRoleSkillFiles === 'function') {
    const roleFiles = adapterWithRoles.getRoleSkillFiles() ?? [];
    entrypointFiles.push(...roleFiles);
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
 * Write a file with path validation.
 */
async function writeFileWithPathValidation(
  rootPath: string,
  file: RuntimeFile,
  cwd: string
): Promise<FileWriteResult> {
  const fullPath = join(rootPath, file.relativePath);

  // Validate path is within root
  // We need to check that the full path is within the root path
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

  return writeFileSafe(rootPath, toInstallFile(file));
}

/**
 * Apply a managed JSON patch.
 */
async function applyManagedJsonPatch(rootPath: string, patch: ManagedJsonPatch, cwd: string): Promise<void> {
  const fullPath = join(rootPath, patch.path);

  // Validate path is within root
  const resolvedRoot = resolve(cwd, rootPath);
  const resolvedFull = resolve(cwd, fullPath);
  if (!isWithin(resolvedRoot, resolvedFull)) {
    throw new Error(`Path ${patch.path} escapes runtime root`);
  }

  const dir = dirname(fullPath);
  await mkdir(dir, { recursive: true });

  // Read existing or create new
  let existing: Record<string, unknown> = {};
  if (existsSync(fullPath)) {
    const content = await readFile(fullPath, 'utf-8');
    existing = content.trim() ? JSON.parse(content) : {};
  }

  // Apply patch based on merge strategy
  if (patch.mergeStrategy === 'deep') {
    // Deep merge at key path
    const keys = patch.keyPath ? patch.keyPath.split('.') : [];
    let target = existing;
    for (const key of keys.slice(0, -1)) {
      if (!(key in target)) {
        target[key] = {};
      }
      target = target[key] as Record<string, unknown>;
    }
    const finalKey = keys[keys.length - 1] || patch.owner;
    target[finalKey] = deepMerge(target[finalKey] as Record<string, unknown> ?? {}, patch.content);
  } else {
    // Shallow merge at root
    Object.assign(existing, patch.content);
  }

  await writeFile(fullPath, JSON.stringify(existing, null, 2), 'utf-8');
}

/**
 * Deep merge two objects.
 */
function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target };

  for (const key of Object.keys(source)) {
    const sourceValue = source[key];
    const targetValue = target[key];

    if (typeof sourceValue === 'object' && sourceValue !== null && !Array.isArray(sourceValue)) {
      if (typeof targetValue === 'object' && targetValue !== null && !Array.isArray(targetValue)) {
        result[key] = deepMerge(targetValue as Record<string, unknown>, sourceValue as Record<string, unknown>);
      } else {
        result[key] = sourceValue;
      }
    } else {
      result[key] = sourceValue;
    }
  }

  return result;
}

/**
 * Apply a managed text block.
 */
async function applyManagedTextBlock(rootPath: string, block: ManagedTextBlock, cwd: string): Promise<void> {
  const fullPath = join(rootPath, block.path);

  // Validate path is within root
  const resolvedRoot = resolve(cwd, rootPath);
  const resolvedFull = resolve(cwd, fullPath);
  if (!isWithin(resolvedRoot, resolvedFull)) {
    throw new Error(`Path ${block.path} escapes runtime root`);
  }

  const dir = dirname(fullPath);
  await mkdir(dir, { recursive: true });

  // Read existing or create new
  let content = '';
  if (existsSync(fullPath)) {
    content = await readFile(fullPath, 'utf-8');
  }

  // Remove existing managed block if present
  const regex = new RegExp(
    `${escapeRegex(block.startMarker)}[\\s\\S]*?${escapeRegex(block.endMarker)}`,
    'g'
  );
  content = content.replace(regex, '').trim();

  // Add new managed block
  const newBlock = `\n${block.startMarker}\n${block.content}\n${block.endMarker}\n`;
  content = content ? content + newBlock : newBlock.trim();

  await writeFile(fullPath, content, 'utf-8');
}

/**
 * Escape special regex characters.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Generate a hook script from definition.
 */
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

/**
 * Convert RuntimeFile to InstallFile for backward compatibility.
 */
function toInstallFile(file: RuntimeFile): InstallFile {
  return {
    relativePath: file.relativePath,
    content: file.content,
    merge: file.overwritePolicy === 'merge-json',
  };
}

/**
 * Write a single file safely, creating directories as needed.
 * Supports merging for existing config files.
 */
async function writeFileSafe(
  rootPath: string,
  file: InstallFile
): Promise<FileWriteResult> {
  const fullPath = join(rootPath, file.relativePath);
  const dir = dirname(fullPath);

  try {
    // Create directory if it doesn't exist
    await mkdir(dir, { recursive: true });

    // Check if file exists
    const exists = existsSync(fullPath);

    if (exists && file.merge) {
      // Merge with existing content
      const existingContent = await readFile(fullPath, 'utf-8');
      const existing = existingContent.trim() ? JSON.parse(existingContent) : {};
      const newContent = typeof file.content === 'string' ? JSON.parse(file.content) : file.content;

      const merged = { ...existing, ...newContent };
      await writeFile(fullPath, JSON.stringify(merged, null, 2), 'utf-8');

      return { path: fullPath, created: false, merged: true };
    }

    if (exists) {
      // File exists but merge not requested - skip
      return { path: fullPath, created: false, merged: false };
    }

    // Write new file
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

/**
 * Merge settings file safely.
 */
async function mergeSettingsSafe(
  path: string,
  newContent: Record<string, unknown>,
  dryRun: boolean
): Promise<void> {
  if (dryRun) {
    return;
  }

  const dir = dirname(path);
  await mkdir(dir, { recursive: true });

  let existing: Record<string, unknown> = {};

  if (existsSync(path)) {
    const content = await readFile(path, 'utf-8');
    existing = content.trim() ? JSON.parse(content) : {};
  }

  const merged = { ...existing, ...newContent };
  await writeFile(path, JSON.stringify(merged, null, 2), 'utf-8');
}

/**
 * Mock file write for dry-run mode.
 * Returns what would happen without actually writing.
 */
function mockFileWrite(rootPath: string, file: InstallFile): FileWriteResult {
  const fullPath = join(rootPath, file.relativePath);
  const exists = existsSync(fullPath);

  return {
    path: fullPath,
    created: !exists,
    merged: exists && file.merge === true,
  };
}

/**
 * Uninstall all installed files based on manifest.
 * Supports both v1 and v2 manifests with proper cleanup.
 */
export async function uninstall(
  cwd: string,
  dryRun: boolean = false,
  runtimes?: RuntimeTarget[]
): Promise<InstallResult> {
  const manifest = await readManifest(cwd);

  if (!manifest) {
    return {
      success: false,
      manifest: null,
      filesCreated: 0,
      errors: ['No install manifest found. Nothing to uninstall.'],
    };
  }

  const errors: string[] = [];
  let filesRemoved = 0;
  let dirsRemoved = 0;

  // Determine which runtimes to uninstall
  const targetRuntimes = runtimes ?? manifest.runtimes;

  // For v2 manifests, we have more structured data
  if ('manifestVersion' in manifest && manifest.manifestVersion === 2) {
    const v2Manifest = manifest as InstallManifestV2;

    for (const runtime of targetRuntimes) {
      // Remove files
      const files = v2Manifest.files[runtime] ?? [];
      for (const file of files) {
        try {
          const validatedPath = validateManifestPath(file, cwd);
          if (!dryRun && existsSync(validatedPath)) {
            // Check if it's a directory
            const stat = lstatSync(validatedPath);
            if (stat.isDirectory()) {
              await rm(validatedPath, { recursive: true, force: true });
              dirsRemoved++;
            } else {
              await unlink(validatedPath);
              filesRemoved++;
            }
          } else if (existsSync(validatedPath)) {
            filesRemoved++;
          }
        } catch (error) {
          errors.push(`${file}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // Remove managed config blocks
      const managedConfigs = v2Manifest.managedConfigs?.[runtime] ?? [];
      for (const config of managedConfigs) {
        if (config.type === 'text-block') {
          try {
            const validatedPath = validateManifestPath(config.path, cwd);
            if (!dryRun && existsSync(validatedPath)) {
              await removeManagedTextBlock(validatedPath, config.owner);
              filesRemoved++;
            }
          } catch (error) {
            errors.push(`${config.path}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }

      // Remove hooks directory
      const hooksDir = v2Manifest.hooks?.[runtime];
      if (hooksDir && hooksDir.length > 0) {
        const runtimeHooksPath = dirname(hooksDir[0]);
        try {
          if (!dryRun && existsSync(runtimeHooksPath)) {
            await rm(runtimeHooksPath, { recursive: true, force: true });
            dirsRemoved++;
          }
        } catch (error) {
          errors.push(`Failed to remove hooks directory: ${error}`);
        }
      }

      // Remove runtime manifest
      const runtimeManifestPath = v2Manifest.runtimeManifests?.[runtime];
      if (runtimeManifestPath) {
        try {
          const validatedPath = validateManifestPath(runtimeManifestPath, cwd);
          if (!dryRun && existsSync(validatedPath)) {
            await unlink(validatedPath);
            filesRemoved++;
          }
        } catch (error) {
          errors.push(`Failed to remove runtime manifest: ${error}`);
        }
      }
    }
  } else {
    // V1 manifest handling
    const v1Manifest = manifest as InstallManifest;

    for (const [runtime, files] of Object.entries(v1Manifest.files)) {
      if (!targetRuntimes.includes(runtime as RuntimeTarget)) continue;

      for (const file of files ?? []) {
        try {
          const validatedPath = validateManifestPath(file, cwd);
          if (!dryRun && existsSync(validatedPath)) {
            await unlink(validatedPath);
            filesRemoved++;
          } else if (existsSync(validatedPath)) {
            filesRemoved++;
          }
        } catch (error) {
          errors.push(`${file}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
  }

  // Clean up empty support subtrees
  for (const runtime of targetRuntimes) {
    const supportSubtree = join(
      resolveRuntimeRoot(runtime, manifest.scope, cwd),
      'gss'
    );
    try {
      if (!dryRun && existsSync(supportSubtree)) {
        // Check if directory is empty
        const entries = require('node:fs').readdirSync(supportSubtree);
        if (entries.length === 0) {
          await rm(supportSubtree, { recursive: true, force: true });
          dirsRemoved++;
        }
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  // Remove manifest if all runtimes are uninstalled
  const remainingRuntimes = manifest.runtimes.filter(r => !targetRuntimes.includes(r));
  if (remainingRuntimes.length === 0 && !dryRun) {
    await deleteManifest(cwd);
    // Try to remove .gss directory if empty
    const gssDir = join(cwd, '.gss');
    try {
      if (existsSync(gssDir)) {
        const entries = require('node:fs').readdirSync(gssDir);
        if (entries.length === 0) {
          await rm(gssDir, { recursive: true, force: true });
          dirsRemoved++;
        }
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  return {
    success: errors.length === 0,
    manifest,
    filesCreated: filesRemoved + dirsRemoved,
    errors,
  };
}

/**
 * Remove a managed text block from a file.
 */
async function removeManagedTextBlock(filePath: string, owner: string): Promise<void> {
  if (!existsSync(filePath)) {
    return;
  }

  const content = await readFile(filePath, 'utf-8');
  const startMarker = `// GSS: BEGIN (${owner})`;
  const endMarker = `// GSS: END (${owner})`;

  const regex = new RegExp(
    `${escapeRegex(startMarker)}[\\s\\S]*?${escapeRegex(endMarker)}\\s*`,
    'g'
  );

  const newContent = content.replace(regex, '').trim();

  if (newContent) {
    await writeFile(filePath, newContent + '\n', 'utf-8');
  } else {
    // File is now empty, delete it
    await unlink(filePath);
  }
}
