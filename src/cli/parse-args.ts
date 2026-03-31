import type { CliArgs, InstallScope, RuntimeTarget } from '../core/types.js';

/**
 * Parse command-line arguments for gss CLI.
 *
 * Supported flags:
 * --claude, -c     Install for Claude runtime
 * --codex, -x      Install for Codex runtime
 * --all, -a        Install for all supported runtimes
 * --local, -l      Install to project directory (default)
 * --global, -g     Install to user home directory
 * --dry-run, -d    Show what would be done without writing files
 * --uninstall, -u  Uninstall mode (future, reserved)
 * --help, -h       Show help text
 * --version, -v    Show version
 */
export function parseArgs(argv: string[]): CliArgs & { showHelp: boolean; showVersion: boolean } {
  const result: CliArgs & { showHelp: boolean; showVersion: boolean } = {
    runtimes: [],
    scope: 'local',
    dryRun: false,
    uninstall: false,
    all: false,
    showHelp: false,
    showVersion: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    switch (arg) {
      case '--claude':
      case '-c':
        result.runtimes.push('claude');
        break;
      case '--codex':
      case '-x':
        result.runtimes.push('codex');
        break;
      case '--all':
      case '-a':
        result.all = true;
        break;
      case '--local':
      case '-l':
        result.scope = 'local';
        break;
      case '--global':
      case '-g':
        result.scope = 'global';
        break;
      case '--dry-run':
      case '-d':
        result.dryRun = true;
        break;
      case '--uninstall':
      case '-u':
        result.uninstall = true;
        break;
      case '--help':
      case '-h':
        result.showHelp = true;
        break;
      case '--version':
      case '-v':
        result.showVersion = true;
        break;
      default:
        // Ignore unknown args for now
        break;
    }
  }

  // Remove duplicates from runtimes array
  result.runtimes = [...new Set(result.runtimes)];

  // If --all is set, fill in all supported runtimes
  if (result.all && result.runtimes.length === 0) {
    result.runtimes = ['claude', 'codex'];
  }

  return result;
}

/**
 * Generate help text for the CLI.
 */
export function getHelpText(): string {
  return `get-shit-secured (gss) - Security workflow installer for AI coding runtimes

USAGE:
  npx get-shit-secured [OPTIONS]

OPTIONS:
  --claude, -c      Install for Claude runtime
  --codex, -x       Install for Codex runtime
  --all, -a         Install for all supported runtimes
  --local, -l       Install to project directory (default)
  --global, -g      Install to user home directory
  --dry-run, -d     Show what would be done without writing files
  --uninstall, -u   Uninstall previously installed GSS files
  --help, -h        Show this help message
  --version, -v     Show version

EXAMPLES:
  npx get-shit-secured --claude --local
  npx get-shit-secured --codex --global
  npx get-shit-secured --claude --codex --local
  npx get-shit-secured --all --dry-run
  npx get-shit-secured --uninstall

SCOPE:
  Local installs place files in the current project's runtime directory.
  Global installs place files in the user's home runtime directory.

  Claude (local):   ./.claude/
  Claude (global):  ~/.claude/
  Codex (local):    ./.codex/
  Codex (global):   ~/.codex/

UNINSTALL:
  Remove all GSS-installed files. Run from the project directory where GSS was installed.
  Runtime is inferred from the install manifest if not specified.

See https://github.com/viniciusalgado/get-shit-secured for more information.`;
}

/**
 * Validate parsed arguments.
 * Returns errors if invalid; empty array if valid.
 */
export function validateArgs(args: CliArgs): string[] {
  const errors: string[] = [];

  // Must specify at least one runtime unless showing help/version or uninstalling
  if (args.runtimes.length === 0 && !args.showHelp && !args.showVersion && !args.uninstall) {
    errors.push('No runtime specified. Use --claude, --codex, or --all.');
  }

  // Cannot mix local and global scope
  // (This is handled by the parser taking the last flag, but we can warn)
  if (args.scope !== 'local' && args.scope !== 'global') {
    errors.push('Invalid scope. Must be --local or --global.');
  }

  // For uninstall, we'll infer runtime from manifest if not specified
  // This allows `gss --uninstall` to work without specifying --claude/--codex

  return errors;
}
