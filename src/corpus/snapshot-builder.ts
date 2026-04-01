/**
 * Corpus Snapshot Builder
 *
 * Orchestrates the corpus build pipeline:
 *   catalog.json → fetch → normalize → merge overrides → validate → emit snapshot
 *
 * Usage: node dist/corpus/snapshot-builder.js
 * (or: npm run build-corpus)
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { SecurityDoc, CorpusSnapshot, CorpusSnapshotStats } from '../core/types.js';
import { docIdFromUrl, docUriFromId, getAliasesForId } from './ids.js';
import { loadCatalog, loadOverrides, type LoadedCatalog, type LoadedOverrides } from './catalog.js';
import { normalizeContent, inferWorkflowBindingsFromContent } from './normalize.js';
import { mergeBindings } from './bindings.js';
import { validateSnapshot } from './validators.js';
import { fetchCheatSheet } from '../core/owasp-ingestion.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Options for building a corpus snapshot.
 */
export interface BuildOptions {
  /** Corpus version (semver) */
  corpusVersion: string;
  /** Path to catalog.json */
  catalogPath: string;
  /** Path to overrides.json */
  overridesPath: string;
  /** Output path for the snapshot */
  outputPath: string;
  /** Whether to actually fetch HTML content (false = pending-only build) */
  fetchContent: boolean;
  /** Concurrency limit for HTTP fetches */
  concurrency?: number;
}

/**
 * Default build options.
 */
const DEFAULT_OPTIONS: BuildOptions = {
  corpusVersion: '1.0.0',
  catalogPath: join(__dirname, '..', '..', 'data', 'corpus', 'catalog.json'),
  overridesPath: join(__dirname, '..', '..', 'data', 'corpus', 'overrides.json'),
  outputPath: join(__dirname, '..', '..', 'data', 'corpus', 'owasp-corpus.snapshot.json'),
  fetchContent: true,
  concurrency: 5,
};

/**
 * Build a corpus snapshot from catalog + overrides + live fetch.
 *
 * @param options - Build configuration
 * @returns The built and validated corpus snapshot
 */
export async function buildCorpusSnapshot(options: Partial<BuildOptions> = {}): Promise<CorpusSnapshot> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Load catalog and overrides
  const catalog = loadCatalog(JSON.parse(readFileSync(opts.catalogPath, 'utf-8')));
  const overrides = loadOverrides(JSON.parse(readFileSync(opts.overridesPath, 'utf-8')));

  console.log(`Building corpus v${opts.corpusVersion}...`);
  console.log(`  Catalog: ${catalog.entries.length} entries`);
  console.log(`  Overrides: ${overrides.overrides.size} specialists`);

  // Process each catalog entry
  const documents: SecurityDoc[] = [];
  const entries = catalog.entries;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const override = overrides.overrides.get(entry.id);

    let html = '';
    if (opts.fetchContent) {
      try {
        html = await fetchCheatSheet(entry.url);
      } catch (error) {
        console.error(`  [${i + 1}/${entries.length}] FETCH FAILED: ${entry.id} — ${error}`);
      }
    }

    // Normalize content
    const normalized = normalizeContent(html, entry.url, opts.corpusVersion);

    // Infer bindings (heuristic fallback)
    const inferred = inferWorkflowBindingsFromContent(normalized.id, normalized.tags);

    // Merge with curated overrides
    const merged = mergeBindings(normalized.id, inferred, override);

    // Assemble SecurityDoc
    const doc: SecurityDoc = {
      id: normalized.id,
      uri: normalized.uri,
      title: normalized.title,
      sourceUrl: normalized.sourceUrl,
      sourceType: normalized.sourceType,
      corpusVersion: opts.corpusVersion,
      status: normalized.status,
      summary: normalized.summary,
      headings: normalized.headings,
      checklist: normalized.checklist,
      tags: normalized.tags,
      issueTypes: merged.issueTypes,
      workflowBindings: merged.workflowBindings,
      stackBindings: merged.stackBindings,
      relatedDocIds: normalized.relatedDocIds,
      aliases: [...entry.aliases, ...getAliasesForId(normalized.id)],
      provenance: merged.provenance,
    };

    documents.push(doc);

    if (opts.fetchContent && (i + 1) % 20 === 0) {
      console.log(`  [${i + 1}/${entries.length}] Processed...`);
    }
  }

  // Sort documents by ID for determinism
  documents.sort((a, b) => a.id.localeCompare(b.id));

  // Compute stats
  const stats = computeStats(documents);

  // Assemble snapshot
  const snapshot: CorpusSnapshot = {
    schemaVersion: 1,
    corpusVersion: opts.corpusVersion,
    generatedAt: new Date().toISOString(),
    documents,
    stats,
  };

  // Validate
  const validation = validateSnapshot(snapshot);
  if (!validation.valid) {
    console.error('VALIDATION FAILED:');
    for (const error of validation.errors) {
      console.error(`  ✗ ${error.rule}: ${error.message}`);
    }
    throw new Error(`Corpus validation failed with ${validation.errors.length} errors`);
  }

  if (validation.warnings.length > 0) {
    console.warn('Validation warnings:');
    for (const warning of validation.warnings) {
      console.warn(`  ⚠ ${warning.rule}: ${warning.message}`);
    }
  }

  // Write snapshot
  mkdirSync(dirname(opts.outputPath), { recursive: true });
  writeFileSync(opts.outputPath, JSON.stringify(snapshot, null, 2) + '\n');

  console.log(`\nSnapshot written to ${opts.outputPath}`);
  console.log(`  Documents: ${stats.totalDocs} (${stats.readyDocs} ready, ${stats.pendingDocs} pending)`);
  console.log(`  Workflow bindings: ${stats.totalBindings}`);
  console.log(`  Related-doc edges: ${stats.totalRelatedEdges}`);
  console.log(`  Validation: ${validation.valid ? 'PASS' : 'FAIL'}`);

  return snapshot;
}

/**
 * Compute aggregate statistics for a set of documents.
 */
function computeStats(documents: SecurityDoc[]): CorpusSnapshotStats {
  let readyDocs = 0;
  let pendingDocs = 0;
  let totalBindings = 0;
  let totalRelatedEdges = 0;

  for (const doc of documents) {
    if (doc.status === 'ready') readyDocs++;
    if (doc.status === 'pending') pendingDocs++;
    totalBindings += doc.workflowBindings.length;
    totalRelatedEdges += doc.relatedDocIds.length;
  }

  return {
    totalDocs: documents.length,
    readyDocs,
    pendingDocs,
    totalBindings,
    totalRelatedEdges,
  };
}

// CLI entrypoint when run directly
const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMainModule) {
  buildCorpusSnapshot().catch(error => {
    console.error('Build failed:', error);
    process.exit(1);
  });
}
