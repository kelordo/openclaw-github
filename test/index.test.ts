import { describe, expect, it } from 'vitest';
import { main } from '../src/index.js';

describe('cli', () => {
  it('ping', () => {
    const code = main(['node', 'pr-autopilot', 'ping']);
    expect(code).toBe(0);
  });
});
