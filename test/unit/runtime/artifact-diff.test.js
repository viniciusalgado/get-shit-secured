/**
 * Phase 12 — Unit Tests: Artifact Diff
 *
 * Tests compareArtifactTraces().
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { compareArtifactTraces } from '../../../dist/runtime/artifact-diff.js';

function makeEnvelope(overrides = {}) {
  return {
    schemaVersion: 1,
    workflowId: 'audit',
    gssVersion: '0.1.0',
    corpusVersion: '2026-03-31',
    generatedAt: '2026-04-02T12:00:00Z',
    consultationMode: 'required',
    ...overrides,
  };
}

function withConsultation(envelope, docs, status, requiredMissing = []) {
  return {
    ...envelope,
    consultation: {
      plan: {
        workflowId: envelope.workflowId,
        generatedAt: '2026-04-02T12:00:00Z',
        corpusVersion: '2026-03-31',
        requiredCount: docs.length,
        optionalCount: 0,
        followupCount: 0,
      },
      consultedDocs: docs.map(d => ({ id: d, title: d, sourceUrl: `security://owasp/${d}` })),
      coverageStatus: status,
      requiredMissing,
      notes: [],
    },
  };
}

// ---------------------------------------------------------------------------
// Identical artifacts
// ---------------------------------------------------------------------------
describe('compareArtifactTraces() — identical artifacts', () => {

  it('should report no differences for identical envelopes', () => {
    const a = withConsultation(makeEnvelope(), ['doc-a', 'doc-b'], 'pass');
    const b = withConsultation(makeEnvelope(), ['doc-a', 'doc-b'], 'pass');
    const diff = compareArtifactTraces(a, b);

    assert.strictEqual(diff.aStatus, 'pass');
    assert.strictEqual(diff.bStatus, 'pass');
    assert.strictEqual(diff.coverageDelta, 0);
    assert.strictEqual(diff.docsInAOnly.length, 0);
    assert.strictEqual(diff.docsInBOnly.length, 0);
    assert.deepStrictEqual(diff.docsInBoth, ['doc-a', 'doc-b']);
    assert.strictEqual(diff.requiredMissingA.length, 0);
    assert.strictEqual(diff.requiredMissingB.length, 0);
  });

});

// ---------------------------------------------------------------------------
// Divergent coverage
// ---------------------------------------------------------------------------
describe('compareArtifactTraces() — divergent coverage', () => {

  it('should report docs only in A', () => {
    const a = withConsultation(makeEnvelope(), ['doc-a', 'doc-b', 'doc-c'], 'pass');
    const b = withConsultation(makeEnvelope(), ['doc-a'], 'warn');
    const diff = compareArtifactTraces(a, b);

    assert.strictEqual(diff.aStatus, 'pass');
    assert.strictEqual(diff.bStatus, 'warn');
    assert.deepStrictEqual(diff.docsInAOnly, ['doc-b', 'doc-c']);
    assert.deepStrictEqual(diff.docsInBOnly, []);
    assert.deepStrictEqual(diff.docsInBoth, ['doc-a']);
  });

  it('should report docs only in B', () => {
    const a = withConsultation(makeEnvelope(), ['doc-a'], 'warn');
    const b = withConsultation(makeEnvelope(), ['doc-a', 'doc-d'], 'pass');
    const diff = compareArtifactTraces(a, b);

    assert.deepStrictEqual(diff.docsInAOnly, []);
    assert.deepStrictEqual(diff.docsInBOnly, ['doc-d']);
  });

  it('should report required missing in each', () => {
    const a = withConsultation(makeEnvelope(), ['doc-a'], 'fail', ['doc-b']);
    const b = withConsultation(makeEnvelope(), ['doc-a'], 'warn', []);
    const diff = compareArtifactTraces(a, b);

    assert.deepStrictEqual(diff.requiredMissingA, ['doc-b']);
    assert.deepStrictEqual(diff.requiredMissingB, []);
  });

});

// ---------------------------------------------------------------------------
// One artifact missing trace
// ---------------------------------------------------------------------------
describe('compareArtifactTraces() — one missing trace', () => {

  it('should handle artifact A with no consultation', () => {
    const a = makeEnvelope();
    const b = withConsultation(makeEnvelope(), ['doc-a'], 'pass');
    const diff = compareArtifactTraces(a, b);

    assert.strictEqual(diff.aStatus, 'none');
    assert.strictEqual(diff.bStatus, 'pass');
    assert.strictEqual(diff.docsInAOnly.length, 0);
    assert.deepStrictEqual(diff.docsInBOnly, ['doc-a']);
  });

  it('should handle artifact B with no consultation', () => {
    const a = withConsultation(makeEnvelope(), ['doc-a'], 'pass');
    const b = makeEnvelope();
    const diff = compareArtifactTraces(a, b);

    assert.strictEqual(diff.aStatus, 'pass');
    assert.strictEqual(diff.bStatus, 'none');
    assert.deepStrictEqual(diff.docsInAOnly, ['doc-a']);
    assert.strictEqual(diff.docsInBOnly.length, 0);
  });

  it('should handle both with no consultation', () => {
    const a = makeEnvelope();
    const b = makeEnvelope();
    const diff = compareArtifactTraces(a, b);

    assert.strictEqual(diff.aStatus, 'none');
    assert.strictEqual(diff.bStatus, 'none');
    assert.strictEqual(diff.coverageDelta, 0);
  });

  // --- Gap-fill scenarios ---

  it('should compute negative coverage delta when B has proportionally more overlap', () => {
    // A has 3 docs, B has 1 doc. Overlap = 1 doc.
    // aCoverage = 1/3 = 0.33, bCoverage = 1/1 = 1.0
    // delta = 0.33 - 1.0 = -0.67 (B is proportionally better)
    const a = withConsultation(makeEnvelope(), ['doc-a', 'doc-b', 'doc-c'], 'pass');
    const b = withConsultation(makeEnvelope(), ['doc-a'], 'warn');
    const diff = compareArtifactTraces(a, b);

    assert.ok(diff.coverageDelta < 0, `Expected negative delta, got ${diff.coverageDelta}`);
  });

  it('should compute positive coverage delta when A has proportionally more overlap', () => {
    // A has 1 doc, B has 3 docs. Overlap = 1 doc.
    // aCoverage = 1/1 = 1.0, bCoverage = 1/3 = 0.33
    // delta = 1.0 - 0.33 = 0.67 (A is proportionally better)
    const a = withConsultation(makeEnvelope(), ['doc-a'], 'warn');
    const b = withConsultation(makeEnvelope(), ['doc-a', 'doc-b', 'doc-c'], 'pass');
    const diff = compareArtifactTraces(a, b);

    assert.ok(diff.coverageDelta > 0, `Expected positive delta, got ${diff.coverageDelta}`);
  });

  it('should handle different workflowIds between A and B', () => {
    const a = withConsultation(makeEnvelope({ workflowId: 'audit' }), ['doc-a'], 'pass');
    const b = withConsultation(makeEnvelope({ workflowId: 'verify' }), ['doc-a'], 'pass');
    // Should not throw — function works on any two envelopes
    const diff = compareArtifactTraces(a, b);

    assert.strictEqual(diff.docsInBoth.length, 1);
    assert.strictEqual(diff.coverageDelta, 0);
  });

  it('should handle consultedDocs as string IDs in one artifact and objects in the other', () => {
    const a = {
      ...makeEnvelope(),
      consultation: {
        plan: { workflowId: 'audit', generatedAt: '2026-04-02T12:00:00Z', corpusVersion: '2026-03-31', requiredCount: 1, optionalCount: 0, followupCount: 0 },
        consultedDocs: ['doc-a', 'doc-b'],
        coverageStatus: 'pass',
        requiredMissing: [],
        notes: [],
      },
    };
    const b = withConsultation(makeEnvelope(), ['doc-a', 'doc-b'], 'pass');
    const diff = compareArtifactTraces(a, b);

    assert.deepStrictEqual(diff.docsInBoth, ['doc-a', 'doc-b']);
    assert.strictEqual(diff.docsInAOnly.length, 0);
    assert.strictEqual(diff.docsInBOnly.length, 0);
  });

  it('should report different statuses even when doc lists are identical', () => {
    const a = withConsultation(makeEnvelope(), ['doc-a'], 'pass');
    const b = withConsultation(makeEnvelope(), ['doc-a'], 'warn');
    const diff = compareArtifactTraces(a, b);

    assert.strictEqual(diff.aStatus, 'pass');
    assert.strictEqual(diff.bStatus, 'warn');
    assert.strictEqual(diff.docsInAOnly.length, 0);
    assert.strictEqual(diff.docsInBOnly.length, 0);
  });

});
