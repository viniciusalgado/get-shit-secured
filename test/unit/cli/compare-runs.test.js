/**
 * Unit tests for compare-runs CLI command.
 * Phase 11 — Workstream B: Dual-run comparison strategy.
 *
 * Validates argument parsing, file I/O, output format, and directory mode.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

import { compareRuns } from '../../../dist/cli/compare-runs.js';
import { captureOutputAsync } from '../install/helpers.js';

function createTempDir() {
  return mkdtemp(join(tmpdir(), 'gss-p11-cmp-'));
}

function cleanupTempDir(dir) {
  rmSync(dir, { recursive: true, force: true });
}

/**
 * Write a consultation trace to a file.
 */
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

describe('compare-runs CLI command', () => {
  it('returns 1 when --mcp is not provided', async () => {
    const { errors, result } = await captureOutputAsync(() =>
      compareRuns(['--legacy', '/some/file.json'])
    );
    assert.equal(result, 1);
    assert.ok(errors.some(e => e.includes('Usage')),
      `Expected usage error. Got: ${errors.join('\n')}`);
  });

  it('returns 1 when --legacy is not provided', async () => {
    const { errors, result } = await captureOutputAsync(() =>
      compareRuns(['--mcp', '/some/file.json'])
    );
    assert.equal(result, 1);
    assert.ok(errors.some(e => e.includes('Usage')),
      `Expected usage error. Got: ${errors.join('\n')}`);
  });

  it('returns 1 when MCP trace file does not exist', async () => {
    const tempDir = await createTempDir();
    try {
      const legacyPath = writeTraceFile(tempDir, 'legacy.json');
      const { errors, result } = await captureOutputAsync(() =>
        compareRuns(['--mcp', '/nonexistent/mcp.json', '--legacy', legacyPath])
      );
      assert.equal(result, 1);
      assert.ok(errors.some(e => e.includes('Could not load') || e.includes('not found') || e.includes('Error')),
        `Expected file-not-found error. Got: ${errors.join('\n')}`);
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('returns 1 when legacy trace file does not exist', async () => {
    const tempDir = await createTempDir();
    try {
      const mcpPath = writeTraceFile(tempDir, 'mcp.json');
      const { errors, result } = await captureOutputAsync(() =>
        compareRuns(['--mcp', mcpPath, '--legacy', '/nonexistent/legacy.json'])
      );
      assert.equal(result, 1);
      assert.ok(errors.some(e => e.includes('Could not load') || e.includes('not found') || e.includes('Error')),
        `Expected file-not-found error. Got: ${errors.join('\n')}`);
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('returns 0 with valid trace files', async () => {
    const tempDir = await createTempDir();
    try {
      const mcpPath = writeTraceFile(tempDir, 'mcp-consultation.json', {
        consultedDocs: [
          { id: 'sql-injection', title: 'SQL Injection', sourceUrl: '' },
          { id: 'xss-prevention', title: 'XSS Prevention', sourceUrl: '' },
        ],
      });
      const legacyPath = writeTraceFile(tempDir, 'legacy-consultation.json', {
        consultedDocs: [
          { id: 'sql-injection', title: 'SQL Injection', sourceUrl: '' },
        ],
      });

      const { result } = await captureOutputAsync(() =>
        compareRuns(['--mcp', mcpPath, '--legacy', legacyPath])
      );
      assert.equal(result, 0);
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('--output writes JSON comparison to file', async () => {
    const tempDir = await createTempDir();
    try {
      const mcpPath = writeTraceFile(tempDir, 'mcp-consultation.json', {
        consultedDocs: [
          { id: 'a', title: 'A', sourceUrl: '' },
        ],
      });
      const legacyPath = writeTraceFile(tempDir, 'legacy-consultation.json', {
        consultedDocs: [
          { id: 'a', title: 'A', sourceUrl: '' },
        ],
      });
      const outputPath = join(tempDir, 'comparison.json');

      const { result } = await captureOutputAsync(() =>
        compareRuns(['--mcp', mcpPath, '--legacy', legacyPath, '--output', outputPath])
      );
      assert.equal(result, 0);

      const comparison = JSON.parse(readFileSync(outputPath, 'utf-8'));
      assert.equal(comparison.schemaVersion, 1);
      assert.ok(comparison.assessment);
      assert.ok(comparison.workflowId);
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('stdout includes comparison report header', async () => {
    const tempDir = await createTempDir();
    try {
      const mcpPath = writeTraceFile(tempDir, 'mcp-consultation.json', {
        consultedDocs: [{ id: 'a', title: 'A', sourceUrl: '' }],
      });
      const legacyPath = writeTraceFile(tempDir, 'legacy-consultation.json', {
        consultedDocs: [{ id: 'a', title: 'A', sourceUrl: '' }],
      });

      const { logs, result } = await captureOutputAsync(() =>
        compareRuns(['--mcp', mcpPath, '--legacy', legacyPath])
      );
      const output = logs.join('\n');
      assert.equal(result, 0);
      assert.ok(output.includes('GSS Consultation Comparison Report'),
        `Expected report header. Got:\n${output}`);
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('stdout includes assessment verdict', async () => {
    const tempDir = await createTempDir();
    try {
      const mcpPath = writeTraceFile(tempDir, 'mcp-consultation.json', {
        consultedDocs: [
          { id: 'a', title: 'A', sourceUrl: '' },
          { id: 'b', title: 'B', sourceUrl: '' },
        ],
      });
      const legacyPath = writeTraceFile(tempDir, 'legacy-consultation.json', {
        consultedDocs: [{ id: 'a', title: 'A', sourceUrl: '' }],
      });

      const { logs, result } = await captureOutputAsync(() =>
        compareRuns(['--mcp', mcpPath, '--legacy', legacyPath])
      );
      const output = logs.join('\n');
      assert.equal(result, 0);
      assert.ok(
        output.includes('mcp-superior') || output.includes('equivalent') || output.includes('mcp-inferior'),
        `Expected assessment verdict. Got:\n${output}`
      );
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('directory mode: resolves latest trace from directory', async () => {
    const tempDir = await createTempDir();
    try {
      const mcpDir = join(tempDir, 'mcp-traces');
      const legacyDir = join(tempDir, 'legacy-traces');
      mkdirSync(mcpDir, { recursive: true });
      mkdirSync(legacyDir, { recursive: true });

      // Write multiple consultation traces — latest should be picked
      writeTraceFile(mcpDir, 'consultation-2026-03-30.json', {
        consultedDocs: [{ id: 'old', title: 'Old', sourceUrl: '' }],
      });
      writeTraceFile(mcpDir, 'consultation-2026-04-01.json', {
        consultedDocs: [{ id: 'new', title: 'New', sourceUrl: '' }],
      });

      writeTraceFile(legacyDir, 'consultation-2026-04-01.json', {
        consultedDocs: [{ id: 'new', title: 'New', sourceUrl: '' }],
      });

      const { result, logs } = await captureOutputAsync(() =>
        compareRuns(['--mcp', mcpDir, '--legacy', legacyDir])
      );

      // Should succeed (exit 0) using directory resolution
      assert.equal(result, 0, `Expected exit 0 for directory mode. Got logs:\n${logs.join('\n')}`);
    } finally {
      cleanupTempDir(tempDir);
    }
  });
});
