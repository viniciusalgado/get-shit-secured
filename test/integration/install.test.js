/**
 * Integration tests for installation.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('install', () => {
  it('should install claude runtime locally', async () => {
    // Create temp directory for test
    const tempDir = `${tmpdir()}/gss-test-${Date.now()}`;
    await mkdtemp(tempDir);

    try {
      assert.ok(true, 'placeholder - will test actual install');
    } finally {
      // Cleanup
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should install codex runtime locally', async () => {
    assert.ok(true, 'placeholder');
  });

  it('should install both runtimes', async () => {
    assert.ok(true, 'placeholder');
  });

  it('should preserve existing settings.json', async () => {
    assert.ok(true, 'placeholder');
  });

  it('should write install manifest', async () => {
    assert.ok(true, 'placeholder');
  });

  it('should support reinstall without overwrite', async () => {
    assert.ok(true, 'placeholder');
  });
});
