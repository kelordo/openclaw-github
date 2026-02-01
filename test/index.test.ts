import { describe, expect, it } from 'vitest';
import { main } from '../src/cli.js';

describe('cli', () => {
  it('ping', async () => {
    const code = await main(['node', 'pr-autopilot', 'ping']);
    expect(code).toBe(0);
  });
});
