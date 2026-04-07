# get-shit-secured (GSS)

Security workflows, OWASP-backed consultation, and runtime guardrails for AI coding runtimes.

GSS installs a security-first workflow system into Claude Code and Codex. It gives those runtimes structured security commands or skills, an MCP server backed by a packaged OWASP corpus, artifact validation, and install-time/runtime safety checks so security work stays consistent instead of turning into vague "please audit this" prompting.

`npx get-shit-secured`

Run it with no flags for the interactive install wizard. Use flags when you want a non-interactive install for local setup, CI, or repeatable onboarding.

[Why GSS](#why-gss) | [Getting Started](#getting-started) | [How It Works](#how-it-works) | [Workflows](#workflows) | [CLI](#cli-commands) | [Project Layout](#project-layout) | [Docs](#docs)

---

## Why GSS

Most AI-assisted security review is inconsistent for predictable reasons:

- The runtime does not know your expected workflow.
- The model is asked to "do security" without a concrete artifact contract.
- Findings are not validated before remediation starts.
- Fixes and verification drift away from the original security context.

GSS fixes that by installing a workflow-first security system instead of a pile of loose prompts.

What that means in practice:

- Security work is organized into explicit workflows like `security-review`, `audit`, `validate-findings`, and `verify`.
- OWASP guidance is packaged into a local corpus and exposed through an MCP server.
- Runtime integrations enforce safer defaults like path validation, non-destructive config merging, and workflow-aware warnings.
- Artifacts are written into `.gss/` so handoffs between review, remediation, verification, and reporting stay structured.

This project is for teams or individual developers who want security work to be repeatable, inspectable, and grounded in actual workflow contracts.

## Getting Started

### Interactive install

```bash
npx get-shit-secured
```

The installer wizard lets you choose:

1. Runtime: Claude, Codex, or both
2. Scope: local project or global user install
3. Mode: standard `mcp-only` or `hybrid-shadow`
4. Execution: apply changes or preview with dry-run

### Non-interactive install

```bash
# Claude only, local project install
npx get-shit-secured --claude --local

# Codex only, global user install
npx get-shit-secured --codex --global

# Both runtimes
npx get-shit-secured --all --local

# Preview without writing files
npx get-shit-secured --all --local --dry-run

# Enable comparison-oriented shadow mode
npx get-shit-secured --claude --local --hybrid-shadow
```

After install:

- Claude users can start with `/gss-help`
- Any install can be checked with `gss doctor`
- Existing installs can be verified without reinstalling via `gss --verify-only --claude` or `gss --verify-only --codex`

## Supported Runtimes

GSS currently supports:

- Claude Code
- Codex

The shared installer core is runtime-agnostic, but each runtime gets its own adapter and output format:

- Claude installs commands, agents, hooks, MCP registration, and runtime support files
- Codex installs skills, MCP registration, and runtime support files

## How It Works

### 1. Install runtime-specific entrypoints

GSS renders the same workflow catalog into the format each runtime expects:

- Claude: `.claude/commands/gss/` and `.claude/agents/`
- Codex: `.codex/skills/gss-*/SKILL.md`

### 2. Register the OWASP-backed MCP server

The installer copies a bundled MCP server and a packaged corpus snapshot, then registers the server with the target runtime:

- Claude local installs register in `.mcp.json`
- Claude global installs register in `~/.claude.json`
- Codex installs register in `config.toml`

That gives workflows a stable consultation layer instead of relying on whatever the model happens to remember.

### 3. Enforce workflow structure through artifacts

Security workflows write structured outputs into `.gss/artifacts/`. Those artifacts are then used by downstream workflows for validation, remediation planning, verification, and reporting.

Examples:

- `security-review` emits change scope, findings, validation, and security test specs
- `validate-findings` confirms or rejects audit findings before remediation starts
- `plan-remediation` produces patch plans and test specifications
- `verify` checks what was actually applied and reports residual risk

### 4. Keep installs safe and inspectable

GSS is designed to be non-destructive:

- File operations are path-validated
- Managed config is merged instead of blindly overwritten
- Installs generate a manifest for uninstall and verification support
- Claude hooks warn on sensitive paths and invalid artifact behavior

## Workflows

GSS ships with a full security workflow chain plus a lightweight entry workflow for change-scoped review.

### Recommended starting point

- `security-review`: review the current diff or a specific commit patch, decide whether the change is security-significant, and emit findings plus remediation-oriented test specs

### Full workflow chain

1. `map-codebase`  
   Builds a security-relevant inventory of components, dependencies, trust boundaries, and data flows.
2. `threat-model`  
   Applies threat modeling to the mapped system and produces risk-focused context.
3. `audit`  
   Performs OWASP-grounded security analysis against the codebase and artifacts.
4. `validate-findings`  
   Confirms, disputes, or rejects audit findings through exploitation-oriented validation.
5. `plan-remediation`  
   Produces patch plans, implementation guidance, rollback plans, and test specifications.
6. `execute-remediation`  
   Applies approved changes. This is the only workflow that is supposed to mutate repository files.
7. `verify`  
   Verifies the applied fixes, checks for regressions, and records residual risk.
8. `report`  
   Aggregates everything into executive and technical reports.

### Role agents

The catalog also defines six fixed security roles used by the runtime integrations:

- `gss-mapper`
- `gss-threat-modeler`
- `gss-auditor`
- `gss-remediator`
- `gss-verifier`
- `gss-reporter`

## CLI Commands

### Installer flags

```bash
npx get-shit-secured --claude --local
npx get-shit-secured --codex --global
npx get-shit-secured --all --dry-run
npx get-shit-secured --interactive
npx get-shit-secured --uninstall
```

Supported flags:

- `--claude`, `-c`
- `--codex`, `-x`
- `--all`, `-a`
- `--local`, `-l`
- `--global`, `-g`
- `--dry-run`, `-d`
- `--interactive`
- `--verify-only`
- `--hybrid-shadow`
- `--uninstall`, `-u`

### Operational commands

```bash
# Verify install health
gss doctor

# Check rollout readiness
gss readiness

# Migrate rollout mode
gss migrate --to mcp-only
gss migrate --to hybrid-shadow --dry-run

# Compare consultation traces
gss compare-runs --mcp <trace-or-dir> --legacy <trace-or-dir>

# Compare two artifact envelopes
gss diff-artifacts --a <artifact-a.json> --b <artifact-b.json>

# Corpus utilities
gss corpus inspect
gss corpus validate
gss corpus refresh
```

## Install Modes

GSS currently documents two rollout modes:

- `mcp-only`: the default production mode
- `hybrid-shadow`: enables comparison-oriented reporting while keeping MCP-backed workflows active

Use `gss doctor` to inspect the current state and `gss readiness` before migrating between modes.

## Project Layout

### Runtime output

```text
.claude/
  commands/gss/
  agents/
  gss/

.codex/
  skills/gss-*/
  gss/

.gss/
  install-manifest.json
  artifacts/
  reports/
```

### Repository structure

```text
src/
  cli/        CLI entrypoints and operational commands
  core/       installer, rendering, manifests, corpus and consultation logic
  runtimes/   Claude and Codex adapters
  catalog/    workflow and role definitions
  hooks/      artifact and consultation validation
  runtime/    artifact envelopes, diffing, handoff validation

docs/
  architecture.md
  migration-guide.md
  troubleshooting.md
  compatibility-matrix.md
```

## Development

```bash
npm install
npm run build
npm test
```

Useful development commands:

```bash
# Validate or inspect the OWASP corpus
npm run validate-corpus
npm run inspect-corpus

# Run boundary and migration helpers
npm run audit-boundaries
npm run migration:phases
```

Node.js `>=18` is required.

## Docs

- [Architecture](docs/architecture.md)
- [Migration Guide](docs/migration-guide.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Compatibility Matrix](docs/compatibility-matrix.md)
- [Release Notes](docs/release-notes/README.md)
- [AGENTS.md](AGENTS.md)

## License

MIT
