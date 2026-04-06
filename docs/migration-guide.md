# GSS Migration Guide

This guide covers the supported Release C rollout modes.

## Rollout Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| `mcp-only` | MCP-backed workflows with runtime validation | Default production mode |
| `hybrid-shadow` | MCP-backed workflows with comparison reporting enabled | Comparison and rollout validation |

## Upgrading

### Fresh Install or Upgrade to `mcp-only` (Recommended)

The recommended path for most users:

```bash
# 1. Check current state
gss doctor

# 2. Reinstall with default mode
npx get-shit-secured --claude --local

# 3. Verify
gss doctor
# Should show: mode: mcp-only (Release C)
```

### Enable `hybrid-shadow` for Comparison

If you want comparison reporting before settling on steady-state `mcp-only`:

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

## Switching Modes

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

| Aspect | hybrid-shadow | mcp-only |
|--------|---------------|----------|
| Runtime path | MCP-backed | MCP-backed |
| Comparison reports | ✅ Yes | ❌ No |
| MCP server | ✅ Registered | ✅ Registered |
| Corpus snapshot | ✅ Installed | ✅ Installed |
| Offline install | ✅ Yes | ✅ Yes |
| Consultation traces | ✅ Yes | ✅ Yes |
| Install health after install | ✅ Healthy | ✅ Healthy |

## Troubleshooting

See [troubleshooting.md](./troubleshooting.md) for common issues.
