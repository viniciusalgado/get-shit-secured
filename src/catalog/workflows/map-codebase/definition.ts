import type { WorkflowDefinition } from '../../../core/types.js';

/**
 * Map Codebase workflow definition.
 * Grounded in OWASP Attack Surface Analysis and Authentication/Authorization topics.
 */
export const mapCodebaseDefinition: WorkflowDefinition = {
  id: 'map-codebase',
  title: 'Map Codebase for Security Analysis',
  goal: 'Identify components, data flows, trust boundaries, dependencies, and external services to establish a foundation for all security workflows.',
  owaspTopics: [
    {
      name: 'Attack Surface Analysis',
      glossaryUrl: 'https://cheatsheetseries.owasp.org/Glossary.html',
      cheatSheetUrls: [
        'https://cheatsheetseries.owasp.org/cheatsheets/Attack_Surface_Analysis_Cheat_Sheet.html',
      ],
    },
    {
      name: 'Authentication',
      glossaryUrl: 'https://cheatsheetseries.owasp.org/Glossary.html',
      cheatSheetUrls: [
        'https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html',
      ],
    },
    {
      name: 'Authorization',
      glossaryUrl: 'https://cheatsheetseries.owasp.org/Glossary.html',
      cheatSheetUrls: [
        'https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html',
      ],
    },
    {
      name: 'Access Control',
      glossaryUrl: 'https://cheatsheetseries.owasp.org/Glossary.html',
      cheatSheetUrls: [
        'https://cheatsheetseries.owasp.org/cheatsheets/Access_Control_Cheat_Sheet.html',
      ],
    },
  ],
  inputs: [
    {
      name: 'codebase',
      type: 'source code',
      required: true,
      description: 'The project source code to analyze',
    },
    {
      name: 'build configuration',
      type: 'config files',
      required: false,
      description: 'Build files (package.json, requirements.txt, etc.) for dependency analysis',
    },
  ],
  outputs: [
    {
      name: 'codebase-inventory',
      type: 'json',
      description: 'Complete inventory of components, modules, and their purposes',
      path: '.gss/artifacts/map-codebase/inventory.json',
    },
    {
      name: 'trust-boundary-map',
      type: 'diagram',
      description: 'Diagram showing trust boundaries and authentication/authorization zones',
      path: '.gss/artifacts/map-codebase/trust-boundaries.md',
    },
    {
      name: 'dependency-map',
      type: 'json',
      description: 'External dependencies and services with security relevance',
      path: '.gss/artifacts/map-codebase/dependencies.json',
    },
    {
      name: 'data-flow-map',
      type: 'diagram',
      description: 'Data flows between components and across trust boundaries',
      path: '.gss/artifacts/map-codebase/data-flows.md',
    },
  ],
  dependencies: [],
  handoffs: [
    {
      nextWorkflow: 'threat-model',
      outputsToPass: ['codebase-inventory', 'trust-boundary-map', 'data-flow-map'],
    },
    {
      nextWorkflow: 'audit',
      outputsToPass: ['codebase-inventory', 'dependency-map'],
    },
  ],
  steps: [
    {
      id: 'identify-components',
      title: 'Identify Application Components',
      instructions: `Analyze the codebase structure to identify:

1. **Main application entry points** - how the application starts
2. **Modules/packages** - major functional units and their responsibilities
3. **API endpoints** - all REST, GraphQL, RPC, or other interfaces
4. **Background jobs/workers** - asynchronous processing components
5. **Data stores** - databases, caches, message queues
6. **External service integrations** - third-party APIs, CDNs, auth providers

For each component, document:
- File location(s)
- Primary function/purpose
- Programming language/framework
- Entry points and interfaces

Use Glob to find route handlers, controller files, and API definitions. Look for patterns like:
- \`routes/**/*\`
- \`controllers/**/*\`
- \`api/**/*\`
- \`handlers/**/*\``,
      owaspTopics: ['Attack Surface Analysis'],
    },
    {
      id: 'map-trust-boundaries',
      title: 'Map Trust Boundaries',
      instructions: `Identify and document trust boundaries:

1. **Authentication boundaries** - where unauthenticated users become authenticated
   - Login/logout flows
   - Token validation points
   - Session management

2. **Authorization boundaries** - where permissions are checked
   - Role-based access control points
   - Permission checks in controllers
   - Admin vs user vs public access zones

3. **Network boundaries** - where data crosses trust zones
   - External API calls
   - Third-party service integrations
   - Public internet vs internal services

4. **Data sensitivity boundaries** - where data classification changes
   - PII/personal data handling
   - Secrets/credential handling
   - Encryption/decryption points

Create a diagram showing:
- Components grouped by trust zone
- Arrows showing data crossing boundaries
- Where authentication/authorization occurs

Reference: https://cheatsheetseries.owasp.org/cheatsheets/Attack_Surface_Analysis_Cheat_Sheet.html`,
      owaspTopics: ['Authentication', 'Authorization', 'Access Control'],
    },
    {
      id: 'catalog-dependencies',
      title: 'Catalog Dependencies and External Services',
      instructions: `Identify all external dependencies:

1. **Direct dependencies** from package managers:
   - npm/yarn: check package.json, package-lock.json, yarn.lock
   - Python: requirements.txt, pyproject.toml, Pipfile
   - Other: Gemfile, go.mod, Cargo.toml, pom.xml

2. **External services called**:
   - Database connections
   - Cloud service APIs (AWS, GCP, Azure)
   - Payment processors
   - Email/SMS services
   - Analytics/monitoring services
   - CDN/storage services

3. **Runtime dependencies**:
   - Framework versions
   - Server/runtime versions
   - OS-level dependencies

For each dependency, document:
- Name and version
- Purpose (why it's needed)
- Known vulnerabilities (check common CVEs)
- Security sensitivity (does it handle auth, data, secrets?)

Reference: https://cheatsheetseries.owasp.org/cheatsheets/Dependency_Check_Cheat_Sheet.html`,
      owaspTopics: ['Attack Surface Analysis'],
    },
    {
      id: 'map-data-flows',
      title: 'Map Data Flows',
      instructions: `Trace how data flows through the application:

1. **User input flows** - from request to processing to storage
2. **Authentication data flows** - credentials, tokens, sessions
3. **Authorization data flows** - permissions, roles, ACL checks
4. **Sensitive data flows** - PII, secrets, payment data
5. **External API flows** - requests to and from third parties

For each data flow, document:
- Entry point (where data enters)
- Processing steps (transformations, validations)
- Storage locations (databases, caches)
- Exit points (where data leaves the system)
- Trust boundary crossings

Create a flow diagram showing:
- Components as nodes
- Data flows as labeled edges
- Trust zones highlighted

This will inform threat modeling and audit prioritization.`,
      owaspTopics: ['Attack Surface Analysis'],
    },
  ],
  guardrails: [
    {
      type: 'preflight',
      description: 'Verify codebase is accessible and readable before starting analysis',
      condition: 'Before running steps, check that source files can be read',
    },
    {
      type: 'scope',
      description: 'Avoid analyzing generated files, build artifacts, or node_modules',
      condition: 'Exclude common build/cache directories from analysis',
    },
    {
      type: 'mutation',
      description: 'This workflow is read-only - do not make any code changes',
      condition: 'Never write, modify, or delete files during mapping',
    },
  ],
  runtimePrompts: {
    claude: `When analyzing this codebase:

- Use Glob and Grep extensively to find patterns
- Read actual source files to understand implementations
- Focus on security-relevant code (auth, input handling, data access)
- Document assumptions and uncertainties
- Prefer analysis over recommendations in this phase

Output artifacts to .gss/artifacts/map-codebase/ for use by subsequent workflows.`,
    codex: `Analyze the codebase structure systematically:

1. Scan for common patterns in the codebase
2. Map component relationships and dependencies
3. Identify trust boundaries and security zones
4. Document findings as structured artifacts

Focus on understanding before evaluating.`,
  },
  delegationPolicy: {
    mode: 'artifact-driven',
    subjectSource: 'architecture domains and detected stack segments',
    constraints: {
      maxRequiredPerSubject: 3,
      maxOptionalPerSubject: 2,
      allowFollowUpSpecialists: true,
      maxFollowUpDepth: 1,
      failOnMissingRequired: false,
      allowOutOfPlanConsults: false,
    },
  },
};
