# Security Review

Performs a lightweight, change-scoped security review for the current diff or a single commit patch.

## Description

`security-review` is a standalone entry workflow intended for security-relevant code changes. It runs ordered phases (scope, gate, impact, audit, specialist, validation, finalize), short-circuits when changes are not security-significant, and emits remediation-oriented TDD specs.

## Inputs

- `change-set` (runtime-derived, required)
- `commit-ref` (optional)
- `repository-context` (optional)

## Outputs

- `.gss/artifacts/security-review/change-scope.json`
- `.gss/artifacts/security-review/delegation-plan.json`
- `.gss/artifacts/security-review/findings.json`
- `.gss/artifacts/security-review/validation-report.json`
- `.gss/artifacts/security-review/security-test-specs.json`

## Guardrails

- Read-only for tracked repository files
- Warn on protected targets (`.env`, `*.pem`, `*.key`, `secrets/`, `credentials/`) without exposing secret contents
- Do not implement fixes in this workflow
