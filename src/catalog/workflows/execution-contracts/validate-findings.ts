/**
 * Execution Contract: validate-findings (Phase 14)
 *
 * Validate and confirm security findings with TDD-style test documentation.
 * Medium MCP use — optional consultation for validation confirmation.
 */

import type { WorkflowExecutionContract } from './types.js';

export const validateFindingsContract: WorkflowExecutionContract = {
  workflowId: 'validate-findings',
  consultationMode: 'optional',

  signals: {
    extractor: 'extractValidateFindingsSignals',
    inputType: 'ValidateFindingsSignalInput',
    sources: {
      stacks: { strategy: 'from-prior-artifact', artifactField: 'stacks' },
      issueTags: { strategy: 'from-findings', artifactField: 'findings' },
      changedFiles: { strategy: 'none' },
    },
  },

  phases: [
    {
      id: 'load-findings',
      mcpConsultation: { level: 'none', tool: 'none', timing: 'before-reasoning' },
      signalExtraction: true,
    },
    {
      id: 'validate-each-finding',
      mcpConsultation: { level: 'minimal', tool: 'get_workflow_consultation_plan', timing: 'before-reasoning' },
      signalExtraction: false,
    },
    {
      id: 'generate-tdd-specs',
      mcpConsultation: { level: 'minimal', tool: 'read_security_doc', timing: 'before-reasoning' },
      signalExtraction: false,
    },
    {
      id: 're-evaluate',
      mcpConsultation: { level: 'none', tool: 'none', timing: 'before-reasoning' },
      signalExtraction: false,
    },
    {
      id: 'finalize',
      mcpConsultation: { level: 'none', tool: 'none', timing: 'before-reasoning' },
      signalExtraction: false,
    },
  ],

  artifacts: [
    { name: 'validated-findings', path: '.gss/artifacts/validate-findings/validated-findings.json', requiresConsultationTrace: true, payloadSchema: 'validate-findings:validated-findings:v1' },
    { name: 'tdd-test-document', path: '.gss/artifacts/validate-findings/tdd-test-specs.json', requiresConsultationTrace: true, payloadSchema: 'validate-findings:tdd-test-specs:v1' },
    { name: 'validation-report', path: '.gss/artifacts/validate-findings/validation-report.json', requiresConsultationTrace: false, payloadSchema: 'validate-findings:validation-report:v1' },
    { name: 're-evaluation-report', path: '.gss/artifacts/validate-findings/re-evaluation.json', requiresConsultationTrace: false, payloadSchema: 'validate-findings:re-evaluation:v1' },
  ],

  handoffs: [
    { targetWorkflowId: 'plan-remediation', outputsToPass: ['validated-findings', 'tdd-test-document'], validationFn: 'validateValidateFindingsToPlanRemediation' },
    { targetWorkflowId: 'report', outputsToPass: ['validation-report', 're-evaluation-report'], validationFn: 'validateValidateFindingsToReport' },
  ],
};
