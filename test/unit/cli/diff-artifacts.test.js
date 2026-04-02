/**
 * Phase 12 — Unit Tests: diff-artifacts CLI
 *
 * Tests the diffArtifacts CLI command.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { diffArtifacts } from '../../../dist/cli/diff-artifacts.js';

function makeTempDir() {
  const dir = join(tmpdir(), `gss-p12-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeArtifact(dir, name, data) {
  const path = join(dir, name);
  writeFileSync(path, JSON.stringify(data, null, 2));
  return path;
}

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------
describe('diffArtifacts CLI', () => {

  it('should print usage and return 1 when no args', async () => {
    const code = await diffArtifacts([]);
    assert.strictEqual(code, 1);
  });

  it('should print usage and return 1 when only --a provided', async () => {
    const code = await diffArtifacts(['--a', '/tmp/nonexistent.json']);
    assert.strictEqual(code, 1);
  });

  it('should return 1 for nonexistent file A', async () => {
    const code = await diffArtifacts(['--a', '/tmp/nonexistent-a.json', '--b', '/tmp/nonexistent-b.json']);
    assert.strictEqual(code, 1);
  });

  it('should compare two valid artifacts and return 0', async () => {
    const dir = makeTempDir();
    try {
      const artifactA = {
        schemaVersion: 1,
        workflowId: 'audit',
        gssVersion: '0.1.0',
        corpusVersion: '2026-03-31',
        generatedAt: '2026-04-02T12:00:00Z',
        consultationMode: 'required',
        consultation: {
          plan: { workflowId: 'audit', generatedAt: '2026-04-02T12:00:00Z', corpusVersion: '2026-03-31', requiredCount: 2, optionalCount: 0, followupCount: 0 },
          consultedDocs: [
            { id: 'sql-injection-prevention', title: 'SQL Injection', sourceUrl: 'https://...' },
            { id: 'input-validation', title: 'Input Validation', sourceUrl: 'https://...' },
          ],
          coverageStatus: 'pass',
          requiredMissing: [],
          notes: [],
        },
      };

      const artifactB = {
        ...artifactA,
        consultation: {
          ...artifactA.consultation,
          consultedDocs: [
            { id: 'sql-injection-prevention', title: 'SQL Injection', sourceUrl: 'https://...' },
          ],
          coverageStatus: 'warn',
        },
      };

      const pathA = writeArtifact(dir, 'a.json', artifactA);
      const pathB = writeArtifact(dir, 'b.json', artifactB);

      const code = await diffArtifacts(['--a', pathA, '--b', pathB]);
      assert.strictEqual(code, 0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // --- Gap-fill scenarios ---

  it('should return 1 when only --b provided (no --a)', async () => {
    const code = await diffArtifacts(['--b', '/tmp/nonexistent.json']);
    assert.strictEqual(code, 1);
  });

  it('should return 1 when artifact B does not exist', async () => {
    const dir = makeTempDir();
    try {
      const artifactA = {
        schemaVersion: 1, workflowId: 'audit', gssVersion: '0.1.0',
        corpusVersion: '2026-03-31', generatedAt: '2026-04-02T12:00:00Z',
        consultationMode: 'required',
        consultation: { plan: {}, consultedDocs: [], coverageStatus: 'pass', requiredMissing: [], notes: [] },
      };
      const pathA = writeArtifact(dir, 'a.json', artifactA);
      const code = await diffArtifacts(['--a', pathA, '--b', '/tmp/no-such-b-file.json']);
      assert.strictEqual(code, 1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should return 1 for non-JSON file content', async () => {
    const dir = makeTempDir();
    try {
      const validArtifact = {
        schemaVersion: 1, workflowId: 'audit', gssVersion: '0.1.0',
        corpusVersion: '2026-03-31', generatedAt: '2026-04-02T12:00:00Z',
        consultationMode: 'required',
        consultation: { plan: {}, consultedDocs: [], coverageStatus: 'pass', requiredMissing: [], notes: [] },
      };
      const pathA = writeArtifact(dir, 'a.json', validArtifact);
      const badPath = join(dir, 'bad.json');
      writeFileSync(badPath, 'this is not json {{{');

      const code = await diffArtifacts(['--a', pathA, '--b', badPath]);
      assert.strictEqual(code, 1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should include comparison header in stdout', async () => {
    const dir = makeTempDir();
    const logs = [];
    const origLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));
    try {
      const artifact = {
        schemaVersion: 1, workflowId: 'audit', gssVersion: '0.1.0',
        corpusVersion: '2026-03-31', generatedAt: '2026-04-02T12:00:00Z',
        consultationMode: 'required',
        consultation: { plan: {}, consultedDocs: [], coverageStatus: 'pass', requiredMissing: [], notes: [] },
      };
      const pathA = writeArtifact(dir, 'a.json', artifact);
      const pathB = writeArtifact(dir, 'b.json', artifact);

      await diffArtifacts(['--a', pathA, '--b', pathB]);
      const output = logs.join('\n');
      assert.ok(output.includes('Artifact Trace Comparison'), `Expected header, got: ${output}`);
    } finally {
      console.log = origLog;
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should include docs-in-both listing', async () => {
    const dir = makeTempDir();
    const logs = [];
    const origLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));
    try {
      const artifact = {
        schemaVersion: 1, workflowId: 'audit', gssVersion: '0.1.0',
        corpusVersion: '2026-03-31', generatedAt: '2026-04-02T12:00:00Z',
        consultationMode: 'required',
        consultation: {
          plan: { workflowId: 'audit', generatedAt: '2026-04-02T12:00:00Z', corpusVersion: '2026-03-31', requiredCount: 1, optionalCount: 0, followupCount: 0 },
          consultedDocs: [{ id: 'sql-injection-prevention', title: 'SQL Injection', sourceUrl: 'https://...' }],
          coverageStatus: 'pass', requiredMissing: [], notes: [],
        },
      };
      const pathA = writeArtifact(dir, 'a.json', artifact);
      const pathB = writeArtifact(dir, 'b.json', artifact);

      await diffArtifacts(['--a', pathA, '--b', pathB]);
      const output = logs.join('\n');
      assert.ok(output.includes('sql-injection-prevention'), `Expected doc listing, got: ${output}`);
    } finally {
      console.log = origLog;
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should handle not-applicable artifacts with none status', async () => {
    const dir = makeTempDir();
    try {
      const artifact = {
        schemaVersion: 1, workflowId: 'report', gssVersion: '0.1.0',
        corpusVersion: '2026-03-31', generatedAt: '2026-04-02T12:00:00Z',
        consultationMode: 'not-applicable',
      };
      const pathA = writeArtifact(dir, 'a.json', artifact);
      const pathB = writeArtifact(dir, 'b.json', artifact);

      const code = await diffArtifacts(['--a', pathA, '--b', pathB]);
      assert.strictEqual(code, 0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

});
