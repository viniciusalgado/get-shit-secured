#!/usr/bin/env node
/**
 * Bundle the MCP server into a self-contained ESM file.
 *
 * Inlines @modelcontextprotocol/sdk and all internal imports so
 * dist/mcp/server.bundle.js has no runtime dependencies beyond Node itself.
 * This eliminates ERR_MODULE_NOT_FOUND when the server is launched from
 * a target project context that doesn't share the GSS node_modules.
 */

import { build } from 'esbuild';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const thisDir = dirname(fileURLToPath(import.meta.url));
const entryPoint = resolve(thisDir, '..', 'dist', 'mcp', 'server.js');
const outfile = resolve(thisDir, '..', 'dist', 'mcp', 'server.bundle.js');

await build({
  entryPoints: [entryPoint],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outfile,
  // Node built-ins stay external (fs, path, etc.)
  packages: 'bundle',
  banner: {
    js: '// Auto-generated bundle — do not edit. Rebuild with: node scripts/bundle-mcp.mjs',
  },
});

console.log(`[bundle-mcp] Wrote ${outfile}`);
