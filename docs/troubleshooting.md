# GSS Troubleshooting Guide

Common issues and solutions for GSS v2 installations.

## Installation Issues

### MCP server not starting

**Symptoms**: `gss doctor` shows `[FAIL] MCP server binary not found`

**Solutions**:
1. Re-run the installer: `npx get-shit-secured --claude --local`
2. Check if `dist/mcp/server.js` exists in the GSS package
3. Verify the binary path in `runtime-manifest.json` matches actual location
4. Try manual start: `node .claude/gss/mcp/server.js --help`

### Corpus snapshot missing or corrupt

**Symptoms**: `gss doctor` shows `[FAIL] Corpus snapshot not found` or `[WARN] Corpus: Snapshot is corrupt`

**Solutions**:
1. Re-run the installer: `npx get-shit-secured --claude --local`
2. Verify the corpus file at `.claude/gss/corpus/owasp-corpus.json`
3. Check the file is valid JSON: `node -e "JSON.parse(require('fs').readFileSync('.claude/gss/corpus/owasp-corpus.json','utf-8'))"`
4. If the file is missing after install, re-run install and then `gss doctor`

### Settings.json merge conflicts

**Symptoms**: `gss doctor` shows `[FAIL] MCP not registered in Claude config`

**Solutions**:
1. Check `.claude/settings.json` is valid JSON
2. Verify the `mcpServers.gss-security-docs` key exists
3. If the key is missing, re-run the installer
4. If the file has syntax errors, fix them manually and re-run
5. Check file permissions — the installer needs write access

### Retired specialist files still exist after upgrade

**Symptoms**: Old `gss-specialist-*.md` files remain after upgrading to mcp-only

**Solutions**:
1. Run migration: `gss migrate --to mcp-only`
2. Or manually remove: `rm .claude/agents/gss-specialist-*.md`
3. Verify the install manifest tracks the files: check `.gss/install-manifest.json`
4. If files persist outside the manifest, they are not GSS-managed — safe to delete

## Runtime Issues

### Consultation trace missing from artifacts

**Symptoms**: `[GSS WARN] Artifact: ... missing consultation trace`

**Solutions**:
1. Ensure MCP server is running and accessible
2. Check the workflow is using MCP-backed consultation
3. Run `gss doctor` to verify MCP registration
4. The consultation trace is produced by MCP-backed workflows in both supported modes

### Doctor showing degraded state

**Symptoms**: `gss doctor` returns exit code 1 with warnings

**Solutions**:
1. Address each `[FAIL]` and `[WARN]` item individually
2. Common fixes:
   - Missing directories: `mkdir -p .gss/artifacts .gss/reports`
   - Missing corpus: Re-run installer
   - Version mismatch: Re-run installer to sync manifest versions
   - Stale install (30+ days): Re-run installer to refresh

### Session-start hook errors

**Symptoms**: `[GSS ERROR] Hook session-start failed: ...`

**Solutions**:
1. Check `.claude/gss/hooks/session-start.js` exists
2. Verify Node.js is available in PATH
3. Check the runtime manifest at `.claude/gss/runtime-manifest.json` is valid
4. Hook errors are non-blocking — GSS workflows will still function

## Migration Issues

### Migration corrupts manifests

**Symptoms**: `gss migrate` produces corrupt JSON

**Solutions**:
1. Always run with `--dry-run` first to preview changes
2. Back up manifests before migration:
   ```bash
   cp .gss/install-manifest.json .gss/install-manifest.json.bak
   cp .claude/gss/runtime-manifest.json .claude/gss/runtime-manifest.json.bak
   ```
3. If migration fails, restore from backup
4. The migration utility writes to a temp file first, validates, then renames

### Unknown legacy flag at install time

**Symptoms**: Install fails or ignores `--legacy-specialists`

**Solutions**:
1. Remove the retired `--legacy-specialists` flag
2. Use default install for `mcp-only`
3. Use `--hybrid-shadow` only if you want comparison reporting

## How to Re-install Cleanly

If all else fails:

```bash
# 1. Uninstall
npx get-shit-secured --uninstall

# 2. Verify cleanup
ls .claude/agents/gss-*     # Should be empty
ls .claude/commands/gss/    # Should be empty
ls .gss/                    # Should not exist

# 3. Re-install
npx get-shit-secured --claude --local

# 4. Verify
gss doctor
```
