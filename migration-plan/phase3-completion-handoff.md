# Phase 3 Completion Handoff — GSS v2 Migration

**Date**: 2026-03-31
**Status**: Phase 3 COMPLETE
**Next**: Phase 4 (Planner/Compliance Runtime Rewiring)

---

## What Phase 3 Produced

Phase 3 separated **corpus production** (maintainer/release-time) from **end-user installation**. The installer no longer makes HTTP requests during install. Instead, it resolves a pre-built corpus snapshot from the bundled package data.

### Deliverables

#### New Modules

| File | Purpose |
|------|---------|
| `src/core/install-stages.ts` | Explicit 4-stage install pipeline (target detection, corpus resolution, artifact install, manifest verification) |
| `src/cli/corpus-commands.ts` | CLI subcommands: `gss corpus inspect`, `gss corpus validate`, `gss corpus refresh` |

#### Modified Files

| File | Change |
|------|--------|
| `src/core/types.ts` | Added `corpusVersion?: string` to `InstallManifestV2`; added `legacySpecialists?: boolean` to `CliArgs` |
| `src/core/installer.ts` | Replaced monolithic `install()` with thin stage orchestrator delegating to `install-stages.ts`; legacy specialists behind `--legacy-specialists` flag |
| `src/core/manifest.ts` | `createManifestV2()` accepts optional `corpusVersion` parameter |
| `src/cli/parse-args.ts` | Added `--legacy-specialists` flag parsing and help text |
| `src/cli/index.ts` | Routes `corpus` subcommand; passes `legacySpecialists` to `install()` |
| `package.json` | Added `inspect-corpus` script |

### Installer Stage Architecture

```
Stage 0 — detectTargets()
  Detects runtimes, scope, paths from adapters.
  Output: TargetDetection

Stage 1 — resolveCorpus()
  Locates bundled snapshot (data/corpus/owasp-corpus.snapshot.json).
  Validates with isCorpusSnapshot().
  Skipped when --legacy-specialists is set.
  Output: CorpusResolution

Stage 2 — installRuntimeArtifacts()
  Writes commands, agents, role agents, hooks, support files.
  Copies corpus snapshot to runtime support subtree.
  Specialist files only generated when --legacy-specialists is set.
  Output: InstalledArtifacts

Stage 3 — MCP registration (stub, no-op)
  Placeholder for Phase 5.

Stage 4 — writeManifests() + verifyInstall()
  Records all managed files, corpus version, in manifests.
  Verifies corpus snapshot exists at destinations.
```

### CLI Commands

```
gss corpus inspect    — Shows corpus version, stats, per-workflow breakdown
gss corpus validate   — Runs validation rules against current snapshot
gss corpus refresh    — Re-fetches OWASP pages and rebuilds snapshot (with backup)
```

### Key Behavioral Changes

| Aspect | Before Phase 3 | After Phase 3 |
|--------|----------------|----------------|
| Install HTTP requests | 113 sequential fetches | 0 (uses bundled snapshot) |
| Install time | Slow (network-bound) | Fast (local file copy) |
| Install determinism | Non-deterministic (depends on OWASP availability) | Deterministic (same snapshot) |
| Offline support | No | Yes |
| Specialist files | Always generated (113 files) | Only with `--legacy-specialists` |
| Corpus version in manifest | Not recorded | Recorded in both install + runtime manifests |
| Corpus placement | N/A | `{supportSubtree}/corpus/owasp-corpus.json` |

---

## Test Results

```
ℹ tests 198
ℹ suites 38
ℹ pass 198
ℹ fail 0
```

All 191 original + 7 new Phase 3 tests pass.

---

## Phase 4 Executor Briefing

### What Phase 4 Does

Phase 4 rewires the **delegation planner** and **compliance module** to operate on `SecurityDoc[]` from the corpus snapshot instead of `SpecialistDefinition[]` from the legacy pipeline.

### Source files to read first

1. `src/core/delegation-planner.ts` — current planner (operates on `SpecialistDefinition[]` via `DelegationPlanInput`)
2. `src/core/delegation-compliance.ts` — compliance checker
3. `src/core/delegation-graph.ts` — delegation graph builder
4. `src/core/types.ts` — `DelegationPlanInput`, `DelegationPlan`, `SecurityDoc` types
5. `src/corpus/snapshot-loader.ts` — how to load corpus at runtime
6. `src/catalog/specialists/mapping.ts` — current mapping source (being replaced)
7. `migration-plan/adr-001-v2-architecture.md` — architecture contract

### Modules to modify

| File | Change |
|------|--------|
| `src/core/delegation-planner.ts` | Accept `SecurityDoc[]` from snapshot; derive plan from structured `DocWorkflowBinding` instead of flat specialist arrays |
| `src/core/delegation-graph.ts` | Build graph from `SecurityDoc.relatedDocIds` instead of `SpecialistDefinition.delegatesTo` |
| `src/core/delegation-compliance.ts` | Minimal changes — already operates on `DelegationPlan` which is type-independent |

### Modules to create

| File | Purpose |
|------|---------|
| `src/runtime/consultation-trace.ts` | Implements the `ConsultationTrace` schema from ADR-001 |

### Key constraints for Phase 4

1. **`computeDelegationPlan()` must produce identical `DelegationPlan` output** for equivalent inputs — the plan structure doesn't change, only how it's populated
2. **The `DelegationPlanEntry.specialistId` field maps to `SecurityDoc.id`** — same IDs, different source
3. **All existing delegation planner tests must pass unchanged** — behavioral equivalence
4. **The planner reads from the loaded snapshot**, not from `mapping.ts`
5. **`mapping.ts` is no longer imported by the planner** — it remains as a data source for `overrides.json` only

### Consultation trace schema (approved in ADR-001)

```typescript
interface ConsultationTrace {
  schemaVersion: 1;
  workflowId: WorkflowId;
  generatedAt: string;
  planRef: string;
  consulted: ConsultationRecord[];
  coverage: {
    status: 'pass' | 'fail';
    requiredConsulted: number;
    requiredTotal: number;
    optionalConsulted: number;
    issues: string[];
  };
}
```

### Definition of done for Phase 4

- [ ] `delegation-planner.ts` operates on `SecurityDoc[]` from snapshot
- [ ] `delegation-graph.ts` builds from `SecurityDoc.relatedDocIds`
- [ ] `computeDelegationPlan()` produces identical output for equivalent inputs
- [ ] `mapping.ts` is not imported by the planner
- [ ] Consultation trace writer is implemented
- [ ] All existing tests pass
- [ ] New tests cover the snapshot-based planner path

---

## Files NOT Changed in Phase 3

| File | Why |
|------|-----|
| `src/core/owasp-ingestion.ts` | Used by `build-corpus` and `--legacy-specialists` |
| `src/core/specialist-generator.ts` | Used by `--legacy-specialists` |
| `src/core/renderer.ts` | Used by `--legacy-specialists` and adapter rendering |
| `src/core/delegation-planner.ts` | Phase 4 scope |
| `src/core/delegation-graph.ts` | Phase 4 scope |
| `src/core/delegation-compliance.ts` | Phase 4 scope (minimal change) |
| `src/catalog/specialists/mapping.ts` | Read-only; overrides already extracted to `overrides.json` |
| `src/catalog/workflows/*/definition.ts` | Phase 5 scope |
| `src/runtimes/claude/adapter.ts` | Specialist methods only called when `--legacy-specialists` is active |
| `src/runtimes/codex/adapter.ts` | Same as above |

---

## File Tree (New and Modified in Phase 3)

```
src/
  core/
    install-stages.ts          # NEW — staged install pipeline
    installer.ts               # MODIFIED — thin orchestrator using stages
    manifest.ts                # MODIFIED — corpusVersion parameter
    types.ts                   # MODIFIED — corpusVersion, legacySpecialists
  cli/
    index.ts                   # MODIFIED — corpus subcommand routing, legacySpecialists pass-through
    parse-args.ts              # MODIFIED — --legacy-specialists flag
    corpus-commands.ts         # NEW — corpus inspect/validate/refresh

test/
  unit/
    install-stages.test.js     # NEW — 7 Phase 3 tests

package.json                      # MODIFIED — inspect-corpus script

migration-plan/
  phase3-completion-handoff.md     # THIS FILE
```
