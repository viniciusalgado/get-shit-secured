/**
 * Unit tests for stack normalizer.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { normalizeStack, getKnownCanonicalTags } from '../../dist/core/stack-normalizer.js';

describe('Stack Normalizer - normalizeStack', () => {
  it('should normalize Node.js signals to canonical "nodejs"', () => {
    const result = normalizeStack(['Node.js', 'node']);
    assert.ok(result.canonical.includes('nodejs'));
    assert.deepEqual(result.raw, ['Node.js', 'node']);
  });

  it('should normalize TypeScript to javascript', () => {
    const result = normalizeStack(['TypeScript']);
    assert.ok(result.canonical.includes('javascript'));
  });

  it('should normalize Kubernetes signals', () => {
    const result = normalizeStack(['k8s', 'Kubernetes']);
    assert.ok(result.canonical.includes('kubernetes'));
    assert.equal(result.canonical.filter(t => t === 'kubernetes').length, 1, 'Should deduplicate');
  });

  it('should normalize AWS Lambda signals', () => {
    const result = normalizeStack(['aws-lambda', 'serverless']);
    assert.ok(result.canonical.includes('aws-lambda'));
    assert.ok(result.canonical.includes('serverless'));
  });

  it('should pass through unknown signals as-is', () => {
    const result = normalizeStack(['custom-framework']);
    assert.ok(result.canonical.includes('custom-framework'));
  });

  it('should produce deterministic alphabetical ordering', () => {
    const result1 = normalizeStack(['docker', 'kubernetes', 'aws']);
    const result2 = normalizeStack(['kubernetes', 'aws', 'docker']);
    assert.deepEqual(result1.canonical, result2.canonical);
  });

  it('should handle empty input', () => {
    const result = normalizeStack([]);
    assert.deepEqual(result.canonical, []);
    assert.deepEqual(result.raw, []);
  });

  it('should handle case-insensitive matching', () => {
    const result = normalizeStack(['DJANGO', 'Django', 'django']);
    assert.ok(result.canonical.includes('django'));
    assert.equal(result.canonical.length, 1, 'Should deduplicate to single canonical tag');
  });

  it('should skip empty strings', () => {
    const result = normalizeStack(['', '  ', 'docker']);
    assert.ok(!result.canonical.includes(''));
    assert.ok(result.canonical.includes('docker'));
  });

  it('should normalize IaC signals', () => {
    const result = normalizeStack(['terraform', 'CloudFormation']);
    assert.ok(result.canonical.includes('terraform'));
    assert.ok(result.canonical.includes('cloudformation'));
  });
});

describe('Stack Normalizer - getKnownCanonicalTags', () => {
  it('should return a non-empty sorted array', () => {
    const tags = getKnownCanonicalTags();
    assert.ok(tags.length > 0);

    // Verify sorted
    for (let i = 1; i < tags.length; i++) {
      assert.ok(tags[i - 1] <= tags[i], `Tags should be sorted: ${tags[i - 1]} <= ${tags[i]}`);
    }
  });

  it('should include common canonical tags', () => {
    const tags = getKnownCanonicalTags();
    assert.ok(tags.includes('nodejs'));
    assert.ok(tags.includes('docker'));
    assert.ok(tags.includes('kubernetes'));
    assert.ok(tags.includes('django'));
  });
});
