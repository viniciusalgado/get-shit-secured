#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

const STAGES = ['plan', 'implement', 'test-plan', 'validate'];
const DEFAULT_MIGRATION_DIR = 'migration-plan';
const DEFAULT_MODEL = 'sonnet';
const DEFAULT_EFFORT = 'medium';
const DEFAULT_MAX_PARALLEL = 3;

const AGENTS = {
  'phase-planner': {
    description:
      'Turns a phase draft into an implementation plan with explicit scope, sequencing, and verification checkpoints.',
    prompt: [
      'You are the phase planner for the GSS migration.',
      'Read the required migration docs before acting.',
      'Produce only the requested plan document.',
      'Do not edit source code in this stage.',
      'Preserve existing docs unless you are writing the requested output file.',
    ].join(' '),
  },
  'phase-implementer': {
    description:
      'Executes one migration phase strictly from the approved phase plan and records what changed.',
    prompt: [
      'You are the phase implementer for the GSS migration.',
      'Read the required migration docs before acting.',
      'Implement only the scope described by the current phase plan.',
      'Do not widen scope beyond the phase plan.',
      'After code changes, write the requested implementation report.',
    ].join(' '),
  },
  'phase-test-planner': {
    description:
      'Turns a phase draft and plan into a concrete TDD-oriented test plan that can be prepared while implementation is in progress.',
    prompt: [
      'You are the phase test planner for the GSS migration.',
      'Read the required migration docs before acting.',
      'Produce only the requested test plan document.',
      'Do not edit application code or tests in this stage.',
    ].join(' '),
  },
  'phase-validator': {
    description:
      'Implements planned tests, validates the phase implementation, and writes the completion handoff.',
    prompt: [
      'You are the phase validator for the GSS migration.',
      'Read the required migration docs before acting.',
      'Implement only the tests justified by the phase plan and test plan.',
      'Run verification commands when possible.',
      'Write the requested completion handoff with expected vs actual verification results.',
    ].join(' '),
  },
};

const STAGE_CONFIG = {
  plan: {
    agent: 'phase-planner',
    outputFile: (phase) => `phase${phase}-plan.md`,
    description: 'Generate the phase implementation plan from the draft.',
  },
  implement: {
    agent: 'phase-implementer',
    outputFile: (phase) => `phase${phase}-implementation-report.md`,
    description: 'Execute the phase plan and record the implementation report.',
  },
  'test-plan': {
    agent: 'phase-test-planner',
    outputFile: (phase) => `phase${phase}-test-plan.md`,
    description: 'Create the TDD-oriented test plan from the phase draft and approved plan.',
  },
  validate: {
    agent: 'phase-validator',
    outputFile: (phase) => `phase${phase}-completion-handoff.md`,
    description: 'Implement tests, validate the phase, and write the completion handoff.',
  },
};

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const rootDir = path.resolve(options.rootDir);
  const migrationDir = path.resolve(rootDir, options.migrationDir);
  const phases = await resolvePhases(rootDir, migrationDir, options.phaseNumbers);

  if (phases.length === 0) {
    console.log('No incomplete phases found.');
    return;
  }

  const selectedStages = sliceStages(options.startAt, options.stopAfter);
  const runSummary = [];

  console.log(`Root: ${rootDir}`);
  console.log(`Migration dir: ${migrationDir}`);
  console.log(`Phases: ${phases.join(', ')}`);
  console.log(`Stages: ${selectedStages.join(' -> ')}`);
  console.log(`Parallelism: ${options.maxParallel}`);
  console.log(`Mode: ${options.execute ? 'execute' : 'dry-run'}`);
  console.log('');

  const tasks = buildTasks({
    phases,
    stages: selectedStages,
    migrationDir,
  });

  if (!options.execute) {
    await printDryRunPlan(tasks, rootDir);
    return;
  }

  await ensureClaudeAvailable();
  await executeTaskGraph({
    tasks,
    rootDir,
    migrationDir,
    model: options.model,
    effort: options.effort,
    maxParallel: options.maxParallel,
    runSummary,
  });

  console.log('Pipeline complete.');
  for (const item of runSummary) {
    const relativePath = path.relative(rootDir, item.outputPath);
    const costText = item.costUsd == null ? 'n/a' : `$${item.costUsd.toFixed(4)}`;
    console.log(
      `- Phase ${item.phase} ${item.stage}: ${relativePath} | session ${item.sessionId ?? 'n/a'} | cost ${costText}`,
    );
  }
}

function parseArgs(argv) {
  const options = {
    rootDir: process.cwd(),
    migrationDir: DEFAULT_MIGRATION_DIR,
    phaseNumbers: [],
    startAt: STAGES[0],
    stopAfter: STAGES[STAGES.length - 1],
    execute: false,
    model: DEFAULT_MODEL,
    effort: DEFAULT_EFFORT,
    maxParallel: DEFAULT_MAX_PARALLEL,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--run') {
      options.execute = true;
      continue;
    }

    if (arg === '--root') {
      options.rootDir = mustGetValue(argv, ++i, '--root');
      continue;
    }

    if (arg === '--migration-dir') {
      options.migrationDir = mustGetValue(argv, ++i, '--migration-dir');
      continue;
    }

    if (arg === '--phase') {
      const value = mustGetValue(argv, ++i, '--phase');
      options.phaseNumbers.push(...parsePhaseList(value));
      continue;
    }

    if (arg === '--start-at') {
      options.startAt = parseStageName(mustGetValue(argv, ++i, '--start-at'));
      continue;
    }

    if (arg === '--stop-after') {
      options.stopAfter = parseStageName(mustGetValue(argv, ++i, '--stop-after'));
      continue;
    }

    if (arg === '--model') {
      options.model = mustGetValue(argv, ++i, '--model');
      continue;
    }

    if (arg === '--effort') {
      options.effort = mustGetValue(argv, ++i, '--effort');
      continue;
    }

    if (arg === '--max-parallel') {
      const value = Number(mustGetValue(argv, ++i, '--max-parallel'));
      if (!Number.isInteger(value) || value < 1) {
        throw new Error('--max-parallel must be a positive integer');
      }
      options.maxParallel = value;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function printHelp() {
  console.log(`Usage: node scripts/run-migration-phase-pipeline.mjs [options]

Options:
  --run                     Actually invoke Claude. Without this flag, the script is dry-run only.
  --phase 9,10              Limit execution to specific phases.
  --start-at plan           First stage to run (${STAGES.join(', ')}).
  --stop-after validate     Last stage to run (${STAGES.join(', ')}).
  --migration-dir path      Migration plan directory (default: ${DEFAULT_MIGRATION_DIR}).
  --root path               Repository root (default: current working directory).
  --model sonnet            Claude model alias (default: ${DEFAULT_MODEL}).
  --effort medium           Claude effort level (default: ${DEFAULT_EFFORT}).
  --max-parallel 3          Maximum concurrent Claude tasks (default: ${DEFAULT_MAX_PARALLEL}).
  --help                    Show this help text.
`);
}

function mustGetValue(argv, index, flag) {
  const value = argv[index];
  if (!value) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

function parsePhaseList(value) {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      if (!/^\d+$/.test(part)) {
        throw new Error(`Invalid phase number: ${part}`);
      }
      return Number(part);
    });
}

function parseStageName(value) {
  if (!STAGES.includes(value)) {
    throw new Error(`Invalid stage "${value}". Expected one of: ${STAGES.join(', ')}`);
  }
  return value;
}

function sliceStages(startAt, stopAfter) {
  const startIndex = STAGES.indexOf(startAt);
  const stopIndex = STAGES.indexOf(stopAfter);

  if (startIndex > stopIndex) {
    throw new Error(`--start-at ${startAt} cannot come after --stop-after ${stopAfter}`);
  }

  return STAGES.slice(startIndex, stopIndex + 1);
}

async function resolvePhases(rootDir, migrationDir, requestedPhases) {
  if (requestedPhases.length > 0) {
    return Array.from(new Set(requestedPhases)).sort((a, b) => a - b);
  }

  const contextPath = path.join(migrationDir, 'migration-context.md');
  const planPath = path.join(migrationDir, 'migration-plan.md');
  const [contextText, planText] = await Promise.all([
    readFile(contextPath, 'utf8'),
    readFile(planPath, 'utf8'),
  ]);

  const mentionedPhases = unionSets(
    extractMentionedPhases(contextText),
    extractMentionedPhases(planText),
  );
  const draftPhases = extractPhaseNumbersFromText(
    await runShellList(rootDir, `ls -1 ${shellEscape(path.relative(rootDir, migrationDir))}`),
    /phase(\d+)-draft\.md/g,
  );
  const completedPhases = extractPhaseNumbersFromText(
    await runShellList(rootDir, `ls -1 ${shellEscape(path.relative(rootDir, migrationDir))}`),
    /phase(\d+)-completion-handoff\.md/g,
  );

  return Array.from(draftPhases)
    .filter((phase) => mentionedPhases.has(phase) && !completedPhases.has(phase))
    .sort((a, b) => a - b);
}

function extractMentionedPhases(text) {
  return extractPhaseNumbersFromText(text, /Phase\s+(\d+)/gi);
}

function extractPhaseNumbersFromText(text, pattern) {
  const phases = new Set();
  let match;
  while ((match = pattern.exec(text)) !== null) {
    phases.add(Number(match[1]));
  }
  return phases;
}

function unionSets(a, b) {
  return new Set([...a, ...b]);
}

function buildTasks({ phases, stages, migrationDir }) {
  const tasks = [];
  for (const phase of phases) {
    for (const stage of stages) {
      const requirements = getStageRequirements({ phase, stage, migrationDir });
      tasks.push({
        id: `${phase}:${stage}`,
        phase,
        stage,
        agent: STAGE_CONFIG[stage].agent,
        outputPath: path.join(migrationDir, STAGE_CONFIG[stage].outputFile(phase)),
        requiredInputPaths: requirements.requiredInputPaths,
        optionalInputPaths: requirements.optionalInputPaths,
        reuseExistingOutput: stage === 'plan',
        dependencyIds: [],
      });
    }
  }

  const selectedTaskIds = new Set(tasks.map((task) => task.id));
  for (const task of tasks) {
    task.dependencyIds = getDependencyIds(task).filter((id) => selectedTaskIds.has(id));
  }

  return tasks;
}

function getStageRequirements({ phase, stage, migrationDir }) {
  const previousCompletionPath = path.join(migrationDir, `phase${phase - 1}-completion-handoff.md`);
  const requirements = {
    plan: {
      requiredInputPaths: [
        path.join(migrationDir, 'migration-context.md'),
        path.join(migrationDir, 'migration-plan.md'),
        path.join(migrationDir, `phase${phase}-draft.md`),
      ],
      optionalInputPaths: phase > 1 ? [previousCompletionPath] : [],
    },
    implement: {
      requiredInputPaths: [
        path.join(migrationDir, 'migration-context.md'),
        path.join(migrationDir, 'migration-plan.md'),
        path.join(migrationDir, `phase${phase}-draft.md`),
        path.join(migrationDir, `phase${phase}-plan.md`),
      ],
      optionalInputPaths: phase > 1 ? [previousCompletionPath] : [],
    },
    'test-plan': {
      requiredInputPaths: [
        path.join(migrationDir, 'migration-context.md'),
        path.join(migrationDir, 'migration-plan.md'),
        path.join(migrationDir, `phase${phase}-draft.md`),
        path.join(migrationDir, `phase${phase}-plan.md`),
      ],
      optionalInputPaths: [
        path.join(migrationDir, `phase${phase}-implementation-report.md`),
      ],
    },
    validate: {
      requiredInputPaths: [
        path.join(migrationDir, 'migration-context.md'),
        path.join(migrationDir, 'migration-plan.md'),
        path.join(migrationDir, `phase${phase}-draft.md`),
        path.join(migrationDir, `phase${phase}-plan.md`),
        path.join(migrationDir, `phase${phase}-implementation-report.md`),
        path.join(migrationDir, `phase${phase}-test-plan.md`),
      ],
      optionalInputPaths: [],
    },
  };

  return requirements[stage];
}

function getDependencyIds(task) {
  const previousPhase = task.phase - 1;
  switch (task.stage) {
    case 'plan':
      return [];
    case 'implement':
      return [
        `${task.phase}:plan`,
        previousPhase >= 1 ? `${previousPhase}:validate` : '',
      ].filter(Boolean);
    case 'test-plan':
      return [`${task.phase}:plan`];
    case 'validate':
      return [`${task.phase}:implement`, `${task.phase}:test-plan`];
    default:
      return [];
  }
}

async function ensureInputsExist(stage, inputPaths) {
  for (const inputPath of inputPaths) {
    if (!(await fileExists(inputPath))) {
      throw new Error(`Stage "${stage}" is missing required input: ${inputPath}`);
    }
  }
}

async function executeTaskGraph({
  tasks,
  rootDir,
  migrationDir,
  model,
  effort,
  maxParallel,
  runSummary,
}) {
  const taskState = new Map();
  for (const task of tasks) {
    const initialStatus =
      task.reuseExistingOutput && (await fileExists(task.outputPath)) ? 'completed' : 'pending';
    taskState.set(task.id, { ...task, status: initialStatus });
  }
  const running = new Map();
  const reusedTasks = getPrecompletedTasks(taskState);

  if (reusedTasks.length > 0) {
    console.log('Reusing existing stage outputs:');
    for (const task of reusedTasks.sort(compareTasks)) {
      console.log(`- Phase ${task.phase} ${task.stage}: ${path.relative(rootDir, task.outputPath)}`);
    }
    console.log('');
  }

  while (true) {
    const pendingTasks = getTasksByStatus(taskState, 'pending');
    const runningTasks = getTasksByStatus(taskState, 'running');
    if (pendingTasks.length === 0 && runningTasks.length === 0) {
      return;
    }

    const readyTasks = [];
    for (const task of pendingTasks) {
      if (!(await areRequiredInputsPresent(task))) {
        continue;
      }
      if (!areDependenciesComplete(task, taskState)) {
        continue;
      }
      if (!isTaskWithinExecutionWindow(task, taskState)) {
        continue;
      }
      if (task.stage === 'implement' && runningTasks.some((item) => item.stage === 'implement')) {
        continue;
      }
      readyTasks.push(task);
    }

    while (running.size < maxParallel && readyTasks.length > 0) {
      const nextTask = chooseNextTask(readyTasks, taskState);
      readyTasks.splice(readyTasks.findIndex((task) => task.id === nextTask.id), 1);
      taskState.get(nextTask.id).status = 'running';
      console.log(`-> Phase ${nextTask.phase} ${nextTask.stage}: ${STAGE_CONFIG[nextTask.stage].description}`);
      const promise = runTask({
        task: nextTask,
        rootDir,
        migrationDir,
        model,
        effort,
      });
      running.set(nextTask.id, promise);
    }

    if (running.size === 0) {
      const blocked = pendingTasks
        .map((task) => `${task.id}`)
        .sort()
        .join(', ');
      throw new Error(`No runnable tasks remain. Blocked tasks: ${blocked}`);
    }

    let settled;
    try {
      settled = await Promise.race(
        [...running.entries()].map(([id, promise]) =>
          promise.then((result) => ({ id, result }), (error) => Promise.reject({ id, error })),
        ),
      );
    } catch (failure) {
      const message = failure?.error instanceof Error ? failure.error.message : String(failure?.error ?? failure);
      throw new Error(`Task ${failure?.id ?? 'unknown'} failed: ${message}`);
    }

    running.delete(settled.id);
    const statefulTask = taskState.get(settled.id);
    statefulTask.status = 'completed';

    runSummary.push({
      phase: statefulTask.phase,
      stage: statefulTask.stage,
      outputPath: statefulTask.outputPath,
      sessionId: settled.result.sessionId,
      costUsd: settled.result.costUsd,
      summary: settled.result.summary,
    });

    console.log(`   wrote ${path.relative(rootDir, statefulTask.outputPath)}`);
    if (settled.result.summary) {
      console.log(indentLines(trimTo(settled.result.summary, 600), '   summary: '));
    }
  }
}

function getTasksByStatus(taskState, status) {
  return [...taskState.values()].filter((task) => task.status === status);
}

function getPrecompletedTasks(taskState) {
  return [...taskState.values()].filter((task) => task.status === 'completed' && task.reuseExistingOutput);
}

function compareTasks(a, b) {
  if (a.phase !== b.phase) {
    return a.phase - b.phase;
  }
  return STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage);
}

async function areRequiredInputsPresent(task) {
  for (const inputPath of task.requiredInputPaths) {
    if (!(await fileExists(inputPath))) {
      return false;
    }
  }
  return true;
}

function areDependenciesComplete(task, taskState) {
  return task.dependencyIds.every((id) => taskState.get(id)?.status === 'completed');
}

function isTaskWithinExecutionWindow(task, taskState) {
  if (!hasImplementTasks(taskState)) {
    return true;
  }

  const executorPhase = getExecutorPhase(taskState);

  if (task.stage === 'plan') {
    return task.phase <= executorPhase + 1;
  }

  if (task.stage === 'test-plan') {
    return task.phase <= executorPhase;
  }

  return true;
}

function hasImplementTasks(taskState) {
  return [...taskState.values()].some((task) => task.stage === 'implement');
}

function getExecutorPhase(taskState) {
  const executorTasks = [...taskState.values()].filter(
    (task) => task.stage === 'implement' && (task.status === 'running' || task.status === 'completed'),
  );

  if (executorTasks.length === 0) {
    const firstPhase = Math.min(...[...taskState.values()].map((task) => task.phase));
    return firstPhase - 1;
  }

  return Math.max(...executorTasks.map((task) => task.phase));
}

function chooseNextTask(readyTasks) {
  const stagePriority = {
    implement: 0,
    validate: 1,
    'test-plan': 2,
    plan: 3,
  };

  return [...readyTasks].sort((a, b) => {
    if (stagePriority[a.stage] !== stagePriority[b.stage]) {
      return stagePriority[a.stage] - stagePriority[b.stage];
    }
    if (a.phase !== b.phase) {
      return a.phase - b.phase;
    }
    return a.id.localeCompare(b.id);
  })[0];
}

async function runTask({ task, rootDir, migrationDir, model, effort }) {
  const existingOptionalInputPaths = [];
  for (const inputPath of task.optionalInputPaths) {
    if (await fileExists(inputPath)) {
      existingOptionalInputPaths.push(inputPath);
    }
  }

  await ensureInputsExist(task.stage, task.requiredInputPaths);

  const prompt = buildPrompt({
    phase: task.phase,
    stage: task.stage,
    rootDir,
    migrationDir,
    outputPath: task.outputPath,
    requiredInputPaths: task.requiredInputPaths,
    optionalInputPaths: existingOptionalInputPaths,
  });
  const result = await runClaudeStage({
    rootDir,
    prompt,
    stage: task.stage,
    agent: task.agent,
    model,
    effort,
  });

  const outputExists = await fileExists(task.outputPath);
  if (!outputExists) {
    throw new Error(
      `Stage "${task.stage}" for phase ${task.phase} finished without writing ${path.relative(rootDir, task.outputPath)}.`,
    );
  }

  return result;
}

function buildPrompt({
  phase,
  stage,
  rootDir,
  migrationDir,
  outputPath,
  requiredInputPaths,
  optionalInputPaths,
}) {
  const relativeOutputPath = path.relative(rootDir, outputPath);
  const stageRules = {
    plan: [
      `Create ${relativeOutputPath}.`,
      'The document must convert the phase draft into an implementation-ready plan.',
      'Include explicit PR slicing, file targets, verification expectations, and blocking assumptions.',
      'Do not modify source code or tests.',
    ],
    implement: [
      `Implement the repository changes required by phase ${phase} using the phase plan.`,
      `Create ${relativeOutputPath} after code changes.`,
      'The implementation report must summarize touched files, notable decisions, commands run, blockers, and suggested inputs for the test-planning stage.',
      'Do not widen scope beyond the phase plan.',
    ],
    'test-plan': [
      `Create ${relativeOutputPath}.`,
      'The document must translate the phase draft and approved implementation plan into a concrete TDD-oriented test plan.',
      'Name the most appropriate new or updated test files and the scenarios each should cover.',
      'Do not change source code or test files in this stage.',
      'Assume implementation may still be in progress; prefer stable test intent over post-hoc narration.',
    ],
    validate: [
      `Implement the tests justified by the test plan for phase ${phase}.`,
      'Run the narrowest meaningful validation commands.',
      `Create ${relativeOutputPath}.`,
      'The completion handoff must include what was validated, expected vs actual results, residual risks, and the next phase handoff.',
    ],
  };

  return [
    `Repository root: ${rootDir}`,
    `Migration docs directory: ${migrationDir}`,
    `Current phase: ${phase}`,
    `Current stage: ${stage}`,
    '',
    'Read every required input document before making changes:',
    ...requiredInputPaths.map((filePath) => `- ${filePath}`),
    ...(optionalInputPaths.length > 0
      ? ['', 'Also use these predecessor artifacts if they already exist:', ...optionalInputPaths.map((filePath) => `- ${filePath}`)]
      : []),
    '',
    'Execution rules:',
    '- Respect existing repository instructions, including AGENTS.md and CLAUDE.md.',
    '- Preserve user changes outside the current phase scope.',
    '- Use the generated document from the immediately previous stage as a required input, not just optional context.',
    '- If the current stage cannot complete safely, stop and explain the blocker in the requested output file.',
    ...stageRules[stage].map((rule) => `- ${rule}`),
    '',
    'Output contract:',
    `- The required stage artifact is ${outputPath}`,
    '- Keep the document focused on this phase only.',
    '- Use markdown.',
  ].join('\n');
}

async function runClaudeStage({ rootDir, prompt, stage, agent, model, effort }) {
  const args = [
    '-p',
    '--verbose',
    '--no-session-persistence',
    '--output-format',
    'stream-json',
    '--permission-mode',
    'bypassPermissions',
    '--dangerously-skip-permissions',
    '--add-dir',
    rootDir,
    '--model',
    model,
    '--effort',
    effort,
    '--agents',
    JSON.stringify(AGENTS),
    '--agent',
    agent,
    prompt,
  ];

  const parsed = await streamClaudeCommand('claude', args, { cwd: rootDir, stage });

  if (parsed.subtype !== 'success' || parsed.is_error) {
    throw new Error(`Claude stage "${stage}" failed: ${JSON.stringify(parsed)}`);
  }

  return {
    sessionId: parsed.session_id ?? null,
    costUsd: parsed.total_cost_usd ?? null,
    summary: typeof parsed.result === 'string' ? parsed.result.trim() : '',
  };
}

async function ensureClaudeAvailable() {
  await spawnAndCollect('claude', ['--version'], { cwd: process.cwd(), stage: 'preflight' });
}

async function streamClaudeCommand(command, args, { cwd, stage }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';
    let stdoutBuffer = '';
    let finalResult = null;

    child.stdout.on('data', (chunk) => {
      stdoutBuffer += chunk.toString();
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop() ?? '';

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) {
          continue;
        }

        let event;
        try {
          event = JSON.parse(line);
        } catch {
          console.log(`[${stage}] ${line}`);
          continue;
        }

        renderClaudeEvent(stage, event);
        if (event.type === 'result') {
          finalResult = event;
        }
      }
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      process.stderr.write(chunk);
    });

    child.on('error', (error) => {
      reject(new Error(`Failed to start ${command} for stage "${stage}": ${error.message}`));
    });

    child.on('close', (code) => {
      if (stdoutBuffer.trim()) {
        try {
          const event = JSON.parse(stdoutBuffer.trim());
          renderClaudeEvent(stage, event);
          if (event.type === 'result') {
            finalResult = event;
          }
        } catch {
          console.log(`[${stage}] ${stdoutBuffer.trim()}`);
        }
      }

      if (code !== 0) {
        reject(
          new Error(
            `${command} exited with code ${code} during stage "${stage}".${stderr ? `\n${stderr}` : ''}`,
          ),
        );
        return;
      }

      if (!finalResult) {
        reject(new Error(`No final Claude result event received for stage "${stage}".`));
        return;
      }

      resolve(finalResult);
    });
  });
}

function renderClaudeEvent(stage, event) {
  const prefix = `[${stage}]`;

  if (event.type === 'system' && event.subtype === 'init') {
    const model = event.model ?? 'unknown-model';
    const sessionId = event.session_id ?? 'unknown-session';
    console.log(`${prefix} session started | model=${model} | session=${sessionId}`);
    return;
  }

  if (event.type === 'assistant' && event.message?.content) {
    for (const item of event.message.content) {
      if (item.type === 'thinking' && item.thinking) {
        console.log(`${prefix} thinking: ${trimTo(singleLine(item.thinking), 200)}`);
        continue;
      }
      if (item.type === 'text' && item.text) {
        console.log(`${prefix} assistant: ${trimTo(singleLine(item.text), 400)}`);
      }
    }
    return;
  }

  if (event.type === 'user') {
    console.log(`${prefix} user event`);
    return;
  }

  if (event.type === 'tool_use' || event.type === 'tool') {
    console.log(`${prefix} tool event: ${trimTo(singleLine(JSON.stringify(event)), 240)}`);
    return;
  }

  if (event.type === 'result') {
    const outcome = event.subtype ?? 'result';
    const cost = event.total_cost_usd == null ? 'n/a' : `$${event.total_cost_usd.toFixed(4)}`;
    console.log(`${prefix} result: ${outcome} | turns=${event.num_turns ?? 'n/a'} | cost=${cost}`);
    return;
  }

  console.log(`${prefix} event: ${trimTo(singleLine(JSON.stringify(event)), 240)}`);
}

async function spawnAndCollect(command, args, { cwd, stage }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      process.stderr.write(chunk);
    });

    child.on('error', (error) => {
      reject(new Error(`Failed to start ${command} for stage "${stage}": ${error.message}`));
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `${command} exited with code ${code} during stage "${stage}".${stderr ? `\n${stderr}` : ''}`,
          ),
        );
        return;
      }
      resolve(stdout.trim());
    });
  });
}

async function printDryRunPlan(tasks, rootDir) {
  const reusedTaskIds = new Set();
  for (const task of tasks) {
    if (task.reuseExistingOutput && (await fileExists(task.outputPath))) {
      reusedTaskIds.add(task.id);
    }
  }

  console.log('Planned task graph:');
  for (const task of tasks) {
    const deps = task.dependencyIds.length > 0 ? task.dependencyIds.join(', ') : 'none';
    const status = reusedTaskIds.has(task.id) ? 'reuse-existing' : 'run';
    console.log(
      `- Phase ${task.phase} ${task.stage}: ${path.relative(rootDir, task.outputPath)} | deps: ${deps} | ${status}`,
    );
  }
  console.log('');
  console.log('Pipeline policy:');
  console.log('- Only one `implement` task runs at a time.');
  console.log('- `test-plan` may run once the same phase plan exists, even if implementation is still running.');
  console.log('- The next phase `plan` may run while the current phase is being implemented.');
  console.log('- `validate` only runs after both `implement` and `test-plan` finish for that phase.');
  console.log('- Existing `phaseN-plan.md` files are reused by default and skip replanning.');
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function indentLines(text, prefix) {
  const lines = text.split('\n');
  if (lines.length === 0) {
    return prefix.trimEnd();
  }
  return lines.map((line, index) => `${index === 0 ? prefix : ' '.repeat(prefix.length)}${line}`).join('\n');
}

function trimTo(text, maxLength) {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 3)}...`;
}

function singleLine(text) {
  return text.replace(/\s+/g, ' ').trim();
}

async function runShellList(rootDir, command) {
  return spawnAndCollect('bash', ['-lc', command], { cwd: rootDir, stage: 'discovery' });
}

function shellEscape(value) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
