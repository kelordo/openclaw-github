import { describe, expect, it, vi } from 'vitest';

const fakeOctokit = {
  pulls: {
    list: vi.fn(async () => ({ data: [] })),
    listReviewComments: vi.fn(async () => ({ data: [] })),
    get: vi.fn(async () => ({
      data: {
        number: 1,
        title: 'Any PR',
        state: 'open',
        draft: false,
        html_url: 'https://github.com/o/r/pull/1',
        head: { sha: 'abc123' },
      },
    })),
  },
  checks: {
    listForRef: vi.fn(async () => ({ data: { check_runs: [] } })),
  },
};

vi.mock('../src/github/octokit.js', () => ({
  createOctokit: vi.fn(() => fakeOctokit),
}));

// Import after mocks.
import { main } from '../src/cli.js';

describe('cli empty output', () => {
  it('prints (none) for pr list with no PRs', async () => {
    process.env.GITHUB_TOKEN = 'test-token';

    const writes: string[] = [];
    const origWrite = process.stdout.write;
    process.stdout.write = (chunk: unknown) => {
      writes.push(String(chunk));
      return true;
    };

    try {
      const code = await main(['node', 'pr-autopilot', 'pr', 'list', '--repo', 'o/r']);
      expect(code).toBe(0);
      expect(writes.join('')).toBe('(none)\n');
    } finally {
      process.stdout.write = origWrite;
    }
  });

  it('prints (none) for pr comments with no comments', async () => {
    process.env.GITHUB_TOKEN = 'test-token';

    const writes: string[] = [];
    const origWrite = process.stdout.write;
    process.stdout.write = (chunk: unknown) => {
      writes.push(String(chunk));
      return true;
    };

    try {
      const code = await main(['node', 'pr-autopilot', 'pr', 'comments', '--repo', 'o/r', '--pr', '1']);
      expect(code).toBe(0);
      expect(writes.join('')).toBe('(none)\n');
    } finally {
      process.stdout.write = origWrite;
    }
  });

  it('prints (none) for pr checks with no checks', async () => {
    process.env.GITHUB_TOKEN = 'test-token';

    const writes: string[] = [];
    const origWrite = process.stdout.write;
    process.stdout.write = (chunk: unknown) => {
      writes.push(String(chunk));
      return true;
    };

    try {
      const code = await main(['node', 'pr-autopilot', 'pr', 'checks', '--repo', 'o/r', '--pr', '1']);
      expect(code).toBe(0);
      expect(writes.join('')).toBe('(none)\n');
    } finally {
      process.stdout.write = origWrite;
    }
  });
});
