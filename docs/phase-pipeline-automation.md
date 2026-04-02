# Migration Phase Pipeline Automation

This workflow automates the manual 4-agent loop for migration phases:

1. `plan` — read `phaseN-draft.md` and write `phaseN-plan.md`
2. `implement` — execute from `phaseN-plan.md` and write `phaseN-implementation-report.md`
3. `test-plan` — read the phase draft and implementation plan, then write `phaseN-test-plan.md`
4. `validate` — implement the planned tests, validate the phase, and write `phaseN-completion-handoff.md`

Each stage is forced to read the artifacts produced by the previous stage before it can continue.

Existing `phaseN-plan.md` files are reused by default. If a plan already exists, the runner treats the planning stage as complete and moves on to implementation-dependent work.

The scheduler is intentionally bounded:

- `implement` is the pacing stage
- `test-plan` may run while that same phase is being implemented
- the next phase `plan` may run while the current phase is being implemented
- nothing two or more planning steps ahead of the current executor is allowed
- `validate` only runs after `implement` finishes for that phase

## Runner

Use:

```bash
node scripts/run-migration-phase-pipeline.mjs
```

By default the runner is dry-run only. It discovers incomplete phases by:

- reading `migration-plan/migration-context.md`
- reading `migration-plan/migration-plan.md`
- finding `phase*-draft.md`
- excluding phases that already have `phase*-completion-handoff.md`

Dry-run shows which phase artifacts would be generated.

## Execute the full pipeline

```bash
node scripts/run-migration-phase-pipeline.mjs --run
```

This invokes the local `claude` CLI in four stage-specific roles:

- `phase-planner`
- `phase-implementer`
- `phase-test-planner`
- `phase-validator`

The runner uses `claude -p` with custom agent definitions and repository access rooted at the current project.
While running, it now streams live Claude events in the terminal for each stage, including session start, assistant output, and final result.
Each stage also runs with a fresh Claude session using `--no-session-persistence`, so phase and agent prompts do not carry conversational context forward between runs.

Default parallelism is `3`, which matches the intended overlap:

- one executor
- one test planner for the same phase
- one planner for the next phase

## Common usage

Run one phase only:

```bash
node scripts/run-migration-phase-pipeline.mjs --phase 9 --run
```

Run a subset of stages:

```bash
node scripts/run-migration-phase-pipeline.mjs --phase 9 --start-at implement --stop-after validate --run
```

Preview the next incomplete phases:

```bash
node scripts/run-migration-phase-pipeline.mjs
```

Use a different Claude model or effort level:

```bash
node scripts/run-migration-phase-pipeline.mjs --phase 9 --run --model opus --effort high
```

Tune concurrency explicitly:

```bash
node scripts/run-migration-phase-pipeline.mjs --run --max-parallel 3
```

## Output contract

For phase `N`, the runner expects these artifacts:

- `migration-plan/phaseN-draft.md`
- `migration-plan/phaseN-plan.md`
- `migration-plan/phaseN-implementation-report.md`
- `migration-plan/phaseN-test-plan.md`
- `migration-plan/phaseN-completion-handoff.md`

The stage fails if its required predecessor artifacts are missing.

That gives you a hard handoff chain instead of hoping the next agent remembered what the previous one produced.

## Why this shape is safer

- Dry-run is the default, so you can inspect the queue before spending tokens.
- The implementer is constrained to the current phase plan.
- Existing `phaseN-plan.md` files prevent unnecessary replanning.
- The test planner no longer waits for the implementation report, so it can overlap safely with execution.
- The validator must write expected-vs-actual verification results into the completion handoff.
- Existing repository instructions still apply because Claude reads the repo-local guidance files during execution.

## Current limitation

The runner is parallel, but only inside a narrow execution window.

It is deliberately not a free-for-all task queue. The point is to keep Claude busy without letting planning drift too far ahead of the code that is actually landing.
