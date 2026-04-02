/**
 * Integration tests for Phase 11 — compare-runs CLI with file I/O.
 * Validates end-to-end comparison of consultation trace files on disk.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';

import { compareRuns } from '../../dist/cli/compare-runs.js';
import { captureOutputAsync } from '../unit/install/helpers.js';

function createTempDir() {
  return mkdtemp(join(tmpdir(), 'gss-p11-cmpint-'));
}

function cleanupTempDir(dir) {
  rmSync(dir, { recursive: true, force: true });
}

function writeTraceFile(dir, filename, overrides = {}) {
  const trace = {
    plan: {
      workflowId: 'audit',
      generatedAt: new Date().toISOString(),
      corpusVersion: '1.0.0',
      requiredCount: overrides.requiredCount ?? 3,
      optionalCount: 2,
      followupCount: 1,
    },
    consultedDocs: overrides.consultedDocs || [],
    coverageStatus: overrides.coverageStatus || 'pass',
    requiredMissing: overrides.requiredMissing || [],
    notes: overrides.notes || [],
  };
  const filePath = join(dir, filename);
  writeFileSync(filePath, JSON.stringify(trace, null, 2), 'utf-8');
  return filePath;
}

describe('Phase 11 — compare-runs CLI integration', () => {
  it('compare two trace files → valid JSON output', async () => {
    const tempDir = await createTempDir();
    try {
      const mcpPath = writeTraceFile(tempDir, 'mcp-trace.json', {
        consultedDocs: [
          { id: 'sql-injection', title: 'SQL Injection', sourceUrl: 'https://example.com' },
          { id: 'xss-prevention', title: 'XSS Prevention', sourceUrl: 'https://example.com' },
        ],
      });
      const legacyPath = writeTraceFile(tempDir, 'legacy-trace.json', {
        consultedDocs: [
          { id: 'sql-injection', title: 'SQL Injection', sourceUrl: 'https://example.com' },
          { id: 'xss-prevention', title: 'XSS Prevention', sourceUrl: 'https://example.com' },
        ],
      });

      const { result, } = await captureOutputAsync(() =>
        compareRuns(['--mcp', mcpPath, '--legacy', legacyPath])
      );

      assert.equal(result, 0);
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('--output flag writes comparison to specified file', async () => {
    const tempDir = await createTempDir();
    try {
      const mcpPath = writeTraceFile(tempDir, 'mcp-trace.json', {
        consultedDocs: [{ id: 'a', title: 'A', sourceUrl: '' }],
      });
      const legacyPath = writeTraceFile(tempDir, 'legacy-trace.json', {
        consultedDocs: [{ id: 'a', title: 'A', sourceUrl: '' }],
      });
      const outputPath = join(tempDir, 'comparison-output.json');

      const { result } = await captureOutputAsync(() =>
        compareRuns(['--mcp', mcpPath, '--legacy', legacyPath, '--output', outputPath])
      );

      assert.equal(result, 0);
      assert.ok(existsSync(outputPath), 'Output file should exist');

      const content = JSON.parse(readFileSync(outputPath, 'utf-8'));
      assert.equal(content.schemaVersion, 1);
      assert.ok(content.assessment, 'Should have assessment field');
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('non-existent path → exit code 1', async () => {
    const tempDir = await createTempDir();
    try {
      const { result, errors } = await captureOutputAsync(() =>
        compareRuns([
          '--mcp', join(tempDir, 'nonexistent', 'file.json'),
          '--legacy', join(tempDir, 'legacy.json'),
        ])
      );

      assert.equal(result, 1);
      assert.ok(errors.some(e => e.includes('not found') || e.includes('Could not load')));
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('mcp-superior comparison report includes correct doc lists', async () => {
    const tempDir = await createTempDir();
    try {
      const mcpPath = writeTraceFile(tempDir, 'mcp-trace.json', {
        consultedDocs: [
          { id: 'sql-injection', title: 'SQL Injection', sourceUrl: '' },
          { id: 'xss-prevention', title: 'XSS Prevention', sourceUrl: '' },
          { id: 'input-validation', title: 'Input Validation', sourceUrl: '' },
        ],
      });
      const legacyPath = writeTraceFile(tempDir, 'legacy-trace.json', {
        consultedDocs: [],
        requiredMissing: ['sql-injection', 'xss-prevention', 'input-validation'],
      });

      const outputPath = join(tempDir, 'comparison-output.json');

      const { result } = await captureOutputAsync(() =>
        compareRuns(['--mcp', mcpPath, '--legacy', legacyPath, '--output', outputPath])
      );

      assert.equal(result, 0);

      const parsed = JSON.parse(readFileSync(outputPath, 'utf-8'));
      assert.deepEqual(parsed.mcpOnly.sort(), ['input-validation', 'sql-injection', 'xss-prevention']);
      assert.deepEqual(parsed.legacyOnly, []);
      assert.equal(parsed.assessment, 'mcp-superior');
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('compare directories containing traces', async () => {
    const tempDir = await createTempDir();
    try {
      const mcpDir = join(tempDir, 'mcp-traces');
      const legacyDir = join(tempDir, 'legacy-traces');
      mkdirSync(mcpDir, { recursive: true });
      mkdirSync(legacyDir, { recursive: true });

      writeTraceFile(mcpDir, 'consultation-2026-03-30.json', {
        consultedDocs: [{ id: 'old-doc', title: 'Old', sourceUrl: '' }],
      });
      writeTraceFile(mcpDir, 'consultation-2026-04-01.json', {
        consultedDocs: [{ id: 'new-doc', title: 'New', sourceUrl: '' }],
      });
      writeTraceFile(legacyDir, 'consultation-2026-04-01.json', {
        consultedDocs: [{ id: 'new-doc', title: 'New', sourceUrl: '' }],
      });

      const { result } = await captureOutputAsync(() =>
        compareRuns(['--mcp', mcpDir, '--legacy', legacyDir])
      );

      assert.equal(result, 0);
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('invalid trace file returns exit code 1', async () => {
    const tempDir = await createTempDir();
    try {
      const mcpPath = join(tempDir, 'bad.json');
      writeFileSync(mcpPath, JSON.stringify({ bad: true }), 'utf-8');
      const legacyPath = writeTraceFile(tempDir, 'legacy-trace.json', {
        consultedDocs: [],
      });

      const { result } = await captureOutputAsync(() =>
        compareRuns(['--mcp', mcpPath, '--legacy', legacyPath])
      );

      assert.equal(result, 1);
    } finally {
      cleanupTempDir(tempDir);
    }
  });
});
