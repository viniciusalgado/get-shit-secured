/**
 * Corpus Catalog Loader
 *
 * Loads and queries the authoritative catalog (data/corpus/catalog.json)
 * and curated overrides (data/corpus/overrides.json).
 */

import type { IssueTypeConfidence, WorkflowId } from '../core/types.js';
import { docIdFromUrl } from './ids.js';

/**
 * A single source entry in the catalog.
 */
export interface CatalogEntry {
  /** Canonical corpus ID (e.g., "password-storage") */
  id: string;
  /** Source URL */
  url: string;
  /** Source type */
  sourceType: 'owasp-cheatsheet' | 'owasp-glossary' | 'other';
  /** Known aliases */
  aliases: string[];
}

/**
 * Curated binding override for a single specialist.
 */
export interface CuratedOverride {
  /** Structured workflow bindings extracted from mapping.ts */
  workflowBindings: Array<{
    workflowId: WorkflowId;
    priority: 'required' | 'optional';
  }>;
  /** Structured stack bindings extracted from mapping.ts */
  stackBindings: Array<{
    stack: string;
  }>;
  /** Issue type tags from specialistDetails */
  issueTypes: string[];
  /** Confidence for issue type tags when curated or inferred in catalog generation */
  issueTypeConfidence?: Partial<Record<string, IssueTypeConfidence>>;
}

/**
 * The catalog.json file structure.
 */
interface CatalogFile {
  version: string;
  generatedAt: string;
  sources: CatalogEntry[];
}

/**
 * The overrides.json file structure.
 */
interface OverridesFile {
  version: string;
  overrides: Record<string, CuratedOverride>;
}

/**
 * Loaded catalog data.
 */
export interface LoadedCatalog {
  entries: CatalogEntry[];
  entryById: Map<string, CatalogEntry>;
  entryByUrl: Map<string, CatalogEntry>;
}

/**
 * Loaded overrides data.
 */
export interface LoadedOverrides {
  overrides: Map<string, CuratedOverride>;
}

/**
 * Load the corpus catalog from a parsed JSON object.
 *
 * @param data - Parsed catalog.json content
 * @returns Loaded catalog with lookup maps
 */
export function loadCatalog(data: CatalogFile): LoadedCatalog {
  const entryById = new Map<string, CatalogEntry>();
  const entryByUrl = new Map<string, CatalogEntry>();

  for (const entry of data.sources) {
    entryById.set(entry.id, entry);
    entryByUrl.set(entry.url, entry);
  }

  return { entries: data.sources, entryById, entryByUrl };
}

/**
 * Load the curated overrides from a parsed JSON object.
 *
 * @param data - Parsed overrides.json content
 * @returns Loaded overrides with lookup map
 */
export function loadOverrides(data: OverridesFile): LoadedOverrides {
  const overrides = new Map<string, CuratedOverride>();
  for (const [id, override] of Object.entries(data.overrides)) {
    overrides.set(id, override);
  }
  return { overrides };
}

/**
 * Get all catalog entries.
 *
 * @param catalog - Loaded catalog
 * @returns Array of all catalog entries
 */
export function getAllCatalogEntries(catalog: LoadedCatalog): CatalogEntry[] {
  return catalog.entries;
}

/**
 * Get a catalog entry by its canonical ID.
 *
 * @param catalog - Loaded catalog
 * @param id - Canonical document ID
 * @returns Catalog entry or undefined
 */
export function getCatalogEntry(catalog: LoadedCatalog, id: string): CatalogEntry | undefined {
  return catalog.entryById.get(id);
}

/**
 * Get a catalog entry by its source URL.
 *
 * @param catalog - Loaded catalog
 * @param url - Source URL
 * @returns Catalog entry or undefined
 */
export function getCatalogEntryByUrl(catalog: LoadedCatalog, url: string): CatalogEntry | undefined {
  return catalog.entryByUrl.get(url);
}

/**
 * Get a curated override for a document.
 *
 * @param overrides - Loaded overrides
 * @param id - Canonical document ID
 * @returns Curated override or undefined
 */
export function getOverride(overrides: LoadedOverrides, id: string): CuratedOverride | undefined {
  return overrides.overrides.get(id);
}
