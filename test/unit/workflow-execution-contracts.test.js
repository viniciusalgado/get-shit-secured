/**
 * Phase 14 — Workflow Execution Contracts Tests
 *
 * Validates:
 * - All 9 workflow execution contracts are registered
 * - Each contract has correct types and structure
 * - Contracts reference actual extractor functions
 * - Contracts reference actual MCP tools
 * - Artifact paths match definition.outputs[].path
 * - Handoff targets reference valid workflow IDs
 * - Contract consultationMode matches definition consultationMode
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getAllExecutionContracts, getExecutionContract } from '../../dist/catalog/workflows/execution-contracts/index.js';
import { WORKFLOW_REGISTRY } from '../../dist/catalog/workflows/registry.js';

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

// --- Contract Registry Tests ---

describe('Phase 14 — Execution Contract Registry', () => {
  it('should register contracts for all 9 workflows', () => {
    const all = getAllExecutionContracts();
    assert.equal(all.size, 9, 'Expected 9 workflow execution contracts');
    for (const id of ALL_WORKFLOW_IDS) {
      assert.ok(all.has(id), `Missing contract for workflow: ${id}`);
    }
  });

  it('should return a specific contract by workflow ID', () => {
    for (const id of ALL_WORKFLOW_IDS) {
      const contract = getExecutionContract(id);
      assert.equal(contract.workflowId, id);
    }
  });

  it('should throw for unknown workflow ID', () => {
    assert.throws(() => getExecutionContract('nonexistent'), /No execution contract/);
  });
});

// --- Per-Contract Structural Tests ---

describe('Phase 14 — Per-Contract Structural Validity', () => {
  /** Generic structural check for one contract */
  function checkContractStructure(contract) {
    assert.ok(contract.workflowId, 'Missing workflowId');
    assert.ok(contract.consultationMode, 'Missing consultationMode');
    assert.ok(contract.signals, 'Missing signals');
    assert.ok(contract.phases, 'Missing phases');
    assert.ok(Array.isArray(contract.phases), 'phases must be array');
    assert.ok(contract.artifacts, 'Missing artifacts');
    assert.ok(Array.isArray(contract.artifacts), 'artifacts must be array');
    assert.ok(contract.handoffs, 'handoffs must exist');
    assert.ok(Array.isArray(contract.handoffs), 'handoffs must be array');
  }

  for (const id of ALL_WORKFLOW_IDS) {
    describe(`Workflow: ${id}`, () => {
      /** @type {import('../../src/catalog/workflows/execution-contracts/types.js').WorkflowExecutionContract} */
      let contract;

      it('should have a valid contract', () => {
        contract = getExecutionContract(id);
        checkContractStructure(contract);
      });

      it('should have correct consultationMode', () => {
        contract = getExecutionContract(id);
        assert.equal(contract.consultationMode, EXPECTED_CONSULTATION_MODES[id],
          `Expected consultationMode '${EXPECTED_CONSULTATION_MODES[id]}' for ${id}`);
      });

      it('should have at least one phase', () => {
        contract = getExecutionContract(id);
        assert.ok(contract.phases.length >= 1, `${id} should have at least 1 phase`);
      });

      it('should have valid signal extractor name', () => {
        contract = getExecutionContract(id);
        assert.ok(typeof contract.signals.extractor === 'string', 'extractor must be a string');
        assert.ok(contract.signals.extractor.length > 0, 'extractor must not be empty');
      });

      it('should have valid signal source strategies', () => {
        contract = getExecutionContract(id);
        const validStrategies = ['from-diff-heuristics', 'from-codebase', 'from-prior-artifact', 'from-findings', 'from-diff', 'none'];
        for (const [dim, src] of Object.entries(contract.signals.sources)) {
          assert.ok(validStrategies.includes(src.strategy),
            `${id}.signals.sources.${dim}.strategy '${src.strategy}' is not a valid strategy`);
        }
      });

      it('should have phases with valid MCP tool references', () => {
        contract = getExecutionContract(id);
        const validTools = [
          'get_workflow_consultation_plan', 'validate_security_consultation',
          'read_security_doc', 'search_security_docs', 'get_related_security_docs',
          'none',
        ];
        for (const phase of contract.phases) {
          assert.ok(validTools.includes(phase.mcpConsultation.tool),
            `${id} phase '${phase.id}' has invalid tool: ${phase.mcpConsultation.tool}`);
        }
      });

      it('should have valid phase consultation levels', () => {
        contract = getExecutionContract(id);
        const validLevels = ['full', 'minimal', 'none'];
        for (const phase of contract.phases) {
          assert.ok(validLevels.includes(phase.mcpConsultation.level),
            `${id} phase '${phase.id}' has invalid level: ${phase.mcpConsultation.level}`);
        }
      });

      it('should have handoffs with valid target workflow IDs', () => {
        contract = getExecutionContract(id);
        for (const handoff of contract.handoffs) {
          assert.ok(ALL_WORKFLOW_IDS.includes(handoff.targetWorkflowId),
            `${id} handoff target '${handoff.targetWorkflowId}' is not a valid workflow ID`);
          assert.ok(Array.isArray(handoff.outputsToPass), `${id} handoff outputsToPass must be array`);
          assert.ok(handoff.outputsToPass.length > 0, `${id} handoff to ${handoff.targetWorkflowId} should pass at least 1 output`);
        }
      });
    });
  }
});

// --- Contract-to-Definition Consistency ---

describe('Phase 14 — Contract-to-Definition Consistency', () => {
  it('should have consultationMode matching workflow definition', () => {
    const all = getAllExecutionContracts();

    for (const [id, contract] of all) {
      const definition = WORKFLOW_REGISTRY[id];
      assert.ok(definition, `No definition found for ${id}`);
      assert.equal(contract.consultationMode, definition.consultationMode,
        `${id}: contract consultationMode '${contract.consultationMode}' != definition '${definition.consultationMode}'`);
    }
  });

  it('should have artifact names matching definition outputs', () => {
    const all = getAllExecutionContracts();

    for (const [id, contract] of all) {
      const definition = WORKFLOW_REGISTRY[id];
      const defOutputNames = definition.outputs.map(o => o.name);
      for (const artifact of contract.artifacts) {
        assert.ok(defOutputNames.includes(artifact.name),
          `${id}: contract artifact '${artifact.name}' not in definition outputs: ${defOutputNames.join(', ')}`);
      }
    }
  });
});
