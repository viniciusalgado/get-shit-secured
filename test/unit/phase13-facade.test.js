/**
 * Phase 13 — Legacy Facade Tests
 *
 * Validates the legacy-specialist-pipeline.ts facade:
 * - Re-exports match the source modules
 * - Functions are callable
 * - Installer imports through the facade
 * - No direct legacy imports outside compatibility/
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = join(import.meta.dirname, '../..');
const DIST = join(ROOT, 'dist');
const distAvailable = existsSync(DIST);

// --- Tests ---

describe('Phase 13: Facade re-exports — specialist-generator', { skip: !distAvailable }, () => {

  it('3.1 — generateAllSpecialists is exported and callable', async () => {
    const mod = await import('../../dist/compatibility/legacy-specialist-pipeline.js');
    assert.strictEqual(typeof mod.generateAllSpecialists, 'function');
  });

  it('3.2 — generateSpecialist is exported', async () => {
    const mod = await import('../../dist/compatibility/legacy-specialist-pipeline.js');
    assert.strictEqual(typeof mod.generateSpecialist, 'function');
  });

  it('3.3 — getSpecialistById, getSpecialistsByWorkflow, getSpecialistsByStack are exported', async () => {
    const mod = await import('../../dist/compatibility/legacy-specialist-pipeline.js');
    assert.strictEqual(typeof mod.getSpecialistById, 'function');
    assert.strictEqual(typeof mod.getSpecialistsByWorkflow, 'function');
    assert.strictEqual(typeof mod.getSpecialistsByStack, 'function');
  });

});

describe('Phase 13: Facade re-exports — delegation-planner', { skip: !distAvailable }, () => {

  it('3.4 — computeDelegationPlan is exported and callable', async () => {
    const mod = await import('../../dist/compatibility/legacy-specialist-pipeline.js');
    assert.strictEqual(typeof mod.computeDelegationPlan, 'function');
  });

  it('3.5 — DelegationPlanInput type is re-exported (compile-time; runtime typeof check)', async () => {
    // Type re-exports are compile-time. Verify the module loads without error.
    const mod = await import('../../dist/compatibility/legacy-specialist-pipeline.js');
    assert.ok(mod, 'Facade module should load without error');
  });

});

describe('Phase 13: Facade re-exports — delegation-compliance', { skip: !distAvailable }, () => {

  it('3.6 — validateCompliance is exported and callable', async () => {
    const mod = await import('../../dist/compatibility/legacy-specialist-pipeline.js');
    assert.strictEqual(typeof mod.validateCompliance, 'function');
  });

});

describe('Phase 13: Facade re-exports — delegation-graph', { skip: !distAvailable }, () => {

  it('3.7 — buildDelegationGraph and getDelegationTargets are exported', async () => {
    const mod = await import('../../dist/compatibility/legacy-specialist-pipeline.js');
    assert.strictEqual(typeof mod.buildDelegationGraph, 'function');
    assert.strictEqual(typeof mod.getDelegationTargets, 'function');
  });

  it('3.8 — DelegationGraph type is re-exported (compile-time; runtime load check)', async () => {
    const mod = await import('../../dist/compatibility/legacy-specialist-pipeline.js');
    assert.ok(mod, 'Facade module loads — DelegationGraph type available at compile time');
  });

});

describe('Phase 13: Facade isolation — installer import', () => {

  it('3.9 — installer.ts imports generateAllSpecialists from facade', () => {
    const content = readFileSync(join(ROOT, 'src/core/installer.ts'), 'utf-8');
    const importLine = content.split('\n').find(line =>
      line.includes('generateAllSpecialists') && line.includes('import')
    );
    assert.ok(importLine, 'installer.ts should import generateAllSpecialists');
    assert.ok(
      importLine.includes('compatibility/legacy-specialist-pipeline'),
      `import should be from compatibility facade, got: ${importLine.trim()}`
    );
  });

  it('3.10 — No non-compatibility source imports directly from specialist-generator.ts', () => {
    // grep returns exit code 1 when no matches found, which execSync throws on.
    // Use try/catch to handle the expected "no matches" case.
    let result = '';
    try {
      result = execSync(
        'grep -r "from.*specialist-generator" src/ --include="*.ts" | grep -v "compatibility/"',
        { cwd: ROOT, encoding: 'utf-8' }
      ).trim();
    } catch (e) {
      // grep exit code 1 means no matches found — that's the desired state
      if (e.status === 1) {
        // No non-compatibility imports found: PASS
        return;
      }
      throw e;
    }

    // If we got results, check they're only self-imports
    const lines = result.split('\n').filter(l => l.trim().length > 0);
    const nonSelfImports = lines.filter(l => !l.includes('src/core/specialist-generator.ts:'));

    assert.strictEqual(
      nonSelfImports.length, 0,
      `Non-compatibility imports from specialist-generator.ts found:\n${nonSelfImports.join('\n')}`
    );
  });

});
