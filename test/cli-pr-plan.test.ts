import { describe, expect, it, vi } from 'vitest';

const fakeOctokit = {
  pulls: {
    // Only the parts needed by `pr plan`.
    get: vi.fn(async () => ({
      data: {
        number: 1,
        title: 'Add pr plan command',
        state: 'open',
        draft: false,
        html_url: 'https://github.com/o/r/pull/1',
        user: { login: 'alice' },
        base: { ref: 'main' },
        head: { sha: 'abc123', ref: 'feature/plan' },
        mergeable: true,
      },
    })),
    listReviewComments: vi.fn(async () => ({
      data: [
        {
          id: 101,
          pull_request_review_id: 555,
          user: { login: 'alice' },
          path: 'src/cli.ts',
          position: 10,
          body: 'Please add a test.',
          created_at: '2026-01-01T00:00:00Z',
          html_url: 'https://github.com/o/r/pull/1#discussion_r101',
        },
      ],
    })),
    list: vi.fn(async () => ({ data: [] })),
  },
  checks: {
    listForRef: vi.fn(async () => ({
      data: {
        check_runs: [
          {
            id: 201,
            name: 'CI / test (ubuntu-latest)',
            status: 'completed',
            conclusion: 'failure',
            details_url: 'https://github.com/o/r/actions/runs/1',
          },
          {
            id: 202,
            name: 'CI / lint',
            status: 'completed',
            conclusion: 'success',
            details_url: 'https://github.com/o/r/actions/runs/2',
          },
        ],
      },
    })),
  },
};

vi.mock('../src/github/octokit.js', () => ({
  createOctokit: vi.fn(() => fakeOctokit),
}));

// Import after mocks.
import { main } from '../src/cli.js';

describe('cli pr plan', () => {
  it('prints JSON when --json is set', async () => {
    process.env.GITHUB_TOKEN = 'test-token';

    const writes: string[] = [];
    const origWrite = process.stdout.write;
    process.stdout.write = (chunk: unknown) => {
      writes.push(String(chunk));
      return true;
    };

    try {
      const code = await main([
        'node',
        'pr-autopilot',
        'pr',
        'plan',
        '--repo',
        'o/r',
        '--pr',
        '1',
        '--json',
      ]);
      expect(code).toBe(0);

      const text = writes.join('');
      const parsed = JSON.parse(text) as {
        pull: { number: number };
        comments: unknown[];
        checks: unknown[];
      };
      expect(parsed).toHaveProperty('pull');
      expect(parsed.pull.number).toBe(1);
      expect(parsed).toHaveProperty('comments');
      expect(parsed.comments).toHaveLength(1);
      expect(parsed).toHaveProperty('checks');
      expect(parsed.checks).toHaveLength(2);
    } finally {
      process.stdout.write = origWrite;
    }
  });

  it('prints grouped text by default', async () => {
    process.env.GITHUB_TOKEN = 'test-token';

    const writes: string[] = [];
    const origWrite = process.stdout.write;
    process.stdout.write = (chunk: unknown) => {
      writes.push(String(chunk));
      return true;
    };

    try {
      const code = await main(['node', 'pr-autopilot', 'pr', 'plan', '--repo', 'o/r', '--pr', '1']);
      expect(code).toBe(0);

      const out = writes.join('');
      expect(out).toContain('PR #1:');
      expect(out).toContain('Author: alice');
      expect(out).toContain('Branches: main <- feature/plan');
      expect(out).toContain('Mergeable: yes');
      expect(out).toContain('Summary');
      expect(out).toContain('Action items');
      expect(out).toContain('Checks needing attention');
      expect(out).toContain('Review comments (all)');
      expect(out).toContain('Checks (all)');
    } finally {
      process.stdout.write = origWrite;
    }
  });

  it('prints only attention section when --only-attention is set', async () => {
    process.env.GITHUB_TOKEN = 'test-token';

    const writes: string[] = [];
    const origWrite = process.stdout.write;
    process.stdout.write = (chunk: unknown) => {
      writes.push(String(chunk));
      return true;
    };

    try {
      const code = await main([
        'node',
        'pr-autopilot',
        'pr',
        'plan',
        '--repo',
        'o/r',
        '--pr',
        '1',
        '--only-attention',
      ]);
      expect(code).toBe(0);

      const out = writes.join('');
      expect(out).toContain('PR #1:');
      expect(out).toContain('Summary');
      expect(out).toContain('Action items');
      expect(out).toContain('Checks needing attention');
      // Should not include the full, verbose grouped sections.
      expect(out).not.toContain('Review comments (all)');
      expect(out).not.toContain('Checks (all)');
    } finally {
      process.stdout.write = origWrite;
    }
  });

  it('accepts --pr-url as an alternative to --repo/--pr', async () => {
    process.env.GITHUB_TOKEN = 'test-token';

    const writes: string[] = [];
    const origWrite = process.stdout.write;
    process.stdout.write = (chunk: unknown) => {
      writes.push(String(chunk));
      return true;
    };

    try {
      const code = await main([
        'node',
        'pr-autopilot',
        'pr',
        'plan',
        '--pr-url',
        'https://github.com/o/r/pull/1',
        '--json',
      ]);
      expect(code).toBe(0);

      const text = writes.join('');
      const parsed = JSON.parse(text) as { pull: { number: number } };
      expect(parsed.pull.number).toBe(1);
    } finally {
      process.stdout.write = origWrite;
    }
  });
});
