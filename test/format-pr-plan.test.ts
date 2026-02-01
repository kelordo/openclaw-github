import { describe, expect, it } from 'vitest';

import { formatPrPlanText } from '../src/format.js';

import type { CheckRunSummary, PullDetails, ReviewComment } from '../src/github/api.js';

describe('formatPrPlanText', () => {
  it('elides action-items comment preview after 3 comments per file and after 5 files', () => {
    const pull: PullDetails = {
      number: 1,
      title: 'Test PR',
      state: 'open',
      merged: false,
      draft: false,
      htmlUrl: 'https://github.com/o/r/pull/1',
      headSha: 'abc123',
    };

    const makeComment = (id: number, path: string, position: number | null): ReviewComment => ({
      id,
      pullRequestReviewId: 1000,
      userLogin: 'alice',
      path,
      position,
      body: `Comment ${id}`,
      createdAt: `2026-01-01T00:00:${String(id).padStart(2, '0')}Z`,
      htmlUrl: `https://github.com/o/r/pull/1#discussion_r${id}`,
    });

    // 6 files total, 4 comments each in the first file.
    const comments: ReviewComment[] = [
      makeComment(1, 'a.ts', 1),
      makeComment(2, 'a.ts', 2),
      makeComment(3, 'a.ts', 3),
      makeComment(4, 'a.ts', 4),
      makeComment(5, 'b.ts', null),
      makeComment(6, 'c.ts', null),
      makeComment(7, 'd.ts', null),
      makeComment(8, 'e.ts', null),
      makeComment(9, 'f.ts', null),
    ];

    const checks: CheckRunSummary[] = [];

    const out = formatPrPlanText({ pull, comments, checks });

    // Only top 5 files should be listed in action items.
    expect(out).toContain('… +1 more file');

    // For a.ts, only 3 comment previews then "… +N more".
    expect(out).toContain('a.ts (4)');
    expect(out).toContain('… +1 more');
  });

  it('includes a commenter summary in the Summary section', () => {
    const pull: PullDetails = {
      number: 1,
      title: 'Test PR',
      state: 'open',
      merged: false,
      draft: false,
      htmlUrl: 'https://github.com/o/r/pull/1',
      headSha: 'abc123',
    };

    const comments: ReviewComment[] = [
      {
        id: 1,
        pullRequestReviewId: 10,
        userLogin: 'alice',
        path: 'a.ts',
        position: 1,
        body: 'x',
        createdAt: '2026-01-01T00:00:00Z',
        htmlUrl: 'u',
      },
      {
        id: 2,
        pullRequestReviewId: 11,
        userLogin: 'alice',
        path: 'b.ts',
        position: 2,
        body: 'y',
        createdAt: '2026-01-01T00:00:01Z',
        htmlUrl: 'u',
      },
      {
        id: 3,
        pullRequestReviewId: 12,
        userLogin: 'bob',
        path: 'c.ts',
        position: 3,
        body: 'z',
        createdAt: '2026-01-01T00:00:02Z',
        htmlUrl: 'u',
      },
    ];

    const checks: CheckRunSummary[] = [];

    const out = formatPrPlanText({ pull, comments, checks });

    expect(out).toContain('Summary');
    expect(out).toContain('Commenters: alice=2, bob=1');
  });

  it('includes status/conclusion in action-items check lines', () => {
    const pull: PullDetails = {
      number: 1,
      title: 'Test PR',
      state: 'open',
      merged: false,
      draft: false,
      htmlUrl: 'https://github.com/o/r/pull/1',
      headSha: 'abc123',
    };

    const comments: ReviewComment[] = [];

    const checks: CheckRunSummary[] = [
      {
        id: 1,
        name: 'CI / test (ubuntu)',
        status: 'completed',
        conclusion: 'failure',
        detailsUrl: 'https://example.com/fail',
      },
      {
        id: 2,
        name: 'CI / lint',
        status: 'in_progress',
        conclusion: null,
        detailsUrl: 'https://example.com/pending',
      },
    ];

    const out = formatPrPlanText({ pull, comments, checks });

    expect(out).toContain('Checks needing attention (2)');

    expect(out).toContain('- Failing (1)');
    expect(out).toContain('test (ubuntu): completed/failure https://example.com/fail');

    expect(out).toContain('- Pending (1)');
    expect(out).toContain('lint: in_progress https://example.com/pending');
  });
});
