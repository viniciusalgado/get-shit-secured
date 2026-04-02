/**
 * Shared test utilities for Phase 9 install tests.
 */
import { mkdtemp } from 'node:fs/promises';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export async function createTempDir() {
  return mkdtemp(join(tmpdir(), 'gss-p9-'));
}

export function cleanupTempDir(dir) {
  rmSync(dir, { recursive: true, force: true });
}

/**
 * Create a minimal adapter mock for MCP registration tests.
 */
export function createMockAdapter(overrides = {}) {
  return {
    runtime: overrides.runtime || 'claude',
    resolveRootPath: () => overrides.rootPath || '/mock/root',
    resolveSupportSubtree: () => overrides.supportSubtree || '/mock/root/gss',
    getPlaceholderFiles: () => [],
    getFilesForWorkflow: () => [],
    getSupportFiles: () => [],
    getManagedJsonPatches: () => [],
    getManagedTextBlocks: () => [],
    getHooks: () => overrides.hooks || [],
    getCapabilities: () => ({
      supportsHooks: true,
      supportsSubagents: true,
      supportsManagedConfig: true,
      supportsRoleAgents: true,
      hasConfigFormat: true,
    }),
    getRoleFiles: () => overrides.roleFiles || [],
    ...overrides,
  };
}

/**
 * Create a minimal adapter mock that supports MCP registration.
 */
export function createMockAdapterWithMcp(overrides = {}) {
  const base = createMockAdapter(overrides);
  base.getMcpRegistration = (serverPath, corpusPath) => ({
    path: 'settings.json',
    owner: 'gss',
    content: {
      command: 'node',
      args: [serverPath, '--corpus', corpusPath],
    },
    mergeStrategy: 'deep',
    keyPath: 'mcpServers.gss-security-docs',
  });
  return base;
}

/**
 * Set up a full healthy installation directory for verification/doctor tests.
 * Returns paths to all created directories and files.
 */
export function setupHealthyInstall(tempDir, options = {}) {
  const rootPath = join(tempDir, '.claude');
  const supportDir = join(rootPath, 'gss');
  const gssDir = join(tempDir, '.gss');
  const artifactsDir = join(gssDir, 'artifacts');
  const reportsDir = join(gssDir, 'reports');
  const hooksDir = join(supportDir, 'hooks');
  const corpusDir = join(supportDir, 'corpus');
  const mcpDir = join(supportDir, 'mcp');

  mkdirSync(artifactsDir, { recursive: true });
  mkdirSync(reportsDir, { recursive: true });
  mkdirSync(hooksDir, { recursive: true });
  mkdirSync(corpusDir, { recursive: true });
  mkdirSync(mcpDir, { recursive: true });

  const corpusPath = join(corpusDir, 'owasp-corpus.json');
  const mcpServerPath = join(mcpDir, 'server.js');
  const settingsPath = join(rootPath, 'settings.json');
  const runtimeManifestPath = join(supportDir, 'runtime-manifest.json');
  const installManifestPath = join(gssDir, 'install-manifest.json');

  const corpusVersion = options.corpusVersion || '1.0.0';
  const packageVersion = options.packageVersion || '0.1.0';

  // Write corpus
  const corpusData = options.corpusData || {
    corpusVersion,
    documents: new Array(113).fill(null).map((_, i) => ({ id: `test-doc-${i}` })),
  };
  writeFileSync(corpusPath, JSON.stringify(corpusData, null, 2));

  // Write MCP server binary
  writeFileSync(mcpServerPath, '// MCP server placeholder');

  // Write settings with MCP registration
  const settings = options.settingsData || {
    mcpServers: {
      'gss-security-docs': {
        command: 'node',
        args: [mcpServerPath, '--corpus', corpusPath],
      },
    },
  };
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

  // Write runtime manifest
  const runtimeManifest = options.runtimeManifestData || {
    runtime: 'claude',
    scope: 'local',
    installedAt: new Date().toISOString(),
    version: packageVersion,
    corpusVersion,
    hooks: ['session-start', 'pre-tool-write', 'pre-tool-edit', 'post-tool-write'],
    managedConfigs: [],
    corpusPath,
    mcpServerPath,
    mcpConfigPath: settingsPath,
    gssVersion: packageVersion,
  };
  writeFileSync(runtimeManifestPath, JSON.stringify(runtimeManifest, null, 2));

  // Write hooks
  for (const hookId of ['session-start', 'pre-tool-write', 'pre-tool-edit', 'post-tool-write']) {
    writeFileSync(join(hooksDir, `${hookId}.js`), `// Hook: ${hookId}`);
  }

  // Write install manifest
  const installManifest = options.installManifestData || {
    manifestVersion: 2,
    packageVersion,
    corpusVersion,
    installedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    scope: 'local',
    runtimes: ['claude'],
    workflowIds: [],
    roots: { claude: rootPath },
    files: { claude: [] },
    managedConfigs: {},
    hooks: { claude: [join(hooksDir, 'session-start.js')] },
    runtimeManifests: { claude: runtimeManifestPath },
    mcpServerPaths: { claude: mcpServerPath },
    mcpConfigPaths: { claude: settingsPath },
  };
  writeFileSync(installManifestPath, JSON.stringify(installManifest, null, 2));

  return {
    rootPath, supportDir, gssDir, artifactsDir, reportsDir,
    hooksDir, corpusDir, mcpDir, corpusPath, mcpServerPath,
    settingsPath, runtimeManifestPath, installManifestPath,
  };
}

/**
 * Capture console output during function execution.
 */
export function captureOutput(fn) {
  const logs = [];
  const warns = [];
  const errors = [];
  const origLog = console.log;
  const origWarn = console.warn;
  const origError = console.error;
  console.log = (...args) => logs.push(args.map(String).join(' '));
  console.warn = (...args) => warns.push(args.map(String).join(' '));
  console.error = (...args) => errors.push(args.map(String).join(' '));
  try {
    const result = fn();
    return { logs, warns, errors, result };
  } finally {
    console.log = origLog;
    console.warn = origWarn;
    console.error = origError;
  }
}

/**
 * Async version of captureOutput.
 */
export async function captureOutputAsync(fn) {
  const logs = [];
  const warns = [];
  const errors = [];
  const origLog = console.log;
  const origWarn = console.warn;
  const origError = console.error;
  console.log = (...args) => logs.push(args.map(String).join(' '));
  console.warn = (...args) => warns.push(args.map(String).join(' '));
  console.error = (...args) => errors.push(args.map(String).join(' '));
  try {
    const result = await fn();
    return { logs, warns, errors, result };
  } finally {
    console.log = origLog;
    console.warn = origWarn;
    console.error = origError;
  }
}
