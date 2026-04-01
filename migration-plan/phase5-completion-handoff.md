# Phase 5 Completion Handoff — GSS v2 Migration

**Date**: 2026-04-01
**Status**: Phase 5 COMPLETE
**Next**: Phase 6 (Workflow Integration — wire workflows to call MCP tools)

---

## What Phase 5 Produced

Phase 5 implements the **local stdio MCP server** that exposes the corpus snapshot, consultation planner, and compliance validator as deterministic tools and resources. This is the concrete realization of the architectural shift: 113 specialist prompt files replaced by 7 tool calls over a stable protocol boundary.

### Deliverables

#### New Dependency

| Package | Version | Purpose |
|---------|---------|---------|
| `@modelcontextprotocol/sdk` | 1.29.0 | Official MCP SDK for stdio server |

This is the first production (non-dev) dependency. Justified because the MCP server IS the product boundary.

#### New Source Files

| File | Purpose |
|------|---------|
| `src/mcp/server.ts` | stdio MCP entrypoint — loads corpus, registers tools/resources, routes requests |
| `src/mcp/resources.ts` | Resource handlers for `security://` URI scheme |
| `src/mcp/diagnostics.ts` | Startup validation and corpus diagnostics |
| `src/mcp/tools/consultation-plan.ts` | `get_workflow_consultation_plan` tool handler |
| `src/mcp/tools/validate-coverage.ts` | `validate_security_consultation` tool handler |
| `src/mcp/tools/read-doc.ts` | `read_security_doc` tool handler |
| `src/mcp/tools/related-docs.ts` | `get_related_security_docs` tool handler |
| `src/mcp/tools/search-docs.ts` | `search_security_docs` tool handler |
| `src/mcp/tools/diagnostics.ts` | `list_supported_workflows` and `list_supported_stacks` tool handlers |

#### Modified Source Files

| File | Change |
|------|--------|
| `package.json` | Added `@modelcontextprotocol/sdk` dependency |
| `src/core/installer.ts` | Filled Stage 3 — MCP server copy + registration |
| `src/core/install-stages.ts` | Updated Stage 3 comment |
| `src/runtimes/claude/adapter.ts` | Added `getMcpRegistration()` method |
| `src/runtimes/codex/adapter.ts` | Added `getMcpRegistration()` method |

#### New Test Files

| File | Tests |
|------|-------|
| `test/unit/mcp/server.test.js` | 36 tests covering all tools, resources, and integration |

---

## MCP Surface

### Resources (3 URI templates)

| URI Template | Purpose |
|---|---|
| `security://catalog/index` | Corpus metadata: version, doc counts, workflows, stacks |
| `security://owasp/cheatsheet/{id}` | Full `SecurityDoc` by canonical ID |
| `security://workflow/{workflowId}/defaults` | Docs bound to a workflow, grouped by priority |

### Tools (7 total: 5 core + 2 diagnostic)

| Tool | Purpose | Input |
|------|---------|-------|
| `get_workflow_consultation_plan` | Deterministic consultation plan | workflowId, stacks?, issueTags?, changedFiles? |
| `validate_security_consultation` | Coverage validation (pass/warn/fail) | workflowId, consultedDocs, stacks?, issueTags?, changedFiles? |
| `read_security_doc` | Doc lookup by ID or URI | id?, uri? |
| `get_related_security_docs` | Bidirectional related-doc expansion | id |
| `search_security_docs` | In-memory fuzzy search | query, sourceTypes?, workflowId?, stack?, issueTags?, topK? |
| `list_supported_workflows` | Workflows with required docs | (none) |
| `list_supported_stacks` | All stack tags in corpus | (none) |

---

## Architecture

### Server Lifecycle

```
server.ts
  ├── Resolve snapshot path (CLI arg > env var > relative)
  ├── Load corpus with loadCorpusSnapshot()
  ├── Validate with isCorpusSnapshot() — fail fast on corrupt data
  ├── Compute diagnostics (version, doc counts, workflows, stacks)
  ├── Build resource list
  ├── Register MCP request handlers
  └── Start StdioServerTransport
```

### Per-Request Flow

```
Host → MCP (tools/call)
  ├── Parse tool name + input args
  ├── Route to handler function
  ├── Handler reads from LoadedSnapshot indices (no I/O)
  ├── Compute result (planner/validator/lookup/search)
  └── Return structured JSON via MCP content

Host → MCP (resources/read)
  ├── Parse URI
  ├── Route to resource handler
  ├── Lookup by URI pattern
  └── Return document content
```

### Key Behavioral Characteristics

| Aspect | Behavior |
|--------|----------|
| Stateless | Each tool call is independent. No session state between calls |
| Deterministic | Same inputs → same outputs. Ordering: score desc, then docId asc |
| Read-only | MCP never writes to disk, modifies state, or edits the repo |
| Offline | No network access at runtime. All data from in-memory snapshot |
| Host-neutral | Same tool contracts for Claude Code and Codex |
| Small surface | 7 tools, 3 resource templates. Hard cap enforced |

### Snapshot Path Resolution

1. `--corpus-path` CLI argument (for testing)
2. `GSS_CORPUS_PATH` environment variable
3. Relative to server executable: `../corpus/owasp-corpus.json`

---

## Installer Integration

### Stage 3 (Previously Stub — Now Implemented)

For each runtime adapter during install:

1. **Copy MCP server**: `dist/mcp/server.js` → support subtree `mcp/server.js`
2. **Register MCP**: Write `mcpServers.gss-security-docs` entry into runtime's `settings.json`
3. **Track**: Record MCP config path in install manifest

### Support File Layout After Install

```
.claude/gss/
  corpus/owasp-corpus.json     # From Phase 3
  mcp/server.js                # NEW: compiled MCP server
```

### MCP Config Entry (in settings.json)

```json
{
  "mcpServers": {
    "gss-security-docs": {
      "command": "node",
      "args": ["<support-subtree>/mcp/server.js", "--corpus-path", "<corpus-path>"]
    }
  }
}
```

### Adapter Changes

Both `ClaudeAdapter` and `CodexAdapter` now have:

```typescript
getMcpRegistration(serverPath: string, corpusPath: string): ManagedJsonPatch
```

---

## Test Results

```
ℹ tests 36 (all Phase 5)
ℹ suites 9
ℹ pass 36
ℹ fail 0
```

Test coverage:
- Diagnostics: 4 tests
- Resources: 6 tests
- Consultation plan tool: 4 tests
- Validate coverage tool: 4 tests
- Read doc tool: 5 tests
- Related docs tool: 3 tests
- Search docs tool: 8 tests
- Integration (plan→read→validate): 2 tests

All pre-existing Phase 4 tests (67 tests) continue to pass.

---

## Files NOT Changed

| File | Why |
|------|-----|
| `src/core/consultation-planner.ts` | Wrapped, not modified |
| `src/core/consultation-compliance.ts` | Wrapped, not modified |
| `src/core/consultation-signals.ts` | Not used by MCP (host extracts signals) |
| `src/corpus/snapshot-loader.ts` | Used as-is for lookup functions |
| `src/corpus/ids.ts` | Used as-is for alias resolution |
| `src/corpus/schema.ts` | Used as-is for validation |
| All existing test files | Untouched |

---

## File Tree (New and Modified in Phase 5)

```
src/
  mcp/
    server.ts                              # NEW — stdio MCP server entrypoint (~450 lines)
    resources.ts                           # NEW — security:// resource handlers (~130 lines)
    diagnostics.ts                         # NEW — startup validation (~75 lines)
    tools/
      consultation-plan.ts                 # NEW — plan tool handler (~55 lines)
      validate-coverage.ts                 # NEW — coverage tool handler (~55 lines)
      read-doc.ts                          # NEW — doc read tool handler (~45 lines)
      related-docs.ts                      # NEW — related docs tool handler (~30 lines)
      search-docs.ts                       # NEW — search tool handler (~140 lines)
      diagnostics.ts                       # NEW — diagnostic tool handlers (~40 lines)
  core/
    installer.ts                           # MODIFIED — Stage 3 MCP registration filled in
    install-stages.ts                      # MODIFIED — Stage 3 comment updated
  runtimes/
    claude/adapter.ts                      # MODIFIED — added getMcpRegistration()
    codex/adapter.ts                       # MODIFIED — added getMcpRegistration()

test/
  unit/
    mcp/
      server.test.js                       # NEW — 36 tests

migration-plan/
  phase5-completion-handoff.md             # THIS FILE

package.json                               # MODIFIED — added @modelcontextprotocol/sdk
```

---

## Phase 6 Executor Briefing

### What Phase 6 Does

Phase 6 wires the **workflow definitions** to call MCP tools instead of reading specialist prompt files. Each workflow template (`audit`, `security-review`, `threat-model`, etc.) is updated to include steps that:

1. Call `get_workflow_consultation_plan` before analysis
2. Read required docs via `read_security_doc` or resources
3. Call `validate_security_consultation` after analysis
4. Write consultation trace to artifacts

### Source files to read first

1. `src/mcp/server.ts` — MCP server entrypoint
2. `src/mcp/tools/consultation-plan.ts` — plan tool handler
3. `src/mcp/tools/validate-coverage.ts` — coverage tool handler
4. `src/mcp/resources.ts` — resource URI handlers
5. `src/catalog/workflows/*/definition.ts` — workflow definitions to modify
6. `src/core/renderer.ts` — template rendering for commands/agents

### Key modules Phase 6 should modify

| Module | Change |
|--------|--------|
| `src/catalog/workflows/*/definition.ts` | Add MCP consultation steps to workflow steps |
| `src/core/renderer.ts` | Update rendering to include MCP tool call instructions |
| Workflow prompt templates | Add consultation plan/validate steps |

### Integration pattern for workflows

```
1. Workflow starts
2. Extract signals (stacks, issueTags, changedFiles)
3. Call get_workflow_consultation_plan(workflowId, signals)
4. Read each required doc: read_security_doc(id) or resources/read
5. AI model performs analysis using those docs as grounding
6. Optionally read related docs: get_related_security_docs(id)
7. Call validate_security_consultation(workflowId, consultedDocs, signals)
8. Write artifacts including consultation trace with coverageStatus
```

### Key constraints for Phase 6

1. Workflow definitions must be backward-compatible (work without MCP if unavailable)
2. The old specialist prompt files remain available during transition
3. Workflow templates should include fallback instructions when MCP is down
4. Each workflow's `steps` array should be extended, not replaced
5. The renderer must emit both MCP-aware and legacy command/agent files

### Definition of done for Phase 6

- [ ] All 9 workflow definitions include MCP consultation steps
- [ ] The renderer emits MCP-aware command/agent templates
- [ ] Each workflow template includes fallback for missing MCP
- [ ] All Phase 4 and Phase 5 tests continue to pass
- [ ] New tests cover workflow template generation with MCP steps
- [ ] Smoke test: full audit flow via MCP tools works end-to-end

---

## Risks Addressed

| Risk | Mitigation Applied |
|------|-------------------|
| Tool surface too broad | Hard cap: 5 core + 2 diagnostic tools |
| Workflows overuse search | `search_security_docs` documented as exploration-only |
| Host-specific coupling | All tool I/O is JSON, no runtime-specific formatting |
| Corpus load performance | ~113 docs, <2MB JSON, loads in <100ms |
| MCP SDK dependency chain | Lightweight (~50KB), depends only on Node.js standard APIs |
| MCP server crash | Stateless — each call independent, host can restart |
