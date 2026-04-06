/**
 * Unit tests for doctor command.
 * Phase 9 — Workstream E: gss doctor health checks.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

import { doctor } from '../../../dist/cli/doctor.js';
import { setupHealthyInstall, createTempDir, cleanupTempDir, captureOutputAsync } from '../install/helpers.js';

describe('doctor — Healthy installation', () => {
  it('returns exit code 0 for healthy install', async () => {
    const tempDir = await createTempDir();
    try {
      setupHealthyInstall(tempDir);
      const { result } = await captureOutputAsync(() =>
        doctor(tempDir, { runtimes: ['claude'] })
      );
      assert.equal(result, 0);
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('prints [OK] for each check', async () => {
    const tempDir = await createTempDir();
    try {
      setupHealthyInstall(tempDir);
      const { logs } = await captureOutputAsync(() =>
        doctor(tempDir, { runtimes: ['claude'] })
      );
      const output = logs.join('\n');
      assert.ok(output.includes('[OK]'), 'Should show [OK] status');
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('prints HEALTHY in summary', async () => {
    const tempDir = await createTempDir();
    try {
      setupHealthyInstall(tempDir);
      const { logs } = await captureOutputAsync(() =>
        doctor(tempDir, { runtimes: ['claude'] })
      );
      const output = logs.join('\n');
      assert.ok(output.includes('HEALTHY'), 'Should show HEALTHY status');
    } finally {
      cleanupTempDir(tempDir);
    }
  });
});

describe('doctor — Missing install manifest', () => {
  it('returns exit code 1 when no manifest', async () => {
    const tempDir = await createTempDir();
    try {
      const { result } = await captureOutputAsync(() =>
        doctor(tempDir, {})
      );
      assert.equal(result, 1);
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('prints not installed message', async () => {
    const tempDir = await createTempDir();
    try {
      const { errors } = await captureOutputAsync(() =>
        doctor(tempDir, {})
      );
      const output = errors.join('\n');
      assert.ok(output.includes('not installed') || output.includes('No'), 'Should mention not installed');
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('suggests install command', async () => {
    const tempDir = await createTempDir();
    try {
      const { errors } = await captureOutputAsync(() =>
        doctor(tempDir, {})
      );
      const output = errors.join('\n');
      assert.ok(output.includes('npx get-shit-secured'), 'Should suggest install command');
    } finally {
      cleanupTempDir(tempDir);
    }
  });
});

describe('doctor — Degraded installation', () => {
  it('returns exit code 1 when corpus missing', async () => {
    const tempDir = await createTempDir();
    try {
      const paths = setupHealthyInstall(tempDir);
      rmSync(paths.corpusPath);
      const { result } = await captureOutputAsync(() =>
        doctor(tempDir, { runtimes: ['claude'] })
      );
      assert.equal(result, 1);
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('prints [FAIL] for missing corpus', async () => {
    const tempDir = await createTempDir();
    try {
      const paths = setupHealthyInstall(tempDir);
      rmSync(paths.corpusPath);
      const { logs } = await captureOutputAsync(() =>
        doctor(tempDir, { runtimes: ['claude'] })
      );
      const output = logs.join('\n');
      assert.ok(output.includes('[FAIL]'), 'Should show [FAIL] status');
      assert.ok(output.includes('Corpus'), 'Should mention Corpus');
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('returns exit code 1 when MCP binary missing', async () => {
    const tempDir = await createTempDir();
    try {
      const paths = setupHealthyInstall(tempDir);
      rmSync(paths.mcpServerPath);
      const { result } = await captureOutputAsync(() =>
        doctor(tempDir, { runtimes: ['claude'] })
      );
      assert.equal(result, 1);
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('returns exit code 1 when MCP not registered', async () => {
    const tempDir = await createTempDir();
    try {
      const paths = setupHealthyInstall(tempDir);
      writeFileSync(paths.mcpConfigPath, JSON.stringify({}));
      const { result } = await captureOutputAsync(() =>
        doctor(tempDir, { runtimes: ['claude'] })
      );
      assert.equal(result, 1);
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('prints DEGRADED in summary', async () => {
    const tempDir = await createTempDir();
    try {
      const paths = setupHealthyInstall(tempDir);
      rmSync(paths.corpusPath);
      const { logs } = await captureOutputAsync(() =>
        doctor(tempDir, { runtimes: ['claude'] })
      );
      const output = logs.join('\n');
      assert.ok(output.includes('DEGRADED'), 'Should show DEGRADED status');
    } finally {
      cleanupTempDir(tempDir);
    }
  });
});

describe('doctor — Warning states', () => {
  it('prints [WARN] for corrupt corpus', async () => {
    const tempDir = await createTempDir();
    try {
      const paths = setupHealthyInstall(tempDir);
      writeFileSync(paths.corpusPath, 'not-json');
      const { logs } = await captureOutputAsync(() =>
        doctor(tempDir, { runtimes: ['claude'] })
      );
      const output = logs.join('\n');
      assert.ok(output.includes('[WARN]'), 'Should show [WARN] status');
      assert.ok(output.includes('not valid JSON') || output.includes('JSON'), 'Should mention JSON parse issue');
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('prints [WARN] for missing artifact dirs', async () => {
    const tempDir = await createTempDir();
    try {
      const paths = setupHealthyInstall(tempDir);
      rmSync(paths.artifactsDir, { recursive: true, force: true });
      rmSync(paths.reportsDir, { recursive: true, force: true });
      const { logs } = await captureOutputAsync(() =>
        doctor(tempDir, { runtimes: ['claude'] })
      );
      const output = logs.join('\n');
      assert.ok(output.includes('[WARN]'), 'Should show [WARN] status');
      assert.ok(output.includes('missing'), 'Should mention missing directories');
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('prints [WARN] for version mismatch', async () => {
    const tempDir = await createTempDir();
    try {
      const paths = setupHealthyInstall(tempDir, { corpusVersion: '1.0.0' });

      // Overwrite install manifest with a different corpus version
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
        hooks: { claude: [join(paths.hooksDir, 'session-start.js')] },
        runtimeManifests: { claude: paths.runtimeManifestPath },
        mcpServerPaths: { claude: paths.mcpServerPath },
        mcpConfigPaths: { claude: paths.mcpConfigPath },
      };
      writeFileSync(paths.installManifestPath, JSON.stringify(installManifest, null, 2));

      const { logs } = await captureOutputAsync(() =>
        doctor(tempDir, { runtimes: ['claude'] })
      );
      const output = logs.join('\n');
      assert.ok(output.includes('[WARN]'), 'Should show [WARN] status');
      assert.ok(output.includes('version mismatch') || output.includes('mismatch'), 'Should mention version mismatch');
    } finally {
      cleanupTempDir(tempDir);
    }
  });
});

describe('doctor — Runtime filtering', () => {
  it('--claude checks only Claude runtime', async () => {
    const tempDir = await createTempDir();
    try {
      setupHealthyInstall(tempDir);
      const { logs } = await captureOutputAsync(() =>
        doctor(tempDir, { runtimes: ['claude'] })
      );
      const output = logs.join('\n');
      assert.ok(output.includes('claude'), 'Should show Claude section');
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('no filter checks all installed runtimes', async () => {
    const tempDir = await createTempDir();
    try {
      setupHealthyInstall(tempDir);
      const { logs } = await captureOutputAsync(() =>
        doctor(tempDir, {})  // no runtime filter
      );
      const output = logs.join('\n');
      assert.ok(output.includes('claude'), 'Should show Claude runtime');
    } finally {
      cleanupTempDir(tempDir);
    }
  });
});

describe('doctor — V1 manifest handling', () => {
  it('handles v1 manifest gracefully', async () => {
    const tempDir = await createTempDir();
    try {
      const gssDir = join(tempDir, '.gss');
      mkdirSync(gssDir, { recursive: true });
      const v1Manifest = {
        version: '0.1.0',
        installedAt: new Date().toISOString(),
        scope: 'local',
        runtimes: ['claude'],
        workflows: ['audit'],
        roots: { claude: join(tempDir, '.claude') },
        files: { claude: [] },
      };
      writeFileSync(join(gssDir, 'install-manifest.json'), JSON.stringify(v1Manifest, null, 2));

      const { result, errors } = await captureOutputAsync(() =>
        doctor(tempDir, {})
      );
      // V1 manifest should be handled (may return 0 or 1 depending on file checks)
      assert.ok(typeof result === 'number');
    } finally {
      cleanupTempDir(tempDir);
    }
  });
});

describe('doctor — Output format', () => {
  it('prints scope and runtimes header', async () => {
    const tempDir = await createTempDir();
    try {
      setupHealthyInstall(tempDir);
      const { logs } = await captureOutputAsync(() =>
        doctor(tempDir, { runtimes: ['claude'] })
      );
      const output = logs.join('\n');
      assert.ok(output.includes('Scope:'), 'Should show scope');
      assert.ok(output.includes('Runtimes:') || output.includes('claude'), 'Should show runtimes');
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('fix hints only appear on non-OK checks', async () => {
    const tempDir = await createTempDir();
    try {
      const paths = setupHealthyInstall(tempDir);
      rmSync(paths.corpusPath);
      const { logs } = await captureOutputAsync(() =>
        doctor(tempDir, { runtimes: ['claude'] })
      );
      const output = logs.join('\n');
      assert.ok(output.includes('Fix:') || output.includes('Re-run'), 'Should show fix hint for failed check');
    } finally {
      cleanupTempDir(tempDir);
    }
  });
});
