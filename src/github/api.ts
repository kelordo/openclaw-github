export type PullRequestSummary = {
  number: number;
  title: string;
  state: 'open' | 'closed';
  draft?: boolean;
  htmlUrl: string;
};

export type ReviewComment = {
  id: number;
  pullRequestReviewId: number | null;
  userLogin: string | null;
  path: string;
  position: number | null;
  body: string;
  createdAt: string;
  htmlUrl: string;
};

export type CheckRunSummary = {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  detailsUrl: string | null;
};

export type GitHubApi = {
  listPulls(params: { owner: string; repo: string; state?: 'open' | 'closed' | 'all' }): Promise<PullRequestSummary[]>;
  listReviewComments(params: { owner: string; repo: string; pullNumber: number }): Promise<ReviewComment[]>;
  listCheckRunsForPull(params: { owner: string; repo: string; pullNumber: number }): Promise<CheckRunSummary[]>;
};

export type PullsListArgs = {
  owner: string;
  repo: string;
  state?: 'open' | 'closed' | 'all';
  per_page?: number;
};

export type PullsListReviewCommentsArgs = {
  owner: string;
  repo: string;
  pull_number: number;
  per_page?: number;
};

export type PullsGetArgs = {
  owner: string;
  repo: string;
  pull_number: number;
};

export type ChecksListForRefArgs = {
  owner: string;
  repo: string;
  ref: string;
  per_page?: number;
};

// Minimal subset of Octokit that we need; keeps tests easy.
export type OctokitLike = {
  pulls: {
    list: (args: PullsListArgs) => Promise<{ data: unknown[] }>;
    listReviewComments: (args: PullsListReviewCommentsArgs) => Promise<{ data: unknown[] }>;
    get: (args: PullsGetArgs) => Promise<{ data: unknown }>;
  };
  checks: {
    listForRef: (args: ChecksListForRefArgs) => Promise<{ data: { check_runs: unknown[] } }>;
  };
};

export function createGitHubApi(octokit: OctokitLike): GitHubApi {
  return {
    async listPulls({ owner, repo, state = 'open' }) {
      const res = await octokit.pulls.list({ owner, repo, state, per_page: 50 });
      return res.data.map((prUnknown) => {
        const pr = prUnknown as {
          number: number;
          title: string;
          state: 'open' | 'closed';
          draft?: boolean;
          html_url: string;
        };
        return {
          number: pr.number,
          title: pr.title,
          state: pr.state,
          draft: pr.draft,
          htmlUrl: pr.html_url,
        };
      });
    },

    async listReviewComments({ owner, repo, pullNumber }) {
      const res = await octokit.pulls.listReviewComments({ owner, repo, pull_number: pullNumber, per_page: 100 });
      return res.data.map((cUnknown) => {
        const c = cUnknown as {
          id: number;
          pull_request_review_id?: number | null;
          user?: { login?: string | null } | null;
          path: string;
          position?: number | null;
          body?: string | null;
          created_at: string;
          html_url: string;
        };
        return {
          id: c.id,
          pullRequestReviewId: c.pull_request_review_id ?? null,
          userLogin: c.user?.login ?? null,
          path: c.path,
          position: c.position ?? null,
          body: c.body ?? '',
          createdAt: c.created_at,
          htmlUrl: c.html_url,
        };
      });
    },

    async listCheckRunsForPull({ owner, repo, pullNumber }) {
      const prRes = await octokit.pulls.get({ owner, repo, pull_number: pullNumber });
      const pr = prRes.data as { head?: { sha?: string } };
      const headSha = pr.head?.sha;
      if (!headSha) throw new Error('Unable to determine PR head SHA');

      const res = await octokit.checks.listForRef({ owner, repo, ref: headSha, per_page: 100 });
      return res.data.check_runs.map((rUnknown) => {
        const r = rUnknown as {
          id: number;
          name: string;
          status: string;
          conclusion?: string | null;
          details_url?: string | null;
        };
        return {
          id: r.id,
          name: r.name,
          status: r.status,
          conclusion: r.conclusion ?? null,
          detailsUrl: r.details_url ?? null,
        };
      });
    },
  };
}
