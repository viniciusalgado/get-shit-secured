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
      cheatSheetUrls: [],
    },
    {
      name: 'Security Testing',
      glossaryUrl: 'https://cheatsheetseries.owasp.org/Glossary.html',
      cheatSheetUrls: [],
    },
    {
      name: 'Regression Testing',
      glossaryUrl: 'https://cheatsheetseries.owasp.org/Glossary.html',
      cheatSheetUrls: [],
    },
  ],
  inputs: [
    {
      name: 'patch-plan',
      type: 'json',
      required: true,
      description: 'Patch plan from remediate workflow',
    },
    {
      name: 'test-specifications',
      type: 'json',
      required: true,
      description: 'Test specifications from remediate workflow',
    },
    {
      name: 'findings-report',
      type: 'json',
      required: false,
      description: 'Original findings from audit workflow for verification',
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
      name: 'residual-risks',
      type: 'markdown',
      description: 'Any remaining risks or partial fixes',
      path: '.gss/artifacts/verify/residual-risks.md',
    },
  ],
  dependencies: [
    {
      workflowId: 'remediate',
      requiredOutputs: ['patch-plan', 'test-specifications'],
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
      instructions: `For each patch in the patch plan, verify implementation:

**Verification Checklist:**
1. **Code Review**
   - Patch was applied exactly as specified
   - No unintended changes included
   - Code style consistent with project
   - Comments explain security context

2. **Vulnerability Fixed**
   - Original vulnerability no longer exploitable
   - Attack attempt is now properly blocked
   - Error handling is appropriate
   - Edge cases are covered

3. **Security Principles Applied**
   - Input validation at trust boundaries
   - Output encoding for correct context
   - Authentication/authorization present
   - Least privilege principle followed
   - Fail securely on errors

**For each remediation, document:**
- Patch ID and title
- Implementation status: Complete/Partial/Not Applied
- Verification method (code review, test, manual check)
- Evidence: Code snippet, test output, or screenshot
- Result: Pass/Fail with reasoning

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
      description: 'Verify remediate artifacts exist before starting',
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

## Specialist Confirmation Required

For fixes touching these areas, always delegate to the corresponding specialist for confirmation:

1. **Authentication/Authorization** → \`gss-specialist-authentication\`, \`gss-specialist-authorization\`, \`gss-specialist-multifactor-authentication\`
2. **Session Management** → \`gss-specialist-session-management\`
3. **Password/Secrets** → \`gss-specialist-password-storage\`, \`gss-specialist-secrets-management\`
4. **Cryptography** → \`gss-specialist-cryptographic-storage\`, \`gss-specialist-key-management\`
5. **TLS/Transport** → \`gss-specialist-transport-layer-security\`, \`gss-specialist-transport-layer-protection\`
6. **Headers/CSP** → \`gss-specialist-http-headers\`, \`gss-specialist-content-security-policy\`
7. **Configuration** → \`gss-specialist-error-handling\`, \`gss-specialist-logging\`

### Verification Protocol

1. **Review the fix** - Understand what was changed
2. **Identify affected domain** - Map to OWASP specialist
3. **Delegate to specialist** - Get specialist verdict on the fix
4. **Run tests** - Execute test specifications
5. **Aggregate results** - Combine specialist verdicts with test results

### Specialist Verification Output

Each specialist should provide:
- \`verdict\`: pass/fail/needs-review on the fix
- \`confidence\`: 0-1 score
- \`evidence\`: what was checked
- \`verificationNotes\`: how to verify the fix
- \`owaspSourceUrl\`: governing cheat sheet

Output artifacts to .gss/artifacts/verify/ for use by the report workflow.`,
    codex: `Verify security remediations:

1. Review implemented patches
2. Execute test suites
3. Check for regressions
4. Validate configuration changes
5. Assess test coverage
6. Document residual risks

## Specialist Consultation

For fixes involving authentication, crypto, sessions, config, or transport, delegate to the corresponding OWASP specialist for confirmation. Specialists return structured verdicts with verification notes.

Focus on evidence-based verification.`,
  },
};
