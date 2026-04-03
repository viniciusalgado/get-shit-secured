#!/usr/bin/env node

/**
 * Import Boundary Audit Script
 *
 * Scans all .ts files in src/ and checks import statements against
 * the boundary rules defined in src/MODULE_MAP.md.
 *
 * Boundary classification:
 *   - Knowledge (C): consultation-*, stack-normalizer, issue-taxonomy,
 *     delegation-*, specialist-generator, owasp-ingestion, corpus/*,
 *     mcp/*, runtime/*
 *   - Workflow (A): catalog/workflows/*, renderer, runtimes/*
 *   - Role (B): catalog/roles/*
 *   - Installer (D): installer, install-stages, manifest, paths,
 *     install/*, cli/*
 *   - Artifact (E): hooks/*
 *   - Cross-cutting: types.ts
 *   - Compatibility: compatibility/*
 *
 * Rules:
 *   1. Knowledge (C) must NOT import from Workflow (A) or Role (B)
 *   2. Workflow (A) must NOT import Knowledge (C) directly
 *   3. Role (B) must NOT import Knowledge (C) directly
 *   4. Installer (D) may import from all boundaries (integrator)
 *   5. Artifact (E) may import types from all boundaries
 *   6. Compatibility may import from Knowledge (C) legacy modules only
 *   7. types.ts is cross-cutting; imports from it are always allowed
 *
 * Exit codes:
 *   0 - No violations found
 *   1 - Violations found
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const SRC = join(ROOT, 'src');

// --- Boundary Classification ---

/**
 * Classify a file path into its boundary owner.
 * Returns the boundary ID or null for cross-cutting files.
 */
function classifyBoundary(filePath) {
  const rel = relative(SRC, filePath).replace(/\\/g, '/');

  // Cross-cutting
  if (rel === 'core/types.ts') return 'cross-cutting';

  // Compatibility
  if (rel.startsWith('compatibility/')) return 'compatibility';

  // Knowledge (C)
  if (rel.startsWith('corpus/')) return 'C';
  if (rel.startsWith('mcp/')) return 'C';
  if (rel.startsWith('runtime/')) return 'C';
  if (rel.startsWith('core/consultation-')) return 'C';
  if (rel.startsWith('core/stack-normalizer.')) return 'C';
  if (rel.startsWith('core/issue-taxonomy.')) return 'C';
  if (rel.startsWith('core/delegation-')) return 'C';
  if (rel.startsWith('core/specialist-generator.')) return 'C';
  if (rel.startsWith('core/owasp-ingestion.')) return 'C';
  if (rel.startsWith('catalog/specialists/')) return 'C';

  // Workflow (A)
  if (rel.startsWith('catalog/workflows/')) return 'A';
  if (rel.startsWith('core/renderer.')) return 'A';
  if (rel.startsWith('runtimes/')) return 'A';

  // Role (B)
  if (rel.startsWith('catalog/roles/')) return 'B';

  // Installer (D)
  if (rel.startsWith('core/installer.')) return 'D';
  if (rel.startsWith('core/install-stages.')) return 'D';
  if (rel.startsWith('core/manifest.')) return 'D';
  if (rel.startsWith('core/paths.')) return 'D';
  if (rel.startsWith('install/')) return 'D';
  if (rel.startsWith('cli/')) return 'D';

  // Artifact (E)
  if (rel.startsWith('hooks/')) return 'E';

  return 'unknown';
}

/**
 * Classify the target of an import path.
 */
function classifyImportTarget(importPath, fromFile) {
  // External packages are always allowed
  if (!importPath.startsWith('.')) return 'external';

  // Resolve relative import to absolute
  const fromDir = fromFile.substring(0, fromFile.lastIndexOf('/'));
  const parts = importPath.split('/');
  const resolved = [];

  const fromParts = fromDir.split('/');
  for (const part of parts) {
    if (part === '..') {
      fromParts.pop();
    } else if (part !== '.') {
      resolved.push(part);
    }
  }

  const relPath = [...fromParts, ...resolved].join('/').replace(/\\/g, '/');
  const srcPrefix = relative(ROOT, SRC).replace(/\\/g, '/') + '/';
  const normalized = relPath.startsWith(srcPrefix)
    ? relPath.substring(srcPrefix.length)
    : relPath.replace(new RegExp(`^${srcPrefix}`), '');

  // Cross-cutting
  if (normalized === 'core/types.ts' || normalized === 'core/types.js') return 'cross-cutting';

  // Knowledge (C)
  if (normalized.startsWith('corpus/')) return 'C';
  if (normalized.startsWith('mcp/')) return 'C';
  if (normalized.startsWith('runtime/')) return 'C';
  if (normalized.startsWith('core/consultation-')) return 'C';
  if (normalized.startsWith('core/stack-normalizer.')) return 'C';
  if (normalized.startsWith('core/issue-taxonomy.')) return 'C';
  if (normalized.startsWith('core/delegation-')) return 'C';
  if (normalized.startsWith('core/specialist-generator.')) return 'C';
  if (normalized.startsWith('core/owasp-ingestion.')) return 'C';
  if (normalized.startsWith('catalog/specialists/')) return 'C';

  // Workflow (A)
  if (normalized.startsWith('catalog/workflows/')) return 'A';
  if (normalized.startsWith('core/renderer.')) return 'A';
  if (normalized.startsWith('runtimes/')) return 'A';

  // Role (B)
  if (normalized.startsWith('catalog/roles/')) return 'B';

  // Installer (D)
  if (normalized.startsWith('core/installer.')) return 'D';
  if (normalized.startsWith('core/install-stages.')) return 'D';
  if (normalized.startsWith('core/manifest.')) return 'D';
  if (normalized.startsWith('core/paths.')) return 'D';
  if (normalized.startsWith('install/')) return 'D';
  if (normalized.startsWith('cli/')) return 'D';

  // Artifact (E)
  if (normalized.startsWith('hooks/')) return 'E';

  // Compatibility
  if (normalized.startsWith('compatibility/')) return 'compatibility';

  return 'unknown';
}

// --- Import Extraction ---

/**
 * Extract all import paths from a TypeScript file.
 */
function extractImports(content) {
  const imports = [];
  const importRegex = /import\s+(?:type\s+)?(?:[^'"]*\s+from\s+)?['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  return imports;
}

// --- File Discovery ---

function* walkDir(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkDir(fullPath);
    } else if (entry.name.endsWith('.ts')) {
      yield fullPath;
    }
  }
}

// --- Violation Check ---

/**
 * Known acceptable cross-boundary imports.
 * These are documented in MODULE_MAP.md as acceptable.
 */
const KNOWN_ACCEPTABLE = [
  // Same boundary imports are always allowed
  { from: 'A', target: 'A', description: 'Same boundary (Workflow)' },
  { from: 'B', target: 'B', description: 'Same boundary (Role)' },
  { from: 'C', target: 'C', description: 'Same boundary (Knowledge)' },
  { from: 'D', target: 'D', description: 'Same boundary (Installer)' },
  { from: 'E', target: 'E', description: 'Same boundary (Artifact)' },
  // Installer (D) is the integrator — may import from all boundaries
  { from: 'D', target: 'C', description: 'Installer is the integrator' },
  { from: 'D', target: 'A', description: 'Installer is the integrator' },
  { from: 'D', target: 'B', description: 'Installer is the integrator (renders roles)' },
  { from: 'D', target: 'compatibility', description: 'Installer imports from legacy facade' },
  // Artifact (E) may import types from all boundaries
  { from: 'E', target: 'C', description: 'Artifact validation needs knowledge types' },
  { from: 'E', target: 'A', description: 'Artifact validation needs workflow types' },
  // Compatibility importing from Knowledge (C) — facade re-exports legacy modules
  { from: 'compatibility', target: 'C', description: 'Facade re-exports legacy knowledge modules' },
  // Workflow (A) cross-boundary: adapters need path resolution, role rendering, hooks
  { from: 'A', target: 'D', description: 'Adapters need path resolution' },
  { from: 'A', target: 'B', description: 'Adapters render role definitions' },
  { from: 'A', target: 'E', description: 'Adapters reference hook validators' },
  // Cross-cutting is always allowed
  { from: '*', target: 'cross-cutting', description: 'types.ts is cross-cutting' },
  { from: 'cross-cutting', target: '*', description: 'types.ts may import from anywhere' },
  // External packages are always allowed
  { from: '*', target: 'external', description: 'External packages' },
];

function isKnownAcceptable(fromBoundary, targetBoundary) {
  return KNOWN_ACCEPTABLE.some(rule =>
    (rule.from === fromBoundary || rule.from === '*') &&
    (rule.target === targetBoundary || rule.target === '*')
  );
}

/**
 * Check if an import violates boundary rules.
 * Returns null if OK, or a description of the violation.
 */
function checkViolation(fromBoundary, targetBoundary) {
  if (isKnownAcceptable(fromBoundary, targetBoundary)) {
    return null;
  }

  const violations = {
    'C->A': 'Knowledge must not import from Workflow',
    'C->B': 'Knowledge must not import from Role',
    'C->D': 'Knowledge must not import from Installer',
    'C->E': 'Knowledge must not import from Artifact',
    'A->C': 'Workflow must not import Knowledge directly (use MCP)',
    'A->B': 'Workflow should not import Role directly',
    'B->C': 'Role must not import Knowledge directly (use MCP)',
    'B->A': 'Role must not import Workflow directly',
    'B->D': 'Role must not import Installer',
    'E->B': 'Artifact should not import Role',
    'E->D': 'Artifact should not import Installer',
  };

  const key = `${fromBoundary}->${targetBoundary}`;
  return violations[key] || `Unexpected import from ${fromBoundary} to ${targetBoundary}`;
}

// --- Main ---

console.log('Import Boundary Audit');
console.log('=====================\n');

const violations = [];
let filesChecked = 0;
let importsChecked = 0;

for (const filePath of walkDir(SRC)) {
  const relPath = relative(ROOT, filePath);
  const content = readFileSync(filePath, 'utf-8');
  const fromBoundary = classifyBoundary(filePath);

  if (fromBoundary === 'unknown') {
    console.log(`  [WARN] Unclassified file: ${relPath}`);
    continue;
  }

  const imports = extractImports(content);
  filesChecked++;

  for (const importPath of imports) {
    importsChecked++;
    const targetBoundary = classifyImportTarget(importPath, relPath);

    if (targetBoundary === 'external' || targetBoundary === 'cross-cutting') {
      continue;
    }

    if (targetBoundary === 'unknown') {
      // Could not classify — skip silently for .js extensions etc.
      continue;
    }

    const violation = checkViolation(fromBoundary, targetBoundary);
    if (violation) {
      violations.push({
        file: relPath,
        import: importPath,
        fromBoundary,
        targetBoundary,
        message: violation,
      });
    }
  }
}

console.log(`Files checked: ${filesChecked}`);
console.log(`Imports checked: ${importsChecked}`);
console.log(`Violations: ${violations.length}\n`);

if (violations.length > 0) {
  console.log('VIOLATIONS FOUND:');
  console.log('=================\n');
  for (const v of violations) {
    console.log(`  ${v.file}`);
    console.log(`    Import: ${v.import}`);
    console.log(`    Boundary: ${v.fromBoundary} -> ${v.targetBoundary}`);
    console.log(`    Rule: ${v.message}`);
    console.log('');
  }
  process.exit(1);
} else {
  console.log('No boundary violations found. All imports comply with boundary rules.');
  process.exit(0);
}
