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
```

## Installation Scope

- `--local`: Install to current project directory (default)
- `--global`: Install to user home directory

## Runtime Targets

- `--claude`: Install Claude Code agents and commands
- `--codex`: Install Codex skills (future)

## Options

- `--all`: Install for all supported runtimes
- `--dry-run`: Show what would be installed without making changes
- `--uninstall`: Remove previously installed gss files (future)

## Structure

Installed files are organized under:
- `.claude/commands/gss/` - Claude slash commands
- `.claude/agents/` - Claude security agents
- `.codex/skills/gss-*/` - Codex skills
- `.gss/install-manifest.json` - Installation record

## License

MIT
