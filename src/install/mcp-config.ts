/**
 * MCP Registration Stage — Extracts MCP server registration into a dedicated
 * stage module with proper error handling and manifest tracking.
 *
 * Responsibilities:
 * 1. Resolve the packaged MCP server entrypoint
 * 2. Get MCP config patch from adapter
 * 3. Merge MCP config into runtime settings (non-destructive)
 * 4. Record config path and server path in manifest tracking
 */

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type {
  ManagedJsonPatch,
  McpRegistrationResult,
  RuntimeAdapter,
  RuntimeTarget,
} from '../core/types.js';
import type { CorpusResolution, TargetDetection } from '../core/install-stages.js';
import { getHomeDir } from '../core/paths.js';
import {
  getDefaultPackagedMcpServerPath,
  resolvePackagedMcpServerPath,
} from '../core/mcp-server-path.js';

function isTomlPath(registration: ManagedJsonPatch): boolean {
  return registration.path === 'config.toml';
}

async function mergeTomlMcpConfig(
  configPath: string,
  registration: ManagedJsonPatch,
): Promise<void> {
  let content = '';
  if (existsSync(configPath)) {
    content = await readFile(configPath, 'utf-8');
  }

  const startMarker = '# GSS: BEGIN mcp_servers.gss-security-docs';
  const endMarker = '# GSS: END mcp_servers.gss-security-docs';
  const blockRegex = new RegExp(
    `\\n${escapeRegex(startMarker)}[\\s\\S]*?${escapeRegex(endMarker)}\\n?`,
    'g',
  );
  content = content.replace(blockRegex, '\n');
  content = content.replace(/\n+$/, '\n');

  const { command, args } = registration.content;
  const argsStr = (args as string[])
    .map(arg => `"${arg.replace(/"/g, '\\"')}"`)
    .join(', ');
  const tomlBlock = [
    '',
    startMarker,
    '[mcp_servers.gss-security-docs]',
    `command = "${command}"`,
    `args = [${argsStr}]`,
    endMarker,
    '',
  ].join('\n');

  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, content + tomlBlock, 'utf-8');
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function resolveMcpConfigBase(
  registration: ManagedJsonPatch,
  targets: TargetDetection,
): string {
  const resolveFrom = registration.resolveFrom ?? 'runtime-root';

  switch (resolveFrom) {
    case 'cwd':
      return join(targets.cwd, registration.path);
    case 'home':
      return join(getHomeDir(), registration.path);
    case 'runtime-root':
    default: {
      const runtime = targets.runtimes[0] ?? 'claude';
      const rootPath = targets.roots[runtime];
      return join(rootPath ?? targets.cwd, registration.path);
    }
  }
}

export async function registerMcpServers(
  adapters: RuntimeAdapter[],
  targets: TargetDetection,
  corpus: CorpusResolution | null,
  options: { dryRun: boolean; pkgRoot: string },
): Promise<McpRegistrationResult> {
  const configPaths: Partial<Record<RuntimeTarget, string>> = {};
  const serverBinaryPaths: Partial<Record<RuntimeTarget, string>> = {};
  const errors: string[] = [];

  if (options.dryRun || !corpus) {
    if (corpus) {
      for (const adapter of adapters) {
        const adapterWithMcp = adapter as unknown as {
          getMcpRegistration?: (
            serverPath: string,
            corpusPath: string,
            opts?: { scope: string; cwd: string },
          ) => ManagedJsonPatch;
        };
        if (typeof adapterWithMcp.getMcpRegistration === 'function') {
          const runtime = adapter.runtime;
          const supportSubtree = targets.supportSubtrees[runtime];
          if (supportSubtree) {
            serverBinaryPaths[runtime] = getDefaultPackagedMcpServerPath(options.pkgRoot);
            const registration = adapterWithMcp.getMcpRegistration(
              serverBinaryPaths[runtime]!,
              corpus.destinationPaths[runtime] ?? '',
              { scope: targets.scope, cwd: targets.cwd },
            );
            configPaths[runtime] = resolveMcpConfigBase(registration, targets);
          }
        }
      }
    }
    return { configPaths, serverBinaryPaths, errors };
  }

  for (const adapter of adapters) {
    const adapterWithMcp = adapter as unknown as {
      getMcpRegistration?: (
        serverPath: string,
        corpusPath: string,
        opts?: { scope: string; cwd: string },
      ) => ManagedJsonPatch;
    };

    if (typeof adapterWithMcp.getMcpRegistration !== 'function') {
      continue;
    }

    const runtime = adapter.runtime;
    const supportSubtree = targets.supportSubtrees[runtime];
    const rootPath = targets.roots[runtime];

    if (!supportSubtree || !rootPath) {
      continue;
    }

    const srcServerPath = resolvePackagedMcpServerPath(options.pkgRoot);
    if (!srcServerPath) {
      errors.push(
        `[mcp] ${runtime}: MCP server entrypoint not found under ${resolve(options.pkgRoot, 'dist', 'mcp')}. ` +
        'Run "npm run build" to compile the MCP server.',
      );
      continue;
    }
    serverBinaryPaths[runtime] = srcServerPath;

    const corpusDestPath = corpus.destinationPaths[runtime];
    if (!corpusDestPath) {
      errors.push(`[mcp] ${runtime}: No corpus destination path available`);
      continue;
    }

    const registration = adapterWithMcp.getMcpRegistration(
      srcServerPath,
      corpusDestPath,
      { scope: targets.scope, cwd: targets.cwd },
    );

    try {
      const configFilePath = resolveMcpConfigBase(registration, targets);

      if (isTomlPath(registration)) {
        await mergeTomlMcpConfig(configFilePath, registration);
        configPaths[runtime] = configFilePath;
      } else {
        await mkdir(dirname(configFilePath), { recursive: true });

        let existing: Record<string, unknown> = {};
        if (existsSync(configFilePath)) {
          const content = await readFile(configFilePath, 'utf-8');
          existing = content.trim() ? JSON.parse(content) : {};
        }

        const keys = registration.keyPath ? registration.keyPath.split('.') : [];
        let target = existing;
        for (const key of keys.slice(0, -1)) {
          if (!(key in target)) target[key] = {};
          target = target[key] as Record<string, unknown>;
        }
        const finalKey = keys[keys.length - 1] ?? registration.owner;
        target[finalKey] = registration.content;

        await writeFile(configFilePath, JSON.stringify(existing, null, 2), 'utf-8');
        configPaths[runtime] = configFilePath;
      }
    } catch (error) {
      errors.push(
        `[mcp] ${runtime}: Failed to register MCP config: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return { configPaths, serverBinaryPaths, errors };
}
