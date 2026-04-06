/**
 * Unit tests for install migration utility.
 * Phase 11 — Workstream C: Upgrade and downgrade paths.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { migrateInstall } from '../../../dist/cli/migrate-install.js';

function createTempDir() {
  return mkdtemp(join(tmpdir(), 'gss-p11-migrate-'));
}

function cleanupTempDir(dir) {
  rmSync(dir, { recursive: true, force: true });
}

function setupV2Install(tempDir, options = {}) {
  const gssDir = join(tempDir, '.gss');
  const claudeDir = join(tempDir, '.claude', 'gss');
  mkdirSync(gssDir, { recursive: true });
  mkdirSync(claudeDir, { recursive: true });

  const runtimeManifest = {
    runtime: 'claude',
    scope: 'local',
    installedAt: '2026-04-01T12:00:00Z',
    version: '0.1.0',
    corpusVersion: options.corpusVersion || '1.0.0',
    hooks: ['session-start', 'pre-tool-write', 'pre-tool-edit', 'post-tool-write'],
    managedConfigs: [],
    corpusPath: join(claudeDir, 'corpus', 'owasp-corpus.json'),
    mcpServerPath: join(claudeDir, 'mcp', 'server.js'),
    mcpConfigPath: join(tempDir, '.claude', 'settings.json'),
    gssVersion: '0.1.0',
    installedWorkflows: ['security-review', 'audit'],
    installedRoles: ['gss-mapper', 'gss-auditor'],
    mcpServerName: 'gss-security-docs',
    rolloutMode: options.rolloutMode || 'mcp-only',
    ...options.runtimeManifestOverrides,
  };

  const runtimeManifestPath = join(claudeDir, 'runtime-manifest.json');
  writeFileSync(runtimeManifestPath, JSON.stringify(runtimeManifest, null, 2), 'utf-8');

  const installManifest = {
    manifestVersion: 2,
    packageVersion: '0.1.0',
    corpusVersion: options.corpusVersion || '1.0.0',
    installedAt: '2026-04-01T12:00:00Z',
    updatedAt: '2026-04-01T12:00:00Z',
    scope: 'local',
    runtimes: ['claude'],
    workflowIds: ['security-review', 'audit'],
    roots: { claude: join(tempDir, '.claude') },
    files: { claude: [] },
    managedConfigs: {},
    hooks: { claude: [join(claudeDir, 'hooks', 'session-start.js')] },
    runtimeManifests: { claude: runtimeManifestPath },
    mcpServerPaths: { claude: join(claudeDir, 'mcp', 'server.js') },
    mcpConfigPaths: { claude: join(tempDir, '.claude', 'settings.json') },
  };

  writeFileSync(join(gssDir, 'install-manifest.json'), JSON.stringify(installManifest, null, 2), 'utf-8');

  return { gssDir, claudeDir, runtimeManifestPath };
}

describe('migrateInstall', () => {
  it('migrates mcp-only to hybrid-shadow', async () => {
    const tempDir = await createTempDir();
    try {
      const { runtimeManifestPath } = setupV2Install(tempDir);
      const result = await migrateInstall(tempDir, { targetMode: 'hybrid-shadow', dryRun: false });

      assert.equal(result.migrated, true);
      assert.equal(result.errors.length, 0);
      assert.ok(result.changes.some(c => c.includes('hybrid-shadow')));

      // Verify runtime manifest was updated
      const updated = JSON.parse(readFileSync(runtimeManifestPath, 'utf-8'));
      assert.equal(updated.rolloutMode, 'hybrid-shadow');
      assert.equal(updated.comparisonEnabled, true);
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('migrates hybrid-shadow back to mcp-only', async () => {
    const tempDir = await createTempDir();
    try {
      const { runtimeManifestPath } = setupV2Install(tempDir, {
        rolloutMode: 'hybrid-shadow',
        runtimeManifestOverrides: { comparisonEnabled: true },
      });
      const result = await migrateInstall(tempDir, { targetMode: 'mcp-only', dryRun: false });

      assert.equal(result.migrated, true);
      assert.equal(result.errors.length, 0);

      const updated = JSON.parse(readFileSync(runtimeManifestPath, 'utf-8'));
      assert.equal(updated.rolloutMode, 'mcp-only');
      assert.equal(updated.comparisonEnabled, undefined);
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('dry-run does not modify files', async () => {
    const tempDir = await createTempDir();
    try {
      const { runtimeManifestPath } = setupV2Install(tempDir);
      const beforeContent = readFileSync(runtimeManifestPath, 'utf-8');

      const result = await migrateInstall(tempDir, { targetMode: 'hybrid-shadow', dryRun: true });

      assert.equal(result.migrated, false);
      assert.ok(result.changes.some(c => c.includes('[dry-run]')));

      const afterContent = readFileSync(runtimeManifestPath, 'utf-8');
      assert.equal(beforeContent, afterContent, 'Files should not be modified in dry-run mode');
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('reports error when no install manifest found', async () => {
    const tempDir = await createTempDir();
    try {
      const result = await migrateInstall(tempDir, { targetMode: 'mcp-only', dryRun: false });
      assert.equal(result.migrated, false);
      assert.ok(result.errors.length > 0);
      assert.ok(result.errors[0].includes('No install manifest'));
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('reports no change when already at target mode', async () => {
    const tempDir = await createTempDir();
    try {
      setupV2Install(tempDir, { rolloutMode: 'mcp-only' });
      const result = await migrateInstall(tempDir, { targetMode: 'mcp-only', dryRun: false });
      assert.ok(result.changes.some(c => c.includes('no change needed')));
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('handles corrupted manifest JSON gracefully', async () => {
    const tempDir = await createTempDir();
    try {
      const gssDir = join(tempDir, '.gss');
      mkdirSync(gssDir, { recursive: true });
      // Write corrupted JSON
      writeFileSync(join(gssDir, 'install-manifest.json'), '{ invalid json !!!', 'utf-8');

      const result = await migrateInstall(tempDir, { targetMode: 'mcp-only', dryRun: false });
      assert.equal(result.migrated, false);
      assert.ok(result.errors.length > 0);
      assert.ok(result.errors.some(e => e.includes('Cannot parse')));
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('migrates v1 (pre-V2) manifest to v2 with rollout mode', async () => {
    const tempDir = await createTempDir();
    try {
      const gssDir = join(tempDir, '.gss');
      const claudeDir = join(tempDir, '.claude');
      mkdirSync(gssDir, { recursive: true });
      mkdirSync(claudeDir, { recursive: true });

      // Write a v1 manifest (no manifestVersion field)
      const v1Manifest = {
        version: '0.1.0',
        installedAt: '2025-01-01T00:00:00Z',
        scope: 'local',
        runtimes: ['claude'],
        workflows: ['security-review', 'audit'],
        roots: { claude: claudeDir },
        files: { claude: [] },
      };
      writeFileSync(join(gssDir, 'install-manifest.json'), JSON.stringify(v1Manifest, null, 2), 'utf-8');

      const result = await migrateInstall(tempDir, { targetMode: 'mcp-only', dryRun: false });
      // v1 → v2 conversion succeeds for the install manifest
      // but runtime manifest update fails (v1 installs don't have runtime manifests)
      assert.ok(result.changes.some(c => c.includes('v1') || c.includes('v2') || c.includes('Converted')));

      // Verify the manifest was converted to v2
      const updated = JSON.parse(readFileSync(join(gssDir, 'install-manifest.json'), 'utf-8'));
      assert.equal(updated.manifestVersion, 2);
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('reports error when runtime manifest is missing for a runtime', async () => {
    const tempDir = await createTempDir();
    try {
      const { gssDir } = setupV2Install(tempDir, { rolloutMode: 'mcp-only' });

      // Remove the runtime manifest to simulate missing file
      const installManifest = JSON.parse(readFileSync(join(gssDir, 'install-manifest.json'), 'utf-8'));
      // Point runtime manifest to a nonexistent path
      installManifest.runtimeManifests = { claude: join(tempDir, '.claude', 'gss', 'nonexistent-manifest.json') };
      writeFileSync(join(gssDir, 'install-manifest.json'), JSON.stringify(installManifest, null, 2), 'utf-8');

      const result = await migrateInstall(tempDir, { targetMode: 'hybrid-shadow', dryRun: false });
      assert.ok(result.errors.some(e => e.includes('not found') || e.includes('Runtime manifest')));
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('migrates multiple runtimes — both get updated', async () => {
    const tempDir = await createTempDir();
    try {
      const gssDir = join(tempDir, '.gss');
      const claudeDir = join(tempDir, '.claude', 'gss');
      const codexDir = join(tempDir, '.codex', 'gss');
      mkdirSync(gssDir, { recursive: true });
      mkdirSync(claudeDir, { recursive: true });
      mkdirSync(codexDir, { recursive: true });

      // Set up two runtime manifests
      const claudeManifest = {
        runtime: 'claude', scope: 'local', installedAt: '2026-04-01T12:00:00Z',
        version: '0.1.0', corpusVersion: '1.0.0',
        hooks: ['session-start'], managedConfigs: [],
        rolloutMode: 'mcp-only',
      };
      const codexManifest = {
        runtime: 'codex', scope: 'local', installedAt: '2026-04-01T12:00:00Z',
        version: '0.1.0', corpusVersion: '1.0.0',
        hooks: ['session-start'], managedConfigs: [],
        rolloutMode: 'mcp-only',
      };

      const claudeManifestPath = join(claudeDir, 'runtime-manifest.json');
      const codexManifestPath = join(codexDir, 'runtime-manifest.json');
      writeFileSync(claudeManifestPath, JSON.stringify(claudeManifest, null, 2), 'utf-8');
      writeFileSync(codexManifestPath, JSON.stringify(codexManifest, null, 2), 'utf-8');

      const installManifest = {
        manifestVersion: 2,
        packageVersion: '0.1.0',
        corpusVersion: '1.0.0',
        installedAt: '2026-04-01T12:00:00Z',
        updatedAt: '2026-04-01T12:00:00Z',
        scope: 'local',
        runtimes: ['claude', 'codex'],
        workflowIds: ['security-review', 'audit'],
        roots: { claude: join(tempDir, '.claude'), codex: join(tempDir, '.codex') },
        files: { claude: [], codex: [] },
        managedConfigs: {},
        hooks: {},
        runtimeManifests: { claude: claudeManifestPath, codex: codexManifestPath },
      };
      writeFileSync(join(gssDir, 'install-manifest.json'), JSON.stringify(installManifest, null, 2), 'utf-8');

      const result = await migrateInstall(tempDir, { targetMode: 'hybrid-shadow', dryRun: false });
      assert.equal(result.migrated, true);
      assert.equal(result.errors.length, 0);

      // Verify both runtime manifests were updated
      const updatedClaude = JSON.parse(readFileSync(claudeManifestPath, 'utf-8'));
      const updatedCodex = JSON.parse(readFileSync(codexManifestPath, 'utf-8'));
      assert.equal(updatedClaude.rolloutMode, 'hybrid-shadow');
      assert.equal(updatedClaude.comparisonEnabled, true);
      assert.equal(updatedCodex.rolloutMode, 'hybrid-shadow');
      assert.equal(updatedCodex.comparisonEnabled, true);
    } finally {
      cleanupTempDir(tempDir);
    }
  });
});
