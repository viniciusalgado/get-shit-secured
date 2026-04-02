/**
 * compare-runs CLI command — Compare two consultation traces and produce
 * a structured comparison report.
 *
 * Phase 11 — Workstream B: Dual-run comparison strategy.
 *
 * Usage:
 *   gss compare-runs --mcp <trace.json> --legacy <trace.json>
 *   gss compare-runs --mcp <dir> --legacy <dir> --output comparison.json
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { ConsultationTrace, ConsultationComparison } from '../core/types.js';
import { compareConsultationTraces } from '../core/consultation-comparator.js';

interface CompareRunsOptions {
  mcpPath: string;
  legacyPath: string;
  outputPath?: string;
  json?: boolean;
}

/**
 * Run the compare-runs command.
 *
 * @returns Exit code (0 = success, 1 = error)
 */
export async function compareRuns(
  argv: string[]
): Promise<number> {
  const options = parseCompareArgs(argv);

  if (!options.mcpPath || !options.legacyPath) {
    console.error('Usage: gss compare-runs --mcp <trace-or-dir> --legacy <trace-or-dir> [--output <file>] [--json]');
    return 1;
  }

  // Resolve traces
  const mcpTrace = resolveTrace(options.mcpPath, 'mcp');
  const legacyTrace = resolveTrace(options.legacyPath, 'legacy');

  if (!mcpTrace) {
    console.error(`Error: Could not load MCP consultation trace from ${options.mcpPath}`);
    return 1;
  }
  if (!legacyTrace) {
    console.error(`Error: Could not load legacy consultation trace from ${options.legacyPath}`);
    return 1;
  }

  // Compare
  const comparison = compareConsultationTraces(mcpTrace, legacyTrace);

  // Output
  if (options.outputPath) {
    writeFileSync(options.outputPath, JSON.stringify(comparison, null, 2), 'utf-8');
    console.log(`Comparison written to ${options.outputPath}`);
  }

  printComparisonReport(comparison);

  return 0;
}

/**
 * Parse compare-runs specific arguments.
 */
function parseCompareArgs(argv: string[]): CompareRunsOptions {
  const options: CompareRunsOptions = { mcpPath: '', legacyPath: '' };

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--mcp':
        options.mcpPath = argv[++i] || '';
        break;
      case '--legacy':
        options.legacyPath = argv[++i] || '';
        break;
      case '--output':
        options.outputPath = argv[++i];
        break;
      case '--json':
        options.json = true;
        break;
    }
  }

  return options;
}

/**
 * Resolve a consultation trace from a file path or directory.
 * If a directory is given, finds the latest trace file in it.
 */
function resolveTrace(pathOrDir: string, label: string): ConsultationTrace | null {
  const resolved = resolve(pathOrDir);

  if (!existsSync(resolved)) {
    console.error(`[${label}] Path not found: ${resolved}`);
    return null;
  }

  // If it's a file, parse it directly
  try {
    const stat = statSync(resolved);
    if (stat.isFile()) {
      return loadTraceFile(resolved);
    }
  } catch {
    return null;
  }

  // If it's a directory, find the latest trace file
  try {
    const entries = readdirSync(resolved)
      .filter(f => f.endsWith('.json') && f.includes('consultation'))
      .sort()
      .reverse();

    if (entries.length === 0) {
      // Try looking for any JSON with a consultation trace
      const allJson = readdirSync(resolved)
        .filter(f => f.endsWith('.json'))
        .sort()
        .reverse();

      for (const file of allJson) {
        const trace = loadTraceFile(join(resolved, file));
        if (trace && trace.plan) return trace;
      }

      console.error(`[${label}] No consultation trace files found in ${resolved}`);
      return null;
    }

    return loadTraceFile(join(resolved, entries[0]));
  } catch (error) {
    console.error(`[${label}] Error reading directory ${resolved}: ${error}`);
    return null;
  }
}

/**
 * Load and parse a consultation trace from a JSON file.
 */
function loadTraceFile(filePath: string): ConsultationTrace | null {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(content);

    // Validate minimum structure
    if (!parsed.plan || !parsed.consultedDocs) {
      return null;
    }

    return parsed as ConsultationTrace;
  } catch {
    return null;
  }
}

/**
 * Print a human-readable comparison report.
 */
function printComparisonReport(comparison: ConsultationComparison): void {
  console.log('\nGSS Consultation Comparison Report');
  console.log('===================================\n');

  console.log(`Workflow:    ${comparison.workflowId}`);
  console.log(`Compared at: ${comparison.comparedAt}\n`);

  console.log(`MCP docs consulted:    ${comparison.mcpDocs.length}`);
  console.log(`Legacy docs consulted: ${comparison.legacyDocs.length}`);
  console.log(`Common:                ${comparison.common.length}`);
  console.log(`MCP only:              ${comparison.mcpOnly.length}`);
  console.log(`Legacy only:           ${comparison.legacyOnly.length}\n`);

  console.log(`MCP required coverage:    ${(comparison.mcpRequiredCoverage * 100).toFixed(1)}%`);
  console.log(`Legacy required coverage: ${(comparison.legacyRequiredCoverage * 100).toFixed(1)}%`);
  console.log(`Coverage delta:           ${(comparison.coverageDelta * 100).toFixed(1)}%\n`);

  const icon = comparison.assessment === 'mcp-superior' ? '[OK]  '
    : comparison.assessment === 'mcp-inferior' ? '[WARN]'
    : '[OK]  ';
  console.log(`${icon} Assessment: ${comparison.assessment}`);

  if (comparison.mcpOnly.length > 0) {
    console.log('\nDocuments in MCP but not legacy:');
    for (const id of comparison.mcpOnly) {
      console.log(`  + ${id}`);
    }
  }

  if (comparison.legacyOnly.length > 0) {
    console.log('\nDocuments in legacy but not MCP:');
    for (const id of comparison.legacyOnly) {
      console.log(`  - ${id}`);
    }
  }
}
