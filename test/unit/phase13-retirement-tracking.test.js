/**
 * Phase 13 — Retirement Tracking Tests
 *
 * Validates retirement checklist completeness and TODO marker alignment:
 * - All deprecated modules listed in retirement checklist
 * - All deprecated types from types.ts are listed
 * - TODO markers in types.ts match checklist entries
 * - Legacy test files have retirement headers
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '../..');

const retirementContent = readFileSync(
  join(ROOT, 'migration-plan/retirement-checklist.md'), 'utf-8'
);

const typesContent = readFileSync(join(ROOT, 'src/core/types.ts'), 'utf-8');

// --- Helpers ---

function extractRetirementMarkers(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const markers = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('TODO(remove-in-release-c)')) {
      const nextLines = lines.slice(i, Math.min(i + 5, lines.length)).join('\n');
      const typeMatch = nextLines.match(/(?:export\s+)?(?:interface|type|const|function)\s+(\w+)/);
      markers.push({
        line: i + 1,
        text: lines[i].trim(),
        name: typeMatch ? typeMatch[1] : null,
      });
    }
  }
  return markers;
}

// --- Tests ---

describe('Phase 13: Retirement checklist completeness', () => {

  it('5.1 — All 5 deprecated modules are listed in retirement checklist', () => {
    const expectedModules = [
      'specialist-generator.ts',
      'delegation-planner.ts',
      'delegation-compliance.ts',
      'delegation-graph.ts',
      'legacy-specialist-pipeline.ts',
    ];

    for (const mod of expectedModules) {
      assert.ok(
        retirementContent.includes(mod),
        `Retirement checklist should list ${mod}`
      );
    }
  });

  it('5.2 — Deprecated types from types.ts are listed in retirement checklist', () => {
    const markers = extractRetirementMarkers(join(ROOT, 'src/core/types.ts'));

    for (const marker of markers) {
      if (marker.name) {
        assert.ok(
          retirementContent.includes(marker.name),
          `Retirement checklist should list type ${marker.name} (line ${marker.line})`
        );
      }
    }
  });

  it('5.3 — Legacy test files are listed for retirement', () => {
    const expectedTests = [
      'delegation-planner.test.js',
      'delegation-compliance.test.js',
      'owasp-corpus.test.js',
    ];

    for (const testFile of expectedTests) {
      assert.ok(
        retirementContent.includes(testFile),
        `Retirement checklist should list ${testFile}`
      );
    }
  });

});

describe('Phase 13: TODO marker alignment', () => {

  it('5.4 — Every TODO(remove-in-release-c) in types.ts has a checklist entry', () => {
    const markers = extractRetirementMarkers(join(ROOT, 'src/core/types.ts'));

    for (const marker of markers) {
      if (marker.name) {
        assert.ok(
          retirementContent.includes(marker.name),
          `Type ${marker.name} at line ${marker.line} has TODO marker but no checklist entry`
        );
      }
    }
  });

  it('5.5 — Every type in retirement checklist has a TODO marker in types.ts', () => {
    // Extract type names from the Types to remove section of the checklist
    const typesSection = retirementContent.split('Types to remove')[1]?.split('###')[0] || '';
    const typePattern = /`(\w+)`/g;
    let match;
    const checklistTypes = [];

    while ((match = typePattern.exec(typesSection)) !== null) {
      checklistTypes.push(match[1]);
    }

    for (const typeName of checklistTypes) {
      assert.ok(
        typesContent.includes(typeName),
        `Checklist type ${typeName} not found in types.ts`
      );
    }
  });

  it('5.6 — TODO marker count matches expected', () => {
    const markers = extractRetirementMarkers(join(ROOT, 'src/core/types.ts'));
    assert.strictEqual(
      markers.length, 25,
      `Expected 25 TODO(remove-in-release-c) markers in types.ts, found ${markers.length}`
    );
  });

});

describe('Phase 13: Retirement header on legacy test files', () => {

  it('5.7 — delegation-planner.test.js has retirement header', () => {
    const content = readFileSync(
      join(ROOT, 'test/unit/delegation-planner.test.js'), 'utf-8'
    );
    const header = content.split('\n').slice(0, 15).join('\n');
    assert.ok(
      header.includes('TODO(remove-in-release-c)'),
      'delegation-planner.test.js should have TODO(remove-in-release-c) header'
    );
  });

  it('5.8 — delegation-compliance.test.js has retirement header', () => {
    const content = readFileSync(
      join(ROOT, 'test/unit/delegation-compliance.test.js'), 'utf-8'
    );
    const header = content.split('\n').slice(0, 15).join('\n');
    assert.ok(
      header.includes('TODO(remove-in-release-c)'),
      'delegation-compliance.test.js should have TODO(remove-in-release-c) header'
    );
  });

  it('5.9 — owasp-corpus.test.js has retirement header', () => {
    const content = readFileSync(
      join(ROOT, 'test/unit/owasp-corpus.test.js'), 'utf-8'
    );
    const header = content.split('\n').slice(0, 15).join('\n');
    assert.ok(
      header.includes('TODO(remove-in-release-c)'),
      'owasp-corpus.test.js should have TODO(remove-in-release-c) header'
    );
  });

  it('5.10 — Retirement headers reference correct replacement test files', () => {
    const plannerContent = readFileSync(
      join(ROOT, 'test/unit/delegation-planner.test.js'), 'utf-8'
    );
    const header = plannerContent.split('\n').slice(0, 15).join('\n');
    assert.ok(
      header.includes('consultation-planner.test.js'),
      'delegation-planner.test.js header should reference consultation-planner.test.js'
    );

    const complianceContent = readFileSync(
      join(ROOT, 'test/unit/delegation-compliance.test.js'), 'utf-8'
    );
    const complianceHeader = complianceContent.split('\n').slice(0, 15).join('\n');
    assert.ok(
      complianceHeader.includes('consultation-compliance.test.js'),
      'delegation-compliance.test.js header should reference consultation-compliance.test.js'
    );
  });

});
