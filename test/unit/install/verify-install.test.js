/**
 * Unit tests for verifyInstall — 7 health checks.
 * Phase 9 — Workstream B: Verification stage.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

import { verifyInstall } from '../../../dist/core/install-stages.js';
import { setupHealthyInstall, createTempDir, cleanupTempDir } from './helpers.js';

describe('verifyInstall — Check 1: Corpus snapshot', () => {
  it('corpus missing at destination path', async () => {
    const tempDir = await createTempDir();
    try {
      const paths = setupHealthyInstall(tempDir);
      // Remove corpus
      rmSync(paths.corpusPath);

      const targets = {
        runtimes: ['claude'], scope: 'local', cwd: tempDir,
        roots: { claude: paths.rootPath },
        supportSubtrees: { claude: paths.supportDir },
      };
      const corpus = {
        snapshot: { corpusVersion: '1.0.0', documents: [] },
        corpusVersion: '1.0.0',
        sourcePath: '/mock',
        destinationPaths: { claude: paths.corpusPath },
      };
      const result = await verifyInstall(targets, corpus, null, { dryRun: false });
      assert.equal(result.healthy, false);
      assert.ok(result.errors.some(e => e.includes('corpus snapshot not found')));
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('corpus present but invalid JSON', async () => {
    const tempDir = await createTempDir();
    try {
      const paths = setupHealthyInstall(tempDir);
      writeFileSync(paths.corpusPath, 'not-json');

      const targets = {
        runtimes: ['claude'], scope: 'local', cwd: tempDir,
        roots: { claude: paths.rootPath },
        supportSubtrees: { claude: paths.supportDir },
      };
      const corpus = {
        snapshot: { corpusVersion: '1.0.0', documents: [] },
        corpusVersion: '1.0.0',
        sourcePath: '/mock',
        destinationPaths: { claude: paths.corpusPath },
      };
      const result = await verifyInstall(targets, corpus, null, { dryRun: false });
      assert.equal(result.healthy, false);
      assert.ok(result.errors.some(e => e.includes('not valid JSON')));
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('corpus present but missing corpusVersion', async () => {
    const tempDir = await createTempDir();
    try {
      const paths = setupHealthyInstall(tempDir);
      writeFileSync(paths.corpusPath, JSON.stringify({ documents: [] }));

      const targets = {
        runtimes: ['claude'], scope: 'local', cwd: tempDir,
        roots: { claude: paths.rootPath },
        supportSubtrees: { claude: paths.supportDir },
      };
      const corpus = {
        snapshot: { corpusVersion: '1.0.0', documents: [] },
        corpusVersion: '1.0.0',
        sourcePath: '/mock',
        destinationPaths: { claude: paths.corpusPath },
      };
      const result = await verifyInstall(targets, corpus, null, { dryRun: false });
      assert.equal(result.healthy, false);
      assert.ok(result.errors.some(e => e.includes('missing corpusVersion')));
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('corpus valid and present', async () => {
    const tempDir = await createTempDir();
    try {
      const paths = setupHealthyInstall(tempDir);

      const targets = {
        runtimes: ['claude'], scope: 'local', cwd: tempDir,
        roots: { claude: paths.rootPath },
        supportSubtrees: { claude: paths.supportDir },
      };
      const corpus = {
        snapshot: { corpusVersion: '1.0.0', documents: [] },
        corpusVersion: '1.0.0',
        sourcePath: '/mock',
        destinationPaths: { claude: paths.corpusPath },
      };
      const result = await verifyInstall(targets, corpus, {
        serverBinaryPaths: { claude: paths.mcpServerPath },
        configPaths: { claude: paths.mcpConfigPath },
      }, { dryRun: false });
      // No corpus-related errors
      assert.ok(!result.errors.some(e => e.includes('corpus')));
    } finally {
      cleanupTempDir(tempDir);
    }
  });
});

describe('verifyInstall — Check 2: MCP server binary', () => {
  it('MCP server binary missing', async () => {
    const tempDir = await createTempDir();
    try {
      const paths = setupHealthyInstall(tempDir);
      rmSync(paths.mcpServerPath);

      const targets = {
        runtimes: ['claude'], scope: 'local', cwd: tempDir,
        roots: { claude: paths.rootPath },
        supportSubtrees: { claude: paths.supportDir },
      };
      const result = await verifyInstall(targets, null, {
        serverBinaryPaths: { claude: paths.mcpServerPath },
      }, { dryRun: false });
      assert.ok(result.errors.some(e => e.includes('MCP server binary not found')));
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('MCP server binary present', async () => {
    const tempDir = await createTempDir();
    try {
      const paths = setupHealthyInstall(tempDir);
      const targets = {
        runtimes: ['claude'], scope: 'local', cwd: tempDir,
        roots: { claude: paths.rootPath },
        supportSubtrees: { claude: paths.supportDir },
      };
      const result = await verifyInstall(targets, null, {
        serverBinaryPaths: { claude: paths.mcpServerPath },
      }, { dryRun: false });
      assert.ok(!result.errors.some(e => e.includes('MCP server binary')));
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('no MCP result skips check gracefully', async () => {
    const tempDir = await createTempDir();
    try {
      const paths = setupHealthyInstall(tempDir);
      const targets = {
        runtimes: ['claude'], scope: 'local', cwd: tempDir,
        roots: { claude: paths.rootPath },
        supportSubtrees: { claude: paths.supportDir },
      };
      const result = await verifyInstall(targets, null, null, { dryRun: false });
      // Should not have MCP binary errors when no MCP result provided
      assert.ok(!result.errors.some(e => e.includes('MCP server binary')));
    } finally {
      cleanupTempDir(tempDir);
    }
  });
});

describe('verifyInstall — Check 3: MCP config registration', () => {
  it('MCP config missing gss-security-docs entry', async () => {
    const tempDir = await createTempDir();
    try {
      const paths = setupHealthyInstall(tempDir);
      writeFileSync(paths.mcpConfigPath, JSON.stringify({}));

      const targets = {
        runtimes: ['claude'], scope: 'local', cwd: tempDir,
        roots: { claude: paths.rootPath },
        supportSubtrees: { claude: paths.supportDir },
      };
      const result = await verifyInstall(targets, null, {
        configPaths: { claude: paths.mcpConfigPath },
      }, { dryRun: false });
      assert.ok(result.errors.some(e => e.includes('missing mcpServers.gss-security-docs') || e.includes('MCP not registered')));
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('MCP config has gss-security-docs entry', async () => {
    const tempDir = await createTempDir();
    try {
      const paths = setupHealthyInstall(tempDir);
      const targets = {
        runtimes: ['claude'], scope: 'local', cwd: tempDir,
        roots: { claude: paths.rootPath },
        supportSubtrees: { claude: paths.supportDir },
      };
      const result = await verifyInstall(targets, null, {
        configPaths: { claude: paths.mcpConfigPath },
      }, { dryRun: false });
      assert.ok(!result.errors.some(e => e.includes('gss-security-docs')));
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('MCP config file missing', async () => {
    const tempDir = await createTempDir();
    try {
      const paths = setupHealthyInstall(tempDir);
      rmSync(paths.mcpConfigPath);

      const targets = {
        runtimes: ['claude'], scope: 'local', cwd: tempDir,
        roots: { claude: paths.rootPath },
        supportSubtrees: { claude: paths.supportDir },
      };
      const result = await verifyInstall(targets, null, {
        configPaths: { claude: paths.mcpConfigPath },
      }, { dryRun: false });
      assert.ok(result.errors.some(e => e.includes('MCP config not found')));
    } finally {
      cleanupTempDir(tempDir);
    }
  });
});

describe('verifyInstall — Check 4: Runtime manifest', () => {
  it('runtime manifest missing', async () => {
    const tempDir = await createTempDir();
    try {
      const paths = setupHealthyInstall(tempDir);
      rmSync(paths.runtimeManifestPath);

      const targets = {
        runtimes: ['claude'], scope: 'local', cwd: tempDir,
        roots: { claude: paths.rootPath },
        supportSubtrees: { claude: paths.supportDir },
      };
      const result = await verifyInstall(targets, null, null, { dryRun: false });
      assert.ok(result.errors.some(e => e.includes('runtime manifest not found')));
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('runtime manifest missing required fields', async () => {
    const tempDir = await createTempDir();
    try {
      const paths = setupHealthyInstall(tempDir);
      writeFileSync(paths.runtimeManifestPath, JSON.stringify({}));

      const targets = {
        runtimes: ['claude'], scope: 'local', cwd: tempDir,
        roots: { claude: paths.rootPath },
        supportSubtrees: { claude: paths.supportDir },
      };
      const result = await verifyInstall(targets, null, null, { dryRun: false });
      assert.ok(result.errors.some(e => e.includes('missing required fields')));
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('runtime manifest valid', async () => {
    const tempDir = await createTempDir();
    try {
      const paths = setupHealthyInstall(tempDir);
      const targets = {
        runtimes: ['claude'], scope: 'local', cwd: tempDir,
        roots: { claude: paths.rootPath },
        supportSubtrees: { claude: paths.supportDir },
      };
      const result = await verifyInstall(targets, null, null, { dryRun: false });
      assert.ok(!result.errors.some(e => e.includes('runtime manifest')));
    } finally {
      cleanupTempDir(tempDir);
    }
  });
});

describe('verifyInstall — Check 5: Hooks', () => {
  it('all 4 hooks present', async () => {
    const tempDir = await createTempDir();
    try {
      const paths = setupHealthyInstall(tempDir);
      const targets = {
        runtimes: ['claude'], scope: 'local', cwd: tempDir,
        roots: { claude: paths.rootPath },
        supportSubtrees: { claude: paths.supportDir },
      };
      const result = await verifyInstall(targets, null, null, { dryRun: false });
      assert.ok(!result.errors.some(e => e.includes('hooks')));
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('missing hooks reported', async () => {
    const tempDir = await createTempDir();
    try {
      const paths = setupHealthyInstall(tempDir);
      rmSync(join(paths.hooksDir, 'session-start.js'));
      rmSync(join(paths.hooksDir, 'pre-tool-write.js'));

      const targets = {
        runtimes: ['claude'], scope: 'local', cwd: tempDir,
        roots: { claude: paths.rootPath },
        supportSubtrees: { claude: paths.supportDir },
      };
      const result = await verifyInstall(targets, null, null, { dryRun: false });
      assert.ok(result.errors.some(e => e.includes('hooks missing')));
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('hooks directory missing', async () => {
    const tempDir = await createTempDir();
    try {
      const paths = setupHealthyInstall(tempDir);
      rmSync(paths.hooksDir, { recursive: true, force: true });

      const targets = {
        runtimes: ['claude'], scope: 'local', cwd: tempDir,
        roots: { claude: paths.rootPath },
        supportSubtrees: { claude: paths.supportDir },
      };
      const result = await verifyInstall(targets, null, null, { dryRun: false });
      assert.ok(result.errors.some(e => e.includes('hooks directory not found')));
    } finally {
      cleanupTempDir(tempDir);
    }
  });
});

describe('verifyInstall — Check 6: Artifact directories', () => {
  it('both artifact directories present', async () => {
    const tempDir = await createTempDir();
    try {
      const paths = setupHealthyInstall(tempDir);
      const targets = {
        runtimes: ['claude'], scope: 'local', cwd: tempDir,
        roots: { claude: paths.rootPath },
        supportSubtrees: { claude: paths.supportDir },
      };
      const result = await verifyInstall(targets, null, null, { dryRun: false });
      assert.ok(!result.errors.some(e => e.includes('artifact directory not found')));
      assert.ok(!result.errors.some(e => e.includes('reports directory not found')));
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('missing .gss/artifacts/', async () => {
    const tempDir = await createTempDir();
    try {
      const paths = setupHealthyInstall(tempDir);
      rmSync(paths.artifactsDir, { recursive: true, force: true });

      const targets = {
        runtimes: ['claude'], scope: 'local', cwd: tempDir,
        roots: { claude: paths.rootPath },
        supportSubtrees: { claude: paths.supportDir },
      };
      const result = await verifyInstall(targets, null, null, { dryRun: false });
      assert.ok(result.errors.some(e => e.includes('artifact directory not found')));
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('missing .gss/reports/', async () => {
    const tempDir = await createTempDir();
    try {
      const paths = setupHealthyInstall(tempDir);
      rmSync(paths.reportsDir, { recursive: true, force: true });

      const targets = {
        runtimes: ['claude'], scope: 'local', cwd: tempDir,
        roots: { claude: paths.rootPath },
        supportSubtrees: { claude: paths.supportDir },
      };
      const result = await verifyInstall(targets, null, null, { dryRun: false });
      assert.ok(result.errors.some(e => e.includes('reports directory not found')));
    } finally {
      cleanupTempDir(tempDir);
    }
  });
});

describe('verifyInstall — Check 7: Manifest consistency', () => {
  it('corpus versions match', async () => {
    const tempDir = await createTempDir();
    try {
      const paths = setupHealthyInstall(tempDir, { corpusVersion: '1.0.0' });
      const targets = {
        runtimes: ['claude'], scope: 'local', cwd: tempDir,
        roots: { claude: paths.rootPath },
        supportSubtrees: { claude: paths.supportDir },
      };
      const corpus = {
        snapshot: { corpusVersion: '1.0.0', documents: [] },
        corpusVersion: '1.0.0',
        sourcePath: '/mock',
        destinationPaths: { claude: paths.corpusPath },
      };
      const result = await verifyInstall(targets, corpus, null, { dryRun: false });
      assert.ok(!result.errors.some(e => e.includes('version mismatch')));
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('corpus versions differ', async () => {
    const tempDir = await createTempDir();
    try {
      const paths = setupHealthyInstall(tempDir, {
        corpusVersion: '1.0.0',
        installManifestData: undefined,
      });
      // Write install manifest with different version
      const installManifest = {
        manifestVersion: 2,
        packageVersion: '0.1.0',
        corpusVersion: '2.0.0',
        installedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        scope: 'local',
        runtimes: ['claude'],
        workflowIds: [],
        roots: { claude: paths.rootPath },
        files: { claude: [] },
        managedConfigs: {},
        hooks: {},
        runtimeManifests: {},
      };
      writeFileSync(paths.installManifestPath, JSON.stringify(installManifest, null, 2));

      const targets = {
        runtimes: ['claude'], scope: 'local', cwd: tempDir,
        roots: { claude: paths.rootPath },
        supportSubtrees: { claude: paths.supportDir },
      };
      const corpus = {
        snapshot: { corpusVersion: '1.0.0', documents: [] },
        corpusVersion: '1.0.0',
        sourcePath: '/mock',
        destinationPaths: { claude: paths.corpusPath },
      };
      const result = await verifyInstall(targets, corpus, null, { dryRun: false });
      assert.ok(result.errors.some(e => e.includes('corpus version mismatch')));
    } finally {
      cleanupTempDir(tempDir);
    }
  });
});

describe('verifyInstall — Overall health', () => {
  it('healthy install passes all checks', async () => {
    const tempDir = await createTempDir();
    try {
      const paths = setupHealthyInstall(tempDir);
      const targets = {
        runtimes: ['claude'], scope: 'local', cwd: tempDir,
        roots: { claude: paths.rootPath },
        supportSubtrees: { claude: paths.supportDir },
      };
      const corpus = {
        snapshot: { corpusVersion: '1.0.0', documents: [] },
        corpusVersion: '1.0.0',
        sourcePath: '/mock',
        destinationPaths: { claude: paths.corpusPath },
      };
      const mcpResult = {
        serverBinaryPaths: { claude: paths.mcpServerPath },
        configPaths: { claude: paths.mcpConfigPath },
        errors: [],
      };
      const result = await verifyInstall(targets, corpus, mcpResult, { dryRun: false });
      assert.equal(result.healthy, true);
      assert.equal(result.errors.length, 0);
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('dry-run always returns healthy', async () => {
    const result = await verifyInstall(
      { runtimes: ['claude'], scope: 'local', cwd: '/nonexistent', roots: { claude: '/x' }, supportSubtrees: { claude: '/x/gss' } },
      null, null, { dryRun: true }
    );
    assert.equal(result.healthy, true);
    assert.equal(result.errors.length, 0);
  });

  it('null corpus skips corpus checks', async () => {
    const tempDir = await createTempDir();
    try {
      const paths = setupHealthyInstall(tempDir);
      // Remove corpus to confirm it's not checked
      rmSync(paths.corpusPath);

      const targets = {
        runtimes: ['claude'], scope: 'local', cwd: tempDir,
        roots: { claude: paths.rootPath },
        supportSubtrees: { claude: paths.supportDir },
      };
      const result = await verifyInstall(targets, null, null, { dryRun: false });
      assert.ok(!result.errors.some(e => e.includes('corpus snapshot')));
    } finally {
      cleanupTempDir(tempDir);
    }
  });
});
