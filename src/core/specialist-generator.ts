/**
 * Specialist Generator Module
 *
 * Converts OWASP corpus entries into specialist definitions.
 * Each specialist becomes an installable agent/skill for a runtime.
 */

import type {
  OwaspCorpusEntry,
  SpecialistDefinition,
  WorkflowId,
  ActivationRule,
  RuntimePrompts,
} from './types.js';

/**
 * Generate a specialist definition from an OWASP corpus entry.
 * @param entry - The OWASP corpus entry
 * @returns A specialist definition
 */
export function generateSpecialist(entry: OwaspCorpusEntry): SpecialistDefinition {
  const activationRules = generateActivationRules(entry);
  const inputs = generateSpecialistInputs(entry);
  const outputs = generateSpecialistOutputs(entry);
  const runtimePrompts = generateRuntimePrompts(entry);

  return {
    id: entry.id,
    title: entry.title,
    sourceUrl: entry.sourceUrl,
    intentSummary: entry.intentSummary,
    primaryWorkflowIds: entry.workflowBindings,
    delegatesTo: entry.canonicalRefs,
    activationRules,
    inputs,
    outputs,
    runtimePrompts,
    stackBindings: entry.stackBindings.length > 0 ? entry.stackBindings : undefined,
  };
}

/**
 * Generate activation rules for a specialist.
 */
function generateActivationRules(entry: OwaspCorpusEntry): ActivationRule[] {
  const rules: ActivationRule[] = [];

  // Workflow-step rule for each bound workflow
  for (const workflowId of entry.workflowBindings) {
    rules.push({
      type: 'workflow-step',
      triggerPhrases: generateTriggerPhrases(entry.id, entry.title, entry.headings),
      triggerTags: entry.tags,
      workflowContext: workflowId,
      confidence: 0.8,
    });
  }

  // Issue-type rules based on content
  const issueTypeRules = generateIssueTypeRules(entry);
  rules.push(...issueTypeRules);

  // Stack-condition rule if stack bindings exist
  if (entry.stackBindings.length > 0) {
    rules.push({
      type: 'stack-condition',
      triggerPhrases: entry.stackBindings.flatMap(s => [
        `using ${s}`,
        `${s} code`,
        `${s} framework`,
        `${s} application`,
      ]),
      triggerTags: entry.stackBindings,
      confidence: 0.9,
    });
  }

  return rules;
}

/**
 * Generate trigger phrases from entry data.
 */
function generateTriggerPhrases(id: string, title: string, headings: string[]): string[] {
  const phrases: string[] = [];

  // Add title variations
  phrases.push(
    title.toLowerCase(),
    `check ${title.toLowerCase()}`,
    `review ${title.toLowerCase()}`,
    `verify ${title.toLowerCase()}`
  );

  // Add ID-based phrases
  phrases.push(
    id.replace(/-/g, ' '),
    `${id.replace(/-/g, ' ')} issue`,
    `${id.replace(/-/g, ' ')} vulnerability`
  );

  // Add heading-based phrases
  for (const heading of headings.slice(0, 5)) {
    const normalized = heading.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    if (normalized.length > 3 && normalized.length < 50) {
      phrases.push(
        normalized,
        `check ${normalized}`,
        `verify ${normalized}`
      );
    }
  }

  // Add common security patterns
  const patternMap: Record<string, string[]> = {
    'password': ['password hashing', 'password storage', 'credential storage', 'user password'],
    'authentication': ['user login', 'auth', 'sign in', 'authentication flow'],
    'authorization': ['access control', 'permission check', 'authorization', 'user permissions'],
    'session': ['session management', 'session token', 'session handling', 'user session'],
    'xss': ['cross-site scripting', 'xss', 'html injection', 'script injection'],
    'injection': ['sql injection', 'command injection', 'injection attack', 'user input in query'],
    'csrf': ['cross-site request forgery', 'csrf', 'request forgery'],
    'crypto': ['encryption', 'cryptography', 'hashing', 'key management'],
    'logging': ['security logging', 'audit logging', 'log sensitive data'],
    'headers': ['security headers', 'http headers', 'content-security-policy', 'cors'],
  };

  for (const [key, patterns] of Object.entries(patternMap)) {
    if (id.includes(key) || title.toLowerCase().includes(key)) {
      phrases.push(...patterns);
    }
  }

  return [...new Set(phrases)].slice(0, 30);
}

/**
 * Generate issue-type activation rules.
 */
function generateIssueTypeRules(entry: OwaspCorpusEntry): ActivationRule[] {
  const rules: ActivationRule[] = [];
  const id = entry.id;

  // Map specific IDs to their issue types
  const issueTypeMap: Record<string, { type: string; phrases: string[] }> = {
    'password-storage': {
      type: 'password-handling',
      phrases: ['password hashing', 'password storage', 'bcrypt', 'argon2', 'pbkdf2', 'hash password'],
    },
    'authentication': {
      type: 'authentication',
      phrases: ['login', 'authentication', 'authn', 'user login', 'sign in', 'authenticate'],
    },
    'authorization': {
      type: 'authorization',
      phrases: ['authorization', 'access control', 'permission', 'authorize', 'access check'],
    },
    'session-management': {
      type: 'session',
      phrases: ['session', 'session token', 'session management', 'session fixation', 'session hijacking'],
    },
    'input-validation': {
      type: 'input-validation',
      phrases: ['input validation', 'validate input', 'sanitize input', 'user input'],
    },
    'sql-injection-prevention': {
      type: 'sql-injection',
      phrases: ['sql injection', 'raw sql', 'sql concatenation', 'parameterized query'],
    },
    'cross-site-scripting-prevention': {
      type: 'xss',
      phrases: ['xss', 'cross-site scripting', 'html injection', 'script tag', 'innerhtml'],
    },
    'cross-site-request-forgery-prevention': {
      type: 'csrf',
      phrases: ['csrf', 'cross-site request forgery', 'csrf token', 'anti-csrf'],
    },
    'cryptographic-storage': {
      type: 'crypto',
      phrases: ['encryption', 'decryption', 'cryptographic storage', 'encrypt data'],
    },
    'secrets-management': {
      type: 'secrets',
      phrases: ['secret', 'api key', 'password in code', 'hardcoded credential', 'token leakage'],
    },
    'file-upload': {
      type: 'file-upload',
      phrases: ['file upload', 'upload file', 'multipart/form-data', 'file validation'],
    },
    'deserialization': {
      type: 'deserialization',
      phrases: ['deserialization', 'unserialize', 'object injection', 'pickle', 'yaml.load'],
    },
    'server-side-request-forgery-prevention': {
      type: 'ssrf',
      phrases: ['ssrf', 'server-side request forgery', 'fetch url', 'user-provided url'],
    },
    'xml-external-entity-prevention': {
      type: 'xxe',
      phrases: ['xxe', 'xml external entity', 'xml parsing', 'documentbuilder'],
    },
  };

  for (const [key, config] of Object.entries(issueTypeMap)) {
    if (id === key) {
      rules.push({
        type: 'issue-type',
        triggerPhrases: config.phrases,
        triggerTags: [config.type],
        confidence: 0.9,
      });
      break;
    }
  }

  return rules;
}

/**
 * Generate specialist inputs.
 */
function generateSpecialistInputs(entry: OwaspCorpusEntry) {
  const inputs = [
    {
      name: 'context',
      type: 'string',
      description: 'The code or configuration context to review',
      required: true,
    },
  ];

  // Add workflow-specific inputs based on bindings
  if (entry.workflowBindings.includes('audit') || entry.workflowBindings.includes('plan-remediation')) {
    inputs.push({
      name: 'code-diff',
      type: 'string',
      description: 'The code changes to review (git diff or file content)',
      required: false,
    });
    inputs.push({
      name: 'file-path',
      type: 'string',
      description: 'The file path being reviewed',
      required: false,
    });
  }

  if (entry.workflowBindings.includes('verify')) {
    inputs.push({
      name: 'remediation-details',
      type: 'string',
      description: 'Details of the remediation to verify',
      required: false,
    });
  }

  return inputs;
}

/**
 * Generate specialist outputs.
 */
function generateSpecialistOutputs(entry: OwaspCorpusEntry) {
  return [
    {
      name: 'verdict',
      type: 'verdict',
      description: 'Pass/fail/needs-review assessment',
    },
    {
      name: 'findings',
      type: 'finding[]',
      description: 'Detailed findings with evidence',
    },
    {
      name: 'remediation-guidance',
      type: 'guidance',
      description: 'Specific remediation steps based on OWASP guidance',
    },
    {
      name: 'owasp-reference',
      type: 'reference',
      description: 'Link to governing OWASP cheat sheet',
    },
  ];
}

/**
 * Generate runtime-specific prompts.
 */
function generateRuntimePrompts(entry: OwaspCorpusEntry): RuntimePrompts {
  const claudePrompt = `You are the **${entry.title}** specialist.

Your expertise comes from the OWASP ${entry.title} Cheat Sheet: ${entry.sourceUrl}

## Your Role

When delegated to you, review the provided context for issues related to ${entry.intentSummary.toLowerCase()}.

## Review Scope

${entry.headings.slice(0, 8).map(h => `- ${h}`).join('\n')}

## Key Checklist Items

${entry.checklistItems.slice(0, 10).map(i => `- ${i}`).join('\n')}

## Your Output

Return a structured verdict with:
1. **verdict**: pass, fail, or needs-review
2. **confidence**: 0-1 score
3. **evidence**: specific code snippets or configuration that support your verdict
4. **affectedFiles**: files and line numbers with issues
5. **remediationNotes**: specific fix recommendations grounded in the OWASP cheat sheet
6. **verificationNotes**: how to verify the fix
7. **owaspSourceUrl**: ${entry.sourceUrl}

## Delegation

If your review reveals issues that would benefit from another specialist's expertise, include their ID in \`followUpSpecialists\`.`;

  const codexPrompt = `**${entry.title} Specialist**

Source: ${entry.sourceUrl}

Review for: ${entry.intentSummary}

Check these areas:
${entry.headings.slice(0, 8).map((h, i) => `${i + 1}. ${h}`).join('\n')}

Return findings with:
- Verdict (pass/fail/needs-review)
- Evidence from code
- Remediation steps
- OWASP reference`;

  return {
    claude: claudePrompt,
    codex: codexPrompt,
  };
}

/**
 * Generate all specialists from a corpus.
 * @param corpus - Array of OWASP corpus entries
 * @returns Array of specialist definitions
 */
export function generateAllSpecialists(corpus: OwaspCorpusEntry[]): SpecialistDefinition[] {
  return corpus.map(entry => generateSpecialist(entry));
}

/**
 * Get a specialist by ID.
 * @param id - Specialist ID
 * @param specialists - Array of specialist definitions
 * @returns The specialist or undefined
 */
export function getSpecialistById(
  id: string,
  specialists: SpecialistDefinition[]
): SpecialistDefinition | undefined {
  return specialists.find(s => s.id === id);
}

/**
 * Get specialists by workflow.
 * @param workflowId - Workflow ID
 * @param specialists - Array of specialist definitions
 * @returns Array of specialists for the workflow
 */
export function getSpecialistsByWorkflow(
  workflowId: WorkflowId,
  specialists: SpecialistDefinition[]
): SpecialistDefinition[] {
  return specialists.filter(s => s.primaryWorkflowIds.includes(workflowId));
}

/**
 * Get specialists by stack.
 * @param stack - Stack identifier (e.g., "django", "docker")
 * @param specialists - Array of specialist definitions
 * @returns Array of stack-conditioned specialists
 */
export function getSpecialistsByStack(
  stack: string,
  specialists: SpecialistDefinition[]
): SpecialistDefinition[] {
  return specialists.filter(s =>
    s.stackBindings?.some(binding => binding.toLowerCase() === stack.toLowerCase())
  );
}
