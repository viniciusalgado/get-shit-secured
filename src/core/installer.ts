import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type {
  FileWriteResult,
  InstallFile,
  InstallManifest,
  InstallResult,
  InstallScope,
  RuntimeAdapter,
  RuntimeTarget,
  WorkflowId,
} from './types.js';
import { resolveRuntimeRoot } from './paths.js';
import { createManifest, readManifest, writeManifest, mergeManifest, deleteManifest } from './manifest.js';
import { fetchAllCheatSheets } from './owasp-ingestion.js';
import { generateAllSpecialists } from './specialist-generator.js';

/**
 * Default workflows to install if none specified.
 */
const DEFAULT_WORKFLOWS: WorkflowId[] = [
  'map-codebase',
  'threat-model',
  'audit',
  'verify',
  'remediate',
  'report',
];

/**
 * Main installer function.
 * Orchestrates the installation of runtime adapters and workflows.
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
  let totalFilesCreated = 0;

  // Generate OWASP specialists (in background, don't block install)
  const corpus = await fetchAllCheatSheets();
  const specialists = generateAllSpecialists(corpus);

  for (const adapter of adapters) {
    const runtime = adapter.runtime;
    const rootPath = adapter.resolveRootPath(scope, cwd);
    rootsByRuntime[runtime] = rootPath;

    const files: InstallFile[] = [];

    // Set specialists on adapter (if supported) BEFORE getting placeholder files
    // This allows placeholder files to include specialist README
    const adapterWithSpecialists = adapter as unknown as {
      setSpecialists(specialists: unknown[]): void;
      getSpecialistFiles(): InstallFile[];
    };

    if (typeof adapterWithSpecialists.setSpecialists === 'function') {
      adapterWithSpecialists.setSpecialists(specialists);
    }

    // Add placeholder files for the runtime itself (now includes specialist README if specialists are set)
    files.push(...adapter.getPlaceholderFiles());

    // Add files for each workflow
    for (const workflow of DEFAULT_WORKFLOWS) {
      files.push(...adapter.getFilesForWorkflow(workflow));
    }

    // Add specialist files
    if (typeof adapterWithSpecialists.getSpecialistFiles === 'function') {
      const specialistFiles = adapterWithSpecialists.getSpecialistFiles();
      files.push(...specialistFiles);
    }

    const runtimeFilePaths: string[] = [];

    // Write files
    for (const file of files) {
      const result = dryRun
        ? mockFileWrite(rootPath, file)
        : await writeFileSafe(rootPath, file);

      if (result.error) {
        errors.push(`${runtime}/${file.relativePath}: ${result.error}`);
      } else if (result.created || result.merged) {
        totalFilesCreated++;
        runtimeFilePaths.push(join(rootPath, file.relativePath));
      }
    }

    // Handle settings merge if supported
    const settingsMerge = adapter.getSettingsMerge?.();
    if (settingsMerge) {
      const settingsPath = join(rootPath, settingsMerge.path);
      await mergeSettingsSafe(settingsPath, settingsMerge.content, dryRun);
    }

    filesByRuntime[runtime] = runtimeFilePaths;
  }

  // Write or merge manifest
  let manifest: InstallManifest | null = null;

  if (!dryRun) {
    const existing = await readManifest(cwd);
    const runtimeTargets = adapters.map((a) => a.runtime);

    if (existing) {
      manifest = mergeManifest(existing, runtimeTargets, DEFAULT_WORKFLOWS, filesByRuntime, rootsByRuntime);
    } else {
      manifest = createManifest(runtimeTargets, scope, DEFAULT_WORKFLOWS, rootsByRuntime, filesByRuntime);
    }

    await writeManifest(cwd, manifest);
  } else {
    // Dry run - create manifest but don't write it
    manifest = createManifest(adapters.map((a) => a.runtime), scope, DEFAULT_WORKFLOWS, rootsByRuntime, filesByRuntime);
  }

  return {
    success: errors.length === 0,
    manifest,
    filesCreated: totalFilesCreated,
    errors,
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
 * Currently reserved for future implementation.
 */
export async function uninstall(cwd: string, dryRun: boolean = false): Promise<InstallResult> {
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

  const { unlink } = await import('node:fs/promises');

  for (const [runtime, files] of Object.entries(manifest.files)) {
    for (const file of files ?? []) {
      if (!dryRun) {
        try {
          if (existsSync(file)) {
            await unlink(file);
            filesRemoved++;
          }
        } catch (error) {
          errors.push(`${file}: ${error instanceof Error ? error.message : String(error)}`);
        }
      } else {
        if (existsSync(file)) {
          filesRemoved++;
        }
      }
    }
  }

  // Remove manifest
  if (!dryRun) {
    await deleteManifest(cwd);
  }

  return {
    success: errors.length === 0,
    manifest,
    filesCreated: filesRemoved,
    errors,
  };
}
