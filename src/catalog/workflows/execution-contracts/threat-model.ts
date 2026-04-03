/**
 * Execution Contract: threat-model (Phase 14)
 *
 * Generate risk-oriented analysis of the system and trust boundaries.
 * Medium MCP use — consults threat-model-relevant docs for detected stack and risk areas.
 */

import type { WorkflowExecutionContract } from './types.js';

export const threatModelContract: WorkflowExecutionContract = {
  workflowId: 'threat-model',
  consultationMode: 'required',

  signals: {
    extractor: 'extractThreatModelSignals',
    inputType: 'ThreatModelSignalInput',
    sources: {
      stacks: { strategy: 'from-prior-artifact', artifactField: 'stacks' },
      issueTags: { strategy: 'none' },
      changedFiles: { strategy: 'none' },
    },
  },

  phases: [
    {
      id: 'load-context',
      mcpConsultation: { level: 'none', tool: 'none', timing: 'before-reasoning' },
      signalExtraction: true,
    },
    {
      id: 'identify-threat-agents',
      mcpConsultation: { level: 'full', tool: 'get_workflow_consultation_plan', timing: 'before-reasoning' },
      signalExtraction: false,
    },
    {
      id: 'enumerate-threats',
      mcpConsultation: { level: 'full', tool: 'read_security_doc', timing: 'before-reasoning' },
      signalExtraction: false,
    },
    {
      id: 'assess-risk',
      mcpConsultation: { level: 'minimal', tool: 'none', timing: 'before-reasoning' },
      signalExtraction: false,
    },
    {
      id: 'finalize',
      mcpConsultation: { level: 'minimal', tool: 'validate_security_consultation', timing: 'after-reasoning' },
      signalExtraction: false,
    },
  ],

  artifacts: [
    { name: 'threat-register', path: '.gss/artifacts/threat-model/threat-register.json', requiresConsultationTrace: true, payloadSchema: 'threat-model:threat-register:v1' },
    { name: 'risk-assessment', path: '.gss/artifacts/threat-model/risk-assessment.json', requiresConsultationTrace: true, payloadSchema: 'threat-model:risk-assessment:v1' },
    { name: 'abuse-cases', path: '.gss/artifacts/threat-model/abuse-cases.json', requiresConsultationTrace: true, payloadSchema: 'threat-model:abuse-cases:v1' },
    { name: 'mitigation-requirements', path: '.gss/artifacts/threat-model/mitigation-requirements.md', requiresConsultationTrace: false, payloadSchema: 'threat-model:mitigation-requirements:v1' },
  ],

  handoffs: [
    { targetWorkflowId: 'audit', outputsToPass: ['threat-register', 'risk-assessment', 'mitigation-requirements'], validationFn: 'validateThreatModelToAudit' },
    { targetWorkflowId: 'plan-remediation', outputsToPass: ['mitigation-requirements'], validationFn: 'validateThreatModelToPlanRemediation' },
  ],
};
