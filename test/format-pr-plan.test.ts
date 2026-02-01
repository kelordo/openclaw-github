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

  it('handles action-items comment preview across multiple review threads without miscounting remaining comments', () => {
    const pull: PullDetails = {
      number: 1,
      title: 'Test PR',
      state: 'open',
      merged: false,
      draft: false,
      htmlUrl: 'https://github.com/o/r/pull/1',
      headSha: 'abc123',
    };

    const makeComment = (id: number, reviewId: number): ReviewComment => ({
      id,
      pullRequestReviewId: reviewId,
      userLogin: 'alice',
      path: 'a.ts',
      position: id,
      body: `Comment ${id}`,
      createdAt: `2026-01-01T00:00:${String(id).padStart(2, '0')}Z`,
      htmlUrl: `https://github.com/o/r/pull/1#discussion_r${id}`,
    });

    // 4 comments across 2 review threads; preview budget is 3, so we should show
    // at least one comment from the second thread (instead of spending all 3 on
    // the first thread), then elide +1.
    const comments: ReviewComment[] = [
      makeComment(1, 10),
      makeComment(2, 10),
      makeComment(3, 10),
      makeComment(4, 11),
    ];

    const checks: CheckRunSummary[] = [];

    const out = formatPrPlanText({ pull, comments, checks });

    expect(out).toContain('a.ts (4)');
    expect(out).toContain('Review 10');
    expect(out).toContain('Review 11');
    // Ensure we didn't elide by review-thread count; the remaining should be 1.
    expect(out).toContain('… +1 more');
  });

  it('shows Current diff vs Outdated buckets in action-items comment preview when a thread mixes positioned and unpositioned comments', () => {
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
        body: 'Current',
        createdAt: '2026-01-01T00:00:00Z',
        htmlUrl: 'u1',
      },
      {
        id: 2,
        pullRequestReviewId: 10,
        userLogin: 'alice',
        path: 'a.ts',
        position: null,
        body: 'Outdated',
        createdAt: '2026-01-01T00:00:01Z',
        htmlUrl: 'u2',
      },
    ];

    const checks: CheckRunSummary[] = [];

    const out = formatPrPlanText({ pull, comments, checks });

    expect(out).toContain('Action items');
    expect(out).toContain('a.ts (2)');
    expect(out).toContain('Current diff (1)');
    expect(out).toContain('Outdated (1)');
    expect(out).toContain('alice (pos 1): Current');
    expect(out).toContain('alice (no position): Outdated');
  });

  it('includes showing counts in action-items diff bucket headers when preview budget truncates a bucket', () => {
    const pull: PullDetails = {
      number: 1,
      title: 'Test PR',
      state: 'open',
      merged: false,
      draft: false,
      htmlUrl: 'https://github.com/o/r/pull/1',
      headSha: 'abc123',
    };

    const make = (id: number, position: number | null, body: string): ReviewComment => ({
      id,
      pullRequestReviewId: 10,
      userLogin: 'alice',
      path: 'a.ts',
      position,
      body,
      createdAt: `2026-01-01T00:00:${String(id).padStart(2, '0')}Z`,
      htmlUrl: `u${id}`,
    });

    // Preview budget is 3 per file; make 2 positioned + 2 unpositioned so we truncate Outdated.
    const comments: ReviewComment[] = [make(1, 1, 'c1'), make(2, 2, 'c2'), make(3, null, 'o1'), make(4, null, 'o2')];
    const checks: CheckRunSummary[] = [];

    const out = formatPrPlanText({ pull, comments, checks });

    expect(out).toContain('Current diff (2)');
    expect(out).toContain('Outdated (2, showing 1)');
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

  it('includes status/conclusion in action-items check lines (including unknown conclusions)', () => {
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
      {
        id: 3,
        name: 'CI / weird',
        status: 'completed',
        conclusion: null,
        detailsUrl: 'https://example.com/unknown',
      },
    ];

    const out = formatPrPlanText({ pull, comments, checks });

    expect(out).toContain('Checks needing attention (3)');

    expect(out).toContain('- Failing (1)');
    expect(out).toContain('test (ubuntu): completed/failure https://example.com/fail');

    expect(out).toContain('- Pending (1)');
    expect(out).toContain('lint: in_progress https://example.com/pending');

    expect(out).toContain('- Unknown (1)');
    expect(out).toContain('weird: completed https://example.com/unknown');
  });

  it('supports --only-attention mode by omitting full comment/check sections', () => {
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
        body: 'Please fix this',
        createdAt: '2026-01-01T00:00:00Z',
        htmlUrl: 'u',
      },
    ];

    const checks: CheckRunSummary[] = [
      {
        id: 1,
        name: 'CI / test',
        status: 'completed',
        conclusion: 'failure',
        detailsUrl: 'https://example.com/fail',
      },
    ];

    const out = formatPrPlanText({ pull, comments, checks }, { mode: 'attention' });

    expect(out).toContain('Summary');
    expect(out).toContain('Action items');

    expect(out).not.toContain('Review comments (all)');
    expect(out).not.toContain('Checks (all)');
  });
});
