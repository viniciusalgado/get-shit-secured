/**
 * Execution Contract: verify (Phase 14)
 *
 * Verify that remediation closes the intended issue without obvious regressions.
 * Heavy MCP consumer — mandatory consultation plan, exact docs re-checked.
 */

import type { WorkflowExecutionContract } from './types.js';

export const verifyContract: WorkflowExecutionContract = {
  workflowId: 'verify',
  consultationMode: 'required',

  signals: {
    extractor: 'extractVerifySignals',
    inputType: 'VerifySignalInput',
    sources: {
      stacks: { strategy: 'from-prior-artifact', artifactField: 'stacks' },
      issueTags: { strategy: 'from-findings', artifactField: 'findings' },
      changedFiles: { strategy: 'from-prior-artifact', artifactField: 'patchedFiles' },
    },
  },

  phases: [
    {
      id: 'verify-remediations',
      mcpConsultation: { level: 'full', tool: 'get_workflow_consultation_plan', timing: 'before-reasoning' },
      signalExtraction: true,
    },
    {
      id: 'run-regression',
      mcpConsultation: { level: 'full', tool: 'read_security_doc', timing: 'before-reasoning' },
      signalExtraction: false,
    },
    {
      id: 'assess-coverage',
      mcpConsultation: { level: 'full', tool: 'validate_security_consultation', timing: 'after-reasoning' },
      signalExtraction: false,
    },
    {
      id: 'finalize',
      mcpConsultation: { level: 'none', tool: 'none', timing: 'before-reasoning' },
      signalExtraction: false,
    },
  ],

  artifacts: [
    { name: 'verification-report', path: '.gss/artifacts/verify/verification-report.json', requiresConsultationTrace: true, payloadSchema: 'verify:verification-report:v1' },
    { name: 'regression-analysis', path: '.gss/artifacts/verify/regression-analysis.json', requiresConsultationTrace: true, payloadSchema: 'verify:regression-analysis:v1' },
    { name: 'test-coverage-report', path: '.gss/artifacts/verify/test-coverage.json', requiresConsultationTrace: true, payloadSchema: 'verify:test-coverage:v1' },
    { name: 'residual-risk-assessment', path: '.gss/artifacts/verify/residual-risk-assessment.json', requiresConsultationTrace: true, payloadSchema: 'verify:residual-risk:v1' },
  ],

  handoffs: [
    { targetWorkflowId: 'report', outputsToPass: ['verification-report', 'regression-analysis', 'test-coverage-report'], validationFn: 'validateVerifyToReport' },
  ],
};
