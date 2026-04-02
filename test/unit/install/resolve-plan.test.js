/**
 * Unit tests for resolveInstallPlan — pure computation, no I/O.
 * Phase 9 — Workstream C: Install plan resolution.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { join, resolve } from 'node:path';

import { resolveInstallPlan, detectTargets } from '../../../dist/core/install-stages.js';
import { createMockAdapter, createMockAdapterWithMcp } from './helpers.js';

function makeCorpus(version = '1.0.0') {
  return {
    snapshot: { corpusVersion: version, documents: [] },
    corpusVersion: version,
    sourcePath: `/mock/source/owasp-corpus.snapshot.json`,
    destinationPaths: { claude: `/mock/dest/corpus/owasp-corpus.json` },
  };
}

function makeTargets(rootPath = '/mock/root', supportSubtree = '/mock/root/gss') {
  return {
    runtimes: ['claude'],
    scope: 'local',
    cwd: '/mock',
    roots: { claude: rootPath },
    supportSubtrees: { claude: supportSubtree },
  };
}

describe('resolveInstallPlan — Plan structure', () => {
  it('returns InstallPlan with correct top-level fields', () => {
    const adapter = createMockAdapterWithMcp();
    const targets = makeTargets();
    const corpus = makeCorpus();
    const plan = resolveInstallPlan(targets, [adapter], corpus, {
      dryRun: true,
      legacySpecialists: false,
      pkgRoot: '/pkg',
    });
    assert.ok(plan.scope);
    assert.ok(Array.isArray(plan.runtimes));
    assert.ok(plan.corpus);
    assert.ok(Array.isArray(plan.fileOps));
    assert.ok(Array.isArray(plan.configOps));
    assert.ok(Array.isArray(plan.cleanupOps));
    assert.equal(plan.dryRun, true);
  });

  it('plan has corpus info with version and destinations', () => {
    const adapter = createMockAdapterWithMcp();
    const targets = makeTargets();
    const corpus = makeCorpus('1.0.0');
    const plan = resolveInstallPlan(targets, [adapter], corpus, {
      dryRun: false,
      legacySpecialists: false,
      pkgRoot: '/pkg',
    });
    assert.equal(plan.corpus?.version, '1.0.0');
    assert.ok(plan.corpus?.destinations?.length > 0);
  });

  it('plan has null corpus when not resolved', () => {
    const adapter = createMockAdapterWithMcp();
    const targets = makeTargets();
    const plan = resolveInstallPlan(targets, [adapter], null, {
      dryRun: false,
      legacySpecialists: false,
      pkgRoot: '/pkg',
    });
    assert.equal(plan.corpus, null);
  });

  it('plan dryRun matches option', () => {
    const adapter = createMockAdapter();
    const targets = makeTargets();
    const planDry = resolveInstallPlan(targets, [adapter], null, {
      dryRun: true,
      legacySpecialists: false,
      pkgRoot: '/pkg',
    });
    assert.equal(planDry.dryRun, true);

    const planNotDry = resolveInstallPlan(targets, [adapter], null, {
      dryRun: false,
      legacySpecialists: false,
      pkgRoot: '/pkg',
    });
    assert.equal(planNotDry.dryRun, false);
  });
});

describe('resolveInstallPlan — File operations', () => {
  it('file ops include hooks per runtime', () => {
    const adapter = createMockAdapterWithMcp({
      hooks: [
        { id: 'session-start', event: 'SessionStart', command: '', blocking: false },
        { id: 'pre-tool-write', event: 'PreToolUse', command: '', blocking: false },
        { id: 'pre-tool-edit', event: 'PreToolUse', command: '', blocking: false },
        { id: 'post-tool-write', event: 'PostToolUse', command: '', blocking: false },
      ],
    });
    const targets = makeTargets();
    const plan = resolveInstallPlan(targets, [adapter], makeCorpus(), {
      dryRun: false, legacySpecialists: false, pkgRoot: '/pkg',
    });
    assert.equal(plan.fileOps[0].hooks.length, 4);
  });

  it('file ops include role files when adapter provides them', () => {
    const adapter = createMockAdapterWithMcp();
    adapter.getRoleFiles = () => [
      { relativePath: 'agents/gss-auditor.md', content: 'auditor', category: 'entrypoint', overwritePolicy: 'create-only' },
    ];
    const targets = makeTargets();
    const plan = resolveInstallPlan(targets, [adapter], makeCorpus(), {
      dryRun: false, legacySpecialists: false, pkgRoot: '/pkg',
    });
    const agents = plan.fileOps[0].entrypointFiles.filter(f => f.includes('gss-auditor'));
    assert.ok(agents.length > 0, 'Should include role files');
  });

  it('multiple runtimes produce multiple file ops', () => {
    const claudeAdapter = createMockAdapterWithMcp({ runtime: 'claude' });
    const codexAdapter = createMockAdapterWithMcp({
      runtime: 'codex',
      rootPath: '/mock/codex',
      supportSubtree: '/mock/codex/gss',
    });
    const targets = {
      runtimes: ['claude', 'codex'],
      scope: 'local',
      cwd: '/mock',
      roots: { claude: '/mock/claude', codex: '/mock/codex' },
      supportSubtrees: { claude: '/mock/claude/gss', codex: '/mock/codex/gss' },
    };
    const corpus = makeCorpus();
    corpus.destinationPaths = {
      claude: '/mock/claude/gss/corpus/owasp-corpus.json',
      codex: '/mock/codex/gss/corpus/owasp-corpus.json',
    };
    const plan = resolveInstallPlan(targets, [claudeAdapter, codexAdapter], corpus, {
      dryRun: false, legacySpecialists: false, pkgRoot: '/pkg',
    });
    assert.equal(plan.fileOps.length, 2);
  });
});

describe('resolveInstallPlan — Config operations', () => {
  it('config ops include MCP server copy when adapter has MCP', () => {
    const adapter = createMockAdapterWithMcp();
    const targets = makeTargets();
    const corpus = makeCorpus();
    const plan = resolveInstallPlan(targets, [adapter], corpus, {
      dryRun: false, legacySpecialists: false, pkgRoot: '/pkg',
    });
    assert.ok(plan.configOps[0].mcpServerCopy !== null);
    assert.ok(plan.configOps[0].mcpServerCopy.src);
    assert.ok(plan.configOps[0].mcpServerCopy.dest);
  });

  it('config ops include MCP config patch when adapter has MCP', () => {
    const adapter = createMockAdapterWithMcp();
    const targets = makeTargets();
    const corpus = makeCorpus();
    const plan = resolveInstallPlan(targets, [adapter], corpus, {
      dryRun: false, legacySpecialists: false, pkgRoot: '/pkg',
    });
    assert.ok(plan.configOps[0].mcpConfigPatch !== null);
    assert.ok(plan.configOps[0].mcpConfigPatch.content);
  });

  it('config ops have no MCP when corpus is null', () => {
    const adapter = createMockAdapterWithMcp();
    const targets = makeTargets();
    const plan = resolveInstallPlan(targets, [adapter], null, {
      dryRun: false, legacySpecialists: false, pkgRoot: '/pkg',
    });
    assert.equal(plan.configOps[0].mcpServerCopy, null);
    assert.equal(plan.configOps[0].mcpConfigPatch, null);
  });
});

describe('resolveInstallPlan — Cleanup operations', () => {
  it('no cleanup ops on fresh install', () => {
    const adapter = createMockAdapter();
    const targets = makeTargets();
    const plan = resolveInstallPlan(targets, [adapter], makeCorpus(), {
      dryRun: false, legacySpecialists: false, pkgRoot: '/pkg',
    });
    assert.equal(plan.cleanupOps.length, 0);
  });

  it('cleanup ops listed when adapter has specialist files', () => {
    const adapter = createMockAdapter();
    adapter.getSpecialistFiles = () => [
      { relativePath: 'agents/gss-specialist-sql.md', content: 'x' },
      { relativePath: 'agents/gss-specialist-xss.md', content: 'x' },
    ];
    const targets = makeTargets();
    const plan = resolveInstallPlan(targets, [adapter], makeCorpus(), {
      dryRun: false, legacySpecialists: false, pkgRoot: '/pkg',
    });
    assert.ok(plan.cleanupOps.length > 0);
    assert.ok(plan.cleanupOps[0].files.length > 0);
  });

  it('no cleanup when legacySpecialists flag is set', () => {
    const adapter = createMockAdapter();
    adapter.getSpecialistFiles = () => [
      { relativePath: 'agents/gss-specialist-sql.md', content: 'x' },
    ];
    const targets = makeTargets();
    const plan = resolveInstallPlan(targets, [adapter], makeCorpus(), {
      dryRun: false, legacySpecialists: true, pkgRoot: '/pkg',
    });
    assert.equal(plan.cleanupOps.length, 0);
  });

  it('cleanup description is human-readable', () => {
    const adapter = createMockAdapter();
    adapter.getSpecialistFiles = () => [
      { relativePath: 'agents/gss-specialist-sql.md', content: 'x' },
    ];
    const targets = makeTargets();
    const plan = resolveInstallPlan(targets, [adapter], makeCorpus(), {
      dryRun: false, legacySpecialists: false, pkgRoot: '/pkg',
    });
    assert.ok(plan.cleanupOps[0].description.includes('specialist'));
    assert.ok(plan.cleanupOps[0].description.includes('1'));
  });
});

describe('resolveInstallPlan — No I/O guarantee', () => {
  it('function is pure — completes with nonexistent paths', () => {
    const adapter = createMockAdapter({
      rootPath: '/nonexistent/path/claude',
      supportSubtree: '/nonexistent/path/claude/gss',
    });
    const targets = makeTargets('/nonexistent/path/claude', '/nonexistent/path/claude/gss');
    // This should not throw — purely computational
    const plan = resolveInstallPlan(targets, [adapter], makeCorpus(), {
      dryRun: true, legacySpecialists: false, pkgRoot: '/nonexistent/pkg',
    });
    assert.ok(plan);
    assert.equal(plan.runtimes.length, 1);
  });
});
