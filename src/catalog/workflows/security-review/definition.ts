import type { WorkflowDefinition } from '../../../core/types.js';

/**
 * Change-Scoped Security Review workflow definition.
 * Standalone lightweight review focused on current diffs or a single commit patch.
 */
export const securityReviewDefinition: WorkflowDefinition = {
  id: 'security-review',
  title: 'Change-Scoped Security Review',
  goal: 'Review a scoped change set for security significance, produce evidence-backed findings, validate without mutating tracked files, and emit remediation-oriented TDD specs.',
  owaspTopics: [
    {
      name: 'Secure Code Review',
      glossaryUrl: 'https://cheatsheetseries.owasp.org/Glossary.html',
      cheatSheetUrls: [
        'https://cheatsheetseries.owasp.org/cheatsheets/Secure_Code_Review_Cheat_Sheet.html',
      ],
    },
    {
      name: 'Threat Modeling',
      glossaryUrl: 'https://cheatsheetseries.owasp.org/Glossary.html',
      cheatSheetUrls: [
        'https://cheatsheetseries.owasp.org/cheatsheets/Threat_Modeling_Cheat_Sheet.html',
      ],
    },
    {
      name: 'Attack Surface Analysis',
      glossaryUrl: 'https://cheatsheetseries.owasp.org/Glossary.html',
      cheatSheetUrls: [
        'https://cheatsheetseries.owasp.org/cheatsheets/Attack_Surface_Analysis_Cheat_Sheet.html',
      ],
    },
  ],
  inputs: [
    {
      name: 'change-set',
      type: 'runtime-derived diff',
      required: true,
      description: 'Security review target derived at runtime from current uncommitted changes or from commit-ref when provided',
    },
    {
      name: 'commit-ref',
      type: 'git commit hash',
      required: false,
      description: 'Optional commit to review as commit vs parent patch instead of uncommitted working set',
    },
    {
      name: 'repository-context',
      type: 'source code + config + tests',
      required: false,
      description: 'Nearby files and supporting project context needed to validate findings in changed areas',
    },
  ],
  outputs: [
    {
      name: 'change-scope',
      type: 'json',
      description: 'Changed files/hunks, stack signals, security significance score, and impacted trust boundaries',
      path: '.gss/artifacts/security-review/change-scope.json',
    },
    {
      name: 'delegation-plan',
      type: 'json',
      description: 'Ordered specialist execution plan for this review run',
      path: '.gss/artifacts/security-review/delegation-plan.json',
    },
    {
      name: 'findings',
      type: 'json',
      description: 'Evidence-based findings with OWASP mapping, severity, confidence, and validation status',
      path: '.gss/artifacts/security-review/findings.json',
    },
    {
      name: 'validation-report',
      type: 'json',
      description: 'Validation proof attempts and outcomes per finding without mutating tracked files',
      path: '.gss/artifacts/security-review/validation-report.json',
    },
    {
      name: 'security-test-specs',
      type: 'json',
      description: 'TDD-style failing-now and expected-after-fix test specs for future remediation',
      path: '.gss/artifacts/security-review/security-test-specs.json',
    },
  ],
  dependencies: [],
  handoffs: [],
  steps: [
    {
      id: 'collect-change-set',
      title: 'Collect Change Set',
      instructions: `Determine review scope:

1. If \`commit-ref\` is provided, review exactly that commit versus its parent.
2. Otherwise review current uncommitted tracked changes (staged + unstaged) plus untracked text files.
3. Exclude ignored/generated files.
4. Warn when protected targets appear (.env, *.pem, *.key, secrets/, credentials/) without exposing secret contents.

Write normalized scope to .gss/artifacts/security-review/change-scope.json.`,
      owaspTopics: ['Secure Code Review', 'Attack Surface Analysis'],
    },
    {
      id: 'security-relevance-gate',
      title: 'Run Security Relevance Gate',
      instructions: `Score change security relevance against:
- auth/access control/session boundaries
- secrets/crypto/transport/headers/CORS/CSP
- dependency manifests/infrastructure/policy
- trust-boundary shifts and data validation/logging/auditing

If below threshold, emit a minimal short report and stop after required output artifacts.`,
      owaspTopics: ['Threat Modeling', 'Attack Surface Analysis'],
    },
    {
      id: 'impact-pass',
      title: 'Impact Pass (Threat Surface Delta)',
      instructions: `Delegate to gss-threat-modeler for changed trust boundaries and abuse cases introduced by the diff.
Capture issue tags and impacted security domains for downstream specialist routing.`,
      owaspTopics: ['Threat Modeling'],
    },
    {
      id: 'audit-pass',
      title: 'Audit Pass (Diff + Nearby Context)',
      instructions: `Delegate to gss-auditor to review changed hunks with nearby context and produce candidate findings.
Generate deterministic delegation-plan.json from changed files, issue tags, and detected stack.`,
      owaspTopics: ['Secure Code Review'],
    },
    {
      id: 'specialist-pass',
      title: 'Specialist Pass (Deterministic Sequential)',
      instructions: `Spawn specialists in deterministic sequence:
1. Required specialists first
2. One bounded round of derived follow-up specialists
3. Optional specialists only for unresolved findings

Keep sequential execution in v1 for determinism and evidence aggregation.`,
      owaspTopics: ['Secure Code Review'],
    },
    {
      id: 'validation-and-tdd',
      title: 'Validation and TDD Spec Pass',
      instructions: `Delegate to gss-verifier to validate each finding as deeply as possible without mutating tracked files.
Allowed: existing tests, safe local commands, read-only reproductions.
Classify findings as confirmed, high-confidence-static, or manual-confirmation-needed.
Emit remediation-oriented TDD specs to security-test-specs.json without writing real tests to repository paths.`,
      owaspTopics: ['Secure Code Review'],
    },
    {
      id: 'finalize',
      title: 'Finalize Artifacts',
      instructions: `Compile findings, validation outcomes, unresolved uncertainty, and remediation-oriented TDD specs.
Ensure each finding includes file path, line, snippet, OWASP reference, severity justification, and confidence.`,
      owaspTopics: ['Secure Code Review'],
    },
  ],
  guardrails: [
    {
      type: 'preflight',
      description: 'Resolve change scope before analysis and verify review target is readable',
      condition: 'Before any threat, audit, or specialist pass begins',
    },
    {
      type: 'scope',
      description: 'Keep analysis scoped to selected diff and minimal nearby context needed for validation',
      condition: 'Throughout all review phases',
    },
    {
      type: 'mutation',
      description: 'Do not mutate tracked repository files in this workflow',
      condition: 'At all times during review and validation',
    },
  ],
  runtimePrompts: {
    claude: `This workflow is the lightweight security path for diffs.

- Prefer current uncommitted working set when commit-ref is absent.
- When commit-ref is supplied, review that exact commit against its parent only.
- Stop early with a minimal report when security relevance gate is below threshold.
- Use ordered role-agent and specialist execution exactly as declared in orchestration.
- Validate aggressively without mutating tracked files.
- Produce TDD remediation specs, not implementation patches.

Persist all artifacts under .gss/artifacts/security-review/.`,
    codex: `Run an ordered, change-scoped security review.

1. Collect the diff scope (uncommitted set by default, or commit-ref vs parent).
2. Gate for security significance and short-circuit when low.
3. Execute impact, audit, specialist, and validation phases sequentially.
4. Validate findings without mutating tracked files.
5. Emit remediation-oriented TDD test specs and structured artifacts.

Keep execution deterministic and evidence-first.`,
  },
  orchestration: {
    coordinator: 'workflow-agent',
    phases: [
      {
        id: 'collect-change-set',
        title: 'Collect Change Set',
        lead: 'workflow-agent',
        execution: 'sequential',
        inputs: ['change-set', 'commit-ref', 'repository-context'],
        outputs: ['change-scope.json'],
        specialistMode: 'none',
      },
      {
        id: 'security-relevance-gate',
        title: 'Security Relevance Gate',
        lead: 'workflow-agent',
        execution: 'sequential-stop-on-low-significance',
        inputs: ['change-scope.json'],
        outputs: ['change-scope.json', 'findings.json', 'validation-report.json', 'security-test-specs.json'],
        specialistMode: 'none',
      },
      {
        id: 'impact-pass',
        title: 'Impact Pass',
        lead: 'gss-threat-modeler',
        execution: 'sequential',
        inputs: ['change-scope.json', 'repository-context'],
        outputs: ['delegation-plan.json'],
        specialistMode: 'core-required-only',
      },
      {
        id: 'audit-pass',
        title: 'Audit Pass',
        lead: 'gss-auditor',
        execution: 'sequential',
        inputs: ['change-scope.json', 'repository-context', 'delegation-plan.json'],
        outputs: ['findings.json', 'delegation-plan.json'],
        specialistMode: 'required-and-derived-candidates',
      },
      {
        id: 'specialist-pass',
        title: 'Specialist Pass',
        lead: 'workflow-agent',
        execution: 'sequential-deterministic',
        inputs: ['findings.json', 'delegation-plan.json'],
        outputs: ['findings.json', 'validation-report.json'],
        specialistMode: 'required-then-derived-then-optional',
      },
      {
        id: 'validation-and-tdd',
        title: 'Validation and TDD Pass',
        lead: 'gss-verifier',
        execution: 'sequential',
        inputs: ['findings.json', 'repository-context'],
        outputs: ['validation-report.json', 'security-test-specs.json'],
        specialistMode: 'validation-focused',
      },
      {
        id: 'finalize',
        title: 'Finalize',
        lead: 'workflow-agent',
        execution: 'sequential',
        inputs: ['change-scope.json', 'delegation-plan.json', 'findings.json', 'validation-report.json', 'security-test-specs.json'],
        outputs: ['change-scope.json', 'delegation-plan.json', 'findings.json', 'validation-report.json', 'security-test-specs.json'],
        specialistMode: 'none',
      },
    ],
  },
  delegationPolicy: {
    mode: 'on-detection',
    subjectSource: 'changed files, issue tags, trust-boundary deltas, and diff semantics',
    constraints: {
      maxRequiredPerSubject: 3,
      maxOptionalPerSubject: 2,
      allowFollowUpSpecialists: true,
      maxFollowUpDepth: 1,
      failOnMissingRequired: true,
      allowOutOfPlanConsults: false,
    },
  },
};
