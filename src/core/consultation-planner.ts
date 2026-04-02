/**
 * Consultation Planner Engine (Phase 4)
 *
 * Computes deterministic consultation plans from corpus snapshot data.
 * Operates on SecurityDoc[] instead of SpecialistDefinition[].
 * Produces ConsultationPlan with required/optional/followup doc lists.
 */

import type {
  WorkflowId,
  ConsultationPlan,
  ConsultationEntry,
  ConsultationSignals,
  ConsultationConstraints,
  ConsultationSignalType,
  SecurityDoc,
} from './types.js';
import {
  CONSULTATION_PLAN_SCHEMA_VERSION,
  DEFAULT_CONSULTATION_CONSTRAINTS,
} from './types.js';
import type { LoadedSnapshot } from '../corpus/snapshot-loader.js';
import {
  getDocumentsForWorkflow,
  getDocumentsForStack,
  getRelatedDocuments,
} from '../corpus/snapshot-loader.js';
import { normalizeStack } from './stack-normalizer.js';
import { classifyFindings } from './issue-taxonomy.js';

/**
 * Input for consultation plan computation.
 */
export interface ConsultationPlanInput {
  /** Workflow ID to plan for */
  workflowId: WorkflowId;
  /** Loaded corpus snapshot */
  snapshot: LoadedSnapshot;
  /** Detected stack signals (raw, will be normalized internally) */
  detectedStack: string[];
  /** Issue tags from findings/taxonomy (raw categories, will be classified internally) */
  issueTags: string[];
  /** Changed file paths */
  changedFiles: string[];
  /** Optional constraints override */
  constraints?: Partial<ConsultationConstraints>;
  /** Corpus version for stamping */
  corpusVersion: string;
}

/**
 * Score weights for different signal types.
 */
const SCORE_WEIGHTS = {
  WORKFLOW_BINDING_REQUIRED: 10,
  WORKFLOW_BINDING_OPTIONAL: 5,
  STACK_MATCH: 15,
  ISSUE_TAG_MATCH: 20,
  RELATED_DOC: 8,
  FALLBACK_DEFAULT: 3,
} as const;

/**
 * Internal candidate during plan computation.
 */
interface PlanCandidate {
  docId: string;
  docUri: string;
  score: number;
  signalType: ConsultationSignalType;
  reason: string;
  tier: 'required' | 'optional' | 'followup' | 'blocked';
}

/**
 * Compute a deterministic consultation plan from corpus snapshot + signals.
 *
 * Pipeline:
 * 1. Extract and normalize signals
 * 2. Seed required/optional from DocWorkflowBinding priority
 * 3. Expand from stack bindings
 * 4. Expand from issue type matches
 * 5. Expand follow-ups via relatedDocIds
 * 6. Apply constraints (caps, ordering)
 * 7. Handle fallbacks for empty/degraded cases
 * 8. Emit ConsultationPlan
 */
export function computeConsultationPlan(input: ConsultationPlanInput): ConsultationPlan {
  const constraints: ConsultationConstraints = {
    ...DEFAULT_CONSULTATION_CONSTRAINTS,
    ...input.constraints,
  };

  const signals: ConsultationSignals = {
    issueTags: input.issueTags,
    stacks: input.detectedStack,
    changedFiles: input.changedFiles,
  };

  const normalizedStack = normalizeStack(input.detectedStack);
  const issueClassification = classifyFindings(input.issueTags);

  const candidates = new Map<string, PlanCandidate>();

  // Step 2: Seed from workflow bindings
  seedFromWorkflow(input.snapshot, input.workflowId, candidates);

  // Step 3: Expand from stack bindings
  expandFromStack(input.snapshot, normalizedStack.canonical, candidates);

  // Step 4: Expand from issue type matches
  expandFromIssueTags(input.snapshot, issueClassification.tags, candidates);

  // Step 5: Expand follow-ups via relatedDocIds (depth 1)
  expandFollowUps(input.snapshot, candidates, constraints);

  // Step 6: Apply fallback if required is empty
  applyFallback(input.snapshot, input.workflowId, candidates);

  // Step 7: Apply constraints and build entries
  const { required, optional, followup, blocked } = applyConstraints(candidates, constraints);

  return {
    schemaVersion: CONSULTATION_PLAN_SCHEMA_VERSION,
    workflowId: input.workflowId,
    generatedAt: new Date().toISOString(),
    signals,
    required,
    optional,
    followup,
    ...(blocked.length > 0 ? { blocked } : {}),
    constraints,
    corpusVersion: input.corpusVersion,
  };
}

/**
 * Seed candidates from workflow bindings.
 * Docs with priority 'required' → required tier.
 * Docs with priority 'optional' → optional tier.
 */
function seedFromWorkflow(
  snapshot: LoadedSnapshot,
  workflowId: WorkflowId,
  candidates: Map<string, PlanCandidate>,
): void {
  // Seed required
  const requiredDocs = getDocumentsForWorkflow(snapshot, workflowId, 'required');
  for (const doc of requiredDocs) {
    if (!candidates.has(doc.id)) {
      candidates.set(doc.id, {
        docId: doc.id,
        docUri: doc.uri,
        score: SCORE_WEIGHTS.WORKFLOW_BINDING_REQUIRED,
        signalType: 'workflow-binding',
        reason: `Required for ${workflowId} workflow`,
        tier: 'required',
      });
    }
  }

  // Seed optional
  const optionalDocs = getDocumentsForWorkflow(snapshot, workflowId, 'optional');
  for (const doc of optionalDocs) {
    if (!candidates.has(doc.id)) {
      candidates.set(doc.id, {
        docId: doc.id,
        docUri: doc.uri,
        score: SCORE_WEIGHTS.WORKFLOW_BINDING_OPTIONAL,
        signalType: 'workflow-binding',
        reason: `Optional for ${workflowId} workflow`,
        tier: 'optional',
      });
    }
  }
}

/**
 * Expand candidates from stack binding matches.
 */
function expandFromStack(
  snapshot: LoadedSnapshot,
  normalizedStackTags: string[],
  candidates: Map<string, PlanCandidate>,
): void {
  for (const stackTag of normalizedStackTags) {
    const docs = getDocumentsForStack(snapshot, stackTag);
    for (const doc of docs) {
      if (!candidates.has(doc.id)) {
        candidates.set(doc.id, {
          docId: doc.id,
          docUri: doc.uri,
          score: SCORE_WEIGHTS.STACK_MATCH,
          signalType: 'stack-binding',
          reason: `Matches stack: ${stackTag}`,
          tier: 'optional',
        });
      }
    }
  }
}

/**
 * Expand candidates from issue type matches.
 */
function expandFromIssueTags(
  snapshot: LoadedSnapshot,
  classifiedTags: string[],
  candidates: Map<string, PlanCandidate>,
): void {
  if (classifiedTags.length === 0) return;

  for (const doc of snapshot.snapshot.documents) {
    if (candidates.has(doc.id)) continue;
    if (doc.issueTypes.length === 0) continue;

    // Check if any classified tag matches this doc's issue types
    const match = classifiedTags.find(tag =>
      doc.issueTypes.includes(tag)
    );

    if (match) {
      candidates.set(doc.id, {
        docId: doc.id,
        docUri: doc.uri,
        score: SCORE_WEIGHTS.ISSUE_TAG_MATCH,
        signalType: 'issue-tag',
        reason: `Matches issue type: ${match}`,
        tier: 'optional',
      });
    }
  }
}

/**
 * Expand follow-up candidates via relatedDocIds (depth 1).
 * Only expands from required and optional candidates.
 */
function expandFollowUps(
  snapshot: LoadedSnapshot,
  candidates: Map<string, PlanCandidate>,
  constraints: ConsultationConstraints,
): void {
  if (!constraints.allowFollowUpExpansion) return;

  const existingIds = new Set(candidates.keys());
  const followUpEntries: Array<{ parentId: string; relatedDoc: SecurityDoc }> = [];

  // Collect related docs from all required/optional candidates
  for (const [docId, candidate] of candidates) {
    if (candidate.tier !== 'required' && candidate.tier !== 'optional') continue;

    const relatedDocs = getRelatedDocuments(snapshot, docId);
    for (const relatedDoc of relatedDocs) {
      if (!existingIds.has(relatedDoc.id)) {
        followUpEntries.push({ parentId: docId, relatedDoc });
        existingIds.add(relatedDoc.id); // Prevent duplicate expansion
      }
    }
  }

  // Add follow-up candidates
  for (const { parentId, relatedDoc } of followUpEntries) {
    candidates.set(relatedDoc.id, {
      docId: relatedDoc.id,
      docUri: relatedDoc.uri,
      score: SCORE_WEIGHTS.RELATED_DOC,
      signalType: 'related-doc',
      reason: `Related to ${parentId} via corpus snapshot`,
      tier: 'followup',
    });
  }
}

/**
 * Apply fallback when required list is empty after all expansion steps.
 * Falls back to workflow-level required bindings.
 */
function applyFallback(
  snapshot: LoadedSnapshot,
  workflowId: WorkflowId,
  candidates: Map<string, PlanCandidate>,
): void {
  const hasRequired = [...candidates.values()].some(c => c.tier === 'required');
  if (hasRequired) return;

  // Re-seed required from workflow bindings as fallback
  const requiredDocs = getDocumentsForWorkflow(snapshot, workflowId, 'required');
  for (const doc of requiredDocs) {
    const existing = candidates.get(doc.id);
    if (existing) {
      // Upgrade to required if not already
      if (existing.tier !== 'required') {
        existing.tier = 'required';
        existing.signalType = 'fallback-default';
        existing.reason = `Fallback default for ${workflowId} (no issue tags matched)`;
        existing.score = SCORE_WEIGHTS.FALLBACK_DEFAULT;
      }
    } else {
      candidates.set(doc.id, {
        docId: doc.id,
        docUri: doc.uri,
        score: SCORE_WEIGHTS.FALLBACK_DEFAULT,
        signalType: 'fallback-default',
        reason: `Fallback default for ${workflowId} (no issue tags matched)`,
        tier: 'required',
      });
    }
  }
}

/**
 * Apply constraints (caps) and produce final entries with deterministic ordering.
 */
function applyConstraints(
  candidates: Map<string, PlanCandidate>,
  constraints: ConsultationConstraints,
): {
  required: ConsultationEntry[];
  optional: ConsultationEntry[];
  followup: ConsultationEntry[];
  blocked: ConsultationEntry[];
} {
  const byTier = {
    required: [] as PlanCandidate[],
    optional: [] as PlanCandidate[],
    followup: [] as PlanCandidate[],
    blocked: [] as PlanCandidate[],
  };

  for (const candidate of candidates.values()) {
    byTier[candidate.tier].push(candidate);
  }

  // Sort each tier: score desc, then docId asc for determinism
  const sortFn = (a: PlanCandidate, b: PlanCandidate) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.docId.localeCompare(b.docId);
  };

  byTier.required.sort(sortFn);
  byTier.optional.sort(sortFn);
  byTier.followup.sort(sortFn);

  // Apply caps
  byTier.required = byTier.required.slice(0, constraints.maxRequired);
  byTier.optional = byTier.optional.slice(0, constraints.maxOptional);
  byTier.followup = byTier.followup.slice(0, constraints.maxFollowup);

  // Convert to entries with stable order indices
  const toEntry = (c: PlanCandidate, index: number): ConsultationEntry => ({
    docId: c.docId,
    docUri: c.docUri,
    reason: c.reason,
    signalType: c.signalType,
    score: c.score,
    orderIndex: index,
  });

  let orderIndex = 0;
  const required = byTier.required.map(c => toEntry(c, orderIndex++));
  const optional = byTier.optional.map(c => toEntry(c, orderIndex++));
  const followup = byTier.followup.map(c => toEntry(c, orderIndex++));
  const blocked = byTier.blocked.map(c => toEntry(c, orderIndex++));

  return { required, optional, followup, blocked };
}
