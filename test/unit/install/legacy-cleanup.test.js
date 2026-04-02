/**
 * Unit tests for legacy specialist cleanup.
 * Phase 9 — Workstream D: discoverLegacyArtifacts, cleanupLegacyArtifacts.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';

import { discoverLegacyArtifacts, cleanupLegacyArtifacts } from '../../../dist/install/legacy-cleanup.js';

describe('discoverLegacyArtifacts — Claude specialists', () => {
  it('discovers agents/gss-specialist-*.md files', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'gss-p9-'));
    try {
      const agentsDir = join(tempDir, 'agents');
      mkdirSync(agentsDir, { recursive: true });
      writeFileSync(join(agentsDir, 'gss-specialist-sql-injection.md'), 'sql');
      writeFileSync(join(agentsDir, 'gss-specialist-xss.md'), 'xss');

      const result = discoverLegacyArtifacts('claude', tempDir, join(tempDir, 'gss'));
      assert.equal(result.specialistFiles.length, 2);
      assert.equal(result.hasLegacyArtifacts, true);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('ignores non-specialist agent files', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'gss-p9-'));
    try {
      const agentsDir = join(tempDir, 'agents');
      mkdirSync(agentsDir, { recursive: true });
      writeFileSync(join(agentsDir, 'gss-auditor.md'), 'auditor');
      writeFileSync(join(agentsDir, 'gss-specialist-sql.md'), 'sql');

      const result = discoverLegacyArtifacts('claude', tempDir, join(tempDir, 'gss'));
      assert.equal(result.specialistFiles.length, 1);
      assert.ok(result.specialistFiles[0].includes('gss-specialist-sql'));
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('handles missing agents directory', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'gss-p9-'));
    try {
      const result = discoverLegacyArtifacts('claude', tempDir, join(tempDir, 'gss'));
      assert.equal(result.specialistFiles.length, 0);
      assert.equal(result.hasLegacyArtifacts, false);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('ignores directories matching file pattern', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'gss-p9-'));
    try {
      const agentsDir = join(tempDir, 'agents');
      mkdirSync(agentsDir, { recursive: true });
      mkdirSync(join(agentsDir, 'gss-specialist-test'));
      writeFileSync(join(agentsDir, 'gss-specialist-real.md'), 'real');

      const result = discoverLegacyArtifacts('claude', tempDir, join(tempDir, 'gss'));
      // Only files should match, not directories
      assert.equal(result.specialistFiles.length, 1);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe('discoverLegacyArtifacts — Codex specialists', () => {
  it('discovers skills/gss-specialist-*/ directories', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'gss-p9-'));
    try {
      const skillsDir = join(tempDir, 'skills');
      mkdirSync(join(skillsDir, 'gss-specialist-sql-injection'), { recursive: true });
      mkdirSync(join(skillsDir, 'gss-specialist-xss'), { recursive: true });

      const result = discoverLegacyArtifacts('codex', tempDir, join(tempDir, 'gss'));
      assert.equal(result.specialistDirs.length, 2);
      assert.equal(result.hasLegacyArtifacts, true);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('ignores non-specialist skill dirs', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'gss-p9-'));
    try {
      const skillsDir = join(tempDir, 'skills');
      mkdirSync(join(skillsDir, 'gss-mapper'), { recursive: true });
      mkdirSync(join(skillsDir, 'gss-specialist-sql'), { recursive: true });

      const result = discoverLegacyArtifacts('codex', tempDir, join(tempDir, 'gss'));
      assert.equal(result.specialistDirs.length, 1);
      assert.ok(result.specialistDirs[0].includes('gss-specialist-sql'));
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('handles missing skills directory', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'gss-p9-'));
    try {
      const result = discoverLegacyArtifacts('codex', tempDir, join(tempDir, 'gss'));
      assert.equal(result.specialistDirs.length, 0);
      assert.equal(result.hasLegacyArtifacts, false);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe('discoverLegacyArtifacts — Cross-runtime defensive discovery', () => {
  it('Claude runtime also checks for Codex-style dirs at root', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'gss-p9-'));
    try {
      mkdirSync(join(tempDir, 'gss-specialist-foo'), { recursive: true });

      const result = discoverLegacyArtifacts('claude', tempDir, join(tempDir, 'gss'));
      assert.ok(result.specialistDirs.length >= 1);
      assert.ok(result.specialistDirs.some(d => d.includes('gss-specialist-foo')));
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('Codex runtime also checks for Claude-style agent files', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'gss-p9-'));
    try {
      const agentsDir = join(tempDir, 'agents');
      mkdirSync(agentsDir, { recursive: true });
      writeFileSync(join(agentsDir, 'gss-specialist-bar.md'), 'bar');

      const result = discoverLegacyArtifacts('codex', tempDir, join(tempDir, 'gss'));
      assert.ok(result.specialistFiles.length >= 1);
      assert.ok(result.specialistFiles.some(f => f.includes('gss-specialist-bar')));
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe('discoverLegacyArtifacts — Edge cases', () => {
  it('empty directory returns no artifacts', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'gss-p9-'));
    try {
      const result = discoverLegacyArtifacts('claude', tempDir, join(tempDir, 'gss'));
      assert.equal(result.hasLegacyArtifacts, false);
      assert.equal(result.totalCount, 0);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe('cleanupLegacyArtifacts — Safe removal', () => {
  it('removes matching specialist files', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'gss-p9-'));
    try {
      const agentsDir = join(tempDir, 'agents');
      mkdirSync(agentsDir, { recursive: true });
      const file1 = join(agentsDir, 'gss-specialist-sql.md');
      const file2 = join(agentsDir, 'gss-specialist-xss.md');
      writeFileSync(file1, 'sql');
      writeFileSync(file2, 'xss');

      const artifacts = {
        specialistFiles: [file1, file2],
        specialistDirs: [],
        hasLegacyArtifacts: true,
        totalCount: 2,
      };
      const result = await cleanupLegacyArtifacts(artifacts, { dryRun: false });

      assert.equal(result.removed.length, 2);
      assert.ok(!existsSync(file1));
      assert.ok(!existsSync(file2));
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('removes matching specialist directories', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'gss-p9-'));
    try {
      const skillsDir = join(tempDir, 'skills');
      mkdirSync(join(skillsDir, 'gss-specialist-sql'), { recursive: true });
      mkdirSync(join(skillsDir, 'gss-specialist-xss'), { recursive: true });

      const dir1 = join(skillsDir, 'gss-specialist-sql');
      const dir2 = join(skillsDir, 'gss-specialist-xss');

      const artifacts = {
        specialistFiles: [],
        specialistDirs: [dir1, dir2],
        hasLegacyArtifacts: true,
        totalCount: 2,
      };
      const result = await cleanupLegacyArtifacts(artifacts, { dryRun: false });

      assert.equal(result.removed.length, 2);
      assert.ok(!existsSync(dir1));
      assert.ok(!existsSync(dir2));
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('skips paths not matching gss-specialist-* pattern', async () => {
    const artifacts = {
      specialistFiles: ['/path/agents/other-file.md'],
      specialistDirs: [],
      hasLegacyArtifacts: true,
      totalCount: 1,
    };
    const result = await cleanupLegacyArtifacts(artifacts, { dryRun: false });

    assert.equal(result.skipped.length, 1);
    assert.equal(result.removed.length, 0);
  });

  it('skips paths with .. traversal', async () => {
    const artifacts = {
      specialistFiles: ['/path/../escape/gss-specialist-x.md'],
      specialistDirs: [],
      hasLegacyArtifacts: true,
      totalCount: 1,
    };
    const result = await cleanupLegacyArtifacts(artifacts, { dryRun: false });

    assert.ok(result.skipped.length >= 1);
    assert.equal(result.removed.length, 0);
  });

  it('skips already-deleted files', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'gss-p9-'));
    try {
      const path = join(tempDir, 'gss-specialist-gone.md');
      // Don't create it — file doesn't exist

      const artifacts = {
        specialistFiles: [path],
        specialistDirs: [],
        hasLegacyArtifacts: true,
        totalCount: 1,
      };
      const result = await cleanupLegacyArtifacts(artifacts, { dryRun: false });

      assert.ok(result.skipped.length >= 1);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe('cleanupLegacyArtifacts — Dry-run mode', () => {
  it('dry-run records paths without deleting', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'gss-p9-'));
    try {
      const agentsDir = join(tempDir, 'agents');
      mkdirSync(agentsDir, { recursive: true });
      const filePath = join(agentsDir, 'gss-specialist-sql.md');
      writeFileSync(filePath, 'sql');

      const artifacts = {
        specialistFiles: [filePath],
        specialistDirs: [],
        hasLegacyArtifacts: true,
        totalCount: 1,
      };
      const result = await cleanupLegacyArtifacts(artifacts, { dryRun: true });

      assert.equal(result.removed.length, 1);
      // File should still exist
      assert.ok(existsSync(filePath));
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('dry-run still validates safety', async () => {
    const artifacts = {
      specialistFiles: ['/path/agents/other-file.md'],
      specialistDirs: [],
      hasLegacyArtifacts: true,
      totalCount: 1,
    };
    const result = await cleanupLegacyArtifacts(artifacts, { dryRun: true });

    assert.ok(result.skipped.length >= 1);
    assert.equal(result.removed.length, 0);
  });
});
