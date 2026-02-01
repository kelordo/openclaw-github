import { z } from 'zod';

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

export type PullDetails = {
  number: number;
  title: string;
  state: 'open' | 'closed';
  draft?: boolean;
  htmlUrl: string;
  headSha: string;
};

export type GitHubApi = {
  listPulls(params: { owner: string; repo: string; state?: 'open' | 'closed' | 'all' }): Promise<PullRequestSummary[]>;
  getPull(params: { owner: string; repo: string; pullNumber: number }): Promise<PullDetails>;
  listReviewComments(params: { owner: string; repo: string; pullNumber: number }): Promise<ReviewComment[]>;
  listCheckRunsForRef(params: { owner: string; repo: string; ref: string }): Promise<CheckRunSummary[]>;
  listCheckRunsForPull(params: { owner: string; repo: string; pullNumber: number }): Promise<CheckRunSummary[]>;
};

export type PullsListArgs = {
  owner: string;
  repo: string;
  state?: 'open' | 'closed' | 'all';
  per_page?: number;
  page?: number;
};

export type PullsListReviewCommentsArgs = {
  owner: string;
  repo: string;
  pull_number: number;
  per_page?: number;
  page?: number;
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
  page?: number;
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

const PullSchema = z.object({
  number: z.number(),
  title: z.string(),
  state: z.union([z.literal('open'), z.literal('closed')]),
  draft: z.boolean().optional(),
  html_url: z.string(),
});

const ReviewCommentSchema = z.object({
  id: z.number(),
  pull_request_review_id: z.number().nullable().optional(),
  user: z
    .object({
      login: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  path: z.string(),
  position: z.number().nullable().optional(),
  body: z.string().nullable().optional(),
  created_at: z.string(),
  html_url: z.string(),
});

const PullGetSchema = z.object({
  number: z.number().optional(),
  title: z.string().optional(),
  state: z.union([z.literal('open'), z.literal('closed')]).optional(),
  draft: z.boolean().optional(),
  html_url: z.string().optional(),
  head: z
    .object({
      sha: z.string().optional(),
    })
    .optional(),
});

const CheckRunSchema = z.object({
  id: z.number(),
  name: z.string(),
  status: z.string(),
  conclusion: z.string().nullable().optional(),
  details_url: z.string().nullable().optional(),
});

function parseOrThrow<T>(schema: z.ZodSchema<T>, value: unknown, what: string): T {
  const res = schema.safeParse(value);
  if (!res.success) {
    throw new Error(`Unexpected GitHub API response for ${what}`);
  }
  return res.data;
}

export function createGitHubApi(octokit: OctokitLike): GitHubApi {
  async function listPulls({ owner, repo, state = 'open' }: { owner: string; repo: string; state?: 'open' | 'closed' | 'all' }) {
    const perPage = 100;
    const data: unknown[] = [];

    for (let page = 1; page <= 100; page++) {
      const res = await octokit.pulls.list({ owner, repo, state, per_page: perPage, page });
      data.push(...res.data);
      if (res.data.length < perPage) break;
    }

    return data.map((prUnknown) => {
      const pr = parseOrThrow(PullSchema, prUnknown, 'pulls.list item');
      return {
        number: pr.number,
        title: pr.title,
        state: pr.state,
        draft: pr.draft,
        htmlUrl: pr.html_url,
      };
    });
  }

  async function getPull({ owner, repo, pullNumber }: { owner: string; repo: string; pullNumber: number }) {
    const prRes = await octokit.pulls.get({ owner, repo, pull_number: pullNumber });
    const pr = parseOrThrow(PullGetSchema, prRes.data, 'pulls.get');

    if (pr.number == null || pr.title == null || pr.state == null || pr.html_url == null) {
      throw new Error('Unexpected GitHub API response for pulls.get');
    }

    const headSha = pr.head?.sha;
    if (!headSha) throw new Error('Unable to determine PR head SHA');

    return {
      number: pr.number,
      title: pr.title,
      state: pr.state,
      draft: pr.draft,
      htmlUrl: pr.html_url,
      headSha,
    };
  }

  async function listReviewComments({ owner, repo, pullNumber }: { owner: string; repo: string; pullNumber: number }) {
    const perPage = 100;
    const data: unknown[] = [];

    for (let page = 1; page <= 100; page++) {
      const res = await octokit.pulls.listReviewComments({
        owner,
        repo,
        pull_number: pullNumber,
        per_page: perPage,
        page,
      });
      data.push(...res.data);
      if (res.data.length < perPage) break;
    }

    return data.map((cUnknown) => {
      const c = parseOrThrow(ReviewCommentSchema, cUnknown, 'pulls.listReviewComments item');
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
  }

  async function listCheckRunsForRef({ owner, repo, ref }: { owner: string; repo: string; ref: string }) {
    const perPage = 100;
    const runs: unknown[] = [];

    for (let page = 1; page <= 100; page++) {
      const res = await octokit.checks.listForRef({ owner, repo, ref, per_page: perPage, page });
      runs.push(...res.data.check_runs);
      if (res.data.check_runs.length < perPage) break;
    }

    return runs.map((rUnknown) => {
      const r = parseOrThrow(CheckRunSchema, rUnknown, 'checks.listForRef check_run');
      return {
        id: r.id,
        name: r.name,
        status: r.status,
        conclusion: r.conclusion ?? null,
        detailsUrl: r.details_url ?? null,
      };
    });
  }

  async function listCheckRunsForPull({ owner, repo, pullNumber }: { owner: string; repo: string; pullNumber: number }) {
    const pr = await getPull({ owner, repo, pullNumber });
    return listCheckRunsForRef({ owner, repo, ref: pr.headSha });
  }

  return {
    listPulls,
    getPull,
    listReviewComments,
    listCheckRunsForRef,
    listCheckRunsForPull,
  };
}
