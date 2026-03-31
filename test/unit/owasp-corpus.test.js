/**
 * OWASP Corpus Tests
 *
 * Tests for corpus ingestion, specialist generation, and delegation graph.
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

// Import from built dist
import {
  OWASP_CANONICAL_URLS,
  urlToId,
  urlToTitle,
  createCorpusEntry,
  inferWorkflowBindings,
  inferStackBindings,
  getCorpusManifest,
} from '../../dist/core/owasp-ingestion.js';
import {
  generateSpecialist,
  generateAllSpecialists,
  getSpecialistsByWorkflow,
  getSpecialistsByStack,
} from '../../dist/core/specialist-generator.js';
import {
  buildDelegationGraph,
  getDelegationTargets,
  findDelegationPath,
  detectCycles,
} from '../../dist/core/delegation-graph.js';
import {
  getSpecialistsForWorkflow,
  isSpecialistRelevantToWorkflow,
  getDefaultDelegationBehavior,
} from '../../dist/catalog/specialists/mapping.js';

// Mock data for testing - simulates parsed OWASP cheat sheets
const MOCK_CORPUS_ENTRIES = [
  {
    id: 'password-storage',
    title: 'Password Storage Cheat Sheet',
    sourceUrl: 'https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html',
    intentSummary: 'Guidance on secure password storage using hashing algorithms',
    headings: ['Introduction', 'Hashing Algorithms', 'Salt', 'Iteration Count', 'Algorithm Agility'],
    checklistItems: [
      'Use a modern hashing algorithm',
      'Use a unique salt for each password',
      'Use an appropriate iteration count',
    ],
    canonicalRefs: ['sql-injection-prevention'], // Delegate to another specialist in our mock
    workflowBindings: ['audit', 'plan-remediation', 'verify'],
    stackBindings: [],
    tags: ['crypto', 'authentication'],
    status: 'parsed',
  },
  {
    id: 'sql-injection-prevention',
    title: 'SQL Injection Prevention Cheat Sheet',
    sourceUrl: 'https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html',
    intentSummary: 'Guidance on preventing SQL injection vulnerabilities',
    headings: ['Introduction', 'Primary Defenses', 'Other Defenses', 'Examples'],
    checklistItems: [
      'Use parameterized queries',
      'Use stored procedures',
      'Allow-list input validation',
      'Escape all user supplied input',
    ],
    canonicalRefs: ['input-validation'],
    workflowBindings: ['audit', 'plan-remediation'],
    stackBindings: [],
    tags: ['injection', 'sql'],
    status: 'parsed',
  },
  {
    id: 'input-validation',
    title: 'Input Validation Cheat Sheet',
    sourceUrl: 'https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html',
    intentSummary: 'Guidance on input validation',
    headings: ['Introduction', 'Validation Strategies'],
    checklistItems: [
      'Validate all input',
      'Use allow-lists',
    ],
    canonicalRefs: [],
    workflowBindings: ['audit', 'plan-remediation'],
    stackBindings: [],
    tags: ['validation'],
    status: 'parsed',
  },
  {
    id: 'django-security',
    title: 'Django Security Cheat Sheet',
    sourceUrl: 'https://cheatsheetseries.owasp.org/cheatsheets/Django_Security_Cheat_Sheet.html',
    intentSummary: 'Django-specific security guidance',
    headings: ['Introduction', 'Settings', 'Middleware', 'Templates', 'Forms'],
    checklistItems: [
      'Set DEBUG=False in production',
      'Use security middleware',
      'Enable CSRF protection',
    ],
    canonicalRefs: ['authentication'],
    workflowBindings: ['audit', 'plan-remediation'],
    stackBindings: ['python', 'django'],
    tags: ['framework', 'python'],
    status: 'parsed',
  },
  {
    id: 'authentication',
    title: 'Authentication Cheat Sheet',
    sourceUrl: 'https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html',
    intentSummary: 'Guidance on authentication',
    headings: ['Introduction'],
    checklistItems: [],
    canonicalRefs: [],
    workflowBindings: ['audit', 'plan-remediation', 'verify'],
    stackBindings: [],
    tags: ['auth'],
    status: 'parsed',
  },
];

describe('OWASP Corpus Ingestion', () => {
  it('should have exactly 113 canonical cheat sheet URLs', () => {
    assert.equal(OWASP_CANONICAL_URLS.length, 113);
  });

  it('should extract stable ID from URL', () => {
    assert.equal(urlToId('https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html'), 'password-storage');
    assert.equal(urlToId('https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html'), 'ai-agent-security');
    assert.equal(urlToId('https://cheatsheetseries.owasp.org/cheatsheets/DOM_based_XSS_Prevention_Cheat_Sheet.html'), 'dom-based-xss-prevention');
  });

  it('should extract title from URL', () => {
    assert.equal(urlToTitle('https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html'), 'Password Storage');
    assert.equal(urlToTitle('https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html'), 'Ai Agent Security');
  });

  it('should create corpus entry with required fields', () => {
    const mockHtml = `
      <h1>Password Storage Cheat Sheet</h1>
      <p>Guidance on secure password storage using modern hashing algorithms.</p>
      <h2>Hashing Algorithms</h2>
      <ul>
        <li>Use Argon2id if available</li>
        <li>Use bcrypt with appropriate work factor</li>
        <li>Use PBKDF2 with high iteration count</li>
      </ul>
      <h2>Salt Requirements</h2>
      <ul>
        <li>Use a unique salt for each password</li>
        <li>Salt should be at least 128 bits</li>
      </ul>
      <p>For more information, see <a href="/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html">Cryptographic Storage</a>.</p>
    `;

    const entry = createCorpusEntry(
      mockHtml,
      'https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html'
    );

    assert.equal(entry.id, 'password-storage');
    assert.equal(entry.title, 'Password Storage Cheat Sheet');
    assert.equal(entry.sourceUrl, 'https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html');
    assert.ok(entry.intentSummary);
    assert.ok(Array.isArray(entry.headings));
    assert.ok(Array.isArray(entry.checklistItems));
    assert.ok(Array.isArray(entry.canonicalRefs));
    assert.ok(Array.isArray(entry.workflowBindings));
  });

  it('should infer workflow bindings for audit-relevant cheat sheets', () => {
    const bindings = inferWorkflowBindings('sql-injection-prevention', ['Introduction', 'Defenses'], ['injection', 'sql']);

    assert.ok(bindings.includes('audit'));
    assert.ok(bindings.includes('plan-remediation'));
  });

  it('should infer stack bindings for framework-specific cheat sheets', () => {
    const djangoStack = inferStackBindings('django-security');
    assert.ok(djangoStack.includes('python'));
    assert.ok(djangoStack.includes('django'));

    const railsStack = inferStackBindings('ruby-on-rails');
    assert.ok(railsStack.includes('ruby'));
    assert.ok(railsStack.includes('rails'));
  });

  it('should generate corpus manifest with all entries', () => {
    const manifest = getCorpusManifest();

    assert.equal(manifest.length, 113);
    assert.ok(manifest.every(m => m.id && m.url));
  });
});

describe('Specialist Generation', () => {
  it('should generate specialist from corpus entry', () => {
    const specialist = generateSpecialist(MOCK_CORPUS_ENTRIES[0]);

    assert.equal(specialist.id, 'password-storage');
    assert.equal(specialist.title, 'Password Storage Cheat Sheet');
    assert.equal(specialist.sourceUrl, MOCK_CORPUS_ENTRIES[0].sourceUrl);
    assert.ok(specialist.intentSummary);
    assert.ok(Array.isArray(specialist.activationRules));
    assert.ok(Array.isArray(specialist.inputs));
    assert.ok(Array.isArray(specialist.outputs));
    assert.ok(specialist.runtimePrompts);
  });

  it('should include delegation targets from canonical refs', () => {
    const specialist = generateSpecialist(MOCK_CORPUS_ENTRIES[0]);

    assert.ok(specialist.delegatesTo.includes('sql-injection-prevention'));
  });

  it('should generate activation rules with trigger phrases', () => {
    const specialist = generateSpecialist(MOCK_CORPUS_ENTRIES[0]);

    assert.ok(specialist.activationRules.length > 0);
    const rule = specialist.activationRules[0];
    assert.ok(rule.triggerPhrases.length > 0);
    assert.ok(rule.confidence > 0);
  });

  it('should get specialists by workflow', () => {
    const specialists = generateAllSpecialists(MOCK_CORPUS_ENTRIES);
    const auditSpecialists = getSpecialistsByWorkflow('audit', specialists);

    assert.ok(auditSpecialists.length > 0);
    assert.ok(auditSpecialists.some(s => s.id === 'password-storage'));
    assert.ok(auditSpecialists.some(s => s.id === 'sql-injection-prevention'));
  });

  it('should get specialists by stack', () => {
    const specialists = generateAllSpecialists(MOCK_CORPUS_ENTRIES);
    const djangoSpecialists = getSpecialistsByStack('django', specialists);

    assert.ok(djangoSpecialists.length > 0);
    assert.ok(djangoSpecialists.some(s => s.id === 'django-security'));
  });
});

describe('Delegation Graph', () => {
  it('should build delegation graph from specialists', () => {
    const specialists = generateAllSpecialists(MOCK_CORPUS_ENTRIES);
    const graph = buildDelegationGraph(specialists);

    assert.ok(graph.specialistIds.includes('password-storage'));
    assert.ok(graph.specialistIds.includes('sql-injection-prevention'));
    assert.ok(graph.specialistIds.includes('django-security'));
  });

  it('should create delegation rules from canonical refs', () => {
    const specialists = generateAllSpecialists(MOCK_CORPUS_ENTRIES);
    const graph = buildDelegationGraph(specialists);

    const passwordStorageRules = graph.rules['password-storage'] || [];
    assert.ok(passwordStorageRules.some(r => r.childSpecialistId === 'sql-injection-prevention'));
  });

  it('should get delegation targets for a specialist', () => {
    const specialists = generateAllSpecialists(MOCK_CORPUS_ENTRIES);
    const graph = buildDelegationGraph(specialists);

    const targets = getDelegationTargets('password-storage', graph);
    assert.ok(targets.length > 0);
    assert.ok(targets.includes('sql-injection-prevention'));
  });

  it('should detect cycles in delegation graph', () => {
    // Create a graph with a cycle
    const specialistsWithCycle = [
      ...MOCK_CORPUS_ENTRIES,
      {
        id: 'cycle-a',
        title: 'Cycle A',
        sourceUrl: 'https://example.com/a.html',
        intentSummary: 'Test cycle',
        headings: [],
        checklistItems: [],
        canonicalRefs: ['cycle-b'],
        workflowBindings: ['audit'],
        stackBindings: [],
        tags: [],
        status: 'parsed',
      },
      {
        id: 'cycle-b',
        title: 'Cycle B',
        sourceUrl: 'https://example.com/b.html',
        intentSummary: 'Test cycle',
        headings: [],
        checklistItems: [],
        canonicalRefs: ['cycle-a'],
        workflowBindings: ['audit'],
        stackBindings: [],
        tags: [],
        status: 'parsed',
      },
    ];

    const specialists = generateAllSpecialists(specialistsWithCycle);
    const graph = buildDelegationGraph(specialists);

    const cycles = detectCycles(graph);
    // Should detect at least one cycle
    assert.ok(cycles.length > 0);
  });

  it('should find shortest delegation path', () => {
    const specialists = generateAllSpecialists(MOCK_CORPUS_ENTRIES);
    const graph = buildDelegationGraph(specialists);

    // password-storage delegates to sql-injection-prevention
    const path = findDelegationPath('password-storage', 'sql-injection-prevention', graph);
    assert.ok(path.length > 0);
    assert.equal(path[0], 'password-storage');
    assert.ok(path.includes('sql-injection-prevention'));
  });
});

describe('Workflow-to-Specialist Mapping', () => {
  it('should get specialists for audit workflow', () => {
    const auditSpecialists = getSpecialistsForWorkflow('audit');

    assert.ok(auditSpecialists.includes('secure-code-review'));
    assert.ok(auditSpecialists.includes('input-validation'));
    assert.ok(auditSpecialists.includes('sql-injection-prevention'));
    assert.ok(auditSpecialists.includes('authentication'));
    assert.ok(auditSpecialists.includes('password-storage'));
  });

  it('should get specialists for threat-model workflow', () => {
    const tmSpecialists = getSpecialistsForWorkflow('threat-model');

    assert.ok(tmSpecialists.includes('threat-modeling'));
    assert.ok(tmSpecialists.includes('abuse-case'));
    assert.ok(tmSpecialists.includes('attack-surface-analysis'));
  });

  it('should get stack-conditioned specialists for detected stack', () => {
    // With Django detected
    const djangoAuditSpecialists = getSpecialistsForWorkflow('audit', ['python', 'django']);

    assert.ok(djangoAuditSpecialists.includes('django-security'));
    assert.ok(djangoAuditSpecialists.includes('django-rest-framework'));
  });

  it('should check if specialist is relevant to workflow', () => {
    assert.ok(isSpecialistRelevantToWorkflow('password-storage', 'audit'));
    assert.ok(isSpecialistRelevantToWorkflow('password-storage', 'plan-remediation'));
    assert.ok(isSpecialistRelevantToWorkflow('password-storage', 'verify'));
    assert.ok(!isSpecialistRelevantToWorkflow('password-storage', 'map-codebase'));
  });

  it('should get default delegation behavior for workflow', () => {
    assert.equal(getDefaultDelegationBehavior('audit'), 'on-detection');
    assert.equal(getDefaultDelegationBehavior('plan-remediation'), 'on-detection');
    assert.equal(getDefaultDelegationBehavior('verify'), 'always');
    assert.equal(getDefaultDelegationBehavior('map-codebase'), 'manual');
  });
});
