# Report

**Final workflow** - Aggregates all workflow artifacts into comprehensive security reports for stakeholders, auditors, and developers.

## Description

This is the final workflow in the security analysis pipeline. It gathers artifacts from all previous workflows (map-codebase, threat-model, audit, plan-remediation, execute-remediation, and verify) to generate comprehensive security reports.

## Activities

- Aggregate findings from all workflows
- Calculate risk scores
- Track remediation progress
- Generate compliance mappings
- Create executive summary
- Produce technical findings report
- Document residual risks

## Prerequisites

Best results when all workflows are completed:
- `map-codebase` - provides codebase inventory
- `threat-model` - provides threat register and risk assessment
- `audit` - provides findings report
- `plan-remediation` - provides patch plan
- `execute-remediation` - provides application report and change summary
- `verify` - provides verification report

## Output

- `executive-summary.md` - High-level security posture summary for stakeholders
- `technical-findings.md` - Detailed findings with code references and evidence
- `owasp-compliance.md` - OWASP Top 10 and ASVS compliance matrix
- `remediation-roadmap.md` - Prioritized remediation plan with timelines

## Sequence Complete

After running this workflow, the full security analysis sequence is complete:
1. map-codebase
2. threat-model
3. audit
4. plan-remediation
5. execute-remediation
6. verify
7. report (you are here)

## References

- OWASP ASVS reporting guidelines
- ISO 27001 reporting requirements
