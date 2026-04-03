/**
 * Execution Contract: map-codebase (Phase 14)
 *
 * Map architecture, dependencies, frameworks, and security-relevant boundaries.
 * Light MCP use — optional consultation for stack-default docs.
 */

import type { WorkflowExecutionContract } from './types.js';

export const mapCodebaseContract: WorkflowExecutionContract = {
  workflowId: 'map-codebase',
  consultationMode: 'optional',

  signals: {
    extractor: 'extractDefaultSignals',
    inputType: 'void',
    sources: {
      stacks: { strategy: 'from-codebase' },
      issueTags: { strategy: 'none' },
      changedFiles: { strategy: 'none' },
    },
  },

  phases: [
    {
      id: 'scan-structure',
      mcpConsultation: { level: 'none', tool: 'none', timing: 'before-reasoning' },
      signalExtraction: false,
    },
    {
      id: 'inventory-components',
      mcpConsultation: { level: 'none', tool: 'none', timing: 'before-reasoning' },
      signalExtraction: false,
    },
    {
      id: 'map-dependencies',
      mcpConsultation: { level: 'none', tool: 'none', timing: 'before-reasoning' },
      signalExtraction: false,
    },
    {
      id: 'identify-trust-boundaries',
      mcpConsultation: { level: 'minimal', tool: 'search_security_docs', timing: 'before-reasoning' },
      signalExtraction: false,
    },
    {
      id: 'map-data-flows',
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
    { name: 'codebase-inventory', path: '.gss/artifacts/map-codebase/inventory.json', requiresConsultationTrace: false, payloadSchema: 'map-codebase:inventory:v1' },
    { name: 'trust-boundary-map', path: '.gss/artifacts/map-codebase/trust-boundaries.json', requiresConsultationTrace: false, payloadSchema: 'map-codebase:trust-boundaries:v1' },
    { name: 'dependency-map', path: '.gss/artifacts/map-codebase/dependencies.json', requiresConsultationTrace: false, payloadSchema: 'map-codebase:dependencies:v1' },
    { name: 'data-flow-map', path: '.gss/artifacts/map-codebase/data-flows.json', requiresConsultationTrace: false, payloadSchema: 'map-codebase:data-flows:v1' },
  ],

  handoffs: [
    { targetWorkflowId: 'threat-model', outputsToPass: ['codebase-inventory', 'trust-boundary-map', 'data-flow-map'], validationFn: 'validateMapCodebaseToThreatModel' },
    { targetWorkflowId: 'audit', outputsToPass: ['codebase-inventory', 'dependency-map'], validationFn: 'validateMapCodebaseToAudit' },
  ],
};
