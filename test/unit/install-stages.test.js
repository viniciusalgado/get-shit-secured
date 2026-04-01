/**
 * Phase 3 Tests — Install stages, --legacy-specialists flag, corpus data files
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { detectTargets, DEFAULT_WORKFLOWS } from '../../dist/core/install-stages.js';
import { parseArgs } from '../../dist/cli/parse-args.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- Stage 0: detectTargets ---

describe('Install Stages - detectTargets', () => {
  it('should detect targets from a single adapter', () => {
    const mockAdapter = {
      runtime: 'claude',
      resolveRootPath: () => '.claude',
      resolveSupportSubtree: () => '.claude/gss',
    };
    const targets = detectTargets([mockAdapter], 'local', '/project');
    assert.deepEqual(targets.runtimes, ['claude']);
    assert.equal(targets.roots.claude, '.claude');
    assert.equal(targets.supportSubtrees.claude, '.claude/gss');
  });

  it('should detect multiple runtimes', () => {
    const mockClaude = {
      runtime: 'claude',
      resolveRootPath: () => '.claude',
      resolveSupportSubtree: () => '.claude/gss',
    };
    const mockCodex = {
      runtime: 'codex',
      resolveRootPath: () => '.codex',
      resolveSupportSubtree: () => '.codex/gss',
    };
    const targets = detectTargets([mockClaude, mockCodex], 'local', '/project');
    assert.deepEqual(targets.runtimes, ['claude', 'codex']);
  });
});

describe('DEFAULT_WORKFLOWS', () => {
  it('should contain all 9 workflow IDs', () => {
    assert.equal(DEFAULT_WORKFLOWS.length, 9);
    assert.ok(DEFAULT_WORKFLOWS.includes('audit'));
    assert.ok(DEFAULT_WORKFLOWS.includes('verify'));
    assert.ok(DEFAULT_WORKFLOWS.includes('report'));
  });
});

// --- CLI: --legacy-specialists flag ---

describe('CLI - --legacy-specialists flag', () => {
  it('should parse --legacy-specialists flag', () => {
    const args = parseArgs(['--claude', '--legacy-specialists']);
    assert.equal(args.legacySpecialists, true);
    assert.ok(args.runtimes.includes('claude'));
  });

  it('should default legacySpecialists to false', () => {
    const args = parseArgs(['--claude']);
    assert.equal(args.legacySpecialists, false);
  });
});

// --- Corpus data files ---

describe('Corpus data files', () => {
  it('should have catalog.json with 113 entries', () => {
    const catalogPath = join(__dirname, '..', '..', 'data', 'corpus', 'catalog.json');
    const catalog = JSON.parse(readFileSync(catalogPath, 'utf-8'));
    assert.equal(catalog.sources.length, 113);
  });

  it('should have overrides.json with >= 90 specialist entries', () => {
    const overridesPath = join(__dirname, '..', '..', 'data', 'corpus', 'overrides.json');
    const overrides = JSON.parse(readFileSync(overridesPath, 'utf-8'));
    const entryCount = Object.keys(overrides.overrides).length;
    assert.ok(entryCount >= 90, `Expected >= 90 override entries, got ${entryCount}`);
  });
});
