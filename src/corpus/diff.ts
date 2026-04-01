/**
 * Corpus Diff Tool
 *
 * Compares two corpus snapshots and reports binding coverage changes.
 * Used to verify no regression in binding coverage during migration.
 */

import type { CorpusSnapshot, SecurityDoc, WorkflowId } from '../core/types.js';

/**
 * Binding change types.
 */
type ChangeType = 'added' | 'removed' | 'changed' | 'unchanged';

/**
 * A single binding diff entry.
 */
export interface BindingDiff {
  /** Document ID */
  docId: string;
  /** Workflow ID */
  workflowId: WorkflowId;
  /** Change type */
  change: ChangeType;
  /** Priority in the old snapshot (if existed) */
  oldPriority?: string;
  /** Priority in the new snapshot (if exists) */
  newPriority?: string;
}

/**
 * Workflow coverage summary.
 */
export interface WorkflowCoverageDiff {
  /** Workflow ID */
  workflowId: WorkflowId;
  /** Required docs in old snapshot */
  oldRequired: number;
  /** Required docs in new snapshot */
  newRequired: number;
  /** Optional docs in old snapshot */
  oldOptional: number;
  /** Optional docs in new snapshot */
  newOptional: number;
  /** Change in total coverage */
  delta: number;
}

/**
 * Result of diffing two snapshots.
 */
export interface SnapshotDiffResult {
  /** Total binding diffs */
  bindingDiffs: BindingDiff[];
  /** Per-workflow coverage changes */
  workflowCoverage: WorkflowCoverageDiff[];
  /** Summary statistics */
  summary: {
    totalDocsOld: number;
    totalDocsNew: number;
    docsAdded: number;
    docsRemoved: number;
    bindingsAdded: number;
    bindingsRemoved: number;
    bindingsChanged: number;
  };
}

/**
 * Compare two corpus snapshots and produce a diff report.
 *
 * @param oldSnapshot - The baseline snapshot
 * @param newSnapshot - The new snapshot to compare
 * @returns Diff result with binding changes and coverage deltas
 */
export function diffSnapshots(
  oldSnapshot: CorpusSnapshot,
  newSnapshot: CorpusSnapshot
): SnapshotDiffResult {
  // Build lookup maps
  const oldDocs = new Map<string, SecurityDoc>();
  for (const doc of oldSnapshot.documents) {
    oldDocs.set(doc.id, doc);
  }

  const newDocs = new Map<string, SecurityDoc>();
  for (const doc of newSnapshot.documents) {
    newDocs.set(doc.id, doc);
  }

  // Compute doc-level changes
  const oldIds = new Set(oldDocs.keys());
  const newIds = new Set(newDocs.keys());
  const docsAdded = [...newIds].filter(id => !oldIds.has(id)).length;
  const docsRemoved = [...oldIds].filter(id => !newIds.has(id)).length;

  // Compute binding diffs
  const bindingDiffs: BindingDiff[] = [];
  let bindingsAdded = 0;
  let bindingsRemoved = 0;
  let bindingsChanged = 0;

  // Check all docs that exist in either snapshot
  const allDocIds = new Set([...oldIds, ...newIds]);

  for (const docId of allDocIds) {
    const oldDoc = oldDocs.get(docId);
    const newDoc = newDocs.get(docId);

    // Old bindings for this doc
    const oldBindings = new Map<string, string>();
    if (oldDoc) {
      for (const wb of oldDoc.workflowBindings) {
        oldBindings.set(wb.workflowId, wb.priority);
      }
    }

    // New bindings for this doc
    const newBindings = new Map<string, string>();
    if (newDoc) {
      for (const wb of newDoc.workflowBindings) {
        newBindings.set(wb.workflowId, wb.priority);
      }
    }

    // Find changes
    const allWorkflows = new Set([...oldBindings.keys(), ...newBindings.keys()]);

    for (const workflowId of allWorkflows) {
      const oldPriority = oldBindings.get(workflowId);
      const newPriority = newBindings.get(workflowId);

      if (!oldPriority && newPriority) {
        bindingDiffs.push({
          docId,
          workflowId: workflowId as WorkflowId,
          change: 'added',
          newPriority,
        });
        bindingsAdded++;
      } else if (oldPriority && !newPriority) {
        bindingDiffs.push({
          docId,
          workflowId: workflowId as WorkflowId,
          change: 'removed',
          oldPriority,
        });
        bindingsRemoved++;
      } else if (oldPriority !== newPriority) {
        bindingDiffs.push({
          docId,
          workflowId: workflowId as WorkflowId,
          change: 'changed',
          oldPriority,
          newPriority,
        });
        bindingsChanged++;
      }
    }
  }

  // Compute per-workflow coverage
  const workflowIds: WorkflowId[] = [
    'security-review', 'map-codebase', 'threat-model', 'audit',
    'validate-findings', 'plan-remediation', 'execute-remediation',
    'verify', 'report',
  ];

  const workflowCoverage: WorkflowCoverageDiff[] = workflowIds.map(wfId => {
    const oldRequired = oldSnapshot.documents.filter(d =>
      d.workflowBindings.some(b => b.workflowId === wfId && b.priority === 'required')
    ).length;
    const oldOptional = oldSnapshot.documents.filter(d =>
      d.workflowBindings.some(b => b.workflowId === wfId && b.priority === 'optional')
    ).length;
    const newRequired = newSnapshot.documents.filter(d =>
      d.workflowBindings.some(b => b.workflowId === wfId && b.priority === 'required')
    ).length;
    const newOptional = newSnapshot.documents.filter(d =>
      d.workflowBindings.some(b => b.workflowId === wfId && b.priority === 'optional')
    ).length;

    return {
      workflowId: wfId,
      oldRequired,
      newRequired,
      oldOptional,
      newOptional,
      delta: (newRequired + newOptional) - (oldRequired + oldOptional),
    };
  });

  return {
    bindingDiffs,
    workflowCoverage,
    summary: {
      totalDocsOld: oldSnapshot.documents.length,
      totalDocsNew: newSnapshot.documents.length,
      docsAdded,
      docsRemoved,
      bindingsAdded,
      bindingsRemoved,
      bindingsChanged,
    },
  };
}

/**
 * Format a diff result as a human-readable report.
 *
 * @param diff - Diff result
 * @returns Formatted report string
 */
export function formatDiffReport(diff: SnapshotDiffResult): string {
  const lines: string[] = [];

  lines.push('=== Corpus Snapshot Diff Report ===');
  lines.push('');
  lines.push(`Documents: ${diff.summary.totalDocsOld} → ${diff.summary.totalDocsNew} (${diff.summary.docsAdded} added, ${diff.summary.docsRemoved} removed)`);
  lines.push(`Bindings: +${diff.summary.bindingsAdded} / -${diff.summary.bindingsRemoved} / ~${diff.summary.bindingsChanged} changed`);
  lines.push('');

  // Per-workflow coverage
  lines.push('--- Workflow Coverage ---');
  for (const wc of diff.workflowCoverage) {
    const delta = wc.delta >= 0 ? `+${wc.delta}` : `${wc.delta}`;
    lines.push(`  ${wc.workflowId}: ${wc.oldRequired}R/${wc.oldOptional}O → ${wc.newRequired}R/${wc.newOptional}O (${delta})`);
  }
  lines.push('');

  // Notable changes (removed bindings are most important)
  const removed = diff.bindingDiffs.filter(d => d.change === 'removed');
  if (removed.length > 0) {
    lines.push('--- Removed Bindings (potential regression) ---');
    for (const r of removed) {
      lines.push(`  ✗ ${r.docId} ← ${r.workflowId} (${r.oldPriority})`);
    }
    lines.push('');
  }

  const added = diff.bindingDiffs.filter(d => d.change === 'added');
  if (added.length > 0) {
    lines.push('--- Added Bindings ---');
    for (const a of added.slice(0, 50)) {
      lines.push(`  + ${a.docId} ← ${a.workflowId} (${a.newPriority})`);
    }
    if (added.length > 50) {
      lines.push(`  ... and ${added.length - 50} more`);
    }
  }

  return lines.join('\n');
}
