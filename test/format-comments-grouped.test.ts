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
});
