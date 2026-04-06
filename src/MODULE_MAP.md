# Module Ownership Map

This document records every active module's boundary owner and status.
It is the authoritative reference for import boundary rules and technical debt tracking.

---

## Boundary Definitions

| Boundary | ID | Owner Responsibilities |
|----------|----|----------------------|
| **Workflow** | A | Workflow definitions, rendering, runtime adapters, workflow registry |
| **Role** | B | Role agent definitions, role catalog |
| **Knowledge** | C | Corpus, planner, compliance, consultation, MCP server/tools, OWASP ingestion |
| **Installer** | D | Install orchestration, staging, manifest handling, CLI, path resolution, MCP config |
| **Artifact** | E | Hook-based artifact validation, consultation trace validation |

### Import Rules

1. **Knowledge (C)** must NOT import from Workflow (A) or Role (B)
2. **Workflow (A)** must NOT import Knowledge (C) modules directly at runtime (should go through MCP)
3. **Role (B)** must NOT import Knowledge (C) modules directly
4. **Installer (D)** may import from all boundaries (it is the integrator)
5. **Artifact (E)** may import types from all boundaries but must not depend on runtime state
6. `types.ts` is cross-cutting and may be imported by any boundary

---

## Complete Module Table

### `src/core/` — Core shared modules

| File | Boundary | Status | Retirement | Notes |
|------|----------|--------|------------|-------|
| `types.ts` | Cross-cutting | active | never | All type definitions; shared across boundaries |
| `renderer.ts` | A (Workflow) | active | never | Workflow/role rendering to runtime files |
| `installer.ts` | D (Installer) | active | never | Install orchestration |
| `install-stages.ts` | D (Installer) | active | never | Install pipeline stages |
| `manifest.ts` | D (Installer) | active | never | Manifest read/write |
| `paths.ts` | D (Installer) | active | never | Path resolution utilities |
| `consultation-planner.ts` | C (Knowledge) | active | never | Deterministic consultation planner (v2) |
| `consultation-compliance.ts` | C (Knowledge) | active | never | Coverage validator (v2) |
| `consultation-signals.ts` | C (Knowledge) | active | never | Signal extraction |
| `consultation-comparator.ts` | C (Knowledge) | active | never | Trace comparison for rollout |
| `stack-normalizer.ts` | C (Knowledge) | active | never | Stack normalization |
| `issue-taxonomy.ts` | C (Knowledge) | active | never | Issue classification |
| `owasp-ingestion.ts` | C (Knowledge) | active | never | Corpus build helpers and ingestion utilities |

### `src/corpus/` — Corpus build and runtime

| File | Boundary | Status | Retirement | Notes |
|------|----------|--------|------------|-------|
| `catalog.ts` | C (Knowledge) | active | never | Catalog loader |
| `schema.ts` | C (Knowledge) | active | never | Type guards |
| `snapshot-builder.ts` | C (Knowledge) | active | never | Build pipeline |
| `snapshot-loader.ts` | C (Knowledge) | active | never | Runtime loader |
| `normalize.ts` | C (Knowledge) | active | never | Content normalization |
| `bindings.ts` | C (Knowledge) | active | never | Binding merge |
| `validators.ts` | C (Knowledge) | active | never | Snapshot validation |
| `ids.ts` | C (Knowledge) | active | never | ID/URI utilities |
| `diff.ts` | C (Knowledge) | active | never | Corpus diff |

### `src/mcp/` — MCP server and tools

| File | Boundary | Status | Retirement | Notes |
|------|----------|--------|------------|-------|
| `server.ts` | C (Knowledge) | active | never | MCP stdio server |
| `resources.ts` | C (Knowledge) | active | never | Resource handlers |
| `diagnostics.ts` | C (Knowledge) | active | never | MCP diagnostics |
| `tools/consultation-plan.ts` | C (Knowledge) | active | never | Plan tool |
| `tools/validate-coverage.ts` | C (Knowledge) | active | never | Coverage tool |
| `tools/read-doc.ts` | C (Knowledge) | active | never | Doc read tool |
| `tools/related-docs.ts` | C (Knowledge) | active | never | Related docs tool |
| `tools/search-docs.ts` | C (Knowledge) | active | never | Search tool |
| `tools/diagnostics.ts` | C (Knowledge) | active | never | Diagnostics tool |

### `src/runtime/` — Runtime support

| File | Boundary | Status | Retirement | Notes |
|------|----------|--------|------------|-------|
| `consultation-trace-builder.ts` | C (Knowledge) | active | never | Trace assembly |
| `trace-summary-formatter.ts` | C (Knowledge) | active | never | Trace formatting |
| `artifact-envelope-validator.ts` | C (Knowledge) | active | never | Envelope validation |
| `artifact-diff.ts` | C (Knowledge) | active | never | Artifact comparison |

### `src/install/` — Install stages

| File | Boundary | Status | Retirement | Notes |
|------|----------|--------|------------|-------|
| `mcp-config.ts` | D (Installer) | active | never | MCP registration stage |
| `legacy-cleanup.ts` | D (Installer) | active | never | Cleanup of retired specialist artifacts during reinstall/uninstall |

### `src/hooks/` — Hook validators

| File | Boundary | Status | Retirement | Notes |
|------|----------|--------|------------|-------|
| `artifact-validator.ts` | E (Artifact) | active | never | Artifact validation hook |
| `consultation-trace-validator.ts` | E (Artifact) | active | never | Trace validation hook |

### `src/catalog/` — Definitions

| File | Boundary | Status | Retirement | Notes |
|------|----------|--------|------------|-------|
| `workflows/registry.ts` | A (Workflow) | active | never | Workflow registry |
| `workflows/*/definition.ts` (9 files) | A (Workflow) | active | never | Workflow definitions |
| `specialists/mapping.ts` | C (Knowledge) | **build-only** | never | Curated overrides; consumed by corpus build only |
| `roles/registry.ts` | B (Role) | active | never | Role catalog |

### `src/runtimes/` — Runtime adapters

| File | Boundary | Status | Retirement | Notes |
|------|----------|--------|------------|-------|
| `claude/adapter.ts` | A (Workflow) | active | never | Claude adapter |
| `codex/adapter.ts` | A (Workflow) | active | never | Codex adapter |

### `src/cli/` — CLI commands

| File | Boundary | Status | Retirement | Notes |
|------|----------|--------|------------|-------|
| `index.ts` | D (Installer) | active | never | CLI entry point |
| `parse-args.ts` | D (Installer) | active | never | Arg parser |
| `corpus-commands.ts` | D (Installer) | active | never | Corpus CLI |
| `doctor.ts` | D (Installer) | active | never | Health check CLI |
| `compare-runs.ts` | D (Installer) | active | never | Run comparison CLI |
| `migrate-install.ts` | D (Installer) | active | never | Install migration CLI |
| `readiness.ts` | D (Installer) | active | never | Readiness check CLI |
| `diff-artifacts.ts` | D (Installer) | active | never | Artifact diff CLI |

## Cross-Boundary Dependency Map

### Acceptable Cross-Boundary Imports

| Importer | Imported From | Module | Justification |
|----------|--------------|--------|---------------|
| `renderer.ts` (A) | `types.ts` (Cross-cutting) | Type imports only | Types are shared |
| `mcp/tools/consultation-plan.ts` (C) | `stack-normalizer.ts` (C) | `normalizeStack` | Same boundary |
| `install-stages.ts` (D) | `corpus/*` (C) | Corpus resolution | Installer is integrator |
| `install-stages.ts` (D) | `mcp/*` (C) | MCP registration | Installer is integrator |
| `hooks/*` (E) | `types.ts` (Cross-cutting) | Type imports | Types are shared |

### Current Known Violations

None beyond the acceptable cross-boundary imports listed above.
The import boundary audit script (`npm run audit-boundaries`) validates these rules.

## Dual-Use Modules

| Module | Build-Time Use | Install-Time Use | Notes |
|--------|---------------|-----------------|-------|
| `owasp-ingestion.ts` | `snapshot-builder.ts` imports `fetchCheatSheet`, `parseCheatSheetHtml`, `urlToId`, `urlToTitle` | None | Install-time fetch path retired in Release C |
| `mapping.ts` | `catalog.ts` imports curated overrides | None | Runtime use retired in Release C |
