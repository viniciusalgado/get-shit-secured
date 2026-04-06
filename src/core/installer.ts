import { existsSync, lstatSync, readdirSync } from 'node:fs';
import { rm, unlink, readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
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
  getManifestPath,
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
import {
  detectTargets,
  resolveCorpus,
  installRuntimeArtifacts,
  verifyInstall,
  DEFAULT_WORKFLOWS,
  type TargetDetection,
  type CorpusResolution,
} from './install-stages.js';
import { registerMcpServers } from '../install/mcp-config.js';
import { discoverLegacyArtifacts, cleanupLegacyArtifacts } from '../install/legacy-cleanup.js';

/**
 * Main installer function with staged pipeline.
 *
 * Pipeline stages:
 *   Stage 0: Target detection
 *   Stage 1: Packaged corpus resolution
 *   Stage 2: Runtime artifact install
 *   Stage 3: MCP registration
 *   Stage 3.5: Legacy specialist cleanup (non-legacy installs only)
 *   Stage 4: Manifest and verification
 *
 * @param adapters - Runtime adapters to install
 * @param scope - Installation scope (local or global)
 * @param cwd - Current working directory
 * @param dryRun - If true, don't write files
 * @param options - Optional rollout configuration
 */
export async function install(
  adapters: RuntimeAdapter[],
  scope: InstallScope,
  cwd: string,
  dryRun: boolean = false,
  options?: { hybridShadow?: boolean }
): Promise<InstallResult> {
  const hybridShadow = options?.hybridShadow ?? false;

  // Stage 0: Detect targets
  const targets = detectTargets(adapters, scope, cwd);

  // Stage 1: Resolve corpus
  let corpus: CorpusResolution | null = null;
  try {
    const pkgRoot = resolve(dirname(import.meta.url ?? __dirname), '..');
    corpus = await resolveCorpus(targets, pkgRoot);
  } catch (error) {
    return {
      success: false,
      manifest: null,
      filesCreated: 0,
      errors: [`Corpus resolution failed: ${error instanceof Error ? error.message : String(error)}`],
    };
  }

  // Stage 2: Install runtime artifacts
  const artifacts = await installRuntimeArtifacts(
    targets,
    adapters,
    corpus,
    { dryRun, hybridShadow }
  );

  // Stage 3: MCP registration (extracted to stage module)
  let mcpResult = null;
  const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  mcpResult = await registerMcpServers(adapters, targets, corpus, {
    dryRun,
    pkgRoot,
  });
  if (mcpResult.errors.length > 0) {
    for (const err of mcpResult.errors) {
      process.stderr.write(`[GSS] Warning: ${err}\n`);
    }
  }

  // Stage 3.5: Legacy specialist cleanup (non-legacy installs only)
  let cleanupResult = null;
  if (!dryRun) {
    cleanupResult = await performLegacyCleanup(adapters, targets, { dryRun });
  }

  // Stage 4: Manifests and verification
  let manifest: InstallManifest | InstallManifestV2 | null = null;

  if (!dryRun) {
    const existing = await readManifest(cwd);
    const runtimeTargets = adapters.map(a => a.runtime);

    // Build MCP paths for manifest tracking
    const mcpPaths = mcpResult ? {
      serverPaths: mcpResult.serverBinaryPaths,
      configPaths: mcpResult.configPaths,
    } : undefined;

    if (existing) {
      manifest = mergeManifest(
        existing,
        runtimeTargets,
        DEFAULT_WORKFLOWS,
        artifacts.filesByRuntime,
        artifacts.rootsByRuntime,
        artifacts.managedConfigsByRuntime,
        artifacts.hooksByRuntime,
        artifacts.runtimeManifestPaths,
        mcpPaths
      );
      // Add corpus version to merged manifest
      if ('manifestVersion' in manifest && manifest.manifestVersion === 2 && corpus) {
        (manifest as InstallManifestV2).corpusVersion = corpus.corpusVersion;
      }
    } else {
      manifest = createManifestV2(
        runtimeTargets,
        scope,
        DEFAULT_WORKFLOWS,
        artifacts.rootsByRuntime,
        artifacts.filesByRuntime,
        artifacts.managedConfigsByRuntime,
        artifacts.hooksByRuntime,
        artifacts.runtimeManifestPaths,
        corpus?.corpusVersion,
        mcpPaths
      );
    }

    await writeManifest(cwd, manifest);
  } else {
    manifest = createManifestV2(
      adapters.map(a => a.runtime),
      scope,
      DEFAULT_WORKFLOWS,
      artifacts.rootsByRuntime,
      artifacts.filesByRuntime,
      artifacts.managedConfigsByRuntime,
      artifacts.hooksByRuntime,
      artifacts.runtimeManifestPaths,
      corpus?.corpusVersion,
      mcpResult ? {
        serverPaths: mcpResult.serverBinaryPaths,
        configPaths: mcpResult.configPaths,
      } : undefined
    );
  }

  const verification = await verifyInstall(targets, corpus, mcpResult, { dryRun });

  // Combine all errors
  const allErrors = [
    ...artifacts.errors,
    ...(mcpResult?.errors ?? []),
    ...verification.errors,
  ];

  return {
    success: artifacts.errors.length === 0 && verification.healthy,
    manifest,
    filesCreated: artifacts.totalFilesCreated,
    errors: allErrors,
  };
}

/**
 * Perform legacy specialist cleanup during install.
 * Discovers old specialist files and removes them safely.
 */
async function performLegacyCleanup(
  adapters: RuntimeAdapter[],
  targets: TargetDetection,
  options: { dryRun: boolean }
): Promise<{ removed: string[]; errors: string[] }> {
  const allRemoved: string[] = [];
  const allErrors: string[] = [];

  for (const adapter of adapters) {
    const runtime = adapter.runtime;
    const rootPath = targets.roots[runtime];
    const supportSubtree = targets.supportSubtrees[runtime];

    if (!rootPath || !supportSubtree) continue;

    const artifacts = discoverLegacyArtifacts(runtime, rootPath, supportSubtree);

    if (artifacts.hasLegacyArtifacts) {
      const result = await cleanupLegacyArtifacts(artifacts, options);
      allRemoved.push(...result.removed);
      allErrors.push(...result.errors);

      if (result.removed.length > 0 && !options.dryRun) {
        console.log(`[GSS] Cleaned up ${result.removed.length} legacy specialist artifacts for ${runtime}`);
      }
    }
  }

  return { removed: allRemoved, errors: allErrors };
}

/**
 * Uninstall all installed files based on manifest.
 * Supports both v1 and v2 manifests with proper cleanup.
 * Phase 9: Also cleans up MCP config entries and server binaries.
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

  const targetRuntimes = runtimes ?? manifest.runtimes;

  if ('manifestVersion' in manifest && manifest.manifestVersion === 2) {
    const v2Manifest = manifest as InstallManifestV2;

    for (const runtime of targetRuntimes) {
      const files = v2Manifest.files[runtime] ?? [];
      for (const file of files) {
        try {
          const validatedPath = validateManifestPath(file, cwd);
          if (!dryRun && existsSync(validatedPath)) {
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

      // Phase 9: Revert MCP config entries
      const mcpConfigPath = v2Manifest.mcpConfigPaths?.[runtime];
      if (mcpConfigPath && !dryRun) {
        try {
          await revertMcpConfig(mcpConfigPath);
        } catch (error) {
          errors.push(`[mcp] ${runtime}: Failed to revert MCP config: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // Phase 9: Remove MCP server binary
      const mcpServerPath = v2Manifest.mcpServerPaths?.[runtime];
      if (mcpServerPath && !dryRun) {
        try {
          const validatedPath = validateManifestPath(mcpServerPath, cwd);
          if (existsSync(validatedPath)) {
            await unlink(validatedPath);
            filesRemoved++;
          }
          // Try to remove the mcp/ directory if empty
          const mcpDir = dirname(validatedPath);
          if (existsSync(mcpDir)) {
            const entries = readdirSync(mcpDir);
            if (entries.length === 0) {
              await rm(mcpDir, { recursive: true, force: true });
              dirsRemoved++;
            }
          }
        } catch (error) {
          errors.push(`[mcp] ${runtime}: Failed to remove MCP server binary: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

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

      // Phase 9: Defensively clean up any remaining specialist files not in manifest
      const rootPath = v2Manifest.roots[runtime];
      if (rootPath && !dryRun) {
        try {
          const supportSubtree = resolve(rootPath, 'gss');
          const { discoverLegacyArtifacts: discover } = await import('../install/legacy-cleanup.js');
          const legacyArtifacts = discover(runtime, rootPath, supportSubtree);
          if (legacyArtifacts.hasLegacyArtifacts) {
            for (const file of legacyArtifacts.specialistFiles) {
              try {
                if (existsSync(file)) {
                  await unlink(file);
                  filesRemoved++;
                }
              } catch {
                // Best-effort cleanup
              }
            }
            for (const dir of legacyArtifacts.specialistDirs) {
              try {
                if (existsSync(dir)) {
                  await rm(dir, { recursive: true, force: true });
                  dirsRemoved++;
                }
              } catch {
                // Best-effort cleanup
              }
            }
          }
        } catch {
          // Ignore discovery errors during uninstall
        }
      }
    }

    const gssArtifactsDir = join(cwd, '.gss', 'artifacts');
    const gssReportsDir = join(cwd, '.gss', 'reports');
    const gssDir = join(cwd, '.gss');
    for (const dir of [gssArtifactsDir, gssReportsDir, gssDir]) {
      if (existsSync(dir)) {
        try {
          if (readdirSync(dir).length === 0) {
            await rm(dir, { recursive: true, force: true });
            dirsRemoved++;
          }
        } catch (error) {
          errors.push(`${dir}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
  } else {
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
    try {
      const { resolveRuntimeRoot: resolveRoot } = await import('./paths.js');
      const supportSubtree = join(resolveRoot(runtime, manifest.scope, cwd), 'gss');
      if (!dryRun && existsSync(supportSubtree)) {
        const entries = readdirSync(supportSubtree);
        if (entries.length === 0) {
          await rm(supportSubtree, { recursive: true, force: true });
          dirsRemoved++;
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  // Remove manifest if all runtimes are uninstalled
  const remainingRuntimes = manifest.runtimes.filter(r => !targetRuntimes.includes(r));
  if (remainingRuntimes.length === 0 && !dryRun) {
    await deleteManifest(cwd);
    const gssDir = join(cwd, '.gss');
    try {
      if (existsSync(gssDir)) {
        const entries = readdirSync(gssDir);
        if (entries.length === 0) {
          await rm(gssDir, { recursive: true, force: true });
          dirsRemoved++;
        }
      }
    } catch {
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
 * Revert MCP config entry from a settings.json file.
 * Removes the gss-security-docs entry from mcpServers.
 */
async function revertMcpConfig(configPath: string): Promise<void> {
  if (!existsSync(configPath)) return;

  try {
    const content = await readFile(configPath, 'utf-8');
    const config = content.trim() ? JSON.parse(content) : {};

    // Remove gss-security-docs from mcpServers
    if (
      typeof config === 'object' &&
      config !== null &&
      'mcpServers' in config &&
      typeof config.mcpServers === 'object' &&
      config.mcpServers !== null
    ) {
      delete (config.mcpServers as Record<string, unknown>)['gss-security-docs'];

      // If mcpServers is now empty, remove it
      if (Object.keys(config.mcpServers).length === 0) {
        delete config.mcpServers;
      }

      await writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
    }
  } catch (error) {
    throw new Error(`Failed to revert MCP config at ${configPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function removeManagedTextBlock(filePath: string, owner: string): Promise<void> {
  if (!existsSync(filePath)) return;
  const content = await readFile(filePath, 'utf-8');
  const startMarker = `// GSS: BEGIN (${owner})`;
  const endMarker = `// GSS: END (${owner})`;
  const regex = new RegExp(
    `${startMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${endMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`,
    'g'
  );
  const newContent = content.replace(regex, '').trim();
  if (newContent) {
    await writeFile(filePath, newContent + '\n', 'utf-8');
  } else {
    await unlink(filePath);
  }
}
