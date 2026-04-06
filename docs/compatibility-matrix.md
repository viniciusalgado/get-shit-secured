# GSS Compatibility Matrix

Supported Release C upgrade and migration paths.

## Version Compatibility

| From Version | To Version | Supported? | Migration Command |
|-------------|-----------|-----------|-------------------|
| v0.1.0 (pre-migration) | Release C `mcp-only` | ✅ Yes | `npx get-shit-secured` |
| v0.1.0 (pre-migration) | Release C `hybrid-shadow` | ✅ Yes | `npx get-shit-secured --hybrid-shadow` |
| Release C `hybrid-shadow` | Release C `mcp-only` | ✅ Yes | `gss migrate --to mcp-only` |
| Release C `mcp-only` | Release C `hybrid-shadow` | ✅ Yes | `gss migrate --to hybrid-shadow` |

## Rollout Mode Compatibility

| From Mode | To Mode | Data Loss? | Notes |
|-----------|---------|-----------|-------|
| `hybrid-shadow` | `mcp-only` | None | Comparison traces remain on disk |
| `mcp-only` | `hybrid-shadow` | None | Enables comparison reporting |

## Manifest Compatibility

| Manifest Version | Readable By | Notes |
|-----------------|------------|-------|
| v1 (pre-migration) | Release C | Auto-upgraded to v2 on migrate/install |
| v2 (Release C) | Release C | `rolloutMode` is `mcp-only` or `hybrid-shadow` |

## Runtime Compatibility

| Runtime | Release C | Notes |
|---------|-----------|-------|
| Claude Code | ✅ | Full support with hooks |
| Codex | ✅ | Full support without hooks |

## CLI Flag Compatibility

| Flag | Release C | Notes |
|------|-----------|-------|
| `--hybrid-shadow` | ✅ | Comparison mode |
| `--dry-run` | ✅ | Preview without changes |
| `--verify-only` | ✅ | Run doctor without installing |
| `--claude` | ✅ | Target Claude runtime |
| `--codex` | ✅ | Target Codex runtime |
| `--all` | ✅ | Target all runtimes |
| `--local` | ✅ | Local project install |
| `--global` | ✅ | User-level install |

## CLI Subcommands

| Subcommand | Release C | Notes |
|-----------|-----------|-------|
| `gss doctor` | ✅ | Health checks |
| `gss migrate` | ✅ | Mode migration |
| `gss readiness` | ✅ | Release readiness check |
| `gss compare-runs` | ✅ | Trace comparison |
| `gss corpus inspect` | ✅ | Corpus inspection |
| `gss corpus validate` | ✅ | Corpus validation |
| `gss corpus refresh` | ✅ | Corpus rebuild |
