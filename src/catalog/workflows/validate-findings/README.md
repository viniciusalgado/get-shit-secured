# Findings Validation

Validates security findings from the audit workflow by generating exploitation test cases and confirming or denying each finding.

## Description

`validate-findings` sits between the audit and plan-remediation workflows. It takes audit findings, generates exploitation test cases (unit, integration, e2e), runs them, and classifies each finding as confirmed, unconfirmed, or hallucinated. Disputed findings are re-evaluated by OWASP specialists before final classification.

## Inputs

- `findings-report` (required) — from audit
- `remediation-priorities` (required) — from audit
- `owasp-mapping` (optional) — from audit

## Outputs

- `.gss/artifacts/validate-findings/validated-findings.json`
- `.gss/artifacts/validate-findings/validation-report.json`
- `.gss/artifacts/validate-findings/exploitation-tests.json`
- `.gss/artifacts/validate-findings/re-evaluation-report.json`
- `.gss/artifacts/validate-findings/tdd-test-document.json`

## Guardrails

- Test files written only to project test directories; source files are read-only
- E2e tests require explicit user approval before execution
- Only validates findings provided by audit; does not discover new vulnerabilities
