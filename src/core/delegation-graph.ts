/**
 * Delegation Graph Builder Module
 *
 * Builds and manages the delegation graph between specialists.
 * Delegation edges are created from canonical intra-OWASP references.
 */

import type {
  DelegationRule,
  SpecialistDefinition,
  WorkflowId,
  OwaspCorpusEntry,
} from './types.js';

/**
 * The complete delegation graph.
 * Maps parent specialist IDs to their delegation rules.
 */
export interface DelegationGraph {
  /** All delegation rules indexed by parent specialist ID */
  rules: Record<string, DelegationRule[]>;
  /** Reverse lookup: child -> parents */
  reverseLookup: Record<string, string[]>;
  /** All specialist IDs in the graph */
  specialistIds: string[];
}

/**
 * Build a delegation graph from specialist definitions.
 * @param specialists - Array of specialist definitions
 * @returns A delegation graph
 */
export function buildDelegationGraph(specialists: SpecialistDefinition[]): DelegationGraph {
  const rules: Record<string, DelegationRule[]> = {};
  const reverseLookup: Record<string, string[]> = {};
  const specialistIds = specialists.map(s => s.id);

  // Initialize reverse lookup
  for (const specialist of specialists) {
    reverseLookup[specialist.id] = [];
  }

  // Build delegation rules from each specialist's delegatesTo
  for (const specialist of specialists) {
    if (!specialist.delegatesTo || specialist.delegatesTo.length === 0) {
      continue;
    }

    const specialistRules: DelegationRule[] = [];

    for (const childId of specialist.delegatesTo) {
      // Only create rules for valid specialists
      if (!specialistIds.includes(childId)) {
        continue;
      }

      const childSpecialist = specialists.find(s => s.id === childId);
      if (!childSpecialist) {
        continue;
      }

      // Create delegation rule
      const rule: DelegationRule = {
        parentSpecialistId: specialist.id,
        childSpecialistId: childId,
        reason: `Referenced in ${specialist.title} cheat sheet`,
        triggerPhrases: generateDelegationTriggers(specialist, childSpecialist),
        triggerTags: childSpecialist.activationRules.flatMap(r => r.triggerTags ?? []),
        workflowContext: undefined,
      };

      specialistRules.push(rule);

      // Update reverse lookup
      reverseLookup[childId].push(specialist.id);
    }

    rules[specialist.id] = specialistRules;
  }

  return { rules, reverseLookup, specialistIds };
}

/**
 * Generate trigger phrases for delegation.
 */
function generateDelegationTriggers(
  parent: SpecialistDefinition,
  child: SpecialistDefinition
): string[] {
  const triggers: string[] = [];

  // Use child's activation phrases
  for (const rule of child.activationRules) {
    triggers.push(...rule.triggerPhrases.slice(0, 5));
  }

  // Add child title variations
  triggers.push(
    `see ${child.title.toLowerCase()}`,
    `refer to ${child.title.toLowerCase()}`,
    `for more information on ${child.title.toLowerCase()}`,
    `consult ${child.title.toLowerCase()}`
  );

  return [...new Set(triggers)].slice(0, 15);
}

/**
 * Get delegation targets for a specialist.
 * @param specialistId - The specialist ID
 * @param graph - The delegation graph
 * @param workflowContext - Optional workflow context to filter rules
 * @returns Array of child specialist IDs to delegate to
 */
export function getDelegationTargets(
  specialistId: string,
  graph: DelegationGraph,
  workflowContext?: WorkflowId
): string[] {
  const rules = graph.rules[specialistId] ?? [];

  if (!workflowContext) {
    return rules.map(r => r.childSpecialistId);
  }

  // Filter by workflow context
  return rules
    .filter(r => !r.workflowContext || r.workflowContext === workflowContext)
    .map(r => r.childSpecialistId);
}

/**
 * Get delegators for a specialist (who delegates to this specialist).
 * @param specialistId - The specialist ID
 * @param graph - The delegation graph
 * @returns Array of parent specialist IDs
 */
export function getDelegators(
  specialistId: string,
  graph: DelegationGraph
): string[] {
  return graph.reverseLookup[specialistId] ?? [];
}

/**
 * Check if a delegation path exists between two specialists.
 * @param from - Parent specialist ID
 * @param to - Child specialist ID
 * @param graph - The delegation graph
 * @returns True if a path exists
 */
export function hasDelegationPath(
  from: string,
  to: string,
  graph: DelegationGraph
): boolean {
  const visited = new Set<string>();
  const queue = [from];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === to) {
      return true;
    }

    if (visited.has(current)) {
      continue;
    }
    visited.add(current);

    const children = getDelegationTargets(current, graph);
    for (const child of children) {
      if (!visited.has(child)) {
        queue.push(child);
      }
    }
  }

  return false;
}

/**
 * Find the shortest delegation path between two specialists.
 * @param from - Parent specialist ID
 * @param to - Child specialist ID
 * @param graph - The delegation graph
 * @returns Array of specialist IDs representing the path, or empty if no path
 */
export function findDelegationPath(
  from: string,
  to: string,
  graph: DelegationGraph
): string[] {
  const visited = new Set<string>();
  const parent = new Map<string, string>();
  const queue = [from];

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current === to) {
      // Reconstruct path
      const path: string[] = [to];
      let node = to;
      while (parent.has(node)) {
        node = parent.get(node)!;
        path.unshift(node);
      }
      return path;
    }

    if (visited.has(current)) {
      continue;
    }
    visited.add(current);

    const children = getDelegationTargets(current, graph);
    for (const child of children) {
      if (!visited.has(child) && !parent.has(child)) {
        parent.set(child, current);
        queue.push(child);
      }
    }
  }

  return [];
}

/**
 * Get delegation chains starting from a specialist.
 * @param specialistId - The specialist ID
 * @param graph - The delegation graph
 * @param maxLength - Maximum chain length
 * @returns Array of delegation chains
 */
export function getDelegationChains(
  specialistId: string,
  graph: DelegationGraph,
  maxLength: number = 5
): string[][] {
  const chains: string[][] = [];

  function traverse(current: string, path: string[], visited: Set<string>) {
    if (path.length > maxLength) {
      return;
    }

    const chains: string[][] = [];
    const children = getDelegationTargets(current, graph);

    if (children.length === 0) {
      chains.push([...path]);
      return;
    }

    for (const child of children) {
      if (!visited.has(child)) {
        visited.add(child);
        traverse(child, [...path, child], visited);
        visited.delete(child);
      }
    }
  }

  traverse(specialistId, [specialistId], new Set([specialistId]));
  return chains;
}

/**
 * Export the delegation graph as a DOT format graph visualization.
 * @param graph - The delegation graph
 * @param specialists - Specialist definitions for labels
 * @returns DOT format string
 */
export function exportToDot(
  graph: DelegationGraph,
  specialists: SpecialistDefinition[]
): string {
  const lines: string[] = [
    'digraph OWASPSpecialistDelegation {',
    '  rankdir=TB;',
    '  node [shape=box, style=rounded];',
    '',
  ];

  // Add nodes
  for (const specialist of specialists) {
    const label = specialist.title.replace(/"/g, '\\"');
    lines.push(`  "${specialist.id}" [label="${label}"];`);
  }

  lines.push('');

  // Add edges
  for (const [parentId, rules] of Object.entries(graph.rules)) {
    for (const rule of rules) {
      const label = rule.reason.replace(/"/g, '\\"').slice(0, 30);
      lines.push(`  "${parentId}" -> "${rule.childSpecialistId}" [label="${label}"];`);
    }
  }

  lines.push('}');
  return lines.join('\n');
}

/**
 * Validate the delegation graph for cycles.
 * @param graph - The delegation graph
 * @returns Array of cycle paths (empty if no cycles)
 */
export function detectCycles(graph: DelegationGraph): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recStack = new Set<string>();
  const path: string[] = [];

  function dfs(node: string): boolean {
    visited.add(node);
    recStack.add(node);
    path.push(node);

    const children = getDelegationTargets(node, graph);
    for (const child of children) {
      if (!visited.has(child)) {
        if (dfs(child)) {
          return true;
        }
      } else if (recStack.has(child)) {
        // Found a cycle - extract it
        const cycleStart = path.indexOf(child);
        cycles.push([...path.slice(cycleStart), child]);
        return true;
      }
    }

    path.pop();
    recStack.delete(node);
    return false;
  }

  for (const nodeId of graph.specialistIds) {
    if (!visited.has(nodeId)) {
      dfs(nodeId);
    }
  }

  return cycles;
}

/**
 * Get specialists that should be consulted for a given finding.
 * @param issueType - The type of issue detected
 * @param stack - The detected tech stack
 * @param workflowId - The current workflow
 * @param specialists - All specialist definitions
 * @param graph - The delegation graph
 * @returns Array of specialist IDs to consult, in order
 */
export function getSpecialistsForFinding(
  issueType: string,
  stack: string[],
  workflowId: WorkflowId,
  specialists: SpecialistDefinition[],
  graph: DelegationGraph
): string[] {
  const relevant: Array<{ specialistId: string; score: number }> = [];

  for (const specialist of specialists) {
    let score = 0;

    // Check workflow binding
    if (specialist.primaryWorkflowIds.includes(workflowId)) {
      score += 10;
    }

    // Check activation rules
    for (const rule of specialist.activationRules) {
      // Workflow-step rule
      if (rule.type === 'workflow-step' && rule.workflowContext === workflowId) {
        score += 5;
      }

      // Issue-type rule
      if (rule.type === 'issue-type' && rule.triggerTags?.includes(issueType)) {
        score += 20;
      }

      // Check trigger phrases against issue type
      for (const phrase of rule.triggerPhrases) {
        if (phrase.includes(issueType) || issueType.includes(phrase)) {
          score += 15;
          break;
        }
      }

      // Stack-condition rule
      if (rule.type === 'stack-condition') {
        for (const stackItem of stack) {
          if (rule.triggerTags?.includes(stackItem.toLowerCase()) ||
              rule.triggerPhrases.some(p => p.includes(stackItem.toLowerCase()))) {
            score += 25;
            break;
          }
        }
      }
    }

    if (score > 0) {
      relevant.push({ specialistId: specialist.id, score });
    }
  }

  // Sort by score descending
  relevant.sort((a, b) => b.score - a.score);

  return relevant.map(r => r.specialistId);
}

/**
 * Get all specialists with no delegates (leaf nodes).
 * @param graph - The delegation graph
 * @returns Array of leaf specialist IDs
 */
export function getLeafSpecialists(graph: DelegationGraph): string[] {
  return graph.specialistIds.filter(id =>
    !graph.rules[id] || graph.rules[id].length === 0
  );
}

/**
 * Get all specialists with no delegators (root nodes).
 * @param graph - The delegation graph
 * @returns Array of root specialist IDs
 */
export function getRootSpecialists(graph: DelegationGraph): string[] {
  const allDelegated = new Set<string>();
  for (const children of Object.values(graph.rules)) {
    for (const rule of children) {
      allDelegated.add(rule.childSpecialistId);
    }
  }

  return graph.specialistIds.filter(id => !allDelegated.has(id));
}
