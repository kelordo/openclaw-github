import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { formatPrPlanText } from './format.js';
import { formatJson } from './output.js';
import type { CheckRunSummary, GitHubApi, PullDetails, ReviewComment } from './github/api.js';

export type WatchStateV1 = {
  schema: 'pr-autopilot/watch-state@1';
  updatedAt: string | null;
  owner: string;
  repos: Record<
    string,
    {
      prs?: Record<
        string,
        {
          updatedAt?: string;
          commentsFingerprint?: string;
          checksFingerprint?: string;
        }
      >;
    }
  >;
};

export type WatchChange = {
  owner: string;
  repo: string;
  pullNumber: number;
  pullUrl: string;
  reasons: string[];
  actionNeeded: boolean;
};

export type WatchResult = {
  schema: 'pr-autopilot/watch@1';
  ranAt: string;
  owner: string;
  changes: WatchChange[];
  statePath: string;
  runsDir: string;
};

function sha256(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function stableStringify(value: unknown): string {
  // Only supports primitives/arrays/objects; enough for our normalized inputs.
  if (value === null) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

export function fingerprintReviewComments(comments: ReviewComment[]): string {
  const normalized = comments
    .map((c) => ({ id: c.id, createdAt: c.createdAt }))
    .sort((a, b) => a.id - b.id);
  return sha256(stableStringify(normalized));
}

export function fingerprintCheckRuns(runs: CheckRunSummary[]): string {
  const normalized = runs
    .map((r) => ({ id: r.id, name: r.name, status: r.status, conclusion: r.conclusion }))
    .sort((a, b) => (a.name === b.name ? a.id - b.id : a.name.localeCompare(b.name)));
  return sha256(stableStringify(normalized));
}

export async function readWatchState(statePath: string, owner: string): Promise<WatchStateV1> {
  try {
    const raw = await readFile(statePath, 'utf8');
    const parsed = JSON.parse(raw) as WatchStateV1;
    if (parsed?.schema !== 'pr-autopilot/watch-state@1') throw new Error('invalid schema');
    if (parsed.owner !== owner) {
      return { schema: 'pr-autopilot/watch-state@1', updatedAt: null, owner, repos: {} };
    }
    return parsed;
  } catch {
    return { schema: 'pr-autopilot/watch-state@1', updatedAt: null, owner, repos: {} };
  }
}

export async function writeWatchState(statePath: string, state: WatchStateV1): Promise<void> {
  await mkdir(path.dirname(statePath), { recursive: true });
  await writeFile(statePath, formatJson(state, { pretty: true }), 'utf8');
}

function isActionNeeded({ comments, checks }: { comments: ReviewComment[]; checks: CheckRunSummary[] }): boolean {
  if (comments.length > 0) return true;
  const bad = new Set(['failure', 'timed_out', 'cancelled', 'action_required']);
  return checks.some((c) => c.conclusion != null && bad.has(c.conclusion));
}

export async function runWatch(params: {
  api: GitHubApi;
  owner: string;
  repos: string[];
  statePath: string;
  runsDir: string;
  nowIso: string;
}): Promise<WatchResult> {
  const { api, owner, repos, statePath, runsDir, nowIso } = params;

  const state = await readWatchState(statePath, owner);
  const changes: WatchChange[] = [];

  for (const repo of repos) {
    const prs = await api.listPulls({ owner, repo, state: 'open' });
    for (const pr of prs) {
      const prKey = String(pr.number);
      const prev = state.repos?.[repo]?.prs?.[prKey];

      const reasons: string[] = [];
      if (!prev) reasons.push('new-pr');

      const pull = await api.getPull({ owner, repo, pullNumber: pr.number });
      const [comments, checks] = await Promise.all([
        api.listReviewComments({ owner, repo, pullNumber: pr.number }),
        api.listCheckRunsForRef({ owner, repo, ref: pull.headSha }),
      ]);
      const commentsFingerprint = fingerprintReviewComments(comments);
      const checksFingerprint = fingerprintCheckRuns(checks);

      if (prev?.commentsFingerprint && prev.commentsFingerprint !== commentsFingerprint) reasons.push('comments-changed');
      if (prev?.checksFingerprint && prev.checksFingerprint !== checksFingerprint) reasons.push('checks-changed');
      if (prev && (!prev.commentsFingerprint || !prev.checksFingerprint)) reasons.push('state-upgrade');

      const changed = reasons.length > 0;
      if (changed) {
        const actionNeeded = isActionNeeded({ comments, checks });
        changes.push({
          owner,
          repo,
          pullNumber: pr.number,
          pullUrl: pull.htmlUrl,
          reasons,
          actionNeeded,
        });

        await writeRunArtifacts({
          owner,
          repo,
          pull,
          comments,
          checks,
          runsDir,
          runDate: nowIso.slice(0, 10),
        });
      }

      state.repos[repo] ??= {};
      state.repos[repo].prs ??= {};
      state.repos[repo].prs![prKey] = {
        updatedAt: nowIso,
        commentsFingerprint,
        checksFingerprint,
      };
    }
  }

  state.updatedAt = nowIso;
  await writeWatchState(statePath, state);

  return {
    schema: 'pr-autopilot/watch@1',
    ranAt: nowIso,
    owner,
    changes,
    statePath,
    runsDir,
  };
}

async function writeRunArtifacts(params: {
  owner: string;
  repo: string;
  pull: PullDetails;
  comments: ReviewComment[];
  checks: CheckRunSummary[];
  runsDir: string;
  runDate: string;
}): Promise<void> {
  const { owner, repo, pull, comments, checks, runsDir, runDate } = params;
  const dir = path.join(runsDir, runDate);
  await mkdir(dir, { recursive: true });

  const base = `pr-${owner}-${repo}-${pull.number}`;

  const summaryLines = [
    `PR: ${pull.htmlUrl}`,
    `Title: ${pull.title}`,
    `State: ${pull.state}${pull.draft ? ' (draft)' : ''}${pull.merged ? ' (merged)' : ''}`,
    `Comments: ${comments.length}`,
    `Checks: ${checks.length}`,
  ];

  await writeFile(path.join(dir, `${base}-summary.txt`), summaryLines.join('\n') + '\n', 'utf8');

  const planText = formatPrPlanText({ pull, comments, checks }, { mode: 'full' });
  await writeFile(path.join(dir, `${base}-plan.txt`), planText, 'utf8');

  const envelope = {
    schema: 'pr-autopilot/pr-plan@1',
    data: { pull, comments, checks },
  };
  await writeFile(path.join(dir, `${base}-plan.json`), formatJson(envelope, { pretty: true }), 'utf8');
}
