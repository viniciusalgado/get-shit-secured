/**
 * Phase 14 — Contract-to-Runtime Consistency Tests (Gap-Fill)
 *
 * Validates cross-cutting consistency between execution contracts,
 * signal extractors, MCP tools, and the handoff graph that individual
 * workstream tests do not fully verify.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getAllExecutionContracts, getExecutionContract, getAllHandoffEdges } from '../../dist/catalog/workflows/execution-contracts/index.js';

// Signal extractors
import {
  extractSecurityReviewSignals,
  extractAuditSignals,
  extractThreatModelSignals,
  extractPlanRemediationSignals,
  extractVerifySignals,
  extractExecuteRemediationSignals,
  extractValidateFindingsSignals,
  extractDefaultSignals,
} from '../../dist/core/consultation-signals.js';

const ALL_WORKFLOW_IDS = [
  'security-review', 'map-codebase', 'threat-model', 'audit',
  'validate-findings', 'plan-remediation', 'execute-remediation',
  'verify', 'report',
];

const EXPECTED_CONSULTATION_MODES = {
  'security-review': 'required',
  'map-codebase': 'optional',
  'threat-model': 'required',
  'audit': 'required',
  'validate-findings': 'optional',
  'plan-remediation': 'required',
  'execute-remediation': 'optional',
  'verify': 'required',
  'report': 'not-applicable',
};

// --- Contract-to-Extractor Binding ---

describe('Phase 14 — Contract-to-extractor binding', () => {
  it('G.1: every extractor named in contracts is a callable function', () => {
    const extractors = {
      extractSecurityReviewSignals,
      extractAuditSignals,
      extractThreatModelSignals,
      extractPlanRemediationSignals,
      extractVerifySignals,
      extractExecuteRemediationSignals,
      extractValidateFindingsSignals,
      extractDefaultSignals,
    };

    const all = getAllExecutionContracts();
    for (const [id, contract] of all) {
      const extractorName = contract.signals.extractor;
      assert.ok(
        typeof extractors[extractorName] === 'function',
        `Workflow ${id}: extractor "${extractorName}" is not a callable function`,
      );
    }
  });

  it('G.2: extractSecurityReviewSignals is a function', () => {
    assert.equal(typeof extractSecurityReviewSignals, 'function');
  });

  it('G.3: extractAuditSignals is a function', () => {
    assert.equal(typeof extractAuditSignals, 'function');
  });

  it('G.4: extractThreatModelSignals is a function', () => {
    assert.equal(typeof extractThreatModelSignals, 'function');
  });

  it('G.5: extractVerifySignals is a function', () => {
    assert.equal(typeof extractVerifySignals, 'function');
  });

  it('G.6: extractPlanRemediationSignals is a function', () => {
    assert.equal(typeof extractPlanRemediationSignals, 'function');
  });

  it('G.7: extractExecuteRemediationSignals is a function', () => {
    assert.equal(typeof extractExecuteRemediationSignals, 'function');
  });

  it('G.8: extractValidateFindingsSignals is a function', () => {
    assert.equal(typeof extractValidateFindingsSignals, 'function');
  });

  it('G.9: extractDefaultSignals handles map-codebase and report', () => {
    const mapSignals = extractDefaultSignals('map-codebase');
    assert.deepEqual(mapSignals.issueTags, []);
    assert.deepEqual(mapSignals.stacks, []);
    assert.deepEqual(mapSignals.changedFiles, []);

    const reportSignals = extractDefaultSignals('report');
    assert.deepEqual(reportSignals.issueTags, []);
    assert.deepEqual(reportSignals.stacks, []);
    assert.deepEqual(reportSignals.changedFiles, []);
  });
});

// --- Consultation Mode Enforcement ---

describe('Phase 14 — Consultation mode enforcement', () => {
  it('G.10: required-mode contracts have at least one phase with full consultation', () => {
    const requiredWorkflows = Object.entries(EXPECTED_CONSULTATION_MODES)
      .filter(([, mode]) => mode === 'required')
      .map(([id]) => id);

    for (const id of requiredWorkflows) {
      const contract = getExecutionContract(id);
      const fullPhases = contract.phases.filter(p => p.mcpConsultation.level === 'full');
      assert.ok(
        fullPhases.length >= 1,
        `Workflow ${id} (required mode) has no phase with full MCP consultation`,
      );
    }
  });

  it('G.11: required-mode contracts have a validation phase', () => {
    const requiredWorkflows = Object.entries(EXPECTED_CONSULTATION_MODES)
      .filter(([, mode]) => mode === 'required')
      .map(([id]) => id);

    for (const id of requiredWorkflows) {
      const contract = getExecutionContract(id);
      const validationPhases = contract.phases.filter(
        p => p.mcpConsultation.tool === 'validate_security_consultation',
      );
      assert.ok(
        validationPhases.length >= 1,
        `Workflow ${id} (required mode) has no validation phase`,
      );
    }
  });

  it('G.12: not-applicable contracts (report) have no MCP tool usage', () => {
    const contract = getExecutionContract('report');
    const nonNoneTools = contract.phases.filter(p => p.mcpConsultation.tool !== 'none');
    assert.equal(nonNoneTools.length, 0, 'Report should have no MCP tool usage');
  });
});

// --- Handoff Graph Structural Properties ---

describe('Phase 14 — Handoff graph structural properties', () => {
  it('G.13: handoff graph has no cycles', () => {
    const edges = getAllHandoffEdges();

    // Build adjacency list
    const adj = new Map();
    for (const id of ALL_WORKFLOW_IDS) adj.set(id, []);
    for (const edge of edges) {
      adj.get(edge.producer).push(edge.consumer);
    }

    // DFS cycle detection
    const WHITE = 0, GRAY = 1, BLACK = 2;
    const color = new Map();
    for (const id of ALL_WORKFLOW_IDS) color.set(id, WHITE);

    function hasCycle(node) {
      color.set(node, GRAY);
      for (const neighbor of adj.get(node)) {
        if (color.get(neighbor) === GRAY) return true;
        if (color.get(neighbor) === WHITE && hasCycle(neighbor)) return true;
      }
      color.set(node, BLACK);
      return false;
    }

    for (const id of ALL_WORKFLOW_IDS) {
      if (color.get(id) === WHITE) {
        assert.ok(!hasCycle(id), `Handoff graph contains a cycle involving ${id}`);
      }
    }
  });

  it('G.14: report is a terminal node (no outgoing handoffs)', () => {
    const contract = getExecutionContract('report');
    assert.equal(contract.handoffs.length, 0, 'Report should have no outgoing handoffs');
  });

  it('G.15: security-review is an entry node (no incoming handoffs in typical flow)', () => {
    const edges = getAllHandoffEdges();
    const incomingToSecurityReview = edges.filter(e => e.consumer === 'security-review');
    assert.equal(incomingToSecurityReview.length, 0, 'security-review should have no incoming handoff edges');
  });

  it('G.16: every non-terminal workflow has at least one outgoing handoff or is an entry point', () => {
    const all = getAllExecutionContracts();
    for (const [id, contract] of all) {
      if (id === 'report') continue; // terminal node
      // Either it has outgoing handoffs, or it's an entry point like security-review
      // with no incoming edges
      const hasOutgoing = contract.handoffs.length >= 1;
      const edges = getAllHandoffEdges();
      const hasIncoming = edges.some(e => e.consumer === id);
      // Non-terminal workflows should either have outgoing handoffs
      // or be an entry point that feeds into the chain
      // security-review is an entry point with no outgoing handoffs (ok per draft)
      if (id === 'security-review') {
        // Entry point - no outgoing handoffs is acceptable
        assert.ok(!hasIncoming, `${id} should not have incoming edges as entry point`);
      } else {
        assert.ok(hasOutgoing, `${id} should have at least one outgoing handoff`);
      }
    }
  });

  it('G.17: handoff output names match producer artifact names', () => {
    const all = getAllExecutionContracts();
    const edges = getAllHandoffEdges();

    for (const edge of edges) {
      const producerContract = all.get(edge.producer);
      assert.ok(producerContract, `Producer ${edge.producer} not found in contracts`);
      const producerArtifactNames = new Set(producerContract.artifacts.map(a => a.name));

      for (const outputName of edge.outputsToPass) {
        assert.ok(
          producerArtifactNames.has(outputName),
          `Handoff ${edge.producer}->${edge.consumer} references output "${outputName}" not found in producer artifacts: ${[...producerArtifactNames].join(', ')}`,
        );
      }
    }
  });

  it('G.18: total handoff edge count matches actual contract data', () => {
    const edges = getAllHandoffEdges();
    // Verify count matches sum of handoffs across all contracts
    const all = getAllExecutionContracts();
    let expectedCount = 0;
    for (const [, contract] of all) {
      expectedCount += contract.handoffs.length;
    }
    assert.equal(edges.length, expectedCount, `Edge count ${edges.length} does not match expected ${expectedCount}`);
  });
});
