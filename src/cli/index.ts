#!/usr/bin/env node
/**
 * get-shit-secured CLI entry point.
 * Run with: npx get-shit-secured [OPTIONS]
 *
 * Subcommands:
 *   gss doctor           Run health check on existing installation
 *   gss doctor --claude  Check only Claude runtime
 *   gss corpus inspect   Inspect corpus snapshot
 *   gss corpus validate  Validate corpus snapshot
 *   gss corpus refresh   Refresh corpus from OWASP sources
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative } from 'node:path';
import { parseArgs, getHelpText, validateArgs } from './parse-args.js';
import { promptForInstallArgs, shouldPromptForInstall } from './interactive-install.js';
import { install, uninstall } from '../core/installer.js';
import { ClaudeAdapter } from '../runtimes/claude/adapter.js';
import { CodexAdapter } from '../runtimes/codex/adapter.js';
import { corpusInspect, corpusValidate, corpusRefresh } from './corpus-commands.js';
import { doctor } from './doctor.js';
import { compareRuns } from './compare-runs.js';
import { migrateInstall } from './migrate-install.js';
import { readiness } from './readiness.js';
import { diffArtifacts } from './diff-artifacts.js';
import type { RolloutMode } from '../core/types.js';
import { resolveInstallPlan, detectTargets, resolveCorpus, DEFAULT_WORKFLOWS, type CorpusResolution } from '../core/install-stages.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Package version */
const VERSION = '0.1.0';

/**
 * Parse target rollout mode from migrate arguments.
 */
function parseTargetMode(args: string[]): RolloutMode | null {
  const toIdx = args.indexOf('--to');
  if (toIdx === -1 || toIdx + 1 >= args.length) return null;
  const target = args[toIdx + 1];
  if (['hybrid-shadow', 'mcp-only'].includes(target)) {
    return target as RolloutMode;
  }
  return null;
}

/**
 * Main CLI entry point.
 */
async function main(): Promise<number> {
  // Parse CLI arguments (skip node and script path)
  const rawArgv = process.argv.slice(2);
  let args = parseArgs(rawArgv);

  // Handle --version
  if (args.showVersion) {
    console.log(`get-shit-secured v${VERSION}`);
    return 0;
  }

  // Handle --help
  if (args.showHelp) {
    console.log(getHelpText());
    return 0;
  }

  // Get first positional argument for subcommand routing
  const firstArg = process.argv[2];

  // Handle corpus subcommand
  if (firstArg === 'corpus') {
    const subcommand = process.argv[3];
    switch (subcommand) {
      case 'inspect':
        return await corpusInspect();
      case 'validate':
        return await corpusValidate();
      case 'refresh':
        return await corpusRefresh();
      default:
        console.error('Usage: gss corpus <inspect|validate|refresh>');
        return 1;
    }
  }

  // Handle compare-runs subcommand (Phase 11)
  if (firstArg === 'compare-runs') {
    return await compareRuns(process.argv.slice(3));
  }

  // Handle migrate subcommand (Phase 11)
  if (firstArg === 'migrate') {
    const migrateArgs = process.argv.slice(3);
    const targetMode = parseTargetMode(migrateArgs);
    const dryRun = migrateArgs.includes('--dry-run');
    if (!targetMode) {
      console.error('Usage: gss migrate --to <hybrid-shadow|mcp-only> [--dry-run]');
      return 1;
    }
    const result = await migrateInstall(process.cwd(), { targetMode, dryRun });
    for (const change of result.changes) {
      console.log(`  ${change}`);
    }
    for (const error of result.errors) {
      console.error(`  Error: ${error}`);
    }
    console.log(result.migrated ? '\nMigration complete.' : '\nNo migration performed.');
    return result.errors.length > 0 ? 1 : 0;
  }

  // Handle readiness subcommand (Phase 11)
  if (firstArg === 'readiness') {
    return await readiness(process.argv.slice(3));
  }

  // Handle diff-artifacts subcommand (Phase 12)
  if (firstArg === 'diff-artifacts') {
    return await diffArtifacts(process.argv.slice(3));
  }

  // Handle doctor subcommand
  if (firstArg === 'doctor') {
    // Parse runtime filter from subsequent args
    const doctorRuntimes: Array<'claude' | 'codex'> = [];
    const restArgs = process.argv.slice(3);
    for (const arg of restArgs) {
      if (arg === '--claude' || arg === '-c') doctorRuntimes.push('claude');
      if (arg === '--codex' || arg === '-x') doctorRuntimes.push('codex');
    }
    return await doctor(process.cwd(), {
      runtimes: doctorRuntimes.length > 0 ? doctorRuntimes : undefined,
    });
  }

  // Handle --verify-only flag (runs doctor without installing)
  if (args.verifyOnly) {
    return await doctor(process.cwd(), {
      runtimes: args.runtimes.length > 0 ? args.runtimes as Array<'claude' | 'codex'> : undefined,
    });
  }

  if (shouldPromptForInstall(args, rawArgv, Boolean(process.stdin.isTTY && process.stdout.isTTY))) {
    args = await promptForInstallArgs(args);
  }

  // Validate arguments
  const errors = validateArgs(args);
  if (errors.length > 0) {
    console.error('Error:');
    for (const error of errors) {
      console.error(`  ${error}`);
    }
    console.error('\nRun --help for usage information.');
    return 1;
  }

  // Get current working directory
  const cwd = process.cwd();

  // Handle uninstall
  if (args.uninstall) {
    console.log('Uninstalling get-shit-secured...');
    const result = await uninstall(cwd, args.dryRun);

    if (args.dryRun) {
      console.log('\n[Dry run] Would remove:');
      for (const [runtime, files] of Object.entries(result.manifest?.files ?? {})) {
        console.log(`\n${runtime}:`);
        for (const file of files ?? []) {
          console.log(`  - ${file}`);
        }
      }
      console.log(`\nTotal: ${result.filesCreated} files`);
    } else {
      console.log(`Removed ${result.filesCreated} files.`);
    }

    if (result.errors.length > 0) {
      console.error('\nErrors:');
      for (const error of result.errors) {
        console.error(`  ${error}`);
      }
      return 1;
    }

    return 0;
  }

  // Build runtime adapters
  const adapters: RuntimeAdapter[] = [];

  if (args.runtimes.includes('claude')) {
    adapters.push(new ClaudeAdapter());
  }

  if (args.runtimes.includes('codex')) {
    adapters.push(new CodexAdapter());
  }

  // Show what we're doing
  const scopeText = args.scope === 'local' ? 'local project' : 'global user';
  const runtimeText = args.runtimes.join(', ');
  console.log(`Installing get-shit-secured for: ${runtimeText}`);
  console.log(`Scope: ${scopeText}`);
  console.log(`Target: ${cwd}\n`);

  if (args.dryRun) {
    console.log('[Dry run mode - no files will be written]\n');

    // Enriched dry-run: resolve and display the install plan
    try {
      const targets = detectTargets(adapters, args.scope, cwd);
      const pkgRoot = resolve(__dirname, '..', '..');
      let corpus: CorpusResolution | null = null;
      try {
        corpus = await resolveCorpus(targets, pkgRoot);
      } catch {
        // Corpus may not be available in dev — that's OK for dry-run
      }

      const plan = resolveInstallPlan(targets, adapters, corpus, {
        dryRun: true,
        pkgRoot,
      });

      printEnrichedDryRun(plan, cwd);
    } catch (error) {
      // Fall back to simple dry-run output if plan resolution fails
      console.log(`[Dry run] Plan resolution error: ${error instanceof Error ? error.message : String(error)}\n`);
    }
  }

  // Run installation
  const result = await install(adapters, args.scope, cwd, args.dryRun, {
    hybridShadow: args.hybridShadow ?? false,
  });

  if (args.dryRun) {
    console.log('[Dry run] Would create the following files:\n');

    if (result.manifest) {
      for (const [runtime, files] of Object.entries(result.manifest.files)) {
        console.log(`${runtime}:`);
        for (const file of files ?? []) {
          const relPath = file.replace(cwd + '/', '');
          console.log(`  - ${relPath}`);
        }
        console.log('');
      }

      console.log(`Total: ${result.filesCreated} files`);
      console.log('\nManifest would be written to: .gss/install-manifest.json');
    }
  } else {
    console.log(`✓ Created ${result.filesCreated} files`);
    console.log(`✓ Manifest written to: .gss/install-manifest.json`);
    console.log('\nInstallation complete!');
    console.log('\nNext steps:');
    console.log('  - Use /gss-help in Claude to see available commands');
    console.log('  - Run "gss doctor" to verify installation health');
    console.log('  - Run "gss --help" for CLI options');
  }

  // Report any errors
  if (result.errors.length > 0) {
    console.error('\nErrors encountered:');
    for (const error of result.errors) {
      console.error(`  ${error}`);
    }
    return 1;
  }

  return 0;
}

/**
 * Print enriched dry-run output using the install plan.
 * Shows corpus version, MCP config entries, cleanup actions, and file type labels.
 */
function printEnrichedDryRun(
  plan: import('../core/types.js').InstallPlan,
  cwd: string
): void {
  // Corpus info
  if (plan.corpus) {
    console.log(`Corpus:   v${plan.corpus.version} (${plan.corpus.destinations.length} destination(s))`);
    console.log(`Source:   ${relative(cwd, plan.corpus.sourcePath)}`);
  }

  // Files per runtime
  for (const op of plan.fileOps) {
    const allFiles = [
      ...op.entrypointFiles.map(f => ({ path: f, type: 'entrypoint' })),
      ...op.supportFiles.map(f => ({ path: f, type: 'support' })),
      ...op.hooks.map(f => ({ path: f, type: 'hook' })),
    ];

    console.log(`\nFiles to create (${op.runtime}):`);
    for (const file of allFiles) {
      const relPath = relative(cwd, file.path);
      console.log(`  ${relPath.padEnd(50)} [${file.type}]`);
    }
    console.log(`  Total: ${allFiles.length} files`);
  }

  // Config patches
  for (const op of plan.configOps) {
    if (op.mcpServerCopy) {
      console.log(`\nMCP server (${op.runtime}):`);
      console.log(`  Copy: ${relative(cwd, op.mcpServerCopy.src)} -> ${relative(cwd, op.mcpServerCopy.dest)}`);
    }
    if (op.mcpConfigPatch) {
      console.log(`Config patches (${op.runtime}):`);
      console.log(`  ${op.mcpConfigPatch.path} (${op.mcpConfigPatch.keyPath ?? op.mcpConfigPatch.owner})`);
    }
  }

  // Legacy cleanup
  if (plan.cleanupOps.length > 0) {
    console.log('\nLegacy cleanup:');
    for (const op of plan.cleanupOps) {
      console.log(`  ${op.runtime}: ${op.description}`);
      for (const file of op.files.slice(0, 5)) {
        console.log(`    - ${relative(cwd, file)}`);
      }
      if (op.files.length > 5) {
        console.log(`    ... and ${op.files.length - 5} more`);
      }
    }
  } else {
    console.log('\nLegacy cleanup: none');
  }

  console.log(`\nManifest: .gss/install-manifest.json\n`);
}

// Type helper for adapter instantiation
type RuntimeAdapter = InstanceType<typeof ClaudeAdapter | typeof CodexAdapter>;

// Run and handle errors
main()
  .then((code) => {
    process.exit(code);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
