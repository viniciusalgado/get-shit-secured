/**
 * Execution Contract: plan-remediation (Phase 14)
 *
 * Design minimal, safe, staged remediation for approved issues.
 * Heavy MCP use — consults issue-specific and remediation-adjacent docs.
 */

import type { WorkflowExecutionContract } from './types.js';

export const planRemediationContract: WorkflowExecutionContract = {
  workflowId: 'plan-remediation',
  consultationMode: 'required',

  signals: {
    extractor: 'extractPlanRemediationSignals',
    inputType: 'PlanRemediationSignalInput',
    sources: {
      stacks: { strategy: 'from-prior-artifact', artifactField: 'stacks' },
      issueTags: { strategy: 'from-findings', artifactField: 'findings' },
      changedFiles: { strategy: 'from-prior-artifact', artifactField: 'changedFiles' },
    },
  },

  phases: [
    {
      id: 'analyze-findings',
      mcpConsultation: { level: 'full', tool: 'get_workflow_consultation_plan', timing: 'before-reasoning' },
      signalExtraction: true,
    },
    {
      id: 'group-remediations',
      mcpConsultation: { level: 'full', tool: 'read_security_doc', timing: 'before-reasoning' },
      signalExtraction: false,
    },
    {
      id: 'design-patches',
      mcpConsultation: { level: 'full', tool: 'get_related_security_docs', timing: 'before-reasoning' },
      signalExtraction: false,
    },
    {
      id: 'create-test-specs',
      mcpConsultation: { level: 'minimal', tool: 'read_security_doc', timing: 'before-reasoning' },
      signalExtraction: false,
    },
    {
      id: 'create-rollback-plan',
      mcpConsultation: { level: 'none', tool: 'none', timing: 'before-reasoning' },
      signalExtraction: false,
    },
    {
      id: 'finalize',
      mcpConsultation: { level: 'full', tool: 'validate_security_consultation', timing: 'after-reasoning' },
      signalExtraction: false,
    },
  ],

  artifacts: [
    { name: 'patch-plan', path: '.gss/artifacts/plan-remediation/patch-plan.json', requiresConsultationTrace: true, payloadSchema: 'plan-remediation:patch-plan:v1' },
    { name: 'implementation-guide', path: '.gss/artifacts/plan-remediation/implementation-guide.md', requiresConsultationTrace: false, payloadSchema: 'plan-remediation:implementation-guide:v1' },
    { name: 'test-specifications', path: '.gss/artifacts/plan-remediation/test-specifications.json', requiresConsultationTrace: true, payloadSchema: 'plan-remediation:test-specifications:v1' },
    { name: 'rollback-plan', path: '.gss/artifacts/plan-remediation/rollback-plan.json', requiresConsultationTrace: false, payloadSchema: 'plan-remediation:rollback-plan:v1' },
  ],

  handoffs: [
    { targetWorkflowId: 'execute-remediation', outputsToPass: ['patch-plan', 'implementation-guide', 'test-specifications', 'rollback-plan'], validationFn: 'validatePlanRemediationToExecuteRemediation' },
  ],
};
