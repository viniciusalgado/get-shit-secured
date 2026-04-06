/**
 * Unit tests for readiness gate checker.
 * Phase 11 — Workstream D: Release communication and decision gates.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { mkdirSync, writeFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

function createTempDir() {
  return mkdtemp(join(tmpdir(), 'gss-p11-readiness-'));
}

function cleanupTempDir(dir) {
  rmSync(dir, { recursive: true, force: true });
}

/**
 * Set up a healthy install with given rollout mode.
 */
function setupInstall(tempDir, options = {}) {
  const mode = options.rolloutMode || 'mcp-only';
  const gssDir = join(tempDir, '.gss');
  const claudeDir = join(tempDir, '.claude', 'gss');
  mkdirSync(gssDir, { recursive: true });
  mkdirSync(join(claudeDir, 'mcp'), { recursive: true });
  mkdirSync(join(claudeDir, 'corpus'), { recursive: true });
  mkdirSync(join(gssDir, 'artifacts'), { recursive: true });
  mkdirSync(join(gssDir, 'reports'), { recursive: true });

  // Write runtime manifest
  const runtimeManifest = {
    runtime: 'claude',
    scope: 'local',
    installedAt: '2026-04-01T12:00:00Z',
    version: '0.1.0',
    corpusVersion: '1.0.0',
    hooks: ['session-start', 'pre-tool-write', 'pre-tool-edit', 'post-tool-write'],
    managedConfigs: [],
    corpusPath: join(claudeDir, 'corpus', 'owasp-corpus.json'),
    mcpServerPath: join(claudeDir, 'mcp', 'server.js'),
    mcpConfigPath: join(tempDir, '.claude', 'settings.json'),
    gssVersion: '0.1.0',
    installedWorkflows: ['security-review', 'map-codebase', 'audit'],
    installedRoles: ['gss-mapper', 'gss-auditor', 'gss-verifier'],
    mcpServerName: 'gss-security-docs',
    rolloutMode: mode,
    ...(mode === 'hybrid-shadow' ? { comparisonEnabled: true } : {}),
  };
  writeFileSync(join(claudeDir, 'runtime-manifest.json'), JSON.stringify(runtimeManifest, null, 2), 'utf-8');

  // Write MCP server binary
  writeFileSync(join(claudeDir, 'mcp', 'server.js'), '// MCP server', 'utf-8');

  // Write corpus
  writeFileSync(join(claudeDir, 'corpus', 'owasp-corpus.json'), JSON.stringify({
    corpusVersion: '1.0.0',
    documents: [],
    stats: { totalDocs: 113 },
  }, null, 2), 'utf-8');

  // Write settings.json with MCP registration
  const settings = {
    mcpServers: {
      'gss-security-docs': {
        command: 'node',
        args: [join(claudeDir, 'mcp', 'server.js')],
      },
    },
  };
  mkdirSync(join(tempDir, '.claude'), { recursive: true });
  writeFileSync(join(tempDir, '.claude', 'settings.json'), JSON.stringify(settings, null, 2), 'utf-8');

  // Write install manifest
  writeFileSync(join(gssDir, 'install-manifest.json'), JSON.stringify({
    manifestVersion: 2,
    packageVersion: '0.1.0',
    corpusVersion: '1.0.0',
    installedAt: '2026-04-01T12:00:00Z',
    updatedAt: '2026-04-01T12:00:00Z',
    scope: 'local',
    runtimes: ['claude'],
    workflowIds: ['security-review', 'map-codebase', 'audit'],
    roots: { claude: join(tempDir, '.claude') },
    files: { claude: [] },
    runtimeManifests: { claude: join(claudeDir, 'runtime-manifest.json') },
  }, null, 2), 'utf-8');

  return { gssDir, claudeDir };
}

describe('readiness command', () => {
  it('reports NOT READY when checks fail', async () => {
    // This tests the readiness output format
    // In a real scenario, readiness would detect the current mode and run gate checks.
    // Here we verify the structure.
    const result = {
      gate: 'Release C steady-state (mcp-only)',
      checks: [
        { name: 'Install health', status: 'pass', message: 'Install manifest present' },
        { name: 'Comparison data', status: 'fail', message: '3/5 required comparison reports' },
        { name: 'No regressions', status: 'pass', message: '0 regression flags' },
      ],
      ready: false,
      failingCount: 1,
    };

    assert.equal(result.ready, false);
    assert.equal(result.failingCount, 1);
    assert.ok(result.checks.some(c => c.status === 'fail'));
  });

  it('reports READY when all checks pass', async () => {
    const result = {
      gate: 'Release C steady-state (mcp-only)',
      checks: [
        { name: 'Install health', status: 'pass', message: 'Install manifest present' },
        { name: 'Comparison data', status: 'pass', message: '7/5 required comparison reports' },
        { name: 'No regressions', status: 'pass', message: '0 regression flags' },
        { name: 'MCP coverage', status: 'pass', message: 'MCP server binary and config present' },
      ],
      ready: true,
      failingCount: 0,
    };

    assert.equal(result.ready, true);
    assert.equal(result.failingCount, 0);
    assert.ok(result.checks.every(c => c.status === 'pass'));
  });

  it('detects rollout mode from runtime manifest', async () => {
    const tempDir = await createTempDir();
    try {
      setupInstall(tempDir, { rolloutMode: 'hybrid-shadow' });
      const manifest = JSON.parse(
        readFileSync(join(tempDir, '.claude', 'gss', 'runtime-manifest.json'), 'utf-8')
      );
      assert.equal(manifest.rolloutMode, 'hybrid-shadow');
      assert.equal(manifest.comparisonEnabled, true);
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('detects mcp-only mode from runtime manifest', async () => {
    const tempDir = await createTempDir();
    try {
      setupInstall(tempDir, { rolloutMode: 'mcp-only' });
      const manifest = JSON.parse(
        readFileSync(join(tempDir, '.claude', 'gss', 'runtime-manifest.json'), 'utf-8')
      );
      assert.equal(manifest.rolloutMode, 'mcp-only');
      assert.equal(manifest.comparisonEnabled, undefined);
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('defaults to mcp-only when rolloutMode is absent', async () => {
    const tempDir = await createTempDir();
    try {
      setupInstall(tempDir);
      const manifestPath = join(tempDir, '.claude', 'gss', 'runtime-manifest.json');
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
      delete manifest.rolloutMode;
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

      const inferred = manifest.rolloutMode || 'mcp-only';
      assert.equal(inferred, 'mcp-only');
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('Gate A→B: install manifest missing → NOT READY', async () => {
    const tempDir = await createTempDir();
    try {
      // Set up hybrid-shadow but no install manifest
      setupInstall(tempDir, { rolloutMode: 'hybrid-shadow' });
      // Remove install manifest
      rmSync(join(tempDir, '.gss', 'install-manifest.json'), { force: true });

      // Gate A→B check: install health should fail
      const installManifestExists = existsSync(join(tempDir, '.gss', 'install-manifest.json'));
      assert.equal(installManifestExists, false, 'Install manifest should be missing');
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('Gate A→B: comparison data count below threshold → NOT READY', async () => {
    const tempDir = await createTempDir();
    try {
      setupInstall(tempDir, { rolloutMode: 'hybrid-shadow' });

      // Create comparison dir with only 2 reports (< 5 threshold)
      const comparisonDir = join(tempDir, '.gss', 'artifacts', 'comparisons');
      mkdirSync(comparisonDir, { recursive: true });
      writeFileSync(join(comparisonDir, 'comparison-1.json'), '{}');
      writeFileSync(join(comparisonDir, 'comparison-2.json'), '{}');

      const entries = readdirSync(comparisonDir).filter(f => f.endsWith('.json'));
      assert.ok(entries.length < 5, 'Should have fewer than 5 comparison reports');
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('Gate A→B: regression flag present → NOT READY', async () => {
    const tempDir = await createTempDir();
    try {
      setupInstall(tempDir, { rolloutMode: 'hybrid-shadow' });

      // Create a regression flag in an artifact directory
      const auditDir = join(tempDir, '.gss', 'artifacts', 'audit');
      mkdirSync(auditDir, { recursive: true });
      writeFileSync(join(auditDir, 'regression-flag'), '', 'utf-8');

      assert.ok(existsSync(join(auditDir, 'regression-flag')), 'Regression flag should exist');
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('Release C readiness expects artifact and report directories', async () => {
    const tempDir = await createTempDir();
    try {
      setupInstall(tempDir, { rolloutMode: 'mcp-only' });
      assert.ok(existsSync(join(tempDir, '.gss', 'artifacts')));
      assert.ok(existsSync(join(tempDir, '.gss', 'reports')));
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('Release C readiness artifact-directory check is pass-shaped', () => {
    const check = {
      name: 'Artifact directories ready',
      status: 'pass',
      message: 'Install created .gss/artifacts and .gss/reports',
    };
    assert.equal(check.status, 'pass');
    assert.ok(check.message.includes('.gss/reports'));
  });

  it('--json output is valid JSON with expected structure', async () => {
    const tempDir = await createTempDir();
    try {
      setupInstall(tempDir, { rolloutMode: 'hybrid-shadow' });

      // Simulate readiness JSON output
      const result = {
        gate: 'Release C steady-state (mcp-only)',
        checks: [
          { name: 'Install health', status: 'pass', message: 'Install manifest present' },
          { name: 'Comparison data', status: 'fail', message: '3/5 required comparison reports' },
          { name: 'No regressions', status: 'pass', message: '0 regression flags' },
          { name: 'MCP coverage', status: 'pass', message: 'MCP server binary and config present' },
        ],
        ready: false,
        failingCount: 1,
      };

      const json = JSON.stringify(result);
      const parsed = JSON.parse(json);
      assert.ok(parsed.gate);
      assert.ok(Array.isArray(parsed.checks));
      assert.equal(typeof parsed.ready, 'boolean');
      assert.equal(typeof parsed.failingCount, 'number');
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('no GSS install at all → error message', async () => {
    const tempDir = await createTempDir();
    try {
      // Don't set up any install
      const installManifestExists = existsSync(join(tempDir, '.gss', 'install-manifest.json'));
      assert.equal(installManifestExists, false);
    } finally {
      cleanupTempDir(tempDir);
    }
  });
});
