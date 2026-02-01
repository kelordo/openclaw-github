import { describe, expect, it } from 'vitest';
import { formatChecksGrouped, formatCommentsGrouped, formatPrPlanText } from '../src/format.js';

describe('text formatters', () => {
  it('groups comments by path', () => {
    const out = formatCommentsGrouped([
      {
        id: 1,
        pullRequestReviewId: null,
        userLogin: 'alice',
        path: 'b.ts',
        position: 1,
        body: 'hello',
        createdAt: 'x',
        htmlUrl: 'u',
      },
      {
        id: 2,
        pullRequestReviewId: null,
        userLogin: 'bob',
        path: 'a.ts',
        position: null,
        body: 'multi\nline',
        createdAt: 'x',
        htmlUrl: 'u',
      },
    ]);

    expect(out).toContain('a.ts');
    expect(out).toContain('b.ts');
    expect(out).toContain('#2 bob');
    expect(out).toContain('multi line');
  });

  it('buckets checks with failures first', () => {
    const out = formatChecksGrouped([
      { id: 1, name: 'lint', status: 'completed', conclusion: 'success', detailsUrl: null },
      { id: 2, name: 'test', status: 'completed', conclusion: 'failure', detailsUrl: 'd' },
      { id: 3, name: 'build', status: 'in_progress', conclusion: null, detailsUrl: null },
    ]);

    const failedIdx = out.indexOf('failed');
    const pendingIdx = out.indexOf('pending');
    const successIdx = out.indexOf('success');
    expect(failedIdx).toBeGreaterThanOrEqual(0);
    expect(pendingIdx).toBeGreaterThanOrEqual(0);
    expect(successIdx).toBeGreaterThanOrEqual(0);
    expect(failedIdx).toBeLessThan(pendingIdx);
    expect(pendingIdx).toBeLessThan(successIdx);
  });

  it('formats a plan summary', () => {
    const out = formatPrPlanText({
      pull: { number: 1, title: 'T', state: 'open', draft: false, htmlUrl: 'u', headSha: 's' },
      comments: [],
      checks: [],
    });

    expect(out).toContain('PR #1: T');
    expect(out).toContain('Summary');
    expect(out).toContain('Comments: 0 across 0 files');
    expect(out).toContain('Checks: 0');
    expect(out).toContain('Review comments (0)');
    expect(out).toContain('Checks (0)');
  });

  it('includes bucket counts in the plan summary when checks exist', () => {
    const out = formatPrPlanText({
      pull: { number: 1, title: 'T', state: 'open', draft: false, htmlUrl: 'u', headSha: 's' },
      comments: [{
        id: 1,
        pullRequestReviewId: null,
        userLogin: 'alice',
        path: 'a.ts',
        position: 1,
        body: 'x',
        createdAt: 'x',
        htmlUrl: 'u',
      }],
      checks: [
        { id: 1, name: 'lint', status: 'completed', conclusion: 'success', detailsUrl: null },
        { id: 2, name: 'test', status: 'completed', conclusion: 'failure', detailsUrl: 'd' },
        { id: 3, name: 'build', status: 'in_progress', conclusion: null, detailsUrl: null },
      ],
    });

    expect(out).toContain('Checks: 3');
    expect(out).toContain('failed=1');
    expect(out).toContain('pending=1');
    expect(out).toContain('success=1');
  });
});
