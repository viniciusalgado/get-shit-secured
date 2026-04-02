/**
 * Shared test utilities for Phase 8 hook tests.
 */

import { ClaudeAdapter } from '../../../dist/runtimes/claude/adapter.js';
import { mkdtemp } from 'node:fs/promises';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';

export function getHookCommand(hookId) {
  const adapter = new ClaudeAdapter();
  const hooks = adapter.getHooks();
  const hook = hooks.find(h => h.id === hookId);
  if (!hook) throw new Error('Hook not found: ' + hookId);
  return hook.command;
}

export function getAllHooks() {
  const adapter = new ClaudeAdapter();
  return adapter.getHooks();
}

export async function createTempDir() {
  return mkdtemp(join(tmpdir(), 'gss-p8-'));
}

export async function cleanupTempDir(dir) {
  rmSync(dir, { recursive: true, force: true });
}

export function executeHook(commandStr, context) {
  const script = new vm.Script(
    'const { existsSync, readFileSync, unlinkSync, readdirSync, mkdirSync, writeFileSync } = require("fs");\n' +
    'const { join } = require("path");\n' +
    'module.exports = async function(context) {\n' +
    commandStr + '\n};',
    { filename: 'hook-runner.js' }
  );
  const mod = script.runInThisContext({ console, process, require, __filename: '/hook-runner.js' });
  return mod(context);
}

export function captureOutput(fn) {
  const logs = [];
  const warns = [];
  const errors = [];
  const origLog = console.log;
  const origWarn = console.warn;
  const origError = console.error;
  console.log = (...args) => logs.push(args.join(' '));
  console.warn = (...args) => warns.push(args.join(' '));
  console.error = (...args) => errors.push(args.join(' '));
  try {
    const result = fn();
    return { logs, warns, errors, result };
  } finally {
    console.log = origLog;
    console.warn = origWarn;
    console.error = origError;
  }
}

export function setupFullEnvironment(tempDir, overrides) {
  overrides = overrides || {};
  const supportDir = join(tempDir, '.claude', 'gss');
  const gssDir = join(tempDir, '.gss');
  const artifactsDir = join(gssDir, 'artifacts');
  const reportsDir = join(gssDir, 'reports');
  const hooksDir = join(supportDir, 'hooks');
  const corpusDir = join(supportDir, 'corpus');

  mkdirSync(artifactsDir, { recursive: true });
  mkdirSync(reportsDir, { recursive: true });
  mkdirSync(hooksDir, { recursive: true });
  mkdirSync(corpusDir, { recursive: true });

  const runtimeManifestPath = join(supportDir, 'runtime-manifest.json');
  const corpusPath = join(corpusDir, 'owasp-corpus.json');
  const mcpServerPath = join(supportDir, 'mcp', 'server.js');
  const settingsPath = join(tempDir, '.claude', 'settings.json');
  const installManifestPath = join(gssDir, 'install-manifest.json');

  if (!overrides.skipRuntimeManifest) {
    const manifest = {
      runtime: 'claude',
      scope: 'local',
      installedAt: overrides.installedAt || new Date().toISOString(),
      version: '0.1.0',
      corpusVersion: overrides.corpusVersion || '1.0.0',
      hooks: ['session-start', 'pre-tool-write', 'pre-tool-edit', 'post-tool-write'],
      managedConfigs: [],
      corpusPath: overrides.corpusPath || corpusPath,
      mcpServerPath: overrides.mcpServerPath || mcpServerPath,
      mcpConfigPath: overrides.mcpConfigPath || settingsPath,
      gssVersion: overrides.gssVersion || '0.1.0',
    };
    writeFileSync(runtimeManifestPath, JSON.stringify(manifest, null, 2));
  }

  if (!overrides.skipCorpus) {
    const data = overrides.corpusData || { stats: { totalDocs: 42 }, documents: [] };
    writeFileSync(corpusPath, JSON.stringify(data, null, 2));
  }

  if (!overrides.skipMcpServer) {
    mkdirSync(join(supportDir, 'mcp'), { recursive: true });
    writeFileSync(mcpServerPath, '// placeholder');
  }

  if (!overrides.skipSettings) {
    mkdirSync(join(tempDir, '.claude'), { recursive: true });
    const settings = overrides.settingsData || {
      mcpServers: { 'gss-security-docs': { command: 'node', args: [mcpServerPath] } },
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  }

  if (!overrides.skipInstallManifest) {
    const im = overrides.installManifest || {
      version: '2.0',
      corpusVersion: overrides.corpusVersion || '1.0.0',
      runtimes: { claude: {} },
    };
    writeFileSync(installManifestPath, JSON.stringify(im, null, 2));
  }

  if (!overrides.skipValidator) {
    const adapter = new ClaudeAdapter();
    const supportFiles = adapter.getSupportFiles();
    const vf = supportFiles.find(f => f.relativePath === 'hooks/artifact-validator.js');
    if (vf) {
      writeFileSync(join(hooksDir, 'artifact-validator.js'), vf.content);
    }
  }

  return {
    supportDir, gssDir, artifactsDir, reportsDir, settingsPath,
    runtimeManifestPath, installManifestPath, corpusPath, mcpServerPath, hooksDir,
  };
}
