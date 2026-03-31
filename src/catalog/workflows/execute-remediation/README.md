# Execute Remediation

**Execution workflow** - Applies approved security remediation plans to the codebase.

## Description

This workflow is the ONLY stage that mutates repository files. It takes the approved remediation plan from the `plan-remediation` workflow and applies the actual code, configuration, and test changes.

## Activities

- Validate remediation artifacts exist and are complete
- Apply security patches in priority order
- Add or update security tests
- Track application status for each remediation
- Document any deviations from the approved plan
- Generate application report for verification

## Prerequisites

- `plan-remediation` workflow must be completed
- Patch plan must be reviewed and approved
- Rollback plan must be available

## Output

- `application-report.json` - Status of each remediation (applied/partial/blocked/skipped)
- `change-summary.md` - Human-readable summary of all changes
- `deviations.md` - Any deviations from the approved plan with rationale

## Next Step

After patch application completes, run `/gss-verify` to verify the fixes were correctly implemented.

## Guardrails

- Gets explicit approval before mutating any files
- Shows diff of planned changes before applying
- Only applies changes specified in the approved plan
- Never adds unrelated changes or refactoring

## References

- OWASP Patch Management
- OWASP Secure Coding Practices
