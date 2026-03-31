import type { WorkflowDefinition } from '../../../core/types.js';

/**
 * Report workflow definition.
 * Grounded in OWASP ASVS reporting guidelines and security reporting best practices.
 */
export const reportDefinition: WorkflowDefinition = {
  id: 'report',
  title: 'Security Report Generation',
  goal: 'Aggregate all workflow artifacts into comprehensive security reports for executives, developers, and auditors with OWASP mappings and remediation tracking.',
  owaspTopics: [
    {
      name: 'Security Reporting',
      glossaryUrl: 'https://cheatsheetseries.owasp.org/Glossary.html',
      cheatSheetUrls: [],
    },
    {
      name: 'ASVS Reporting',
      glossaryUrl: 'https://cheatsheetseries.owasp.org/Glossary.html',
      cheatSheetUrls: [],
    },
  ],
  inputs: [
    {
      name: 'codebase-inventory',
      type: 'json',
      required: false,
      description: 'From map-codebase workflow',
    },
    {
      name: 'threat-register',
      type: 'json',
      required: false,
      description: 'From threat-model workflow',
    },
    {
      name: 'risk-assessment',
      type: 'json',
      required: false,
      description: 'From threat-model workflow',
    },
    {
      name: 'findings-report',
      type: 'json',
      required: false,
      description: 'From audit workflow',
    },
    {
      name: 'owasp-mapping',
      type: 'json',
      required: false,
      description: 'From audit workflow',
    },
    {
      name: 'patch-plan',
      type: 'json',
      required: false,
      description: 'From plan-remediation workflow',
    },
    {
      name: 'application-report',
      type: 'json',
      required: false,
      description: 'From execute-remediation workflow',
    },
    {
      name: 'change-summary',
      type: 'markdown',
      required: false,
      description: 'From execute-remediation workflow',
    },
    {
      name: 'deviations-log',
      type: 'markdown',
      required: false,
      description: 'From execute-remediation workflow',
    },
    {
      name: 'verification-report',
      type: 'json',
      required: false,
      description: 'From verify workflow',
    },
    {
      name: 'regression-analysis',
      type: 'json',
      required: false,
      description: 'From verify workflow',
    },
    {
      name: 'test-coverage-report',
      type: 'json',
      required: false,
      description: 'From verify workflow',
    },
  ],
  outputs: [
    {
      name: 'executive-summary',
      type: 'markdown',
      description: 'High-level security posture summary for stakeholders',
      path: '.gss/report/executive-summary.md',
    },
    {
      name: 'technical-findings',
      type: 'markdown',
      description: 'Detailed findings with code references and evidence',
      path: '.gss/report/technical-findings.md',
    },
    {
      name: 'owasp-compliance',
      type: 'markdown',
      description: 'OWASP Top 10 and ASVS compliance matrix',
      path: '.gss/report/owasp-compliance.md',
    },
    {
      name: 'remediation-roadmap',
      type: 'markdown',
      description: 'Prioritized remediation plan with timelines',
      path: '.gss/report/remediation-roadmap.md',
    },
  ],
  dependencies: [],
  handoffs: [],
  steps: [
    {
      id: 'aggregate-artifacts',
      title: 'Aggregate Workflow Artifacts',
      instructions: `Gather all available artifacts from previous workflows:

**Available Artifacts:**
From map-codebase:
- Codebase inventory
- Trust boundary map
- Dependency map
- Data flow map

From threat-model:
- Threat register
- Risk assessment
- Abuse cases

From audit:
- Findings report
- OWASP mapping
- Evidence artifacts
- Remediation priorities

From plan-remediation:
- Patch plan
- Implementation guide
- Test specifications
- Rollback plan

From execute-remediation:
- Application report
- Change summary
- Deviations log

From verify:
- Verification report
- Regression analysis
- Test coverage report
- Residual risks

**Consolidation:**
- Read all available artifacts from .gss/artifacts/
- Identify which workflows were completed
- Note any gaps or missing workflows
- Organize by workflow and date

This provides the complete picture of security activities performed.`,
      owaspTopics: ['Security Reporting'],
    },
    {
      id: 'generate-executive-summary',
      title: 'Generate Executive Summary',
      instructions: `Create a high-level summary for non-technical stakeholders:

**Executive Summary Structure:**

1. **Overall Security Posture**
   - Risk level: Critical/High/Medium/Low
   - Key metrics at a glance
   - Trend vs previous assessment (if available)

2. **Key Findings**
   - Top 5 critical/high severity issues
   - Business impact of each
   - Recommended actions

3. **Compliance Status**
   - OWASP Top 10 coverage
   - ASVS compliance percentage (if applicable)
   - Regulatory considerations

4. **Remediation Progress**
   - Issues fixed vs open
   - In-progress remediations
   - Timeline to target state

5. **Recommendations**
   - Immediate actions required
   - Short-term improvements (next quarter)
   - Long-term security roadmap

**Tone and Style:**
- Business-focused language
- Avoid technical jargon where possible
- Emphasize risk and business impact
- Include clear call-to-action

Keep to 1-2 pages maximum.`,
      owaspTopics: ['Security Reporting'],
    },
    {
      id: 'generate-technical-findings',
      title: 'Generate Technical Findings Report',
      instructions: `Create detailed findings for developers and security teams:

**Technical Findings Structure:**

1. **Methodology**
   - Workflows executed
   - Scope of assessment
   - Tools and techniques used
   - OWASP references

2. **Detailed Findings**
   For each finding:
   - Title and severity
   - OWASP Top 10 category
   - ASVS reference (if applicable)
   - Affected components/files
   - Vulnerability description
   - Proof of concept (if applicable)
   - Business/technical impact
   - Remediation steps
   - Code examples

3. **Component Analysis**
   - By component: Findings per module
   - By layer: Frontend/backend/infra
   - By dependency: Third-party issues

4. **Attack Surface Summary**
   - External exposure points
   - Trust boundaries
   - Data flows and sensitivity

Include code snippets, file paths, and line numbers throughout.`,
      owaspTopics: ['ASVS Reporting'],
    },
    {
      id: 'generate-owasp-compliance',
      title: 'Generate OWASP Compliance Matrix',
      instructions: `Map findings to OWASP standards:

**OWASP Top 10 2021 Mapping:**

| Category | Findings | Critical | High | Medium | Low | Status |
|----------|----------|----------|------|--------|-----|--------|
| A01: Broken Access Control | X | X | X | X | X | Assess |
| A02: Cryptographic Failures | X | X | X | X | X | Assess |
| ... | ... | ... | ... | ... | ... | ... |

**Status Definitions:**
- Compliant: No findings, controls in place
- Needs Improvement: Some findings, remediation planned
- Non-Compliant: Critical/high findings, immediate action needed
- Not Assessed: Category not covered in this assessment

**ASVS Mapping (if applicable):**
- Map findings to ASVS v2.0 controls
- Show coverage by domain (Architecture, Authentication, etc.)
- Identify control gaps

**Compliance Score:**
- Calculate overall compliance percentage
- Show breakdown by category
- Highlight gaps requiring attention

Include references to OWASP documentation for each category.`,
      owaspTopics: ['ASVS Reporting'],
    },
    {
      id: 'generate-remediation-roadmap',
      title: 'Generate Remediation Roadmap',
      instructions: `Create a prioritized remediation plan:

**Remediation Roadmap Structure:**

1. **Immediate Actions (This Sprint)**
   - Critical severity findings
   - Easily exploitable issues
   - Quick wins with high impact

2. **Short-term (Next Quarter)**
   - High severity findings
   - Medium-risk widely deployed issues
   - Security control improvements

3. **Medium-term (Next 6 Months)**
   - Medium severity findings
   - Architecture improvements
   - Security tooling and process

4. **Long-term (Next Year)**
   - Low severity findings
   - Strategic security initiatives
   - Cultural and training improvements

**For each item:**
- Title and finding reference
- Estimated effort (story points or days)
- Dependencies on other work
- Risk of not addressing
- Recommended assignee
- Success criteria

**Tracking:**
- Create checklist format for tracking progress
- Include completion status
- Link to patches/issues/tickets

This roadmap should be actionable and time-bound.`,
      owaspTopics: ['Security Reporting'],
    },
  ],
  guardrails: [
    {
      type: 'preflight',
      description: 'Check which previous workflows were completed',
      condition: 'Survey available artifacts in .gss/artifacts/',
    },
    {
      type: 'scope',
      description: 'Generate reports based on available artifacts only',
      condition: 'If some workflows missing, note gaps in report',
    },
    {
      type: 'mutation',
      description: 'This workflow writes report files only - no code changes',
      condition: 'Only write to .gss/report/ directory',
    },
  ],
  runtimePrompts: {
    claude: `When generating security reports:

- Gather all available artifacts from .gss/artifacts/
- Create clear, actionable reports for different audiences
- Use formatting (tables, lists, headers) for readability
- Include specific file paths and line numbers
- Map all findings to OWASP Top 10 categories
- Provide actionable recommendations with priorities
- Track remediation progress
- Note any gaps or incomplete assessments

Output reports to .gss/report/ directory:

1. executive-summary.md - For stakeholders
2. technical-findings.md - For developers
3. owasp-compliance.md - For auditors/compliance
4. remediation-roadmap.md - For project planning`,
    codex: `Generate comprehensive security reports:

1. Aggregate all workflow artifacts
2. Create executive summary with key metrics
3. Document technical findings with evidence
4. Map findings to OWASP standards
5. Create prioritized remediation roadmap

Tailor each report to its audience with appropriate level of detail.`,
  },
  delegationPolicy: {
    mode: 'none',
    subjectSource: 'report sections and unresolved risk themes',
    constraints: {
      maxRequiredPerSubject: 0,
      maxOptionalPerSubject: 1,
      allowFollowUpSpecialists: false,
      maxFollowUpDepth: 0,
      failOnMissingRequired: false,
      allowOutOfPlanConsults: false,
    },
  },
};
