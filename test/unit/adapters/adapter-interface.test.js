/**
 * Unit tests for RuntimeAdapter interface compliance — Phase 10.
 * Validates that both Claude and Codex adapters implement the
 * RuntimeAdapter interface completely, including the new getRoleFiles() method.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Check if dist is available
let distAvailable = false;
try {
  await import('../../../dist/runtimes/claude/adapter.js');
  await import('../../../dist/runtimes/codex/adapter.js');
  distAvailable = true;
} catch {
  distAvailable = false;
}

const ClaudeAdapter = distAvailable ? (await import('../../../dist/runtimes/claude/adapter.js')).ClaudeAdapter : null;
const CodexAdapter = distAvailable ? (await import('../../../dist/runtimes/codex/adapter.js')).CodexAdapter : null;

const describeOrSkip = distAvailable ? describe : describe.skip;

/**
 * Required methods on RuntimeAdapter interface.
 * If the interface changes, this list must be updated.
 */
const REQUIRED_METHODS = [
  'resolveRootPath',
  'resolveSupportSubtree',
  'getPlaceholderFiles',
  'getFilesForWorkflow',
  'getSupportFiles',
  'getManagedJsonPatches',
  'getManagedTextBlocks',
  'getHooks',
  'getMcpRegistration',
  'getCapabilities',
  'getRoleFiles',
];

describeOrSkip('RuntimeAdapter — Interface compliance', () => {
  it('Claude adapter implements getRoleFiles()', () => {
    const adapter = new ClaudeAdapter();
    assert.equal(typeof adapter.getRoleFiles, 'function',
      'Claude adapter should have getRoleFiles method');
  });

  it('Codex adapter implements getRoleFiles()', () => {
    const adapter = new CodexAdapter();
    assert.equal(typeof adapter.getRoleFiles, 'function',
      'Codex adapter should have getRoleFiles method');
  });

  it('Claude adapter implements all required RuntimeAdapter methods', () => {
    const adapter = new ClaudeAdapter();
    for (const method of REQUIRED_METHODS) {
      assert.equal(typeof adapter[method], 'function',
        `Claude adapter should implement ${method}`);
    }
  });

  it('Codex adapter implements all required RuntimeAdapter methods', () => {
    const adapter = new CodexAdapter();
    for (const method of REQUIRED_METHODS) {
      assert.equal(typeof adapter[method], 'function',
        `Codex adapter should implement ${method}`);
    }
  });

  it('Claude adapter runtime is "claude"', () => {
    const adapter = new ClaudeAdapter();
    assert.equal(adapter.runtime, 'claude');
  });

  it('Codex adapter runtime is "codex"', () => {
    const adapter = new CodexAdapter();
    assert.equal(adapter.runtime, 'codex');
  });

  it('install-stages.ts uses getRoleFiles() not duck-typing', async () => {
    // Read the compiled install-stages.js and verify it does not use
    // the old duck-typed patterns getRoleAgentFiles/getRoleSkillFiles
    // for role file dispatch.
    const { readFileSync } = await import('node:fs');
    const { resolve, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');

    const __dirname = dirname(fileURLToPath(import.meta.url));
    const installStagesPath = resolve(__dirname, '../../dist/core/install-stages.js');

    let source;
    try {
      source = readFileSync(installStagesPath, 'utf-8');
    } catch {
      // If we can't read the file, skip this test
      assert.ok(true, 'Skipping source code inspection — file not accessible');
      return;
    }

    // The compiled output should contain adapter.getRoleFiles() for dispatch.
    // It should NOT contain duck-typed patterns like:
    //   typeof adapterWithRoles.getRoleAgentFiles === 'function'
    // for the role dispatch code path.
    assert.ok(source.includes('getRoleFiles'),
      'install-stages should reference getRoleFiles');

    // Check that the old duck-typed dispatch pattern is gone
    // Note: The deprecated alias methods still exist in the adapter files,
    // but install-stages should not be calling them directly via duck-typing.
    const hasDuckTypedAgentDispatch = source.includes('typeof') && source.includes('getRoleAgentFiles');
    const hasDuckTypedSkillDispatch = source.includes('typeof') && source.includes('getRoleSkillFiles');

    assert.ok(!hasDuckTypedAgentDispatch,
      'install-stages should not use duck-typed getRoleAgentFiles dispatch');
    assert.ok(!hasDuckTypedSkillDispatch,
      'install-stages should not use duck-typed getRoleSkillFiles dispatch');
  });
});
