/**
 * Corpus Snapshot Builder
 *
 * Orchestrates catalog -> fetch -> normalize -> merge -> validate -> write.
 */

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  SecurityDoc,
  CorpusSnapshot,
  CorpusSnapshotStats,
  FetchStatus,
} from '../core/types.js';
import { getAliasesForId } from './ids.js';
import { loadCatalog, loadOverrides } from './catalog.js';
import { normalizeContent, inferWorkflowBindingsFromContent } from './normalize.js';
import { mergeBindings } from './bindings.js';
import { validateSnapshot } from './validators.js';
import { fetchCheatSheetWithMetadata, type FetchCheatSheetOptions } from '../core/owasp-ingestion.js';
import { isCorpusSnapshot } from './schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface BuildOptions {
  corpusVersion: string;
  catalogPath: string;
  overridesPath: string;
  outputPath: string;
  fetchContent: boolean;
  concurrency?: number;
  fetchOptions?: FetchCheatSheetOptions;
}

export interface RefreshReport {
  fetchedSuccessfully: number;
  reusedFromPreviousSnapshot: number;
  pendingWithNoPriorContent: number;
  semanticWarnings: string[];
}

const DEFAULT_OPTIONS: BuildOptions = {
  corpusVersion: '1.0.0',
  catalogPath: join(__dirname, '..', '..', 'data', 'corpus', 'catalog.json'),
  overridesPath: join(__dirname, '..', '..', 'data', 'corpus', 'overrides.json'),
  outputPath: join(__dirname, '..', '..', 'data', 'corpus', 'owasp-corpus.snapshot.json'),
  fetchContent: true,
  concurrency: 5,
};

let lastRefreshReport: RefreshReport | null = null;

export function getLastRefreshReport(): RefreshReport | null {
  return lastRefreshReport;
}

export async function buildCorpusSnapshot(options: Partial<BuildOptions> = {}): Promise<CorpusSnapshot> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const catalog = loadCatalog(JSON.parse(readFileSync(opts.catalogPath, 'utf-8')));
  const overrides = loadOverrides(JSON.parse(readFileSync(opts.overridesPath, 'utf-8')));
  const previousSnapshot = loadPreviousSnapshot(opts.outputPath);

  console.log(`Building corpus v${opts.corpusVersion}...`);
  console.log(`  Catalog: ${catalog.entries.length} entries`);
  console.log(`  Overrides: ${overrides.overrides.size} specialists`);
  console.log(`  Concurrency: ${opts.concurrency ?? 1}`);

  const documents = await mapWithConcurrency(catalog.entries, opts.concurrency ?? 5, async (entry, index) => {
    const override = overrides.overrides.get(entry.id);
    const previousDoc = previousSnapshot?.documents.find(doc => doc.id === entry.id);

    const fetchResult = opts.fetchContent
      ? await fetchCheatSheetWithMetadata(entry.url, opts.fetchOptions)
      : {
          ok: false,
          html: '',
          fetchStatus: 'reused-cache' as const,
          attempts: 0,
        };

    let normalized = normalizeContent(fetchResult.ok ? fetchResult.html : '', entry.url, opts.corpusVersion);
    let sourceHash = fetchResult.ok ? sha256(fetchResult.html) : undefined;

    if (!fetchResult.ok && previousDoc && previousDoc.fetchMetadata?.lastSuccessfulFetchAt) {
      normalized = reusePriorNormalizedContent(previousDoc, opts.corpusVersion);
      sourceHash = previousDoc.fetchMetadata?.sourceContentHash;
      normalized.status = 'ready';
      normalized.summary = normalized.summary || `OWASP guidance for ${normalized.title}`;
    }

    const inferred = inferWorkflowBindingsFromContent(normalized.id, normalized.tags, normalized);
    const merged = mergeBindings(normalized.id, inferred, override);
    if (
      !override?.issueTypes?.length &&
      normalized.issueTypes.length > 0 &&
      merged.issueTypes.length === 0
    ) {
      merged.issueTypes = normalized.issueTypes;
      merged.issueTypeConfidence = normalized.issueTypeConfidence;
      merged.provenance.inferred.push('issueTypes:normalized');
    }

    if (!fetchResult.ok && previousDoc && previousDoc.fetchMetadata?.lastSuccessfulFetchAt) {
      merged.provenance.reused?.push('normalized-content:previous-snapshot');
    }

    const doc: SecurityDoc = {
      id: normalized.id,
      uri: normalized.uri,
      title: normalized.title,
      sourceUrl: normalized.sourceUrl,
      sourceType: normalized.sourceType,
      corpusVersion: opts.corpusVersion,
      status: normalized.status,
      summary: normalized.summary || `OWASP guidance for ${normalized.title}`,
      headings: normalized.headings,
      checklist: normalized.checklist,
      sections: normalized.sections,
      tags: normalized.tags,
      issueTypes: merged.issueTypes,
      issueTypeConfidence: merged.issueTypeConfidence,
      workflowBindings: merged.workflowBindings,
      stackBindings: merged.stackBindings,
      relatedDocIds: normalized.relatedDocIds,
      aliases: [...new Set([...entry.aliases, ...getAliasesForId(normalized.id)])],
      provenance: merged.provenance,
      fetchMetadata: {
        fetchStatus: determineFetchStatus(fetchResult.ok, previousDoc, fetchResult.fetchStatus as FetchStatus),
        fetchAttempts: fetchResult.attempts,
        ...(fetchResult.ok && 'lastSuccessfulFetchAt' in fetchResult
          ? { lastSuccessfulFetchAt: fetchResult.lastSuccessfulFetchAt }
          : previousDoc?.fetchMetadata?.lastSuccessfulFetchAt
            ? { lastSuccessfulFetchAt: previousDoc.fetchMetadata.lastSuccessfulFetchAt }
            : {}),
        ...(sourceHash ? { sourceContentHash: sourceHash } : {}),
      },
    };

    if (doc.status === 'pending' && !doc.summary.trim()) {
      doc.summary = `OWASP guidance for ${doc.title}`;
    }

    if (opts.fetchContent && (index + 1) % 20 === 0) {
      console.log(`  [${index + 1}/${catalog.entries.length}] Processed...`);
    }

    return doc;
  });

  documents.sort((a, b) => a.id.localeCompare(b.id));

  const snapshot: CorpusSnapshot = {
    schemaVersion: 2,
    corpusVersion: opts.corpusVersion,
    generatedAt: new Date().toISOString(),
    documents,
    stats: computeStats(documents),
  };

  const validation = validateSnapshot(snapshot);
  if (!validation.valid) {
    for (const error of validation.errors) {
      console.error(`  x ${error.rule}: ${error.message}`);
    }
    throw new Error(`Corpus validation failed with ${validation.errors.length} errors`);
  }

  lastRefreshReport = {
    fetchedSuccessfully: documents.filter(doc => doc.fetchMetadata?.fetchStatus === 'success').length,
    reusedFromPreviousSnapshot: documents.filter(doc => doc.fetchMetadata?.fetchStatus === 'reused-cache').length,
    pendingWithNoPriorContent: documents.filter(
      doc => doc.status === 'pending' && doc.fetchMetadata?.fetchStatus !== 'reused-cache',
    ).length,
    semanticWarnings: validation.warnings.map(warning => `${warning.rule}: ${warning.message}`),
  };

  writeSnapshotAtomically(snapshot, validation, opts.outputPath);

  console.log(`\nSnapshot written to ${opts.outputPath}`);
  console.log(`  Documents: ${snapshot.stats.totalDocs} (${snapshot.stats.readyDocs} ready, ${snapshot.stats.pendingDocs} pending)`);
  console.log(`  Workflow bindings: ${snapshot.stats.totalBindings}`);
  console.log(`  Related-doc edges: ${snapshot.stats.totalRelatedEdges}`);
  printRefreshReport(lastRefreshReport);

  return snapshot;
}

function determineFetchStatus(
  ok: boolean,
  previousDoc: SecurityDoc | undefined,
  fetchStatus: FetchStatus,
): FetchStatus {
  if (ok) return 'success';
  if (previousDoc?.fetchMetadata?.lastSuccessfulFetchAt) return 'reused-cache';
  return fetchStatus;
}

function reusePriorNormalizedContent(previousDoc: SecurityDoc, corpusVersion: string) {
  return {
    id: previousDoc.id,
    uri: previousDoc.uri,
    title: previousDoc.title,
    sourceUrl: previousDoc.sourceUrl,
    sourceType: previousDoc.sourceType,
    status: 'ready' as const,
    summary: previousDoc.summary,
    headings: previousDoc.headings,
    checklist: previousDoc.checklist,
    sections: previousDoc.sections ?? [],
    tags: previousDoc.tags,
    relatedDocIds: previousDoc.relatedDocIds,
    aliases: previousDoc.aliases,
    issueTypes: previousDoc.issueTypes,
    issueTypeConfidence: previousDoc.issueTypeConfidence ?? {},
    corpusVersion,
  };
}

function loadPreviousSnapshot(path: string): CorpusSnapshot | null {
  if (!existsSync(path)) return null;

  try {
    const raw = JSON.parse(readFileSync(path, 'utf-8'));
    return isCorpusSnapshot(raw) ? raw : null;
  } catch {
    return null;
  }
}

function writeSnapshotAtomically(
  snapshot: CorpusSnapshot,
  validation: ReturnType<typeof validateSnapshot>,
  outputPath: string,
): void {
  if (!validation.valid) {
    throw new Error('Refusing to write invalid snapshot');
  }

  mkdirSync(dirname(outputPath), { recursive: true });
  const tempPath = `${outputPath}.tmp`;
  writeFileSync(tempPath, JSON.stringify(snapshot, null, 2) + '\n');
  renameSync(tempPath, outputPath);
}

function printRefreshReport(report: RefreshReport): void {
  console.log('\nRefresh report:');
  console.log(`  fetched successfully: ${report.fetchedSuccessfully}`);
  console.log(`  reused from previous snapshot: ${report.reusedFromPreviousSnapshot}`);
  console.log(`  pending with no prior content: ${report.pendingWithNoPriorContent}`);
  console.log(`  semantic warnings: ${report.semanticWarnings.length}`);
  for (const warning of report.semanticWarnings.slice(0, 10)) {
    console.log(`    - ${warning}`);
  }
}

function computeStats(documents: SecurityDoc[]): CorpusSnapshotStats {
  const readyDocs = documents.filter(doc => doc.status === 'ready').length;
  const pendingDocs = documents.filter(doc => doc.status === 'pending').length;
  const totalBindings = documents.reduce((sum, doc) => sum + doc.workflowBindings.length, 0);
  const totalRelatedEdges = documents.reduce((sum, doc) => sum + doc.relatedDocIds.length, 0);
  const reusedDocs = documents.filter(doc => doc.fetchMetadata?.fetchStatus === 'reused-cache').length;
  const docsWithIssueTypes = documents.filter(doc => doc.issueTypes.length > 0).length;
  const docsWithWorkflowBindings = documents.filter(doc => doc.workflowBindings.length > 0).length;
  const docsWithSections = documents.filter(doc => doc.sections.length > 0).length;
  const totalSections = documents.reduce((sum, doc) => sum + doc.sections.length, 0);

  return {
    totalDocs: documents.length,
    readyDocs,
    pendingDocs,
    totalBindings,
    totalRelatedEdges,
    reusedDocs,
    docsWithIssueTypes,
    docsWithWorkflowBindings,
    docsWithSections,
    totalSections,
    averageRelatedDocDegree: documents.length > 0 ? totalRelatedEdges / documents.length : 0,
  };
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let index = 0;

  const worker = async () => {
    while (index < items.length) {
      const current = index++;
      results[current] = await mapper(items[current]!, current);
    }
  };

  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length || 1)) }, () => worker());
  await Promise.all(workers);
  return results;
}

const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMainModule) {
  buildCorpusSnapshot().catch(error => {
    console.error('Build failed:', error);
    process.exit(1);
  });
}
