# Consultation Trace Examples

Example artifact outputs from GSS v2 MCP-backed workflows.

## Consultation Trace

Produced by every workflow that consults the MCP. Embedded in the artifact JSON.

```json
{
  "consultation": {
    "plan": {
      "workflowId": "audit",
      "generatedAt": "2026-04-01T12:00:00Z",
      "corpusVersion": "1.0.0",
      "requiredCount": 3,
      "optionalCount": 2,
      "followupCount": 1
    },
    "consultedDocs": [
      {
        "id": "sql-injection-prevention",
        "title": "SQL Injection Prevention Cheat Sheet",
        "sourceUrl": "https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html"
      },
      {
        "id": "input-validation",
        "title": "Input Validation Cheat Sheet",
        "sourceUrl": "https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html"
      },
      {
        "id": "authentication",
        "title": "Authentication Cheat Sheet",
        "sourceUrl": "https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html"
      }
    ],
    "coverageStatus": "pass",
    "requiredMissing": [],
    "notes": [
      "Stack signal: express detected, included Node.js security docs",
      "Issue tag: injection detected, included injection-prevention docs"
    ]
  }
}
```

## Consultation Comparison Report

Produced by `gss compare-runs` when comparing MCP and legacy paths.

```json
{
  "schemaVersion": 1,
  "workflowId": "audit",
  "comparedAt": "2026-04-01T12:30:00Z",
  "mcpDocs": [
    "sql-injection-prevention",
    "input-validation",
    "authentication",
    "session-management",
    "error-handling"
  ],
  "legacyDocs": [
    "sql-injection-prevention",
    "authentication",
    "error-handling"
  ],
  "mcpOnly": [
    "input-validation",
    "session-management"
  ],
  "legacyOnly": [],
  "common": [
    "sql-injection-prevention",
    "authentication",
    "error-handling"
  ],
  "mcpRequiredCoverage": 1.0,
  "legacyRequiredCoverage": 0.667,
  "coverageDelta": 0.333,
  "assessment": "mcp-superior"
}
```

### Assessment Verdicts

| Verdict | Meaning |
|---------|---------|
| `mcp-superior` | MCP path covers significantly more required docs (>5% delta) |
| `equivalent` | Both paths cover roughly the same docs (within 5% tolerance) |
| `mcp-inferior` | MCP path covers fewer required docs (>5% delta, negative) |

## Runtime Manifest (Phase 11)

```json
{
  "runtime": "claude",
  "scope": "local",
  "installedAt": "2026-04-01T12:00:00Z",
  "version": "0.1.0",
  "corpusVersion": "1.0.0",
  "hooks": ["session-start", "pre-tool-write", "pre-tool-edit", "post-tool-write"],
  "managedConfigs": [],
  "corpusPath": "/project/.claude/gss/corpus/owasp-corpus.json",
  "mcpServerPath": "/project/.claude/gss/mcp/server.js",
  "mcpConfigPath": "/project/.claude/settings.json",
  "gssVersion": "0.1.0",
  "installedWorkflows": ["security-review", "map-codebase", "threat-model", "audit", "validate-findings", "plan-remediation", "execute-remediation", "verify", "report"],
  "installedRoles": ["gss-mapper", "gss-threat-modeler", "gss-auditor", "gss-remediator", "gss-verifier", "gss-reporter"],
  "legacyMode": false,
  "mcpServerName": "gss-security-docs",
  "rolloutMode": "mcp-only",
  "comparisonEnabled": false
}
```

### Rollout Mode Field

| Value | Behavior |
|-------|----------|
| `"legacy"` | Legacy specialist files only, no MCP |
| `"hybrid-shadow"` | MCP + legacy side-by-side, comparison traces enabled |
| `"mcp-only"` | MCP only, no legacy files |
