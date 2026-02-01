import { describe, expect, it } from 'vitest';

import { formatCommentsGrouped } from '../src/format.js';

import type { ReviewComment } from '../src/github/api.js';

describe('formatCommentsGrouped', () => {
  it('includes a Review <id> header even when there is only one review thread', () => {
    const comments: ReviewComment[] = [
      {
        id: 1,
        pullRequestReviewId: 42,
        userLogin: 'alice',
        path: 'src/a.ts',
        position: 1,
        body: 'Please fix this.',
        createdAt: '2026-01-01T00:00:00Z',
        htmlUrl: 'https://example.com',
      },
    ];

    const out = formatCommentsGrouped(comments);

    expect(out).toContain('src/a.ts (1)');
    expect(out).toContain('Review 42 (1)');
  });

  it('buckets comments into current diff vs outdated when positions are mixed', () => {
    const comments: ReviewComment[] = [
      {
        id: 1,
        pullRequestReviewId: 42,
        userLogin: 'alice',
        path: 'src/a.ts',
        position: 3,
        body: 'On the diff.',
        createdAt: '2026-01-01T00:00:00Z',
        htmlUrl: 'https://example.com/1',
      },
      {
        id: 2,
        pullRequestReviewId: 42,
        userLogin: 'bob',
        path: 'src/a.ts',
        position: null,
        body: 'Outdated thread.',
        createdAt: '2026-01-01T00:00:01Z',
        htmlUrl: 'https://example.com/2',
      },
    ];

    const out = formatCommentsGrouped(comments);

    expect(out).toContain('src/a.ts (2)');
    expect(out).toContain('Review 42 (2)');
    expect(out).toContain('Current diff (1)');
    expect(out).toContain('Outdated (1)');

    // The positioned comment should include the (pos <n>) marker.
    expect(out).toContain('#1 alice (pos 3):');

    // The unpositioned comment should not include a fake position marker.
    expect(out).toContain('#2 bob:');
  });
});
