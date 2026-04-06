/**
 * Test fixtures for consultation plan tests (Phase 4).
 *
 * Provides reusable snapshot data and expected plan outputs
 * for testing computeConsultationPlan() and validateConsultationCoverage().
 */

/**
 * Create a minimal LoadedSnapshot with 10 varied docs.
 */
export function makeMinimalSnapshot() {
  const docs = [
    {
      id: 'sql-injection-prevention',
      uri: 'security://owasp/cheatsheet/sql-injection-prevention',
      title: 'SQL Injection Prevention',
      sourceUrl: 'https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html',
      sourceType: 'owasp-cheatsheet',
      corpusVersion: '1.0.0',
      status: 'ready',
      summary: 'Prevents SQL injection attacks',
      headings: ['Introduction', 'Defense Options'],
      checklist: ['Use parameterized queries'],
      tags: ['sql', 'injection'],
      issueTypes: ['sql-injection', 'injection'],
      workflowBindings: [
        { workflowId: 'audit', priority: 'required' },
        { workflowId: 'security-review', priority: 'required' },
        { workflowId: 'verify', priority: 'optional' },
      ],
      stackBindings: [],
      relatedDocIds: ['query-parameterization', 'input-validation'],
      aliases: ['sqli'],
      provenance: { inferred: [], overridden: [] },
    },
    {
      id: 'cross-site-scripting-prevention',
      uri: 'security://owasp/cheatsheet/cross-site-scripting-prevention',
      title: 'Cross-Site Scripting Prevention',
      sourceUrl: 'https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html',
      sourceType: 'owasp-cheatsheet',
      corpusVersion: '1.0.0',
      status: 'ready',
      summary: 'Prevents XSS attacks',
      headings: ['Introduction', 'XSS Types'],
      checklist: ['Encode output'],
      tags: ['xss', 'injection'],
      issueTypes: ['xss', 'dom-xss'],
      workflowBindings: [
        { workflowId: 'audit', priority: 'required' },
        { workflowId: 'security-review', priority: 'optional' },
      ],
      stackBindings: [],
      relatedDocIds: ['dom-based-xss-prevention'],
      aliases: ['xss'],
      provenance: { inferred: [], overridden: [] },
    },
    {
      id: 'authentication-cheatsheet',
      uri: 'security://owasp/cheatsheet/authentication-cheatsheet',
      title: 'Authentication Cheat Sheet',
      sourceUrl: 'https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html',
      sourceType: 'owasp-cheatsheet',
      corpusVersion: '1.0.0',
      status: 'ready',
      summary: 'Authentication best practices',
      headings: ['Introduction'],
      checklist: ['Implement secure auth'],
      tags: ['authn'],
      issueTypes: ['authn', 'password-storage'],
      workflowBindings: [
        { workflowId: 'audit', priority: 'optional' },
      ],
      stackBindings: [],
      relatedDocIds: ['password-storage'],
      aliases: ['auth'],
      provenance: { inferred: [], overridden: [] },
    },
    {
      id: 'django-security',
      uri: 'security://owasp/cheatsheet/django-security',
      title: 'Django Security Cheat Sheet',
      sourceUrl: 'https://cheatsheetseries.owasp.org/cheatsheets/Django_Cheat_Sheet.html',
      sourceType: 'owasp-cheatsheet',
      corpusVersion: '1.0.0',
      status: 'ready',
      summary: 'Django-specific security guidance',
      headings: ['Django Security'],
      checklist: ['Configure CSRF'],
      tags: ['django', 'python'],
      issueTypes: ['xss', 'csrf'],
      workflowBindings: [
        { workflowId: 'audit', priority: 'optional' },
      ],
      stackBindings: [{ stack: 'django' }],
      relatedDocIds: ['cross-site-scripting-prevention'],
      aliases: [],
      provenance: { inferred: [], overridden: [] },
    },
    {
      id: 'password-storage',
      uri: 'security://owasp/cheatsheet/password-storage',
      title: 'Password Storage Cheat Sheet',
      sourceUrl: 'https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html',
      sourceType: 'owasp-cheatsheet',
      corpusVersion: '1.0.0',
      status: 'ready',
      summary: 'Secure password storage',
      headings: ['Hashing'],
      checklist: ['Use bcrypt'],
      tags: ['password', 'storage'],
      issueTypes: ['password-storage'],
      workflowBindings: [
        { workflowId: 'audit', priority: 'optional' },
      ],
      stackBindings: [],
      relatedDocIds: ['authentication-cheatsheet'],
      aliases: [],
      provenance: { inferred: [], overridden: [] },
    },
    {
      id: 'query-parameterization',
      uri: 'security://owasp/cheatsheet/query-parameterization',
      title: 'Query Parameterization',
      sourceUrl: 'https://cheatsheetseries.owasp.org/cheatsheets/Query_Parameterization_Cheat_Sheet.html',
      sourceType: 'owasp-cheatsheet',
      corpusVersion: '1.0.0',
      status: 'ready',
      summary: 'Parameterized query guidance',
      headings: ['Parameterization'],
      checklist: ['Use prepared statements'],
      tags: ['sql', 'parameterization'],
      issueTypes: ['sql-injection'],
      workflowBindings: [],
      stackBindings: [],
      relatedDocIds: ['sql-injection-prevention'],
      aliases: [],
      provenance: { inferred: [], overridden: [] },
    },
    {
      id: 'input-validation',
      uri: 'security://owasp/cheatsheet/input-validation',
      title: 'Input Validation Cheat Sheet',
      sourceUrl: 'https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html',
      sourceType: 'owasp-cheatsheet',
      corpusVersion: '1.0.0',
      status: 'ready',
      summary: 'Input validation guidance',
      headings: ['Validation'],
      checklist: ['Validate all inputs'],
      tags: ['validation'],
      issueTypes: ['injection'],
      workflowBindings: [],
      stackBindings: [],
      relatedDocIds: [],
      aliases: [],
      provenance: { inferred: [], overridden: [] },
    },
    {
      id: 'dom-based-xss-prevention',
      uri: 'security://owasp/cheatsheet/dom-based-xss-prevention',
      title: 'DOM Based XSS Prevention',
      sourceUrl: 'https://cheatsheetseries.owasp.org/cheatsheets/DOM_based_XSS_Prevention_Cheat_Sheet.html',
      sourceType: 'owasp-cheatsheet',
      corpusVersion: '1.0.0',
      status: 'ready',
      summary: 'DOM XSS prevention',
      headings: ['DOM XSS'],
      checklist: ['Avoid innerHTML'],
      tags: ['xss', 'dom'],
      issueTypes: ['dom-xss'],
      workflowBindings: [],
      stackBindings: [],
      relatedDocIds: ['cross-site-scripting-prevention'],
      aliases: [],
      provenance: { inferred: [], overridden: [] },
    },
    {
      id: 'logging-cheatsheet',
      uri: 'security://owasp/cheatsheet/logging-cheatsheet',
      title: 'Logging Cheat Sheet',
      sourceUrl: 'https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html',
      sourceType: 'owasp-cheatsheet',
      corpusVersion: '1.0.0',
      status: 'ready',
      summary: 'Secure logging guidance',
      headings: ['Logging'],
      checklist: ['Log security events'],
      tags: ['logging'],
      issueTypes: [],
      workflowBindings: [
        { workflowId: 'audit', priority: 'optional' },
      ],
      stackBindings: [],
      relatedDocIds: [],
      aliases: [],
      provenance: { inferred: [], overridden: [] },
    },
    {
      id: 'nodejs-security',
      uri: 'security://owasp/cheatsheet/nodejs-security',
      title: 'Node.js Security Cheat Sheet',
      sourceUrl: 'https://cheatsheetseries.owasp.org/cheatsheets/Nodejs_Security_Cheat_Sheet.html',
      sourceType: 'owasp-cheatsheet',
      corpusVersion: '1.0.0',
      status: 'ready',
      summary: 'Node.js specific security guidance',
      headings: ['Node.js Security'],
      checklist: ['Validate input'],
      tags: ['nodejs', 'javascript'],
      issueTypes: [],
      workflowBindings: [],
      stackBindings: [{ stack: 'nodejs' }],
      relatedDocIds: [],
      aliases: [],
      provenance: { inferred: [], overridden: [] },
    },
    {
      id: 'csrf-protection',
      uri: 'security://owasp/cheatsheet/csrf-protection',
      title: 'CSRF Protection Cheat Sheet',
      sourceUrl: 'https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html',
      sourceType: 'owasp-cheatsheet',
      corpusVersion: '1.0.0',
      status: 'ready',
      summary: 'CSRF prevention guidance',
      headings: ['CSRF'],
      checklist: ['Use anti-CSRF tokens'],
      tags: ['csrf'],
      issueTypes: ['csrf'],
      workflowBindings: [],
      stackBindings: [],
      relatedDocIds: [],
      aliases: [],
      provenance: { inferred: [], overridden: [] },
    },
    {
      id: 'docker-security',
      uri: 'security://owasp/cheatsheet/docker-security',
      title: 'Docker Security',
      sourceUrl: 'https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html',
      sourceType: 'owasp-cheatsheet',
      corpusVersion: '1.0.0',
      status: 'ready',
      summary: 'Docker security guidance',
      headings: ['Container Security'],
      checklist: ['Use minimal images'],
      tags: ['docker', 'container'],
      issueTypes: ['container'],
      workflowBindings: [],
      stackBindings: [{ stack: 'docker' }],
      relatedDocIds: [],
      aliases: [],
      provenance: { inferred: [], overridden: [] },
    },
  ];

  const normalizedDocs = docs.map(enrichDoc);
  const byId = new Map();
  const byUri = new Map();
  for (const doc of normalizedDocs) {
    byId.set(doc.id, doc);
    byUri.set(doc.uri, doc);
  }

  return {
    snapshot: {
      schemaVersion: 2,
      corpusVersion: '1.0.0',
      generatedAt: '2026-03-30T00:00:00.000Z',
      documents: normalizedDocs,
      stats: computeStats(normalizedDocs),
    },
    byId,
    byUri,
  };
}

/**
 * Create an empty snapshot (no documents).
 */
export function makeEmptySnapshot() {
  return {
    snapshot: {
      schemaVersion: 2,
      corpusVersion: '1.0.0',
      generatedAt: '2026-03-30T00:00:00.000Z',
      documents: [],
      stats: computeStats([]),
    },
    byId: new Map(),
    byUri: new Map(),
  };
}

/**
 * Create a LoadedSnapshot from an array of doc objects.
 * Builds byId/byUri lookup Maps.
 */
export function createLoadedSnapshot(docs) {
  const normalizedDocs = docs.map(enrichDoc);
  const byId = new Map();
  const byUri = new Map();
  for (const doc of normalizedDocs) {
    byId.set(doc.id, doc);
    byUri.set(doc.uri, doc);
  }
  return {
    snapshot: {
      schemaVersion: 2,
      corpusVersion: normalizedDocs[0]?.corpusVersion ?? '1.0.0',
      generatedAt: '2026-03-30T00:00:00.000Z',
      documents: normalizedDocs,
      stats: computeStats(normalizedDocs),
    },
    byId,
    byUri,
  };
}

/**
 * Create a snapshot with a broken related-doc edge.
 * sql-injection-prevention references 'non-existent-doc' which doesn't exist.
 */
export function createSnapshotWithBrokenEdge() {
  const docs = [
    {
      id: 'sql-injection-prevention',
      uri: 'security://owasp/cheatsheet/sql-injection-prevention',
      title: 'SQL Injection Prevention',
      sourceUrl: 'https://example.com/sql',
      sourceType: 'owasp-cheatsheet',
      corpusVersion: '1.0.0',
      status: 'ready',
      summary: 'SQL injection prevention',
      headings: [],
      checklist: [],
      tags: ['sql'],
      issueTypes: ['sql-injection', 'injection'],
      workflowBindings: [{ workflowId: 'audit', priority: 'required' }],
      stackBindings: [],
      relatedDocIds: ['non-existent-doc'],
      aliases: [],
      provenance: { inferred: [], overridden: [] },
    },
  ];
  return createLoadedSnapshot(docs);
}

/**
 * Create a snapshot with many docs matching a single workflow as required,
 * useful for testing constraint caps.
 */
export function createLargeSnapshot() {
  const issueTypes = [
    'sql-injection', 'xss', 'csrf', 'ssrf', 'xxe',
    'deserialization', 'command-injection',
  ];
  const docs = issueTypes.map((type, i) => ({
    id: `${type}-cheatsheet`,
    uri: `security://owasp/cheatsheet/${type}-cheatsheet`,
    title: `${type} Cheat Sheet`,
    sourceUrl: `https://example.com/${type}`,
    sourceType: 'owasp-cheatsheet',
    corpusVersion: '1.0.0',
    status: 'ready',
    summary: `${type} prevention`,
    headings: [],
    checklist: [],
    tags: [type],
    issueTypes: [type],
    workflowBindings: [{ workflowId: 'audit', priority: 'required' }],
    stackBindings: [],
    relatedDocIds: [],
    aliases: [],
    provenance: { inferred: [], overridden: [] },
  }));
  return createLoadedSnapshot(docs);
}

/**
 * Helper to create a minimal valid doc object.
 */
export function createDoc(overrides = {}) {
  return enrichDoc({
    id: 'test-doc',
    uri: 'security://owasp/cheatsheet/test-doc',
    title: 'Test Doc',
    sourceUrl: 'https://example.com/test',
    sourceType: 'owasp-cheatsheet',
    corpusVersion: '1.0.0',
    status: 'ready',
    summary: 'A test document',
    headings: [],
    checklist: [],
    sections: [],
    tags: [],
    issueTypes: [],
    workflowBindings: [],
    stackBindings: [],
    relatedDocIds: [],
    aliases: [],
    provenance: { inferred: [], overridden: [] },
    fetchMetadata: { fetchStatus: 'success', fetchAttempts: 1, lastSuccessfulFetchAt: '2026-03-30T00:00:00.000Z', sourceContentHash: 'fixture' },
    ...overrides,
  });
}

function enrichDoc(doc) {
  return {
    sections: doc.sections ?? [{
      heading: doc.headings?.[0] ?? 'Overview',
      anchor: (doc.headings?.[0] ?? 'overview').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      text: [doc.summary, ...(doc.checklist ?? [])].filter(Boolean).join('\n'),
      keywords: doc.issueTypes ?? [],
    }],
    issueTypeConfidence: doc.issueTypeConfidence ?? Object.fromEntries((doc.issueTypes ?? []).map(tag => [tag, 'curated'])),
    provenance: { reused: [], ...(doc.provenance ?? { inferred: [], overridden: [] }) },
    fetchMetadata: doc.fetchMetadata ?? { fetchStatus: 'success', fetchAttempts: 1, lastSuccessfulFetchAt: '2026-03-30T00:00:00.000Z', sourceContentHash: doc.id },
    ...doc,
  };
}

function computeStats(docs) {
  const totalDocs = docs.length;
  const readyDocs = docs.filter(d => d.status === 'ready').length;
  const pendingDocs = docs.filter(d => d.status === 'pending').length;
  const totalBindings = docs.reduce((n, d) => n + d.workflowBindings.length, 0);
  const totalRelatedEdges = docs.reduce((n, d) => n + d.relatedDocIds.length, 0);
  const reusedDocs = docs.filter(d => d.fetchMetadata?.fetchStatus === 'reused-cache').length;
  const docsWithIssueTypes = docs.filter(d => (d.issueTypes ?? []).length > 0).length;
  const docsWithWorkflowBindings = docs.filter(d => (d.workflowBindings ?? []).length > 0).length;
  const docsWithSections = docs.filter(d => (d.sections ?? []).length > 0).length;
  const totalSections = docs.reduce((n, d) => n + (d.sections ?? []).length, 0);

  return {
    totalDocs,
    readyDocs,
    pendingDocs,
    totalBindings,
    totalRelatedEdges,
    reusedDocs,
    docsWithIssueTypes,
    docsWithWorkflowBindings,
    docsWithSections,
    totalSections,
    averageRelatedDocDegree: totalDocs > 0 ? totalRelatedEdges / totalDocs : 0,
  };
}
