/**
 * Phase 3 Unit Tests — Install Stages
 *
 * Validates the staged pipeline:
 *   Stage 0: detectTargets
 *   Stage 1: resolveCorpus
 *   Stage 2: installRuntimeArtifacts
 *   Stage 4: verifyInstall
 *   Static analysis: installer independence
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ClaudeAdapter } from '../../dist/runtimes/claude/adapter.js';
import { CodexAdapter } from '../../dist/runtimes/codex/adapter.js';
import {
  detectTargets,
  resolveCorpus,
  installRuntimeArtifacts,
  verifyInstall,
  DEFAULT_WORKFLOWS,
} from '../../dist/core/install-stages.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(__dirname, '..', '..');

async function createTempDir() {
  return mkdtemp(join(tmpdir(), 'gss-p3-unit-'));
}

async function cleanupTempDir(dir) {
  await rm(dir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Stage 0: detectTargets
// ---------------------------------------------------------------------------

describe('Phase 3 — detectTargets (Stage 0)', () => {
  it('2.1 returns correct target structure for single adapter', () => {
    const adapter = new ClaudeAdapter();
    const targets = detectTargets([adapter], 'local', '/tmp/test');

    assert.deepEqual(targets.runtimes, ['claude']);
    assert.equal(targets.scope, 'local');
    assert.equal(targets.cwd, '/tmp/test');
    assert.ok(targets.roots.claude);
    assert.ok(targets.supportSubtrees.claude);
  });

  it('2.2 supports multiple runtimes', () => {
    const targets = detectTargets(
      [new ClaudeAdapter(), new CodexAdapter()],
      'local',
      '/tmp/test'
    );

    assert.equal(targets.runtimes.length, 2);
    assert.ok(targets.roots.claude);
    assert.ok(targets.roots.codex);
    assert.ok(targets.supportSubtrees.claude);
    assert.ok(targets.supportSubtrees.codex);
  });
});

// ---------------------------------------------------------------------------
// Stage 1: resolveCorpus
// ---------------------------------------------------------------------------

describe('Phase 3 — resolveCorpus (Stage 1)', () => {
  it('2.3 locates and loads the bundled snapshot', async () => {
    const targets = detectTargets([new ClaudeAdapter()], 'local', '/tmp/test');
    const corpus = await resolveCorpus(targets, pkgRoot);

    assert.ok(corpus.snapshot);
    assert.ok(corpus.corpusVersion);
    assert.ok(corpus.sourcePath);
    assert.ok(corpus.destinationPaths.claude);
  });

  it('2.4 throws when snapshot is missing', async () => {
    // resolveCorpus falls back to process.cwd(), so when running from
    // the project root the snapshot is found there. We use a temp cwd
    // to ensure none of the candidate paths resolve.
    const targets = detectTargets([new ClaudeAdapter()], 'local', '/tmp/test');
    const originalCwd = process.cwd();
    const tempDir = await createTempDir();
    try {
      process.chdir(tempDir);
      await assert.rejects(
        () => resolveCorpus(targets, '/nonexistent/path'),
        { message: /Corpus snapshot not found/ }
      );
    } finally {
      process.chdir(originalCwd);
      await cleanupTempDir(tempDir);
    }
  });

  it('2.5 computes correct destination paths per runtime', async () => {
    const targets = detectTargets([new ClaudeAdapter()], 'local', '/tmp/test');
    const corpus = await resolveCorpus(targets, pkgRoot);

    assert.ok(corpus.destinationPaths.claude.endsWith('corpus/owasp-corpus.json'));
    assert.ok(corpus.destinationPaths.claude.includes('gss'));
  });
});

// ---------------------------------------------------------------------------
// Stage 2: installRuntimeArtifacts
// ---------------------------------------------------------------------------

describe('Phase 3 — installRuntimeArtifacts (Stage 2)', () => {
  it('2.6 installs corpus snapshot to support subtree', async () => {
    const tempDir = await createTempDir();
    try {
      const targets = detectTargets([new ClaudeAdapter()], 'local', tempDir);
      const corpus = await resolveCorpus(targets, pkgRoot);
      const result = await installRuntimeArtifacts(
        targets,
        [new ClaudeAdapter()],
        corpus,
        { dryRun: false, legacySpecialists: false }
      );

      const corpusDest = corpus.destinationPaths.claude;
      assert.ok(existsSync(corpusDest), 'Corpus snapshot should be installed');
      const content = JSON.parse(readFileSync(corpusDest, 'utf-8'));
      assert.ok(content.documents, 'Installed snapshot should have documents');
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('2.7 does not copy corpus when corpus is null (legacy mode)', async () => {
    const tempDir = await createTempDir();
    try {
      const targets = detectTargets([new ClaudeAdapter()], 'local', tempDir);
      const result = await installRuntimeArtifacts(
        targets,
        [new ClaudeAdapter()],
        null,
        { dryRun: false, legacySpecialists: true, specialists: [] }
      );

      // No corpus-related errors
      assert.ok(
        !result.errors.some(e => e.toLowerCase().includes('corpus')),
        `Unexpected corpus errors: ${result.errors.join(', ')}`
      );
    } finally {
      await cleanupTempDir(tempDir);
    }
  });
});

// ---------------------------------------------------------------------------
// Stage 4: verifyInstall
// ---------------------------------------------------------------------------

describe('Phase 3 — verifyInstall (Stage 4)', () => {
  it('2.8 reports healthy when all files are present', async () => {
    const tempDir = await createTempDir();
    try {
      const targets = detectTargets([new ClaudeAdapter()], 'local', tempDir);
      const corpus = await resolveCorpus(targets, pkgRoot);
      await installRuntimeArtifacts(
        targets,
        [new ClaudeAdapter()],
        corpus,
        { dryRun: false, legacySpecialists: false, pkgRoot }
      );

      const verification = await verifyInstall(targets, corpus, { dryRun: false });
      assert.ok(verification.healthy, `Expected healthy, got errors: ${verification.errors.join(', ')}`);
      assert.equal(verification.errors.length, 0);
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('2.9 reports errors when corpus snapshot is missing', async () => {
    const tempDir = await createTempDir();
    try {
      const targets = detectTargets([new ClaudeAdapter()], 'local', tempDir);
      const corpus = await resolveCorpus(targets, pkgRoot);
      await installRuntimeArtifacts(
        targets,
        [new ClaudeAdapter()],
        corpus,
        { dryRun: false, legacySpecialists: false, pkgRoot }
      );

      // Delete the installed corpus file
      const corpusDest = corpus.destinationPaths.claude;
      const { unlink } = await import('node:fs/promises');
      await unlink(corpusDest);

      const verification = await verifyInstall(targets, corpus, { dryRun: false });
      assert.ok(!verification.healthy, 'Should be unhealthy');
      assert.ok(
        verification.errors.some(e => e.includes('not found')),
        `Expected "not found" in errors: ${verification.errors.join(', ')}`
      );
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('2.10 returns healthy in dry-run mode', async () => {
    const targets = detectTargets([new ClaudeAdapter()], 'local', '/tmp/test');
    const verification = await verifyInstall(targets, null, null, { dryRun: true });
    assert.ok(verification.healthy);
  });
});

// ---------------------------------------------------------------------------
// Static analysis: installer independence
// ---------------------------------------------------------------------------

describe('Phase 3 — Installer independence (static)', () => {
  it('2.14 install code path is independent from corpus build path', () => {
    const installerSource = readFileSync(
      join(__dirname, '..', '..', 'src', 'core', 'installer.ts'),
      'utf-8'
    );
    assert.ok(
      !installerSource.includes('snapshot-builder'),
      'Installer should not import snapshot-builder'
    );
    assert.ok(
      !installerSource.includes('buildCorpusSnapshot'),
      'Installer should not call buildCorpusSnapshot'
    );
  });
});
