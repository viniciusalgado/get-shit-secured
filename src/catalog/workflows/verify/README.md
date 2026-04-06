# Verify

**Verification workflow** - Confirms security remediations are properly implemented and no regressions were introduced.

## Description

This workflow cross-checks the application report from `execute-remediation` against the original patch plan from `plan-remediation` to verify what was actually applied. It verifies only applied/partial items and surfaces blocked/skipped items as residual risk.

## Activities

- Cross-check application-report against patch-plan
- Verify applied security fixes are in place
- Validate no regressions introduced
- Check test coverage for security fixes
- Verify configuration changes
- Document residual risks from blocked/skipped items

## Prerequisites

- `plan-remediation` workflow must be completed (provides patch-plan, test-specifications)
- `execute-remediation` workflow must be completed (provides application-report)

## Output

- `verification-report.json` - Pass/fail status for each remediation with evidence
- `regression-analysis.json` - Analysis of whether remediations caused regressions
- `test-coverage.json` - Test coverage metrics for security fixes
- `residual-risk-assessment.json` - Remaining risks from blocked/skipped items

## Next Step

After verification completes, run `/gss-report` to generate comprehensive security reports.

## References

- OWASP ASVS v24.0 - Security Verification
