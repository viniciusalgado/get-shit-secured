# Plan Remediation

**Planning workflow** - Creates security remediation plans for identified vulnerabilities.

## Description

This workflow generates detailed remediation plans including patch specifications, implementation guides, test specifications, and rollback procedures. It does NOT modify code - it creates plans for the `execute-remediation` workflow to execute.

## Activities

- Analyze findings and group remediations
- Design remediation approaches following secure coding principles
- Generate detailed patch specifications
- Create step-by-step implementation guides
- Specify verification tests for each fix
- Document rollback procedures

## Prerequisites

- `audit` workflow must be completed
- Findings report and remediation priorities must exist

## Output

- `patch-plan.json` - Structured plan with dependencies and ordering
- `implementation-guide.md` - Step-by-step instructions for each fix
- `test-specs.json` - Test cases to verify each remediation
- `rollback-plan.md` - Rollback procedures for each change

## Next Step

After reviewing and approving the remediation plan, run `/gss-execute-remediation` to apply the approved changes to the codebase.

## Important

This workflow is planning-only. It does NOT modify any files in your repository. All code changes are applied by the `execute-remediation` workflow after you review and approve the plan.

## References

- OWASP Secure Coding Practices
- OWASP Patch Management
- CWE fixes and mitigations
