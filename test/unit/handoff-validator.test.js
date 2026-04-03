/**
 * Phase 14 — Handoff Validator Tests
 *
 * Validates:
 * - Valid handoff passes validation
 * - Missing required output fails validation
 * - Invalid envelope fails validation
 * - Missing consultation trace on required artifact fails validation
 * - All 15 handoff edges are validated
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateHandoff,
  validateHandoffEdge,
  validateAllHandoffs,
} from '../../dist/runtime/handoff-validator.js';

import {
  getAllHandoffEdges,
  getExecutionContract,
} from '../../dist/catalog/workflows/execution-contracts/index.js';

// --- Helper ---

function makeValidArtifact(workflowId, extras = {}) {
  return {
    schemaVersion: 1,
    workflowId,
    gssVersion: '0.1.0',
    corpusVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    consultationMode: 'required',
    consultation: {
      plan: { workflowId, generatedAt: new Date().toISOString(), corpusVersion: '1.0.0', requiredCount: 1, optionalCount: 0, followupCount: 0 },
      consultedDocs: [{ id: 'test-doc', title: 'Test', sourceUrl: 'https://example.com' }],
      coverageStatus: 'pass',
      requiredMissing: [],
      notes: [],
    },
    ...extras,
  };
}

// --- Edge Validation Tests ---

describe('Phase 14 — Handoff Edge Validation', () => {
  it('1.1 valid handoff passes', () => {
    const artifacts = new Map();
    artifacts.set('codebase-inventory', makeValidArtifact('map-codebase', { components: [] }));
    artifacts.set('dependency-map', makeValidArtifact('map-codebase', { dependencies: [] }));

    const result = validateHandoffEdge('map-codebase', 'audit', ['codebase-inventory', 'dependency-map'], artifacts, 'optional');
    assert.ok(result.valid, result.errors.join(', '));
  });

  it('1.2 missing required output fails', () => {
    const artifacts = new Map();
    // Only provide one of two required outputs
    artifacts.set('codebase-inventory', makeValidArtifact('map-codebase', { components: [] }));

    const result = validateHandoffEdge('map-codebase', 'audit', ['codebase-inventory', 'dependency-map'], artifacts, 'optional');
    assert.ok(!result.valid);
    assert.ok(result.errors.some(e => e.includes('dependency-map')));
  });

  it('1.3 invalid envelope fails', () => {
    const artifacts = new Map();
    artifacts.set('findings-report', { /* no envelope fields */ });

    const result = validateHandoffEdge('audit', 'validate-findings', ['findings-report'], artifacts, 'required');
    assert.ok(!result.valid);
  });

  it('1.4 missing consultation trace on required artifact fails', () => {
    const artifacts = new Map();
    const artifact = {
      schemaVersion: 1,
      workflowId: 'audit',
      gssVersion: '0.1.0',
      corpusVersion: '1.0.0',
      generatedAt: new Date().toISOString(),
      consultationMode: 'required',
      // No consultation field!
    };
    artifacts.set('findings-report', artifact);

    const result = validateHandoffEdge('audit', 'validate-findings', ['findings-report'], artifacts, 'required');
    assert.ok(!result.valid);
    assert.ok(result.errors.some(e => e.includes('consultation')));
  });

  it('1.5 empty artifacts map fails all outputs', () => {
    const artifacts = new Map();
    const result = validateHandoffEdge('security-review', 'plan-remediation', ['findings'], artifacts, 'required');
    // With empty artifacts map and 'findings' requested, it should fail.
    assert.ok(!result.valid, 'Empty artifacts should fail when findings output is required');
    assert.ok(result.errors.some(e => e.includes('findings')), 'Error should mention missing findings');
  });
});

// --- Handoff Registry Tests ---

describe('Phase 14 — Handoff Registry', () => {
  it('2.1 should have declared handoff edges from definitions', () => {
    const edges = getAllHandoffEdges();
    assert.ok(edges.length > 0, 'Expected at least some handoff edges');

    // Check known edges exist
    const edgeKeys = edges.map(e => `${e.producer}->${e.consumer}`);
    assert.ok(edgeKeys.includes('map-codebase->threat-model'), 'map-codebase→threat-model edge');
    assert.ok(edgeKeys.includes('map-codebase->audit'), 'map-codebase→audit edge');
    assert.ok(edgeKeys.includes('audit->validate-findings'), 'audit→validate-findings edge');
    assert.ok(edgeKeys.includes('plan-remediation->execute-remediation'), 'plan-remediation→execute-remediation edge');
    assert.ok(edgeKeys.includes('verify->report'), 'verify→report edge');
  });

  it('2.2 should validate all edges from map-codebase', () => {
    const artifacts = new Map();
    artifacts.set('codebase-inventory', makeValidArtifact('map-codebase', { components: [] }));
    artifacts.set('trust-boundary-map', makeValidArtifact('map-codebase', { boundaries: [] }));
    artifacts.set('data-flow-map', makeValidArtifact('map-codebase', { flows: [] }));
    artifacts.set('dependency-map', makeValidArtifact('map-codebase', { dependencies: [] }));

    // map-codebase → threat-model (optional mode)
    const r1 = validateHandoffEdge('map-codebase', 'threat-model', ['codebase-inventory', 'trust-boundary-map', 'data-flow-map'], artifacts, 'optional');
    assert.ok(r1.valid, r1.errors.join(', '));

    // map-codebase → audit (optional mode)
    const r2 = validateHandoffEdge('map-codebase', 'audit', ['codebase-inventory', 'dependency-map'], artifacts, 'optional');
    assert.ok(r2.valid, r2.errors.join(', '));
  });

  it('2.3 should validate audit → validate-findings edge', () => {
    const artifacts = new Map();
    artifacts.set('findings-report', makeValidArtifact('audit', { findings: [] }));
    artifacts.set('remediation-priorities', makeValidArtifact('audit', { priorities: [] }));

    const result = validateHandoffEdge('audit', 'validate-findings', ['findings-report', 'remediation-priorities'], artifacts, 'required');
    assert.ok(result.valid, result.errors.join(', '));
  });

  it('2.4 should validate plan-remediation → execute-remediation edge', () => {
    const artifacts = new Map();
    artifacts.set('patch-plan', makeValidArtifact('plan-remediation', { patches: [] }));
    artifacts.set('implementation-guide', makeValidArtifact('plan-remediation', {}));
    artifacts.set('test-specifications', makeValidArtifact('plan-remediation', { tests: [] }));
    artifacts.set('rollback-plan', makeValidArtifact('plan-remediation', {}));

    const result = validateHandoffEdge('plan-remediation', 'execute-remediation',
      ['patch-plan', 'implementation-guide', 'test-specifications', 'rollback-plan'], artifacts, 'required');
    assert.ok(result.valid, result.errors.join(', '));
  });
});

// --- validateHandoff top-level Tests ---

describe('Phase 14 — validateHandoff', () => {
  it('3.1 should validate via top-level dispatch', () => {
    const artifacts = new Map();
    artifacts.set('codebase-inventory', makeValidArtifact('map-codebase', { components: [] }));
    artifacts.set('dependency-map', makeValidArtifact('map-codebase', { dependencies: [] }));

    // Get contract data for map-codebase
    const contract = getExecutionContract('map-codebase');
    const result = validateHandoff('map-codebase', 'audit', artifacts, {
      handoffs: contract.handoffs,
      consultationMode: contract.consultationMode,
    });
    assert.ok(result.valid, result.errors.join(', '));
    assert.equal(result.producer, 'map-codebase');
    assert.equal(result.consumer, 'audit');
  });

  it('3.2 should return valid for unknown producer-consumer pair (no edges)', () => {
    const artifacts = new Map();
    // report has no handoffs to audit
    const contract = getExecutionContract('report');
    const result = validateHandoff('report', 'audit', artifacts, {
      handoffs: contract.handoffs,
      consultationMode: contract.consultationMode,
    });
    assert.ok(result.valid, 'No handoff edge from report to audit — should be valid');
  });
});

// --- validateAllHandoffs Tests ---

describe('Phase 14 — validateAllHandoffs', () => {
  it('4.1 should validate all declared edges and return results', () => {
    const artifactsByWorkflow = new Map();

    // map-codebase artifacts
    const mapArtifacts = new Map();
    mapArtifacts.set('codebase-inventory', makeValidArtifact('map-codebase', { components: [] }));
    mapArtifacts.set('trust-boundary-map', makeValidArtifact('map-codebase', { boundaries: [] }));
    mapArtifacts.set('data-flow-map', makeValidArtifact('map-codebase', { flows: [] }));
    mapArtifacts.set('dependency-map', makeValidArtifact('map-codebase', { dependencies: [] }));
    artifactsByWorkflow.set('map-codebase', mapArtifacts);

    // Get all edges and consultation modes from contracts
    const edges = getAllHandoffEdges();
    const consultationModes = new Map();
    const allContracts = new Map();
    for (const edge of edges) {
      if (!allContracts.has(edge.producer)) {
        const contract = getExecutionContract(edge.producer);
        allContracts.set(edge.producer, contract);
        consultationModes.set(edge.producer, contract.consultationMode);
      }
    }

    const results = validateAllHandoffs(artifactsByWorkflow, edges, consultationModes);
    assert.equal(results.length, edges.length, 'Should return one result per edge');

    // map-codebase edges should pass
    const mapEdges = results.filter(r => r.producer === 'map-codebase');
    for (const r of mapEdges) {
      assert.ok(r.valid, `map-codebase→${r.consumer} should pass: ${r.errors.join(', ')}`);
    }
  });
});
