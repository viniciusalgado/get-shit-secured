#!/usr/bin/env node
/**
 * Validate a corpus snapshot.
 * Usage: node scripts/validate-corpus.mjs [path-to-snapshot]
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateSnapshot } from '../dist/corpus/validators.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const snapshotPath = process.argv[2] || join(__dirname, '..', 'data', 'corpus', 'owasp-corpus.snapshot.json');

const raw = readFileSync(snapshotPath, 'utf-8');
const snapshot = JSON.parse(raw);
const result = validateSnapshot(snapshot);

console.log(result.valid ? 'PASS' : 'FAIL');
for (const e of result.errors) {
  console.error(`✗ ${e.rule}: ${e.message}`);
}
for (const w of result.warnings) {
  console.warn(`⚠ ${w.rule}: ${w.message}`);
}

console.log(`\n${result.errors.length} errors, ${result.warnings.length} warnings`);
process.exit(result.valid ? 0 : 1);
