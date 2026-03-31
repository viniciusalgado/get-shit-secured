import type { WorkflowDefinition } from '../../../core/types.js';

/**
 * Remediate workflow definition.
 * Grounded in OWASP Secure Coding Practices and remediation best practices.
 */
export const remediateDefinition: WorkflowDefinition = {
  id: 'remediate',
  title: 'Security Remediation Planning',
  goal: 'Prepare safe, minimal remediation plans with implementation guidance, test specifications, and rollback procedures. This workflow does NOT mutate code - it creates plans for apply-patches to execute.',
  owaspTopics: [
    {
      name: 'Secure Coding Practices',
      glossaryUrl: 'https://cheatsheetseries.owasp.org/Glossary.html',
      cheatSheetUrls: [],
    },
    {
      name: 'Patch Management',
      glossaryUrl: 'https://cheatsheetseries.owasp.org/Glossary.html',
      cheatSheetUrls: [],
    },
    {
      name: 'Defense in Depth',
      glossaryUrl: 'https://cheatsheetseries.owasp.org/Glossary.html',
      cheatSheetUrls: [],
    },
  ],
  inputs: [
    {
      name: 'findings-report',
      type: 'json',
      required: true,
      description: 'Security findings from audit workflow',
    },
    {
      name: 'remediation-priorities',
      type: 'json',
      required: true,
      description: 'Prioritized findings from audit workflow',
    },
    {
      name: 'mitigation-requirements',
      type: 'markdown',
      required: false,
      description: 'Mitigation requirements from threat-model workflow (if available)',
    },
  ],
  outputs: [
    {
      name: 'patch-plan',
      type: 'json',
      description: 'Structured plan for applying security fixes with dependencies and ordering',
      path: '.gss/artifacts/remediate/patch-plan.json',
    },
    {
      name: 'implementation-guide',
      type: 'markdown',
      description: 'Step-by-step implementation instructions for each remediation',
      path: '.gss/artifacts/remediate/implementation-guide.md',
    },
    {
      name: 'test-specifications',
      type: 'json',
      description: 'Test cases to verify each remediation works correctly',
      path: '.gss/artifacts/remediate/test-specs.json',
    },
    {
      name: 'rollback-plan',
      type: 'markdown',
      description: 'Rollback procedures if remediations cause issues',
      path: '.gss/artifacts/remediate/rollback-plan.md',
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
      nextWorkflow: 'apply-patches',
      outputsToPass: ['patch-plan', 'implementation-guide', 'test-specifications', 'rollback-plan'],
    },
  ],
  steps: [
    {
      id: 'analyze-findings',
      title: 'Analyze Findings and Group Remediations',
      instructions: `Review the security findings and group them for efficient remediation:

**Grouping Strategy:**
1. **By file/component** - Fix multiple issues in the same file together
2. **By vulnerability type** - Similar fixes can use patterns
3. **By dependency** - Some fixes must come before others
4. **By risk level** - Critical fixes should be applied first

**For each group, determine:**
- Affected files and components
- Dependencies between fixes
- Risk of introducing regressions
- Testing requirements
- Rollback approach

**Create fix categories:**
- Quick wins: Simple, low-risk fixes
- Moderate: Require careful testing
- Complex: May require design changes or multiple files
- Dependencies: Version upgrades, framework changes

Output a prioritized remediation plan.`,
      owaspTopics: ['Patch Management'],
    },
    {
      id: 'design-remediations',
      title: 'Design Remediation Approaches',
      instructions: `For each finding, design a remediation following secure coding principles:

**Remediation Design Principles:**
1. **Minimal Change** - Fix only what's broken, avoid refactoring
2. **Defense in Depth** - Add layers of protection where appropriate
3. **Fail Securely** - Default to secure behavior on errors
4. **Least Privilege** - Use minimum required permissions
5. **Input Validation** - Validate at trust boundaries
6. **Output Encoding** - Encode for the correct context

**For each remediation, specify:**
- Exact code changes needed (before/after)
- Files to modify
- New dependencies (if any)
- Configuration changes required
- Migration steps (for data/schema changes)
- Testing approach to verify fix

**Common patterns:**
- Injection: Use parameterized queries
- XSS: Context-appropriate output encoding
- Auth failures: Proper error handling (don't leak info)
- Secrets: Use environment variables/secret managers
- Missing auth: Add authorization checks`,
      owaspTopics: ['Secure Coding Practices', 'Defense in Depth'],
    },
    {
      id: 'generate-patches',
      title: 'Generate Security Patches',
      instructions: `Generate concrete code patches for each remediation:

**Patch Format:**
For each patch, provide:
1. **File path** - Exact file to modify
2. **Line numbers** - Where changes apply
3. **Diff format** - Unified diff showing before/after
4. **Reasoning** - Why this fixes the issue
5. **Side effects** - What else might be affected

**Best Practices:**
- Preserve existing code style and formatting
- Don't refactor unrelated code
- Add comments explaining security fixes
- Follow project's coding conventions
- Use language/framework idioms correctly

**Example patch for SQL injection:**
\`\`\`diff
- const query = "SELECT * FROM users WHERE id = " + userId;
+ const query = "SELECT * FROM users WHERE id = ?";
+ const result = db.query(query, [userId]);
\`\`\`

**Example patch for missing auth:**
\`\`\`diff
+ function requireAuth(req, res, next) {
+   if (!req.session?.userId) {
+     return res.status(401).json({ error: 'Unauthorized' });
+   }
+   next();
+ }
+
 app.get('/api/admin', requireAuth, adminHandler);
\`\`\`

Generate patches in order of priority.`,
      owaspTopics: ['Patch Management'],
    },
    {
      id: 'specify-tests',
      title: 'Specify Verification Tests',
      instructions: `Design tests to verify each remediation:

**Test Categories:**

1. **Unit Tests** - Test the specific fix in isolation
   - Positive case: Valid input works correctly
   - Negative case: Invalid input is rejected
   - Edge cases: Boundary conditions, special characters

2. **Integration Tests** - Test the fix in context
   - End-to-end flow through the fixed component
   - Interaction with other components
   - Authentication/authorization flows

3. **Regression Tests** - Ensure nothing else broke
   - Existing functionality still works
   - Performance not degraded
   - User experience unchanged

**For each test, specify:**
- Test name and description
- Test setup (preconditions)
- Test execution (steps)
- Expected result
- Actual vulnerability the test prevents

**Example test for SQL injection fix:**
\`\`\`javascript
describe('User lookup', () => {
  it('should reject SQL injection attempts', async () => {
    const maliciousId = "1' OR '1'='1";
    const result = await getUserById(maliciousId);
    expect(result).toBeNull();
  });
});
\`\`\``,
      owaspTopics: ['Secure Coding Practices'],
    },
    {
      id: 'create-rollback-plan',
      title: 'Create Rollback Plan',
      instructions: `Document how to roll back each remediation if issues arise:

**Rollback Planning:**
For each remediation, document:
1. **What changed** - Files and configurations modified
2. **How to revert** - Exact steps to undo
3. **Data migration** - If schema/data changed, how to revert
4. **Dependencies** - What needs to be rolled back together
5. **Monitoring** - What to watch for after deployment

**Rollback Strategies:**
- Code: Revert commit, redeploy previous version
- Config: Revert configuration file
- Dependencies: Pin to previous version
- Database: Revert migration script

**Document triggers for rollback:**
- Application errors or crashes
- Performance degradation
- User-reported issues
- Failed tests in production monitoring`,
      owaspTopics: ['Patch Management'],
    },
  ],
  guardrails: [
    {
      type: 'preflight',
      description: 'Verify audit artifacts exist before starting',
      condition: 'Check for findings-report and remediation-priorities',
    },
    {
      type: 'mutation',
      description: 'This workflow is planning-only - DO NOT write any code changes to the repository',
      condition: 'Only generate plans and documentation - never modify source files, config files, or test files directly',
    },
    {
      type: 'approval',
      description: 'Remediation plans should be reviewed before apply-patches',
      condition: 'Inform user that plans are ready for review and will be executed by apply-patches workflow',
    },
    {
      type: 'scope',
      description: 'Limit remediation plans to findings provided - don\'t add unrelated changes',
      condition: 'Only plan fixes for what was identified in the audit',
    },
  ],
  runtimePrompts: {
    claude: `When generating remediation plans:

**IMPORTANT:** This workflow creates PLANS only. It does NOT modify code.

**Planning Process:**
- Prioritize Critical and High severity findings first
- Design minimal, safe fixes
- Create detailed implementation guides
- Generate test specifications
- Document rollback procedures
- Use language/framework best practices
- Reference OWASP cheat sheets for proven patterns

**DO NOT:**
- Write to any source files
- Modify configuration files
- Create or delete files
- Run git commands

**DO:**
- Generate comprehensive patch plans
- Create detailed implementation instructions
- Specify test cases for verification
- Document rollback procedures

## Specialist-Guided Planning

For each finding, delegate to the appropriate OWASP specialist to get remediation guidance:

1. **Password issues** → \`gss-specialist-password-storage\`
2. **SQL injection** → \`gss-specialist-sql-injection-prevention\`, \`gss-specialist-query-parameterization\`
3. **XSS** → \`gss-specialist-cross-site-scripting-prevention\`
4. **Command injection** → \`gss-specialist-os-command-injection-defense\`
5. **Auth/authorization** → \`gss-specialist-authentication\`, \`gss-specialist-authorization\`
6. **Session issues** → \`gss-specialist-session-management\`
7. **Crypto/secrets** → \`gss-specialist-cryptographic-storage\`, \`gss-specialist-secrets-management\`
8. **File upload** → \`gss-specialist-file-upload\`
9. **CSRF** → \`gss-specialist-cross-site-request-forgery-prevention\`

### Framework-Specific Planning

When the codebase uses specific frameworks, delegate for idiomatic fixes:
- **Django** → \`gss-specialist-django-security\`, \`gss-specialist-django-rest-framework\`
- **Laravel** → \`gss-specialist-laravel\`
- **Node.js** → \`gss-specialist-nodejs-security\`
- **Rails** → \`gss-specialist-ruby-on-rails\`
- **Symfony** → \`gss-specialist-symfony\`
- **Java** → \`gss-specialist-java-security\`, \`gss-specialist-injection-prevention-in-java\`
- **.NET** → \`gss-specialist-dotnet-security\`

### Output

Output artifacts to .gss/artifacts/remediate/:
- patch-plan.json
- implementation-guide.md
- test-specs.json
- rollback-plan.md

**Next Steps:**
After completing this workflow, tell the user to review the remediation plan and then run \`/gss-apply-patches\` to apply the approved changes.`,
    codex: `Generate security remediation PLANS:

1. Review prioritized findings
2. Design minimal, safe fixes
3. Create implementation guides
4. Generate test specifications
5. Document rollback procedures

**This workflow does NOT modify code.** It creates detailed plans for the apply-patches workflow to execute.

Focus on secure coding practices and defense in depth.`,
  },
};
