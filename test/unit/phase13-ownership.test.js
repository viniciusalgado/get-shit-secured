/**
 * Phase 13 — MODULE_MAP.md Ownership Tests
 *
 * Validates that the module ownership map document is complete and accurate:
 * - Every .ts file in src/ is listed in MODULE_MAP.md
 * - Every file listed in MODULE_MAP.md exists on disk
 * - Deprecated modules are classified correctly
 * - Active modules have correct status
 * - Legacy registry is complete
 * - Import rules are documented
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '../..');
const SRC = join(ROOT, 'src');
const MODULE_MAP_PATH = join(ROOT, 'src/MODULE_MAP.md');
const moduleMapContent = readFileSync(MODULE_MAP_PATH, 'utf-8');

// --- Helpers ---

/** Recursively collect all .ts files in src/ */
function* walkTs(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkTs(full);
    } else if (entry.name.endsWith('.ts')) {
      yield full;
    }
  }
}

/** Parse a markdown table from MODULE_MAP.md into rows of objects */
function parseMarkdownTable(content, sectionHeader) {
  const lines = content.split('\n');
  let inSection = false;
  let headers = null;
  const rows = [];

  for (const line of lines) {
    // Match both ## and ### headers, or subsection headers after ##
    if (line.startsWith('#') && line.includes(sectionHeader)) {
      inSection = true;
      headers = null;
      continue;
    }
    // Stop at next same-or-higher-level heading
    if (inSection && line.startsWith('#') && !line.includes(sectionHeader)) {
      // Only break for same or higher level headings (## but not ###)
      if (line.match(/^#{1,3}\s/) && !line.startsWith('#' + '#'.repeat(4))) {
        break;
      }
    }
    if (!inSection) continue;

    if (line.startsWith('|') && line.endsWith('|')) {
      const cells = line.split('|').map(c => c.trim()).filter(Boolean);
      if (!headers) {
        headers = cells;
      } else if (!line.match(/^\|[\s\-:|]+\|$/)) {
        const row = {};
        headers.forEach((h, i) => { row[h] = cells[i] || ''; });
        rows.push(row);
      }
    }
  }
  return rows;
}

/** Parse ALL markdown tables from the entire document */
function parseAllTables(content) {
  const lines = content.split('\n');
  let headers = null;
  const rows = [];

  for (const line of lines) {
    if (line.startsWith('|') && line.endsWith('|')) {
      const cells = line.split('|').map(c => c.trim()).filter(Boolean);
      if (!headers) {
        headers = cells;
      } else if (!line.match(/^\|[\s\-:|]+\|$/)) {
        const row = {};
        headers.forEach((h, i) => { row[h] = cells[i] || ''; });
        rows.push(row);
      }
    } else {
      headers = null;
    }
  }
  return rows;
}

// --- Tests ---

describe('Phase 13: MODULE_MAP.md — file coverage', () => {

  it('1.1 — Every .ts file in src/ is listed in MODULE_MAP.md', () => {
    const srcFiles = [...walkTs(SRC)].map(f => relative(ROOT, f).replace(/\\/g, '/'));
    const missing = [];

    for (const file of srcFiles) {
      // Check if filename appears somewhere in the document
      if (!moduleMapContent.includes(file)) {
        // Also check without extension (some entries might use different format)
        const basename = file.split('/').pop();
        if (!moduleMapContent.includes(basename)) {
          missing.push(file);
        }
      }
    }

    assert.strictEqual(missing.length, 0,
      `Files missing from MODULE_MAP.md: ${missing.join(', ')}`);
  });

  it('1.2 — Every file listed in MODULE_MAP.md exists on disk', () => {
    // Extract file paths that look like src/**.ts from the document
    const filePattern = /src\/[^\s|`]+\.(?:ts|js)/g;
    const matches = moduleMapContent.match(filePattern) || [];
    const uniqueFiles = [...new Set(matches)].filter(f => !f.includes('*'));

    const missing = [];
    for (const file of uniqueFiles) {
      const fullPath = join(ROOT, file);
      if (!existsSync(fullPath)) {
        missing.push(file);
      }
    }

    assert.strictEqual(missing.length, 0,
      `Files in MODULE_MAP.md that don't exist: ${missing.join(', ')}`);
  });

});

describe('Phase 13: MODULE_MAP.md — boundary classification', () => {

  const allRows = parseAllTables(moduleMapContent);

  it('1.3 — Deprecated modules are classified correctly', () => {
    const deprecatedFiles = [
      'delegation-planner.ts',
      'delegation-compliance.ts',
      'delegation-graph.ts',
      'specialist-generator.ts',
    ];

    for (const filename of deprecatedFiles) {
      const row = allRows.find(r => r.File && r.File.includes(filename));
      assert.ok(row, `Module ${filename} not found in MODULE_MAP.md tables`);
      assert.ok(
        row.Status && row.Status.includes('deprecated'),
        `${filename} should be deprecated, got: ${row.Status}`
      );
      assert.ok(
        row.Retirement && row.Retirement.includes('Release C'),
        `${filename} retirement should be Release C, got: ${row.Retirement}`
      );
    }
  });

  it('1.4 — Active modules are classified as active', () => {
    const activeFiles = [
      'consultation-planner.ts',
      'consultation-compliance.ts',
      'consultation-signals.ts',
      'consultation-comparator.ts',
    ];

    for (const filename of activeFiles) {
      const row = allRows.find(r => r.File && r.File.includes(filename));
      assert.ok(row, `Module ${filename} not found in MODULE_MAP.md tables`);
      assert.ok(
        row.Status && row.Status.includes('active'),
        `${filename} should be active, got: ${row.Status}`
      );
    }
  });

  it('1.5 — mapping.ts is classified as build-only', () => {
    const row = allRows.find(r => r.File && r.File.includes('mapping.ts'));
    assert.ok(row, 'mapping.ts not found in MODULE_MAP.md tables');
    assert.ok(
      row.Status && row.Status.includes('build-only'),
      `mapping.ts should be build-only, got: ${row.Status}`
    );
  });

  it('1.6 — owasp-ingestion.ts is classified as repurpose', () => {
    const row = allRows.find(r => r.File && r.File.includes('owasp-ingestion.ts'));
    assert.ok(row, 'owasp-ingestion.ts not found in MODULE_MAP.md tables');
    assert.ok(
      row.Status && row.Status.includes('repurpose'),
      `owasp-ingestion.ts should be repurpose, got: ${row.Status}`
    );
  });

});

describe('Phase 13: MODULE_MAP.md — legacy registry', () => {

  it('1.7 — Legacy registry lists all 5 deprecated modules', () => {
    const expectedModules = [
      'delegation-planner.ts',
      'delegation-compliance.ts',
      'delegation-graph.ts',
      'specialist-generator.ts',
      'legacy-specialist-pipeline.ts',
    ];

    const legacySection = moduleMapContent.split('Legacy Module Registry')[1] || '';

    for (const mod of expectedModules) {
      assert.ok(
        legacySection.includes(mod),
        `Legacy registry should list ${mod}`
      );
    }
  });

  it('1.8 — Each legacy entry has a replacement reference', () => {
    const legacySection = moduleMapContent.split('Legacy Module Registry')[1]?.split('##')[0] || '';
    const rows = legacySection.split('\n')
      .filter(line => line.startsWith('|') && line.endsWith('|') && !line.match(/^\|[\s\-:|]+\|$/) && !line.includes('Module'))
      .map(line => line.split('|').map(c => c.trim()).filter(Boolean));

    // Skip header row — rows after first data row should have replacement
    for (const cells of rows) {
      if (cells.length >= 3) {
        const replacement = cells[2] || '';
        assert.ok(
          replacement.length > 0,
          `Legacy entry ${cells[0]} should have a replacement reference`
        );
      }
    }
  });

});

describe('Phase 13: MODULE_MAP.md — import rules', () => {

  it('1.9 — Import rules section exists with 7 rules', () => {
    const rulesSection = moduleMapContent.split('Import Rules')[1]?.split('##')[0] || '';
    const numberedRules = rulesSection.match(/^\d+\./gm) || [];
    assert.ok(
      numberedRules.length >= 7,
      `Expected at least 7 import rules, found ${numberedRules.length}`
    );
  });

  it('1.10 — Cross-boundary dependency table documents known imports', () => {
    assert.ok(
      moduleMapContent.includes('Cross-Boundary Dependency Map'),
      'MODULE_MAP.md should have Cross-Boundary Dependency Map section'
    );
    assert.ok(
      moduleMapContent.includes('Acceptable Cross-Boundary Imports'),
      'MODULE_MAP.md should have Acceptable Cross-Boundary Imports table'
    );
    assert.ok(
      moduleMapContent.includes('installer.ts'),
      'Cross-boundary table should document installer.ts imports'
    );
  });

});
