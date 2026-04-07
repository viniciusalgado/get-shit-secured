import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { promptForInstallArgs, shouldPromptForInstall } from '../../../dist/cli/interactive-install.js';
import { parseArgs } from '../../../dist/cli/parse-args.js';

function createMockIo(answers) {
  const writes = [];
  let index = 0;

  return {
    writes,
    io: {
      isTTY: true,
      write(text) {
        writes.push(text);
      },
      async ask() {
        return answers[index++] ?? '';
      },
      clear() {},
      close() {},
    },
  };
}

describe('shouldPromptForInstall', () => {
  it('prompts in interactive terminals when no install flags were provided', () => {
    const args = parseArgs([]);
    assert.equal(shouldPromptForInstall(args, [], true), true);
  });

  it('does not prompt when runtime flags were provided', () => {
    const args = parseArgs(['--codex', '--global']);
    assert.equal(shouldPromptForInstall(args, ['--codex', '--global'], true), false);
  });

  it('does not prompt for non-install flows', () => {
    assert.equal(shouldPromptForInstall(parseArgs(['--help']), ['--help'], true), false);
    assert.equal(shouldPromptForInstall(parseArgs(['--verify-only']), ['--verify-only'], true), false);
    assert.equal(shouldPromptForInstall(parseArgs(['--uninstall']), ['--uninstall'], true), false);
  });

  it('does not prompt outside interactive terminals unless forced', () => {
    assert.equal(shouldPromptForInstall(parseArgs([]), [], false), false);
    assert.equal(shouldPromptForInstall(parseArgs(['--interactive']), ['--interactive'], false), false);
  });

  it('prompts when --interactive is passed', () => {
    assert.equal(shouldPromptForInstall(parseArgs(['--interactive']), ['--interactive'], true), true);
  });
});

describe('promptForInstallArgs', () => {
  it('collects wizard selections into CLI args', async () => {
    const { io } = createMockIo(['2', '2', '2', '2']);
    const result = await promptForInstallArgs(parseArgs([]), io);

    assert.deepEqual(result.runtimes, ['codex']);
    assert.equal(result.scope, 'global');
    assert.equal(result.hybridShadow, true);
    assert.equal(result.dryRun, true);
    assert.equal(result.all, false);
  });

  it('uses defaults when the user presses enter', async () => {
    const { io } = createMockIo(['', '', '', '']);
    const result = await promptForInstallArgs(parseArgs([]), io);

    assert.deepEqual(result.runtimes, ['claude', 'codex']);
    assert.equal(result.scope, 'local');
    assert.equal(result.hybridShadow, false);
    assert.equal(result.dryRun, false);
    assert.equal(result.all, true);
  });

  it('re-prompts on invalid entries', async () => {
    const { io, writes } = createMockIo(['9', '1', '0', '2', 'foo', '1', '3', '2']);
    const result = await promptForInstallArgs(parseArgs([]), io);

    assert.deepEqual(result.runtimes, ['claude']);
    assert.equal(result.scope, 'global');
    assert.equal(result.hybridShadow, false);
    assert.equal(result.dryRun, true);
    assert.ok(writes.some(line => line.includes('Enter 1, 2, or 3.')));
    assert.ok(writes.some(line => line.includes('Enter a number between 1 and 2.')));
  });

  it('returns base args unchanged when tty is unavailable', async () => {
    const baseArgs = parseArgs(['--claude']);
    const result = await promptForInstallArgs(baseArgs, {
      isTTY: false,
      write() {},
      async ask() {
        throw new Error('should not ask');
      },
      clear() {},
      close() {},
    });

    assert.deepEqual(result, baseArgs);
  });
});
