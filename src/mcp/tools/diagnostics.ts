/**
 * Diagnostic tools: list_supported_workflows, list_supported_stacks
 *
 * Used by installers and smoke tests to verify the corpus is loaded correctly.
 */

import type { CorpusDiagnostics } from '../diagnostics.js';

/**
 * Input for diagnostic tools (no required fields).
 */
export interface DiagnosticsToolInput {
  // No inputs required
}

/**
 * List workflows that have at least one required doc in the corpus.
 */
export function handleListWorkflows(diag: CorpusDiagnostics): {
  workflows: string[];
  corpusVersion: string;
} {
  return {
    workflows: diag.supportedWorkflows,
    corpusVersion: diag.corpusVersion,
  };
}

/**
 * List all stack tags present in the corpus.
 */
export function handleListStacks(diag: CorpusDiagnostics): {
  stacks: string[];
  corpusVersion: string;
} {
  return {
    stacks: diag.supportedStacks,
    corpusVersion: diag.corpusVersion,
  };
}
