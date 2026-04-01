# Phase 6 Completion Handoff — GSS v2 Migration

**Date**: 2026-04-01
**Status**: Phase 6 COMPLETE
**Next**: Phase 7 (End-to-End Validation and Legacy Removal)

---

## What Phase 6 Produced

Phase 6 rewrites the workflow definitions and renderer to drive MCP-backed consultation planning instead of per-specialist prompt delegation. The user-facing product stays identical: same slash commands, same artifact locations, same workflow chain. The internal mechanism changes from "read 113 specialist prompt files and choose" to "call MCP tools for deterministic plans."

### Deliverables

#### New Types (`src/core/types.ts`)

| Type | Purpose |
|------|---------|
| `SignalDerivation` | Per-workflow signal derivation strategy (stacks, issueTags, changedFiles) |
| `ConsultationTrace` | Structured consultation trace embedded in workflow artifacts |
| `mcpConsultation` field on `WorkflowOrchestrationPhase` | `'full' \| 'minimal' \| 'none'` per phase |

#### Deprecated Types/Fields

| Field | Status |
|-------|--------|
| `delegationPolicy` on `WorkflowDefinition` | `@deprecated` — use `signalDerivation` |
| `cheatSheetUrls` on `OwaspTopic` | `@deprecated` — MCP corpus manages URLs |
| `specialistMode` on `WorkflowOrchestrationPhase` | `@deprecated` — use `mcpConsultation` |

#### Modified Source Files

| File | Change |
|------|--------|
| `src/core/types.ts` | Added `SignalDerivation`, `ConsultationTrace`, `mcpConsultation` field; deprecated old fields |
| `src/core/renderer.ts` | Added `renderMcpConsultationSection()`, `renderConsultationTraceRequirement()`; removed specialist rendering functions, delegation plan sections; simplified OWASP topic rendering; updated delegation rules, role instructions, done criteria, orchestration rendering |
| `src/catalog/workflows/security-review/definition.ts` | Removed `cheatSheetUrls`, `delegationPolicy`; added `signalDerivation`; replaced runtime prompts with MCP consultation; replaced `specialistMode` with `mcpConsultation` on phases |
| `src/catalog/workflows/audit/definition.ts` | Removed `cheatSheetUrls`, `delegationPolicy`; added `signalDerivation`; replaced specialist delegation with MCP consultation |
| `src/catalog/workflows/verify/definition.ts` | Removed `cheatSheetUrls`, `delegationPolicy`; added `signalDerivation`; replaced specialist verification with MCP consultation |
| `src/catalog/workflows/validate-findings/definition.ts` | Removed `cheatSheetUrls`, `delegationPolicy`; added `signalDerivation`; replaced specialist re-evaluation with MCP consultation |
| `src/catalog/workflows/plan-remediation/definition.ts` | Removed `cheatSheetUrls`, `delegationPolicy`; added `signalDerivation`; replaced specialist-guided planning with MCP consultation |
| `src/catalog/workflows/map-codebase/definition.ts` | Removed `cheatSheetUrls`, `delegationPolicy`; added `signalDerivation` |
| `src/catalog/workflows/threat-model/definition.ts` | Removed `cheatSheetUrls`, `delegationPolicy`; added `signalDerivation` |
| `src/catalog/workflows/execute-remediation/definition.ts` | Removed `cheatSheetUrls`, `delegationPolicy`; added `signalDerivation` |
| `src/catalog/workflows/report/definition.ts` | Removed `cheatSheetUrls`, `delegationPolicy`; added `signalDerivation`; added consultation trace aggregation |
| `src/runtimes/claude/adapter.ts` | Removed `setSpecialists()`, `getSpecialistFiles()`, specialist README; removed `SpecialistDefinition` import |
| `src/runtimes/codex/adapter.ts` | Removed `setSpecialists()`, `getSpecialistFiles()`, specialist README; removed specialist imports |

#### Updated Test Files

| File | Change |
|------|--------|
| `test/unit/workflow-registry.test.js` | Updated `cheatSheetUrls` test to `glossaryUrl` |
| `test/unit/validate-findings-workflow.test.js` | Updated `delegationPolicy` test to `signalDerivation`; updated orchestration phase tests |

---

## Signal Derivation Per Workflow

| Workflow | stacks | issueTags | changedFiles |
|----------|--------|-----------|--------------|
| `security-review` | `from-diff-heuristics` | `from-diff-heuristics` | `from-diff` |
| `map-codebase` | `from-codebase` | `none` | `none` |
| `threat-model` | `from-prior-artifact` | `none` | `none` |
| `audit` | `from-prior-artifact` | `from-findings` | `none` |
| `validate-findings` | `from-prior-artifact` | `from-findings` | `none` |
| `plan-remediation` | `from-prior-artifact` | `from-findings` | `from-prior-artifact` |
| `execute-remediation` | `from-prior-artifact` | `from-findings` | `from-prior-artifact` |
| `verify` | `from-prior-artifact` | `from-findings` | `from-prior-artifact` |
| `report` | `none` | `none` | `none` |

---

## MCP Consultation Per Orchestration Phase

### security-review

| Phase | mcpConsultation |
|-------|----------------|
| collect-change-set | `none` |
| security-relevance-gate | `none` |
| impact-pass | `minimal` |
| audit-pass | `full` |
| specialist-pass | `full` |
| validation-and-tdd | `minimal` |
| finalize | `none` |

---

## New Renderer Functions

| Function | Purpose |
|----------|---------|
| `renderMcpConsultationSection(workflow)` | 7-step MCP consultation template for rendered agents/skills |
| `renderConsultationTraceRequirement(workflowId)` | Consultation trace inclusion requirement |

## Removed Renderer Functions

| Function | Why removed |
|----------|-----------|
| `renderClaudeSpecialist()` | Replaced by MCP consultation |
| `renderCodexSpecialist()` | Replaced by MCP consultation |
| `renderClaudeSpecialistsReadme()` | No more specialist files |
| `renderCodexSpecialistsReadme()` | No more specialist files |
| `renderClaudeDelegationPlanSection()` | Replaced by MCP consultation section |
| `renderCodexDelegationPlanSection()` | Replaced by MCP consultation section |
| All `renderSpecialist*()` helpers | No longer needed |

---

## Test Results

```
ℹ tests 582
ℹ pass 582
ℹ fail 0
```

All pre-existing Phase 4 and Phase 5 tests continue to pass alongside the updated Phase 6 tests.

---

## Architecture

### Before Phase 6

```
Workflow starts
  → Specialist name lists hardcoded in workflow definition
  → Delegate to gss-specialist-X when issue Y detected
  → Read specialist prompt files
  → Follow specialist guidance
```

### After Phase 6

```
Workflow starts
  → Extract signals (stack, issueTags, changedFiles) via signalDerivation strategy
  → Call MCP get_workflow_consultation_plan(workflowId, signals)
  → Read required docs via MCP resources (security://owasp/cheatsheet/{docId})
  → AI model performs analysis using those docs as grounding
  → Optionally expand via get_related_security_docs
  → Call MCP validate_security_consultation(workflowId, consultedDocs, signals)
  → Write artifacts including consultation trace with coverageStatus
```

### Key Behavioral Changes

| Aspect | Before | After |
|--------|--------|-------|
| Security knowledge source | 113 specialist prompt files | MCP corpus (7 tools) |
| Consultation planning | Ad-hoc delegation by specialist name | Deterministic plan from signals |
| Coverage validation | Manual aggregation | `validate_security_consultation` tool |
| Artifact trace | None | Structured `ConsultationTrace` section |
| Orchestration phases | `specialistMode` | `mcpConsultation` |
| Runtime prompts | "delegate to gss-specialist-X" | "call MCP consultation tools" |
| Adapter methods | `getSpecialistFiles()`, `setSpecialists()` | Removed |

---

## Files NOT Changed

| File | Why |
|------|-----|
| `src/mcp/server.ts` | MCP server entrypoint — wrapped, not modified |
| `src/mcp/tools/*.ts` | MCP tool handlers — wrapped, not modified |
| `src/mcp/resources.ts` | Resource handlers — wrapped, not modified |
| `src/core/consultation-planner.ts` | Core planner — wrapped, not modified |
| `src/core/consultation-compliance.ts` | Compliance validator — wrapped, not modified |
| `src/core/install-stages.ts` | Install pipeline — Stage 3 still uses MCP registration from Phase 5 |
| `src/core/installer.ts` | Installer — still handles MCP server copy from Phase 5 |

---

## File Tree (New and Modified in Phase 6)

```
src/
  core/
    types.ts                                # MODIFIED — added SignalDerivation, ConsultationTrace, mcpConsultation
    renderer.ts                             # MODIFIED — added MCP section, removed specialist functions
  catalog/
    workflows/
      security-review/definition.ts         # MODIFIED — full MCP consultation rewrite
      audit/definition.ts                   # MODIFIED — full MCP consultation rewrite
      verify/definition.ts                  # MODIFIED — full MCP consultation rewrite
      validate-findings/definition.ts       # MODIFIED — full MCP consultation rewrite
      plan-remediation/definition.ts        # MODIFIED — full MCP consultation rewrite
      map-codebase/definition.ts            # MODIFIED — signalDerivation, removed cheatSheetUrls
      threat-model/definition.ts            # MODIFIED — signalDerivation, removed cheatSheetUrls
      execute-remediation/definition.ts     # MODIFIED — signalDerivation, removed cheatSheetUrls
      report/definition.ts                  # MODIFIED — signalDerivation, consultation trace aggregation
  runtimes/
    claude/adapter.ts                       # MODIFIED — removed specialist methods
    codex/adapter.ts                        # MODIFIED — removed specialist methods

test/
  unit/
    workflow-registry.test.js              # MODIFIED — updated cheatSheetUrls → glossaryUrl
    validate-findings-workflow.test.js      # MODIFIED — updated delegationPolicy → signalDerivation

migration-plan/
  phase6-completion-handoff.md             # THIS FILE
```

---

## Phase 7 Executor Briefing

### What Phase 7 Does

Phase 7 performs end-to-end validation of the complete MCP-backed system and removes any remaining legacy code. Specifically:

1. **Full install smoke test** — Run `npx get-shit-secured --claude --local` and verify:
   - Zero specialist files produced (`agents/gss-specialist-*.md` absent)
   - MCP server copied and registered
   - All 9 workflow agent files contain MCP consultation instructions
   - No `gss-specialist-*` references in any rendered file

2. **Remove deprecated types** — Clean up `@deprecated` fields that Phase 6 left for backward compat:
   - Remove `delegationPolicy` from `WorkflowDefinition` type
   - Remove `cheatSheetUrls` from `OwaspTopic` type
   - Remove `specialistMode` from `WorkflowOrchestrationPhase` type
   - Remove `SpecialistDefinition`, `ActivationRule`, `DelegationRule`, etc.
   - Remove `DelegationPlan`, `DelegationPlanEntry`, `DelegationComplianceReport`, etc.
   - Remove `DEFAULT_DELEGATION_CONSTRAINTS` and `DEFAULT_DELEGATION_POLICY`

3. **Remove specialist generator** — Delete `src/core/specialist-generator.ts` and `src/core/owasp-ingestion.ts` if they're no longer needed

4. **Update remaining references** — Any remaining imports of deprecated types in tests or other files

5. **Final regression** — All 582+ tests pass with no deprecated code remaining

### Source files to read first

1. `src/core/types.ts` — find all `@deprecated` markers
2. `src/core/renderer.ts` — verify no specialist function remnants
3. `src/runtimes/claude/adapter.ts` and `src/runtimes/codex/adapter.ts` — verify clean adapter surfaces
4. `src/core/install-stages.ts` — verify specialist install path is gone
5. `test/unit/phase6-*.test.js` — all Phase 6 tests for regression

### Key constraints for Phase 7

1. No `@deprecated` markers should remain — Phase 7 is the cleanup
2. `SpecialistDefinition` and all delegation types should be fully removed
3. The specialist generator and OWASP ingestion modules should be evaluated for removal
4. All 9 workflows must render without any specialist references
5. A full install should produce zero specialist files and one MCP registration
6. The `legacySpecialists` flag in `CliArgs` should be removed
7. All Phase 6 regression tests must continue to pass

### Definition of done for Phase 7

- [ ] Zero `@deprecated` markers remain in `types.ts`
- [ ] `SpecialistDefinition` and all delegation types are removed
- [ ] `legacySpecialists` CLI flag is removed
- [ ] Specialist generator module is removed (if no longer needed)
- [ ] Full install produces zero specialist files
- [ ] All rendered agent/skill files contain MCP consultation, zero specialist references
- [ ] All 582+ tests pass
- [ ] TypeScript compiles cleanly with no warnings

---

## Risks Addressed

| Risk | Mitigation Applied |
|------|-------------------|
| Workflows lose domain specificity | MCP consultation provides same OWASP grounding, just deterministically |
| Signal derivation too weak | Explicit per-workflow `signalDerivation` with clear semantics |
| Report quality drops | Output schemas and done criteria preserved; MCP adds consultation traces |
| Backward compat breaks during transition | Deprecated fields kept through Phase 6; Phase 7 removes them |
| Specialist rendering still referenced | All adapter methods and renderer functions fully removed |
