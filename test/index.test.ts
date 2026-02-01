import { describe, expect, it, vi } from 'vitest';
import { main } from '../src/cli.js';

describe('cli', () => {
  it('ping (quiet)', async () => {
    const stdoutSpy = vi
      .spyOn(process.stdout, 'write')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockImplementation(() => true as any);
    const stderrSpy = vi
      .spyOn(process.stderr, 'write')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockImplementation(() => true as any);

    try {
      const code = await main(['node', 'pr-autopilot', 'ping']);
      expect(code).toBe(0);
    } finally {
      stdoutSpy.mockRestore();
      stderrSpy.mockRestore();
    }
  });
});
