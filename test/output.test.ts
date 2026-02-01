import { describe, expect, it } from 'vitest';
import { formatJson } from '../src/output.js';

describe('output', () => {
  it('formats json (compact)', () => {
    expect(formatJson({ a: 1 })).toBe('{"a":1}\n');
  });

  it('formats json (pretty)', () => {
    expect(formatJson({ a: 1 }, { pretty: true })).toBe('{\n  "a": 1\n}\n');
  });
});
