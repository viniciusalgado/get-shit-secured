import type { WorkflowDefinition } from '../../../core/types.js';

/**
 * Threat Model workflow definition.
 * Grounded in OWASP Threat Modeling and STRIDE methodology.
 */
export const threatModelDefinition: WorkflowDefinition = {
  id: 'threat-model',
  title: 'Threat Modeling',
  goal: 'Apply STRIDE methodology to identified components to generate a comprehensive threat catalog, risk register, and mitigation requirements.',
  owaspTopics: [
    {
      name: 'Threat Modeling',
      glossaryUrl: 'https://cheatsheetseries.owasp.org/Glossary.html',
      cheatSheetUrls: [
        'https://cheatsheetseries.owasp.org/cheatsheets/Threat_Modeling_Cheat_Sheet.html',
      ],
    },
    {
      name: 'Risk Assessment',
      glossaryUrl: 'https://cheatsheetseries.owasp.org/Glossary.html',
      cheatSheetUrls: [],
    },
    {
      name: 'Attack Surface Analysis',
      glossaryUrl: 'https://cheatsheetseries.owasp.org/Glossary.html',
      cheatSheetUrls: [
        'https://cheatsheetseries.owasp.org/cheatsheets/Attack_Surface_Analysis_Cheat_Sheet.html',
      ],
    },
  ],
  inputs: [
    {
      name: 'codebase-inventory',
      type: 'json',
      required: true,
      description: 'Component inventory from map-codebase workflow',
    },
    {
      name: 'trust-boundary-map',
      type: 'diagram',
      required: true,
      description: 'Trust boundary diagram from map-codebase workflow',
    },
    {
      name: 'data-flow-map',
      type: 'diagram',
      required: true,
      description: 'Data flow diagram from map-codebase workflow',
    },
  ],
  outputs: [
    {
      name: 'threat-register',
      type: 'json',
      description: 'Complete catalog of identified threats with STRIDE classification',
      path: '.gss/artifacts/threat-model/threats.json',
    },
    {
      name: 'risk-assessment',
      type: 'json',
      description: 'Risks scored by severity and likelihood with priority rankings',
      path: '.gss/artifacts/threat-model/risks.json',
    },
    {
      name: 'mitigation-requirements',
      type: 'markdown',
      description: 'Security requirements derived from threat analysis',
      path: '.gss/artifacts/threat-model/mitigations.md',
    },
    {
      name: 'abuse-cases',
      type: 'markdown',
      description: 'Documented abuse scenarios for each major component',
      path: '.gss/artifacts/threat-model/abuse-cases.md',
    },
  ],
  dependencies: [
    {
      workflowId: 'map-codebase',
      requiredOutputs: ['codebase-inventory', 'trust-boundary-map', 'data-flow-map'],
    },
  ],
  handoffs: [
    {
      nextWorkflow: 'audit',
      outputsToPass: ['threat-register', 'risk-assessment', 'mitigation-requirements'],
    },
    {
      nextWorkflow: 'plan-remediation',
      outputsToPass: ['mitigation-requirements'],
    },
  ],
  steps: [
    {
      id: 'apply-stride',
      title: 'Apply STRIDE to Each Component',
      instructions: `For each component in the codebase inventory, apply STRIDE analysis:

**S - Spoofing**
- Can an attacker impersonate another user, system, or component?
- Look at: authentication mechanisms, identity verification, session tokens
- Common issues: weak auth, missing token validation, predictable session IDs

**T - Tampering**
- Can an attacker modify data or code in transit or at rest?
- Look at: data validation, API integrity, state modification
- Common issues: missing integrity checks, mutable state, lack of signing

**R - Repudiation**
- Can a user deny their actions? Can we prove what happened?
- Look at: logging, audit trails, non-repudiation mechanisms
- Common issues: insufficient logging, missing audit records

**I - Information Disclosure**
- Can sensitive data be exposed to unauthorized parties?
- Look at: data exposure, error messages, cache leaks, headers
- Common issues: PII in logs, debug info in production, verbose errors

**D - Denial of Service**
- Can the system be made unavailable?
- Look at: resource limits, query complexity, network exposure
- Common issues: unbounded loops, missing rate limits, resource exhaustion

**E - Elevation of Privilege**
- Can a user gain higher permissions than they should have?
- Look at: authorization checks, privilege escalation paths
- Common issues: missing authz checks, role confusion, admin bypass

For each threat found, document:
- Affected component(s)
- STRIDE category
- Threat description
- Attack scenario

Reference: https://cheatsheetseries.owasp.org/cheatsheets/Threat_Modeling_Cheat_Sheet.html`,
      owaspTopics: ['Threat Modeling'],
    },
    {
      id: 'identify-threat-agents',
      title: 'Identify Threat Agents and Attack Surfaces',
      instructions: `Identify who might attack the system and how:

**Threat Agents:**
- External attackers (anonymous, internet)
- Malicious internal users (privileged insiders)
- Accidental internal users (mistakes, negligence)
- Automated tools (bots, scanners)
- Compromised accounts (phishing victims)

**Attack Surfaces:**
- Web/API endpoints
- Authentication flows
- File upload/download
- Database interfaces
- Background jobs
- Third-party integrations

For each attack surface, list:
- Accessible from where? (public, internal, partner)
- What authentication is required?
- What data is exposed/accepted?
- What are the abuse scenarios?

This helps prioritize which threats are most realistic.`,
      owaspTopics: ['Attack Surface Analysis'],
    },
    {
      id: 'assess-impact-likelihood',
      title: 'Assess Threat Impact and Likelihood',
      instructions: `Score each identified threat:

**Impact (if exploited):**
- Critical: Complete system compromise, data breach, major financial loss
- High: Significant data exposure, service disruption, moderate loss
- Medium: Limited data exposure, minor disruption
- Low: Minimal impact, information disclosure only

**Likelihood (of exploitation):**
- Very High: Easily exploitable, no authentication required, common tools
- High: Exploitable with some effort, requires authentication
- Medium: Exploitable with skill/knowledge, requires specific conditions
- Low: Difficult to exploit, requires privileged access

**Risk Score = Impact × Likelihood**

Prioritize threats:
1. Critical/High risk → Address immediately
2. Medium risk → Address in next sprint
3. Low risk → Accept or address later

Document rationale for each score.`,
      owaspTopics: ['Risk Assessment'],
    },
    {
      id: 'generate-mitigations',
      title: 'Generate Mitigation Recommendations',
      instructions: `For each prioritized threat, recommend mitigations:

**Mitigation Strategies:**
- **Avoid** - Eliminate the threat by design changes
- **Transfer** - Move risk to third party (e.g., using managed auth)
- **Mitigate** - Implement controls to reduce impact/likelihood
- **Accept** - Document and accept risk (for low-priority threats)

**Control Categories:**
- Preventive - Stop threats from succeeding
- Detective - Identify when threats occur
- Corrective - Recover from successful threats
- Deterrent - Discourage attempts

**For each mitigation, specify:**
- What threat it addresses
- Control type (preventive/detective/corrective)
- Implementation approach
- OWASP references for best practices
- Testing/validation approach

Reference relevant cheat sheets:
- https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
- https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
- https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
- https://cheatsheetseries.owasp.org/cheatsheets/Logging_Vocabulary_Cheat_Sheet.html`,
      owaspTopics: ['Threat Modeling'],
    },
    {
      id: 'document-abuse-cases',
      title: 'Document Abuse Cases',
      instructions: `Create abuse case scenarios for each major component:

**Abuse Case Structure:**
1. **Title** - Brief description of the abuse scenario
2. **Actor** - Who is performing the abuse (attacker type)
3. **Goal** - What the attacker is trying to achieve
4. **Preconditions** - What conditions enable this abuse
5. **Steps** - How the abuse would be carried out
6. **Impact** - What would happen if successful
7. **Mitigations** - What controls prevent this

**Example Abuse Cases:**
- "Attacker bypasses authentication by exploiting SQL injection"
- "Privileged user accesses data outside their authorization"
- "Attacker enumerates user accounts via password reset"
- "Malicious user exhausts API rate limits from distributed IPs"

These abuse cases will guide the audit workflow's testing approach.`,
      owaspTopics: ['Risk Assessment'],
    },
  ],
  guardrails: [
    {
      type: 'preflight',
      description: 'Verify map-codebase artifacts exist before starting',
      condition: 'Check for codebase-inventory, trust-boundary-map, and data-flow-map',
    },
    {
      type: 'approval',
      description: 'Confirm with user if the threat catalog is complete before proceeding to mitigation',
      condition: 'After generating threat register, prompt for review',
    },
    {
      type: 'mutation',
      description: 'This workflow produces documentation only - no code changes',
      condition: 'Never write code during threat modeling',
    },
  ],
  runtimePrompts: {
    claude: `When building the threat model:

- Be systematic - apply STRIDE to EVERY component, not just obvious ones
- Consider realistic attack scenarios based on the application's threat model
- Reference OWASP cheat sheets for proven mitigation patterns
- Distinguish between "theoretical" and "practical" threats
- Focus on threats relevant to this application's context

Output artifacts to .gss/artifacts/threat-model/ for use by audit and plan-remediation workflows.`,
    codex: `Build a comprehensive threat model:

1. Read the codebase mapping artifacts
2. Apply STRIDE systematically to each component
3. Assess risk based on impact and likelihood
4. Recommend prioritized mitigations
5. Document abuse scenarios

Ground all analysis in OWASP threat modeling practices.`,
  },
};
