import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const PACKAGED_MCP_SERVER_CANDIDATES = [
  'dist/mcp/server.bundle.js',
  'dist/mcp/server.js',
] as const;

const INSTALLED_MCP_SERVER_CANDIDATES = [
  'mcp/server.bundle.js',
  'mcp/server.js',
] as const;

export function getDefaultPackagedMcpServerPath(pkgRoot: string): string {
  return resolve(pkgRoot, PACKAGED_MCP_SERVER_CANDIDATES[0]);
}

export function resolvePackagedMcpServerPath(pkgRoot: string): string | null {
  for (const relativePath of PACKAGED_MCP_SERVER_CANDIDATES) {
    const absolutePath = resolve(pkgRoot, relativePath);
    if (existsSync(absolutePath)) {
      return absolutePath;
    }
  }

  return null;
}

export function resolveInstalledMcpServerPath(supportSubtree: string): string | null {
  for (const relativePath of INSTALLED_MCP_SERVER_CANDIDATES) {
    const absolutePath = join(supportSubtree, relativePath);
    if (existsSync(absolutePath)) {
      return absolutePath;
    }
  }

  return null;
}
