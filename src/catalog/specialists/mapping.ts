/**
 * Workflow-to-Specialist Mapping Registry
 *
 * Defines which specialists are used by which workflows.
 * Specialists can be bound to multiple workflows and can be
 * conditionally activated based on stack detection.
 */

import type { WorkflowId } from '../../core/types.js';

/**
 * Workflow-to-specialist binding configuration.
 */
export interface WorkflowSpecialistBinding {
  /** Workflow ID */
  workflow: WorkflowId;
  /** Primary specialists always used by this workflow */
  primarySpecialists: string[];
  /** Optional specialists that may be invoked */
  optionalSpecialists: string[];
  /** Stack-conditioned specialists (activate when stack matches) */
  stackConditionedSpecialists: Array<{
    /** Stack identifier (can be string or array of strings) */
    stack: string | string[];
    /** Specialist IDs to activate */
    specialists: string[];
  }>;
}

/**
 * Complete workflow-to-specialist mapping as specified in the plan.
 */
export const WORKFLOW_SPECIALIST_MAPPING: Record<WorkflowId, WorkflowSpecialistBinding> = {
  'map-codebase': {
    workflow: 'map-codebase',
    primarySpecialists: [
      'attack-surface-analysis',
      'abuse-case',
      'dependency-graph-sbom',
      'software-supply-chain-security',
      'secure-cloud-architecture',
      'microservices-based-security-arch-doc',
      'network-segmentation',
      'zero-trust-architecture',
    ],
    optionalSpecialists: [],
    stackConditionedSpecialists: [
      {
        stack: 'docker',
        specialists: ['docker-security'],
      },
      {
        stack: 'kubernetes',
        specialists: ['kubernetes-security'],
      },
      {
        stack: ['aws-lambda', 'serverless', 'faas'],
        specialists: ['serverless-faas-security'],
      },
      {
        stack: ['terraform', 'cloudformation', 'iac'],
        specialists: ['infrastructure-as-code-security'],
      },
      {
        stack: 'graphql',
        specialists: ['graphql'],
      },
      {
        stack: ['api', 'rest'],
        specialists: ['rest-security', 'web-service-security'],
      },
      {
        stack: 'grpc',
        specialists: ['grpc-security'],
      },
      {
        stack: 'javascript',
        specialists: ['third-party-javascript-management'],
      },
      {
        stack: ['payment', 'stripe', 'paypal'],
        specialists: ['third-party-payment-gateway-integration'],
      },
    ],
  },

  'threat-model': {
    workflow: 'threat-model',
    primarySpecialists: [
      'threat-modeling',
      'abuse-case',
      'attack-surface-analysis',
      'secure-product-design',
      'multi-tenant-security',
      'microservices-security',
      'zero-trust-architecture',
    ],
    optionalSpecialists: [
      'ai-agent-security',
      'mcp-security',
      'llm-prompt-injection-prevention',
      'secure-ai-model-ops',
    ],
    stackConditionedSpecialists: [],
  },

  'audit': {
    workflow: 'audit',
    primarySpecialists: [
      // Core secure code review
      'secure-code-review',

      // Injection specialists
      'input-validation',
      'sql-injection-prevention',
      'query-parameterization',
      'os-command-injection-defense',
      'nosql-security',
      'ldap-injection-prevention',

      // XSS specialists
      'cross-site-scripting-prevention',
      'dom-based-xss-prevention',
      'dom-clobbering-prevention',

      // Auth & session specialists
      'access-control',
      'authentication',
      'authorization',
      'session-management',
      'password-storage',
      'multifactor-authentication',
      'forgot-password',
      'transaction-authorization',

      // Secrets & crypto specialists
      'secrets-management',
      'cryptographic-storage',
      'key-management',

      // Other common vulnerabilities
      'file-upload',
      'deserialization',
      'server-side-request-forgery-prevention',
      'xml-external-entity-prevention',
      'cross-site-request-forgery-prevention',

      // Configuration & headers
      'content-security-policy',
      'http-headers',
      'http-strict-transport-security',
      'transport-layer-protection',
      'transport-layer-security',

      // Logging & error handling
      'error-handling',
      'logging',
      'logging-vocabulary',

      // Dependencies & supply chain
      'vulnerable-dependency-management',
      'software-supply-chain-security',

      // AI security
      'ai-agent-security',
      'mcp-security',
    ],
    optionalSpecialists: [
      'clickjacking-defense',
      'cookie-theft-mitigation',
      'credential-stuffing-prevention',
      'insecure-direct-object-reference-prevention',
      'mass-assignment',
      'pinning',
      'prototype-pollution-prevention',
      'subdomain-takeover-prevention',
      'unvalidated-redirects-and-forwards',
      'user-privacy-protection',
      'virtual-patching',
      'xss-filter-evasion',
      'xs-leaks',
    ],
    stackConditionedSpecialists: [
      {
        stack: 'django',
        specialists: ['django-security', 'django-rest-framework'],
      },
      {
        stack: 'laravel',
        specialists: ['laravel'],
      },
      {
        stack: ['nodejs', 'javascript'],
        specialists: ['nodejs-security', 'nodejs-docker', 'npm-security'],
      },
      {
        stack: ['ruby', 'rails'],
        specialists: ['ruby-on-rails'],
      },
      {
        stack: 'symfony',
        specialists: ['symfony'],
      },
      {
        stack: 'java',
        specialists: [
          'java-security',
          'injection-prevention-in-java',
          'json-web-token-for-java',
          'jaas',
        ],
      },
      {
        stack: ['csharp', 'dotnet'],
        specialists: ['dotnet-security'],
      },
      {
        stack: 'php',
        specialists: ['php-configuration'],
      },
    ],
  },

  'remediate': {
    workflow: 'remediate',
    primarySpecialists: [
      // Reuse audit specialists - prompts switch from "find" to "fix"
      'secure-code-review',
      'input-validation',
      'sql-injection-prevention',
      'query-parameterization',
      'os-command-injection-defense',
      'nosql-security',
      'ldap-injection-prevention',
      'cross-site-scripting-prevention',
      'dom-based-xss-prevention',
      'dom-clobbering-prevention',
      'access-control',
      'authentication',
      'authorization',
      'session-management',
      'password-storage',
      'multifactor-authentication',
      'secrets-management',
      'cryptographic-storage',
      'key-management',
      'file-upload',
      'deserialization',
      'server-side-request-forgery-prevention',
      'xml-external-entity-prevention',
      'cross-site-request-forgery-prevention',
      'content-security-policy',
      'http-headers',
      'error-handling',
      'logging',
    ],
    optionalSpecialists: [],
    stackConditionedSpecialists: [
      // Framework specialists are more important here for idiomatic fixes
      {
        stack: 'django',
        specialists: ['django-security', 'django-rest-framework'],
      },
      {
        stack: 'laravel',
        specialists: ['laravel'],
      },
      {
        stack: ['nodejs', 'javascript'],
        specialists: ['nodejs-security', 'nodejs-docker', 'npm-security'],
      },
      {
        stack: ['ruby', 'rails'],
        specialists: ['ruby-on-rails'],
      },
      {
        stack: 'symfony',
        specialists: ['symfony'],
      },
      {
        stack: 'java',
        specialists: [
          'java-security',
          'injection-prevention-in-java',
          'json-web-token-for-java',
          'jaas',
        ],
      },
      {
        stack: ['csharp', 'dotnet'],
        specialists: ['dotnet-security'],
      },
      {
        stack: 'php',
        specialists: ['php-configuration'],
      },
    ],
  },

  'verify': {
    workflow: 'verify',
    primarySpecialists: [
      'authorization-testing-automation',
      'rest-assessment',
      'authentication',
      'authorization',
      'session-management',
      'password-storage',
      'multifactor-authentication',
      'http-headers',
      'transport-layer-security',
      'transport-layer-protection',
      'content-security-policy',
      'clickjacking-defense',
      'error-handling',
      'logging',
    ],
    optionalSpecialists: [],
    stackConditionedSpecialists: [],
  },

  'report': {
    workflow: 'report',
    primarySpecialists: [
      'vulnerability-disclosure',
      'security-terminology',
      'logging-vocabulary',
    ],
    optionalSpecialists: [],
    stackConditionedSpecialists: [],
  },
};

/**
 * Get specialist bindings for a workflow.
 * @param workflowId - The workflow ID
 * @returns Workflow specialist binding configuration
 */
export function getWorkflowSpecialistBinding(
  workflowId: WorkflowId
): WorkflowSpecialistBinding | undefined {
  return WORKFLOW_SPECIALIST_MAPPING[workflowId];
}

/**
 * Get all specialists for a workflow, including stack-conditioned ones.
 * @param workflowId - The workflow ID
 * @param detectedStack - Optional detected stack for conditional activation
 * @returns Array of specialist IDs
 */
export function getSpecialistsForWorkflow(
  workflowId: WorkflowId,
  detectedStack?: string[]
): string[] {
  const binding = WORKFLOW_SPECIALIST_MAPPING[workflowId];
  if (!binding) {
    return [];
  }

  const specialists = new Set<string>();

  // Add primary specialists
  for (const id of binding.primarySpecialists) {
    specialists.add(id);
  }

  // Add optional specialists
  for (const id of binding.optionalSpecialists) {
    specialists.add(id);
  }

  // Add stack-conditioned specialists if stack matches
  if (detectedStack) {
    for (const condition of binding.stackConditionedSpecialists) {
      const stacks = Array.isArray(condition.stack) ? condition.stack : [condition.stack];
      for (const stackItem of detectedStack) {
        if (stacks.some(s => s.toLowerCase() === stackItem.toLowerCase())) {
          for (const specialistId of condition.specialists) {
            specialists.add(specialistId);
          }
        }
      }
    }
  }

  return Array.from(specialists);
}

/**
 * Check if a specialist is relevant to a workflow.
 * @param specialistId - The specialist ID
 * @param workflowId - The workflow ID
 * @returns True if the specialist is relevant to the workflow
 */
export function isSpecialistRelevantToWorkflow(
  specialistId: string,
  workflowId: WorkflowId
): boolean {
  const binding = WORKFLOW_SPECIALIST_MAPPING[workflowId];
  if (!binding) {
    return false;
  }

  return (
    binding.primarySpecialists.includes(specialistId) ||
    binding.optionalSpecialists.includes(specialistId) ||
    binding.stackConditionedSpecialists.some(c => c.specialists.includes(specialistId))
  );
}

/**
 * Get all workflows that use a specialist.
 * @param specialistId - The specialist ID
 * @returns Array of workflow IDs
 */
export function getWorkflowsForSpecialist(specialistId: string): WorkflowId[] {
  const workflows: WorkflowId[] = [];

  for (const [workflowId, binding] of Object.entries(WORKFLOW_SPECIALIST_MAPPING)) {
    if (
      binding.primarySpecialists.includes(specialistId) ||
      binding.optionalSpecialists.includes(specialistId) ||
      binding.stackConditionedSpecialists.some(c => c.specialists.includes(specialistId))
    ) {
      workflows.push(workflowId as WorkflowId);
    }
  }

  return workflows;
}

/**
 * Get the default delegation behavior for a workflow.
 * @param workflowId - The workflow ID
 * @returns Default delegation behavior
 */
export function getDefaultDelegationBehavior(workflowId: WorkflowId): 'always' | 'on-detection' | 'manual' {
  switch (workflowId) {
    case 'audit':
    case 'remediate':
      return 'on-detection';
    case 'verify':
      return 'always';
    case 'map-codebase':
    case 'threat-model':
    case 'report':
      return 'manual';
    default:
      return 'manual';
  }
}
