/**
 * Install migration utility — Safely migrates GSS install manifests
 * between rollout states.
 *
 * Phase 11 — Workstream C: Upgrade and downgrade paths.
 *
 * Supported migrations:
 *   v0.1.0 → mcp-only       (v1 manifest → v2 manifest with rolloutMode)
 *   legacy → mcp-only       (removes specialist files, updates mode)
 *   mcp-only → hybrid-shadow (enables comparison traces)
 *   hybrid-shadow → mcp-only (disables comparison traces)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type {
  InstallManifest,
  InstallManifestV2,
  RuntimeManifest,
  RolloutMode,
} from '../core/types.js';

/**
 * Migration result.
 */
export interface MigrationResult {
  /** Whether migration was performed */
  migrated: boolean;
  /** Changes applied (human-readable descriptions) */
  changes: string[];
  /** Errors encountered */
  errors: string[];
}

/**
 * Migrate an existing GSS installation to a target rollout mode.
 *
 * @param cwd - Project working directory
 * @param options - Migration options
 * @returns Migration result with changes list
 */
export async function migrateInstall(
  cwd: string,
  options: {
    targetMode: RolloutMode;
    dryRun: boolean;
  }
): Promise<MigrationResult> {
  const { targetMode, dryRun } = options;
  const changes: string[] = [];
  const errors: string[] = [];

  // Read install manifest
  const installManifestPath = join(cwd, '.gss', 'install-manifest.json');
  if (!existsSync(installManifestPath)) {
    errors.push('No install manifest found. Run: npx get-shit-secured --claude --local');
    return { migrated: false, changes, errors };
  }

  let installManifest: InstallManifest | InstallManifestV2;
  try {
    installManifest = JSON.parse(readFileSync(installManifestPath, 'utf-8'));
  } catch {
    errors.push(`Cannot parse install manifest at ${installManifestPath}`);
    return { migrated: false, changes, errors };
  }

  const isV2 = 'manifestVersion' in installManifest && (installManifest as InstallManifestV2).manifestVersion === 2;

  // Migration: v0.1.0 (v1) → v2 with rollout mode
  if (!isV2) {
    const v1 = installManifest as InstallManifest;
    if (dryRun) {
      changes.push('[dry-run] Would convert v1 install manifest to v2 format');
      changes.push(`[dry-run] Would set rolloutMode: ${targetMode}`);
      return { migrated: false, changes, errors };
    }

    // Create v2 manifest from v1
    const v2: InstallManifestV2 = {
      manifestVersion: 2,
      packageVersion: v1.version,
      installedAt: v1.installedAt,
      updatedAt: new Date().toISOString(),
      scope: v1.scope,
      runtimes: v1.runtimes,
      workflowIds: v1.workflows,
      roots: v1.roots,
      files: v1.files,
      managedConfigs: {},
      hooks: {},
      runtimeManifests: {},
    };

    // Write v2 manifest
    writeFileSync(installManifestPath, JSON.stringify(v2, null, 2), 'utf-8');
    changes.push('Converted v1 install manifest to v2 format');
    installManifest = v2;
  }

  // Now update runtime manifests for each runtime
  const v2Manifest = installManifest as InstallManifestV2;
  const runtimes = v2Manifest.runtimes;

  for (const runtime of runtimes) {
    const runtimeManifestPath = v2Manifest.runtimeManifests?.[runtime];
    if (!runtimeManifestPath || !existsSync(runtimeManifestPath)) {
      errors.push(`Runtime manifest not found for ${runtime} at ${runtimeManifestPath}`);
      continue;
    }

    let runtimeManifest: RuntimeManifest;
    try {
      runtimeManifest = JSON.parse(readFileSync(runtimeManifestPath, 'utf-8'));
    } catch {
      errors.push(`Cannot parse runtime manifest at ${runtimeManifestPath}`);
      continue;
    }

    const currentMode = runtimeManifest.rolloutMode
      || (runtimeManifest.legacyMode ? 'legacy' : 'mcp-only');

    if (currentMode === targetMode) {
      changes.push(`${runtime}: Already at ${targetMode}, no change needed`);
      continue;
    }

    if (dryRun) {
      changes.push(`[dry-run] ${runtime}: Would change rolloutMode from ${currentMode} to ${targetMode}`);
      continue;
    }

    // Apply mode change
    runtimeManifest.rolloutMode = targetMode;
    runtimeManifest.legacyMode = targetMode === 'legacy';
    if (targetMode === 'hybrid-shadow') {
      runtimeManifest.comparisonEnabled = true;
    } else {
      delete runtimeManifest.comparisonEnabled;
    }

    // Write updated manifest
    try {
      writeFileSync(runtimeManifestPath, JSON.stringify(runtimeManifest, null, 2), 'utf-8');
      changes.push(`${runtime}: Changed rolloutMode from ${currentMode} to ${targetMode}`);
    } catch (err) {
      errors.push(`${runtime}: Failed to write runtime manifest: ${err}`);
    }
  }

  // Update install manifest updatedAt
  if (!dryRun) {
    v2Manifest.updatedAt = new Date().toISOString();
    writeFileSync(installManifestPath, JSON.stringify(v2Manifest, null, 2), 'utf-8');
    changes.push('Updated install manifest timestamp');
  }

  return {
    migrated: !dryRun && errors.length === 0,
    changes,
    errors,
  };
}
