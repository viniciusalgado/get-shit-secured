import type { WorkflowDefinition } from '../../../core/types.js';

/**
 * Security Audit workflow definition.
 * Grounded in OWASP Top 10, ASVS, and Secure Code Review practices.
 */
export const auditDefinition: WorkflowDefinition = {
  id: 'audit',
  title: 'Security Audit',
  goal: 'Run structured security review passes against the codebase to identify vulnerabilities, misconfigurations, and security weaknesses with evidence and OWASP mappings.',
  owaspTopics: [
    {
      name: 'OWASP Top 10',
      glossaryUrl: 'https://owasp.org/www-project-top-ten/',
      cheatSheetUrls: [],
    },
    {
      name: 'ASVS (Application Security Verification Standard)',
      glossaryUrl: 'https://cheatsheetseries.owasp.org/Glossary.html',
      cheatSheetUrls: [],
    },
    {
      name: 'Secure Code Review',
      glossaryUrl: 'https://cheatsheetseries.owasp.org/Glossary.html',
      cheatSheetUrls: [
        'https://cheatsheetseries.owasp.org/cheatsheets/Secure_Code_Review_Cheat_Sheet.html',
      ],
    },
    {
      name: 'Input Validation',
      glossaryUrl: 'https://cheatsheetseries.owasp.org/Glossary.html',
      cheatSheetUrls: [
        'https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html',
      ],
    },
    {
      name: 'Output Encoding',
      glossaryUrl: 'https://cheatsheetseries.owasp.org/Glossary.html',
      cheatSheetUrls: [
        'https://cheatsheetseries.owasp.org/cheatsheets/Cross_Scripting_Prevention_Cheat_Sheet.html',
      ],
    },
    {
      name: 'Secrets Management',
      glossaryUrl: 'https://cheatsheetseries.owasp.org/Glossary.html',
      cheatSheetUrls: [
        'https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html',
      ],
    },
    {
      name: 'Logging',
      glossaryUrl: 'https://cheatsheetseries.owasp.org/Glossary.html',
      cheatSheetUrls: [
        'https://cheatsheetseries.owasp.org/cheatsheets/Logging_Vocabulary_Cheat_Sheet.html',
      ],
    },
    {
      name: 'AI Agent Security',
      glossaryUrl: 'https://cheatsheetseries.owasp.org/Glossary.html',
      cheatSheetUrls: [
        'https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html',
      ],
    },
  ],
  inputs: [
    {
      name: 'codebase-inventory',
      type: 'json',
      required: true,
      description: 'Component inventory from map-codebase workflow',
    },
    {
      name: 'dependency-map',
      type: 'json',
      required: true,
      description: 'Dependency catalog from map-codebase workflow',
    },
    {
      name: 'threat-register',
      type: 'json',
      required: false,
      description: 'Threat catalog from threat-model workflow (if available)',
    },
    {
      name: 'risk-assessment',
      type: 'json',
      required: false,
      description: 'Risk prioritization from threat-model workflow (if available)',
    },
  ],
  outputs: [
    {
      name: 'findings-report',
      type: 'json',
      description: 'Complete security findings with evidence, severity, and OWASP mappings',
      path: '.gss/artifacts/audit/findings.json',
    },
    {
      name: 'owasp-mapping',
      type: 'json',
      description: 'Findings cross-referenced with OWASP Top 10 and ASVS categories',
      path: '.gss/artifacts/audit/owasp-mapping.json',
    },
    {
      name: 'evidence-artifacts',
      type: 'markdown',
      description: 'Code snippets and context for each finding',
      path: '.gss/artifacts/audit/evidence.md',
    },
    {
      name: 'remediation-priorities',
      type: 'json',
      description: 'Findings prioritized by severity and exploitability',
      path: '.gss/artifacts/audit/priorities.json',
    },
  ],
  dependencies: [
    {
      workflowId: 'map-codebase',
      requiredOutputs: ['codebase-inventory', 'dependency-map'],
    },
  ],
  handoffs: [
    {
      nextWorkflow: 'validate-findings',
      outputsToPass: ['findings-report', 'remediation-priorities'],
    },
    {
      nextWorkflow: 'report',
      outputsToPass: ['findings-report', 'owasp-mapping'],
    },
  ],
  steps: [
    {
      id: 'check-input-validation',
      title: 'Input Validation Review',
      instructions: `Check for input validation vulnerabilities:

**A01:2021 - Broken Access Control**
- Look for: Missing authorization checks, IDOR possibilities
- Patterns to search: \`params[:id]\`, \`req.params.id\`, path parameters
- Verify: Can users access resources they shouldn't?

**A03:2021 - Injection**
- SQL Injection: Raw SQL queries with user input
  - Search: \`"SELECT * FROM" +\`, \`db.query(\`\$, \`sql.Parse\`
  - Check: Parameterized queries vs string concatenation
- Command Injection: System commands with user input
  - Search: \`exec(\`, \`spawn(\`, \`child_process\`, \`os.system\`
  - Check: Input sanitization before shell commands
- NoSQL Injection: Unvalidated input in database queries
  - Search: Mongo queries without sanitization, JSON parsing
- LDAP/XPATH/other injection types

**A04:2021 - Insecure Design**
- Missing validation on business logic
- Trust boundaries not enforced

Reference: https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html`,
      owaspTopics: ['Input Validation'],
    },
    {
      id: 'check-authentication-authorization',
      title: 'Authentication and Authorization Review',
      instructions: `Check authn/authz implementations:

**A01:2021 - Broken Access Control** (continued)
- Missing authentication on sensitive endpoints
- CORS misconfigurations
- Missing security headers (check middleware)

**A02:2021 - Cryptographic Failures** (formerly Sensitive Data Exposure)
- Passwords stored without proper hashing (should be bcrypt/argon2)
- Sensitive data in transit (missing HTTPS enforcement)
- Sensitive data at rest (encryption)

**A07:2021 - Identification and Authentication Failures**
- Weak password policies
- Session management issues
- Missing multi-factor authentication for sensitive ops
- JWT handling issues (none algorithm, missing validation)

Search patterns:
- Auth middleware: \`authenticate\`, \`requireAuth\`, \`@Protected\`
- Password hashing: \`bcrypt\`, \`argon2\`, \`pbkdf2\`
- Session handling: \`session\`, \`jwt\`, \`token\`
- Authorization checks: \`can?\`, \`isAuthorized\`, \`hasPermission\`

Reference: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
Reference: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html`,
      owaspTopics: ['Authentication', 'Authorization'],
    },
    {
      id: 'check-output-encoding-xss',
      title: 'Output Encoding and XSS Review',
      instructions: `Check for XSS and output encoding issues:

**A03:2021 - Injection** (XSS)
- Reflected XSS: User input reflected without encoding
- Stored XSS: User input stored and displayed without encoding
- DOM XSS: Unsafe manipulation of DOM with user input

Search patterns:
- Template rendering with user input
- \`innerHTML\`, \`dangerouslySetInnerHTML\`, \`v-html\`
- User input in: URLs, attributes, JavaScript contexts
- Missing Content-Security-Policy headers

For each finding:
- Context: HTML body, attribute, URL, JavaScript, CSS
- Encoding needed: HTML entity, URL, JavaScript, CSS
- OWASP XSS Prevention Cheat Sheet reference

Reference: https://cheatsheetseries.owasp.org/cheatsheets/Cross_Scripting_Prevention_Cheat_Sheet.html`,
      owaspTopics: ['Output Encoding'],
    },
    {
      id: 'check-secrets-management',
      title: 'Secrets Management Review',
      instructions: `Check for secrets exposure:

**A05:2021 - Security Misconfiguration**
- Hardcoded secrets in source code
- Secrets in config files committed to repo
- API keys, tokens, passwords in code

Search patterns:
- Words: \`password\`, \`secret\`, \`api_key\`, \`apikey\`, \`token\`, \`credential\`
- Patterns: Base64-like strings, JWT-like strings
- Files: \`.env\`, \`config/*.js\`, \`secrets.*\`
- Common services: AWS, Google, Azure, Stripe, Twilio, SendGrid

For each secret found:
- Type of secret (API key, password, certificate, etc.)
- Location (file path, line number)
- Risk level (production vs development, public vs private repo)
- Recommendation: Use environment variables, secret managers

Reference: https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html`,
      owaspTopics: ['Secrets Management'],
    },
    {
      id: 'check-dependency-vulnerabilities',
      title: 'Dependency Security Review',
      instructions: `Check for vulnerable dependencies:

**A08:2021 - Software and Data Integrity Failures**
- Known vulnerabilities in dependencies
- Outdated packages with security issues
- Unsigned or unverified dependencies

Using the dependency map:
1. Check each dependency against known CVE databases
2. Look for outdated versions with known fixes
3. Check for transitive dependencies with issues
4. Verify integrity hashes where used

Document:
- Dependency name and current version
- Known CVEs (if any)
- Available secure versions
- Remediation path

Reference: https://cheatsheetseries.owasp.org/cheatsheets/Dependency_Check_Cheat_Sheet.html`,
      owaspTopics: ['ASVS'],
    },
    {
      id: 'check-configuration',
      title: 'Configuration Security Review',
      instructions: `Check for security misconfigurations:

**A05:2021 - Security Misconfiguration**
- Default accounts/passwords still enabled
- Directory listing enabled
- Verbose error messages
- Missing security headers
- CORS misconfiguration
- Debug mode enabled in production

Check files:
- Server configs: nginx.conf, apache2.conf, web.config
- App configs: appsettings.json, application.properties, .env
- Framework configs: middleware setup, security headers
- Cloud configs: AWS Security Groups, Azure NSGs, GCP firewalls

Security headers to check:
- Content-Security-Policy
- X-Frame-Options / X-Content-Type-Options
- Strict-Transport-Security
- Permissions-Policy
- X-XSS-Protection (legacy but still check)

Document each misconfiguration with file location and fix.`,
      owaspTopics: ['ASVS'],
    },
    {
      id: 'check-logging-auditing',
      title: 'Logging and Auditing Review',
      instructions: `Check logging and audit trail implementation:

**A09:2021 - Security Logging and Monitoring Failures**
- Insufficient logging of security events
- Missing audit trails for sensitive operations
- Logs not protected against tampering
- Sensitive data in logs (passwords, tokens, PII)
- No alerting on suspicious events

Key events that should be logged:
- Authentication successes and failures
- Authorization failures
- Sensitive data access
- Administrative actions
- Configuration changes
- Input validation failures

Search patterns:
- Log calls: \`console.log\`, \`logger.info\`, \`log.\`, \`winston\`
- Check what's being logged
- Check log level configuration
- Check if logs are protected/encrypted

Reference: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Vocabulary_Cheat_Sheet.html`,
      owaspTopics: ['Logging'],
    },
    {
      id: 'check-ai-agent-safety',
      title: 'AI Agent and Tool Safety Review',
      instructions: `Check for AI/ML security issues:

**AI Agent Security**
- Tool/function calling without proper authorization
- Prompt injection vulnerabilities
- Unrestricted tool access
- Missing output validation on AI responses
- Data leakage through AI context

Check:
- Are AI tool calls authorized per user?
- Can users manipulate AI to bypass controls?
- Is AI output validated before use?
- Are sensitive operations protected from AI delegation?

Reference: https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html`,
      owaspTopics: ['AI Agent Security'],
    },
    {
      id: 'compile-findings',
      title: 'Compile and Prioritize Findings',
      instructions: `Compile all findings into a structured report:

For each finding, document:
1. **Title** - Brief description
2. **Severity** - Critical/High/Medium/Low (based on CVSS-like scoring)
3. **OWASP Category** - Top 10 mapping (A01-A10:2021)
4. **ASVS Reference** - Relevant ASVS control
5. **Location** - File path and line number
6. **Evidence** - Code snippet demonstrating the issue
7. **Impact** - What could happen if exploited
8. **Remediation** - How to fix
9. **References** - OWASP cheat sheet links

Prioritization matrix:
- Critical + Exploitable = Fix immediately
- High + Likely = Fix this sprint
- Medium = Fix next sprint
- Low = Backlog

Create OWASP mapping showing coverage:
- Which Top 10 categories are represented
- Category with most findings
- Categories with no findings (may need deeper review)

Output as structured JSON for downstream workflows.`,
      owaspTopics: ['Secure Code Review', 'ASVS'],
    },
  ],
  guardrails: [
    {
      type: 'preflight',
      description: 'Verify map-codebase artifacts exist before starting',
      condition: 'Check for codebase-inventory and dependency-map',
    },
    {
      type: 'scope',
      description: 'Limit audit depth based on available time and user preferences',
      condition: 'Ask user about audit scope (quick vs comprehensive)',
    },
    {
      type: 'approval',
      description: 'Pause on sensitive findings that may require immediate action',
      condition: 'If Critical severity findings found, notify user immediately',
    },
    {
      type: 'mutation',
      description: 'This workflow is read-only - do not fix issues found',
      condition: 'Never write code fixes during audit',
    },
  ],
  runtimePrompts: {
    claude: `When conducting the security audit:

- Be thorough and systematic - don't skip categories
- Use Grep strategically to find vulnerability patterns
- Read actual source files to confirm issues (avoid false positives)
- Document findings with file paths and line numbers
- Include code snippets as evidence
- Map each finding to OWASP Top 10 categories
- Prioritize by severity and exploitability
- Reference OWASP cheat sheets for remediation guidance

## Delegation to Specialists

When you detect a security issue, delegate to the appropriate OWASP specialist:

1. **Password handling** → delegate to \`gss-specialist-password-storage\`
2. **SQL injection** → delegate to \`gss-specialist-sql-injection-prevention\` and \`gss-specialist-query-parameterization\`
3. **XSS** → delegate to \`gss-specialist-cross-site-scripting-prevention\`
4. **Command injection** → delegate to \`gss-specialist-os-command-injection-defense\`
5. **Auth/session issues** → delegate to \`gss-specialist-authentication\`, \`gss-specialist-authorization\`, \`gss-specialist-session-management\`
6. **Secrets exposure** → delegate to \`gss-specialist-secrets-management\`
7. **Crypto issues** → delegate to \`gss-specialist-cryptographic-storage\`
8. **File upload** → delegate to \`gss-specialist-file-upload\`
9. **Deserialization** → delegate to \`gss-specialist-deserialization\`
10. **SSRF** → delegate to \`gss-specialist-server-side-request-forgery-prevention\`
11. **XXE** → delegate to \`gss-specialist-xml-external-entity-prevention\`
12. **CSRF** → delegate to \`gss-specialist-cross-site-request-forgery-prevention\`

### Stack-Conditioned Specialists

When the codebase uses specific frameworks, also delegate to:
- **Django** → \`gss-specialist-django-security\`, \`gss-specialist-django-rest-framework\`
- **Laravel** → \`gss-specialist-laravel\`
- **Node.js** → \`gss-specialist-nodejs-security\`
- **Rails** → \`gss-specialist-ruby-on-rails\`
- **Symfony** → \`gss-specialist-symfony\`
- **Java** → \`gss-specialist-java-security\`, \`gss-specialist-injection-prevention-in-java\`
- **.NET** → \`gss-specialist-dotnet-security\`

### Specialist Output Format

Each specialist should return:
- \`verdict\`: pass/fail/needs-review
- \`confidence\`: 0-1 score
- \`evidence\`: code snippets or configuration
- \`affectedFiles\`: files and line numbers
- \`remediationNotes\`: specific fix recommendations
- \`verificationNotes\`: how to verify the fix
- \`owaspSourceUrl\`: governing cheat sheet URL

### Aggregating Specialist Verdicts

After delegating to specialists:
1. Collect all specialist verdicts
2. Merge overlapping findings
3. Prioritize by severity and confidence
4. Generate a consolidated findings report

Output artifacts to .gss/artifacts/audit/ for use by plan-remediation and report workflows.`,
    codex: `Conduct a comprehensive security audit:

1. Review codebase mapping artifacts
2. Apply OWASP Top 10 categories systematically
3. Search for common vulnerability patterns
4. Validate findings with source code review
5. Document evidence and remediation steps

## Delegation

When you detect specific vulnerability types, consult the corresponding OWASP specialist for detailed guidance. Specialists provide verdicts structured as: verdict, confidence, evidence, affectedFiles, remediationNotes, verificationNotes, and owaspSourceUrl.

Ground all findings in OWASP standards and cheat sheets.`,
  },
  delegationPolicy: {
    mode: 'on-detection',
    subjectSource: 'finding clusters and vulnerability classes',
    constraints: {
      maxRequiredPerSubject: 3,
      maxOptionalPerSubject: 3,
      allowFollowUpSpecialists: true,
      maxFollowUpDepth: 1,
      failOnMissingRequired: true,
      allowOutOfPlanConsults: false,
    },
  },
};
