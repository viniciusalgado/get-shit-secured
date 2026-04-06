# GSS Release Notes

This directory contains release notes for the rollout that led to Release C.

## Releases

| Release | Status | Description |
|---------|--------|-------------|
| [Release A](./release-a.md) | Historical | Early hybrid rollout |
| [Release B](./release-b.md) | Historical | MCP-only default before retirement cleanup |
| Release C | Current | MCP-backed runtime only; legacy specialist path removed |

## Quick Reference

- **Current default mode**: `mcp-only` (Release C)
- **Shadow comparison mode**: `--hybrid-shadow` (Release A behavior)
- **Check current mode**: `gss doctor`
- **Check release readiness**: `gss readiness`
- **Migrate between modes**: `gss migrate --to <mode> [--dry-run]`
