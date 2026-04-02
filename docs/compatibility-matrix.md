# GSS Compatibility Matrix

Supported upgrade and downgrade paths between GSS versions and rollout modes.

## Version Compatibility

| From Version | To Version | Supported? | Migration Command |
|-------------|-----------|-----------|-------------------|
| v0.1.0 (pre-migration) | Release A (hybrid-shadow) | ✅ Yes | `npx get-shit-secured --hybrid-shadow` |
| v0.1.0 (pre-migration) | Release B (mcp-only) | ✅ Yes | `npx get-shit-secured` (default) |
| Release A (hybrid-shadow) | Release B (mcp-only) | ✅ Yes | `gss migrate --to mcp-only` |
| Release B (mcp-only) | Release A (hybrid-shadow) | ✅ Yes | `gss migrate --to hybrid-shadow` |
| Release B (mcp-only) | Legacy | ✅ Yes | `npx get-shit-secured --legacy-specialists` |
| Release A (hybrid-shadow) | Legacy | ✅ Yes | `npx get-shit-secured --legacy-specialists` |
| Release B (mcp-only) | Release C (legacy retirement) | ⏳ Planned | Automatic in future release |

## Rollout Mode Compatibility

| From Mode | To Mode | Data Loss? | Notes |
|-----------|---------|-----------|-------|
| `legacy` | `mcp-only` | Specialist files removed | Install manifest updated; `gss migrate --dry-run` to preview |
| `legacy` | `hybrid-shadow` | None | Both paths active |
| `hybrid-shadow` | `mcp-only` | Specialist files removed | Comparison traces preserved |
| `hybrid-shadow` | `legacy` | MCP config removed | Falls back to specialist-only |
| `mcp-only` | `hybrid-shadow` | None | Re-enables specialist generation |
| `mcp-only` | `legacy` | MCP config + corpus removed | Falls back entirely to v0.1.0 behavior |

## Manifest Compatibility

| Manifest Version | Readable By | Notes |
|-----------------|------------|-------|
| v1 (pre-migration) | Release A, B | Auto-upgraded to v2 on first migrate |
| v2 (Release A) | Release A, B | `rolloutMode` field added |
| v2 (Release B) | Release A, B | `comparisonEnabled` may be absent (OK) |

## Runtime Compatibility

| Runtime | Release A | Release B | Notes |
|---------|-----------|-----------|-------|
| Claude Code | ✅ | ✅ | Full support |
| Codex | ✅ | ✅ | Full support |

## CLI Flag Compatibility

| Flag | Release A | Release B | Notes |
|------|-----------|-----------|-------|
| `--legacy-specialists` | ✅ | ✅ | Legacy fallback |
| `--hybrid-shadow` | ✅ | ✅ | Hybrid shadow mode |
| `--dry-run` | ✅ | ✅ | Preview without changes |
| `--verify-only` | ✅ | ✅ | Run doctor without installing |
| `--claude` | ✅ | ✅ | Target Claude runtime |
| `--codex` | ✅ | ✅ | Target Codex runtime |
| `--all` | ✅ | ✅ | Target all runtimes |
| `--local` | ✅ | ✅ | Local project install |
| `--global` | ✅ | ✅ | User-level install |

## CLI Subcommands

| Subcommand | Release A | Release B | Notes |
|-----------|-----------|-----------|-------|
| `gss doctor` | ✅ | ✅ | Health checks |
| `gss migrate` | ✅ | ✅ | Mode migration |
| `gss readiness` | ✅ | ✅ | Release readiness check |
| `gss compare-runs` | ✅ | ✅ | Trace comparison |
| `gss corpus inspect` | ✅ | ✅ | Corpus inspection |
| `gss corpus validate` | ✅ | ✅ | Corpus validation |
| `gss corpus refresh` | ✅ | ✅ | Corpus rebuild |
