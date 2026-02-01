import { describe, expect, it } from 'vitest';
import { formatChecksGrouped, formatCommentsGrouped, formatPrPlanText, formatPullsGrouped } from '../src/format.js';

describe('text formatters', () => {
  it('groups pull lists into open/draft/merged/closed buckets', () => {
    const out = formatPullsGrouped([
      { number: 4, title: 'Fourth', state: 'closed', merged: true, draft: false, htmlUrl: 'u4' },
      { number: 3, title: 'Third', state: 'closed', merged: false, draft: false, htmlUrl: 'u3' },
      { number: 2, title: 'Second', state: 'open', merged: false, draft: true, htmlUrl: 'u2' },
      { number: 1, title: 'First', state: 'open', merged: false, draft: false, htmlUrl: 'u1' },
    ]);

    // Open-ish buckets come first, then closed buckets.
    expect(out.indexOf('open')).toBeLessThan(out.indexOf('draft'));
    expect(out.indexOf('draft')).toBeLessThan(out.indexOf('merged'));
    expect(out.indexOf('merged')).toBeLessThan(out.indexOf('closed'));

    expect(out).toContain('open (1)');
    expect(out).toContain('draft (1)');
    expect(out).toContain('merged (1)');
    expect(out).toContain('closed (1)');

    expect(out).toContain('- #1 First u1');
    expect(out).toContain('- #2 Second u2');
    expect(out).toContain('- #3 Third u3');
    expect(out).toContain('- #4 Fourth u4');
  });

  it('groups comments by path (most-commented files first)', () => {
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
      {
        id: 3,
        pullRequestReviewId: null,
        userLogin: 'carol',
        path: 'a.ts',
        position: 2,
        body: 'another',
        createdAt: 'x',
        htmlUrl: 'u',
      },
    ]);

    // The file with the most comments should come first.
    expect(out.indexOf('a.ts')).toBeLessThan(out.indexOf('b.ts'));

    expect(out).toContain('a.ts (2)');
    expect(out).toContain('b.ts (1)');
    expect(out).toContain('#2 bob');
    expect(out).toContain('multi line');
  });

  it('groups positioned vs unpositioned comments (current diff vs outdated) when mixed', () => {
    const out = formatCommentsGrouped([
      {
        id: 1,
        pullRequestReviewId: null,
        userLogin: 'alice',
        path: 'a.ts',
        position: 10,
        body: 'x',
        createdAt: '2026-01-01T00:00:00Z',
        htmlUrl: 'u',
      },
      {
        id: 2,
        pullRequestReviewId: null,
        userLogin: 'bob',
        path: 'a.ts',
        position: null,
        body: 'y',
        createdAt: '2026-01-01T00:00:01Z',
        htmlUrl: 'u',
      },
    ]);

    expect(out).toContain('Current diff (1)');
    expect(out).toContain('Outdated (1)');
    expect(out).toContain('#1 alice (pos 10):');
    expect(out).toContain('#2 bob:');
    expect(out).not.toContain('(no position)');

    const out2 = formatCommentsGrouped([
      {
        id: 3,
        pullRequestReviewId: null,
        userLogin: 'bob',
        path: 'a.ts',
        position: null,
        body: 'y',
        createdAt: '2026-01-01T00:00:01Z',
        htmlUrl: 'u',
      },
    ]);

    // When there are only unpositioned comments, don't add any extra bucket headers.
    expect(out2).not.toContain('Current diff');
    expect(out2).not.toContain('Outdated');
  });

  it('groups comments by review id within a file when multiple exist', () => {
    const out = formatCommentsGrouped([
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
        userLogin: 'bob',
        path: 'a.ts',
        position: 2,
        body: 'y',
        createdAt: '2026-01-01T00:00:01Z',
        htmlUrl: 'u',
      },
    ]);

    expect(out).toContain('Review 10');
    expect(out).toContain('Review 11');
  });

  it('sorts review id groups numerically (not lexicographically)', () => {
    const out = formatCommentsGrouped([
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
        pullRequestReviewId: 2,
        userLogin: 'bob',
        path: 'a.ts',
        position: 2,
        body: 'y',
        createdAt: '2026-01-01T00:00:01Z',
        htmlUrl: 'u',
      },
    ]);

    expect(out.indexOf('Review 2')).toBeLessThan(out.indexOf('Review 10'));
  });

  it('buckets checks with failures first', () => {
    const out = formatChecksGrouped([
      { id: 1, name: 'lint', status: 'completed', conclusion: 'success', detailsUrl: null },
      { id: 2, name: 'test', status: 'completed', conclusion: 'failure', detailsUrl: 'd' },
      { id: 3, name: 'build', status: 'in_progress', conclusion: null, detailsUrl: null },
    ]);

    expect(out).toContain('Summary: failed=1 pending=1 success=1');

    const failedIdx = out.indexOf('failed');
    const pendingIdx = out.indexOf('pending');
    const successIdx = out.indexOf('success');
    expect(failedIdx).toBeGreaterThanOrEqual(0);
    expect(pendingIdx).toBeGreaterThanOrEqual(0);
    expect(successIdx).toBeGreaterThanOrEqual(0);
    expect(failedIdx).toBeLessThan(pendingIdx);
    expect(pendingIdx).toBeLessThan(successIdx);
  });

  it('groups checks by "suite" when names contain " / "', () => {
    const out = formatChecksGrouped([
      { id: 1, name: 'CI / test', status: 'completed', conclusion: 'failure', detailsUrl: null },
      { id: 2, name: 'CI / lint', status: 'completed', conclusion: 'success', detailsUrl: null },
      { id: 3, name: 'Release / build', status: 'in_progress', conclusion: null, detailsUrl: null },
    ]);

    expect(out).toContain('failed (1)');
    expect(out).toContain('pending (1)');
    expect(out).toContain('success (1)');

    // subgroup headers are per bucket
    expect(out).toContain('failed (1)');
    expect(out).toContain('  CI (1)');
    expect(out).toContain('pending (1)');
    expect(out).toContain('  Release (1)');
    expect(out).toContain('success (1)');

    // labels should not repeat the suite prefix
    expect(out).toContain('- test:');
    expect(out).toContain('- lint:');
    expect(out).toContain('- build:');
  });

  it('sorts checks within a suite by the label (after splitting "suite / label")', () => {
    const out = formatChecksGrouped([
      { id: 1, name: 'CI / zed', status: 'completed', conclusion: 'failure', detailsUrl: null },
      { id: 2, name: 'CI / alpha', status: 'completed', conclusion: 'failure', detailsUrl: null },
    ]);

    const alphaIdx = out.indexOf('alpha:');
    const zedIdx = out.indexOf('zed:');
    expect(alphaIdx).toBeGreaterThanOrEqual(0);
    expect(zedIdx).toBeGreaterThanOrEqual(0);
    expect(alphaIdx).toBeLessThan(zedIdx);
  });

  it('sorts suites within a bucket by descending suite size (then name)', () => {
    const out = formatChecksGrouped([
      { id: 1, name: 'CI / test', status: 'completed', conclusion: 'failure', detailsUrl: null },
      { id: 2, name: 'CI / lint', status: 'completed', conclusion: 'failure', detailsUrl: null },
      { id: 3, name: 'Release / build', status: 'completed', conclusion: 'failure', detailsUrl: null },
    ]);

    // "CI" has 2 failures; "Release" has 1, so CI should be listed first.
    expect(out.indexOf('  CI (2)')).toBeLessThan(out.indexOf('  Release (1)'));
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
    expect(out).toContain('Review comments (all) (0)');
    expect(out).toContain('Checks (all) (0)');
  });

  it('surfaces a small preview of review comments in the plan action items section', () => {
    const out = formatPrPlanText({
      pull: { number: 1, title: 'T', state: 'open', draft: false, htmlUrl: 'u', headSha: 's' },
      comments: [
        {
          id: 1,
          pullRequestReviewId: null,
          userLogin: 'alice',
          path: 'a.ts',
          position: 10,
          body: 'Please rename this variable',
          createdAt: '2026-01-01T00:00:00Z',
          htmlUrl: 'c1',
        },
      ],
      checks: [],
    });

    expect(out).toContain('Action items');
    expect(out).toContain('Review comments (all) (1)');
    expect(out).toContain('- a.ts (1)');
    expect(out).toContain('alice (pos 10): Please rename this variable c1');
  });

  it('elides action item review comments when many files are commented', () => {
    const comments = Array.from({ length: 7 }, (_, i) => ({
      id: i + 1,
      pullRequestReviewId: null,
      userLogin: 'alice',
      path: `f${i}.ts`,
      position: 1,
      body: 'x',
      createdAt: '2026-01-01T00:00:00Z',
      htmlUrl: `c${i}`,
    }));

    const out = formatPrPlanText({
      pull: { number: 1, title: 'T', state: 'open', draft: false, htmlUrl: 'u', headSha: 's' },
      comments,
      checks: [],
    });

    // We show at most 5 files in action items.
    expect(out).toContain('- f0.ts (1)');
    expect(out).toContain('- f4.ts (1)');
    expect(out).toContain('… +2 more files');
  });

  it('groups action item review comment previews by review id within a file when multiple exist', () => {
    const out = formatPrPlanText({
      pull: { number: 1, title: 'T', state: 'open', draft: false, htmlUrl: 'u', headSha: 's' },
      comments: [
        {
          id: 1,
          pullRequestReviewId: 10,
          userLogin: 'alice',
          path: 'a.ts',
          position: 1,
          body: 'x',
          createdAt: '2026-01-01T00:00:00Z',
          htmlUrl: 'c1',
        },
        {
          id: 2,
          pullRequestReviewId: 11,
          userLogin: 'bob',
          path: 'a.ts',
          position: 2,
          body: 'y',
          createdAt: '2026-01-01T00:00:01Z',
          htmlUrl: 'c2',
        },
      ],
      checks: [],
    });

    expect(out).toContain('Action items');
    expect(out).toContain('Review comments (all) (2)');
    expect(out).toContain('- a.ts (2)');
    expect(out).toContain('Review 10 (1)');
    expect(out).toContain('Review 11 (1)');
  });

  it('includes status/conclusion for failing and pending checks in the plan action items', () => {
    const out = formatPrPlanText({
      pull: { number: 1, title: 'T', state: 'open', draft: false, htmlUrl: 'u', headSha: 's' },
      comments: [],
      checks: [
        { id: 1, name: 'CI / test', status: 'completed', conclusion: 'failure', detailsUrl: 'd1' },
        { id: 2, name: 'CI / build', status: 'in_progress', conclusion: null, detailsUrl: 'd2' },
      ],
    });

    expect(out).toContain('Action items');
    expect(out).toContain('Checks needing attention (2)');
    expect(out).toContain('- Failing (1)');
    expect(out).toContain('- Pending (1)');
    expect(out).toContain('- test: completed/failure d1');
    expect(out).toContain('- build: in_progress d2');
  });

  it('includes bucket counts in the plan summary when checks exist', () => {
    const out = formatPrPlanText({
      pull: { number: 1, title: 'T', state: 'open', draft: false, htmlUrl: 'u', headSha: 's' },
      comments: [
        {
          id: 1,
          pullRequestReviewId: null,
          userLogin: 'alice',
          path: 'a.ts',
          position: 1,
          body: 'x',
          createdAt: 'x',
          htmlUrl: 'u',
        },
      ],
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

  it('indents grouped blocks under plan sections', () => {
    const out = formatPrPlanText({
      pull: { number: 1, title: 'T', state: 'open', draft: false, htmlUrl: 'u', headSha: 's' },
      comments: [
        {
          id: 1,
          pullRequestReviewId: null,
          userLogin: 'alice',
          path: 'a.ts',
          position: 1,
          body: 'x',
          createdAt: 'x',
          htmlUrl: 'u',
        },
      ],
      checks: [{ id: 1, name: 'CI / test', status: 'completed', conclusion: 'failure', detailsUrl: null }],
    });

    expect(out).toContain('Review comments (all) (1)\n  a.ts (1)');
    expect(out).toContain('Checks (all) (1)\n  Summary: failed=1');
    expect(out).toContain('\n  failed (1)');
  });
});
