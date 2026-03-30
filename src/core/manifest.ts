import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import type { InstallManifest, RuntimeTarget, WorkflowId } from './types.js';
import { getManifestPath } from './paths.js';

/** Current package version - will be replaced at build time */
const PACKAGE_VERSION = '0.1.0';

/**
 * Create a new install manifest with the given parameters.
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
 */
export async function readManifest(cwd: string): Promise<InstallManifest | null> {
  const path = getManifestPath(cwd);

  if (!existsSync(path)) {
    return null;
  }

  try {
    const content = await readFile(path, 'utf-8');
    const manifest = JSON.parse(content) as InstallManifest;

    // Basic validation
    if (!manifest.version || !manifest.installedAt || !Array.isArray(manifest.runtimes)) {
      return null;
    }

    return manifest;
  } catch {
    return null;
  }
}

/**
 * Write a manifest to disk.
 * Creates the .gss directory if it doesn't exist.
 */
export async function writeManifest(cwd: string, manifest: InstallManifest): Promise<void> {
  const { mkdir } = await import('node:fs/promises');
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
 */
export function mergeManifest(
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
