import { homedir } from 'node:os';

/**
 * Redact filesystem paths for safe display in error messages.
 * Replaces home directory with ~/ and shortens deep paths.
 */
export function sanitizePath(path: string): string {
  const home = homedir();
  if (path.startsWith(home)) {
    return '~' + path.substring(home.length);
  }
  // Don't expose full paths — just show basename context
  const parts = path.split('/');
  if (parts.length > 3) {
    return '.../' + parts.slice(-3).join('/');
  }
  return path;
}

/**
 * Recursively canonicalize a value into a deterministic JSON string.
 *
 * Sorts all object keys at every nesting level so the same logical data
 * always produces the same string regardless of insertion order. This
 * replaces the non-deterministic `JSON.stringify(obj, Object.keys(obj).sort())`
 * which only sorts top-level keys.
 *
 * Used for content hash computation in artifact integrity verification.
 *
 * OWASP Reference: Cryptographic Storage Cheat Sheet — deterministic serialization
 */
export function canonicalize(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalize).join(',') + ']';
  }
  if (typeof value === 'object') {
    const sorted = Object.keys(value).sort();
    const pairs = sorted.map(k => {
      const v = (value as Record<string, unknown>)[k];
      return JSON.stringify(k) + ':' + canonicalize(v);
    });
    return '{' + pairs.join(',') + '}';
  }
  // Fallback for other types
  return JSON.stringify(value);
}
