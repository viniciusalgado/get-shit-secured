/**
 * MCP Diagnostics — Startup validation and health checks.
 *
 * Validates the corpus snapshot at server startup and provides
 * diagnostic metadata (corpus version, doc counts, supported
 * workflows and stacks).
 */

import type { LoadedSnapshot } from '../corpus/snapshot-loader.js';
import type { WorkflowId } from '../core/types.js';

/**
 * Diagnostic info about the loaded corpus.
 */
export interface CorpusDiagnostics {
  /** Corpus version string */
  corpusVersion: string;
  /** Total documents in snapshot */
  totalDocs: number;
  /** Documents with status "ready" */
  readyDocs: number;
  /** Total workflow bindings */
  totalBindings: number;
  /** Total related-doc edges */
  totalRelatedEdges: number;
  /** Workflows that have at least one required doc */
  supportedWorkflows: WorkflowId[];
  /** Union of all stack tags in the corpus */
  supportedStacks: string[];
  /** Snapshot was generated at */
  generatedAt: string;
}

/**
 * Compute diagnostics from a loaded snapshot.
 *
 * @param loaded - Loaded corpus snapshot with indices
 * @returns Diagnostic metadata
 */
export function computeDiagnostics(loaded: LoadedSnapshot): CorpusDiagnostics {
  const { snapshot } = loaded;

  // Compute supported workflows (those with at least one required binding)
  const workflowRequiredCounts = new Map<WorkflowId, number>();
  const stacks = new Set<string>();

  for (const doc of snapshot.documents) {
    for (const binding of doc.workflowBindings) {
      if (binding.priority === 'required') {
        workflowRequiredCounts.set(
          binding.workflowId,
          (workflowRequiredCounts.get(binding.workflowId) ?? 0) + 1,
        );
      }
    }
    for (const sb of doc.stackBindings) {
      stacks.add(sb.stack);
    }
  }

  return {
    corpusVersion: snapshot.corpusVersion,
    totalDocs: snapshot.stats.totalDocs,
    readyDocs: snapshot.stats.readyDocs,
    totalBindings: snapshot.stats.totalBindings,
    totalRelatedEdges: snapshot.stats.totalRelatedEdges,
    supportedWorkflows: [...workflowRequiredCounts.keys()].sort(),
    supportedStacks: [...stacks].sort(),
    generatedAt: snapshot.generatedAt,
  };
}
