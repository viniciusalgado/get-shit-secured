/**
 * Unit tests for --verify-only CLI flag parsing.
 * Phase 9 — Workstream E.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { parseArgs, getHelpText } from '../../../dist/cli/parse-args.js';

describe('--verify-only flag parsing', () => {
  it('parses --verify-only flag', () => {
    const args = parseArgs(['--verify-only']);
    assert.equal(args.verifyOnly, true);
  });

  it('defaults to undefined when absent', () => {
    const args = parseArgs(['--claude']);
    assert.equal(args.verifyOnly, undefined);
  });

  it('combines with runtime flags', () => {
    const args = parseArgs(['--verify-only', '--claude']);
    assert.equal(args.verifyOnly, true);
    assert.ok(args.runtimes.includes('claude'));
  });

  it('appears in help text', () => {
    const help = getHelpText();
    assert.ok(help.includes('--verify-only'), 'Help text should mention --verify-only');
  });
});
