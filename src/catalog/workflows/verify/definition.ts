import type { WorkflowDefinition } from '../../../core/types.js';

/**
 * Verify workflow definition.
 * Grounded in OWASP ASVS verification standards and security testing best practices.
 */
export const verifyDefinition: WorkflowDefinition = {
  id: 'verify',
  title: 'Security Verification',
  goal: 'Confirm security remediations are properly implemented, no regressions were introduced, and test coverage is adequate.',
  owaspTopics: [
    {
      name: 'ASVS Security Verification',
      glossaryUrl: 'https://cheatsheetseries.owasp.org/Glossary.html',
    },
    {
      name: 'Security Testing',
      glossaryUrl: 'https://cheatsheetseries.owasp.org/Glossary.html',
    },
    {
      name: 'Regression Testing',
      glossaryUrl: 'https://cheatsheetseries.owasp.org/Glossary.html',
    },
  ],
  inputs: [
    {
      name: 'patch-plan',
      type: 'json',
      required: true,
      description: 'Patch plan from plan-remediation workflow',
    },
    {
      name: 'application-report',
      type: 'json',
      required: true,
      description: 'Application report from execute-remediation workflow showing what was actually applied',
    },
    {
      name: 'test-specifications',
      type: 'json',
      required: true,
      description: 'Test specifications from plan-remediation workflow',
    },
    {
      name: 'findings-report',
      type: 'json',
      required: false,
      description: 'Original findings from audit workflow for verification',
    },
    {
      name: 'deviations-log',
      type: 'markdown',
      required: false,
      description: 'Deviations from the plan from execute-remediation workflow',
    },
  ],
  outputs: [
    {
      name: 'verification-report',
      type: 'json',
      description: 'Pass/fail status for each remediation with evidence',
      path: '.gss/artifacts/verify/verification-report.json',
    },
    {
      name: 'regression-analysis',
      type: 'json',
      description: 'Analysis of whether remediations caused regressions',
      path: '.gss/artifacts/verify/regression-analysis.json',
    },
    {
      name: 'test-coverage-report',
      type: 'json',
      description: 'Test coverage metrics for security fixes',
      path: '.gss/artifacts/verify/test-coverage.json',
    },
    {
      name: 'residual-risk-assessment',
      type: 'json',
      description: 'Any remaining risks or partial fixes',
      path: '.gss/artifacts/verify/residual-risk-assessment.json',
    },
  ],
  dependencies: [
    {
      workflowId: 'plan-remediation',
      requiredOutputs: ['patch-plan', 'test-specifications'],
    },
    {
      workflowId: 'execute-remediation',
      requiredOutputs: ['application-report'],
    },
  ],
  handoffs: [
    {
      nextWorkflow: 'report',
      outputsToPass: ['verification-report', 'regression-analysis', 'test-coverage-report'],
    },
  ],
  steps: [
    {
      id: 'verify-remediations',
      title: 'Verify Each Remediation Implementation',
      instructions: `Cross-check the application report against the patch plan to verify what was actually applied:

**Cross-Check Process:**

1. **Compare Plan vs Actual**
   - Read patch-plan.json from plan-remediation workflow
   - Read application-report.json from execute-remediation workflow
   - Cross-check: for each patch in the plan, find its status in the application report

2. **Verify Applied Fixes (status: "applied")**
   For each remediation with status "applied":
   - **Code Review**
     - Patch was applied exactly as specified in the plan
     - No unintended changes included
     - Code style consistent with project
     - Comments explain security context

   - **Vulnerability Fixed**
     - Original vulnerability no longer exploitable
     - Attack attempt is now properly blocked
     - Error handling is appropriate
     - Edge cases are covered

   - **Security Principles Applied**
     - Input validation at trust boundaries
     - Output encoding for correct context
     - Authentication/authorization present
     - Least privilege principle followed
     - Fail securely on errors

3. **Verify Partial Fixes (status: "partial")**
   For each remediation with status "partial":
   - Review what was actually applied
   - Assess whether the partial fix provides adequate protection
   - Review deviations log for rationale
   - Document risk of incomplete application
   - Recommend completion or acceptance

4. **Document Blocked Items as Residual Risk (status: "blocked")**
   For each remediation with status "blocked":
   - Document as residual risk in residual-risk-assessment.json
   - Include the blocker from the application report
   - Assess severity of the unaddressed vulnerability
   - Recommend alternative approaches or next steps

5. **Document Skipped Items (status: "skipped")**
   For each remediation with status "skipped":
   - Review the skip reason
   - If already fixed, verify the fix is in place
   - If intentionally skipped, document acceptance decision
   - Include in residual risks if vulnerability remains

**For Each Verified Remediation, Document:**
- Patch ID and title
- Application status: applied/partial/blocked/skipped
- Verification method: code review, test, manual check
- Evidence: Code snippet, test output, or screenshot
- Result: Pass/Fail/Needs Review with reasoning
- Deviations noted (if any)

Reference relevant ASVS controls for verification criteria.`,
      owaspTopics: ['ASVS Security Verification'],
    },
    {
      id: 'run-security-tests',
      title: 'Run Security Tests',
      instructions: `Execute the test specifications to verify fixes:

**Test Execution:**
1. **Unit Tests**
   - Run new tests added for security fixes
   - Verify all pass
   - Check test coverage for fixed code

2. **Integration Tests**
   - Run end-to-end tests through fixed components
   - Verify secure behavior at trust boundaries
   - Test authentication/authorization flows

3. **Security-Specific Tests**
   - Attempt original vulnerability - should fail
   - Test with malicious inputs - should be rejected
   - Test edge cases and boundary conditions
   - Verify error messages don't leak information

**For each test:**
- Test name and specification reference
- Execution result: Pass/Fail/Skip
- Runtime or error output
- Coverage metrics (lines/branches/functions)

**Aggregated Results:**
- Total tests run
- Pass rate
- Failures with investigation needed
- Coverage percentage for fixed files

Document any tests that couldn't run and why.`,
      owaspTopics: ['Security Testing'],
    },
    {
      id: 'check-regressions',
      title: 'Check for Regressions',
      instructions: `Verify remediations didn't break existing functionality:

**Regression Areas:**
1. **Functional Regression**
   - Existing features still work
   - User flows unchanged (except for security)
   - API contracts maintained

2. **Performance Regression**
   - Response times not significantly degraded
   - Resource usage reasonable
   - No new bottlenecks introduced

3. **Usability Regression**
   - Legitimate users not blocked
   - Error messages clear and actionable
   - Authentication not overly burdensome

**Regression Testing:**
- Run existing test suite
- Check for new failures
- Investigate any test failures
- Determine if security fix caused breakage

**For each regression found:**
- Description of broken functionality
- Related security fix
- Severity: Critical/High/Medium/Low
- Proposed resolution (adjust fix, accept change, etc.)

Document any acceptable trade-offs between security and usability.`,
      owaspTopics: ['Regression Testing'],
    },
    {
      id: 'validate-config-changes',
      title: 'Validate Configuration Changes',
      instructions: `If remediations included configuration changes, verify them:

**Configuration Validation:**
1. **Settings Applied**
   - New settings are in place
   - Old insecure settings removed
   - Environment-specific configs updated

2. **Security Headers**
   - Content-Security-Policy present and correct
   - Strict-Transport-Security enabled (if HTTPS)
   - X-Frame-Options, X-Content-Type-Options set
   - Permissions-Policy configured

3. **Server Configuration**
   - TLS/SSL settings correct
   - Cipher suites secure
   - HTTP methods restricted (no TRACE, etc.)
   - Directory listing disabled

4. **Application Configuration**
   - Debug mode off in production
   - Error reporting appropriate
   - Session settings secure
   - File upload restrictions in place

**For each config change:**
- Configuration file and setting
- Expected vs actual value
- Test result (working/broken)
- Documentation of change

Document any configuration that couldn't be changed and why.`,
      owaspTopics: ['ASVS Security Verification'],
    },
    {
      id: 'assess-test-coverage',
      title: 'Assess Test Coverage',
      instructions: `Evaluate test coverage for security fixes:

**Coverage Analysis:**
1. **Code Coverage**
   - Percentage of fixed code covered by tests
   - Branch coverage for conditional logic
   - Function coverage for security functions

2. **Test Quality**
   - Tests verify security, not just functionality
   - Tests include malicious inputs
   - Tests check error conditions
   - Tests are maintainable and clear

3. **Coverage Gaps**
   - Uncovered code paths
   - Missing edge case tests
   - Insufficient negative testing

**Coverage Targets:**
- Aim for >80% line coverage on fixed code
- 100% coverage on security-critical paths
- Tests for all input validation
- Tests for all authorization checks

**For each gap:**
- Code location lacking coverage
- Risk level of uncovered code
- Recommended additional tests

Document overall coverage assessment and improvements needed.`,
      owaspTopics: ['Security Testing'],
    },
    {
      id: 'document-residual-risks',
      title: 'Document Residual Risks',
      instructions: `Identify any remaining security risks after verification:

**Residual Risk Categories:**
1. **Partial Fixes**
   - Vulnerability mitigated but not eliminated
   - Workaround applied instead of proper fix
   - Fix covers some cases but not all

2. **Deferred Fixes**
   - Fix postponed due to complexity
   - Requires architectural changes
   - Awaiting external dependencies

3. **Accepted Risks**
   - Risk acknowledged and accepted
   - Cost of fix exceeds risk (document rationale)
   - Compensating controls in place

4. **New Risks**
   - Fix introduced new issues
   - Configuration change created exposure
   - Dependency added vulnerabilities

**For each residual risk:**
- Risk title and description
- Severity and likelihood
- Why not fully addressed
- Recommended next steps
- Acceptance decision and authority

This feeds into the final report for stakeholders.`,
      owaspTopics: ['Risk Assessment'],
    },
  ],
  guardrails: [
    {
      type: 'preflight',
      description: 'Verify plan-remediation artifacts exist before starting',
      condition: 'Check for patch-plan and test-specifications',
    },
    {
      type: 'approval',
      description: 'Confirm verification scope with user',
      condition: 'Ask which patches to verify if many exist',
    },
    {
      type: 'mutation',
      description: 'This workflow is primarily read-only - test execution only',
      condition: 'Only run tests, do not modify code',
    },
  ],
  runtimePrompts: {
    claude: `When verifying security fixes:

- Be thorough - verify each patch was applied correctly
- Run the test suite and document results
- Check for regressions in existing functionality
- Validate configuration changes are in place
- Assess test coverage for security-critical code
- Document any residual risks or partial fixes
- Reference ASVS controls for verification criteria

## MCP Consultation for Verification

1. Derive signals from findings and applied patches
2. Call get_workflow_consultation_plan(workflowId="verify", stacks=..., issueTags=...)
3. Read required docs to understand what the correct fix should look like
4. Compare applied fix against MCP document guidance
5. Call validate_security_consultation before finalizing

### Verification Protocol

1. **Review the fix** - Understand what was changed
2. **Consult MCP docs** - Get the governing security document for the fix domain
3. **Run tests** - Execute test specifications
4. **Aggregate results** - Combine MCP guidance with test results

Output artifacts to .gss/artifacts/verify/ for use by the report workflow.

## Artifact Output Contract

Every JSON artifact must include envelope fields at the top level:
{
  "schemaVersion": 1,
  "workflowId": "verify",
  "gssVersion": "<from session>",
  "corpusVersion": "<from MCP>",
  "generatedAt": "<ISO 8601>",
  "consultationMode": "required",
  "consultation": {
    "plan": { ... },
    "consultedDocs": [...],
    "coverageStatus": "pass|warn|fail",
    "requiredMissing": [],
    "notes": []
  },
  ... payload ...
}`,
    codex: `Verify security remediations:

1. Review implemented patches
2. Execute test suites
3. Check for regressions
4. Validate configuration changes
5. Assess test coverage
6. Document residual risks

## MCP Consultation

Use MCP consultation tools to get domain-specific verification guidance for each remediation domain.

Focus on evidence-based verification.

## Artifact Output Contract

Every JSON artifact must include envelope fields: schemaVersion: 1, workflowId: "verify", gssVersion, corpusVersion, generatedAt, consultationMode: "required", and "consultation" section with plan, consultedDocs, coverageStatus, requiredMissing, and notes.`,
  },
  signalDerivation: {
    stacks: 'from-prior-artifact',
    issueTags: 'from-findings',
    changedFiles: 'from-prior-artifact',
  },
  consultationMode: 'required',
};
