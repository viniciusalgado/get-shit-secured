/**
 * Unit tests for parseArgs — Phase 11 --hybrid-shadow flag.
 * Validates that --hybrid-shadow is parsed correctly for Release C.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs, validateArgs, getHelpText } from '../../../dist/cli/parse-args.js';

describe('parseArgs — Phase 11 --hybrid-shadow', () => {
  it('sets hybridShadow: true when --hybrid-shadow is passed', () => {
    const result = parseArgs(['--hybrid-shadow', '--claude', '--local']);
    assert.equal(result.hybridShadow, true);
  });

  it('allows --hybrid-shadow on its own', () => {
    const result = parseArgs(['--hybrid-shadow', '--claude']);
    const errors = validateArgs(result);
    const mutualError = errors.find(e => e.includes('together') || e.includes('mutually exclusive'));
    assert.equal(mutualError, undefined);
  });

  it('does not advertise the removed legacy flag', () => {
    const help = getHelpText();
    assert.ok(!help.includes('--legacy-specialists'),
      `Help text should not mention removed legacy flag. Got:\n${help}`);
  });

  it('returns hybridShadow false when not specified', () => {
    const result = parseArgs(['--claude', '--local']);
    assert.equal(result.hybridShadow, false);
  });

  it('includes --hybrid-shadow in help text', () => {
    const help = getHelpText();
    assert.ok(help.includes('--hybrid-shadow'),
      `Help text should include --hybrid-shadow. Got:\n${help}`);
    assert.ok(help.includes('shadow') || help.includes('MCP'),
      `Help text should describe shadow mode. Got:\n${help}`);
  });
});
