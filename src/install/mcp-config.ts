/**
 * MCP Registration Stage — Extracts MCP server registration into a dedicated
 * stage module with proper error handling and manifest tracking.
 *
 * Phase 9 — Workstream A: Extracted from inline code in installer.ts.
 *
 * Responsibilities:
 * 1. Copy compiled MCP server binary to {supportSubtree}/mcp/
 * 2. Get MCP config patch from adapter
 * 3. Merge MCP config into runtime settings (non-destructive)
 * 4. Record config path and binary path in manifest tracking
 */

import { existsSync } from 'node:fs';
import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import type {
  RuntimeAdapter,
  RuntimeTarget,
  ManagedJsonPatch,
  McpRegistrationResult,
} from '../core/types.js';
import type { TargetDetection, CorpusResolution } from '../core/install-stages.js';

/**
 * Stage 3: Register MCP server for all runtime targets.
 *
 * For each adapter that supports MCP registration:
 * 1. Copy compiled MCP server binary to {supportSubtree}/mcp/
 * 2. Get MCP config patch from adapter
 * 3. Merge MCP config into runtime settings (non-destructive)
 * 4. Record config path and binary path in manifest tracking
 *
 * Errors are non-fatal — registration failure emits a warning but
 * does not abort the install.
 *
 * @param adapters - Runtime adapters to register MCP for
 * @param targets - Stage 0 target detection result
 * @param corpus - Stage 1 corpus resolution (for corpus path in registration)
 * @param options - dryRun and pkgRoot
 * @returns Per-runtime registration results
 */
export async function registerMcpServers(
  adapters: RuntimeAdapter[],
  targets: TargetDetection,
  corpus: CorpusResolution | null,
  options: { dryRun: boolean; pkgRoot: string }
): Promise<McpRegistrationResult> {
  const configPaths: Partial<Record<RuntimeTarget, string>> = {};
  const serverBinaryPaths: Partial<Record<RuntimeTarget, string>> = {};
  const errors: string[] = [];

  if (options.dryRun || !corpus) {
    // In dry-run mode, compute expected paths without I/O
    if (corpus) {
      for (const adapter of adapters) {
        const adapterWithMcp = adapter as unknown as {
          getMcpRegistration?: (serverPath: string, corpusPath: string) => ManagedJsonPatch;
        };
        if (typeof adapterWithMcp.getMcpRegistration === 'function') {
          const runtime = adapter.runtime;
          const supportSubtree = targets.supportSubtrees[runtime];
          if (supportSubtree) {
            serverBinaryPaths[runtime] = join(supportSubtree, 'mcp', 'server.js');
            const rootPath = targets.roots[runtime];
            if (rootPath) {
              configPaths[runtime] = join(rootPath, 'settings.json');
            }
          }
        }
      }
    }
    return { configPaths, serverBinaryPaths, errors };
  }

  for (const adapter of adapters) {
    const adapterWithMcp = adapter as unknown as {
      getMcpRegistration?: (serverPath: string, corpusPath: string) => ManagedJsonPatch;
    };

    if (typeof adapterWithMcp.getMcpRegistration !== 'function') {
      // Adapter doesn't support MCP registration — skip silently
      continue;
    }

    const runtime = adapter.runtime;
    const supportSubtree = targets.supportSubtrees[runtime];
    const rootPath = targets.roots[runtime];

    if (!supportSubtree || !rootPath) {
      continue;
    }

    const mcpDir = join(supportSubtree, 'mcp');

    // Copy compiled MCP server to support subtree
    const srcServerPath = resolve(options.pkgRoot, 'dist', 'mcp', 'server.js');
    const destServerPath = join(mcpDir, 'server.js');

    try {
      await mkdir(mcpDir, { recursive: true });
      if (existsSync(srcServerPath)) {
        await copyFile(srcServerPath, destServerPath);
        serverBinaryPaths[runtime] = destServerPath;
      } else {
        errors.push(
          `[mcp] ${runtime}: MCP server binary not found at ${srcServerPath}. ` +
          'Run "npm run build" to compile the MCP server.'
        );
        continue;
      }
    } catch (error) {
      // MCP server copy is non-fatal — warn but continue
      errors.push(
        `[mcp] ${runtime}: Failed to copy MCP server: ${error instanceof Error ? error.message : String(error)}`
      );
      continue;
    }

    // Get corpus destination path for this runtime
    const corpusDestPath = corpus.destinationPaths[runtime];
    if (!corpusDestPath) {
      errors.push(`[mcp] ${runtime}: No corpus destination path available`);
      continue;
    }

    const registration = adapterWithMcp.getMcpRegistration(destServerPath, corpusDestPath);

    // Merge MCP registration into runtime config
    try {
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
      configPaths[runtime] = settingsPath;
    } catch (error) {
      errors.push(
        `[mcp] ${runtime}: Failed to register MCP config: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return { configPaths, serverBinaryPaths, errors };
}
