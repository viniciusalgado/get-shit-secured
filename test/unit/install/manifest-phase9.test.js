/**
 * Unit tests for Manifest v2 MCP path fields.
 * Phase 9 — Workstream A: manifest tracking of MCP paths.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

import { createManifestV2, mergeManifest, writeManifest, readManifest } from '../../../dist/core/manifest.js';

describe('Manifest v2 — MCP path fields', () => {
  it('createManifestV2 includes mcpServerPaths', () => {
    const manifest = createManifestV2(
      ['claude'],
      'local',
      ['audit'],
      { claude: '/root' },
      { claude: ['/root/file.md'] },
      undefined,
      undefined,
      undefined,
      '1.0.0',
      { serverPaths: { claude: '/root/gss/mcp/server.js' } }
    );
    assert.equal(manifest.mcpServerPaths?.claude, '/root/gss/mcp/server.js');
  });

  it('createManifestV2 includes mcpConfigPaths', () => {
    const manifest = createManifestV2(
      ['claude'],
      'local',
      ['audit'],
      { claude: '/root' },
      { claude: [] },
      undefined, undefined, undefined,
      '1.0.0',
      { configPaths: { claude: '/root/settings.json' } }
    );
    assert.equal(manifest.mcpConfigPaths?.claude, '/root/settings.json');
  });

  it('createManifestV2 defaults MCP paths to empty objects', () => {
    const manifest = createManifestV2(
      ['claude'], 'local', [], { claude: '/root' }, { claude: [] }
    );
    assert.deepStrictEqual(manifest.mcpServerPaths, {});
    assert.deepStrictEqual(manifest.mcpConfigPaths, {});
  });

  it('mergeManifestV2 merges new MCP server paths', () => {
    const existing = createManifestV2(
      ['claude'], 'local', [], { claude: '/root' }, { claude: [] },
      undefined, undefined, undefined, '1.0.0',
      { serverPaths: { claude: '/old/server.js' } }
    );
    const merged = mergeManifest(
      existing,
      ['codex'],
      [],
      { codex: [] },
      { codex: '/codex-root' },
      undefined, undefined, undefined,
      { serverPaths: { codex: '/codex/server.js' } }
    );
    assert.equal(merged.mcpServerPaths?.claude, '/old/server.js');
    assert.equal(merged.mcpServerPaths?.codex, '/codex/server.js');
  });

  it('mergeManifestV2 overwrites same-runtime MCP paths', () => {
    const existing = createManifestV2(
      ['claude'], 'local', [], { claude: '/root' }, { claude: [] },
      undefined, undefined, undefined, '1.0.0',
      { serverPaths: { claude: '/old/server.js' } }
    );
    const merged = mergeManifest(
      existing,
      ['claude'],
      [],
      { claude: [] },
      { claude: '/root' },
      undefined, undefined, undefined,
      { serverPaths: { claude: '/new/server.js' } }
    );
    assert.equal(merged.mcpServerPaths?.claude, '/new/server.js');
  });

  it('mergeManifestV2 preserves existing MCP paths', () => {
    const existing = createManifestV2(
      ['claude'], 'local', [], { claude: '/root' }, { claude: [] },
      undefined, undefined, undefined, '1.0.0',
      {
        serverPaths: { claude: '/claude/server.js' },
        configPaths: { claude: '/claude/settings.json' },
      }
    );
    const merged = mergeManifest(
      existing,
      ['codex'],
      [],
      { codex: [] },
      { codex: '/codex-root' },
      undefined, undefined, undefined,
      {
        serverPaths: { codex: '/codex/server.js' },
        configPaths: { codex: '/codex/settings.json' },
      }
    );
    assert.equal(merged.mcpServerPaths?.claude, '/claude/server.js');
    assert.equal(merged.mcpConfigPaths?.claude, '/claude/settings.json');
    assert.equal(merged.mcpServerPaths?.codex, '/codex/server.js');
    assert.equal(merged.mcpConfigPaths?.codex, '/codex/settings.json');
  });

  it('readManifest returns MCP paths from disk', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'gss-p9-'));
    try {
      const manifest = createManifestV2(
        ['claude'], 'local', [], { claude: '/root' }, { claude: [] },
        undefined, undefined, undefined, '1.0.0',
        {
          serverPaths: { claude: '/root/gss/mcp/server.js' },
          configPaths: { claude: '/root/settings.json' },
        }
      );
      await writeManifest(tempDir, manifest);
      const read = await readManifest(tempDir);
      assert.ok(read);
      assert.equal(read.mcpServerPaths?.claude, '/root/gss/mcp/server.js');
      assert.equal(read.mcpConfigPaths?.claude, '/root/settings.json');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('V1 manifest read does not break', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'gss-p9-'));
    try {
      const v1Manifest = {
        version: '0.1.0',
        installedAt: new Date().toISOString(),
        scope: 'local',
        runtimes: ['claude'],
        workflows: ['audit'],
        roots: { claude: '/root' },
        files: { claude: ['/root/file.md'] },
      };
      const gssDir = join(tempDir, '.gss');
      const { mkdirSync } = await import('node:fs');
      mkdirSync(gssDir, { recursive: true });
      writeFileSync(
        join(gssDir, 'install-manifest.json'),
        JSON.stringify(v1Manifest, null, 2)
      );
      const read = await readManifest(tempDir);
      assert.ok(read);
      assert.equal(read.version, '0.1.0');
      // V1 manifest does not have MCP paths
      assert.equal(read.mcpServerPaths, undefined);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
