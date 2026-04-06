/**
 * MCP Resource Handlers — security:// URI resolution.
 *
 * Provides resource handlers for:
 * - security://catalog/index         — Corpus metadata summary
 * - security://owasp/cheatsheet/{id} — Full SecurityDoc by canonical ID
 * - security://workflow/{id}/defaults — Docs bound to a workflow, by priority
 */

import type { LoadedSnapshot } from '../corpus/snapshot-loader.js';
import {
  getDocumentById,
  getDocumentsForWorkflow,
} from '../corpus/snapshot-loader.js';
import type { WorkflowId } from '../core/types.js';
import type { CorpusDiagnostics } from './diagnostics.js';

/**
 * Shape of a resource entry returned by resources/list.
 */
export interface ResourceEntry {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

/**
 * Build the static list of resources.
 * Called once at server startup after snapshot loads.
 */
export function buildResourceList(diag: CorpusDiagnostics): ResourceEntry[] {
  const resources: ResourceEntry[] = [
    {
      uri: 'security://catalog/index',
      name: 'Security Document Catalog',
      description: 'Corpus metadata: version, doc counts, supported workflows and stacks',
      mimeType: 'application/json',
    },
    {
      uri: 'security://catalog/diagnostics',
      name: 'Security Document Diagnostics',
      description: 'Semantic validation warnings and corpus health signals',
      mimeType: 'application/json',
    },
  ];

  // Add workflow defaults resources
  for (const wf of diag.supportedWorkflows) {
    resources.push({
      uri: `security://workflow/${wf}/defaults`,
      name: `${wf} Workflow Defaults`,
      description: `Security documents bound to the ${wf} workflow, grouped by priority`,
      mimeType: 'application/json',
    });
  }

  return resources;
}

/**
 * Result of reading a resource.
 */
export interface ResourceContent {
  uri: string;
  mimeType: string;
  text: string;
}

/**
 * Read a resource by URI.
 *
 * @param uri - The resource URI
 * @param loaded - Loaded corpus snapshot
 * @param diag - Corpus diagnostics
 * @returns Resource content
 * @throws Error if URI is unknown or document not found
 */
export function readResource(
  uri: string,
  loaded: LoadedSnapshot,
  diag: CorpusDiagnostics,
): ResourceContent {
  if (uri === 'security://catalog/index') {
    return {
      uri,
      mimeType: 'application/json',
      text: JSON.stringify({
        corpusVersion: diag.corpusVersion,
        totalDocs: diag.totalDocs,
        readyDocs: diag.readyDocs,
        pendingDocs: loaded.snapshot.stats.pendingDocs,
        totalBindings: diag.totalBindings,
        totalRelatedEdges: diag.totalRelatedEdges,
        reusedDocs: diag.reusedDocs,
        docsWithIssueTypes: diag.docsWithIssueTypes,
        docsWithSections: diag.docsWithSections,
        averageRelatedDocDegree: diag.averageRelatedDocDegree,
        supportedWorkflows: diag.supportedWorkflows,
        supportedStacks: diag.supportedStacks,
        generatedAt: diag.generatedAt,
        health: {
          warningCount: diag.warnings.length,
        },
      }, null, 2),
    };
  }

  if (uri === 'security://catalog/diagnostics') {
    return {
      uri,
      mimeType: 'application/json',
      text: JSON.stringify({
        corpusVersion: diag.corpusVersion,
        warnings: diag.warnings,
      }, null, 2),
    };
  }

  // security://workflow/{workflowId}/defaults
  const workflowMatch = uri.match(/^security:\/\/workflow\/([^/]+)\/defaults$/);
  if (workflowMatch) {
    const workflowId = workflowMatch[1] as WorkflowId;
    const required = getDocumentsForWorkflow(loaded, workflowId, 'required');
    const optional = getDocumentsForWorkflow(loaded, workflowId, 'optional');
    const followup = getDocumentsForWorkflow(loaded, workflowId, 'followup');

    return {
      uri,
      mimeType: 'application/json',
      text: JSON.stringify({
        workflowId,
        corpusVersion: diag.corpusVersion,
        required: required.map(summarizeDoc),
        optional: optional.map(summarizeDoc),
        followup: followup.map(summarizeDoc),
      }, null, 2),
    };
  }

  // security://owasp/cheatsheet/{id}
  const cheatsheetMatch = uri.match(/^security:\/\/owasp\/cheatsheet\/([^#]+)(?:#section=(.+))?$/);
  if (cheatsheetMatch) {
    const id = cheatsheetMatch[1];
    const doc = getDocumentById(loaded, id);
    if (!doc) {
      throw new Error(`Document not found: ${id}`);
    }
    return {
      uri,
      mimeType: 'application/json',
      text: JSON.stringify(
        cheatsheetMatch[2]
          ? {
              doc,
              selectedSection: doc.sections.find(section => section.anchor === cheatsheetMatch[2]) ?? null,
            }
          : doc,
        null,
        2,
      ),
    };
  }

  throw new Error(`Unknown resource URI: ${uri}`);
}

/**
 * Summarize a SecurityDoc for resource listings.
 */
function summarizeDoc(doc: ReturnType<typeof getDocumentById> & {}): {
  id: string;
  uri: string;
  title: string;
  summary: string;
  tags: string[];
} {
  return {
    id: doc.id,
    uri: doc.uri,
    title: doc.title,
    summary: doc.summary,
    tags: doc.tags,
  };
}
