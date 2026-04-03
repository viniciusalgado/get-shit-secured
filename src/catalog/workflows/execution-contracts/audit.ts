/**
 * Execution Contract: audit (Phase 14)
 *
 * Find and explain security vulnerabilities using evidence and consultation coverage.
 * Heaviest MCP consumer — consultation plan is mandatory, coverage validation is mandatory.
 */

import type { WorkflowExecutionContract } from './types.js';

export const auditContract: WorkflowExecutionContract = {
  workflowId: 'audit',
  consultationMode: 'required',

  signals: {
    extractor: 'extractAuditSignals',
    inputType: 'AuditSignalInput',
    sources: {
      stacks: { strategy: 'from-prior-artifact', artifactField: 'stacks' },
      issueTags: { strategy: 'from-findings', artifactField: 'findings' },
      changedFiles: { strategy: 'none' },
    },
  },

  phases: [
    {
      id: 'check-input-validation',
      mcpConsultation: { level: 'full', tool: 'get_workflow_consultation_plan', timing: 'before-reasoning' },
      signalExtraction: true,
    },
    {
      id: 'check-authentication-authorization',
      mcpConsultation: { level: 'full', tool: 'read_security_doc', timing: 'before-reasoning' },
      signalExtraction: false,
    },
    {
      id: 'check-output-encoding-xss',
      mcpConsultation: { level: 'full', tool: 'read_security_doc', timing: 'before-reasoning' },
      signalExtraction: false,
    },
    {
      id: 'check-secrets-management',
      mcpConsultation: { level: 'minimal', tool: 'read_security_doc', timing: 'before-reasoning' },
      signalExtraction: false,
    },
    {
      id: 'check-dependency-vulnerabilities',
      mcpConsultation: { level: 'minimal', tool: 'search_security_docs', timing: 'before-reasoning' },
      signalExtraction: false,
    },
    {
      id: 'check-configuration',
      mcpConsultation: { level: 'minimal', tool: 'read_security_doc', timing: 'before-reasoning' },
      signalExtraction: false,
    },
    {
      id: 'check-logging-auditing',
      mcpConsultation: { level: 'minimal', tool: 'read_security_doc', timing: 'before-reasoning' },
      signalExtraction: false,
    },
    {
      id: 'check-ai-agent-safety',
      mcpConsultation: { level: 'minimal', tool: 'read_security_doc', timing: 'before-reasoning' },
      signalExtraction: false,
    },
    {
      id: 'compile-findings',
      mcpConsultation: { level: 'full', tool: 'validate_security_consultation', timing: 'after-reasoning' },
      signalExtraction: false,
    },
  ],

  artifacts: [
    { name: 'findings-report', path: '.gss/artifacts/audit/findings.json', requiresConsultationTrace: true, payloadSchema: 'audit:findings:v1' },
    { name: 'owasp-mapping', path: '.gss/artifacts/audit/owasp-mapping.json', requiresConsultationTrace: true, payloadSchema: 'audit:owasp-mapping:v1' },
    { name: 'evidence-artifacts', path: '.gss/artifacts/audit/evidence.md', requiresConsultationTrace: false, payloadSchema: 'audit:evidence:v1' },
    { name: 'remediation-priorities', path: '.gss/artifacts/audit/priorities.json', requiresConsultationTrace: true, payloadSchema: 'audit:priorities:v1' },
  ],

  handoffs: [
    { targetWorkflowId: 'validate-findings', outputsToPass: ['findings-report', 'remediation-priorities'], validationFn: 'validateAuditToValidateFindings' },
    { targetWorkflowId: 'report', outputsToPass: ['findings-report', 'owasp-mapping'], validationFn: 'validateAuditToReport' },
  ],
};
