/**
 * Execution Contract: security-review (Phase 14)
 *
 * Fast, explicit, change-scoped security review.
 * Heavy MCP consumer — consultation plan is mandatory for the main phases.
 */

import type { WorkflowExecutionContract } from './types.js';

export const securityReviewContract: WorkflowExecutionContract = {
  workflowId: 'security-review',
  consultationMode: 'required',

  signals: {
    extractor: 'extractSecurityReviewSignals',
    inputType: 'SecurityReviewSignalInput',
    sources: {
      stacks: { strategy: 'from-diff-heuristics', artifactField: 'technologies' },
      issueTags: { strategy: 'from-diff-heuristics', artifactField: 'categories' },
      changedFiles: { strategy: 'from-diff', artifactField: 'changedFiles' },
    },
  },

  phases: [
    {
      id: 'collect-change-set',
      mcpConsultation: { level: 'none', tool: 'none', timing: 'before-reasoning' },
      signalExtraction: false,
    },
    {
      id: 'security-relevance-gate',
      mcpConsultation: { level: 'none', tool: 'none', timing: 'before-reasoning' },
      signalExtraction: false,
    },
    {
      id: 'impact-pass',
      mcpConsultation: { level: 'minimal', tool: 'get_workflow_consultation_plan', timing: 'before-reasoning' },
      signalExtraction: true,
    },
    {
      id: 'audit-pass',
      mcpConsultation: { level: 'full', tool: 'get_workflow_consultation_plan', timing: 'before-reasoning' },
      signalExtraction: true,
    },
    {
      id: 'specialist-pass',
      mcpConsultation: { level: 'full', tool: 'read_security_doc', timing: 'before-reasoning' },
      signalExtraction: false,
    },
    {
      id: 'validation-and-tdd',
      mcpConsultation: { level: 'minimal', tool: 'validate_security_consultation', timing: 'after-reasoning' },
      signalExtraction: false,
    },
    {
      id: 'finalize',
      mcpConsultation: { level: 'none', tool: 'none', timing: 'before-reasoning' },
      signalExtraction: false,
    },
  ],

  artifacts: [
    { name: 'change-scope', path: '.gss/artifacts/security-review/change-scope.json', requiresConsultationTrace: true, payloadSchema: 'security-review:change-scope:v1' },
    { name: 'delegation-plan', path: '.gss/artifacts/security-review/delegation-plan.json', requiresConsultationTrace: true, payloadSchema: 'security-review:delegation-plan:v1' },
    { name: 'findings', path: '.gss/artifacts/security-review/findings.json', requiresConsultationTrace: true, payloadSchema: 'security-review:findings:v1' },
    { name: 'validation-report', path: '.gss/artifacts/security-review/validation-report.json', requiresConsultationTrace: true, payloadSchema: 'security-review:validation-report:v1' },
    { name: 'security-test-specs', path: '.gss/artifacts/security-review/security-test-specs.json', requiresConsultationTrace: true, payloadSchema: 'security-review:test-specs:v1' },
  ],

  handoffs: [],
};
