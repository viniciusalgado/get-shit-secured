/**
 * Unit tests for shared role registry.
 * Phase 10 — Workstream A: Role definition catalog.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const { ROLE_DEFINITIONS, getRoleDefinition, getAllRoles } = await import('../../../dist/catalog/roles/registry.js');

describe('Role Registry — Count and IDs', () => {
  it('has exactly 6 role definitions', () => {
    assert.equal(ROLE_DEFINITIONS.length, 6);
  });

  it('getAllRoles() returns 6 entries', () => {
    assert.equal(getAllRoles().length, 6);
  });

  it('has expected role IDs', () => {
    const ids = ROLE_DEFINITIONS.map(r => r.id);
    assert.ok(ids.includes('gss-mapper'));
    assert.ok(ids.includes('gss-threat-modeler'));
    assert.ok(ids.includes('gss-auditor'));
    assert.ok(ids.includes('gss-remediator'));
    assert.ok(ids.includes('gss-verifier'));
    assert.ok(ids.includes('gss-reporter'));
  });

  it('role IDs are unique', () => {
    const ids = ROLE_DEFINITIONS.map(r => r.id);
    assert.equal(new Set(ids).size, ids.length);
  });
});

describe('Role Registry — Primary workflow mapping', () => {
  it('gss-mapper maps to map-codebase', () => {
    const role = getRoleDefinition('gss-mapper');
    assert.ok(role);
    assert.equal(role.primaryWorkflow, 'map-codebase');
  });

  it('gss-threat-modeler maps to threat-model', () => {
    const role = getRoleDefinition('gss-threat-modeler');
    assert.ok(role);
    assert.equal(role.primaryWorkflow, 'threat-model');
  });

  it('gss-auditor maps to audit', () => {
    const role = getRoleDefinition('gss-auditor');
    assert.ok(role);
    assert.equal(role.primaryWorkflow, 'audit');
  });

  it('gss-remediator maps to plan-remediation', () => {
    const role = getRoleDefinition('gss-remediator');
    assert.ok(role);
    assert.equal(role.primaryWorkflow, 'plan-remediation');
  });

  it('gss-verifier maps to verify', () => {
    const role = getRoleDefinition('gss-verifier');
    assert.ok(role);
    assert.equal(role.primaryWorkflow, 'verify');
  });

  it('gss-reporter maps to report', () => {
    const role = getRoleDefinition('gss-reporter');
    assert.ok(role);
    assert.equal(role.primaryWorkflow, 'report');
  });
});

describe('Role Registry — getRoleDefinition', () => {
  it('returns undefined for unknown ID', () => {
    assert.equal(getRoleDefinition('nonexistent'), undefined);
  });

  it('returns role with all required fields', () => {
    const role = getRoleDefinition('gss-auditor');
    assert.ok(role);
    assert.ok(typeof role.id === 'string' && role.id.length > 0);
    assert.ok(typeof role.title === 'string' && role.title.length > 0);
    assert.ok(typeof role.description === 'string' && role.description.length > 0);
    assert.ok(typeof role.primaryWorkflow === 'string' && role.primaryWorkflow.length > 0);
  });
});

describe('Role Registry — Immutability', () => {
  it('getAllRoles() returns a copy — mutation does not affect source', () => {
    const roles1 = getAllRoles();
    const originalLength = roles1.length;
    roles1.push({ id: 'fake', title: 'Fake', description: 'Fake', primaryWorkflow: 'audit' });
    const roles2 = getAllRoles();
    assert.equal(roles2.length, originalLength);
  });
});
