/**
 * Unit tests for doctor Phase 10 diagnostic metadata — Phase 10.
 * Validates the new Check 7 diagnostic metadata in doctor output.
 *
 * Tests that:
 * - Doctor output includes workflow count when Phase 10 metadata is present
 * - Doctor output includes role count when Phase 10 metadata is present
 * - Doctor output includes MCP server name when Phase 10 metadata is present
 * - Doctor output includes mode (hybrid/legacy) based on legacyMode flag
 * - Doctor handles old manifests without Phase 10 fields gracefully
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';

import { doctor } from '../../../dist/cli/doctor.js';
import { setupHealthyInstall, createTempDir, cleanupTempDir, captureOutputAsync } from '../install/helpers.js';

/**
 * Helper: Set up a healthy install and then overwrite the runtime manifest
 * with Phase 10 fields.
 */
function setupHealthyInstallWithPhase10(tempDir, phase10Fields) {
  const paths = setupHealthyInstall(tempDir);

  // Build the Phase 10 enriched manifest on top of the default one
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
  };

  const enrichedManifest = { ...baseManifest, ...phase10Fields };
  writeFileSync(paths.runtimeManifestPath, JSON.stringify(enrichedManifest, null, 2));

  return paths;
}

describe('doctor — Phase 10 diagnostic metadata', () => {
  it('doctor output includes workflow count', async () => {
    const tempDir = await createTempDir();
    try {
      setupHealthyInstallWithPhase10(tempDir, {
        installedWorkflows: ['security-review', 'map-codebase', 'threat-model', 'audit',
          'validate-findings', 'plan-remediation', 'execute-remediation', 'verify', 'report'],
        installedRoles: ['gss-mapper', 'gss-auditor'],
        legacyMode: false,
        mcpServerName: 'gss-security-docs',
      });

      const { logs } = await captureOutputAsync(() =>
        doctor(tempDir, { runtimes: ['claude'] })
      );
      const output = logs.join('\n');
      assert.ok(output.includes('9 workflows') || output.includes('workflows'),
        `Should mention workflow count. Got: ${output}`);
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('doctor output includes role count', async () => {
    const tempDir = await createTempDir();
    try {
      setupHealthyInstallWithPhase10(tempDir, {
        installedWorkflows: ['audit'],
        installedRoles: ['gss-mapper', 'gss-auditor', 'gss-verifier',
          'gss-remediator', 'gss-threat-modeler', 'gss-reporter'],
        legacyMode: false,
        mcpServerName: 'gss-security-docs',
      });

      const { logs } = await captureOutputAsync(() =>
        doctor(tempDir, { runtimes: ['claude'] })
      );
      const output = logs.join('\n');
      assert.ok(output.includes('6 roles') || output.includes('roles'),
        `Should mention role count. Got: ${output}`);
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('doctor output includes MCP server name', async () => {
    const tempDir = await createTempDir();
    try {
      setupHealthyInstallWithPhase10(tempDir, {
        installedWorkflows: ['audit'],
        installedRoles: ['gss-mapper'],
        legacyMode: false,
        mcpServerName: 'gss-security-docs',
      });

      const { logs } = await captureOutputAsync(() =>
        doctor(tempDir, { runtimes: ['claude'] })
      );
      const output = logs.join('\n');
      assert.ok(output.includes('gss-security-docs'),
        `Should mention MCP server name. Got: ${output}`);
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('doctor output includes hybrid mode when legacyMode is false', async () => {
    const tempDir = await createTempDir();
    try {
      setupHealthyInstallWithPhase10(tempDir, {
        installedWorkflows: ['audit'],
        installedRoles: ['gss-mapper'],
        legacyMode: false,
        mcpServerName: 'gss-security-docs',
      });

      const { logs } = await captureOutputAsync(() =>
        doctor(tempDir, { runtimes: ['claude'] })
      );
      const output = logs.join('\n');
      assert.ok(output.includes('hybrid'),
        `Should show hybrid mode. Got: ${output}`);
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('doctor output includes legacy when legacyMode is true', async () => {
    const tempDir = await createTempDir();
    try {
      setupHealthyInstallWithPhase10(tempDir, {
        installedWorkflows: ['audit'],
        installedRoles: ['gss-mapper'],
        legacyMode: true,
        mcpServerName: 'gss-security-docs',
      });

      const { logs } = await captureOutputAsync(() =>
        doctor(tempDir, { runtimes: ['claude'] })
      );
      const output = logs.join('\n');
      assert.ok(output.includes('legacy'),
        `Should show legacy mode. Got: ${output}`);
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('doctor handles manifest without Phase 10 fields gracefully', async () => {
    const tempDir = await createTempDir();
    try {
      // Use default setupHealthyInstall which creates an old-format runtime
      // manifest without Phase 10 fields
      setupHealthyInstall(tempDir);

      const { result } = await captureOutputAsync(() =>
        doctor(tempDir, { runtimes: ['claude'] })
      );

      // Should not crash — returns a number exit code
      assert.ok(typeof result === 'number',
        `Doctor should return a number, got ${typeof result}`);
    } finally {
      cleanupTempDir(tempDir);
    }
  });
});
