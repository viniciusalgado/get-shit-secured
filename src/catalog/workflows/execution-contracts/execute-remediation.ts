/**
 * Execution Contract: execute-remediation (Phase 14)
 *
 * Apply approved security changes carefully.
 * Light MCP — may consult docs for correctness before edits.
 */

import type { WorkflowExecutionContract } from './types.js';

export const executeRemediationContract: WorkflowExecutionContract = {
  workflowId: 'execute-remediation',
  consultationMode: 'optional',

  signals: {
    extractor: 'extractExecuteRemediationSignals',
    inputType: 'ExecuteRemediationSignalInput',
    sources: {
      stacks: { strategy: 'from-prior-artifact', artifactField: 'stacks' },
      issueTags: { strategy: 'from-findings', artifactField: 'findings' },
      changedFiles: { strategy: 'from-prior-artifact', artifactField: 'patchedFiles' },
    },
  },

  phases: [
    {
      id: 'validate-artifacts',
      mcpConsultation: { level: 'none', tool: 'none', timing: 'before-reasoning' },
      signalExtraction: true,
    },
    {
      id: 'apply-patches',
      mcpConsultation: { level: 'minimal', tool: 'read_security_doc', timing: 'before-reasoning' },
      signalExtraction: false,
    },
    {
      id: 'run-tests',
      mcpConsultation: { level: 'none', tool: 'none', timing: 'before-reasoning' },
      signalExtraction: false,
    },
    {
      id: 'generate-report',
      mcpConsultation: { level: 'none', tool: 'none', timing: 'before-reasoning' },
      signalExtraction: false,
    },
  ],

  artifacts: [
    { name: 'application-report', path: '.gss/artifacts/execute-remediation/application-report.json', requiresConsultationTrace: false, payloadSchema: 'execute-remediation:application-report:v1' },
    { name: 'change-summary', path: '.gss/artifacts/execute-remediation/change-summary.md', requiresConsultationTrace: false, payloadSchema: 'execute-remediation:change-summary:v1' },
    { name: 'deviations-log', path: '.gss/artifacts/execute-remediation/deviations.md', requiresConsultationTrace: false, payloadSchema: 'execute-remediation:deviations:v1' },
  ],

  handoffs: [
    { targetWorkflowId: 'verify', outputsToPass: ['application-report'], validationFn: 'validateExecuteRemediationToVerify' },
  ],
};
