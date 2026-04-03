/**
 * Legacy Specialist Pipeline — Compatibility Facade
 *
 * This module is the single import point for legacy specialist
 * generation code. All consumers of specialist generation should
 * import from here rather than from individual modules.
 *
 * @deprecated The entire legacy specialist pipeline is deprecated.
 * Removal target: Release C.
 *
 * Active replacement: MCP consultation pipeline
 *   - Planning: src/core/consultation-planner.ts
 *   - Compliance: src/core/consultation-compliance.ts
 *   - Corpus: src/corpus/snapshot-loader.ts
 */

export {
  generateAllSpecialists,
  generateSpecialist,
  getSpecialistById,
  getSpecialistsByWorkflow,
  getSpecialistsByStack,
} from '../core/specialist-generator.js';

export {
  computeDelegationPlan,
  type DelegationPlanInput,
} from '../core/delegation-planner.js';

export {
  validateCompliance,
} from '../core/delegation-compliance.js';

export {
  buildDelegationGraph,
  getDelegationTargets,
  type DelegationGraph,
} from '../core/delegation-graph.js';
