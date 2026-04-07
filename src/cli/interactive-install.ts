import { stdin as input, stdout as output } from 'node:process';
import { createInterface } from 'node:readline/promises';
import type { CliArgs, InstallScope, RuntimeTarget } from '../core/types.js';

export type ParsedCliArgs = CliArgs & { showHelp: boolean; showVersion: boolean };

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  gray: '\x1b[90m',
  clear: '\x1b[2J\x1b[H',
};

const GSS_BANNER = [
  '  ██████╗ ███████╗███████╗',
  ' ██╔════╝ ██╔════╝██╔════╝',
  ' ██║  ███╗███████╗███████╗',
  ' ██║   ██║╚════██║╚════██║',
  ' ╚██████╔╝███████║███████║',
  '  ╚═════╝ ╚══════╝╚══════╝',
];

const INSTALL_FLAGS = new Set([
  '--claude',
  '-c',
  '--codex',
  '-x',
  '--all',
  '-a',
  '--local',
  '-l',
  '--global',
  '-g',
  '--dry-run',
  '-d',
  '--hybrid-shadow',
  '--interactive',
]);

export function shouldPromptForInstall(args: ParsedCliArgs, argv: string[], isInteractive: boolean): boolean {
  if (!isInteractive) return false;
  if (args.showHelp || args.showVersion || args.uninstall || args.verifyOnly) return false;
  if (args.interactive) return true;
  return !argv.some(arg => INSTALL_FLAGS.has(arg));
}

export interface InteractivePromptIo {
  isTTY: boolean;
  write(text: string): void;
  ask(question: string): Promise<string>;
  clear(): void;
  close(): void;
}

function createPromptIo(): InteractivePromptIo {
  const rl = createInterface({ input, output });
  return {
    isTTY: Boolean(input.isTTY && output.isTTY),
    write(text: string) {
      output.write(text);
    },
    ask(question: string) {
      return rl.question(question);
    },
    clear() {
      output.write(ANSI.clear);
    },
    close() {
      rl.close();
    },
  };
}

export async function promptForInstallArgs(baseArgs: ParsedCliArgs, io: InteractivePromptIo = createPromptIo()): Promise<ParsedCliArgs> {
  if (!io.isTTY) {
    return baseArgs;
  }

  try {
    const totalSteps = 4;
    const runtimes = await promptRuntimeSelection(io, 1, totalSteps);
    const scope = await promptScopeSelection(io, 2, totalSteps);
    const hybridShadow = await promptBinarySelection(
      io,
      3,
      totalSteps,
      'Install mode',
      'Choose how GSS should install its runtime integration.',
      [
        { label: 'Standard install', value: false, description: 'Installs the normal MCP-only runtime setup.' },
        { label: 'Hybrid shadow mode', value: true, description: 'Enables MCP comparison/shadow mode.' },
      ],
      false
    );
    const dryRun = await promptBinarySelection(
      io,
      4,
      totalSteps,
      'Execution',
      'Decide whether to apply the install or preview it first.',
      [
        { label: 'Apply installation', value: false, description: 'Writes files to the selected target.' },
        { label: 'Preview only', value: true, description: 'Shows the install plan without writing files.' },
      ],
      false
    );

    renderSummary(io, { runtimes, scope, hybridShadow, dryRun });

    return {
      ...baseArgs,
      runtimes,
      all: runtimes.length === 2,
      scope,
      hybridShadow,
      dryRun,
    };
  } finally {
    io.close();
  }
}

async function promptRuntimeSelection(io: InteractivePromptIo, step: number, totalSteps: number): Promise<RuntimeTarget[]> {
  renderStep(io, {
    step,
    totalSteps,
    title: 'Runtime target',
    description: 'Choose which runtime should receive the GSS workflows and support files.',
    options: [
      { label: 'Claude only', description: 'Install commands, agents, hooks, and MCP config for Claude.', isDefault: false },
      { label: 'Codex only', description: 'Install skills, runtime support files, and MCP config for Codex.', isDefault: false },
      { label: 'Claude and Codex', description: 'Install both runtimes in one pass.', isDefault: true },
    ],
  });

  while (true) {
    const answer = (await io.ask(stylePrompt('Select [1-3]: '))).trim();
    switch (answer) {
      case '1':
        return ['claude'];
      case '2':
        return ['codex'];
      case '3':
      case '':
        return ['claude', 'codex'];
      default:
        showValidationError(io, step, totalSteps, 'Runtime target', 'Enter 1, 2, or 3.');
        renderStep(io, {
          step,
          totalSteps,
          title: 'Runtime target',
          description: 'Choose which runtime should receive the GSS workflows and support files.',
          options: [
            { label: 'Claude only', description: 'Install commands, agents, hooks, and MCP config for Claude.', isDefault: false },
            { label: 'Codex only', description: 'Install skills, runtime support files, and MCP config for Codex.', isDefault: false },
            { label: 'Claude and Codex', description: 'Install both runtimes in one pass.', isDefault: true },
          ],
        });
    }
  }
}

async function promptScopeSelection(io: InteractivePromptIo, step: number, totalSteps: number): Promise<InstallScope> {
  return promptBinarySelection(
    io,
    step,
    totalSteps,
    'Install scope',
    'Pick whether the install belongs to this project only or your whole user profile.',
    [
      { label: 'Local project install', value: 'local', description: 'Writes into the current project, such as ./.codex or ./.claude.' },
      { label: 'Global user install', value: 'global', description: 'Writes into your home runtime directories, such as ~/.codex or ~/.claude.' },
    ],
    'local'
  );
}

async function promptBinarySelection<T extends string | boolean>(
  io: InteractivePromptIo,
  step: number,
  totalSteps: number,
  title: string,
  description: string,
  options: Array<{ label: string; value: T; description: string }>,
  defaultValue: T
): Promise<T> {
  renderStep(io, {
    step,
    totalSteps,
    title,
    description,
    options: options.map(option => ({
      label: option.label,
      description: option.description,
      isDefault: option.value === defaultValue,
    })),
    defaultValue,
  });

  while (true) {
    const answer = (await io.ask(stylePrompt(`Select [1-${options.length}]: `))).trim();
    if (answer === '') {
      const defaultOption = options.find(option => option.value === defaultValue);
      if (defaultOption) {
        return defaultOption.value;
      }
    }

    const choice = Number(answer);
    if (Number.isInteger(choice) && choice >= 1 && choice <= options.length) {
      return options[choice - 1].value;
    }

    showValidationError(io, step, totalSteps, title, `Enter a number between 1 and ${options.length}.`);
    renderStep(io, { step, totalSteps, title, description, options, defaultValue });
  }
}

function renderStep(
  io: InteractivePromptIo,
  options: {
    step: number;
    totalSteps: number;
    title: string;
    description: string;
    options: Array<{ label: string; description: string; isDefault?: boolean }>;
    defaultValue?: string | boolean;
  }
): void {
  io.clear();
  io.write(renderHeader(options.step, options.totalSteps));
  io.write(`${ANSI.bold}${options.title}${ANSI.reset}\n`);
  io.write(`${ANSI.dim}${options.description}${ANSI.reset}\n\n`);

  for (let index = 0; index < options.options.length; index++) {
    const option = options.options[index] as { label: string; description: string; isDefault?: boolean };
    const optionNumber = index + 1;
    const isDefault = option.isDefault === true;
    const defaultLabel = isDefault ? `${ANSI.gray} default${ANSI.reset}` : '';
    io.write(` ${ANSI.cyan}${optionNumber}.${ANSI.reset} ${ANSI.bold}${option.label}${ANSI.reset}${defaultLabel}\n`);
    io.write(`    ${ANSI.gray}${option.description}${ANSI.reset}\n`);
  }

  io.write(`\n${ANSI.gray}Press Enter to accept the default option when available.${ANSI.reset}\n\n`);
}

function renderHeader(step: number, totalSteps: number): string {
  const banner = GSS_BANNER.map(line => `${ANSI.cyan}${ANSI.bold}${line}${ANSI.reset}`).join('\n');
  const progress = `${ANSI.blue}${ANSI.bold}Install Wizard${ANSI.reset} ${ANSI.gray}Step ${step}/${totalSteps}${ANSI.reset}`;
  const subtitle = `${ANSI.gray}Security workflow installer for Claude and Codex${ANSI.reset}`;
  return `${banner}\n${progress}\n${subtitle}\n\n`;
}

function renderSummary(
  io: InteractivePromptIo,
  summary: {
    runtimes: RuntimeTarget[];
    scope: InstallScope;
    hybridShadow: boolean;
    dryRun: boolean;
  }
): void {
  io.clear();
  io.write(renderHeader(4, 4));
  io.write(`${ANSI.green}${ANSI.bold}Configuration captured${ANSI.reset}\n`);
  io.write(`${ANSI.dim}The installer will continue using the selections below.${ANSI.reset}\n\n`);
  io.write(` ${ANSI.cyan}Runtime${ANSI.reset}   ${summary.runtimes.join(', ')}\n`);
  io.write(` ${ANSI.cyan}Scope${ANSI.reset}     ${summary.scope}\n`);
  io.write(` ${ANSI.cyan}Mode${ANSI.reset}      ${summary.hybridShadow ? 'hybrid-shadow' : 'standard'}\n`);
  io.write(` ${ANSI.cyan}Execute${ANSI.reset}   ${summary.dryRun ? 'dry-run' : 'apply'}\n\n`);
}

function showValidationError(
  io: InteractivePromptIo,
  step: number,
  totalSteps: number,
  title: string,
  message: string
): void {
  io.clear();
  io.write(renderHeader(step, totalSteps));
  io.write(`${ANSI.bold}${title}${ANSI.reset}\n`);
  io.write(`${ANSI.yellow}${message}${ANSI.reset}\n\n`);
}

function stylePrompt(text: string): string {
  return `${ANSI.bold}${ANSI.cyan}${text}${ANSI.reset}`;
}
