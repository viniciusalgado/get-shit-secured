/**
 * readiness CLI command — Checks whether the installation meets criteria
 * for advancing within the Release C rollout.
 *
 * Phase 11 — Workstream D: Release communication and decision gates.
 *
 * Usage:
 *   gss readiness          # Check readiness for next release
 *   gss readiness --json   # JSON output
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { RuntimeManifest } from '../core/types.js';

interface GateCheck {
  name: string;
  status: 'pass' | 'fail';
  message: string;
}

interface ReadinessResult {
  gate: string;
  checks: GateCheck[];
  ready: boolean;
  failingCount: number;
}

/**
 * Run the readiness command.
 *
 * @returns Exit code (0 = ready, 1 = not ready)
 */
export async function readiness(
  argv: string[]
): Promise<number> {
  const jsonOutput = argv.includes('--json');

  const cwd = process.cwd();
  // Detect current mode from runtime manifest
  const currentMode = detectCurrentMode(cwd);

  if (!currentMode) {
    console.error('Error: Could not detect current rollout mode. Is GSS installed?');
    return 1;
  }

  // Determine which gate to check
  let result: ReadinessResult;

  if (currentMode === 'hybrid-shadow') {
    result = checkGateAtoB(cwd);
  } else if (currentMode === 'mcp-only') {
    result = checkGateBtoC(cwd);
  } else {
    console.error(`Error: Unsupported rollout mode "${currentMode}"`);
    return 1;
  }

  // Output
  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printReadinessReport(result);
  }

  return result.ready ? 0 : 1;
}

/**
 * Detect current rollout mode from the runtime manifest.
 */
function detectCurrentMode(cwd: string): string | null {
  const candidates = [
    join(cwd, '.claude', 'gss', 'runtime-manifest.json'),
    join(cwd, '.codex', 'gss', 'runtime-manifest.json'),
  ];

  for (const path of candidates) {
    if (existsSync(path)) {
      try {
        const manifest = JSON.parse(readFileSync(path, 'utf-8'));
        if (manifest.rolloutMode) return manifest.rolloutMode;
        return 'mcp-only';
      } catch {
        continue;
      }
    }
  }

  return null;
}

/**
 * Check readiness for Gate A → B (hybrid-shadow → mcp-only).
 */
function checkGateAtoB(cwd: string): ReadinessResult {
  const checks: GateCheck[] = [];
  const gssDir = join(cwd, '.gss');

  // Check 1: Install health (doctor would pass)
  const installManifestPath = join(gssDir, 'install-manifest.json');
  const installHealthy = existsSync(installManifestPath);
  checks.push({
    name: 'Install health',
    status: installHealthy ? 'pass' : 'fail',
    message: installHealthy ? 'Install manifest present' : 'Install manifest missing',
  });

  // Check 2: MCP coverage — look for recent comparison reports
  const comparisonDir = join(gssDir, 'artifacts', 'comparisons');
  let comparisonCount = 0;
  if (existsSync(comparisonDir)) {
    try {
      comparisonCount = readdirSync(comparisonDir).filter(f => f.endsWith('.json')).length;
    } catch {
      comparisonCount = 0;
    }
  }
  const minComparisons = 5;
  checks.push({
    name: 'Comparison data',
    status: comparisonCount >= minComparisons ? 'pass' : 'fail',
    message: `${comparisonCount}/${minComparisons} required comparison reports${comparisonCount < minComparisons ? ` (need ${minComparisons - comparisonCount} more)` : ''}`,
  });

  // Check 3: No critical regressions
  const regressionFlags: string[] = [];
  const artifactsDir = join(gssDir, 'artifacts');
  if (existsSync(artifactsDir)) {
    try {
      const workflowDirs = readdirSync(artifactsDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);
      for (const wfDir of workflowDirs) {
        const flagPath = join(artifactsDir, wfDir, 'regression-flag');
        if (existsSync(flagPath)) {
          regressionFlags.push(wfDir);
        }
      }
    } catch {
      // Ignore scan errors
    }
  }
  checks.push({
    name: 'No regressions',
    status: regressionFlags.length === 0 ? 'pass' : 'fail',
    message: regressionFlags.length === 0 ? '0 regression flags' : `Regression flags in: ${regressionFlags.join(', ')}`,
  });

  // Check 4: MCP server functional
  const mcpHealthy = checkMcpServer(cwd);
  checks.push({
    name: 'MCP coverage',
    status: mcpHealthy ? 'pass' : 'fail',
    message: mcpHealthy ? 'MCP server binary and config present' : 'MCP server not functional',
  });

  const failingCount = checks.filter(c => c.status === 'fail').length;
  return {
    gate: 'Release A → Release B (hybrid-shadow → mcp-only)',
    checks,
    ready: failingCount === 0,
    failingCount,
  };
}

/**
 * Check Release C readiness for steady-state MCP operation.
 */
function checkGateBtoC(cwd: string): ReadinessResult {
  const checks: GateCheck[] = [];

  // Check 1: MCP coverage stable
  const mcpHealthy = checkMcpServer(cwd);
  checks.push({
    name: 'MCP coverage stable',
    status: mcpHealthy ? 'pass' : 'fail',
    message: mcpHealthy ? 'MCP server healthy' : 'MCP server issues detected',
  });

  // Check 2: Support docs exist
  const docsExist = existsSync(join(cwd, 'docs', 'migration-guide.md'))
    && existsSync(join(cwd, 'docs', 'troubleshooting.md'));
  checks.push({
    name: 'Support docs exist',
    status: docsExist ? 'pass' : 'fail',
    message: docsExist ? 'Migration guide and troubleshooting guide present' : 'Missing support documentation',
  });

  // Check 3: Artifact directories exist for a healthy install
  const artifactsReady = existsSync(join(cwd, '.gss', 'artifacts'))
    && existsSync(join(cwd, '.gss', 'reports'));
  checks.push({
    name: 'Artifact directories ready',
    status: artifactsReady ? 'pass' : 'fail',
    message: artifactsReady ? 'Install created .gss/artifacts and .gss/reports' : 'Artifact/report directories missing',
  });

  const failingCount = checks.filter(c => c.status === 'fail').length;
  return {
    gate: 'Release C steady-state (mcp-only)',
    checks,
    ready: failingCount === 0,
    failingCount,
  };
}

/**
 * Check if MCP server binary and config are present.
 */
function checkMcpServer(cwd: string): boolean {
  const candidates = [
    join(cwd, '.claude', 'gss'),
    join(cwd, '.codex', 'gss'),
  ];

  for (const supportDir of candidates) {
    if (!existsSync(supportDir)) continue;

    const serverPath = join(supportDir, 'mcp', 'server.js');
    const manifestPath = join(supportDir, 'runtime-manifest.json');

    if (!existsSync(serverPath)) continue;

    if (existsSync(manifestPath)) {
      try {
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
        if (manifest.mcpConfigPath && existsSync(manifest.mcpConfigPath)) {
          const config = JSON.parse(readFileSync(manifest.mcpConfigPath, 'utf-8'));
          if (config.mcpServers?.['gss-security-docs']) {
            return true;
          }
        }
      } catch {
        continue;
      }
    }
  }

  return false;
}

/**
 * Print human-readable readiness report.
 */
function printReadinessReport(result: ReadinessResult): void {
  console.log('\nGSS Release Readiness Check');
  console.log('===========================\n');

  console.log(`Gate: ${result.gate}\n`);

  for (const check of result.checks) {
    const icon = check.status === 'pass' ? '[OK]  ' : '[FAIL]';
    console.log(`  ${icon}  ${check.name}: ${check.message}`);
  }

  console.log('');
  if (result.ready) {
    console.log('Result: READY');
  } else {
    console.log(`Result: NOT READY (${result.failingCount} check(s) failing)`);
  }
  console.log('');
}
