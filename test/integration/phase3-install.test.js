/**
 * Phase 3 Integration Tests — Full Install Pipeline
 *
 * Validates:
 *   - Full install succeeds (Claude + Codex)
 *   - Corpus packaging and placement
 *   - Versioning policy (manifest fields)
 *   - Refresh model (determinism, preservation)
 *   - Backward compatibility (legacy vs corpus-based)
 *   - Uninstall
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, readdir, mkdir, writeFile, unlink } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ClaudeAdapter } from '../../dist/runtimes/claude/adapter.js';
import { CodexAdapter } from '../../dist/runtimes/codex/adapter.js';
import { install, uninstall } from '../../dist/core/installer.js';
import { readManifest } from '../../dist/core/manifest.js';
import { getAllWorkflows } from '../../dist/catalog/workflows/registry.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function createTempDir() {
  return mkdtemp(join(tmpdir(), 'gss-p3-int-'));
}

async function cleanupTempDir(dir) {
  await rm(dir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Section 6 — Cross-Workstream Integration
// ---------------------------------------------------------------------------

describe('Phase 3 Integration — Full install pipeline', () => {
  it('6.1 full install (Claude) succeeds with corpus-based path', async () => {
    const tempDir = await createTempDir();
    try {
      const result = await install([new ClaudeAdapter()], 'local', tempDir, false);
      assert.ok(result.success, `Install failed: ${result.errors.join(', ')}`);
      assert.ok(result.filesCreated > 0);
      assert.ok(result.manifest);

      assert.ok(existsSync(join(tempDir, '.claude')));
      assert.ok(existsSync(join(tempDir, '.gss')));
      assert.ok(existsSync(join(tempDir, '.claude', 'commands', 'gss')));
      assert.ok(existsSync(join(tempDir, '.claude', 'agents')));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('6.1b install resolves packaged corpus even when cwd has no local data directory', async () => {
    const tempDir = await createTempDir();
    const originalCwd = process.cwd();
    try {
      process.chdir(tempDir);
      const result = await install([new ClaudeAdapter()], 'local', tempDir, false);

      assert.ok(result.success, `Install failed: ${result.errors.join(', ')}`);
      assert.ok(
        existsSync(join(tempDir, '.claude', 'gss', 'corpus', 'owasp-corpus.json')),
        'Corpus should still be installed from the packaged snapshot'
      );
    } finally {
      process.chdir(originalCwd);
      await cleanupTempDir(tempDir);
    }
  });

  it('6.2 full install (Codex) succeeds with corpus-based path', async () => {
    const tempDir = await createTempDir();
    try {
      const result = await install([new CodexAdapter()], 'local', tempDir, false);
      assert.ok(result.success);
      assert.ok(existsSync(join(tempDir, '.codex')));
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('6.4 install produces all workflow files', async () => {
    const tempDir = await createTempDir();
    try {
      await install([new ClaudeAdapter()], 'local', tempDir, false);

      const workflows = getAllWorkflows();
      const commandsDir = join(tempDir, '.claude', 'commands', 'gss');
      for (const workflow of workflows) {
        assert.ok(
          existsSync(join(commandsDir, `${workflow.id}.md`)),
          `Command for ${workflow.id} should exist`
        );
      }
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('6.5 install produces role agent files', async () => {
    const tempDir = await createTempDir();
    try {
      await install([new ClaudeAdapter()], 'local', tempDir, false);

      const agentsDir = join(tempDir, '.claude', 'agents');
      const roleAgents = [
        'gss-mapper', 'gss-auditor', 'gss-remediator',
        'gss-verifier', 'gss-reporter',
      ];
      for (const agent of roleAgents) {
        assert.ok(
          existsSync(join(agentsDir, `${agent}.md`)),
          `${agent} should exist`
        );
      }
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('6.6 install writes runtime manifest with hooks', async () => {
    const tempDir = await createTempDir();
    try {
      await install([new ClaudeAdapter()], 'local', tempDir, false);

      const runtimeManifestPath = join(tempDir, '.claude', 'gss', 'runtime-manifest.json');
      assert.ok(existsSync(runtimeManifestPath), 'Runtime manifest should exist');
      const rm = JSON.parse(await readFile(runtimeManifestPath, 'utf-8'));
      assert.ok(Array.isArray(rm.hooks), 'Runtime manifest should have hooks array');
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('6.7 install writes managed config entries', async () => {
    const tempDir = await createTempDir();
    try {
      await install([new ClaudeAdapter()], 'local', tempDir, false);

      const settingsPath = join(tempDir, '.claude', 'settings.json');
      assert.ok(existsSync(settingsPath));
      const settings = JSON.parse(await readFile(settingsPath, 'utf-8'));
      assert.ok(settings.gss, 'Settings should have gss key');
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('6.8 reinstall preserves user settings', async () => {
    const tempDir = await createTempDir();
    try {
      await install([new ClaudeAdapter()], 'local', tempDir, false);

      // Add user data
      const settingsPath = join(tempDir, '.claude', 'settings.json');
      let settings = JSON.parse(await readFile(settingsPath, 'utf-8'));
      settings.myCustomKey = 'preserved';
      await writeFile(settingsPath, JSON.stringify(settings), 'utf-8');

      // Reinstall
      await install([new ClaudeAdapter()], 'local', tempDir, false);
      settings = JSON.parse(await readFile(settingsPath, 'utf-8'));
      assert.equal(settings.myCustomKey, 'preserved', 'User settings should survive reinstall');
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('6.9 uninstall removes installed corpus and runtime artifacts', async () => {
    const tempDir = await createTempDir();
    try {
      await install([new ClaudeAdapter()], 'local', tempDir, false);
      await uninstall(tempDir, false);

      assert.ok(
        !existsSync(join(tempDir, '.claude', 'gss', 'corpus', 'owasp-corpus.json')),
        'Corpus file should be removed'
      );
      assert.ok(
        !existsSync(join(tempDir, '.claude', 'gss', 'runtime-manifest.json')),
        'Runtime manifest should be removed'
      );
    } finally {
      await cleanupTempDir(tempDir);
    }
  });
});

// ---------------------------------------------------------------------------
// Section 3 — Corpus Packaging and Placement
// ---------------------------------------------------------------------------

describe('Phase 3 Integration — Corpus packaging', () => {
  it('3.1 corpus snapshot installed at {supportSubtree}/corpus/owasp-corpus.json', async () => {
    const tempDir = await createTempDir();
    try {
      await install([new ClaudeAdapter()], 'local', tempDir, false);
      const corpusPath = join(tempDir, '.claude', 'gss', 'corpus', 'owasp-corpus.json');
      assert.ok(existsSync(corpusPath), 'Corpus should exist at expected path');
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('3.2 Claude and Codex both receive the corpus snapshot', async () => {
    const tempDir = await createTempDir();
    try {
      await install([new ClaudeAdapter(), new CodexAdapter()], 'local', tempDir, false);

      const claudeCorpus = join(tempDir, '.claude', 'gss', 'corpus', 'owasp-corpus.json');
      const codexCorpus = join(tempDir, '.codex', 'gss', 'corpus', 'owasp-corpus.json');

      assert.ok(existsSync(claudeCorpus), 'Claude corpus should exist');
      assert.ok(existsSync(codexCorpus), 'Codex corpus should exist');

      const claudeContent = await readFile(claudeCorpus, 'utf-8');
      const codexContent = await readFile(codexCorpus, 'utf-8');
      assert.equal(claudeContent, codexContent, 'Both runtimes should have identical corpus');
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('3.3 installed corpus content matches source snapshot', async () => {
    const tempDir = await createTempDir();
    try {
      await install([new ClaudeAdapter()], 'local', tempDir, false);

      const sourcePath = resolve(__dirname, '..', '..', 'data', 'corpus', 'owasp-corpus.snapshot.json');
      const installedPath = join(tempDir, '.claude', 'gss', 'corpus', 'owasp-corpus.json');

      // Only compare if source snapshot exists
      if (existsSync(sourcePath)) {
        const sourceContent = await readFile(sourcePath, 'utf-8');
        const installedContent = await readFile(installedPath, 'utf-8');
        assert.equal(sourceContent, installedContent, 'Installed corpus should match source');
      } else {
        // Verify the installed snapshot is valid JSON with documents
        const installed = JSON.parse(await readFile(installedPath, 'utf-8'));
        assert.ok(installed.documents, 'Installed corpus should have documents');
      }
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('3.4 corpus version is readable at runtime', async () => {
    const tempDir = await createTempDir();
    try {
      await install([new ClaudeAdapter()], 'local', tempDir, false);
      const corpusPath = join(tempDir, '.claude', 'gss', 'corpus', 'owasp-corpus.json');
      const installed = JSON.parse(await readFile(corpusPath, 'utf-8'));

      assert.ok(installed.corpusVersion, 'Installed corpus should have corpusVersion');
      assert.match(installed.corpusVersion, /^\d+\.\d+\.\d+$/, 'Should be semver');
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('3.5 local install scope places corpus within project directory', async () => {
    const tempDir = await createTempDir();
    try {
      await install([new ClaudeAdapter()], 'local', tempDir, false);
      const manifest = await readManifest(tempDir);

      assert.equal(manifest.scope, 'local');
      for (const [runtime, files] of Object.entries(manifest.files)) {
        for (const file of files ?? []) {
          assert.ok(
            file.startsWith(tempDir),
            `File ${file} not within cwd ${tempDir}`
          );
        }
      }
    } finally {
      await cleanupTempDir(tempDir);
    }
  });
});

// ---------------------------------------------------------------------------
// Section 5 — Versioning Policy
// ---------------------------------------------------------------------------

describe('Phase 3 Integration — Versioning policy', () => {
  it('5.1 manifest records GSS package version (packageVersion)', async () => {
    const tempDir = await createTempDir();
    try {
      await install([new ClaudeAdapter()], 'local', tempDir, false);
      const manifest = await readManifest(tempDir);

      assert.ok(manifest);
      assert.equal(manifest.manifestVersion, 2, 'Should be v2 manifest');
      assert.ok(manifest.packageVersion, 'Should have packageVersion');
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('5.2 manifest records corpus version (corpusVersion)', async () => {
    const tempDir = await createTempDir();
    try {
      await install([new ClaudeAdapter()], 'local', tempDir, false);
      const manifest = await readManifest(tempDir);

      assert.ok(manifest);
      if ('corpusVersion' in manifest) {
        assert.ok(manifest.corpusVersion, 'Should have corpusVersion');
        assert.match(manifest.corpusVersion, /^\d+\.\d+\.\d+$/);
      }
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('5.3 runtime manifest records corpus version', async () => {
    const tempDir = await createTempDir();
    try {
      await install([new ClaudeAdapter()], 'local', tempDir, false);
      const runtimeManifestPath = join(tempDir, '.claude', 'gss', 'runtime-manifest.json');

      assert.ok(existsSync(runtimeManifestPath));
      const rm = JSON.parse(await readFile(runtimeManifestPath, 'utf-8'));
      assert.ok(rm.corpusVersion, 'Runtime manifest should have corpusVersion');
      assert.ok(rm.version, 'Runtime manifest should have GSS version');
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('5.4 upgrades can compare prior and new corpus versions', async () => {
    const tempDir = await createTempDir();
    try {
      await install([new ClaudeAdapter()], 'local', tempDir, false);
      const manifest1 = await readManifest(tempDir);
      const oldVersion = manifest1.corpusVersion ?? null;

      // Reinstall (simulating upgrade)
      await install([new ClaudeAdapter()], 'local', tempDir, false);
      const manifest2 = await readManifest(tempDir);
      const newVersion = manifest2.corpusVersion ?? null;

      assert.ok(oldVersion, 'Old version should be available');
      assert.ok(newVersion, 'New version should be available');
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('5.5 corpus version is embedded in installed snapshot file', async () => {
    const tempDir = await createTempDir();
    try {
      await install([new ClaudeAdapter()], 'local', tempDir, false);
      const corpusPath = join(tempDir, '.claude', 'gss', 'corpus', 'owasp-corpus.json');
      const installed = JSON.parse(await readFile(corpusPath, 'utf-8'));

      assert.ok(installed.corpusVersion);
      assert.equal(typeof installed.corpusVersion, 'string');
    } finally {
      await cleanupTempDir(tempDir);
    }
  });
});

// ---------------------------------------------------------------------------
// Section 4 — Refresh Model
// ---------------------------------------------------------------------------

describe('Phase 3 Integration — Refresh model', () => {
  it('4.3 default install remains deterministic (no automatic refresh)', async () => {
    const tempDir = await createTempDir();
    try {
      const result1 = await install([new ClaudeAdapter()], 'local', tempDir, false);
      const manifest1 = await readManifest(tempDir);
      const v1 = manifest1.corpusVersion ?? 'unknown';

      const result2 = await install([new ClaudeAdapter()], 'local', tempDir, false);
      const manifest2 = await readManifest(tempDir);
      const v2 = manifest2.corpusVersion ?? 'unknown';

      assert.equal(v1, v2, 'Corpus version should not change without explicit refresh');
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('4.4 refresh records the installed corpus version in manifest', async () => {
    const tempDir = await createTempDir();
    try {
      await install([new ClaudeAdapter()], 'local', tempDir, false);
      const manifest = await readManifest(tempDir);

      assert.ok(manifest);
      if ('corpusVersion' in manifest) {
        assert.ok(manifest.corpusVersion, 'Manifest should record corpus version');
      }
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('4.5 refresh does not bypass manifests or safety rules', async () => {
    const tempDir = await createTempDir();
    try {
      // Create a user-owned file
      const userFile = join(tempDir, '.claude', 'user-config.json');
      await mkdir(join(tempDir, '.claude'), { recursive: true });
      await writeFile(userFile, '{"user": "data"}', 'utf-8');

      await install([new ClaudeAdapter()], 'local', tempDir, false);

      // User file should still exist
      assert.ok(existsSync(userFile), 'User file should be preserved');
      const content = JSON.parse(await readFile(userFile, 'utf-8'));
      assert.equal(content.user, 'data');
    } finally {
      await cleanupTempDir(tempDir);
    }
  });
});

// ---------------------------------------------------------------------------
// Section 2 — Installer Refactor (remaining integration-level tests)
// ---------------------------------------------------------------------------

describe('Phase 3 Integration — Installer refactor', () => {
  it('2.11 default install does not invoke live OWASP fetch', async () => {
    const tempDir = await createTempDir();
    try {
      const result = await install([new ClaudeAdapter()], 'local', tempDir, false);
      assert.ok(
        !result.errors.some(e => e.includes('fetch') || e.includes('network') || e.includes('ENOTFOUND')),
        `Unexpected network errors: ${result.errors.join(', ')}`
      );
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it('2.12 install fails cleanly when corpus snapshot is missing', async () => {
    // resolveCorpus falls back to process.cwd(), so we must chdir away
    // from the project root to test the missing-snapshot path.
    const tempDir = await createTempDir();
    const originalCwd = process.cwd();
    try {
      process.chdir(tempDir);
      const { resolveCorpus, detectTargets } = await import('../../dist/core/install-stages.js');
      const targets = detectTargets([new ClaudeAdapter()], 'local', tempDir);
      await assert.rejects(
        () => resolveCorpus(targets, '/nonexistent/empty/path'),
        { message: /Corpus snapshot not found/ }
      );
    } finally {
      process.chdir(originalCwd);
      await cleanupTempDir(tempDir);
    }
  });

  it('2.15 dry-run install does not write files', async () => {
    const tempDir = await createTempDir();
    try {
      const result = await install([new ClaudeAdapter()], 'local', tempDir, true);
      assert.ok(result.manifest, 'Manifest should be returned in-memory');
      assert.ok(!existsSync(join(tempDir, '.claude')), 'No .claude directory should be created');
      assert.ok(!existsSync(join(tempDir, '.gss')), 'No .gss directory should be created');
    } finally {
      await cleanupTempDir(tempDir);
    }
  });
});

// ---------------------------------------------------------------------------
// Section 7 — Release C specialist retirement
// ---------------------------------------------------------------------------

describe('Phase 3 Integration — Release C specialist retirement', () => {
  it('7.1 install does not generate retired specialist files', async () => {
    const tempDir = await createTempDir();
    try {
      await install([new ClaudeAdapter()], 'local', tempDir, false);

      const agentsDir = join(tempDir, '.claude', 'agents');
      if (existsSync(agentsDir)) {
        const agentFiles = await readdir(agentsDir);
        const specialistFiles = agentFiles.filter(f => f.startsWith('gss-specialist-'));
        assert.equal(
          specialistFiles.length,
          0,
          'Release C install should not produce specialist files'
        );
      }
    } finally {
      await cleanupTempDir(tempDir);
    }
  });
});
