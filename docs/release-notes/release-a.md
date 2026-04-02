# Release A — Hybrid Shadow Mode

**Status**: Available
**Date**: 2026-04-01
**Rollout mode**: `hybrid-shadow`

## What's New

Release A introduces the hybrid shadow mode, which runs both the MCP-backed consultation path and the legacy specialist path side-by-side. This enables comparison between the two approaches without removing any existing behavior.

### Key Features

- **Dual-path execution**: Both MCP and legacy consultation paths run during each workflow
- **Comparison reports**: Automatic generation of `ConsultationComparison` artifacts showing differences
- **Zero risk**: Legacy specialist files remain available as fallback
- **`--hybrid-shadow` flag**: Opt-in via CLI flag during install

## How to Enable

```bash
# Install with hybrid shadow mode
npx get-shit-secured --claude --local --hybrid-shadow

# Or migrate an existing install
gss migrate --to hybrid-shadow
```

## What Changes from v0.1.0

| Aspect | Before (v0.1.0) | After (Release A) |
|--------|------------------|--------------------|
| Consultation path | Legacy specialists only | MCP + legacy (side-by-side) |
| Install time | Slow (113 HTTP fetches) | Fast (packaged corpus + legacy) |
| Artifacts | No consultation trace | Consultation trace + comparison report |
| Rollout mode | `legacy` | `hybrid-shadow` |

## Comparison Reports

In hybrid-shadow mode, each workflow run produces a comparison artifact at:
```
.gss/artifacts/<workflow>/comparisons/<timestamp>.json
```

Example:
```json
{
  "schemaVersion": 1,
  "workflowId": "audit",
  "comparedAt": "2026-04-01T12:00:00Z",
  "mcpDocs": ["sql-injection-prevention", "input-validation"],
  "legacyDocs": ["sql-injection-prevention"],
  "mcpOnly": ["input-validation"],
  "legacyOnly": [],
  "common": ["sql-injection-prevention"],
  "mcpRequiredCoverage": 1.0,
  "legacyRequiredCoverage": 0.5,
  "coverageDelta": 0.5,
  "assessment": "mcp-superior"
}
```

## Known Limitations

- Both paths run sequentially, so workflow execution is slower than single-path
- Comparison reports require consultation traces to be produced by both paths
- The `gss compare-runs` CLI command can compare traces from separate runs

## Verification

```bash
gss doctor        # Should show: mode: hybrid-shadow (Release A (shadow))
gss readiness     # Check readiness to advance to Release B
```
