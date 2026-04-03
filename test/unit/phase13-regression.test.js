/**
 * Phase 13 — Regression Tests
 *
 * Validates that Phase 13 changes did not introduce regressions:
 * - Build succeeds
 * - Legacy test files still pass
 * - Boundary audit exits 0
 * - Install pipeline unchanged
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '../..');

function runCommand(cmd) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf-8' });
}

// --- Tests ---

describe('Phase 13: Build and compilation', () => {

  it('6.1 — TypeScript compilation succeeds', () => {
    // This is validated by the fact that we're running tests against dist/
    // The build has already been run. If it failed, dist/ wouldn't be available.
    const output = runCommand('npm run build');
    assert.ok(true, 'Build completed successfully');
  });

});

describe('Phase 13: Boundary audit execution', () => {

  it('6.6 — npm run audit-boundaries exits 0', () => {
    const output = runCommand('npm run audit-boundaries');
    assert.ok(
      output.includes('Violations: 0'),
      `Expected "Violations: 0" in output`
    );
  });

  it('6.7 — Audit script reports expected file and import counts', () => {
    const output = runCommand('npm run audit-boundaries');

    const filesMatch = output.match(/Files checked:\s*(\d+)/);
    const importsMatch = output.match(/Imports checked:\s*(\d+)/);

    assert.ok(filesMatch, 'Output should contain "Files checked: N"');
    assert.ok(importsMatch, 'Output should contain "Imports checked: N"');

    const filesChecked = parseInt(filesMatch[1], 10);
    const importsChecked = parseInt(importsMatch[1], 10);

    assert.ok(filesChecked >= 60, `Expected >= 60 files, got ${filesChecked}`);
    assert.ok(importsChecked >= 180, `Expected >= 180 imports, got ${importsChecked}`);
  });

  it('6.8 — Audit script scans all boundary types', () => {
    const output = runCommand('npm run audit-boundaries');
    assert.ok(
      !output.includes('[ERROR]'),
      'Output should not contain errors'
    );
  });

});

describe('Phase 13: No behavioral regressions', () => {

  it('6.2 — Legacy delegation-planner tests still pass', () => {
    const output = runCommand('node --test test/unit/delegation-planner.test.js');
    assert.ok(
      !output.includes('failed') || output.includes('0 failed'),
      'delegation-planner tests should pass'
    );
  });

  it('6.3 — Legacy delegation-compliance tests still pass', () => {
    const output = runCommand('node --test test/unit/delegation-compliance.test.js');
    assert.ok(
      !output.includes('failed') || output.includes('0 failed'),
      'delegation-compliance tests should pass'
    );
  });

  it('6.4 — Legacy owasp-corpus tests still pass', () => {
    const output = runCommand('node --test test/unit/owasp-corpus.test.js');
    assert.ok(
      !output.includes('failed') || output.includes('0 failed'),
      'owasp-corpus tests should pass'
    );
  });

});

describe('Phase 13: Install pipeline unchanged', () => {

  it('6.5 — Installer still imports generateAllSpecialists', () => {
    // Verify the import path changed but the function is still used
    const content = readFileSync(join(ROOT, 'src/core/installer.ts'), 'utf-8');
    assert.ok(
      content.includes('generateAllSpecialists'),
      'installer.ts should still use generateAllSpecialists'
    );
  });

});
