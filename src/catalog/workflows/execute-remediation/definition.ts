import type { WorkflowDefinition } from '../../../core/types.js';

/**
 * Apply Patches workflow definition.
 * Grounded in OWASP Secure Coding Practices and secure deployment best practices.
 *
 * This is the ONLY workflow that should mutate repository files.
 * All planning and approval happens in the plan-remediation workflow before this.
 */
export const executeRemediationDefinition: WorkflowDefinition = {
  id: 'execute-remediation',
  title: 'Security Remediation Execution',
  goal: 'Apply approved security remediation plans to code, configuration, and tests, then document what was actually changed.',
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
      name: 'Secure Deployment',
      glossaryUrl: 'https://cheatsheetseries.owasp.org/Glossary.html',
      cheatSheetUrls: [],
    },
  ],
  inputs: [
    {
      name: 'patch-plan',
      type: 'json',
      required: true,
      description: 'Structured patch plan from plan-remediation workflow',
    },
    {
      name: 'implementation-guide',
      type: 'markdown',
      required: true,
      description: 'Step-by-step implementation instructions from plan-remediation workflow',
    },
    {
      name: 'test-specifications',
      type: 'json',
      required: true,
      description: 'Test specifications from plan-remediation workflow',
    },
    {
      name: 'rollback-plan',
      type: 'markdown',
      required: true,
      description: 'Rollback procedures from plan-remediation workflow',
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
      name: 'application-report',
      type: 'json',
      description: 'Report of what was actually applied, including per-remediation status',
      path: '.gss/artifacts/execute-remediation/application-report.json',
    },
    {
      name: 'change-summary',
      type: 'markdown',
      description: 'Human-readable summary of all changes made',
      path: '.gss/artifacts/execute-remediation/change-summary.md',
    },
    {
      name: 'deviations-log',
      type: 'markdown',
      description: 'Any deviations from the approved plan with rationale',
      path: '.gss/artifacts/execute-remediation/deviations.md',
    },
  ],
  dependencies: [
    {
      workflowId: 'plan-remediation',
      requiredOutputs: ['patch-plan', 'implementation-guide', 'test-specifications', 'rollback-plan'],
    },
  ],
  handoffs: [
    {
      nextWorkflow: 'verify',
      outputsToPass: ['application-report'],
    },
  ],
  steps: [
    {
      id: 'validate-artifacts',
      title: 'Validate Remediation Artifacts',
      instructions: `Confirm all required remediation artifacts exist and are valid:

**Required Artifacts:**
1. **patch-plan** (.gss/artifacts/plan-remediation/patch-plan.json)
   - Contains structured remediation plan
   - Each patch has ID, description, priority
   - Includes dependencies between patches

2. **implementation-guide** (.gss/artifacts/plan-remediation/implementation-guide.md)
   - Step-by-step instructions for each remediation
   - Code changes specified with before/after
   - File paths and line numbers identified

3. **test-specifications** (.gss/artifacts/plan-remediation/test-specs.json)
   - Test cases for each remediation
   - Verification procedures documented

4. **rollback-plan** (.gss/artifacts/plan-remediation/rollback-plan.md)
   - Rollback procedures for each change
   - Triggers for rollback documented

**Validation Steps:**
- Read all artifacts from .gss/artifacts/plan-remediation/
- Confirm JSON files are valid and parseable
- Verify patch plan is complete (no missing required fields)
- Check that implementation guide matches patch plan entries
- Ensure test specs exist for all planned patches

**If any artifacts are missing or invalid:**
- Stop and report the issue
- Recommend re-running plan-remediation workflow
- Do not proceed with mutations
- Do not proceed with mutations

**Before Proceeding:**
- Get explicit user approval to mutate files
- Confirm the patch plan was reviewed
- Verify rollback capability exists

This workflow should only run AFTER the remediation plan has been reviewed and approved.`,
      owaspTopics: ['Patch Management'],
    },
    {
      id: 'apply-remediations',
      title: 'Apply Security Remediations',
      instructions: `Apply the planned fixes in remediation priority order:

**Application Order:**
Follow the priority order from the patch plan:
1. Critical severity fixes first
2. High severity fixes second
3. Medium and low severity fixes
4. Respect dependencies between patches

**For Each Remediation:**

1. **Before Applying**
   - Read the implementation guide entry for this patch
   - Understand the change being made
   - Note any dependencies on other patches
   - Confirm the file exists and is readable

2. **Apply the Fix**
   - Make ONLY the changes specified in the patch plan
   - Follow the exact code changes from implementation guide
   - Preserve existing code style and formatting
   - Add security-related comments explaining why the change was made
   - Do NOT refactor beyond what's specified
   - Do NOT add unrelated changes

3. **Track Application Status**
   For each remediation, record status as:
   - **applied**: Fix was applied exactly as planned
   - **partial**: Fix was partially applied (some changes couldn't be made)
   - **blocked**: Fix couldn't be applied (missing file, conflict, etc.)
   - **skipped**: Fix was intentionally skipped (user decision, already fixed, etc.)

4. **Handle Issues**
   If a fix cannot be applied:
   - Document the specific blocker
   - Note whether this blocks other fixes
   - Determine if workaround is possible
   - Record for deviations log

**Mutation Guardrails:**
- ONLY write files that are part of the approved patch plan
- NEVER create new files beyond what's specified
- NEVER modify files outside the approved scope
- ALWAYS show the user what will change before writing

**Example Status Recording:**
\`\`\`json
{
  "patchId": "SQLI-001",
  "status": "applied",
  "filesModified": ["src/auth/login.js"],
  "deviations": []
}
\`\`\``,
      owaspTopics: ['Secure Coding Practices'],
    },
    {
      id: 'add-or-update-tests',
      title: 'Add or Update Tests',
      instructions: `Add or update the tests specified in the test specifications:

**Test Addition Process:**

For each test specification in the test-specs.json:

1. **Locate Test File**
   - Find the appropriate test file for the component
   - Create test file if it doesn't exist (following project conventions)
   - Identify the correct test suite/section

2. **Add Test Cases**
   - Add tests for positive cases (valid input works)
   - Add tests for negative cases (invalid/malicious input rejected)
   - Add tests for edge cases and boundary conditions
   - Ensure tests verify the security fix is effective

3. **Test Format**
   Follow project testing conventions:
   - Use project's test framework (jest, pytest, etc.)
   - Match existing test style and structure
   - Include descriptive test names
   - Add comments explaining what vulnerability the test prevents

4. **Update Existing Tests**
   If tests already exist for the modified code:
   - Update tests to reflect new security behavior
   - Add new test cases for security fixes
   - Ensure old tests still pass or update if behavior changed intentionally

**For Each Test Added:**
- Test file path
- Test name/description
- Related patch ID
- Status: added/updated/skipped/failed

**Verification:**
- Run the test suite after adding tests
- Confirm new tests pass
- Check that existing tests still pass
- Note any test failures for investigation

**Track Test Status:**
Record which tests were successfully added and any issues encountered.`,
      owaspTopics: ['Secure Coding Practices'],
    },
    {
      id: 'record-application-status',
      title: 'Record Application Status',
      instructions: `Record detailed status for each remediation attempt:

**Application Report Structure:**

For each remediation in the patch plan, record:

1. **Patch Identification**
   - Patch ID from patch plan
   - Title/description
   - Severity level
   - Priority order

2. **Application Status**
   One of: \`applied\`, \`partial\`, \`blocked\`, \`skipped\`

3. **Files Modified**
   - List of files that were changed
   - Number of lines added/removed per file
   - Git diff summary (if available)

4. **Tests Added/Updated**
   - Test file paths
   - Number of test cases added
   - Test status (passing/failing)

5. **Deviations from Plan**
   If the applied fix differs from the plan:
   - What was planned vs what was applied
   - Reason for deviation
   - Whether deviation was approved
   - Impact on security posture

6. **Blocking Issues**
   For status \`blocked\` or \`partial\`:
   - Specific blocker (file not found, merge conflict, etc.)
   - Whether this blocks other patches
   - Recommended resolution

**Application Report Output:**

Write to .gss/artifacts/execute-remediation/application-report.json:

\`\`\`json
{
  "appliedAt": "2025-03-30T12:00:00Z",
  "remediations": [
    {
      "patchId": "SQLI-001",
      "status": "applied",
      "filesModified": ["src/auth/login.js"],
      "testsAdded": ["tests/auth/login.test.js"],
      "deviations": []
    },
    {
      "patchId": "XSS-002",
      "status": "partial",
      "filesModified": ["src/templates/user-profile.html"],
      "testsAdded": [],
      "deviations": [
        {
          "type": "incomplete_fix",
          "description": "Output encoding library not available, used manual escape",
          "approved": false
        }
      ]
    }
  ],
  "summary": {
    "total": 10,
    "applied": 7,
    "partial": 1,
    "blocked": 1,
    "skipped": 1
  }
}
\`\`\``,
      owaspTopics: ['Patch Management'],
    },
    {
      id: 'document-changes',
      title: 'Document Changes and Deviations',
      instructions: `Create human-readable documentation of all changes:

**Change Summary (.gss/artifacts/execute-remediation/change-summary.md):**

1. **Executive Summary**
   - Total patches attempted
   - Successfully applied count
   - Partial/blocked/skipped count
   - Overall completion percentage

2. **Applied Changes**
   For each successfully applied patch:
   - Patch ID and title
   - Files modified with line counts
   - Security improvement achieved
   - Tests added

3. **Summary Table**
   | Patch ID | Title | Status | Files | Tests |
   |----------|-------|--------|-------|-------|
   | SQLI-001 | Fix SQL injection | applied | 1 | 1 |

**Deviations Log (.gss/artifacts/execute-remediation/deviations.md):**

Document any deviation from the approved plan:

**Types of Deviations:**
1. **Incomplete Application**
   - Planned fix only partially applied
   - Some files couldn't be modified
   - Workarounds used

2. **Modified Approach**
   - Different implementation than planned
   - Alternative library or pattern used
   - Scope expanded or reduced

3. **Blockers Encountered**
   - Missing files or dependencies
   - Merge conflicts
   - Permission issues
   - Technical constraints

4. **Intentional Skips**
   - User decision to skip
   - Issue already fixed
   - Fix not applicable to codebase

**For Each Deviation:**
- Patch ID and title
- Type of deviation
- What was planned vs what happened
- Rationale for the deviation
- Whether deviation was approved
- Impact on security posture
- Recommended next steps

**Sample Deviation Entry:**
\`\`\`markdown
## XSS-002: Output Encoding for User Profile

**Type:** Incomplete Application

**Planned:** Install and integrate \`html-escape\` library for all user output.

**Actual:** Manual HTML escaping implemented for critical paths only.

**Rationale:** Library installation blocked by package manager policy. Manual escape provides immediate protection for highest-risk outputs.

**Approved:** No - pending security review of manual implementation.

**Impact:** Medium risk - some user output paths remain unprotected.

**Recommendation:** Revisit library policy or expand manual escape coverage.
\`\`\``,
      owaspTopics: ['Patch Management'],
    },
    {
      id: 'handoff-to-verify',
      title: 'Handoff to Verification',
      instructions: `Prepare for handoff to verify workflow:

**Handoff Checklist:**

1. **Application Report Complete**
   - All remediations have status recorded
   - Files modified list is accurate
   - Tests added are documented
   - Deviations are logged

2. **Artifacts in Place**
   - application-report.json exists and is valid
   - change-summary.md is complete
   - deviations.md documents all issues (if any)

3. **Ready for Verification**
   - Verify workflow can cross-check application-report against patch-plan
   - Blocked/skipped items are surfaced as residual risk
   - Deviations are flagged for review

**Next Steps:**

After completing this workflow:
- Run \`/gss-verify\` to verify the applied fixes
- Verify workflow will check application-report against patch-plan
- Only applied/partial items will be verified
- Blocked/skipped items will be documented as residual risk

**Handoff Message:**
"Patch application complete. Run \`/gss-verify\` to verify the applied remediations. The verification workflow will cross-check the application report against the original patch plan and document any residual risks from blocked or skipped items."`,
      owaspTopics: ['Secure Deployment'],
    },
  ],
  guardrails: [
    {
      type: 'preflight',
      description: 'Verify all remediation artifacts exist before starting',
      condition: 'Check for patch-plan, implementation-guide, test-specifications, and rollback-plan in .gss/artifacts/plan-remediation/',
    },
    {
      type: 'approval',
      description: 'Get explicit user approval before mutating any files',
      condition: 'Show the patch plan summary and ask for confirmation before applying any changes',
    },
    {
      type: 'mutation',
      description: 'This workflow writes code changes - always show diff before applying',
      condition: 'For each file to be modified, show the planned changes and get approval before writing',
    },
    {
      type: 'scope',
      description: 'Only apply changes specified in the approved patch plan',
      condition: 'Never add changes beyond what was planned in the plan-remediation workflow',
    },
  ],
  runtimePrompts: {
    claude: `When applying security patches:

**IMPORTANT:** This is the ONLY workflow that should write code changes.

**Pre-flight:**
1. Verify all remediation artifacts exist (patch-plan, implementation-guide, test-specifications, rollback-plan)
2. Get explicit user approval to mutate files
3. Confirm the patch plan has been reviewed

**Application Process:**
1. Apply fixes in priority order from the patch plan
2. For each patch, show what will change and get approval
3. Write ONLY the changes specified in the plan
4. Add security-related comments
5. Add or update tests as specified
6. Track status: applied/partial/blocked/skipped

**Status Tracking:**
- Record exactly what was changed
- Document any deviations from the plan
- Note blockers and workarounds
- Track which tests were added

**Output Artifacts:**
- application-report.json: Status of each remediation
- change-summary.md: Human-readable summary
- deviations.md: Any deviations from the plan

**Handoff:**
When complete, tell the user to run \`/gss-verify\` to verify the applied fixes.

Do NOT refactor beyond what's specified. Do NOT add unrelated changes.`,
    codex: `Apply security patches from the approved remediation plan:

1. Validate all required artifacts exist
2. Get user approval before making changes
3. Apply fixes in priority order
4. Add or update specified tests
5. Track application status for each patch
6. Document deviations from the plan
7. Generate application report and change summary

Only apply changes specified in the approved patch plan.`,
  },
  delegationPolicy: {
    mode: 'on-detection',
    subjectSource: 'approved patch items and high-risk remediations',
    constraints: {
      maxRequiredPerSubject: 2,
      maxOptionalPerSubject: 2,
      allowFollowUpSpecialists: true,
      maxFollowUpDepth: 1,
      failOnMissingRequired: false,
      allowOutOfPlanConsults: false,
    },
  },
};
