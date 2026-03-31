# get-shit-secured (gss)

Security workflow installer for AI coding runtimes. Installs security-focused agents, skills, and workflows for Claude, Codex, and other AI coding environments.

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

- `--claude`: Install Claude Code agents and commands
- `--codex`: Install Codex skills
- `--all`: Install for all supported runtimes

## Options

- `--dry-run`: Show what would be installed without making changes
- `--uninstall`: Remove previously installed GSS files

## Structure

Installed files are organized under:

### Claude Runtime
- `.claude/commands/gss/` - Claude slash commands
- `.claude/agents/` - Claude security agents
- `.claude/agents/gss-*.md` - Role-based agents (mapper, auditor, etc.)
- `.claude/agents/gss-specialist-*.md` - OWASP specialist agents
- `.claude/gss/` - Runtime support subtree
  - `hooks/` - Hook scripts for session lifecycle
  - `runtime-manifest.json` - Runtime metadata

### Codex Runtime
- `.codex/skills/gss-*/` - Codex workflow skills
- `.codex/skills/gss-*/SKILL.md` - Role-based skills
- `.codex/skills/gss-specialist-*/` - OWASP specialist skills
- `.codex/gss/` - Runtime support subtree
  - `runtime-manifest.json` - Runtime metadata

### Project Artifacts
- `.gss/install-manifest.json` - Installation record
- `.gss/artifacts/` - Generated security artifacts (created during workflow execution)

## Features

### Role-Based Agents

GSS includes six role-based agents that specialize in different security domains:

1. **gss-mapper** - Analyzes codebase structure and dependencies
2. **gss-threat-modeler** - Generates threat models
3. **gss-auditor** - Performs security audits based on OWASP standards
4. **gss-remediator** - Plans minimal safe security fixes
5. **gss-verifier** - Verifies security fixes
6. **gss-reporter** - Generates comprehensive security reports

### OWASP Specialists

Each OWASP Cheat Sheet becomes a specialist agent/skill with:
- Domain-specific security guidance
- Trigger phrases for activation
- Delegation rules to related specialists
- Evidence requirements for findings

### Runtime Hooks (Claude)

Claude installations include hooks for:
- **SessionStart**: Environment sanity check
- **PreToolUse**: Warnings on sensitive file operations
- **PostToolUse**: Artifact validation

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

Available security workflows (run in order):

1. `gss-map-codebase` - Analyze codebase structure
2. `gss-threat-model` - Identify threats and risks
3. `gss-audit` - Find security vulnerabilities
4. `gss-remediate` - Plan security fixes
5. `gss-apply-patches` - Apply approved fixes
6. `gss-verify` - Verify the fixes
7. `gss-report` - Generate reports

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

See [ARCHITECTURE.md](docs/architecture.md) for detailed design documentation.

See [AGENTS.md](AGENTS.md) for agent behavior guidelines.

## License

MIT
