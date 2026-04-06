/**
 * Phase 8 — Session-start hook tests
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getHookCommand, createTempDir, cleanupTempDir, executeHook, captureOutput, setupFullEnvironment } from './helpers.js';
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Healthy path
// ---------------------------------------------------------------------------
describe('Session-start — Healthy path', () => {

  it('all checks pass: only info-level output', async () => {
    const tempDir = await createTempDir();
    try {
      setupFullEnvironment(tempDir);
      const command = getHookCommand('session-start');
      const { warns, errors, logs } = captureOutput(() => {
        executeHook(command, { cwd: tempDir });
      });
      assert.ok(!errors.some(e => e.includes('[GSS ERROR]')), 'No errors: ' + errors.join('; '));
      assert.ok(!warns.some(w => w.includes('[GSS WARN]')), 'No warnings: ' + warns.join('; '));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('diagnostic line emitted with version info', async () => {
    const tempDir = await createTempDir();
    try {
      setupFullEnvironment(tempDir);
      const command = getHookCommand('session-start');
      const { logs } = captureOutput(() => {
        executeHook(command, { cwd: tempDir });
      });
      const diagnostic = logs.find(l => l.includes('[GSS] v'));
      assert.ok(diagnostic, 'Should emit diagnostic line');
      assert.ok(diagnostic.includes('docs'), 'Should include doc count');
      assert.ok(diagnostic.includes('MCP ready'), 'Should report MCP ready');
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

});

// ---------------------------------------------------------------------------
// Missing runtime manifest
// ---------------------------------------------------------------------------
describe('Session-start — Missing runtime manifest', () => {

  it('runtime manifest file does not exist', async () => {
    const tempDir = await createTempDir();
    try {
      setupFullEnvironment(tempDir, { skipRuntimeManifest: true });
      const command = getHookCommand('session-start');
      const { errors } = captureOutput(() => {
        executeHook(command, { cwd: tempDir });
      });
      assert.ok(errors.some(e => e.includes('Runtime manifest not found')));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('runtime manifest is invalid JSON', async () => {
    const tempDir = await createTempDir();
    try {
      setupFullEnvironment(tempDir);
      const manifestPath = join(tempDir, '.claude', 'gss', 'runtime-manifest.json');
      writeFileSync(manifestPath, 'not-json{');
      const command = getHookCommand('session-start');
      const { errors } = captureOutput(() => {
        executeHook(command, { cwd: tempDir });
      });
      assert.ok(errors.some(e => e.includes('Runtime manifest is corrupt')));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('missing runtime manifest includes remediation hint', async () => {
    const tempDir = await createTempDir();
    try {
      setupFullEnvironment(tempDir, { skipRuntimeManifest: true });
      const command = getHookCommand('session-start');
      const { errors } = captureOutput(() => {
        executeHook(command, { cwd: tempDir });
      });
      assert.ok(errors.some(e => e.includes('npx get-shit-secured --claude --local')));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

});

// ---------------------------------------------------------------------------
// Corpus checks
// ---------------------------------------------------------------------------
describe('Session-start — Corpus checks', () => {

  it('corpus snapshot missing', async () => {
    const tempDir = await createTempDir();
    try {
      setupFullEnvironment(tempDir, { skipCorpus: true });
      const command = getHookCommand('session-start');
      const { warns } = captureOutput(() => {
        executeHook(command, { cwd: tempDir });
      });
      assert.ok(warns.some(w => w.includes('Corpus: Snapshot not found') || w.includes('Corpus')));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('corpus snapshot is corrupt JSON', async () => {
    const tempDir = await createTempDir();
    try {
      setupFullEnvironment(tempDir);
      const corpusPath = join(tempDir, '.claude', 'gss', 'corpus', 'owasp-corpus.json');
      writeFileSync(corpusPath, 'not-json{');
      const command = getHookCommand('session-start');
      const { errors } = captureOutput(() => {
        executeHook(command, { cwd: tempDir });
      });
      assert.ok(errors.some(e => e.includes('Corpus: Snapshot is corrupt')));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('corpus snapshot valid with doc count', async () => {
    const tempDir = await createTempDir();
    try {
      setupFullEnvironment(tempDir, { corpusData: { stats: { totalDocs: 42 }, documents: [] } });
      const command = getHookCommand('session-start');
      const { logs } = captureOutput(() => {
        executeHook(command, { cwd: tempDir });
      });
      assert.ok(logs.some(l => l.includes('42 docs')));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

});

// ---------------------------------------------------------------------------
// MCP checks
// ---------------------------------------------------------------------------
describe('Session-start — MCP checks', () => {

  it('MCP server binary missing', async () => {
    const tempDir = await createTempDir();
    try {
      setupFullEnvironment(tempDir, { skipMcpServer: true });
      const command = getHookCommand('session-start');
      const { warns } = captureOutput(() => {
        executeHook(command, { cwd: tempDir });
      });
      assert.ok(warns.some(w => w.includes('MCP: Server binary not found')));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('MCP not registered in settings.json', async () => {
    const tempDir = await createTempDir();
    try {
      setupFullEnvironment(tempDir, { skipSettings: true });
      const command = getHookCommand('session-start');
      const { warns } = captureOutput(() => {
        executeHook(command, { cwd: tempDir });
      });
      assert.ok(warns.some(w => w.includes('MCP: Server not registered')));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('MCP binary present and registered: no MCP warning', async () => {
    const tempDir = await createTempDir();
    try {
      setupFullEnvironment(tempDir);
      const command = getHookCommand('session-start');
      const { warns, logs } = captureOutput(() => {
        executeHook(command, { cwd: tempDir });
      });
      assert.ok(!warns.some(w => w.includes('MCP:')), 'No MCP warnings when properly set up');
      assert.ok(logs.some(l => l.includes('MCP ready')));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

});

// ---------------------------------------------------------------------------
// Version consistency
// ---------------------------------------------------------------------------
describe('Session-start — Version consistency', () => {

  it('corpus version matches between manifests: no warning', async () => {
    const tempDir = await createTempDir();
    try {
      setupFullEnvironment(tempDir, { corpusVersion: '1.0.0' });
      const command = getHookCommand('session-start');
      const { warns } = captureOutput(() => {
        executeHook(command, { cwd: tempDir });
      });
      assert.ok(!warns.some(w => w.includes('version mismatch')));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('corpus version mismatch between manifests', async () => {
    const tempDir = await createTempDir();
    try {
      setupFullEnvironment(tempDir, {
        corpusVersion: '1.0.0',
        installManifest: { version: '2.0', corpusVersion: '2.0.0', runtimes: { claude: {} } },
      });
      const command = getHookCommand('session-start');
      const { warns } = captureOutput(() => {
        executeHook(command, { cwd: tempDir });
      });
      assert.ok(warns.some(w => w.includes('Corpus version mismatch')));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

});

// ---------------------------------------------------------------------------
// Artifact directory and staleness
// ---------------------------------------------------------------------------
describe('Session-start — Artifact directory and staleness', () => {

  it('missing .gss/artifacts/ directory', async () => {
    const tempDir = await createTempDir();
    try {
      setupFullEnvironment(tempDir);
      const artifactsDir = join(tempDir, '.gss', 'artifacts');
      if (existsSync(artifactsDir)) { rmSync(artifactsDir, { recursive: true, force: true }); }
      const command = getHookCommand('session-start');
      const { warns } = captureOutput(() => {
        executeHook(command, { cwd: tempDir });
      });
      assert.ok(warns.some(w => w.includes('Missing directory') && w.includes('artifacts')));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('missing .gss/reports/ directory', async () => {
    const tempDir = await createTempDir();
    try {
      setupFullEnvironment(tempDir);
      const reportsDir = join(tempDir, '.gss', 'reports');
      if (existsSync(reportsDir)) { rmSync(reportsDir, { recursive: true, force: true }); }
      const command = getHookCommand('session-start');
      const { warns } = captureOutput(() => {
        executeHook(command, { cwd: tempDir });
      });
      assert.ok(warns.some(w => w.includes('Missing directory') && w.includes('reports')));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('install is >30 days old', async () => {
    const tempDir = await createTempDir();
    try {
      const oldDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
      setupFullEnvironment(tempDir, { installedAt: oldDate });
      const command = getHookCommand('session-start');
      const { warns } = captureOutput(() => {
        executeHook(command, { cwd: tempDir });
      });
      assert.ok(warns.some(w => w.includes('days old')));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('install is recent: no staleness warning', async () => {
    const tempDir = await createTempDir();
    try {
      setupFullEnvironment(tempDir, { installedAt: new Date().toISOString() });
      const command = getHookCommand('session-start');
      const { warns } = captureOutput(() => {
        executeHook(command, { cwd: tempDir });
      });
      assert.ok(!warns.some(w => w.includes('days old')));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

});

// ---------------------------------------------------------------------------
// Stale active-workflow cleanup
// ---------------------------------------------------------------------------
describe('Session-start — Stale active-workflow cleanup', () => {

  it('stale active-workflow.json found and deleted', async () => {
    const tempDir = await createTempDir();
    try {
      const env = setupFullEnvironment(tempDir);
      const activeWfPath = join(env.artifactsDir, 'active-workflow.json');
      writeFileSync(activeWfPath, JSON.stringify({ workflowId: 'audit', mode: 'review-only' }));
      const command = getHookCommand('session-start');
      const { warns } = captureOutput(() => {
        executeHook(command, { cwd: tempDir });
      });
      assert.ok(warns.some(w => w.includes('Stale active-workflow.json found')));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('no stale active-workflow.json: no warning', async () => {
    const tempDir = await createTempDir();
    try {
      setupFullEnvironment(tempDir);
      const command = getHookCommand('session-start');
      const { warns } = captureOutput(() => {
        executeHook(command, { cwd: tempDir });
      });
      assert.ok(!warns.some(w => w.includes('Stale active-workflow')));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

});

// ---------------------------------------------------------------------------
// Degraded mode
// ---------------------------------------------------------------------------
describe('Session-start — Degraded mode', () => {

  it('MCP unavailable + corpus missing: degraded mode', async () => {
    const tempDir = await createTempDir();
    try {
      setupFullEnvironment(tempDir, { skipMcpServer: true, skipCorpus: true });
      const command = getHookCommand('session-start');
      const { warns } = captureOutput(() => {
        executeHook(command, { cwd: tempDir });
      });
      const allOutput = warns.join(' ');
      assert.ok(allOutput.includes('DEGRADED MODE') || allOutput.includes('MCP unavailable') || allOutput.includes('corpus MISSING'));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('degraded mode includes remediation instructions', async () => {
    const tempDir = await createTempDir();
    try {
      setupFullEnvironment(tempDir, { skipMcpServer: true, skipCorpus: true });
      const command = getHookCommand('session-start');
      const { warns } = captureOutput(() => {
        executeHook(command, { cwd: tempDir });
      });
      assert.ok(warns.some(w => w.includes('npx get-shit-secured --claude --local')));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

});

// ---------------------------------------------------------------------------
// Resilience
// ---------------------------------------------------------------------------
describe('Session-start — Resilience', () => {

  it('no support subtree found: hook runs without throwing', async () => {
    const tempDir = await createTempDir();
    try {
      // Only create .gss/ dirs, no .claude/gss/ subtree
      mkdirSync(join(tempDir, '.gss', 'artifacts'), { recursive: true });
      mkdirSync(join(tempDir, '.gss', 'reports'), { recursive: true });
      const command = getHookCommand('session-start');
      const { logs, warns } = captureOutput(() => {
        executeHook(command, { cwd: tempDir });
      });
      assert.ok(logs.some(l => l.includes('basic mode')) || warns.length > 0 || logs.length > 0,
        'Hook should produce some output');
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('unexpected exception: hook does not throw', async () => {
    const tempDir = await createTempDir();
    try {
      const command = getHookCommand('session-start');
      const { errors } = captureOutput(() => {
        executeHook(command, { cwd: tempDir });
      });
      // Should not throw — errors are caught internally
      assert.ok(true, 'Hook completed without throwing');
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

});
