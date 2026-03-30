# get-shit-secured Architecture

## Overview

`get-shit-secured` (gss) is an NPX-installable CLI that installs security-focused workflows, agents, and skills for AI coding runtimes. The architecture is designed around a shared installer core with pluggable runtime adapters.

## Core Design Principles

1. **Runtime-Agnostic Core**: The installer logic knows nothing about specific runtime formats
2. **Adapter Pattern**: Each runtime (Claude, Codex, etc.) implements a common adapter interface
3. **Workflow-First Content**: Security capabilities are organized by workflow, not by runtime
4. **Deterministic Installation**: All installs generate a manifest for uninstall/reinstall support
5. **Non-Destructive**: Existing runtime configs are preserved and merged safely

## Directory Structure

```
src/
├── cli/                    # CLI entry point and argument parsing
│   ├── index.ts           # Main CLI entry point
│   └── parse-args.ts      # Argument parsing and validation
├── core/                   # Shared installer logic
│   ├── types.ts           # Public type definitions
│   ├── paths.ts           # Path resolution utilities
│   ├── manifest.ts        # Install manifest handling
│   └── installer.ts       # Main installer orchestration
├── runtimes/               # Runtime-specific adapters
│   ├── claude/
│   │   ├── adapter.ts     # Claude runtime adapter
│   │   └── templates/     # Claude-specific templates (future)
│   └── codex/
│       ├── adapter.ts     # Codex runtime adapter
│       └── templates/     # Codex-specific templates (future)
├── catalog/                # Security workflow definitions
│   └── workflows/
│       ├── map-codebase/  # Codebase mapping workflow
│       ├── threat-model/  # Threat modeling workflow
│       ├── audit/         # Security audit workflow
│       ├── verify/        # Verification workflow
│       ├── remediate/     # Remediation workflow
│       └── report/        # Reporting workflow
└── shared/                 # Shared templates and utilities
    └── templates/         # Common template fragments
```

## Core Types

### RuntimeTarget
Supported AI coding runtimes:
- `claude` - Claude Code by Anthropic
- `codex` - OpenAI Codex (future)

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
- `remediate` - Apply remediations
- `report` - Generate reports

## Adapter Contract

Each runtime implements `RuntimeAdapter`:

```typescript
interface RuntimeAdapter {
  readonly runtime: RuntimeTarget;
  resolveRootPath(scope: InstallScope, cwd: string): string;
  getFilesForWorkflow(workflowId: WorkflowId): InstallFile[];
  getPlaceholderFiles(): InstallFile[];
  getSettingsMerge?(): { path: string; content: Record<string, unknown> } | null;
}
```

### Responsibilities

- **resolveRootPath**: Determine where files should be installed
- **getFilesForWorkflow**: Return files to create for a specific workflow
- **getPlaceholderFiles**: Return baseline files (commands, agents, etc.)
- **getSettingsMerge**: Optional runtime-specific settings to merge

## Installation Flow

```
1. Parse CLI arguments
2. Validate arguments
3. Instantiate runtime adapters
4. For each adapter:
   a. Resolve install root
   b. Collect placeholder files
   c. Collect workflow files
   d. Write files (or dry-run)
   e. Merge settings if applicable
5. Write/update install manifest
6. Report results
```

## Install Manifest

Stored at `.gss/install-manifest.json`:

```typescript
interface InstallManifest {
  version: string;           // gss version
  installedAt: string;       // ISO timestamp
  scope: InstallScope;       // local/global
  runtimes: RuntimeTarget[]; // Installed runtimes
  workflows: WorkflowId[];   // Installed workflows
  files: {                   // Created files by runtime
    [runtime: string]: string[];
  };
  roots: {                   // Install roots by runtime
    [runtime: string]: string;
  };
}
```

## Adding a New Runtime

1. Create `src/runtimes/<runtime>/adapter.ts`
2. Implement `RuntimeAdapter` interface
3. Export adapter class
4. Add to CLI adapter instantiation in `src/cli/index.ts`
5. Add placeholder templates and workflow files

## Adding a New Workflow

1. Create directory in `src/catalog/workflows/<workflow>/`
2. Add `README.md` with workflow description
3. For each runtime adapter, add `get<Workflow>Files()` method
4. Return appropriate `InstallFile[]` for that runtime's format

## File Writing Behavior

- **New files**: Created with provided content
- **Existing files**: Skipped unless `merge: true`
- **Merge files**: JSON-merged, preserving existing keys
- **Directories**: Created recursively as needed

## Security Considerations

- Path traversal validation on all file operations
- No execution of external code during install
- Manifest validation before uninstall
- Safe JSON parsing with error handling

## Future Extensions

- Additional runtimes (Gemini, Cursor, Copilot)
- Workflow orchestration (multi-step pipelines)
- Remote content distribution
- Versioned security content
- Community workflow marketplace
