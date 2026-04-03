/**
 * Execution Contract: report (Phase 14)
 *
 * Aggregate outputs from the full workflow chain into a final security report.
 * No MCP use — aggregation only.
 */

import type { WorkflowExecutionContract } from './types.js';

export const reportContract: WorkflowExecutionContract = {
  workflowId: 'report',
  consultationMode: 'not-applicable',

  signals: {
    extractor: 'extractDefaultSignals',
    inputType: 'void',
    sources: {
      stacks: { strategy: 'none' },
      issueTags: { strategy: 'none' },
      changedFiles: { strategy: 'none' },
    },
  },

  phases: [
    {
      id: 'aggregate-artifacts',
      mcpConsultation: { level: 'none', tool: 'none', timing: 'before-reasoning' },
      signalExtraction: false,
    },
    {
      id: 'generate-executive-summary',
      mcpConsultation: { level: 'none', tool: 'none', timing: 'before-reasoning' },
      signalExtraction: false,
    },
    {
      id: 'generate-technical-findings',
      mcpConsultation: { level: 'none', tool: 'none', timing: 'before-reasoning' },
      signalExtraction: false,
    },
    {
      id: 'generate-owasp-compliance',
      mcpConsultation: { level: 'none', tool: 'none', timing: 'before-reasoning' },
      signalExtraction: false,
    },
    {
      id: 'generate-remediation-roadmap',
      mcpConsultation: { level: 'none', tool: 'none', timing: 'before-reasoning' },
      signalExtraction: false,
    },
  ],

  artifacts: [
    { name: 'executive-summary', path: '.gss/report/executive-summary.md', requiresConsultationTrace: false, payloadSchema: 'report:executive-summary:v1' },
    { name: 'technical-findings', path: '.gss/report/technical-findings.md', requiresConsultationTrace: false, payloadSchema: 'report:technical-findings:v1' },
    { name: 'owasp-compliance', path: '.gss/report/owasp-compliance.md', requiresConsultationTrace: false, payloadSchema: 'report:owasp-compliance:v1' },
    { name: 'remediation-roadmap', path: '.gss/report/remediation-roadmap.md', requiresConsultationTrace: false, payloadSchema: 'report:remediation-roadmap:v1' },
  ],

  handoffs: [],
};
