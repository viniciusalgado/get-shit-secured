/**
 * Delegation Planner Engine
 *
 * Computes deterministic delegation plans for workflow runs.
 * Takes workflow artifacts, stack signals, issue taxonomy, and
 * specialist bindings as input, produces a byte-stable DelegationPlan.
 */

import type {
  WorkflowId,
  DelegationPlan,
  DelegationPlanEntry,
  DelegationSubject,
  DelegationSubjectType,
  DelegationCandidate,
  DelegationReason,
  DelegationConstraints,
  DelegationRequirement,
  SpecialistDefinition,
  DelegationPolicy,
  DELEGATION_PLAN_SCHEMA_VERSION,
} from './types.js';
import { DEFAULT_DELEGATION_CONSTRAINTS, DELEGATION_PLAN_SCHEMA_VERSION as SCHEMA_V1 } from './types.js';
import type { DelegationGraph } from './delegation-graph.js';
import { getDelegationTargets } from './delegation-graph.js';
import { normalizeStack } from './stack-normalizer.js';
import type { NormalizedStack } from './stack-normalizer.js';
import { classifyFindings, type IssueTag } from './issue-taxonomy.js';

/**
 * Input signals for plan computation.
 */
export interface DelegationPlanInput {
  /** Workflow ID to plan for */
  workflowId: WorkflowId;
  /** Workflow delegation policy */
  policy: DelegationPolicy;
  /** Primary specialist IDs from workflow bindings */
  primarySpecialists: string[];
  /** Optional specialist IDs from workflow bindings */
  optionalSpecialists: string[];
  /** Stack-conditioned specialist bindings */
  stackConditionedSpecialists: Array<{
    stack: string | string[];
    specialists: string[];
  }>;
  /** Detected stack signals */
  detectedStack: string[];
  /** Issue tags from findings/patches/verification */
  issueTags: string[];
  /** Changed file paths (for file-path matching) */
  changedFiles: string[];
  /** Available specialist definitions */
  specialists: SpecialistDefinition[];
  /** Delegation graph */
  graph: DelegationGraph;
  /** Source artifact references */
  sourceArtifactRefs: string[];
}

/**
 * Requirement class ordering for deterministic sorting.
 * Lower number = higher priority.
 */
const REQUIREMENT_ORDER: Record<DelegationRequirement, number> = {
  'required': 0,
  'optional': 1,
  'derived-follow-up': 2,
  'excluded': 3,
};

/**
 * Score weights for different signal types.
 */
const SCORE_WEIGHTS = {
  WORKFLOW_BINDING: 5,
  ISSUE_TAG_MATCH: 20,
  STACK_MATCH: 15,
  TRIGGER_PHRASE: 10,
  ACTIVATION_RULE: 8,
} as const;

/**
 * Compute a deterministic delegation plan from input signals.
 *
 * The pipeline:
 * 1. Collect delegation subjects from input signals
 * 2. Normalize stack and issue signals
 * 3. Seed candidates from workflow bindings
 * 4. Score candidates using all available signals
 * 5. Classify candidates into requirement classes
 * 6. Expand one bounded round of follow-up specialists
 * 7. Apply deterministic ordering
 * 8. Emit final DelegationPlan
 *
 * @param input - All input signals for plan computation
 * @returns A deterministic delegation plan
 */
export function computeDelegationPlan(input: DelegationPlanInput): DelegationPlan {
  const constraints = {
    ...DEFAULT_DELEGATION_CONSTRAINTS,
    ...input.policy.constraints,
  };

  // Step 1: Collect subjects
  const subjects = collectSubjects(input);

  // Step 2: Normalize signals
  const normalizedStack = normalizeStack(input.detectedStack);
  const issueClassification = classifyFindings(input.issueTags);

  // Step 3 & 4: Seed and score candidates
  const candidates = scoreCandidates(input, normalizedStack, issueClassification, subjects);

  // Step 5: Classify and cap
  const classified = classifyCandidates(candidates, constraints);

  // Step 6: Expand follow-ups
  const withFollowUps = expandFollowUps(classified, input.graph, constraints);

  // Step 7: Deterministic ordering and dedupe
  const entries = finalizeEntries(withFollowUps, constraints);

  return {
    schemaVersion: SCHEMA_V1,
    workflowId: input.workflowId,
    generatedAt: new Date().toISOString(),
    subjects,
    entries,
    constraints,
    sourceArtifactRefs: input.sourceArtifactRefs,
  };
}

/**
 * Collect delegation subjects from input signals.
 */
function collectSubjects(input: DelegationPlanInput): DelegationSubject[] {
  const subjects: DelegationSubject[] = [];
  let subjectIndex = 0;

  // Workflow-level subject always present
  subjects.push({
    id: `${input.workflowId}-workflow`,
    type: 'workflow',
    description: `Workflow-level delegation for ${input.workflowId}`,
    sourceArtifact: input.sourceArtifactRefs[0] || 'runtime',
    sourceSignals: [],
  });
  subjectIndex++;

  // Issue-based subjects from findings
  for (const tag of input.issueTags) {
    subjects.push({
      id: `${input.workflowId}-issue-${subjectIndex}`,
      type: 'finding',
      description: `Finding: ${tag}`,
      sourceArtifact: input.sourceArtifactRefs[0] || 'findings',
      sourceSignals: [tag],
    });
    subjectIndex++;
  }

  // File-based subjects
  for (const filePath of input.changedFiles.slice(0, 20)) {
    subjects.push({
      id: `${input.workflowId}-file-${subjectIndex}`,
      type: 'patch',
      description: `File: ${filePath}`,
      sourceArtifact: input.sourceArtifactRefs[0] || 'patches',
      sourceSignals: [filePath],
    });
    subjectIndex++;
  }

  return subjects;
}

/**
 * Score all candidate specialists against all subjects.
 */
function scoreCandidates(
  input: DelegationPlanInput,
  normalizedStack: NormalizedStack,
  issueClassification: { tags: IssueTag[] },
  subjects: DelegationSubject[],
): DelegationCandidate[] {
  const candidates: DelegationCandidate[] = [];
  const workflowSubject = subjects[0]; // First subject is always workflow-level

  // Build specialist lookup for scoring
  const specialistMap = new Map<string, SpecialistDefinition>();
  for (const s of input.specialists) {
    specialistMap.set(s.id, s);
  }

  // All specialist IDs that are candidates
  const candidateIds = new Set<string>();

  // Seed from primary bindings → required
  for (const id of input.primarySpecialists) {
    candidateIds.add(id);
  }

  // Seed from optional bindings → optional
  for (const id of input.optionalSpecialists) {
    candidateIds.add(id);
  }

  // Seed from stack-conditioned → conditional
  for (const condition of input.stackConditionedSpecialists) {
    const stacks = Array.isArray(condition.stack) ? condition.stack : [condition.stack];
    for (const stackTag of normalizedStack.canonical) {
      if (stacks.some(s => s.toLowerCase() === stackTag.toLowerCase())) {
        for (const specialistId of condition.specialists) {
          candidateIds.add(specialistId);
        }
      }
    }
  }

  // Also check specialists' activation rules for issue-tag/stack matches
  for (const specialist of input.specialists) {
    if (!candidateIds.has(specialist.id)) {
      // Check if any activation rule matches
      for (const rule of specialist.activationRules) {
        if (rule.type === 'issue-type') {
          for (const tag of issueClassification.tags) {
            if (rule.triggerTags?.includes(tag)) {
              candidateIds.add(specialist.id);
              break;
            }
          }
        }
        if (rule.type === 'stack-condition') {
          for (const stackTag of normalizedStack.canonical) {
            if (rule.triggerTags?.includes(stackTag.toLowerCase())) {
              candidateIds.add(specialist.id);
              break;
            }
          }
        }
      }
    }
  }

  // Score each candidate against the workflow subject
  for (const specialistId of candidateIds) {
    const specialist = specialistMap.get(specialistId);
    const reasons: DelegationReason[] = [];
    let totalScore = 0;

    // Workflow binding score
    if (input.primarySpecialists.includes(specialistId)) {
      reasons.push({
        signalType: 'workflow-binding',
        signalValue: 'primary',
        score: SCORE_WEIGHTS.WORKFLOW_BINDING,
        description: `${specialistId} is a primary specialist for ${input.workflowId}`,
      });
      totalScore += SCORE_WEIGHTS.WORKFLOW_BINDING;
    } else if (input.optionalSpecialists.includes(specialistId)) {
      reasons.push({
        signalType: 'workflow-binding',
        signalValue: 'optional',
        score: SCORE_WEIGHTS.WORKFLOW_BINDING / 2,
        description: `${specialistId} is an optional specialist for ${input.workflowId}`,
      });
      totalScore += SCORE_WEIGHTS.WORKFLOW_BINDING / 2;
    }

    // Issue tag score
    if (specialist) {
      for (const rule of specialist.activationRules) {
        if (rule.type === 'issue-type') {
          for (const tag of issueClassification.tags) {
            if (rule.triggerTags?.includes(tag)) {
              reasons.push({
                signalType: 'issue-tag',
                signalValue: tag,
                score: SCORE_WEIGHTS.ISSUE_TAG_MATCH,
                description: `${specialistId} matches issue tag: ${tag}`,
              });
              totalScore += SCORE_WEIGHTS.ISSUE_TAG_MATCH;
              break; // One match per rule
            }
          }
        }
      }

      // Stack match score
      for (const rule of specialist.activationRules) {
        if (rule.type === 'stack-condition') {
          for (const stackTag of normalizedStack.canonical) {
            if (rule.triggerTags?.includes(stackTag.toLowerCase()) ||
                rule.triggerPhrases.some(p => p.includes(stackTag.toLowerCase()))) {
              reasons.push({
                signalType: 'stack-condition',
                signalValue: stackTag,
                score: SCORE_WEIGHTS.STACK_MATCH,
                description: `${specialistId} matches stack: ${stackTag}`,
              });
              totalScore += SCORE_WEIGHTS.STACK_MATCH;
              break;
            }
          }
        }
      }

      // Trigger phrase score
      for (const rule of specialist.activationRules) {
        for (const phrase of rule.triggerPhrases) {
          for (const tag of input.issueTags) {
            if (phrase.includes(tag.toLowerCase()) || tag.toLowerCase().includes(phrase)) {
              reasons.push({
                signalType: 'trigger-phrase',
                signalValue: phrase,
                score: SCORE_WEIGHTS.TRIGGER_PHRASE,
                description: `${specialistId} trigger phrase matches: ${phrase}`,
              });
              totalScore += SCORE_WEIGHTS.TRIGGER_PHRASE;
              break;
            }
          }
        }
      }
    }

    // Determine initial requirement class
    let requirement: DelegationRequirement;
    if (input.primarySpecialists.includes(specialistId)) {
      requirement = 'required';
    } else if (input.optionalSpecialists.includes(specialistId)) {
      requirement = 'optional';
    } else {
      requirement = 'optional'; // Stack-conditioned and issue-tag-matched default to optional
    }

    // Stack-conditioned specialists found via stack matching become required
    for (const condition of input.stackConditionedSpecialists) {
      if (condition.specialists.includes(specialistId)) {
        requirement = 'required';
        break;
      }
    }

    candidates.push({
      specialistId,
      subjectId: workflowSubject.id,
      score: totalScore,
      reasons,
      requirement,
    });
  }

  return candidates;
}

/**
 * Classify candidates into requirement tiers and apply caps.
 */
function classifyCandidates(
  candidates: DelegationCandidate[],
  constraints: DelegationConstraints,
): DelegationCandidate[] {
  // Group by subject
  const bySubject = new Map<string, DelegationCandidate[]>();
  for (const c of candidates) {
    const list = bySubject.get(c.subjectId) || [];
    list.push(c);
    bySubject.set(c.subjectId, list);
  }

  const result: DelegationCandidate[] = [];

  for (const [subjectId, subjectCandidates] of bySubject) {
    // Sort within subject: score desc, then specialistId asc for determinism
    const sorted = [...subjectCandidates].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.specialistId.localeCompare(b.specialistId);
    });

    let requiredCount = 0;
    let optionalCount = 0;

    for (const candidate of sorted) {
      if (candidate.requirement === 'required' && requiredCount < constraints.maxRequiredPerSubject) {
        requiredCount++;
        result.push(candidate);
      } else if (candidate.requirement === 'optional' && optionalCount < constraints.maxOptionalPerSubject) {
        optionalCount++;
        result.push(candidate);
      } else if (candidate.requirement === 'required') {
        // Exceeded cap, downgrade to excluded
        result.push({ ...candidate, requirement: 'excluded' });
      } else {
        result.push({ ...candidate, requirement: 'excluded' });
      }
    }
  }

  return result;
}

/**
 * Expand one bounded round of follow-up specialists via delegation graph.
 */
function expandFollowUps(
  candidates: DelegationCandidate[],
  graph: DelegationGraph,
  constraints: DelegationConstraints,
): DelegationCandidate[] {
  if (!constraints.allowFollowUpSpecialists || constraints.maxFollowUpDepth < 1) {
    return candidates;
  }

  const existingSpecialistIds = new Set(candidates.map(c => c.specialistId));
  const followUps: DelegationCandidate[] = [];

  // For each required/optional candidate, check if they have delegation targets
  for (const candidate of candidates) {
    if (candidate.requirement === 'excluded') continue;

    const targets = getDelegationTargets(candidate.specialistId, graph);
    for (const targetId of targets) {
      if (existingSpecialistIds.has(targetId)) continue;

      followUps.push({
        specialistId: targetId,
        subjectId: candidate.subjectId,
        score: candidate.score * 0.5, // Follow-ups get half the parent score
        reasons: [{
          signalType: 'delegation-edge',
          signalValue: candidate.specialistId,
          score: candidate.score * 0.5,
          description: `${targetId} is a follow-up from ${candidate.specialistId} via delegation graph`,
        }],
        requirement: 'derived-follow-up',
      });

      existingSpecialistIds.add(targetId);
    }
  }

  return [...candidates, ...followUps];
}

/**
 * Apply deterministic ordering and convert to plan entries.
 */
function finalizeEntries(
  candidates: DelegationCandidate[],
  constraints: DelegationConstraints,
): DelegationPlanEntry[] {
  // Filter out excluded
  const active = candidates.filter(c => c.requirement !== 'excluded');

  // Deterministic sort: requirement class, then score desc, then specialistId asc
  const sorted = [...active].sort((a, b) => {
    const reqOrder = REQUIREMENT_ORDER[a.requirement] - REQUIREMENT_ORDER[b.requirement];
    if (reqOrder !== 0) return reqOrder;
    if (b.score !== a.score) return b.score - a.score;
    return a.specialistId.localeCompare(b.specialistId);
  });

  // Dedupe by specialistId (keep highest priority entry)
  const seen = new Set<string>();
  const deduped: DelegationCandidate[] = [];
  for (const candidate of sorted) {
    const key = `${candidate.specialistId}::${candidate.subjectId}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(candidate);
    }
  }

  // Convert to plan entries with stable order index
  return deduped.map((candidate, index) => ({
    specialistId: candidate.specialistId,
    subjectId: candidate.subjectId,
    requirement: candidate.requirement,
    score: candidate.score,
    reasons: candidate.reasons,
    orderIndex: index,
  }));
}
