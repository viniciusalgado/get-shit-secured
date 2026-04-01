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
import { fetchAllCheatSheets } from './owasp-ingestion.js';
import { generateAllSpecialists } from './specialist-generator.js';

/**
 * Main installer function with staged pipeline.
 *
 * Pipeline stages:
 *   Stage 0: Target detection
 *   Stage 1: Packaged corpus resolution
 *   Stage 2: Runtime artifact install
 *   Stage 3: MCP registration (stub — no-op in Phase 3)
 *   Stage 4: Manifest and verification
 *
 * @param adapters - Runtime adapters to install
 * @param scope - Installation scope (local or global)
 * @param cwd - Current working directory
 * @param dryRun - If true, don't write files
 * @param options - Optional: legacySpecialists to use old fetch+generate path
 */
export async function install(
  adapters: RuntimeAdapter[],
  scope: InstallScope,
  cwd: string,
  dryRun: boolean = false,
  options?: { legacySpecialists?: boolean }
): Promise<InstallResult> {
  const legacySpecialists = options?.legacySpecialists ?? false;

  // Stage 0: Detect targets
  const targets = detectTargets(adapters, scope, cwd);

  // Stage 1: Resolve corpus (skip in legacy mode)
  let corpus: CorpusResolution | null = null;
  if (!legacySpecialists) {
    try {
      // Determine package root relative to this file
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
  }

  // Prepare specialists for legacy mode
  let specialists: unknown[] = [];
  if (legacySpecialists) {
    const corpusEntries = await fetchAllCheatSheets();
    specialists = generateAllSpecialists(corpusEntries);
  }

  // Stage 2: Install runtime artifacts
  const artifacts = await installRuntimeArtifacts(
    targets,
    adapters,
    corpus,
    { dryRun, legacySpecialists, specialists }
  );

  // Stage 3: MCP registration
  const mcpRegistrations: Partial<Record<RuntimeTarget, string>> = {};
  if (!dryRun && corpus) {
    for (const adapter of adapters) {
      const adapterWithMcp = adapter as unknown as {
        getMcpRegistration?: (serverPath: string, corpusPath: string) => ManagedJsonPatch;
      };
      if (typeof adapterWithMcp.getMcpRegistration === 'function') {
        const runtime = adapter.runtime;
        const supportSubtree = targets.supportSubtrees[runtime]!;
        const mcpDir = join(supportSubtree, 'mcp');

        // Copy compiled MCP server to support subtree
        const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
        const srcServerPath = resolve(pkgRoot, 'dist', 'mcp', 'server.js');
        const destServerPath = join(mcpDir, 'server.js');

        try {
          await mkdir(mcpDir, { recursive: true });
          await copyFile(srcServerPath, destServerPath);
        } catch (error) {
          // MCP server copy is non-fatal — warn but continue
          process.stderr.write(
            `[GSS] Warning: Failed to copy MCP server for ${runtime}: ${error instanceof Error ? error.message : String(error)}\n`
          );
          continue;
        }

        // Get corpus destination path for this runtime
        const corpusDestPath = corpus.destinationPaths[runtime]!;
        const registration = adapterWithMcp.getMcpRegistration(destServerPath, corpusDestPath);

        // Merge MCP registration into runtime config
        try {
          const rootPath = targets.roots[runtime]!;
          const settingsPath = join(rootPath, registration.path);
          await mkdir(dirname(settingsPath), { recursive: true });

          let existing: Record<string, unknown> = {};
          if (existsSync(settingsPath)) {
            const content = await readFile(settingsPath, 'utf-8');
            existing = content.trim() ? JSON.parse(content) : {};
          }

          // Deep merge the MCP registration into the config
          const keys = registration.keyPath ? registration.keyPath.split('.') : [];
          let target = existing;
          for (const key of keys.slice(0, -1)) {
            if (!(key in target)) target[key] = {};
            target = target[key] as Record<string, unknown>;
          }
          const finalKey = keys[keys.length - 1] ?? registration.owner;
          target[finalKey] = registration.content;

          await writeFile(settingsPath, JSON.stringify(existing, null, 2), 'utf-8');
          mcpRegistrations[runtime] = settingsPath;
        } catch (error) {
          process.stderr.write(
            `[GSS] Warning: Failed to register MCP server for ${runtime}: ${error instanceof Error ? error.message : String(error)}\n`
          );
        }
      }
    }
  }

  // Stage 4: Manifests and verification
  let manifest: InstallManifest | InstallManifestV2 | null = null;

  if (!dryRun) {
    const existing = await readManifest(cwd);
    const runtimeTargets = adapters.map(a => a.runtime);

    if (existing) {
      manifest = mergeManifest(
        existing,
        runtimeTargets,
        DEFAULT_WORKFLOWS,
        artifacts.filesByRuntime,
        artifacts.rootsByRuntime,
        artifacts.managedConfigsByRuntime,
        artifacts.hooksByRuntime,
        artifacts.runtimeManifestPaths
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
        artifacts.runtimeManifestPaths
      );
      // Add corpus version
      if (corpus) {
        manifest.corpusVersion = corpus.corpusVersion;
      }
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
      artifacts.runtimeManifestPaths
    );
    if (corpus) {
      manifest.corpusVersion = corpus.corpusVersion;
    }
  }

  const verification = await verifyInstall(targets, corpus, { dryRun });

  return {
    success: artifacts.errors.length === 0 && verification.healthy,
    manifest,
    filesCreated: artifacts.totalFilesCreated,
    errors: [...artifacts.errors, ...verification.errors],
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
