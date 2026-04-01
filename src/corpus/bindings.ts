/**
 * Binding Merge Module
 *
 * Merges inferred bindings (from normalize.ts heuristics) with
 * curated overrides (from overrides.json, extracted from mapping.ts).
 *
 * Curated overrides win when both exist for a doc+workflow pair.
 * Provenance records track the source of every binding.
 */

import type {
  DocWorkflowBinding,
  DocStackBinding,
  DocProvenance,
  WorkflowId,
} from '../core/types.js';
import type { CuratedOverride } from './catalog.js';
import type { InferredBindings } from './normalize.js';

/**
 * Result of binding merge.
 */
export interface MergedBindings {
  /** Final workflow bindings after merge */
  workflowBindings: DocWorkflowBinding[];
  /** Final stack bindings after merge */
  stackBindings: DocStackBinding[];
  /** Issue type tags (from override or empty) */
  issueTypes: string[];
  /** Provenance tracking which fields came from where */
  provenance: DocProvenance;
}

/**
 * Merge inferred bindings with curated overrides.
 *
 * Merge rules:
 * - If override exists for a doc+workflow pair -> use override (curated wins)
 * - If no override -> keep inferred binding with provenance.inferred marker
 * - Override issueTypes from specialistDetails.issueTags where available
 * - Override stackBindings from stackConditionedSpecialists where available
 *
 * @param docId - Document ID being processed
 * @param inferred - Bindings derived from heuristic analysis
 * @param override - Curated override from mapping.ts (may be undefined)
 * @returns Merged bindings with provenance
 */
export function mergeBindings(
  docId: string,
  inferred: InferredBindings,
  override: CuratedOverride | undefined
): MergedBindings {
  const provenance: DocProvenance = {
    inferred: [],
    overridden: [],
  };

  const workflowBindings = mergeWorkflowBindings(docId, inferred, override, provenance);
  const stackBindings = mergeStackBindings(docId, inferred, override, provenance);
  const issueTypes = mergeIssueTypes(docId, override, provenance);

  return {
    workflowBindings,
    stackBindings,
    issueTypes,
    provenance,
  };
}

/**
 * Merge workflow bindings. Curated overrides take precedence.
 */
function mergeWorkflowBindings(
  docId: string,
  inferred: InferredBindings,
  override: CuratedOverride | undefined,
  provenance: DocProvenance
): DocWorkflowBinding[] {
  const bindings: DocWorkflowBinding[] = [];
  const seenWorkflowPairs = new Set<string>();

  // If curated override exists, use it as the primary source
  if (override && override.workflowBindings.length > 0) {
    for (const wb of override.workflowBindings) {
      const key = `${wb.workflowId}:${wb.priority}`;
      if (!seenWorkflowPairs.has(key)) {
        seenWorkflowPairs.add(key);
        bindings.push({
          workflowId: wb.workflowId,
          priority: wb.priority,
          rationale: 'curated: from WORKFLOW_SPECIALIST_MAPPING',
        });
        provenance.overridden.push(`workflow-binding:${wb.workflowId}:curated`);
      }
    }
  }

  // Add inferred bindings for workflows not covered by overrides
  for (const wb of inferred.workflowBindings) {
    // Check if this workflow is already covered by a curated binding (at any priority)
    const workflowAlreadyCovered = override
      ? override.workflowBindings.some(ob => ob.workflowId === wb.workflowId)
      : false;

    if (!workflowAlreadyCovered && !seenWorkflowPairs.has(`${wb.workflowId}:${wb.priority}`)) {
      seenWorkflowPairs.add(`${wb.workflowId}:${wb.priority}`);
      bindings.push(wb);
      provenance.inferred.push(`workflow-binding:${wb.workflowId}:inferred`);
    }
  }

  // Sort: required first, then optional, then followup; within each, by workflowId
  const priorityOrder = { required: 0, optional: 1, followup: 2 };
  bindings.sort((a, b) => {
    const pa = priorityOrder[a.priority] ?? 3;
    const pb = priorityOrder[b.priority] ?? 3;
    if (pa !== pb) return pa - pb;
    return a.workflowId.localeCompare(b.workflowId);
  });

  return bindings;
}

/**
 * Merge stack bindings. Curated overrides take precedence.
 */
function mergeStackBindings(
  docId: string,
  inferred: InferredBindings,
  override: CuratedOverride | undefined,
  provenance: DocProvenance
): DocStackBinding[] {
  const bindings: DocStackBinding[] = [];
  const seenStacks = new Set<string>();

  // Curated stack bindings first
  if (override && override.stackBindings.length > 0) {
    for (const sb of override.stackBindings) {
      if (!seenStacks.has(sb.stack)) {
        seenStacks.add(sb.stack);
        bindings.push({
          stack: sb.stack,
          condition: 'curated: from stackConditionedSpecialists',
        });
        provenance.overridden.push(`stack-binding:${sb.stack}:curated`);
      }
    }
  }

  // Add inferred stack bindings for stacks not covered by overrides
  for (const sb of inferred.stackBindings) {
    if (!seenStacks.has(sb.stack)) {
      seenStacks.add(sb.stack);
      bindings.push(sb);
      provenance.inferred.push(`stack-binding:${sb.stack}:inferred`);
    }
  }

  // Sort by stack name for determinism
  bindings.sort((a, b) => a.stack.localeCompare(b.stack));

  return bindings;
}

/**
 * Merge issue types. Curated override provides the source if available.
 */
function mergeIssueTypes(
  docId: string,
  override: CuratedOverride | undefined,
  provenance: DocProvenance
): string[] {
  if (override && override.issueTypes.length > 0) {
    provenance.overridden.push('issueTypes:curated');
    return [...override.issueTypes];
  }

  // No override — leave empty; issueTypes will be populated by
  // the planner from actual findings during workflow execution
  return [];
}
