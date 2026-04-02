# GSS Migration Guide

This guide covers how to migrate between GSS v2 rollout modes.

## Rollout Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| `legacy` | Legacy specialist files only | Pre-migration behavior, maximum compatibility |
| `hybrid-shadow` | MCP + legacy side-by-side | Comparison testing, validation before upgrade |
| `mcp-only` | MCP only, no legacy files | Production default, fastest installs |

## Upgrading

### From v0.1.0 to mcp-only (Recommended)

The recommended path for most users:

```bash
# 1. Check current state
gss doctor

# 2. Reinstall with default mode
npx get-shit-secured --claude --local

# 3. Verify
gss doctor
# Should show: mode: mcp-only (Release B)
```

### From v0.1.0 to hybrid-shadow (Testing First)

If you want to compare MCP vs legacy before committing:

```bash
# 1. Install with hybrid shadow mode
npx get-shit-secured --claude --local --hybrid-shadow

# 2. Run your workflows normally
#    Comparison artifacts are generated automatically

# 3. Review comparison reports
gss compare-runs --mcp .gss/artifacts/audit/ --legacy .gss/artifacts/audit/

# 4. When satisfied, migrate to mcp-only
gss migrate --to mcp-only

# 5. Verify
gss doctor
```

### From hybrid-shadow to mcp-only

```bash
# 1. Check readiness
gss readiness

# 2. Migrate
gss migrate --to mcp-only

# 3. Or preview changes first
gss migrate --to mcp-only --dry-run
```

## Falling Back

### To legacy mode

```bash
# Reinstall with legacy flag
npx get-shit-secured --claude --local --legacy-specialists
```

### To hybrid-shadow from mcp-only

```bash
# Migrate back to shadow mode for additional comparison
gss migrate --to hybrid-shadow
```

## Checking State

```bash
# Quick health check
gss doctor

# Release readiness check
gss readiness

# Compare two runs
gss compare-runs --mcp <trace-a> --legacy <trace-b>
```

## What Changes Between Modes

| Aspect | legacy | hybrid-shadow | mcp-only |
|--------|--------|---------------|----------|
| Specialist files | ✅ Generated | ✅ Generated (for comparison) | ❌ Not generated |
| MCP server | ❌ Not registered | ✅ Registered | ✅ Registered |
| Corpus snapshot | ❌ Not installed | ✅ Installed | ✅ Installed |
| Install time | Slow (HTTP fetch) | Medium | Fast |
| Offline install | ❌ No | ✅ Yes | ✅ Yes |
| Consultation traces | ❌ No | ✅ Yes (both paths) | ✅ Yes (MCP path) |
| Comparison reports | ❌ No | ✅ Yes | ❌ No |

## Troubleshooting

See [troubleshooting.md](./troubleshooting.md) for common issues.
