/**
 * diff-artifacts CLI command.
 *
 * Compares two GSS artifact files and reports consultation coverage differences.
 *
 * Usage:
 *   gss diff-artifacts --a <fileA> --b <fileB>
 *
 * @module cli/diff-artifacts
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compareArtifactTraces, type ArtifactTraceDiff } from '../runtime/artifact-diff.js';
import { validateArtifactEnvelope } from '../runtime/artifact-envelope-validator.js';
import type { ArtifactEnvelope } from '../core/types.js';

/**
 * Parse --a and --b flags from arguments.
 */
function parseDiffArgs(args: string[]): { a: string | null; b: string | null } {
  let a: string | null = null;
  let b: string | null = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--a' && i + 1 < args.length) {
      a = args[i + 1];
      i++;
    } else if (args[i] === '--b' && i + 1 < args.length) {
      b = args[i + 1];
      i++;
    }
  }
  return { a, b };
}

/**
 * Load and parse a JSON artifact file.
 */
function loadArtifact(filePath: string): Record<string, unknown> {
  const resolved = resolve(filePath);
  const content = readFileSync(resolved, 'utf-8');
  return JSON.parse(content) as Record<string, unknown>;
}

/**
 * Run the diff-artifacts CLI command.
 *
 * @param args - CLI arguments (after 'diff-artifacts')
 * @returns Exit code
 */
export async function diffArtifacts(args: string[]): Promise<number> {
  const { a, b } = parseDiffArgs(args);

  if (!a || !b) {
    console.error('Usage: gss diff-artifacts --a <artifact-a.json> --b <artifact-b.json>');
    return 1;
  }

  let artifactA: Record<string, unknown>;
  let artifactB: Record<string, unknown>;

  try {
    artifactA = loadArtifact(a);
  } catch (err) {
    console.error(`Error reading artifact A (${a}): ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }

  try {
    artifactB = loadArtifact(b);
  } catch (err) {
    console.error(`Error reading artifact B (${b}): ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }

  // Validate both envelopes
  const validationA = validateArtifactEnvelope(artifactA);
  const validationB = validateArtifactEnvelope(artifactB);

  if (!validationA.valid) {
    console.error('Artifact A validation errors:');
    for (const e of validationA.errors) {
      console.error(`  - ${e}`);
    }
  }
  if (!validationB.valid) {
    console.error('Artifact B validation errors:');
    for (const e of validationB.errors) {
      console.error(`  - ${e}`);
    }
  }

  // Compare traces
  const diff: ArtifactTraceDiff = compareArtifactTraces(
    artifactA as unknown as ArtifactEnvelope,
    artifactB as unknown as ArtifactEnvelope
  );

  // Output
  console.log('Artifact Trace Comparison');
  console.log('========================');
  console.log(`  A: ${a}`);
  console.log(`  B: ${b}`);
  console.log();
  console.log(`  A coverage status: ${diff.aStatus}`);
  console.log(`  B coverage status: ${diff.bStatus}`);
  console.log(`  Coverage delta:    ${diff.coverageDelta > 0 ? '+' : ''}${diff.coverageDelta}`);
  console.log();
  console.log(`  Docs in A only:    ${diff.docsInAOnly.length > 0 ? diff.docsInAOnly.join(', ') : 'none'}`);
  console.log(`  Docs in B only:    ${diff.docsInBOnly.length > 0 ? diff.docsInBOnly.join(', ') : 'none'}`);
  console.log(`  Docs in both:      ${diff.docsInBoth.length > 0 ? diff.docsInBoth.join(', ') : 'none'}`);
  console.log();
  if (diff.requiredMissingA.length > 0) {
    console.log(`  Required missing in A: ${diff.requiredMissingA.join(', ')}`);
  }
  if (diff.requiredMissingB.length > 0) {
    console.log(`  Required missing in B: ${diff.requiredMissingB.join(', ')}`);
  }

  // Warnings
  for (const w of validationA.warnings) {
    console.warn(`  Warning (A): ${w}`);
  }
  for (const w of validationB.warnings) {
    console.warn(`  Warning (B): ${w}`);
  }

  return 0;
}
