# Release B — MCP-Only Default

**Status**: Current default
**Date**: 2026-04-01
**Rollout mode**: `mcp-only`

## What's New

Release B makes MCP-backed consultation the default for all new installs. Legacy specialist files are no longer generated during installation, resulting in significantly faster installs and smaller footprints.

### Key Changes from Release A

- **MCP-only as default**: New installs no longer generate legacy specialist files
- **Faster installs**: No HTTP fetches during install — packaged corpus snapshot only
- **Smaller footprint**: ~113 specialist prompt files removed per install
- **`--legacy-specialists` flag**: Available as an explicit fallback for users who need legacy behavior
- **`gss doctor` improvements**: Shows rollout mode with release label

## How to Install

```bash
# Default install (MCP-only, Release B)
npx get-shit-secured --claude --local

# With legacy fallback
npx get-shit-secured --claude --local --legacy-specialists
```

## How to Upgrade from Release A (hybrid-shadow)

```bash
# Check readiness first
gss readiness

# Migrate to mcp-only
gss migrate --to mcp-only

# Verify
gss doctor
```

## How to Fall Back to Legacy

```bash
# Migrate to legacy mode
gss migrate --to legacy

# Or reinstall with legacy flag
npx get-shit-secured --claude --local --legacy-specialists
```

## Verification

```bash
gss doctor        # Should show: mode: mcp-only (Release B)
gss readiness     # Check readiness to advance to Release C
```

## What's Different for Users

- **Same workflow UX**: All `/gss-*` commands work identically
- **Same artifact format**: Artifacts include consultation traces (no specialist prompts)
- **Same hooks**: Session-start, pre/post-write hooks work as before
- **Faster installs**: No 113 HTTP fetches; corpus is pre-packaged
- **Offline capable**: Install works without network once npm package is downloaded
