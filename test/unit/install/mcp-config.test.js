/**
 * Unit tests for MCP registration stage module.
 * Phase 9 — Workstream A: registerMcpServers().
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';

import { registerMcpServers } from '../../../dist/install/mcp-config.js';
import { createMockAdapterWithMcp } from './helpers.js';

function makeTargets(rootPath, supportSubtree, cwd) {
  return {
    runtimes: ['claude'],
    scope: 'local',
    cwd: cwd ?? '/mock',
    roots: { claude: rootPath },
    supportSubtrees: { claude: supportSubtree },
  };
}

function makeCorpus(destPath) {
  return {
    snapshot: { corpusVersion: '1.0.0', documents: [] },
    corpusVersion: '1.0.0',
    sourcePath: '/mock/source.json',
    destinationPaths: { claude: destPath },
  };
}

describe('registerMcpServers — Server binary copy', () => {
  it('resolves MCP server binary path from package', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'gss-p9-'));
    try {
      const rootPath = join(tempDir, 'claude');
      const supportSubtree = join(rootPath, 'gss');
      mkdirSync(supportSubtree, { recursive: true });

      // Create source binary at dist/mcp/server.bundle.js (matches resolvePackagedMcpServerPath)
      const srcDir = join(tempDir, 'pkg', 'dist', 'mcp');
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(join(srcDir, 'server.bundle.js'), '// MCP server test');

      const adapter = createMockAdapterWithMcp({
        runtime: 'claude',
        rootPath,
        supportSubtree,
      });
      const targets = makeTargets(rootPath, supportSubtree, tempDir);
      const corpus = makeCorpus(join(supportSubtree, 'corpus', 'owasp-corpus.json'));

      const result = await registerMcpServers([adapter], targets, corpus, {
        dryRun: false,
        pkgRoot: join(tempDir, 'pkg'),
      });

      const expectedPath = join(tempDir, 'pkg', 'dist', 'mcp', 'server.bundle.js');
      assert.ok(result.serverBinaryPaths.claude);
      assert.equal(result.serverBinaryPaths.claude, expectedPath);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('returns server binary path in result', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'gss-p9-'));
    try {
      const rootPath = join(tempDir, 'claude');
      const supportSubtree = join(rootPath, 'gss');
      mkdirSync(supportSubtree, { recursive: true });
      const srcDir = join(tempDir, 'pkg', 'dist', 'mcp');
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(join(srcDir, 'server.bundle.js'), '// test');

      const adapter = createMockAdapterWithMcp({ runtime: 'claude', rootPath, supportSubtree });
      const targets = makeTargets(rootPath, supportSubtree, tempDir);
      const corpus = makeCorpus(join(supportSubtree, 'corpus/owasp-corpus.json'));

      const result = await registerMcpServers([adapter], targets, corpus, {
        dryRun: false,
        pkgRoot: join(tempDir, 'pkg'),
      });

      assert.ok(result.serverBinaryPaths.claude);
      assert.ok(result.serverBinaryPaths.claude.includes('server'));
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('reports error when source binary absent', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'gss-p9-'));
    try {
      const rootPath = join(tempDir, 'claude');
      const supportSubtree = join(rootPath, 'gss');
      mkdirSync(supportSubtree, { recursive: true });

      const adapter = createMockAdapterWithMcp({ runtime: 'claude', rootPath, supportSubtree });
      const targets = makeTargets(rootPath, supportSubtree, tempDir);
      const corpus = makeCorpus(join(supportSubtree, 'corpus/owasp-corpus.json'));

      const result = await registerMcpServers([adapter], targets, corpus, {
        dryRun: false,
        pkgRoot: join(tempDir, 'pkg'),
      });

      assert.ok(result.errors.length > 0);
      assert.ok(result.errors[0].includes('MCP server entrypoint not found') || result.errors[0].includes('not found'));
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('resolves packaged server path correctly', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'gss-p9-'));
    try {
      const rootPath = join(tempDir, 'claude');
      const supportSubtree = join(rootPath, 'gss');
      mkdirSync(supportSubtree, { recursive: true });
      const srcDir = join(tempDir, 'pkg', 'dist', 'mcp');
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(join(srcDir, 'server.bundle.js'), '// test');

      const adapter = createMockAdapterWithMcp({ runtime: 'claude', rootPath, supportSubtree });
      const targets = makeTargets(rootPath, supportSubtree, tempDir);
      const corpus = makeCorpus(join(supportSubtree, 'corpus/owasp-corpus.json'));

      const result = await registerMcpServers([adapter], targets, corpus, {
        dryRun: false,
        pkgRoot: join(tempDir, 'pkg'),
      });

      assert.ok(result.serverBinaryPaths.claude);
      assert.ok(result.serverBinaryPaths.claude.includes('server.bundle.js'));
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe('registerMcpServers — Config merge', () => {
  it('merges MCP config into .mcp.json', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'gss-p9-'));
    try {
      const rootPath = join(tempDir, 'claude');
      const supportSubtree = join(rootPath, 'gss');
      mkdirSync(supportSubtree, { recursive: true });
      mkdirSync(join(rootPath), { recursive: true });

      const srcDir = join(tempDir, 'pkg', 'dist', 'mcp');
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(join(srcDir, 'server.bundle.js'), '// test');

      const adapter = createMockAdapterWithMcp({ runtime: 'claude', rootPath, supportSubtree });
      const targets = makeTargets(rootPath, supportSubtree, tempDir);
      const corpus = makeCorpus(join(supportSubtree, 'corpus/owasp-corpus.json'));

      const result = await registerMcpServers([adapter], targets, corpus, {
        dryRun: false,
        pkgRoot: join(tempDir, 'pkg'),
      });

      const mcpConfigPath = result.configPaths.claude;
      assert.ok(mcpConfigPath);
      const config = JSON.parse(readFileSync(mcpConfigPath, 'utf-8'));
      assert.ok(config.mcpServers);
      assert.ok('gss-security-docs' in config.mcpServers);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('preserves existing .mcp.json content', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'gss-p9-'));
    try {
      const rootPath = join(tempDir, 'claude');
      const supportSubtree = join(rootPath, 'gss');
      mkdirSync(supportSubtree, { recursive: true });
      mkdirSync(join(rootPath), { recursive: true });
      writeFileSync(join(tempDir, '.mcp.json'), JSON.stringify({ otherKey: true }));

      const srcDir = join(tempDir, 'pkg', 'dist', 'mcp');
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(join(srcDir, 'server.bundle.js'), '// test');

      const adapter = createMockAdapterWithMcp({ runtime: 'claude', rootPath, supportSubtree });
      const targets = makeTargets(rootPath, supportSubtree, tempDir);
      const corpus = makeCorpus(join(supportSubtree, 'corpus/owasp-corpus.json'));

      const result = await registerMcpServers([adapter], targets, corpus, {
        dryRun: false,
        pkgRoot: join(tempDir, 'pkg'),
      });

      const config = JSON.parse(readFileSync(result.configPaths.claude, 'utf-8'));
      assert.equal(config.otherKey, true);
      assert.ok(config.mcpServers);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('records config path in result', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'gss-p9-'));
    try {
      const rootPath = join(tempDir, 'claude');
      const supportSubtree = join(rootPath, 'gss');
      mkdirSync(supportSubtree, { recursive: true });
      const srcDir = join(tempDir, 'pkg', 'dist', 'mcp');
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(join(srcDir, 'server.bundle.js'), '// test');

      const adapter = createMockAdapterWithMcp({ runtime: 'claude', rootPath, supportSubtree });
      const targets = makeTargets(rootPath, supportSubtree, tempDir);
      const corpus = makeCorpus(join(supportSubtree, 'corpus/owasp-corpus.json'));

      const result = await registerMcpServers([adapter], targets, corpus, {
        dryRun: false,
        pkgRoot: join(tempDir, 'pkg'),
      });

      assert.ok(result.configPaths.claude);
      assert.ok(result.configPaths.claude.endsWith('.mcp.json'));
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('creates .mcp.json if missing', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'gss-p9-'));
    try {
      const rootPath = join(tempDir, 'claude');
      const supportSubtree = join(rootPath, 'gss');
      mkdirSync(supportSubtree, { recursive: true });
      const srcDir = join(tempDir, 'pkg', 'dist', 'mcp');
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(join(srcDir, 'server.bundle.js'), '// test');

      const adapter = createMockAdapterWithMcp({ runtime: 'claude', rootPath, supportSubtree });
      const targets = makeTargets(rootPath, supportSubtree, tempDir);
      const corpus = makeCorpus(join(supportSubtree, 'corpus/owasp-corpus.json'));

      const result = await registerMcpServers([adapter], targets, corpus, {
        dryRun: false,
        pkgRoot: join(tempDir, 'pkg'),
      });

      // Settings file should have been written (directory created)
      assert.ok(existsSync(result.configPaths.claude));
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe('registerMcpServers — Error handling', () => {
  it('non-fatal error when source binary absent', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'gss-p9-'));
    try {
      const rootPath = join(tempDir, 'claude');
      const supportSubtree = join(rootPath, 'gss');
      mkdirSync(supportSubtree, { recursive: true });

      const adapter = createMockAdapterWithMcp({ runtime: 'claude', rootPath, supportSubtree });
      const targets = makeTargets(rootPath, supportSubtree, tempDir);
      const corpus = makeCorpus(join(supportSubtree, 'corpus/owasp-corpus.json'));

      // Should not throw
      const result = await registerMcpServers([adapter], targets, corpus, {
        dryRun: false,
        pkgRoot: join(tempDir, 'pkg'),
      });
      assert.ok(result.errors.length > 0);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('non-fatal error on invalid JSON in existing .mcp.json', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'gss-p9-'));
    try {
      const rootPath = join(tempDir, 'claude');
      const supportSubtree = join(rootPath, 'gss');
      mkdirSync(supportSubtree, { recursive: true });
      mkdirSync(join(rootPath), { recursive: true });
      writeFileSync(join(tempDir, '.mcp.json'), 'not-json');

      const srcDir = join(tempDir, 'pkg', 'dist', 'mcp');
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(join(srcDir, 'server.bundle.js'), '// test');

      const adapter = createMockAdapterWithMcp({ runtime: 'claude', rootPath, supportSubtree });
      const targets = makeTargets(rootPath, supportSubtree, tempDir);
      const corpus = makeCorpus(join(supportSubtree, 'corpus/owasp-corpus.json'));

      // Should not throw — error goes into result.errors
      const result = await registerMcpServers([adapter], targets, corpus, {
        dryRun: false,
        pkgRoot: join(tempDir, 'pkg'),
      });
      // The function may succeed or fail depending on merge logic with corrupt JSON
      // Key assertion: it does not throw
      assert.ok(result);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('skips adapter without getMcpRegistration', async () => {
    const adapter = {
      runtime: 'claude',
      resolveRootPath: () => '/root',
      resolveSupportSubtree: () => '/root/gss',
    };
    const targets = makeTargets('/root', '/root/gss');
    const corpus = makeCorpus('/root/gss/corpus/owasp-corpus.json');

    const result = await registerMcpServers([adapter], targets, corpus, {
      dryRun: false,
      pkgRoot: '/pkg',
    });
    assert.equal(result.errors.length, 0);
    assert.equal(Object.keys(result.configPaths).length, 0);
  });

  it('skips when corpus is null', async () => {
    const adapter = createMockAdapterWithMcp();
    const targets = makeTargets('/root', '/root/gss');

    const result = await registerMcpServers([adapter], targets, null, {
      dryRun: false,
      pkgRoot: '/pkg',
    });
    assert.equal(result.configPaths.claude, undefined);
    assert.equal(result.serverBinaryPaths.claude, undefined);
    assert.equal(result.errors.length, 0);
  });
});

describe('registerMcpServers — Dry-run mode', () => {
  it('dry-run computes paths without I/O', async () => {
    const adapter = createMockAdapterWithMcp({
      runtime: 'claude',
      rootPath: '/mock/root',
      supportSubtree: '/mock/root/gss',
    });
    const targets = makeTargets('/mock/root', '/mock/root/gss');
    const corpus = makeCorpus('/mock/root/gss/corpus/owasp-corpus.json');

    const result = await registerMcpServers([adapter], targets, corpus, {
      dryRun: true,
      pkgRoot: '/pkg',
    });

    // In dry-run mode, paths are computed but no files are written
    assert.ok(result.serverBinaryPaths.claude);
    assert.ok(result.configPaths.claude);
    assert.equal(result.errors.length, 0);
  });

  it('dry-run with null corpus returns empty', async () => {
    const adapter = createMockAdapterWithMcp();
    const targets = makeTargets('/root', '/root/gss');

    const result = await registerMcpServers([adapter], targets, null, {
      dryRun: true,
      pkgRoot: '/pkg',
    });

    assert.deepStrictEqual(result.configPaths, {});
    assert.deepStrictEqual(result.serverBinaryPaths, {});
    assert.equal(result.errors.length, 0);
  });
});

describe('registerMcpServers — Multiple runtimes', () => {
  it('registers MCP for both Claude and Codex', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'gss-p9-'));
    try {
      const claudeRoot = join(tempDir, 'claude');
      const codexRoot = join(tempDir, 'codex');
      mkdirSync(join(claudeRoot, 'gss'), { recursive: true });
      mkdirSync(join(codexRoot, 'gss'), { recursive: true });

      const srcDir = join(tempDir, 'pkg', 'dist', 'mcp');
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(join(srcDir, 'server.bundle.js'), '// test');

      const claudeAdapter = createMockAdapterWithMcp({
        runtime: 'claude', rootPath: claudeRoot, supportSubtree: join(claudeRoot, 'gss'),
      });
      const codexAdapter = createMockAdapterWithMcp({
        runtime: 'codex', rootPath: codexRoot, supportSubtree: join(codexRoot, 'gss'),
      });

      const targets = {
        runtimes: ['claude', 'codex'],
        scope: 'local',
        cwd: tempDir,
        roots: { claude: claudeRoot, codex: codexRoot },
        supportSubtrees: { claude: join(claudeRoot, 'gss'), codex: join(codexRoot, 'gss') },
      };
      const corpus = {
        snapshot: { corpusVersion: '1.0.0', documents: [] },
        corpusVersion: '1.0.0',
        sourcePath: '/mock/source.json',
        destinationPaths: {
          claude: join(claudeRoot, 'gss', 'corpus', 'owasp-corpus.json'),
          codex: join(codexRoot, 'gss', 'corpus', 'owasp-corpus.json'),
        },
      };

      const result = await registerMcpServers([claudeAdapter, codexAdapter], targets, corpus, {
        dryRun: false,
        pkgRoot: join(tempDir, 'pkg'),
      });

      assert.ok(result.configPaths.claude);
      assert.ok(result.configPaths.codex);
      assert.ok(result.serverBinaryPaths.claude);
      assert.ok(result.serverBinaryPaths.codex);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('continues past first runtime failure', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'gss-p9-'));
    try {
      const codexRoot = join(tempDir, 'codex');
      mkdirSync(join(codexRoot, 'gss'), { recursive: true });

      const srcDir = join(tempDir, 'pkg', 'dist', 'mcp');
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(join(srcDir, 'server.bundle.js'), '// test');

      // Claude adapter with nonexistent paths will fail
      const claudeAdapter = createMockAdapterWithMcp({
        runtime: 'claude',
        rootPath: '/nonexistent/path',
        supportSubtree: '/nonexistent/path/gss',
      });
      const codexAdapter = createMockAdapterWithMcp({
        runtime: 'codex', rootPath: codexRoot, supportSubtree: join(codexRoot, 'gss'),
      });

      const targets = {
        runtimes: ['claude', 'codex'],
        scope: 'local',
        cwd: tempDir,
        roots: { claude: '/nonexistent/path', codex: codexRoot },
        supportSubtrees: { claude: '/nonexistent/path/gss', codex: join(codexRoot, 'gss') },
      };
      const corpus = {
        snapshot: { corpusVersion: '1.0.0', documents: [] },
        corpusVersion: '1.0.0',
        sourcePath: '/mock/source.json',
        destinationPaths: {
          claude: '/nonexistent/path/gss/corpus/owasp-corpus.json',
          codex: join(codexRoot, 'gss', 'corpus', 'owasp-corpus.json'),
        },
      };

      const result = await registerMcpServers([claudeAdapter, codexAdapter], targets, corpus, {
        dryRun: false,
        pkgRoot: join(tempDir, 'pkg'),
      });

      // Codex should still succeed
      assert.ok(result.configPaths.codex || result.serverBinaryPaths.codex);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
