import { describe, expect, it } from 'vitest';

import { fingerprintCheckRuns, fingerprintReviewComments } from '../src/watch.js';

describe('watch fingerprints', () => {
  it('fingerprintReviewComments is stable regardless of input order', () => {
    const a = fingerprintReviewComments([
      { id: 2, pullRequestReviewId: null, userLogin: null, path: 'a', position: null, body: '', createdAt: '2020-01-02T00:00:00Z', htmlUrl: 'u2' },
      { id: 1, pullRequestReviewId: null, userLogin: null, path: 'a', position: null, body: '', createdAt: '2020-01-01T00:00:00Z', htmlUrl: 'u1' },
    ]);

    const b = fingerprintReviewComments([
      { id: 1, pullRequestReviewId: null, userLogin: null, path: 'a', position: null, body: '', createdAt: '2020-01-01T00:00:00Z', htmlUrl: 'u1' },
      { id: 2, pullRequestReviewId: null, userLogin: null, path: 'a', position: null, body: '', createdAt: '2020-01-02T00:00:00Z', htmlUrl: 'u2' },
    ]);

    expect(a).toBe(b);
  });

  it('fingerprintCheckRuns is stable regardless of input order', () => {
    const a = fingerprintCheckRuns([
      { id: 2, name: 'ci', status: 'completed', conclusion: 'success', detailsUrl: null },
      { id: 1, name: 'lint', status: 'completed', conclusion: 'failure', detailsUrl: null },
    ]);

    const b = fingerprintCheckRuns([
      { id: 1, name: 'lint', status: 'completed', conclusion: 'failure', detailsUrl: null },
      { id: 2, name: 'ci', status: 'completed', conclusion: 'success', detailsUrl: null },
    ]);

    expect(a).toBe(b);
  });
});
