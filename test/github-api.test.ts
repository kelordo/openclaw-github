import { describe, expect, it } from 'vitest';
import { createGitHubApi, type OctokitLike } from '../src/github/api.js';

describe('github api wrapper', () => {
  it('listPulls maps fields', async () => {
    let calls = 0;

    const octokit: OctokitLike = {
      pulls: {
        list: async () => {
          calls++;
          return {
            data: [
              { number: 1, title: 'A', state: 'open', draft: false, html_url: 'u1' },
              { number: 2, title: 'B', state: 'closed', draft: true, html_url: 'u2' },
            ],
          };
        },
        listReviewComments: async () => ({ data: [] }),
        get: async () => ({ data: { head: { sha: 'abc' } } }),
      },
      checks: {
        listForRef: async () => ({ data: { check_runs: [] } }),
      },
    };

    const api = createGitHubApi(octokit);
    const prs = await api.listPulls({ owner: 'o', repo: 'r', state: 'open' });
    expect(prs).toEqual([
      { number: 1, title: 'A', state: 'open', draft: false, htmlUrl: 'u1' },
      { number: 2, title: 'B', state: 'closed', draft: true, htmlUrl: 'u2' },
    ]);
    expect(calls).toBe(1);
  });

  it('listReviewComments maps fields', async () => {
    const octokit: OctokitLike = {
      pulls: {
        list: async () => ({ data: [] }),
        listReviewComments: async () => ({
          data: [
            {
              id: 7,
              pull_request_review_id: 11,
              user: { login: 'alice' },
              path: 'src/a.ts',
              position: 3,
              body: 'hello',
              created_at: '2020-01-01T00:00:00Z',
              html_url: 'u',
            },
            {
              id: 8,
              pull_request_review_id: null,
              user: null,
              path: 'src/b.ts',
              position: null,
              body: null,
              created_at: '2020-01-02T00:00:00Z',
              html_url: 'u2',
            },
          ],
        }),
        get: async () => ({ data: { head: { sha: 'abc' } } }),
      },
      checks: {
        listForRef: async () => ({ data: { check_runs: [] } }),
      },
    };

    const api = createGitHubApi(octokit);
    const comments = await api.listReviewComments({ owner: 'o', repo: 'r', pullNumber: 1 });
    expect(comments).toEqual([
      {
        id: 7,
        pullRequestReviewId: 11,
        userLogin: 'alice',
        path: 'src/a.ts',
        position: 3,
        body: 'hello',
        createdAt: '2020-01-01T00:00:00Z',
        htmlUrl: 'u',
      },
      {
        id: 8,
        pullRequestReviewId: null,
        userLogin: null,
        path: 'src/b.ts',
        position: null,
        body: '',
        createdAt: '2020-01-02T00:00:00Z',
        htmlUrl: 'u2',
      },
    ]);
  });

  it('getPull maps fields', async () => {
    const octokit: OctokitLike = {
      pulls: {
        list: async () => ({ data: [] }),
        listReviewComments: async () => ({ data: [] }),
        get: async () => ({ data: { number: 7, title: 'Hello', state: 'open', draft: true, html_url: 'u', head: { sha: 'abc' } } }),
      },
      checks: {
        listForRef: async () => ({ data: { check_runs: [] } }),
      },
    };

    const api = createGitHubApi(octokit);
    const pr = await api.getPull({ owner: 'o', repo: 'r', pullNumber: 7 });
    expect(pr).toEqual({ number: 7, title: 'Hello', state: 'open', draft: true, htmlUrl: 'u', headSha: 'abc' });
  });

  it('listCheckRunsForPull uses PR head sha', async () => {
    let capturedRef: string | undefined;

    const octokit: OctokitLike = {
      pulls: {
        list: async () => ({ data: [] }),
        listReviewComments: async () => ({ data: [] }),
        get: async () => ({ data: { number: 1, title: 'T', state: 'open', draft: false, html_url: 'u', head: { sha: 'deadbeef' } } }),
      },
      checks: {
        listForRef: async (args: unknown) => {
          capturedRef = (args as { ref?: string }).ref;
          return {
            data: {
              check_runs: [
                { id: 9, name: 'ci', status: 'completed', conclusion: 'success', details_url: 'd' },
              ],
            },
          };
        },
      },
    };

    const api = createGitHubApi(octokit);
    const runs = await api.listCheckRunsForPull({ owner: 'o', repo: 'r', pullNumber: 1 });
    expect(capturedRef).toBe('deadbeef');
    expect(runs).toEqual([
      { id: 9, name: 'ci', status: 'completed', conclusion: 'success', detailsUrl: 'd' },
    ]);
  });
});
