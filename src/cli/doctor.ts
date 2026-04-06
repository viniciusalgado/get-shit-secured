/**
 * Doctor command — Runs comprehensive health checks on an existing GSS installation.
 *
 * Phase 9 — Workstream E: Doctor/verify mode.
 *
 * Usage:
 *   gss doctor           # Full health check
 *   gss doctor --claude  # Check only Claude runtime
 *   gss doctor --codex   # Check only Codex runtime
 *
 * Exit codes:
 *   0 — All checks passed
 *   1 — Issues detected
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import type {
  RuntimeTarget,
  InstallManifest,
  InstallManifestV2,
  RuntimeManifest,
} from '../core/types.js';
import { readManifest } from '../core/manifest.js';
import { resolveRuntimeRoot, resolveSupportSubtree } from '../core/paths.js';

/**
 * Health check result for a single runtime.
 */
interface RuntimeHealthCheck {
  runtime: RuntimeTarget;
  scope: string;
  checks: Array<{
    name: string;
    status: 'ok' | 'fail' | 'warn';
    message: string;
    fixHint?: string;
  }>;
}

/**
 * Run GSS health check (doctor mode).
 * Reads the install manifest, reconstructs runtime state, and runs
 * full verification checks.
 *
 * @param cwd - Current working directory
 * @param options - Optional runtime filter
 * @returns Exit code (0 = healthy, 1 = issues)
 */
export async function doctor(
  cwd: string,
  options: { runtimes?: RuntimeTarget[] }
): Promise<number> {
  console.log('GSS Health Check');
  console.log('================\n');

  // Read install manifest
  const manifest = await readManifest(cwd);
  if (!manifest) {
    console.error('GSS is not installed in this project.');
    console.error('Run: npx get-shit-secured --claude --local');
    return 1;
  }

  // Determine scope
  const scope = 'scope' in manifest ? (manifest as InstallManifestV2).scope : 'local';
  console.log(`Scope:    ${scope}`);

  // For v1 manifests, we can only do basic checks
  const isV2 = 'manifestVersion' in manifest && (manifest as InstallManifestV2).manifestVersion === 2;
  if (!isV2) {
    console.error('Legacy v1 manifest detected. Consider reinstalling with the latest version.');
    const v1Manifest = manifest as InstallManifest;
    const targetRuntimes = options?.runtimes?.length
      ? options.runtimes
      : v1Manifest.runtimes;

    // Basic check for v1 - just verify files exist
    let filesOk = true;
    for (const [runtime, files] of Object.entries(v1Manifest.files)) {
      for (const file of files ?? []) {
        if (!existsSync(resolve(cwd, file))) {
          console.error(`  [FAIL] Missing file: ${file}`);
          filesOk = false;
        }
      }
    }
    return filesOk ? 0 : 1;
  }

  const v2Manifest = manifest as InstallManifestV2;

  // Determine which runtimes to check
  const targetRuntimes = options?.runtimes?.length
    ? options.runtimes
    : v2Manifest.runtimes;
  console.log(`Runtimes: ${targetRuntimes.join(', ')}\n`);

  let allHealthy = true;

  for (const runtime of targetRuntimes) {
    console.log(`--- ${runtime} ---`);

    const result = checkRuntime(runtime, scope, cwd, v2Manifest);
    printRuntimeResults(result);

    if (result.checks.some(c => c.status === 'fail')) {
      allHealthy = false;
    }

    console.log('');
  }

  // Summary
  const totalChecks = targetRuntimes.length;
  if (allHealthy) {
    console.log(`Summary: ${totalChecks} runtime(s) checked, all healthy`);
  } else {
    console.log(`Summary: ${totalChecks} runtime(s) checked, issues detected`);
  }

  console.log(`\nResult: ${allHealthy ? 'HEALTHY' : 'DEGRADED'}`);
  return allHealthy ? 0 : 1;
}

/**
 * Run health checks for a single runtime.
 */
function checkRuntime(
  runtime: RuntimeTarget,
  scope: string,
  cwd: string,
  installManifest: InstallManifestV2
): RuntimeHealthCheck {
  const checks: RuntimeHealthCheck['checks'] = [];

  const rootPath = resolveRuntimeRoot(runtime, scope as 'local' | 'global', cwd);
  const supportSubtree = resolveSupportSubtree(runtime, scope as 'local' | 'global', cwd);

  // Extract info from manifest
  const v2Manifest = installManifest as InstallManifestV2;
  const corpusVersion = v2Manifest.corpusVersion ?? 'unknown';
  const packageVersion = v2Manifest.packageVersion ?? 'unknown';

  console.log(`Version:  ${packageVersion} | Corpus: ${corpusVersion}`);
  console.log('');

  // Check 1: Corpus snapshot
  const corpusPath = join(supportSubtree, 'corpus', 'owasp-corpus.json');
  if (existsSync(corpusPath)) {
    try {
      const content = readFileSync(corpusPath, 'utf-8');
      const parsed = JSON.parse(content);
      const docCount = Array.isArray(parsed.documents) ? parsed.documents.length : '?';
      checks.push({
        name: 'Corpus snapshot',
        status: 'ok',
        message: `${relative(cwd, corpusPath)} (${docCount} docs)`,
      });
    } catch {
      checks.push({
        name: 'Corpus snapshot',
        status: 'warn',
        message: `File exists but is not valid JSON: ${relative(cwd, corpusPath)}`,
        fixHint: 'Re-run: npx get-shit-secured --claude --local',
      });
    }
  } else {
    checks.push({
      name: 'Corpus snapshot',
      status: 'fail',
      message: `not found at ${relative(cwd, corpusPath)}`,
      fixHint: 'Re-run: npx get-shit-secured --claude --local',
    });
  }

  // Check 2: MCP server binary
  const mcpServerPath = join(supportSubtree, 'mcp', 'server.js');
  if (existsSync(mcpServerPath)) {
    checks.push({
      name: 'MCP server binary',
      status: 'ok',
      message: relative(cwd, mcpServerPath),
    });
  } else {
    checks.push({
      name: 'MCP server binary',
      status: 'fail',
      message: `not found at ${relative(cwd, mcpServerPath)}`,
      fixHint: 'Re-run: npx get-shit-secured --claude --local',
    });
  }

  // Check 3: MCP config registration
  const settingsPath = join(rootPath, 'settings.json');
  if (existsSync(settingsPath)) {
    try {
      const content = readFileSync(settingsPath, 'utf-8');
      const config = JSON.parse(content);
      const mcpServers = config?.mcpServers as Record<string, unknown> | undefined;
      if (mcpServers && 'gss-security-docs' in mcpServers) {
        checks.push({
          name: 'MCP config registered',
          status: 'ok',
          message: relative(cwd, settingsPath),
        });
      } else {
        checks.push({
          name: 'MCP config registered',
          status: 'fail',
          message: `gss-security-docs not found in ${relative(cwd, settingsPath)}`,
          fixHint: 'Re-run: npx get-shit-secured --claude --local',
        });
      }
    } catch {
      checks.push({
        name: 'MCP config registered',
        status: 'warn',
        message: `Cannot parse ${relative(cwd, settingsPath)}`,
        fixHint: 'Check settings.json syntax',
      });
    }
  } else {
    checks.push({
      name: 'MCP config registered',
      status: 'fail',
      message: `settings.json not found at ${relative(cwd, settingsPath)}`,
      fixHint: 'Re-run: npx get-shit-secured --claude --local',
    });
  }

  // Check 4: Hooks
  const hooksDir = join(supportSubtree, 'hooks');
  const expectedHooks = runtime === 'claude'
    ? ['session-start', 'pre-tool-write', 'pre-tool-edit', 'post-tool-write']
    : [];
  if (expectedHooks.length === 0) {
    checks.push({
      name: 'Hooks',
      status: 'ok',
      message: 'not used by this runtime',
    });
  } else if (existsSync(hooksDir)) {
    try {
      const hookFiles = readdirSync(hooksDir).filter(f => f.endsWith('.js'));
      const foundHookIds = hookFiles.map(f => f.replace(/\.js$/, ''));
      const missingHooks = expectedHooks.filter(h => !foundHookIds.includes(h));

      if (missingHooks.length === 0) {
        checks.push({
          name: 'Hooks',
          status: 'ok',
          message: `${foundHookIds.length}/${expectedHooks.length} present`,
        });
      } else {
        checks.push({
          name: 'Hooks',
          status: 'fail',
          message: `missing: ${missingHooks.join(', ')} (${foundHookIds.length}/${expectedHooks.length} present)`,
          fixHint: 'Re-run: npx get-shit-secured --claude --local',
        });
      }
    } catch {
      checks.push({
        name: 'Hooks',
        status: 'warn',
        message: `Cannot read hooks directory at ${relative(cwd, hooksDir)}`,
        fixHint: 'Check directory permissions',
      });
    }
  } else {
    checks.push({
      name: 'Hooks',
      status: 'fail',
      message: `hooks directory not found at ${relative(cwd, hooksDir)}`,
      fixHint: 'Re-run: npx get-shit-secured --claude --local',
    });
  }

  // Check 5: Artifact directories
  const artifactsDir = join(cwd, '.gss', 'artifacts');
  const reportsDir = join(cwd, '.gss', 'reports');
  const artifactsOk = existsSync(artifactsDir);
  const reportsOk = existsSync(reportsDir);

  if (artifactsOk && reportsOk) {
    checks.push({
      name: 'Artifact directories',
      status: 'ok',
      message: `${relative(cwd, artifactsDir)}, ${relative(cwd, reportsDir)}`,
    });
  } else {
    const missing = [];
    if (!artifactsOk) missing.push(relative(cwd, artifactsDir));
    if (!reportsOk) missing.push(relative(cwd, reportsDir));
    checks.push({
      name: 'Artifact directories',
      status: 'warn',
      message: `missing: ${missing.join(', ')}`,
      fixHint: 'These will be created on first workflow run',
    });
  }

  // Check 6: Manifest consistency
  const runtimeManifestPath = join(supportSubtree, 'runtime-manifest.json');
  let runtimeManifest: RuntimeManifest | null = null;
  if (existsSync(runtimeManifestPath) && corpusVersion !== 'unknown') {
    try {
      const content = readFileSync(runtimeManifestPath, 'utf-8');
      runtimeManifest = JSON.parse(content) as RuntimeManifest;
      if (runtimeManifest.corpusVersion === corpusVersion) {
        checks.push({
          name: 'Manifest consistency',
          status: 'ok',
          message: 'corpus versions match',
        });
      } else {
        checks.push({
          name: 'Manifest consistency',
          status: 'warn',
          message: `corpus version mismatch: install=${corpusVersion}, runtime=${runtimeManifest.corpusVersion}`,
          fixHint: 'Re-run: npx get-shit-secured --claude --local',
        });
      }
    } catch {
      checks.push({
        name: 'Manifest consistency',
        status: 'warn',
        message: 'cannot read runtime manifest',
        fixHint: `Check ${relative(cwd, runtimeManifestPath)}`,
      });
    }
  } else if (existsSync(runtimeManifestPath)) {
    try {
      const content = readFileSync(runtimeManifestPath, 'utf-8');
      runtimeManifest = JSON.parse(content) as RuntimeManifest;
      checks.push({
        name: 'Manifest consistency',
        status: 'ok',
        message: 'runtime manifest present',
      });
    } catch {
      checks.push({
        name: 'Manifest consistency',
        status: 'warn',
        message: 'cannot read runtime manifest',
        fixHint: `Check ${relative(cwd, runtimeManifestPath)}`,
      });
    }
  } else {
    checks.push({
      name: 'Manifest consistency',
      status: 'warn',
      message: `runtime manifest not found at ${relative(cwd, runtimeManifestPath)}`,
      fixHint: 'Re-run: npx get-shit-secured --claude --local',
    });
  }

  // Check 7: Phase 10 diagnostic metadata (updated for Phase 11 rollout mode)
  if (runtimeManifest) {
    const workflowCount = (runtimeManifest as RuntimeManifest & { installedWorkflows?: string[] }).installedWorkflows?.length;
    const roleCount = (runtimeManifest as RuntimeManifest & { installedRoles?: string[] }).installedRoles?.length;
    const mcpServerName = (runtimeManifest as RuntimeManifest & { mcpServerName?: string }).mcpServerName;
    const rolloutMode = (runtimeManifest as RuntimeManifest & { rolloutMode?: string }).rolloutMode;
    const effectiveRolloutMode = rolloutMode || 'mcp-only';

    const parts: string[] = [];
    if (workflowCount !== undefined) {
      parts.push(`${workflowCount} workflows`);
    }
    if (roleCount !== undefined) {
      parts.push(`${roleCount} roles`);
    }
    if (mcpServerName) {
      parts.push(`MCP: ${mcpServerName}`);
    }
    // Phase 11: display rollout mode with release label
    const releaseLabel = effectiveRolloutMode === 'hybrid-shadow' ? 'Release C (comparison)' : 'Release C';
    parts.push(`mode: ${effectiveRolloutMode} (${releaseLabel})`);

    checks.push({
      name: 'Diagnostic metadata',
      status: parts.length >= 3 ? 'ok' : 'warn',
      message: parts.length > 0 ? parts.join(', ') : 'no Phase 10 metadata found',
      fixHint: parts.length < 3 ? 'Re-run: npx get-shit-secured --claude --local to update manifest' : undefined,
    });
  }

  return { runtime, scope, checks };
}

/**
 * Print health check results for a single runtime in human-readable format.
 */
function printRuntimeResults(result: RuntimeHealthCheck): void {
  for (const check of result.checks) {
    const icon = check.status === 'ok' ? '[OK]  ' : check.status === 'fail' ? '[FAIL]' : '[WARN]';
    console.log(`  ${icon}  ${check.name}: ${check.message}`);
    if (check.fixHint && check.status !== 'ok') {
      console.log(`         Fix: ${check.fixHint}`);
    }
  }
}
