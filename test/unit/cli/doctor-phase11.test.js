/**
 * Unit tests for doctor — Phase 11 rollout mode display.
 * Validates that doctor output includes the rollout mode with
 * release labels for Release C modes.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';

import { doctor } from '../../../dist/cli/doctor.js';
import { setupHealthyInstall, createTempDir, cleanupTempDir, captureOutputAsync } from '../install/helpers.js';

/**
 * Set up a healthy install with Phase 11 rollout mode fields.
 */
function setupInstallWithRolloutMode(tempDir, options = {}) {
  const paths = setupHealthyInstall(tempDir);

  const baseManifest = {
    runtime: 'claude',
    scope: 'local',
    installedAt: new Date().toISOString(),
    version: '0.1.0',
    corpusVersion: '1.0.0',
    hooks: ['session-start', 'pre-tool-write', 'pre-tool-edit', 'post-tool-write'],
    managedConfigs: [],
    corpusPath: paths.corpusPath,
    mcpServerPath: paths.mcpServerPath,
    mcpConfigPath: paths.mcpConfigPath,
    gssVersion: '0.1.0',
    installedWorkflows: ['security-review', 'audit'],
    installedRoles: ['gss-mapper', 'gss-auditor'],
    mcpServerName: 'gss-security-docs',
    ...options,
  };

  writeFileSync(paths.runtimeManifestPath, JSON.stringify(baseManifest, null, 2));
  return paths;
}

describe('doctor — Phase 11 rollout mode display', () => {
  it('shows rolloutMode: mcp-only', async () => {
    const tempDir = await createTempDir();
    try {
      setupInstallWithRolloutMode(tempDir, {
        rolloutMode: 'mcp-only',
      });

      const { logs, result } = await captureOutputAsync(() =>
        doctor(tempDir, { runtimes: ['claude'] })
      );
      const output = logs.join('\n');

      assert.ok(output.includes('mcp-only'),
        `Should show mcp-only mode. Got:\n${output}`);
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('shows rolloutMode: hybrid-shadow', async () => {
    const tempDir = await createTempDir();
    try {
      setupInstallWithRolloutMode(tempDir, {
        rolloutMode: 'hybrid-shadow',
        comparisonEnabled: true,
      });

      const { logs } = await captureOutputAsync(() =>
        doctor(tempDir, { runtimes: ['claude'] })
      );
      const output = logs.join('\n');

      assert.ok(output.includes('hybrid-shadow'),
        `Should show hybrid-shadow mode. Got:\n${output}`);
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('defaults to mcp-only when rolloutMode is absent', async () => {
    const tempDir = await createTempDir();
    try {
      setupInstallWithRolloutMode(tempDir);

      const { logs } = await captureOutputAsync(() =>
        doctor(tempDir, { runtimes: ['claude'] })
      );
      const output = logs.join('\n');

      assert.ok(output.includes('mcp-only'),
        `Should default to mcp-only. Got:\n${output}`);
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('doctor passes with Phase 11 manifest (healthy install)', async () => {
    const tempDir = await createTempDir();
    try {
      setupInstallWithRolloutMode(tempDir, {
        rolloutMode: 'mcp-only',
      });

      const { result } = await captureOutputAsync(() =>
        doctor(tempDir, { runtimes: ['claude'] })
      );

      assert.equal(result, 0, `Doctor should pass with exit code 0`);
    } finally {
      cleanupTempDir(tempDir);
    }
  });
});
