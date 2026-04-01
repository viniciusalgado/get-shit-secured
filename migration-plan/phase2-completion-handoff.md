# Phase 2 Completion Handoff — GSS v2 Migration

**Date**: 2026-03-31
**Status**: Phase 2 COMPLETE
**Next**: Phase 3 (Runtime Rewire — Installer & Planner)

---

## What Phase 2 Produced

Phase 2 implemented **corpus normalization** — the Knowledge Boundary (Boundary C). It created the corpus infrastructure that replaces the specialist generation pipeline with a single versioned snapshot.

### Deliverables

#### New Modules (`src/corpus/`)

| File | Purpose | Lines |
|------|---------|-------|
| `src/corpus/ids.ts` | ID/URI generation, alias resolution, ALL_KNOWN_IDS (113 entries) | ~160 |
| `src/corpus/schema.ts` | SecurityDoc and CorpusSnapshot runtime type guards | ~155 |
| `src/corpus/catalog.ts` | catalog.json and overrides.json loaders with lookup helpers | ~140 |
| `src/corpus/normalize.ts` | HTML → SecurityDoc field extraction, inferred binding generation | ~245 |
| `src/corpus/bindings.ts` | Merge logic: inferred + curated overrides → final bindings with provenance | ~155 |
| `src/corpus/snapshot-builder.ts` | Build orchestrator: catalog → fetch → normalize → merge → validate → emit | ~170 |
| `src/corpus/snapshot-loader.ts` | Runtime snapshot loader with ID/URI/workflow/stack lookup | ~135 |
| `src/corpus/validators.ts` | 10 validation rules (8 hard errors, 2 warnings + 2 optional checks) | ~220 |
| `src/corpus/diff.ts` | Snapshot comparison and coverage diff reporting | ~195 |

#### Data Files (`data/corpus/`)

| File | Purpose | Entries |
|------|---------|---------|
| `data/corpus/catalog.json` | Authoritative source list from OWASP_CANONICAL_URLS | 113 entries |
| `data/corpus/overrides.json` | Curated bindings extracted from WORKFLOW_SPECIALIST_MAPPING | 92 specialists |

#### Build Scripts

| Script | Purpose |
|--------|---------|
| `npm run build-corpus` | Runs snapshot-builder.js to fetch and build the corpus |
| `node scripts/validate-corpus.mjs` | Validates an existing snapshot against all rules |
| `node scripts/generate-catalog.mjs` | Regenerates catalog.json and overrides.json from source |

#### Modified Files

| File | Change |
|------|--------|
| `src/core/types.ts` | Added `SecurityDoc`, `DocWorkflowBinding`, `DocStackBinding`, `DocProvenance`, `CorpusSnapshotStats`, `CorpusSnapshot` types (additive, no changes to existing types) |
| `package.json` | Added `build-corpus` and `validate-corpus` scripts; added `"data"` to `files` array |

#### Test Files

| File | Tests |
|------|-------|
| `test/unit/corpus.test.js` | 31 tests covering ids, schema, catalog, normalize, bindings, validators, ID stability |

---

## Key Design Decisions

### 1. SecurityDoc is additive to OwaspCorpusEntry
`OwaspCorpusEntry` is **not removed**. The new `SecurityDoc` type lives alongside it. Existing code that uses `OwaspCorpusEntry` continues to work. Phase 3 rewires the planner; Phase 5 removes the old type.

### 2. Schema field renames preserve semantics
- `intentSummary` → `summary`
- `checklistItems` → `checklist`
- `canonicalRefs` → `relatedDocIds`
- `workflowBindings: WorkflowId[]` → `workflowBindings: DocWorkflowBinding[]` (structured)
- `stackBindings: string[]` → `stackBindings: DocStackBinding[]` (structured)

### 3. Binding merge: curated wins, inferred fills gaps
`mergeBindings()` in `bindings.ts` implements the merge policy:
- Curated overrides from `mapping.ts` → always used when present
- Inferred bindings from heuristics → used only when no curated override exists for that doc+workflow pair
- Every decision recorded in `provenance.inferred[]` and `provenance.overridden[]`

### 4. No runtime behavior changes
Phase 2 is **build-only**. No existing runtime code paths were modified. All 160 existing tests pass unchanged. The 31 new tests cover only the new corpus modules.

---

## Test Results

```
ℹ tests 191
ℹ suites 34
ℹ pass 191
ℹ fail 0
```

All 160 original tests + 31 new corpus tests pass.

---

## Binding Coverage Summary

Overrides extracted from `mapping.ts` cover **92 specialists** across all 9 workflows:

| Workflow | Required | Optional |
|----------|----------|----------|
| security-review | 3 | 29 |
| map-codebase | 8 | 0 |
| threat-model | 7 | 4 |
| audit | 38 | 13 |
| validate-findings | 9 | 11 |
| plan-remediation | 28 | 0 |
| execute-remediation | 28 | 0 |
| verify | 14 | 0 |
| report | 3 | 0 |

---

## Phase 3 Executor Briefing

### What Phase 3 Does

Phase 3 rewires the **runtime** — it connects the corpus snapshot to the planner, installer, and renderer so they operate on `SecurityDoc` instead of `SpecialistDefinition`.

### Source files to read first

1. `migration-plan/adr-001-v2-architecture.md` — architecture contract (authority)
2. `src/corpus/snapshot-builder.ts` — how snapshots are built
3. `src/corpus/snapshot-loader.ts` — how snapshots are loaded at runtime
4. `src/core/delegation-planner.ts` — current planner (operates on SpecialistDefinition[])
5. `src/core/delegation-graph.ts` — current graph builder
6. `src/core/installer.ts` — current installer (calls fetchAllCheatSheets + generateAllSpecialists)
7. `src/core/renderer.ts` — current renderer (renders specialists to markdown)
8. `src/corpus/bindings.ts` — binding merge logic (for understanding provenance)

### New modules to create (per ADR-001)

```
src/runtime/
  consultation-trace.ts    # Consultation trace writer
```

### Existing modules to modify

| File | Change | Boundary |
|------|--------|----------|
| `src/core/delegation-planner.ts` | Rewire to accept `SecurityDoc[]` from snapshot instead of `SpecialistDefinition[]` | Knowledge → Workflow |
| `src/core/delegation-graph.ts` | Convert to doc relationship graph using `relatedDocIds` | Knowledge |
| `src/core/installer.ts` | Replace fetchAllCheatSheets + generateAllSpecialists with snapshot load | Installer |
| `src/core/renderer.ts` | Render from SecurityDoc instead of SpecialistDefinition (or add dual-render) | Artifact |
| `package.json` | Add postinstall hook for corpus build | Installer |

### Key constraints for Phase 3

1. **Workflow boundary (A) files should change minimally** — only to accept new data shapes from the planner
2. **mapping.ts remains readable** but the planner reads from snapshot, not mapping.ts directly
3. **Renderer must produce identical output** for the same semantic content — the markdown that gets installed should not change in meaning
4. **All existing tests must pass** — existing test expectations are the behavioral baseline
5. **The snapshot must be built as part of the install flow** — `installer.ts` triggers the build or uses a pre-built snapshot

### Dependency rules (from boundary-diagram.md)

- Installer (Boundary D) depends on Knowledge (Boundary C) — it loads the snapshot
- Workflow (Boundary A) depends on Knowledge — it reads docs for planning
- Role (Boundary B) does NOT depend on Knowledge — role agents get doc content from the planner
- Artifact (Boundary E) depends on Knowledge — renderer reads docs to produce markdown

### Files NOT to modify in Phase 3

- `src/core/owasp-ingestion.ts` — kept for backward compat and as the underlying fetch mechanism
- `src/core/specialist-generator.ts` — kept until Phase 5 (dual-read period)
- `src/catalog/specialists/mapping.ts` — kept but the planner no longer imports it directly
- `src/catalog/workflows/*/definition.ts` — workflow definitions unchanged

### Phase 3 definition of done

- [ ] `delegation-planner.ts` operates on `SecurityDoc[]` from snapshot
- [ ] `installer.ts` loads or builds the corpus snapshot during install
- [ ] Renderer produces equivalent output from `SecurityDoc` data
- [ ] `npm run build-corpus` produces a valid snapshot
- [ ] All existing tests pass
- [ ] New tests cover the rewired planner path
- [ ] Consultation trace schema is implemented

---

## Known Issues and Caveats

### Snapshot build requires network access
`npm run build-corpus` fetches all 113 OWASP cheat sheets from the web. Failed fetches produce `status: "pending"` entries. The snapshot is still valid but those entries lack content. This is by design — the snapshot can be rebuilt at any time.

### overrides.json has 92 entries, not 113
Only 92 of the 113 canonical IDs have curated bindings in `mapping.ts`. The remaining 21 are covered by inferred bindings. The `mergeBindings()` function handles this correctly — it uses inferred bindings for docs without overrides.

### validate-corpus script requires a built snapshot
`npm run validate-corpus` only works after `npm run build-corpus` has produced `data/corpus/owasp-corpus.snapshot.json`. This is expected.

### Alias table is manually maintained
The alias table in `ids.ts` covers common abbreviations but is not exhaustive. Aliases for the 113 docs are auto-generated from the catalog, but cross-reference aliases (e.g., "xss" → "cross-site-scripting-prevention") must be added manually.

---

## File Tree (New and Modified)

```
src/
  corpus/                          # NEW — entire directory
    ids.ts                         # ID/URI policy
    schema.ts                      # Type guards
    catalog.ts                     # Catalog/overrides loader
    normalize.ts                   # HTML → SecurityDoc extraction
    bindings.ts                    # Inferred + curated merge
    snapshot-builder.ts            # Build orchestrator
    snapshot-loader.ts             # Runtime loader
    validators.ts                  # Validation rules
    diff.ts                        # Snapshot diff tool
  core/
    types.ts                       # MODIFIED — added SecurityDoc, CorpusSnapshot types

data/
  corpus/                          # NEW — corpus data files
    catalog.json                   # 113 source entries
    overrides.json                 # 92 specialist binding overrides

scripts/                           # NEW — build scripts
  generate-catalog.mjs             # Regenerate catalog/overrides from source
  validate-corpus.mjs              # Validate existing snapshot

test/
  unit/
    corpus.test.js                 # NEW — 31 corpus tests

migration-plan/
  phase2-completion-handoff.md     # THIS FILE
```
