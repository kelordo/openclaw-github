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
});
