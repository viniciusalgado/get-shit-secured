# get-shit-secured Architecture

## Overview

`get-shit-secured` (gss) is an NPX-installable CLI that installs security-focused workflows, agents, and skills for AI coding runtimes. The architecture is designed around a shared installer core with pluggable runtime adapters.

## Core Design Principles

1. **Runtime-Agnostic Core**: The installer logic knows nothing about specific runtime formats
2. **Adapter Pattern**: Each runtime (Claude, Codex, etc.) implements a common adapter interface
3. **Workflow-First Content**: Security capabilities are organized by workflow, not by runtime
4. **Deterministic Installation**: All installs generate a manifest for uninstall/reinstall support
5. **Non-Destructive**: Existing runtime configs are preserved and merged safely
6. **Path Safety**: All file operations validate paths to prevent traversal attacks

## Directory Structure

```
src/
├── cli/                    # CLI entry point and argument parsing
│   ├── index.ts           # Main CLI entry point
│   └── parse-args.ts      # Argument parsing and validation
├── core/                   # Shared installer logic
│   ├── types.ts           # Public type definitions (v2 adapter contract)
│   ├── paths.ts           # Path resolution utilities with safety validation
│   ├── manifest.ts        # Install manifest handling (v1 + v2 support)
│   ├── installer.ts       # Main installer orchestration with staged pipeline
│   ├── renderer.ts        # Workflow rendering for all runtimes
│   ├── specialist-generator.ts  # OWASP specialist generation
│   └── owasp-ingestion.ts # OWASP cheat sheet ingestion
├── runtimes/               # Runtime-specific adapters
│   ├── claude/
│   │   └── adapter.ts     # Claude runtime adapter (hooks + agents)
│   └── codex/
│       └── adapter.ts     # Codex runtime adapter (skills + config)
├── catalog/                # Security workflow definitions
│   ├── workflows/
│   │   ├── map-codebase/     # Codebase mapping workflow
│   │   ├── threat-model/     # Threat modeling workflow
│   │   ├── audit/            # Security audit workflow
│   │   ├── plan-remediation/ # Remediation planning workflow
│   │   ├── execute-remediation/ # Remediation execution workflow
│   │   ├── verify/           # Verification workflow
│   │   ├── report/           # Reporting workflow
│   │   └── registry.ts       # Workflow registry
│   └── specialists/
│       └── mapping.ts        # Stack-to-specialist bindings
└── shared/                 # Shared templates and utilities
    └── templates/         # Common template fragments
```

## Core Types

### RuntimeTarget
Supported AI coding runtimes:
- `claude` - Claude Code by Anthropic
- `codex` - OpenAI Codex

### InstallScope
Installation targets:
- `local` - Project-specific (e.g., `./.claude/`)
- `global` - User-level (e.g., `~/.claude/`)

### WorkflowId
Security workflow identifiers:
- `map-codebase` - Analyze codebase structure
- `threat-model` - Generate threat models
- `audit` - Run security audits
- `verify` - Verify security fixes
- `plan-remediation` - Plan remediations
- `execute-remediation` - Execute remediations
- `report` - Generate reports

### RoleAgentId
Fixed role-based agents:
- `gss-mapper` - Codebase structure analyzer
- `gss-threat-modeler` - Threat modeling specialist
- `gss-auditor` - Security vulnerability scanner
- `gss-remediator` - Security fix planner
- `gss-verifier` - Fix verification specialist
- `gss-reporter` - Report aggregator

## Adapter Contract (v2)

Each runtime implements `RuntimeAdapter` with the following methods:

```typescript
interface RuntimeAdapter {
  readonly runtime: RuntimeTarget;

  // Path resolution
  resolveRootPath(scope: InstallScope, cwd: string): string;
  resolveSupportSubtree(scope: InstallScope, cwd: string): string;

  // Capabilities
  getCapabilities(): RuntimeAdapterCapabilities;

  // File generation
  getPlaceholderFiles(): RuntimeFile[];
  getFilesForWorkflow(workflowId: WorkflowId): RuntimeFile[];
  getSupportFiles(): RuntimeFile[];

  // Config management
  getManagedJsonPatches(): ManagedJsonPatch[];
  getManagedTextBlocks(): ManagedTextBlock[];

  // Hooks
  getHooks(): RuntimeHook[];

  // Legacy (deprecated)
  getSettingsMerge?: () => { path: string; content: Record<string, unknown> } | null;
}
```

### New Type Definitions

#### RuntimeFile
Enhanced file descriptor with category and overwrite policy:
```typescript
interface RuntimeFile {
  relativePath: string;
  content: string;
  category: 'entrypoint' | 'support';
  overwritePolicy: 'create-only' | 'replace-managed' | 'merge-json';
  supportSubtree?: string;
}
```

#### ManagedJsonPatch
JSON config merging with ownership tracking:
```typescript
interface ManagedJsonPatch {
  path: string;
  owner: string;
  content: Record<string, unknown>;
  mergeStrategy: 'shallow' | 'deep';
  keyPath?: string;
}
```

#### ManagedTextBlock
Text file block insertion with ownership markers:
```typescript
interface ManagedTextBlock {
  path: string;
  owner: string;
  format: 'toml' | 'markdown' | 'jsonc';
  startMarker: string;
  endMarker: string;
  content: string;
}
```

#### RuntimeHook
Hook definition for runtime integration:
```typescript
interface RuntimeHook {
  id: string;
  event: 'SessionStart' | 'SessionEnd' | 'PreToolUse' | 'PostToolUse';
  matcher?: string;
  command: string;
  blocking: boolean;
  description?: string;
}
```

## Installation Flow (Staged Pipeline)

```
1. Parse CLI arguments
2. Validate arguments
3. Instantiate runtime adapters
4. For each adapter:
   a. Resolve install root
   b. Validate all paths (path safety check)
   c. Collect entrypoint files, support files, and managed config declarations
   d. Create support subtree (.claude/gss/ or .codex/gss/)
   e. Write support files
   f. Write entrypoint files
   g. Apply managed JSON merges
   h. Apply managed text blocks with ownership markers
   i. Register hooks
   j. Write runtime manifest
5. Write/update install manifest (v2 format)
6. Report results
```

## Install Manifest (v2)

Stored at `.gss/install-manifest.json`:

```typescript
interface InstallManifestV2 {
  manifestVersion: 2;
  packageVersion: string;
  installedAt: string;
  updatedAt: string;
  scope: InstallScope;
  runtimes: RuntimeTarget[];
  workflowIds: WorkflowId[];
  roots: Partial<Record<RuntimeTarget, string>>;
  files: Partial<Record<RuntimeTarget, string[]>>;
  managedConfigs: Partial<Record<RuntimeTarget, ManagedConfigRecord[]>>;
  hooks: Partial<Record<RuntimeTarget, string[]>>;
  runtimeManifests: Partial<Record<RuntimeTarget, string>>;
}
```

## Runtime Support Payload

Each runtime has a support subtree under its root:

### Claude (`.claude/gss/`)
- `hooks/` - Hook scripts
  - `session-start.js` - Environment sanity check
  - `pre-tool-write.js` - Sensitive file warnings
  - `pre-tool-edit.js` - Artifact edit warnings
  - `post-tool-write.js` - Artifact validation
- `runtime-manifest.json` - Runtime metadata
- `README.md` - Support documentation

### Codex (`.codex/gss/`)
- `runtime-manifest.json` - Runtime metadata
- `README.md` - Support documentation
- (Hooks are not yet supported by Codex)

## Uninstall Flow

1. Read install manifest
2. Validate all paths from manifest
3. Remove all files tracked in manifest
4. Remove managed config blocks by owner
5. Remove hooks directory
6. Remove runtime manifest
7. Clean up empty directories
8. Remove manifest if all runtimes uninstalled

## Path Safety

All file operations go through validation:

1. **Absolute Path Resolution**: Paths are resolved before any operation
2. **Boundary Checking**: Targets must be within runtime root or project root
3. **Symlink Rejection**: Symlink escapes are treated as invalid
4. **Manifest Validation**: Paths from disk are validated before use

## Role-Based Agents

The framework includes six fixed role agents:

| Agent | Access Level | Responsibilities |
|-------|-------------|------------------|
| gss-mapper | read-only | Codebase analysis |
| gss-threat-modeler | read-only | Threat identification |
| gss-auditor | read-only | Vulnerability scanning |
| gss-remediator | write-capable | Fix planning |
| gss-verifier | verification-only | Fix validation |
| gss-reporter | read-only | Report generation |

Each agent has:
- Explicit read/write permissions
- Delegation rules
- Escalation rules
- Evidence requirements
- "Done means" criteria

See [AGENTS.md](../AGENTS.md) for detailed agent guidelines.

## Adding a New Runtime

1. Create `src/runtimes/<runtime>/adapter.ts`
2. Implement `RuntimeAdapter` interface
3. Export adapter class
4. Add to CLI adapter instantiation in `src/cli/index.ts`
5. Add runtime-specific templates if needed

## Adding a New Workflow

1. Create directory in `src/catalog/workflows/<workflow>/`
2. Add `definition.ts` with workflow metadata
3. Add `README.md` with workflow description
4. Register in `src/catalog/workflows/registry.ts`
5. Update renderer if custom formatting needed

## Security Considerations

- **Path Traversal Protection**: All paths validated before operations
- **No Code Execution**: No external code execution during install
- **Manifest Validation**: Manifest entries validated before uninstall
- **Safe JSON Parsing**: All JSON parsing includes error handling
- **Secrets Protection**: Sensitive file patterns are protected by default

## Future Extensions

- Additional runtimes (Gemini, Cursor, Copilot)
- Workflow orchestration (multi-step pipelines)
- Remote content distribution
- Versioned security content
- Community workflow marketplace
