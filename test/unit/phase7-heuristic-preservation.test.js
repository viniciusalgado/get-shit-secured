/**
 * Phase 7 — Heuristic Preservation Tests
 *
 * Traceability tests: verifies every heuristic from the Workstream A inventory
 * is preserved in the new MCP-aware role template output. Each test maps to a
 * specific inventory item from the phase plan.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  renderRoleAgent,
} from '../../dist/core/renderer.js';

const ROLE_AGENTS = [
  'gss-mapper',
  'gss-threat-modeler',
  'gss-auditor',
  'gss-remediator',
  'gss-verifier',
  'gss-reporter',
].map(id => ({
  id,
  title: `GSS ${id.replace('gss-', '').replace(/-/g, ' ')}`,
  description: `Role agent for ${id}`,
}));

function render(id) {
  const agent = ROLE_AGENTS.find(a => a.id === id);
  return renderRoleAgent(agent);
}

// =============================================================================
// Auditor Heuristics
// =============================================================================

describe('Phase 7 — Heuristic Preservation: Auditor', () => {

  it('evidence must include file path, line number, code snippet, severity, confidence level', () => {
    const output = render('gss-auditor');
    assert.ok(
      output.includes('file path, line number, code snippet, severity, confidence level'),
      'Auditor should have full evidence requirement'
    );
  });

  it('map every finding to OWASP Top 10 category', () => {
    const output = render('gss-auditor');
    assert.ok(
      output.includes('OWASP Top 10'),
      'Auditor should reference OWASP Top 10'
    );
  });

  it('never fix issues during audit', () => {
    const output = render('gss-auditor');
    assert.ok(
      output.includes('Never fix issues during audit'),
      'Auditor should have "never fix" guardrail'
    );
  });

  it('state confidence levels (high/medium/low)', () => {
    const output = render('gss-auditor');
    assert.ok(
      output.includes('high/medium/low'),
      'Auditor should reference confidence scale'
    );
  });

  it('severity must be justified with exploit scenario', () => {
    const output = render('gss-auditor');
    assert.ok(
      output.includes('exploit scenario'),
      'Auditor should require exploit scenario justification'
    );
  });

});

// =============================================================================
// Remediator Heuristics
// =============================================================================

describe('Phase 7 — Heuristic Preservation: Remediator', () => {

  it('minimal changes only', () => {
    const output = render('gss-remediator');
    assert.ok(
      output.includes('Minimal changes only'),
      'Remediator should have minimal changes constraint'
    );
  });

  it('prefer configuration changes over code changes', () => {
    const output = render('gss-remediator');
    assert.ok(
      output.includes('configuration changes over code changes'),
      'Remediator should prefer config changes'
    );
  });

  it('preserve user code style and conventions', () => {
    const output = render('gss-remediator');
    assert.ok(
      output.includes('Preserve user code style'),
      'Remediator should preserve user code style'
    );
  });

  it('get explicit user approval before writing', () => {
    const output = render('gss-remediator');
    assert.ok(
      output.includes('User has NOT given explicit approval'),
      'Remediator should refuse without explicit user approval'
    );
  });

  it('defense in depth', () => {
    const output = render('gss-remediator');
    assert.ok(
      output.includes('defense in depth'),
      'Remediator should reference defense in depth'
    );
  });

  it('document side effects', () => {
    const output = render('gss-remediator');
    assert.ok(
      output.includes('side effects'),
      'Remediator should require side effect documentation'
    );
  });

});

// =============================================================================
// Verifier Heuristics
// =============================================================================

describe('Phase 7 — Heuristic Preservation: Verifier', () => {

  it('verify against SAME OWASP documents', () => {
    const output = render('gss-verifier');
    assert.ok(
      output.includes('SAME OWASP documents'),
      'Verifier should reference SAME OWASP documents'
    );
  });

  it('run or specify tests', () => {
    const output = render('gss-verifier');
    assert.ok(
      output.includes('test suite') || output.includes('tests'),
      'Verifier should reference test suite or tests'
    );
  });

  it('check for regressions', () => {
    const output = render('gss-verifier');
    assert.ok(
      output.includes('regression'),
      'Verifier should reference regression checking'
    );
  });

  it('state confidence level', () => {
    const output = render('gss-verifier');
    assert.ok(
      output.includes('confidence level'),
      'Verifier should require confidence level'
    );
  });

  it('>80% line coverage target', () => {
    const output = render('gss-verifier');
    assert.ok(
      output.includes('>80%') || output.includes('80% line coverage'),
      'Verifier should reference >80% coverage target'
    );
  });

});

// =============================================================================
// Reporter Heuristics
// =============================================================================

describe('Phase 7 — Heuristic Preservation: Reporter', () => {

  it('separate executive summary from technical detail', () => {
    const output = render('gss-reporter');
    assert.ok(
      output.includes('executive summary') && output.includes('technical'),
      'Reporter should separate executive summary from technical detail'
    );
  });

  it('every finding references its source artifact', () => {
    const output = render('gss-reporter');
    assert.ok(
      output.includes('source artifact'),
      'Reporter should reference source artifacts'
    );
  });

  it('include consultation coverage summary', () => {
    const output = render('gss-reporter');
    assert.ok(
      output.includes('consultation coverage'),
      'Reporter should include consultation coverage summary'
    );
  });

  it('note gaps where coverage was incomplete', () => {
    const output = render('gss-reporter');
    assert.ok(
      output.includes('incomplete') || output.includes('gaps'),
      'Reporter should note coverage gaps'
    );
  });

});

// =============================================================================
// Mapper Heuristics
// =============================================================================

describe('Phase 7 — Heuristic Preservation: Mapper', () => {

  it('focus on discovery, not assessment', () => {
    const output = render('gss-mapper');
    assert.ok(
      output.includes('discovery') && output.includes('not assessment'),
      'Mapper should focus on discovery, not assessment'
    );
  });

  it('identify all trust boundaries', () => {
    const output = render('gss-mapper');
    assert.ok(
      output.includes('trust boundaries'),
      'Mapper should identify trust boundaries'
    );
  });

  it('document assumptions explicitly', () => {
    const output = render('gss-mapper');
    assert.ok(
      output.includes('assumptions'),
      'Mapper should document assumptions'
    );
  });

  it('flag unanalyzable components', () => {
    const output = render('gss-mapper');
    assert.ok(
      output.includes('could not be analyzed'),
      'Mapper should flag unanalyzable components'
    );
  });

});

// =============================================================================
// Threat-Modeler Heuristics
// =============================================================================

describe('Phase 7 — Heuristic Preservation: Threat-Modeler', () => {

  it('apply STRIDE systematically', () => {
    const output = render('gss-threat-modeler');
    assert.ok(
      output.includes('STRIDE') && output.includes('systematically'),
      'Threat-modeler should apply STRIDE systematically'
    );
  });

  it('distinguish theoretical from practical threats', () => {
    const output = render('gss-threat-modeler');
    assert.ok(
      output.includes('theoretical') && output.includes('practical'),
      'Threat-modeler should distinguish theoretical from practical threats'
    );
  });

  it('score impact and likelihood with rationale', () => {
    const output = render('gss-threat-modeler');
    assert.ok(
      output.includes('impact') && output.includes('likelihood') && output.includes('rationale'),
      'Threat-modeler should score impact and likelihood with rationale'
    );
  });

  it('consider specific threat context', () => {
    const output = render('gss-threat-modeler');
    assert.ok(
      output.includes('threat context'),
      'Threat-modeler should consider specific threat context'
    );
  });

});
