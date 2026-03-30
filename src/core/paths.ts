import { relative, join } from 'node:path';
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
