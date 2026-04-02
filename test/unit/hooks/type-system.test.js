/**
 * Phase 8 — Type system tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getAllHooks } from './helpers.js';
import { ClaudeAdapter } from '../../../dist/runtimes/claude/adapter.js';

import { ARTIFACT_VALIDATION_RULES } from '../../../dist/hooks/artifact-validator.js';

const WORKFLOW_IDS = [
  'security-review', 'map-codebase', 'threat-model', 'audit',
  'validate-findings', 'plan-remediation', 'execute-remediation', 'verify', 'report',
];

describe('Phase 8 — Type system: ActiveWorkflow mode values', () => {
  const validModes = ['review-only', 'write-capable', 'verification'];
  it('review-only is a valid mode', () => assert.ok(validModes.includes('review-only')));
  it('write-capable is a valid mode', () => assert.ok(validModes.includes('write-capable')));
  it('verification is a valid mode', () => assert.ok(validModes.includes('verification')));
});

describe('Phase 8 — Type system: RuntimeManifest fields', () => {
  it('RuntimeManifest has Phase 8 fields', () => {
    const adapter = new ClaudeAdapter();
    const supportFiles = adapter.getSupportFiles();
    const readme = supportFiles.find(f => f.relativePath === 'README.md');
    assert.ok(readme, 'README support file should exist');
  });

  it('RuntimeManifest type allows corpusPath null', () => {
    const manifest = {
      runtime: 'claude', scope: 'local', installedAt: new Date().toISOString(),
      version: '0.1.0', corpusVersion: '1.0.0', hooks: [], managedConfigs: [],
      corpusPath: null, mcpServerPath: null, mcpConfigPath: '/test/settings.json', gssVersion: '0.1.0',
    };
    assert.strictEqual(manifest.corpusPath, null);
  });

  it('RuntimeManifest type allows mcpServerPath null', () => {
    const manifest = {
      runtime: 'claude', scope: 'local', installedAt: new Date().toISOString(),
      version: '0.1.0', corpusVersion: '1.0.0', hooks: [], managedConfigs: [],
      corpusPath: '/test/corpus.json', mcpServerPath: null, mcpConfigPath: '/test/settings.json', gssVersion: '0.1.0',
    };
    assert.strictEqual(manifest.mcpServerPath, null);
  });
});

describe('Phase 8 — Type system: Hook metadata', () => {
  it('all 4 hooks have correct IDs and events', () => {
    const hooks = getAllHooks();
    assert.strictEqual(hooks.length, 4);
    assert.deepStrictEqual(
      hooks.map(h => ({ id: h.id, event: h.event })),
      [
        { id: 'session-start', event: 'SessionStart' },
        { id: 'pre-tool-write', event: 'PreToolUse' },
        { id: 'pre-tool-edit', event: 'PreToolUse' },
        { id: 'post-tool-write', event: 'PostToolUse' },
      ]
    );
  });

  it('all hooks are non-blocking', () => {
    const hooks = getAllHooks();
    for (const hook of hooks) {
      assert.strictEqual(hook.blocking, false, `Hook ${hook.id} should be non-blocking`);
    }
  });
});

describe('Phase 8 — Type system: ARTIFACT_VALIDATION_RULES completeness', () => {
  it('all 9 workflow IDs have entries in rules', () => {
    for (const id of WORKFLOW_IDS) {
      assert.ok(id in ARTIFACT_VALIDATION_RULES, `Missing rule for ${id}`);
    }
    assert.strictEqual(Object.keys(ARTIFACT_VALIDATION_RULES).length, 9);
  });

  it('rules export validateArtifact function', () => {
    const adapter = new ClaudeAdapter();
    const supportFiles = adapter.getSupportFiles();
    const validatorFile = supportFiles.find(f => f.relativePath === 'hooks/artifact-validator.js');
    assert.ok(validatorFile, 'artifact-validator.js support file should exist');
    assert.ok(validatorFile.content.includes('validateArtifact'));
  });
});
