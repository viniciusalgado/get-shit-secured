#!/usr/bin/env node
/**
 * get-shit-secured CLI entry point.
 * Run with: npx get-shit-secured [OPTIONS]
 */

import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { parseArgs, getHelpText, validateArgs } from './parse-args.js';
import { install, uninstall } from '../core/installer.js';
import { ClaudeAdapter } from '../runtimes/claude/adapter.js';
import { CodexAdapter } from '../runtimes/codex/adapter.js';
import { corpusInspect, corpusValidate, corpusRefresh } from './corpus-commands.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Package version */
const VERSION = '0.1.0';

/**
 * Main CLI entry point.
 */
async function main(): Promise<number> {
  // Parse CLI arguments (skip node and script path)
  const args = parseArgs(process.argv.slice(2));

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

  // Handle corpus subcommand
  const firstArg = process.argv[2];
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
  const adapters: ReturnType<typeof instantiateAdapter>[] = [];

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
  }

  // Run installation
  const result = await install(adapters, args.scope, cwd, args.dryRun, {
    legacySpecialists: args.legacySpecialists ?? false,
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

// Type helper for adapter instantiation
type AdapterInstance = InstanceType<typeof ClaudeAdapter | typeof CodexAdapter>;

function instantiateAdapter(adapter: AdapterInstance): AdapterInstance {
  return adapter;
}

// Run and handle errors
main()
  .then((code) => {
    process.exit(code);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
