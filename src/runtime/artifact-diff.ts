/**
 * Artifact trace comparison.
 *
 * Compares two ArtifactEnvelope objects and surfaces consultation
 * coverage differences. Useful for rollout comparison (hybrid-shadow mode).
 *
 * @module runtime/artifact-diff
 */

import type { ArtifactEnvelope } from '../core/types.js';

/** Status for an artifact that has no consultation trace */
type CoverageOrNone = 'pass' | 'warn' | 'fail' | 'none';

/** Result of comparing two artifact envelopes */
export interface ArtifactTraceDiff {
  /** Difference in coverage score (positive = A superior) */
  coverageDelta: number;
  /** Coverage status of artifact A */
  aStatus: CoverageOrNone;
  /** Coverage status of artifact B */
  bStatus: CoverageOrNone;
  /** Doc IDs present in A but not B */
  docsInAOnly: string[];
  /** Doc IDs present in B but not A */
  docsInBOnly: string[];
  /** Doc IDs present in both */
  docsInBoth: string[];
  /** Required docs missing in A */
  requiredMissingA: string[];
  /** Required docs missing in B */
  requiredMissingB: string[];
}

/**
 * Compare two artifact envelopes and surface consultation differences.
 *
 * @param artifactA - First artifact envelope
 * @param artifactB - Second artifact envelope
 * @returns Structured diff of consultation coverage
 */
export function compareArtifactTraces(
  artifactA: ArtifactEnvelope,
  artifactB: ArtifactEnvelope
): ArtifactTraceDiff {
  const docsA = getConsultedDocIds(artifactA);
  const docsB = getConsultedDocIds(artifactB);

  const aStatus: CoverageOrNone = artifactA.consultation?.coverageStatus ?? 'none';
  const bStatus: CoverageOrNone = artifactB.consultation?.coverageStatus ?? 'none';

  const docsInAOnly = docsA.filter((d) => !docsB.includes(d));
  const docsInBOnly = docsB.filter((d) => !docsA.includes(d));
  const docsInBoth = docsA.filter((d) => docsB.includes(d));

  const requiredMissingA = artifactA.consultation?.requiredMissing ?? [];
  const requiredMissingB = artifactB.consultation?.requiredMissing ?? [];

  // Compute coverage delta: fraction of A's docs found in B minus fraction of B's docs found in A
  const aCoverage = docsA.length > 0 ? docsInBoth.length / docsA.length : 0;
  const bCoverage = docsB.length > 0 ? docsInBoth.length / docsB.length : 0;
  const coverageDelta = Math.round((aCoverage - bCoverage) * 100) / 100;

  return {
    coverageDelta,
    aStatus,
    bStatus,
    docsInAOnly,
    docsInBOnly,
    docsInBoth,
    requiredMissingA,
    requiredMissingB,
  };
}

/**
 * Extract consulted document IDs from an envelope.
 */
function getConsultedDocIds(envelope: ArtifactEnvelope): string[] {
  if (!envelope.consultation?.consultedDocs) {
    return [];
  }
  return envelope.consultation.consultedDocs.map((d) =>
    typeof d === 'string' ? d : d.id
  );
}
