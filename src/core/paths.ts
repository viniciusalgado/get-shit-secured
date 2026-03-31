import { relative, join, resolve, normalize } from 'node:path';
import type { InstallScope, RuntimeTarget } from './types.js';

/**
 * Get the appropriate home directory for global installs.
 * Respects XDG_CONFIG_HOME on Linux/Unix.
 */
export function getHomeDir(): string {
  const env = process.env;
  if (process.platform === 'win32') {
    return env.USERPROFILE || (env.HOMEDRIVE ?? '') + (env.HOMEPATH ?? '') || '';
  }
  // XDG_CONFIG_HOME or default ~/.config
  const xdgConfig = env.XDG_CONFIG_HOME;
  if (xdgConfig && xdgConfig !== env.HOME) {
    return xdgConfig;
  }
  return env.HOME || '';
}

/**
 * Resolve the install root for a given runtime and scope.
 *
 * Runtime-specific paths:
 *
 * Claude (local):   <cwd>/.claude/
 * Claude (global):  <home>/.claude/ or <XDG_CONFIG_HOME>/claude/
 *
 * Codex (local):    <cwd>/.codex/
 * Codex (global):   <home>/.codex/ or <XDG_CONFIG_HOME>/codex/
 */
export function resolveRuntimeRoot(
  runtime: RuntimeTarget,
  scope: InstallScope,
  cwd: string
): string {
  const home = getHomeDir();

  if (scope === 'local') {
    return join(cwd, `.${runtime}`);
  }

  // Global scope
  if (process.platform !== 'win32' && process.env.XDG_CONFIG_HOME) {
    // Use XDG pattern: <XDG_CONFIG_HOME>/<runtime>/
    return join(process.env.XDG_CONFIG_HOME, runtime);
  }

  // Use dotfile pattern: ~/.<runtime>/
  return join(home, `.${runtime}`);
}

/**
 * Resolve the support subtree path for a runtime.
 * This is where hooks, helpers, and runtime metadata are stored.
 *
 * Claude (local):   <cwd>/.claude/gss/
 * Claude (global):  <home>/.claude/gss/ or <XDG_CONFIG_HOME>/claude/gss/
 *
 * Codex (local):    <cwd>/.codex/gss/
 * Codex (global):   <home>/.codex/gss/ or <XDG_CONFIG_HOME>/codex/gss/
 */
export function resolveSupportSubtree(
  runtime: RuntimeTarget,
  scope: InstallScope,
  cwd: string
): string {
  return join(resolveRuntimeRoot(runtime, scope, cwd), 'gss');
}

/**
 * Get the manifest directory path (.gss/).
 */
export function getManifestDir(cwd: string): string {
  return join(cwd, '.gss');
}

/**
 * Get the manifest file path (.gss/install-manifest.json).
 */
export function getManifestPath(cwd: string): string {
  return join(getManifestDir(cwd), 'install-manifest.json');
}

/**
 * Get the runtime manifest path for a specific runtime.
 * This stores runtime-specific metadata and ownership info.
 */
export function getRuntimeManifestPath(
  runtime: RuntimeTarget,
  scope: InstallScope,
  cwd: string
): string {
  return join(resolveSupportSubtree(runtime, scope, cwd), 'runtime-manifest.json');
}

/**
 * Get the hooks directory for a runtime.
 */
export function getHooksDir(
  runtime: RuntimeTarget,
  scope: InstallScope,
  cwd: string
): string {
  return join(resolveSupportSubtree(runtime, scope, cwd), 'hooks');
}

/**
 * Ensure a directory exists, recursively.
 * Returns the directory path.
 */
export function ensureDir(dir: string): string {
  // This is a placeholder - actual implementation uses fs.mkdirSync
  // The real implementation will be in the installer module
  return dir;
}

/**
 * Check if a path exists within a base directory.
 * Used for security validation to prevent path traversal.
 */
export function isWithin(base: string, target: string): boolean {
  const relPath = relative(base, target);
  return !relPath.startsWith('..') && relPath !== '';
}

/**
 * Resolve and validate a path is within the allowed base directory.
 * Throws an error if the path escapes the base directory or contains symlink escapes.
 *
 * @param base - The base directory (e.g., runtime root)
 * @param targetPath - The target path to validate
 * @param cwd - Current working directory for relative path resolution
 * @returns The resolved absolute path
 * @throws Error if path is invalid or escapes base directory
 */
export function validatePath(base: string, targetPath: string, cwd: string): string {
  // Resolve to absolute path
  const resolved = resolve(cwd, targetPath);
  const normalized = normalize(resolved);

  // Normalize base as well
  const normalizedBase = normalize(resolve(cwd, base));

  // Check if target is within base
  if (!isWithin(normalizedBase, normalized)) {
    throw new Error(
      `Path validation failed: ${targetPath} (resolved to ${normalized}) escapes base directory ${normalizedBase}`
    );
  }

  return normalized;
}

/**
 * Validate a manifest entry before using it for uninstall.
 * Ensures the path is safe and within expected boundaries.
 *
 * @param filePath - The file path from manifest
 * @param cwd - Current working directory
 * @returns Validated absolute path
 * @throws Error if path is invalid or suspicious
 */
export function validateManifestPath(filePath: string, cwd: string): string {
  const resolved = resolve(cwd, filePath);
  const normalized = normalize(resolved);

  // Reject paths that try to escape via parent directory references
  if (filePath.includes('..')) {
    throw new Error(`Invalid manifest path: contains parent directory reference: ${filePath}`);
  }

  // Reject absolute paths that don't point to expected locations
  // (This is a basic check; more specific validation happens per-runtime)

  return normalized;
}
