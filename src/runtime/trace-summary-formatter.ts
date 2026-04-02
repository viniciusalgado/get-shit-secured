/**
 * Trace summary formatter.
 *
 * Produces human-readable summaries from ConsultationTrace objects.
 * Used by workflow prompts, gss doctor, and report aggregation.
 *
 * @module runtime/trace-summary-formatter
 */

import type { ConsultationTrace } from '../core/types.js';

/**
 * Format a consultation trace as a multi-line human-readable summary.
 *
 * Output format:
 * ```
 * Required docs consulted: 3/3
 * Optional docs consulted: 1/2
 * Follow-up docs consulted: 0/1
 * Missing required docs: none (or list)
 * Coverage status: pass
 * ```
 *
 * @param trace - The consultation trace to format
 * @returns Multi-line summary string
 */
export function formatTraceSummary(trace: ConsultationTrace): string {
  const lines: string[] = [];

  const requiredTotal = trace.plan.requiredCount;
  const optionalTotal = trace.plan.optionalCount;
  const followupTotal = trace.plan.followupCount;

  const consultedCount = trace.consultedDocs.length;
  const requiredConsulted = requiredTotal - trace.requiredMissing.length;
  // Estimate optional/followup consulted from remaining
  const optionalOrFollowupConsulted = Math.max(0, consultedCount - requiredConsulted);

  lines.push(`Required docs consulted: ${requiredConsulted}/${requiredTotal}`);
  lines.push(`Optional docs consulted: ${optionalOrFollowupConsulted}/${optionalTotal + followupTotal}`);
  lines.push(
    `Missing required docs: ${trace.requiredMissing.length === 0 ? 'none' : trace.requiredMissing.join(', ')}`
  );
  lines.push(`Coverage status: ${trace.coverageStatus}`);

  if (trace.notes.length > 0) {
    lines.push(`Notes: ${trace.notes.join('; ')}`);
  }

  return lines.join('\n');
}

/**
 * Format a consultation trace as a compact single-line summary.
 *
 * Output format: `"Coverage: pass (3/3 required, 1/2 optional)"`
 *
 * @param trace - The consultation trace to format
 * @returns Single-line summary string
 */
export function formatTraceOneLiner(trace: ConsultationTrace): string {
  const requiredConsulted = trace.plan.requiredCount - trace.requiredMissing.length;
  return `Coverage: ${trace.coverageStatus} (${requiredConsulted}/${trace.plan.requiredCount} required, ${trace.consultedDocs.length - requiredConsulted}/${trace.plan.optionalCount + trace.plan.followupCount} optional)`;
}
