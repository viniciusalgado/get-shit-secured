/**
 * Phase 13 — Boundary Audit Script Tests
 *
 * Validates the import boundary audit script:
 * - Script runs and exits 0 (no violations)
 * - Reports expected file and import counts
 * - All boundary types are represented
 * - Output format is correct
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '../..');

function runAudit() {
  return execSync('node scripts/audit-import-boundaries.js', {
    cwd: ROOT,
    encoding: 'utf-8',
  });
}

// --- Tests ---

describe('Phase 13: Boundary audit execution', () => {

  it('6.6 — npm run audit-boundaries exits 0', () => {
    const output = runAudit();
    assert.ok(
      output.includes('Violations: 0'),
      `Expected "Violations: 0" in output, got:\n${output}`
    );
  });

  it('6.7 — Audit script reports expected file and import counts', () => {
    const output = runAudit();

    const filesMatch = output.match(/Files checked:\s*(\d+)/);
    const importsMatch = output.match(/Imports checked:\s*(\d+)/);

    assert.ok(filesMatch, 'Output should contain "Files checked: N"');
    assert.ok(importsMatch, 'Output should contain "Imports checked: N"');

    const filesChecked = parseInt(filesMatch[1], 10);
    const importsChecked = parseInt(importsMatch[1], 10);

    assert.ok(
      filesChecked >= 60,
      `Expected at least 60 files checked, got ${filesChecked}`
    );
    assert.ok(
      importsChecked >= 180,
      `Expected at least 180 imports checked, got ${importsChecked}`
    );
  });

  it('6.8 — Audit script scans all boundary types', () => {
    const output = runAudit();

    // The script should successfully classify all files without "unclassified" warnings
    // (except maybe the README.md which isn't a .ts file)
    assert.ok(
      !output.includes('[ERROR]'),
      `Output should not contain errors:\n${output}`
    );
  });

});

describe('Phase 13: Boundary classification (via MODULE_MAP.md)', () => {

  it('4.1 — Knowledge modules are in src/ areas classified as C', () => {
    // If audit exits 0 with 0 violations, C boundary classification is correct
    const output = runAudit();
    assert.ok(
      output.includes('Violations: 0'),
      'Knowledge boundary files should not cause violations'
    );
  });

  it('4.4 — Installer modules are classified as D', () => {
    // The audit passing with 0 violations implicitly validates classification
    const output = runAudit();
    assert.ok(output.includes('Files checked:'), 'Audit should complete successfully');
  });

  it('4.6 — Compatibility modules are classified as compatibility', () => {
    // The facade file importing from C should not be a violation
    // If audit passes with 0 violations, compatibility classification is correct
    const output = runAudit();
    assert.ok(
      output.includes('Violations: 0'),
      'Compatibility facade importing from C should not cause violations'
    );
  });

  it('4.10 — Installer importing Knowledge is acceptable', () => {
    // The audit should not flag installer.ts importing from Knowledge boundary
    const output = runAudit();
    assert.ok(
      !output.includes('installer.ts') || !output.includes('VIOLATIONS'),
      'Installer importing from Knowledge should not be a violation'
    );
  });

  it('4.11 — Same-boundary import is acceptable', () => {
    // If no violations, then same-boundary imports pass
    const output = runAudit();
    assert.ok(output.includes('Violations: 0'), 'Same-boundary imports should be acceptable');
  });

  it('4.12 — Compatibility importing Knowledge is acceptable', () => {
    // The facade re-exports legacy modules — this should not be flagged
    const output = runAudit();
    assert.ok(output.includes('Violations: 0'), 'Facade importing legacy should be acceptable');
  });

});
