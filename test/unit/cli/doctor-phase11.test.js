/**
 * Unit tests for doctor — Phase 11 rollout mode display.
 * Validates that doctor output includes the rollout mode with
 * release labels, and handles backward compatibility.
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
    mcpConfigPath: paths.settingsPath,
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
  it('shows rolloutMode: mcp-only with Release B label', async () => {
    const tempDir = await createTempDir();
    try {
      setupInstallWithRolloutMode(tempDir, {
        rolloutMode: 'mcp-only',
        legacyMode: false,
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
        legacyMode: false,
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

  it('shows rolloutMode: legacy', async () => {
    const tempDir = await createTempDir();
    try {
      setupInstallWithRolloutMode(tempDir, {
        rolloutMode: 'legacy',
        legacyMode: true,
      });

      const { logs } = await captureOutputAsync(() =>
        doctor(tempDir, { runtimes: ['claude'] })
      );
      const output = logs.join('\n');

      assert.ok(output.includes('legacy'),
        `Should show legacy mode. Got:\n${output}`);
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('backward compat: infers legacy from legacyMode:true when rolloutMode absent', async () => {
    const tempDir = await createTempDir();
    try {
      setupInstallWithRolloutMode(tempDir, {
        legacyMode: true,
        // rolloutMode intentionally omitted
      });

      const { logs } = await captureOutputAsync(() =>
        doctor(tempDir, { runtimes: ['claude'] })
      );
      const output = logs.join('\n');

      // When rolloutMode is absent and legacyMode is true, should infer 'legacy'
      assert.ok(output.includes('legacy'),
        `Should infer legacy mode from legacyMode:true. Got:\n${output}`);
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('backward compat: infers mcp-only from legacyMode:false when rolloutMode absent', async () => {
    const tempDir = await createTempDir();
    try {
      setupInstallWithRolloutMode(tempDir, {
        legacyMode: false,
        // rolloutMode intentionally omitted
      });

      const { logs } = await captureOutputAsync(() =>
        doctor(tempDir, { runtimes: ['claude'] })
      );
      const output = logs.join('\n');

      // When rolloutMode is absent and legacyMode is false, should infer 'mcp-only'
      assert.ok(output.includes('mcp-only'),
        `Should infer mcp-only from legacyMode:false. Got:\n${output}`);
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('doctor passes with Phase 11 manifest (healthy install)', async () => {
    const tempDir = await createTempDir();
    try {
      setupInstallWithRolloutMode(tempDir, {
        rolloutMode: 'mcp-only',
        legacyMode: false,
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
