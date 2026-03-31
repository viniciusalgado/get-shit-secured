/**
 * Stack Normalizer
 *
 * Normalizes raw stack signals from map-codebase artifacts or runtime
 * detection into canonical stack tags used by specialist bindings.
 */

/**
 * Canonical stack tag mapping.
 * Maps raw detection values to the canonical tags used in
 * WorkflowSpecialistBinding.stackConditionedSpecialists.
 */
const STACK_ALIASES: Record<string, string> = {
  // JavaScript/TypeScript ecosystem
  'node.js': 'nodejs',
  'nodejs': 'nodejs',
  'node': 'nodejs',
  'typescript': 'javascript',
  'ts': 'javascript',
  'js': 'javascript',
  'javascript': 'javascript',

  // Python ecosystem
  'python': 'python',
  'py': 'python',
  'django': 'django',
  'flask': 'python',
  'fastapi': 'python',

  // Ruby ecosystem
  'ruby': 'ruby',
  'rails': 'rails',
  'ruby-on-rails': 'rails',

  // Java ecosystem
  'java': 'java',
  'spring': 'java',
  'spring-boot': 'java',

  // .NET ecosystem
  'c#': 'csharp',
  'csharp': 'csharp',
  '.net': 'dotnet',
  'dotnet': 'dotnet',
  'asp.net': 'dotnet',

  // PHP ecosystem
  'php': 'php',
  'laravel': 'laravel',
  'symfony': 'symfony',

  // Container/infrastructure
  'docker': 'docker',
  'dockerfile': 'docker',
  'kubernetes': 'kubernetes',
  'k8s': 'kubernetes',
  'helm': 'kubernetes',

  // Cloud/serverless
  'aws': 'aws',
  'aws-lambda': 'aws-lambda',
  'lambda': 'aws-lambda',
  'serverless': 'serverless',
  'faas': 'faas',
  'azure': 'azure',
  'gcp': 'gcp',

  // IaC
  'terraform': 'terraform',
  'cloudformation': 'cloudformation',
  'ansible': 'iac',
  'pulumi': 'terraform',

  // API technologies
  'graphql': 'graphql',
  'rest': 'rest',
  'api': 'rest',
  'grpc': 'grpc',
  'soap': 'soap',

  // Databases
  'mongodb': 'mongodb',
  'postgres': 'sql',
  'postgresql': 'sql',
  'mysql': 'sql',
  'sqlite': 'sql',
  'mssql': 'sql',
  'redis': 'redis',
  'elasticsearch': 'elasticsearch',
};

/**
 * Result of stack normalization.
 */
export interface NormalizedStack {
  /** Original raw values */
  raw: string[];
  /** Canonical stack tags (deduplicated, lowercase) */
  canonical: string[];
}

/**
 * Normalize raw stack signals into canonical tags.
 *
 * @param rawSignals - Raw stack signals from detection or artifacts
 * @returns Normalized stack with both raw and canonical values
 */
export function normalizeStack(rawSignals: string[]): NormalizedStack {
  const canonical = new Set<string>();

  for (const signal of rawSignals) {
    const key = signal.toLowerCase().trim();
    if (key === '') continue;

    const mapped = STACK_ALIASES[key];
    if (mapped) {
      canonical.add(mapped);
    } else {
      // Pass through unknown signals as-is (lowercased)
      canonical.add(key);
    }
  }

  // Deterministic ordering: sort alphabetically
  return {
    raw: [...rawSignals],
    canonical: [...canonical].sort(),
  };
}

/**
 * Get all known canonical stack tags.
 * Useful for validation and testing.
 */
export function getKnownCanonicalTags(): string[] {
  const tags = new Set<string>();
  for (const alias of Object.values(STACK_ALIASES)) {
    tags.add(alias);
  }
  return [...tags].sort();
}
