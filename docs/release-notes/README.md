# GSS Release Notes

This directory contains release notes for each GSS v2 migration release.

## Releases

| Release | Status | Description |
|---------|--------|-------------|
| [Release A](./release-a.md) | Available | Hybrid shadow mode — MCP + legacy side-by-side |
| [Release B](./release-b.md) | Current default | MCP-only mode — MCP-backed consultation only |
| Release C | Planned | Legacy retirement — remove specialist generation code |

## Quick Reference

- **Current default mode**: `mcp-only` (Release B)
- **Shadow comparison mode**: `--hybrid-shadow` (Release A behavior)
- **Legacy fallback**: `--legacy-specialists` (pre-migration behavior)
- **Check current mode**: `gss doctor`
- **Check release readiness**: `gss readiness`
- **Migrate between modes**: `gss migrate --to <mode> [--dry-run]`
