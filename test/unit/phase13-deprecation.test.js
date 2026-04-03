/**
 * Phase 13 — Deprecation Annotation Tests
 *
 * Validates that all legacy modules have correct @deprecated annotations:
 * - File-level deprecation notices on 4 legacy modules
 * - Export-level @deprecated on all exported functions/types
 * - Build-time-only documentation on mapping.ts
 * - Dual-use scope documentation on owasp-ingestion.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '../..');

function readFile(relativePath) {
  return readFileSync(join(ROOT, relativePath), 'utf-8');
}

function getHeaderLines(filePath, count = 30) {
  const content = readFile(filePath);
  return content.split('\n').slice(0, count).join('\n');
}

// --- Tests ---

describe('Phase 13: File-level deprecation notices', () => {

  it('2.1 — delegation-planner.ts has file-level deprecation notice', () => {
    const header = getHeaderLines('src/core/delegation-planner.ts');
    assert.ok(
      header.includes('DEPRECATED') || header.includes('@deprecated'),
      'delegation-planner.ts should have DEPRECATED in file header'
    );
    assert.ok(
      header.includes('consultation-planner.ts'),
      'delegation-planner.ts deprecation should reference consultation-planner.ts as replacement'
    );
  });

  it('2.2 — delegation-compliance.ts has file-level deprecation notice', () => {
    const header = getHeaderLines('src/core/delegation-compliance.ts');
    assert.ok(
      header.includes('DEPRECATED') || header.includes('@deprecated'),
      'delegation-compliance.ts should have DEPRECATED in file header'
    );
    assert.ok(
      header.includes('consultation-compliance.ts'),
      'delegation-compliance.ts deprecation should reference consultation-compliance.ts as replacement'
    );
  });

  it('2.3 — delegation-graph.ts has file-level deprecation notice', () => {
    const header = getHeaderLines('src/core/delegation-graph.ts');
    assert.ok(
      header.includes('DEPRECATED') || header.includes('@deprecated'),
      'delegation-graph.ts should have DEPRECATED in file header'
    );
    assert.ok(
      header.includes('relatedDocIds') || header.includes('corpus'),
      'delegation-graph.ts deprecation should reference relatedDocIds or corpus'
    );
  });

  it('2.4 — specialist-generator.ts has file-level deprecation notice', () => {
    const header = getHeaderLines('src/core/specialist-generator.ts');
    assert.ok(
      header.includes('DEPRECATED') || header.includes('@deprecated'),
      'specialist-generator.ts should have DEPRECATED in file header'
    );
    assert.ok(
      header.includes('MCP'),
      'specialist-generator.ts deprecation should reference MCP consultation pipeline'
    );
  });

});

describe('Phase 13: Export-level @deprecated annotations', () => {

  it('2.5 — delegation-planner.ts exports have @deprecated', () => {
    const content = readFile('src/core/delegation-planner.ts');
    assert.ok(
      content.includes('@deprecated') && content.includes('export function computeDelegationPlan'),
      'computeDelegationPlan should have @deprecated annotation'
    );
    assert.ok(
      content.includes('@deprecated') && content.includes('export interface DelegationPlanInput'),
      'DelegationPlanInput should have @deprecated annotation'
    );
  });

  it('2.6 — delegation-compliance.ts exports have @deprecated', () => {
    const content = readFile('src/core/delegation-compliance.ts');
    assert.ok(
      content.includes('@deprecated') && content.includes('export function validateCompliance'),
      'validateCompliance should have @deprecated annotation'
    );
  });

  it('2.7 — delegation-graph.ts exports have @deprecated', () => {
    const content = readFile('src/core/delegation-graph.ts');
    assert.ok(
      content.includes('@deprecated') && content.includes('buildDelegationGraph'),
      'buildDelegationGraph should have @deprecated annotation'
    );
    assert.ok(
      content.includes('@deprecated') && content.includes('getDelegationTargets'),
      'getDelegationTargets should have @deprecated annotation'
    );
    assert.ok(
      content.includes('@deprecated') && content.includes('DelegationGraph'),
      'DelegationGraph should have @deprecated annotation'
    );
  });

  it('2.8 — specialist-generator.ts exports have @deprecated', () => {
    const content = readFile('src/core/specialist-generator.ts');

    const expectedExports = [
      'generateAllSpecialists',
      'generateSpecialist',
      'getSpecialistById',
      'getSpecialistsByWorkflow',
      'getSpecialistsByStack',
    ];

    for (const exportName of expectedExports) {
      assert.ok(
        content.includes('@deprecated') && content.includes(`export function ${exportName}`),
        `${exportName} should have @deprecated annotation`
      );
    }
  });

});

describe('Phase 13: Build-time-only documentation', () => {

  it('2.9 — mapping.ts has build-time-only scope documentation', () => {
    const header = getHeaderLines('src/catalog/specialists/mapping.ts');
    assert.ok(
      header.includes('BUILD-TIME ONLY'),
      'mapping.ts should have BUILD-TIME ONLY in file header'
    );
    assert.ok(
      header.includes('corpus') || header.includes('build'),
      'mapping.ts header should explain corpus build pipeline consumption'
    );
  });

  it('2.10 — mapping.ts runtime-facing exports have @deprecated', () => {
    const content = readFile('src/catalog/specialists/mapping.ts');
    assert.ok(
      content.includes('@deprecated') && content.includes('WorkflowSpecialistBinding'),
      'WorkflowSpecialistBinding should have @deprecated annotation'
    );
    assert.ok(
      content.includes('@deprecated') && content.includes('SpecialistBindingDetail'),
      'SpecialistBindingDetail should have @deprecated annotation'
    );
  });

});

describe('Phase 13: Dual-use scope documentation', () => {

  it('2.11 — owasp-ingestion.ts has dual-use scope documentation', () => {
    const header = getHeaderLines('src/core/owasp-ingestion.ts');
    assert.ok(
      header.includes('DUAL-USE'),
      'owasp-ingestion.ts should have DUAL-USE in file header'
    );
    assert.ok(
      header.includes('build-time') || header.includes('Build-time'),
      'owasp-ingestion.ts header should explain build-time use'
    );
    assert.ok(
      header.includes('install-time') || header.includes('Install-time'),
      'owasp-ingestion.ts header should explain install-time use'
    );
  });

  it('2.12 — owasp-ingestion.ts documents Release C removal for install-time path', () => {
    const header = getHeaderLines('src/core/owasp-ingestion.ts');
    assert.ok(
      header.includes('Release C'),
      'owasp-ingestion.ts header should reference Release C'
    );
    assert.ok(
      header.includes('fetchAllCheatSheets'),
      'owasp-ingestion.ts header should reference fetchAllCheatSheets removal'
    );
  });

});
