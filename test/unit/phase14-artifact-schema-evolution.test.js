/**
 * Phase 14 — Artifact Schema Evolution Tests (Gap-Fill)
 *
 * Validates schema registry completeness and consistency with execution contracts.
 * Tests that:
 * - Every artifact declared in contracts has a registered validator (documents naming mismatches)
 * - Validator keys follow the expected format
 * - Consultation trace requirements are consistent between contracts and validators
 * - Validators handle edge-case inputs gracefully
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getAllExecutionContracts } from '../../dist/catalog/workflows/execution-contracts/index.js';
import { validateWorkflowArtifact, getRegisteredValidators } from '../../dist/runtime/workflow-artifact-schemas/index.js';

const ALL_WORKFLOW_IDS = [
  'security-review', 'map-codebase', 'threat-model', 'audit',
  'validate-findings', 'plan-remediation', 'execute-remediation',
  'verify', 'report',
];

// Helper to make a minimal valid envelope
function makeEnvelope(workflowId, extras = {}) {
  return {
    schemaVersion: 1,
    workflowId,
    gssVersion: '0.1.0',
    corpusVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    consultationMode: 'optional',
    ...extras,
  };
}

// --- Schema Registry Completeness ---

describe('Phase 14 — Schema registry completeness', () => {
  it('S.1: every artifact in every execution contract has a registered validator', () => {
    const all = getAllExecutionContracts();
    const registeredKeys = new Set(getRegisteredValidators());

    const mismatches = [];
    for (const [workflowId, contract] of all) {
      for (const artifact of contract.artifacts) {
        const key = `${workflowId}::${artifact.name}`;
        if (!registeredKeys.has(key)) {
          mismatches.push(`No validator registered for artifact "${key}"`);
        }
      }
    }

    assert.equal(
      mismatches.length, 0,
      `Contract-validator mismatches: ${mismatches.join('; ')}`,
    );
  });

  it('S.2: validator count is at least 35 (one per artifact across all contracts)', () => {
    const registered = getRegisteredValidators();
    // 36 artifacts declared across the workflow contracts
    assert.ok(
      registered.length >= 35,
      `Expected at least 35 validators, got ${registered.length}`,
    );
  });

  it('S.3: validator keys use workflowId::artifactName format', () => {
    const registered = getRegisteredValidators();
    for (const key of registered) {
      const parts = key.split('::');
      assert.equal(parts.length, 2, `Validator key "${key}" does not use workflowId::artifactName format`);
      assert.ok(parts[0].length > 0, `Workflow ID part is empty in key "${key}"`);
      assert.ok(parts[1].length > 0, `Artifact name part is empty in key "${key}"`);
      assert.ok(
        ALL_WORKFLOW_IDS.includes(parts[0]),
        `Workflow ID "${parts[0]}" in key "${key}" is not a known workflow`,
      );
    }
  });
});

// --- Consultation Trace Requirement Consistency ---

describe('Phase 14 — Consultation trace requirement consistency', () => {
  it('S.4: artifacts marked requiresConsultationTrace:true fail without trace', () => {
    const all = getAllExecutionContracts();
    const registeredKeys = new Set(getRegisteredValidators());

    for (const [workflowId, contract] of all) {
      for (const artifact of contract.artifacts) {
        if (!artifact.requiresConsultationTrace) continue;
        const key = `${workflowId}::${artifact.name}`;
        // Skip if validator not registered under this key (known mismatches)
        if (!registeredKeys.has(key)) continue;
        // Create an envelope without consultation field
        const envelope = {
          schemaVersion: 1,
          workflowId,
          gssVersion: '0.1.0',
          corpusVersion: '1.0.0',
          generatedAt: new Date().toISOString(),
          consultationMode: 'required',
        };
        const result = validateWorkflowArtifact(workflowId, artifact.name, envelope);
        assert.ok(
          !result.valid,
          `Artifact ${key} with requiresConsultationTrace:true should fail without consultation trace`,
        );
      }
    }
  });

  it('S.5: artifacts marked requiresConsultationTrace:false pass without trace (envelope-only validators)', () => {
    // Some validators only check the envelope (e.g., report artifacts, execute-remediation change-summary).
    // Test representative envelope-only validators without consultation trace.
    const envelopeOnlyTests = [
      { workflowId: 'report', artifactName: 'executive-summary' },
      { workflowId: 'report', artifactName: 'technical-findings' },
      { workflowId: 'report', artifactName: 'owasp-compliance' },
      { workflowId: 'execute-remediation', artifactName: 'change-summary' },
    ];

    for (const { workflowId, artifactName } of envelopeOnlyTests) {
      const envelope = makeEnvelope(workflowId);
      const result = validateWorkflowArtifact(workflowId, artifactName, envelope);
      assert.ok(
        result.valid,
        `${workflowId}::${artifactName} should pass without consultation trace. Errors: ${result.errors.join(', ')}`,
      );
    }
  });

  it('S.6: required-consultation workflows have primary artifacts requiring trace', () => {
    // Primary (core reasoning) artifacts in required-mode workflows should require trace.
    // Exceptions: artifacts that are supplementary (e.g., evidence, markdown outputs)
    // and don't carry consultation traces by design.
    const all = getAllExecutionContracts();
    const registeredKeys = new Set(getRegisteredValidators());

    const REQUIRED_MODE_WORKFLOWS = ['security-review', 'audit', 'plan-remediation', 'verify'];

    for (const workflowId of REQUIRED_MODE_WORKFLOWS) {
      const contract = all.get(workflowId);
      assert.ok(contract, `Contract for ${workflowId} not found`);
      // At least the first (primary) artifact should require trace
      const primaryArtifact = contract.artifacts[0];
      assert.ok(
        primaryArtifact.requiresConsultationTrace,
        `Primary artifact "${primaryArtifact.name}" in required-mode workflow ${workflowId} should require consultation trace`,
      );
    }

    // threat-model: 3 of 4 artifacts require trace; mitigation-requirements is intentionally
    // exempt because it is a markdown artifact
    const tmContract = all.get('threat-model');
    const tmTraced = tmContract.artifacts.filter(a => a.requiresConsultationTrace);
    assert.ok(
      tmTraced.length >= 3,
      `threat-model should have at least 3 traced artifacts, got ${tmTraced.length}`,
    );
  });
});

// --- Schema Validator Input Resilience ---

describe('Phase 14 — Schema validator input resilience', () => {
  it('S.7: validator handles null input gracefully', () => {
    const result = validateWorkflowArtifact('audit', 'findings-report', null);
    assert.equal(result.valid, false, 'Should reject null input');
    assert.ok(Array.isArray(result.errors), 'Should return errors array');
  });

  it('S.8: validator handles undefined input gracefully', () => {
    const result = validateWorkflowArtifact('audit', 'findings-report', undefined);
    assert.equal(result.valid, false, 'Should reject undefined input');
    assert.ok(Array.isArray(result.errors), 'Should return errors array');
  });

  it('S.9: validator handles string input gracefully', () => {
    const result = validateWorkflowArtifact('audit', 'findings-report', 'not-an-object');
    assert.equal(result.valid, false, 'Should reject string input');
    assert.ok(Array.isArray(result.errors), 'Should return errors array');
  });
});
