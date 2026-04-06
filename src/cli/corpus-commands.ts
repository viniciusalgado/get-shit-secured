#!/usr/bin/env node
/**
 * Corpus CLI commands — inspect, validate, refresh.
 *
 * Usage:
 *   gss corpus inspect    — Show corpus version, stats, and health
 *   gss corpus validate   — Run validation rules against current snapshot
 *   gss corpus refresh    — Re-fetch OWASP pages and rebuild snapshot
 */

import { readFileSync, existsSync, copyFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CorpusSnapshot } from '../core/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Locate the corpus snapshot file.
 */
function findSnapshotPath(): string | null {
  const candidates = [
    join(__dirname, '..', '..', 'data', 'corpus', 'owasp-corpus.snapshot.json'),
    join(__dirname, '..', '..', 'data', 'owasp-corpus.snapshot.json'),
    join(process.cwd(), 'data', 'corpus', 'owasp-corpus.snapshot.json'),
    join(process.cwd(), 'data', 'owasp-corpus.snapshot.json'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Load snapshot from disk.
 */
function loadSnapshot(path: string): CorpusSnapshot {
  const raw = readFileSync(path, 'utf-8');
  return JSON.parse(raw) as CorpusSnapshot;
}

/**
 * `gss corpus inspect` — Print corpus stats.
 */
export async function corpusInspect(): Promise<number> {
  const snapshotPath = findSnapshotPath();
  if (!snapshotPath) {
    console.error('No corpus snapshot found. Run "npm run build-corpus" first.');
    return 1;
  }

  const snapshot = loadSnapshot(snapshotPath);
  const stats = snapshot.stats;
  const size = Buffer.byteLength(JSON.stringify(snapshot), 'utf-8');
  const sizeKB = (size / 1024).toFixed(1);

  console.log(`GSS Corpus: v${snapshot.corpusVersion}`);
  console.log(`Generated: ${snapshot.generatedAt}`);
  console.log(`Documents: ${stats.totalDocs} total, ${stats.readyDocs} ready, ${stats.pendingDocs} pending`);
  console.log(`Bindings:  ${stats.totalBindings} workflow bindings, ${stats.totalRelatedEdges} related-doc edges`);
  console.log(`Location:  ${snapshotPath} (${sizeKB} KB)`);

  // Per-workflow breakdown
  const workflowIds = [
    'security-review', 'map-codebase', 'threat-model', 'audit',
    'validate-findings', 'plan-remediation', 'execute-remediation',
    'verify', 'report',
  ] as const;

  console.log('\nTop workflows by binding count:');
  const wfCounts = workflowIds.map(wfId => {
    const docs = snapshot.documents.filter(d =>
      d.workflowBindings.some(b => b.workflowId === wfId));
    const required = docs.filter(d =>
      d.workflowBindings.some(b => b.workflowId === wfId && b.priority === 'required')).length;
    const optional = docs.filter(d =>
      d.workflowBindings.some(b => b.workflowId === wfId && b.priority === 'optional')).length;
    return { wfId, total: docs.length, required, optional };
  }).sort((a, b) => b.total - a.total);

  for (const wf of wfCounts) {
    console.log(`  ${wf.wfId}: ${wf.total} docs (${wf.required} required, ${wf.optional} optional)`);
  }

  // Pending documents
  const pending = snapshot.documents.filter(d => d.status === 'pending');
  if (pending.length > 0) {
    console.log('\nPending documents:');
    for (const doc of pending) {
      console.log(`  - ${doc.id} (${doc.title})`);
    }
  }

  return 0;
}

/**
 * `gss corpus validate` — Run validation rules.
 */
export async function corpusValidate(): Promise<number> {
  const snapshotPath = findSnapshotPath();
  if (!snapshotPath) {
    console.error('No corpus snapshot found. Run "npm run build-corpus" first.');
    return 1;
  }

  const { validateSnapshot } = await import('../corpus/validators.js');
  const snapshot = loadSnapshot(snapshotPath);
  const result = validateSnapshot(snapshot);

  console.log(result.valid ? 'PASS' : 'FAIL');

  for (const e of result.errors) {
    console.error(`  \u2717 ${e.rule}: ${e.message}`);
  }
  for (const w of result.warnings) {
    console.warn(`  \u26A0 ${w.rule}: ${w.message}`);
  }

  console.log(`\n${result.errors.length} errors, ${result.warnings.length} warnings`);
  return result.valid ? 0 : 1;
}

/**
 * `gss corpus refresh` — Re-fetch and rebuild the snapshot.
 */
export async function corpusRefresh(): Promise<number> {
  console.log('Refreshing corpus snapshot...');

  const { buildCorpusSnapshot } = await import('../corpus/snapshot-builder.js');
  const { getLastRefreshReport } = await import('../corpus/snapshot-builder.js');

  // Backup existing snapshot
  const existingPath = findSnapshotPath();
  if (existingPath && existsSync(existingPath)) {
    const backupPath = existingPath + '.bak';
    copyFileSync(existingPath, backupPath);
    console.log(`Backed up existing snapshot to ${backupPath}`);
  }

  try {
    const snapshot = await buildCorpusSnapshot();
    console.log(`\nCorpus refreshed to v${snapshot.corpusVersion}`);
    console.log(`  Documents: ${snapshot.stats.totalDocs} total, ${snapshot.stats.readyDocs} ready, ${snapshot.stats.pendingDocs} pending`);
    console.log(`  Bindings: ${snapshot.stats.totalBindings} workflow bindings`);
    const report = getLastRefreshReport();
    if (report) {
      console.log('  Refresh health:');
      console.log(`    fetched successfully: ${report.fetchedSuccessfully}`);
      console.log(`    reused from previous snapshot: ${report.reusedFromPreviousSnapshot}`);
      console.log(`    pending with no prior content: ${report.pendingWithNoPriorContent}`);
      console.log(`    semantic warnings: ${report.semanticWarnings.length}`);
    }
    return 0;
  } catch (error) {
    console.error('Refresh failed:', error instanceof Error ? error.message : String(error));
    console.error('Existing snapshot preserved.');
    return 1;
  }
}
