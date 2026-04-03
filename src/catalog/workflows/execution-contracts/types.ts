/**
 * Execution Contract Types (Phase 14)
 *
 * Shared types used by all workflow execution contracts.
 * Each execution contract specifies: signal derivation, MCP consultation
 * sequence, artifact outputs, and handoff requirements.
 */

import type { WorkflowId, ConsultationMode, SignalDerivation } from '../../../core/types.js';

/**
 * Signal derivation contract for a workflow phase.
 * Binds the strategy string to a concrete extractor function.
 */
export interface PhaseSignalContract {
  /** Named extractor function from consultation-signals.ts */
  extractor: string;
  /** Typed input shape expected by the extractor */
  inputType: string;
  /** Expected output type */
  outputType: 'ConsultationSignals';
}

/**
 * MCP consultation contract for a workflow phase.
 * Encodes MCP call points structurally rather than in prose.
 */
export interface PhaseConsultationContract {
  /** MCP consultation level for this phase */
  level: 'full' | 'minimal' | 'none';
  /** Which MCP tool to call at this phase */
  tool:
    | 'get_workflow_consultation_plan'
    | 'validate_security_consultation'
    | 'read_security_doc'
    | 'search_security_docs'
    | 'get_related_security_docs'
    | 'none';
  /** When this consultation occurs relative to phase execution */
  timing: 'before-reasoning' | 'after-reasoning' | 'both';
}

/**
 * A single phase in the workflow execution contract.
 */
export interface PhaseContract {
  /** Stable phase identifier matching definition.steps[].id or orchestration.phases[].id */
  id: string;
  /** MCP consultation contract for this phase */
  mcpConsultation: PhaseConsultationContract;
  /** Whether signal extraction occurs in this phase */
  signalExtraction: boolean;
}

/**
 * Signal source contract for one signal dimension.
 */
export interface SignalSourceContract {
  /** Strategy from signalDerivation */
  strategy: string;
  /** Artifact field that provides this signal */
  artifactField?: string;
}

/**
 * Full signal derivation contract for a workflow.
 */
export interface SignalDerivationContract {
  /** Named extractor function */
  extractor: string;
  /** Typed input shape */
  inputType: string;
  /** Per-dimension source contracts */
  sources: {
    stacks: SignalSourceContract;
    issueTags: SignalSourceContract;
    changedFiles: SignalSourceContract;
  };
}

/**
 * Artifact output contract for a workflow.
 */
export interface ArtifactOutputContract {
  /** Artifact name matching definition.outputs[].name */
  name: string;
  /** Path matching definition.outputs[].path */
  path: string;
  /** Whether consultation trace is required in this artifact */
  requiresConsultationTrace: boolean;
  /** Schema identifier for payload validation */
  payloadSchema: string;
}

/**
 * Handoff contract specifying what a workflow passes downstream.
 */
export interface HandoffContract {
  /** Target workflow */
  targetWorkflowId: WorkflowId;
  /** Output artifact names passed to the target */
  outputsToPass: string[];
  /** Validation function to check artifact compatibility */
  validationFn: string;
}

/**
 * Complete workflow execution contract.
 * Formal specification of a workflow's signal derivation, MCP consultation
 * sequence, artifact outputs, and handoff requirements.
 */
export interface WorkflowExecutionContract {
  /** Workflow identifier */
  workflowId: WorkflowId;
  /** Consultation mode from the workflow definition */
  consultationMode: ConsultationMode;
  /** Signal derivation contract */
  signals: SignalDerivationContract;
  /** Per-phase MCP consultation sequence */
  phases: PhaseContract[];
  /** Artifact output contracts */
  artifacts: ArtifactOutputContract[];
  /** Handoff contracts to downstream workflows */
  handoffs: HandoffContract[];
}
