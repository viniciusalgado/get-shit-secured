import type { WorkflowDefinition } from '../../../core/types.js';

/**
 * Validate Findings workflow definition.
 * Generates exploitation test cases for each finding, runs them, and confirms/denies
 * findings before they reach plan-remediation. Prevents hallucinated issues from
 * wasting remediation effort.
 */
export const validateFindingsDefinition: WorkflowDefinition = {
  id: 'validate-findings',
  title: 'Findings Validation',
  goal: 'Validate security findings by generating exploitation test cases (unit, integration, e2e), running them, and confirming or denying each finding to prevent hallucinated issues from reaching remediation.',
  owaspTopics: [
    {
      name: 'Security Testing',
      glossaryUrl: 'https://owasp.org/www-project-web-security-testing-guide/',
    },
    {
      name: 'Vulnerability Verification',
      glossaryUrl: 'https://owasp.org/www-project-web-security-testing-guide/',
    },
  ],
  inputs: [
    {
      name: 'findings-report',
      type: 'json',
      required: true,
      description: 'Security findings from audit workflow with evidence, severity, and OWASP mappings',
    },
    {
      name: 'remediation-priorities',
      type: 'json',
      required: true,
      description: 'Prioritized findings from audit workflow',
    },
    {
      name: 'owasp-mapping',
      type: 'json',
      required: false,
      description: 'OWASP category mappings from audit workflow for specialist routing',
    },
  ],
  outputs: [
    {
      name: 'validated-findings',
      type: 'json',
      description: 'Findings with validation status (confirmed/unconfirmed/hallucinated) and test evidence',
      path: '.gss/artifacts/validate-findings/validated-findings.json',
    },
    {
      name: 'validation-report',
      type: 'json',
      description: 'Detailed test results per finding showing exploitation attempts and outcomes',
      path: '.gss/artifacts/validate-findings/validation-report.json',
    },
    {
      name: 'exploitation-tests',
      type: 'json',
      description: 'Generated exploitation test suite (unit, integration, e2e) keyed by finding ID',
      path: '.gss/artifacts/validate-findings/exploitation-tests.json',
    },
    {
      name: 're-evaluation-report',
      type: 'json',
      description: 'Specialist re-review results for findings that tests could not confirm',
      path: '.gss/artifacts/validate-findings/re-evaluation-report.json',
    },
    {
      name: 'tdd-test-document',
      type: 'json',
      description: 'TDD-style test document with failing-now and expected-after-fix specs for downstream remediation',
      path: '.gss/artifacts/validate-findings/tdd-test-document.json',
    },
  ],
  dependencies: [
    {
      workflowId: 'audit',
      requiredOutputs: ['findings-report', 'remediation-priorities'],
    },
  ],
  handoffs: [
    {
      nextWorkflow: 'plan-remediation',
      outputsToPass: ['validated-findings', 'tdd-test-document'],
    },
    {
      nextWorkflow: 'report',
      outputsToPass: ['validation-report', 're-evaluation-report'],
    },
  ],
  steps: [
    {
      id: 'ingest-findings',
      title: 'Ingest and Triage Findings',
      instructions: `Load findings from the audit workflow and prepare them for validation:

1. Read findings-report.json from .gss/artifacts/audit/
2. Read remediation-priorities.json from .gss/artifacts/audit/
3. For each finding, extract:
   - Finding ID, title, severity, confidence
   - OWASP category and evidence
   - Affected file paths and code snippets
   - Remediation notes (if any)

4. Triage findings into validation tiers:
   - **Tier 1 (Full validation):** Critical/High severity, high confidence, clear attack vector
   - **Tier 2 (Standard validation):** Medium severity, moderate confidence
   - **Tier 3 (Quick check):** Low severity, low confidence, informational

5. Skip findings that are purely informational (no exploitable path)

Output a triage manifest mapping each finding to its validation tier and planned test types.`,
      owaspTopics: ['Secure Code Review'],
    },
    {
      id: 'generate-exploitation-tests',
      title: 'Generate Exploitation Test Cases',
      instructions: `For each finding, generate appropriate exploitation test cases:

**Test Type Selection by Vulnerability Category:**

1. **Unit Tests** — Generate for:
   - Injection vulnerabilities (SQL, NoSQL, command, LDAP)
   - Input validation failures
   - Output encoding misses (XSS)
   - Cryptographic misuse
   - Business logic flaws
   - Test approach: Mock external dependencies, craft malicious payloads, verify rejection

2. **Integration Tests** — Generate for:
   - Authentication bypass attempts
   - Authorization/access control violations
   - Session management issues
   - CSRF vulnerabilities
   - File upload security
   - Test approach: Test through component boundaries, use test database/fixtures, verify trust boundary enforcement

3. **End-to-End Tests** — Generate for:
   - Multi-step attack chains
   - Full authentication/authorization flows
   - API endpoint security
   - Cross-component data flow exploits
   - Test approach: Sandboxed application instance, HTTP client, full request lifecycle

**For Each Test Case, Specify:**
- Test name and associated finding ID
- Test type (unit/integration/e2e)
- Setup: preconditions, fixtures, mocks needed
- Exploit payload: the malicious input or action
- Expected behavior: how the vulnerable system would respond
- Secure behavior: how a patched system should respond
- Assertion: what proves the vulnerability exists or doesn't

**Output Format:**
Write exploitation-tests.json to .gss/artifacts/validate-findings/ with all test cases keyed by finding ID.`,
      owaspTopics: ['Security Testing', 'Vulnerability Verification'],
    },
    {
      id: 'run-unit-validation',
      title: 'Run Unit-Level Validation',
      instructions: `Execute unit-level exploitation tests for findings that require them:

1. **Setup Test Harness**
   - Create temporary test files in the project's test directory structure
   - Use the project's existing test framework (jest, pytest, vitest, etc.)
   - Configure mocks and fixtures as specified in exploitation-tests.json

2. **Execute Unit Tests**
   For each unit test in the exploitation test suite:
   - Write the test to a temporary test file
   - Run the test in isolation
   - Capture the result (pass = vulnerability confirmed, fail = vulnerability not reproducible)
   - Record execution output and timing

3. **Safety Constraints**
   - Tests MUST be read-only except for test directory writes
   - Tests MUST NOT modify source files, configuration, or database
   - Tests MUST NOT make external network calls
   - Clean up temporary test files after execution

4. **Record Results**
   For each test:
   - Finding ID and test name
   - Result: confirmed / not-reproducible / error
   - Evidence: test output, error messages
   - Execution time

   Write results to validation-report.json (unit section).`,
      owaspTopics: ['Security Testing'],
    },
    {
      id: 'run-integration-validation',
      title: 'Run Integration-Level Validation',
      instructions: `Execute integration-level exploitation tests for findings that require them:

1. **Setup Integration Environment**
   - Identify components involved in the finding
   - Set up test fixtures (test database, mock services, test users)
   - Configure the test environment with known-good state

2. **Execute Integration Tests**
   For each integration test:
   - Test through actual component boundaries (not mocked)
   - Use real database queries against test database
   - Test actual middleware, authentication layers, data transformations
   - Verify trust boundary enforcement end-to-end within component scope

3. **Specific Test Patterns:**
   - **Auth bypass:** Attempt access with invalid/missing tokens
   - **IDOR:** Access resources with different user contexts
   - **Privilege escalation:** Attempt admin actions as regular user
   - **Data leakage:** Query for data belonging to other users
   - **Session fixation:** Attempt session token manipulation

4. **Record Results**
   For each test:
   - Finding ID and test name
   - Result: confirmed / not-reproducible / inconclusive / error
   - Evidence: HTTP responses, database state, log output
   - Scope of components tested

   Append results to validation-report.json (integration section).`,
      owaspTopics: ['Security Testing'],
    },
    {
      id: 'run-e2e-validation',
      title: 'Run End-to-End Validation',
      instructions: `Execute end-to-end exploitation tests for high-severity findings that require full attack chain validation:

**IMPORTANT:** Get user approval before running e2e tests. These tests exercise the full application stack.

1. **E2E Test Scope**
   Only run e2e tests for:
   - Critical severity findings
   - High severity findings where unit/integration tests were inconclusive
   - Multi-step attack chains that span components

2. **Setup E2E Environment**
   - Use a sandboxed test instance of the application
   - Seed with test data only
   - Configure for safe testing (no real emails, no real payments, etc.)
   - Ensure clean teardown after tests

3. **Execute E2E Tests**
   For each e2e test:
   - Execute the full attack path from user entry point to vulnerability manifestation
   - Capture all intermediate states
   - Verify the exploit chain succeeds (confirms vulnerability) or fails (finding may be false)

4. **Safety Constraints**
   - MUST run against sandboxed/test environment only
   - MUST NOT affect production data or services
   - MUST clean up all test artifacts
   - MUST get explicit user approval before execution

5. **Record Results**
   For each test:
   - Finding ID and test name
   - Result: confirmed / not-reproducible / inconclusive / error
   - Full evidence: request/response chains, intermediate states
   - Attack chain diagram (if applicable)

   Append results to validation-report.json (e2e section).`,
      owaspTopics: ['Security Testing', 'Vulnerability Verification'],
    },
    {
      id: 'classify-findings',
      title: 'Classify Findings by Validation Status',
      instructions: `Based on all test results (unit + integration + e2e), classify each finding:

**Classification Rules:**

1. **confirmed** — Finding is a real vulnerability
   - At least one test successfully exploited the vulnerability
   - OR multiple tests show evidence of the issue (even if no single test fully exploits it)
   - Confirmed findings proceed to remediation planning

2. **unconfirmed** — Tests could neither prove nor disprove the finding
   - Tests produced inconclusive results
   - Tests encountered errors that prevented validation
   - The vulnerability type is not easily testable in isolation
   - Unconfirmed findings go to re-evaluation

3. **hallucinated** — Tests strongly suggest the finding is false
   - All tests designed for this finding failed to reproduce the issue
   - The code path described in the finding does not exist or is not reachable
   - Existing safeguards already prevent the described attack
   - Hallucinated findings go to re-evaluation for a second opinion before discarding

**For Each Finding, Document:**
- Original finding ID, title, severity
- Classification: confirmed / unconfirmed / hallucinated
- Test summary: how many tests ran, how many passed/failed
- Key evidence supporting the classification
- Confidence adjustment: original confidence vs validated confidence
- Recommended action: proceed / re-evaluate / dismiss

Write classifications to validated-findings.json.`,
      owaspTopics: ['Secure Code Review', 'Vulnerability Verification'],
    },
    {
      id: 're-evaluate-unconfirmed',
      title: 'Re-evaluate Unconfirmed and Hallucinated Findings',
      instructions: `For findings classified as unconfirmed or hallucinated, trigger specialist re-evaluation:

**Re-evaluation Process:**

1. **Select Findings for Re-evaluation**
   - All findings classified as "hallucinated" — get a second opinion before discarding
   - All findings classified as "unconfirmed" with original severity of Medium or above
   - Skip re-evaluation for Low-severity unconfirmed findings (flag as informational)

2. **Delegate to OWASP Specialists**
   For each finding requiring re-evaluation:
   - Route to the relevant OWASP specialist based on the vulnerability category
   - Provide the specialist with:
     - Original finding details and evidence
     - All test results and their outputs
     - Classification rationale
   - Ask the specialist to assess:
     - Whether the finding describes a real vulnerability
     - Whether the tests adequately tested the described vulnerability
     - Whether the finding should be confirmed, kept as unconfirmed, or dismissed

3. **Process Specialist Verdicts**
   - If specialist confirms: upgrade to "confirmed", adjust confidence
   - If specialist dismisses with high confidence: mark as "dismissed", document rationale
   - If specialist is uncertain: keep as "unconfirmed", flag for manual review in report

4. **Record Re-evaluation**
   For each re-evaluated finding:
   - Finding ID
   - Specialist consulted
   - Specialist verdict and confidence
   - Final classification after re-evaluation
   - Rationale for the final classification

Write to re-evaluation-report.json.`,
      owaspTopics: ['Secure Code Review'],
    },
    {
      id: 'compile-validated-findings',
      title: 'Compile Validated Findings and TDD Test Document',
      instructions: `Compile the final outputs for downstream workflows:

**1. Finalize validated-findings.json**

For each finding, include:
- Original finding data (ID, title, severity, evidence, OWASP mapping, location)
- Validation status: confirmed / unconfirmed / dismissed / informational
- Validation confidence: 0-1 score adjusted by test results
- Test evidence summary: which tests ran, key results
- Re-evaluation notes (if applicable)
- Remediation priority (re-calculated based on validated confidence)

Only include findings with status "confirmed" or "unconfirmed" in the
priority list for plan-remediation. Dismissed findings are documented
but excluded from remediation planning.

**2. Generate tdd-test-document.json**

For each confirmed finding, produce TDD-style test specs:
- **failing-now**: Test that demonstrates the current vulnerability
  - Test code (ready to add to project test suite)
  - Expected failure behavior
- **expected-after-fix**: Test that verifies the fix
  - Same test modified to expect secure behavior
  - How to verify the fix works
- **integration hook**: How this test connects to the verify workflow

Structure the document so plan-remediation and verify workflows can
consume it directly:
- Each entry keyed by finding ID
- Includes file path suggestions for test placement
- References the project's test framework
- Marks which tests are safe to add immediately vs need sandboxed env

**3. Write all artifacts to .gss/artifacts/validate-findings/**
- validated-findings.json
- validation-report.json
- exploitation-tests.json
- re-evaluation-report.json
- tdd-test-document.json`,
      owaspTopics: ['Security Testing', 'Secure Code Review'],
    },
  ],
  guardrails: [
    {
      type: 'preflight',
      description: 'Verify audit artifacts exist before starting validation',
      condition: 'Check for findings-report and remediation-priorities in .gss/artifacts/audit/',
    },
    {
      type: 'mutation',
      description: 'May only write test files to test directories. Never modify source, config, or tracked files.',
      condition: 'Test files written only to project test directories. Source files are read-only.',
    },
    {
      type: 'approval',
      description: 'Get user approval before running e2e validation tests',
      condition: 'Before executing any end-to-end tests that exercise the full application stack',
    },
    {
      type: 'scope',
      description: 'Only validate findings provided by audit. Do not discover new vulnerabilities.',
      condition: 'Throughout all validation phases',
    },
  ],
  runtimePrompts: {
    claude: `This workflow validates security findings from the audit workflow.

**Validation Process:**
1. Ingest findings from audit and triage by severity/confidence
2. Generate exploitation test cases (unit, integration, e2e) tailored to each vulnerability
3. Run tests in sandboxed environment, recording results
4. Classify findings: confirmed (real), unconfirmed (needs review), hallucinated (likely false)
5. Re-evaluate disputed findings with OWASP specialists
6. Compile validated findings and TDD test document

**Key Principles:**
- Be aggressive in testing but conservative in classification
- A finding is "confirmed" only if at least one test proves exploitability
- A finding is "hallucinated" only if all tests fail AND specialist agrees
- Unconfirmed findings deserve the benefit of the doubt — flag for manual review
- Never dismiss a Critical or High finding without specialist confirmation

**Test Generation Strategy:**
- Injection flaws → unit tests with malicious payloads
- Auth issues → integration tests through real middleware
- Multi-step attacks → e2e tests with full request lifecycle
- Crypto issues → unit tests verifying algorithm/parameter choices

**MCP Consultation for Re-evaluation:**
For re-evaluation, consult MCP tools for the vulnerability category:
- SQL injection → MCP sql-injection-prevention doc
- XSS → MCP cross-site-scripting-prevention doc
- Auth issues → MCP authentication and authorization docs
- Crypto → MCP cryptographic-storage doc
- General → MCP secure-code-review doc

**Output:**
Persist all artifacts under .gss/artifacts/validate-findings/.
The validated-findings.json and tdd-test-document.json feed into plan-remediation.`,
    codex: `Validate security findings from the audit:

1. Ingest findings and triage by severity
2. Generate exploitation test cases (unit/integration/e2e)
3. Run tests in sandboxed environment
4. Classify as confirmed/unconfirmed/hallucinated
5. Re-evaluate disputed findings using MCP consultation
6. Compile validated findings and TDD test specs

Only confirmed and unconfirmed findings proceed to remediation.

Output artifacts to .gss/artifacts/validate-findings/.`,
  },
  signalDerivation: {
    stacks: 'from-prior-artifact',
    issueTags: 'from-findings',
    changedFiles: 'none',
  },
};
