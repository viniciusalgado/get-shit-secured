/**
 * Unit tests for parseArgs — Phase 11 --hybrid-shadow flag.
 * Validates that --hybrid-shadow is parsed correctly and mutually
 * exclusive with --legacy-specialists.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs, validateArgs, getHelpText } from '../../../dist/cli/parse-args.js';

describe('parseArgs — Phase 11 --hybrid-shadow', () => {
  it('sets hybridShadow: true when --hybrid-shadow is passed', () => {
    const result = parseArgs(['--hybrid-shadow', '--claude', '--local']);
    assert.equal(result.hybridShadow, true);
  });

  it('allows --hybrid-shadow without --legacy-specialists', () => {
    const result = parseArgs(['--hybrid-shadow', '--claude']);
    const errors = validateArgs(result);
    // Should not have mutual exclusion error (may have other errors like scope)
    const mutualError = errors.find(e => e.includes('together') || e.includes('mutually exclusive'));
    assert.equal(mutualError, undefined);
  });

  it('rejects --hybrid-shadow + --legacy-specialists as mutually exclusive', () => {
    const result = parseArgs(['--hybrid-shadow', '--legacy-specialists', '--claude']);
    const errors = validateArgs(result);
    assert.ok(errors.length > 0, 'Should have at least one error');
    assert.ok(
      errors.some(e => e.includes('together') || e.includes('mutually exclusive') || e.includes('Choose one')),
      `Expected mutual exclusion error, got: ${JSON.stringify(errors)}`
    );
  });

  it('returns both flags false when neither is specified', () => {
    const result = parseArgs(['--claude', '--local']);
    assert.equal(result.hybridShadow, false);
    assert.equal(result.legacySpecialists, false);
  });

  it('includes --hybrid-shadow in help text', () => {
    const help = getHelpText();
    assert.ok(help.includes('--hybrid-shadow'),
      `Help text should include --hybrid-shadow. Got:\n${help}`);
    assert.ok(help.includes('shadow') || help.includes('MCP') || help.includes('legacy'),
      `Help text should describe shadow mode. Got:\n${help}`);
  });
});
