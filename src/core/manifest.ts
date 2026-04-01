import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import type {
  InstallManifest,
  InstallManifestV2,
  RuntimeTarget,
  WorkflowId,
  ManagedConfigRecord,
} from './types.js';
import { getManifestPath } from './paths.js';

/** Current package version - will be replaced at build time */
const PACKAGE_VERSION = '0.1.0';

/** Current manifest format version */
export const MANIFEST_VERSION = 2;

/**
 * Create a new v2 install manifest with the given parameters.
 */
export function createManifestV2(
  runtimes: RuntimeTarget[],
  scope: InstallManifestV2['scope'],
  workflows: WorkflowId[],
  roots: Partial<Record<RuntimeTarget, string>>,
  files: Partial<Record<RuntimeTarget, string[]>>,
  managedConfigs?: Partial<Record<RuntimeTarget, ManagedConfigRecord[]>>,
  hooks?: Partial<Record<RuntimeTarget, string[]>>,
  runtimeManifests?: Partial<Record<RuntimeTarget, string>>,
  corpusVersion?: string
): InstallManifestV2 {
  const now = new Date().toISOString();
  return {
    manifestVersion: 2,
    packageVersion: PACKAGE_VERSION,
    corpusVersion: corpusVersion ?? 'unknown',
    installedAt: now,
    updatedAt: now,
    scope,
    runtimes: [...new Set(runtimes)],
    workflowIds: [...new Set(workflows)],
    roots,
    files,
    managedConfigs: managedConfigs ?? {},
    hooks: hooks ?? {},
    runtimeManifests: runtimeManifests ?? {},
  };
}

/**
 * Create a new install manifest with the given parameters (legacy v1).
 * @deprecated Use createManifestV2 for new installs.
 */
export function createManifest(
  runtimes: RuntimeTarget[],
  scope: InstallManifest['scope'],
  workflows: WorkflowId[],
  roots: Partial<Record<RuntimeTarget, string>>,
  files: Partial<Record<RuntimeTarget, string[]>>
): InstallManifest {
  return {
    version: PACKAGE_VERSION,
    installedAt: new Date().toISOString(),
    scope,
    runtimes: [...new Set(runtimes)],
    workflows: [...new Set(workflows)],
    roots,
    files,
  };
}

/**
 * Read an existing manifest from disk.
 * Returns null if manifest doesn't exist or is invalid.
 * Supports both v1 and v2 manifest formats.
 */
export async function readManifest(cwd: string): Promise<InstallManifest | InstallManifestV2 | null> {
  const path = getManifestPath(cwd);

  if (!existsSync(path)) {
    return null;
  }

  try {
    const content = await readFile(path, 'utf-8');
    const manifest = JSON.parse(content);

    // Check for v2 manifest
    if (manifest.manifestVersion === 2) {
      return validateManifestV2(manifest as InstallManifestV2);
    }

    // Treat as v1 manifest
    return validateManifestV1(manifest as InstallManifest);
  } catch {
    return null;
  }
}

/**
 * Validate a v2 manifest.
 */
function validateManifestV2(manifest: InstallManifestV2): InstallManifestV2 | null {
  if (
    !manifest.packageVersion ||
    !manifest.installedAt ||
    !Array.isArray(manifest.runtimes) ||
    !Array.isArray(manifest.workflowIds)
  ) {
    return null;
  }
  return manifest;
}

/**
 * Validate a v1 manifest.
 */
function validateManifestV1(manifest: InstallManifest): InstallManifest | null {
  if (!manifest.version || !manifest.installedAt || !Array.isArray(manifest.runtimes)) {
    return null;
  }
  return manifest;
}

/**
 * Write a manifest to disk.
 * Creates the .gss directory if it doesn't exist.
 */
export async function writeManifest(cwd: string, manifest: InstallManifest | InstallManifestV2): Promise<void> {
  const path = getManifestPath(cwd);

  // Ensure .gss directory exists
  await mkdir(getPathDir(path), { recursive: true });

  await writeFile(path, JSON.stringify(manifest, null, 2), 'utf-8');
}

/**
 * Get the directory part of a path.
 * Helper function since we can't use dirname from paths everywhere.
 */
function getPathDir(path: string): string {
  const sep = path.includes('/') ? '/' : '\\';
  const lastSep = path.lastIndexOf(sep);
  return lastSep >= 0 ? path.substring(0, lastSep) : '.';
}

/**
 * Merge new files into an existing manifest.
 * Used for reinstall/additional runtime installs.
 * Supports both v1 and v2 manifests.
 */
export function mergeManifest(
  existing: InstallManifest | InstallManifestV2,
  newRuntimes: RuntimeTarget[],
  newWorkflows: WorkflowId[],
  newFiles: Partial<Record<RuntimeTarget, string[]>>,
  newRoots: Partial<Record<RuntimeTarget, string>>,
  newManagedConfigs?: Partial<Record<RuntimeTarget, ManagedConfigRecord[]>>,
  newHooks?: Partial<Record<RuntimeTarget, string[]>>,
  newRuntimeManifests?: Partial<Record<RuntimeTarget, string>>
): InstallManifest | InstallManifestV2 {
  // Check if existing is v2
  if ('manifestVersion' in existing && existing.manifestVersion === 2) {
    return mergeManifestV2(
      existing as InstallManifestV2,
      newRuntimes,
      newWorkflows,
      newFiles,
      newRoots,
      newManagedConfigs,
      newHooks,
      newRuntimeManifests
    );
  }

  // V1 merge
  return mergeManifestV1(existing as InstallManifest, newRuntimes, newWorkflows, newFiles, newRoots);
}

/**
 * Merge v2 manifests.
 */
function mergeManifestV2(
  existing: InstallManifestV2,
  newRuntimes: RuntimeTarget[],
  newWorkflows: WorkflowId[],
  newFiles: Partial<Record<RuntimeTarget, string[]>>,
  newRoots: Partial<Record<RuntimeTarget, string>>,
  newManagedConfigs?: Partial<Record<RuntimeTarget, ManagedConfigRecord[]>>,
  newHooks?: Partial<Record<RuntimeTarget, string[]>>,
  newRuntimeManifests?: Partial<Record<RuntimeTarget, string>>
): InstallManifestV2 {
  const mergedRuntimes = [...new Set([...existing.runtimes, ...newRuntimes])];
  const mergedWorkflows = [...new Set([...existing.workflowIds, ...newWorkflows])];
  const mergedRoots = { ...existing.roots, ...newRoots };
  const mergedFiles: Partial<Record<RuntimeTarget, string[]>> = { ...existing.files };
  const mergedManagedConfigs: Partial<Record<RuntimeTarget, ManagedConfigRecord[]>> = {
    ...existing.managedConfigs,
  };
  const mergedHooks: Partial<Record<RuntimeTarget, string[]>> = { ...existing.hooks };
  const mergedRuntimeManifests: Partial<Record<RuntimeTarget, string>> = {
    ...existing.runtimeManifests,
  };

  for (const [runtime, files] of Object.entries(newFiles)) {
    const rt = runtime as RuntimeTarget;
    const existingFiles = mergedFiles[rt] ?? [];
    mergedFiles[rt] = [...new Set([...existingFiles, ...files])];
  }

  if (newManagedConfigs) {
    for (const [runtime, configs] of Object.entries(newManagedConfigs)) {
      const rt = runtime as RuntimeTarget;
      const existingConfigs = mergedManagedConfigs[rt] ?? [];
      mergedManagedConfigs[rt] = [...new Set([...existingConfigs, ...configs])];
    }
  }

  if (newHooks) {
    for (const [runtime, hookPaths] of Object.entries(newHooks)) {
      const rt = runtime as RuntimeTarget;
      const existingHooks = mergedHooks[rt] ?? [];
      mergedHooks[rt] = [...new Set([...existingHooks, ...hookPaths])];
    }
  }

  if (newRuntimeManifests) {
    Object.assign(mergedRuntimeManifests, newRuntimeManifests);
  }

  return {
    ...existing,
    runtimes: mergedRuntimes,
    workflowIds: mergedWorkflows,
    roots: mergedRoots,
    files: mergedFiles,
    managedConfigs: mergedManagedConfigs,
    hooks: mergedHooks,
    runtimeManifests: mergedRuntimeManifests,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Merge v1 manifests.
 * @deprecated Use mergeManifestV2 for new installs.
 */
function mergeManifestV1(
  existing: InstallManifest,
  newRuntimes: RuntimeTarget[],
  newWorkflows: WorkflowId[],
  newFiles: Partial<Record<RuntimeTarget, string[]>>,
  newRoots: Partial<Record<RuntimeTarget, string>>
): InstallManifest {
  const mergedRuntimes = [...new Set([...existing.runtimes, ...newRuntimes])];
  const mergedWorkflows = [...new Set([...existing.workflows, ...newWorkflows])];
  const mergedRoots = { ...existing.roots, ...newRoots };
  const mergedFiles: Partial<Record<RuntimeTarget, string[]>> = { ...existing.files };

  for (const [runtime, files] of Object.entries(newFiles)) {
    const rt = runtime as RuntimeTarget;
    const existingFiles = mergedFiles[rt] ?? [];
    mergedFiles[rt] = [...new Set([...existingFiles, ...files])];
  }

  return {
    ...existing,
    runtimes: mergedRuntimes,
    workflows: mergedWorkflows,
    roots: mergedRoots,
    files: mergedFiles,
  };
}

/**
 * Delete the manifest file.
 * Used for uninstall.
 */
export async function deleteManifest(cwd: string): Promise<void> {
  const { unlink } = await import('node:fs/promises');
  const path = getManifestPath(cwd);

  if (existsSync(path)) {
    await unlink(path);
  }
}
