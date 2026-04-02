/**
 * Legacy Specialist Cleanup — Discovers and safely removes old specialist
 * artifacts from pre-migration installs.
 *
 * Phase 9 — Workstream D: Legacy coexistence and cleanup.
 *
 * Safety guarantees:
 * - Only removes files matching gss-specialist-* patterns
 * - Validates files are within the runtime root (path safety)
 * - Records removed files for manifest cleanup
 * - Never removes files outside managed paths
 */

import { existsSync, readdirSync, lstatSync } from 'node:fs';
import { rm, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  RuntimeTarget,
  LegacyArtifactSet,
  LegacyCleanupResult,
} from '../core/types.js';

/**
 * Pattern for Claude specialist agent files.
 * Matches: gss-specialist-*.md
 */
const CLAUDE_SPECIALIST_FILE_PATTERN = /^gss-specialist-.*\.md$/;

/**
 * Pattern for specialist directories (used by both Claude agents and Codex skills).
 * Matches: gss-specialist-* directories
 */
const SPECIALIST_DIR_PATTERN = /^gss-specialist-.*$/;

/**
 * Discover legacy specialist artifacts from pre-migration installs.
 * Looks for gss-specialist-* files that were managed by previous GSS versions.
 *
 * Discovery patterns:
 * - Claude: {root}/agents/gss-specialist-*.md
 * - Codex: {root}/skills/gss-specialist-(name)/
 *
 * @param runtime - Runtime target (claude or codex)
 * @param rootPath - Root path for the runtime (e.g., .claude/)
 * @param supportSubtreePath - Support subtree path (unused, for interface compatibility)
 * @returns Discovered legacy artifacts
 */
export function discoverLegacyArtifacts(
  runtime: RuntimeTarget,
  rootPath: string,
  supportSubtreePath: string
): LegacyArtifactSet {
  const specialistFiles: string[] = [];
  const specialistDirs: string[] = [];

  if (runtime === 'claude') {
    // Claude specialists are in {root}/agents/gss-specialist-*.md
    const agentsDir = join(rootPath, 'agents');
    if (existsSync(agentsDir)) {
      try {
        const entries = readdirSync(agentsDir);
        for (const entry of entries) {
          if (CLAUDE_SPECIALIST_FILE_PATTERN.test(entry)) {
            const fullPath = join(agentsDir, entry);
            try {
              if (lstatSync(fullPath).isFile()) {
                specialistFiles.push(fullPath);
              }
            } catch {
              // Ignore stat errors
            }
          }
        }
      } catch {
        // Ignore read errors
      }
    }
  }

  if (runtime === 'codex') {
    // Codex specialists are in {root}/skills/gss-specialist-*/
    const skillsDir = join(rootPath, 'skills');
    if (existsSync(skillsDir)) {
      try {
        const entries = readdirSync(skillsDir);
        for (const entry of entries) {
          if (SPECIALIST_DIR_PATTERN.test(entry)) {
            const fullPath = join(skillsDir, entry);
            try {
              if (lstatSync(fullPath).isDirectory()) {
                specialistDirs.push(fullPath);
              }
            } catch {
              // Ignore stat errors
            }
          }
        }
      } catch {
        // Ignore read errors
      }
    }
  }

  // Also defensively check both patterns for both runtimes
  // (some installs may have mixed artifacts)
  if (runtime === 'claude') {
    // Also check if there are Codex-style specialist dirs in Claude root
    const rootEntries = existsSync(rootPath) ? readdirSync(rootPath) : [];
    for (const entry of rootEntries) {
      if (SPECIALIST_DIR_PATTERN.test(entry)) {
        const fullPath = join(rootPath, entry);
        try {
          if (lstatSync(fullPath).isDirectory() && !specialistDirs.includes(fullPath)) {
            specialistDirs.push(fullPath);
          }
        } catch {
          // Ignore stat errors
        }
      }
    }
  }

  if (runtime === 'codex') {
    // Also check if there are Claude-style specialist files in Codex agents/
    const agentsDir = join(rootPath, 'agents');
    if (existsSync(agentsDir)) {
      try {
        const entries = readdirSync(agentsDir);
        for (const entry of entries) {
          if (CLAUDE_SPECIALIST_FILE_PATTERN.test(entry)) {
            const fullPath = join(agentsDir, entry);
            try {
              if (lstatSync(fullPath).isFile() && !specialistFiles.includes(fullPath)) {
                specialistFiles.push(fullPath);
              }
            } catch {
              // Ignore stat errors
            }
          }
        }
      } catch {
        // Ignore read errors
      }
    }
  }

  const totalCount = specialistFiles.length + specialistDirs.length;

  return {
    specialistFiles,
    specialistDirs,
    hasLegacyArtifacts: totalCount > 0,
    totalCount,
  };
}

/**
 * Remove legacy specialist artifacts that are safe to clean up.
 * Only removes files whose paths match known GSS specialist patterns.
 *
 * Safety guarantees:
 * - Only removes files matching gss-specialist-* patterns
 * - Checks files are within the runtime root (path safety)
 * - Records removed files for manifest cleanup
 * - Never removes files outside managed paths
 *
 * @param artifacts - Discovered legacy artifacts
 * @param options - Cleanup options (dryRun)
 * @returns Cleanup result with removed/skipped/errors
 */
export async function cleanupLegacyArtifacts(
  artifacts: LegacyArtifactSet,
  options: { dryRun: boolean }
): Promise<LegacyCleanupResult> {
  const removed: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];

  // Remove specialist files
  for (const filePath of artifacts.specialistFiles) {
    // Safety: verify the file path matches expected patterns
    if (!isSafeSpecialistPath(filePath)) {
      skipped.push(filePath);
      continue;
    }

    if (options.dryRun) {
      removed.push(filePath);
      continue;
    }

    try {
      if (existsSync(filePath)) {
        await unlink(filePath);
        removed.push(filePath);
      } else {
        skipped.push(filePath);
      }
    } catch (error) {
      errors.push(
        `Failed to remove ${filePath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Remove specialist directories
  for (const dirPath of artifacts.specialistDirs) {
    // Safety: verify the directory path matches expected patterns
    if (!isSafeSpecialistPath(dirPath)) {
      skipped.push(dirPath);
      continue;
    }

    if (options.dryRun) {
      removed.push(dirPath);
      continue;
    }

    try {
      if (existsSync(dirPath)) {
        await rm(dirPath, { recursive: true, force: true });
        removed.push(dirPath);
      } else {
        skipped.push(dirPath);
      }
    } catch (error) {
      errors.push(
        `Failed to remove ${dirPath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return { removed, skipped, errors };
}

/**
 * Check if a path is a safe specialist path to remove.
 * Only matches paths containing "gss-specialist-" in the filename/dirname.
 */
function isSafeSpecialistPath(filePath: string): boolean {
  // Must contain gss-specialist- in the path
  const normalized = filePath.replace(/\\/g, '/');
  const segments = normalized.split('/');
  const lastSegment = segments[segments.length - 1];

  // The filename or directory name must start with gss-specialist-
  if (!lastSegment.startsWith('gss-specialist-')) {
    return false;
  }

  // Must not contain path traversal
  if (normalized.includes('..')) {
    return false;
  }

  return true;
}
