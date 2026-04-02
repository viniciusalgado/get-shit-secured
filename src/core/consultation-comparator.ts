/**
 * Consultation comparator — compares two consultation traces and produces
 * a structured comparison report.
 *
 * Phase 11 — Workstream B: Dual-run comparison strategy.
 *
 * This is a pure function module with no I/O. It operates on ConsultationTrace
 * objects loaded from artifacts and produces ConsultationComparison results.
 */

import type { ConsultationTrace, ConsultationComparison, WorkflowId } from './types.js';

/**
 * Compare two consultation traces and produce a structured report.
 *
 * @param mcpTrace - Consultation trace from the MCP-backed path
 * @param legacyTrace - Consultation trace from the legacy specialist path
 * @returns A ConsultationComparison with set analysis and assessment
 */
export function compareConsultationTraces(
  mcpTrace: ConsultationTrace,
  legacyTrace: ConsultationTrace
): ConsultationComparison {
  const mcpDocIds = new Set(mcpTrace.consultedDocs.map(d => d.id));
  const legacyDocIds = new Set(legacyTrace.consultedDocs.map(d => d.id));

  // Compute set differences
  const mcpOnly = [...mcpDocIds].filter(id => !legacyDocIds.has(id));
  const legacyOnly = [...legacyDocIds].filter(id => !mcpDocIds.has(id));
  const common = [...mcpDocIds].filter(id => legacyDocIds.has(id));

  // Compute coverage for each path
  const mcpRequiredTotal = mcpTrace.plan.requiredCount;
  const legacyRequiredTotal = legacyTrace.plan.requiredCount;
  const mcpRequiredMissing = mcpTrace.requiredMissing.length;
  const legacyRequiredMissing = legacyTrace.requiredMissing.length;

  const mcpRequiredCoverage = mcpRequiredTotal > 0
    ? Math.max(0, (mcpRequiredTotal - mcpRequiredMissing) / mcpRequiredTotal)
    : 1;
  const legacyRequiredCoverage = legacyRequiredTotal > 0
    ? Math.max(0, (legacyRequiredTotal - legacyRequiredMissing) / legacyRequiredTotal)
    : 1;

  const coverageDelta = mcpRequiredCoverage - legacyRequiredCoverage;

  // Assessment: within 5% tolerance is "equivalent"
  const TOLERANCE = 0.05;
  let assessment: ConsultationComparison['assessment'];
  if (coverageDelta > TOLERANCE) {
    assessment = 'mcp-superior';
  } else if (coverageDelta < -TOLERANCE) {
    assessment = 'mcp-inferior';
  } else {
    assessment = 'equivalent';
  }

  return {
    schemaVersion: 1,
    workflowId: mcpTrace.plan.workflowId as WorkflowId,
    comparedAt: new Date().toISOString(),
    mcpDocs: [...mcpDocIds],
    legacyDocs: [...legacyDocIds],
    mcpOnly,
    legacyOnly,
    common,
    mcpRequiredCoverage: Math.round(mcpRequiredCoverage * 1000) / 1000,
    legacyRequiredCoverage: Math.round(legacyRequiredCoverage * 1000) / 1000,
    coverageDelta: Math.round(coverageDelta * 1000) / 1000,
    assessment,
  };
}
