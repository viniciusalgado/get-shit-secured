# get-shit-secured (gss)

Security workflow installer for AI coding runtimes. GSS installs workflow-first prompts, MCP-backed security consultation, and runtime validation support for Claude and Codex.

## Quick Start

```bash
# Install for Claude (local project)
npx get-shit-secured --claude --local

# Install for Codex (global)
npx get-shit-secured --codex --global

# Install for both
npx get-shit-secured --claude --codex --local

# Uninstall
npx get-shit-secured --uninstall
```

## Installation Scope

- `--local`: Install to current project directory (default)
- `--global`: Install to user home directory

## Runtime Targets

- `--claude`: Install Claude Code commands, agents, hooks, and MCP registration
- `--codex`: Install Codex skills and MCP registration
- `--all`: Install for all supported runtimes

## Options

- `--dry-run`: Show what would be installed without making changes
- `--hybrid-shadow`: Keep comparison-oriented MCP mode enabled
- `--uninstall`: Remove previously installed GSS files

## Structure

Installed files are organized under:

### Claude Runtime
- `.claude/commands/gss/` - Claude slash commands
- `.claude/agents/gss-*.md` - Workflow and role agents
- `.claude/gss/` - Runtime support subtree
  - `hooks/` - Hook scripts for session lifecycle
  - `mcp/` - Installed MCP server entrypoint
  - `corpus/` - Packaged OWASP corpus snapshot
  - `runtime-manifest.json` - Runtime metadata

### Codex Runtime
- `.codex/skills/gss-*/` - Codex workflow and role skills
- `.codex/gss/` - Runtime support subtree
  - `mcp/` - Installed MCP server entrypoint
  - `corpus/` - Packaged OWASP corpus snapshot
  - `runtime-manifest.json` - Runtime metadata

### Project Artifacts
- `.gss/install-manifest.json` - Installation record
- `.gss/artifacts/` - Generated workflow artifacts
- `.gss/reports/` - Generated reports and summaries

## Features

### Role-Based Agents

GSS includes six role-based agents that specialize in different security domains:

1. **gss-mapper** - Analyzes codebase structure and dependencies
2. **gss-threat-modeler** - Generates threat models
3. **gss-auditor** - Performs security audits based on OWASP standards
4. **gss-remediator** - Plans minimal safe security fixes
5. **gss-verifier** - Verifies security fixes
6. **gss-reporter** - Generates comprehensive security reports

### MCP-Backed Consultation

Workflows consult the packaged OWASP corpus through the GSS MCP server:
- Consultation planning is doc-based, not specialist-based
- Required workflows emit consultation traces inside their artifacts
- Runtime validation checks artifact envelopes and handoff compatibility
- Fresh installs are healthy without requiring a first workflow run

### Runtime Hooks (Claude)

Claude installations include hooks for:
- **SessionStart**: Environment sanity check
- **PreToolUse**: Warnings on sensitive file operations
- **PostToolUse**: Artifact and handoff validation

## Security Guarantees

### Path Safety
- All file operations validate paths are within allowed directories
- Path traversal attacks are prevented
- Symlink escapes are rejected

### Uninstall Safety
- Only removes files that were created by GSS
- Validates manifest entries before deletion
- Removes managed config blocks without affecting user content

### Non-Destructive
- Existing runtime configs are preserved
- Settings are merged, not replaced
- User files are never overwritten without explicit policy

## Workflows

Available security workflows:

1. `gss-security-review` - Change-scoped security review for current diff or a commit patch (recommended first for security-relevant changes)
2. `gss-map-codebase` - Analyze codebase structure
3. `gss-threat-model` - Identify threats and risks
4. `gss-audit` - Find security vulnerabilities
5. `gss-plan-remediation` - Plan security fixes
6. `gss-execute-remediation` - Apply approved fixes
7. `gss-verify` - Verify the fixes
8. `gss-report` - Generate reports

`security-review` is a lightweight supplement to the full chain and remains explicit.

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Lint
npm run lint
```

## Architecture

See [docs/architecture.md](docs/architecture.md) for detailed design documentation.

See [AGENTS.md](AGENTS.md) for agent behavior guidelines.

## License

MIT
