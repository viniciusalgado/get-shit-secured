import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  ARTIFACT_VALIDATION_RULES,
  resolveArtifactRule,
  validateArtifact,
} from '../../../dist/hooks/artifact-validator.js';

function makeEnvelope(workflowId, consultationMode = 'required', extras = {}) {
  return {
    schemaVersion: 1,
    workflowId,
    gssVersion: '0.1.0',
    corpusVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    consultationMode,
    ...extras,
  };
}

describe('hook artifact validator', () => {
  it('indexes workflow outputs by workflow id', () => {
    assert.equal(Object.keys(ARTIFACT_VALIDATION_RULES).length, 9);
    assert.ok(ARTIFACT_VALIDATION_RULES.verify.some(rule => rule.artifactName === 'residual-risk-assessment'));
  });

  it('resolves an artifact rule by path', () => {
    const rule = resolveArtifactRule('verify', '.gss/artifacts/verify/residual-risk-assessment.json');
    assert.ok(rule);
    assert.equal(rule.artifactName, 'residual-risk-assessment');
  });

  it('validates an audit findings-report envelope through the schema registry', () => {
    const result = validateArtifact(
      makeEnvelope('audit', 'required', {
        consultation: { validation: { coverageStatus: 'pass' } },
        findings: [],
      }),
      'audit',
      { artifactName: 'findings-report' },
    );

    assert.equal(result.valid, true);
    assert.equal(result.coverageStatus, 'pass');
    assert.equal(result.artifactName, 'findings-report');
  });

  it('fails when the artifact payload does not match the declared schema', () => {
    const result = validateArtifact(
      makeEnvelope('map-codebase', 'optional', { dependencies: [], flows: [] }),
      'map-codebase',
      { artifactName: 'codebase-inventory' },
    );

    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => error.includes('components')));
  });

  it('returns a warning for unknown workflows', () => {
    const result = validateArtifact({ anything: true }, 'audit', { artifactName: 'unknown-artifact' });
    assert.equal(result.valid, true);
    assert.ok(result.warnings.some(warning => warning.includes('No artifact validation rule')));
  });
});
