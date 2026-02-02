import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import type { CheckRunSummary, GitHubApi, PullDetails, PullSummary, ReviewComment } from '../src/github/api.js';
import { runWatch } from '../src/watch.js';

function makeApi(fixtures: {
  pulls: PullSummary[];
  pullDetailsByNumber: Record<number, PullDetails>;
  commentsByNumber: Record<number, ReviewComment[]>;
  checksBySha: Record<string, CheckRunSummary[]>;
}): GitHubApi {
  return {
    async listReposForOwner() {
      throw new Error('not used');
    },

    async listPulls() {
      return fixtures.pulls;
    },

    async getPull({ pullNumber }) {
      const pull = fixtures.pullDetailsByNumber[pullNumber];
      if (!pull) throw new Error(`missing pull fixture: ${pullNumber}`);
      return pull;
    },

    async listReviewComments({ pullNumber }) {
      return fixtures.commentsByNumber[pullNumber] ?? [];
    },

    async listCheckRunsForRef({ ref }) {
      return fixtures.checksBySha[ref] ?? [];
    },

    // Unused by runWatch but required by interface.
    async listCheckRunsForPull() {
      throw new Error('not used');
    },
  } satisfies GitHubApi;
}

async function readJson(p: string): Promise<any> {
  return JSON.parse(await readFile(p, 'utf8'));
}

describe('watch runWatch', () => {
  it('writes artifacts and records a new PR on first run, then no changes on second run', async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), 'pr-autopilot-watch-'));
    const statePath = path.join(tmp, 'state.json');
    const runsDir = path.join(tmp, 'runs');

    const owner = 'kelordo';
    const repo = 'openclaw-github';

    const pull: PullDetails = {
      number: 1,
      title: 'Test PR',
      state: 'open',
      draft: false,
      merged: false,
      htmlUrl: 'https://github.com/kelordo/openclaw-github/pull/1',
      headSha: 'abc',
      baseRefName: 'main',
      headRefName: 'feat',
      authorLogin: 'someone',
      updatedAt: '2020-01-01T00:00:00Z',
    };

    const api1 = makeApi({
      pulls: [{ number: 1, title: pull.title, htmlUrl: pull.htmlUrl, updatedAt: pull.updatedAt }],
      pullDetailsByNumber: { 1: pull },
      commentsByNumber: { 1: [] },
      checksBySha: { abc: [{ id: 10, name: 'ci', status: 'completed', conclusion: 'success', detailsUrl: null }] },
    });

    const now1 = '2026-02-02T07:00:00.000Z';
    const res1 = await runWatch({ api: api1, owner, repos: [repo], statePath, runsDir, nowIso: now1 });

    expect(res1.changes).toHaveLength(1);
    expect(res1.changes[0]).toMatchObject({ owner, repo, pullNumber: 1 });
    expect(res1.changes[0].reasons).toContain('new-pr');

    const dayDir = path.join(runsDir, '2026-02-02');
    const base = `pr-${owner}-${repo}-1`;
    const summaryPath = path.join(dayDir, `${base}-summary.txt`);
    const planTxtPath = path.join(dayDir, `${base}-plan.txt`);
    const planJsonPath = path.join(dayDir, `${base}-plan.json`);

    const [summary, planTxt, planJson] = await Promise.all([
      readFile(summaryPath, 'utf8'),
      readFile(planTxtPath, 'utf8'),
      readJson(planJsonPath),
    ]);

    expect(summary).toContain(pull.htmlUrl);
    expect(planTxt).toContain(`PR #${pull.number}: ${pull.title}`);
    expect(planTxt).toContain('Summary');
    expect(planJson.schema).toBe('pr-autopilot/pr-plan@1');
    expect(planJson.data.pull.number).toBe(1);

    // Second run with identical data should be stable and produce no changes.
    const now2 = '2026-02-02T07:15:00.000Z';
    const api2 = api1;
    const res2 = await runWatch({ api: api2, owner, repos: [repo], statePath, runsDir, nowIso: now2 });

    expect(res2.changes).toHaveLength(0);

    const state = await readJson(statePath);
    expect(state.schema).toBe('pr-autopilot/watch-state@1');
    expect(state.owner).toBe(owner);
    expect(state.repos[repo].prs['1'].commentsFingerprint).toMatch(/^sha256:/);
    expect(state.repos[repo].prs['1'].checksFingerprint).toMatch(/^sha256:/);
  });

  it('detects comment changes and marks actionNeeded', async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), 'pr-autopilot-watch-'));
    const statePath = path.join(tmp, 'state.json');
    const runsDir = path.join(tmp, 'runs');

    const owner = 'kelordo';
    const repo = 'openclaw-github';

    const pull: PullDetails = {
      number: 2,
      title: 'Another PR',
      state: 'open',
      draft: false,
      merged: false,
      htmlUrl: 'https://github.com/kelordo/openclaw-github/pull/2',
      headSha: 'def',
      baseRefName: 'main',
      headRefName: 'feat2',
      authorLogin: 'someone',
      updatedAt: '2020-01-01T00:00:00Z',
    };

    const baseFixtures = {
      pulls: [{ number: 2, title: pull.title, htmlUrl: pull.htmlUrl, updatedAt: pull.updatedAt }],
      pullDetailsByNumber: { 2: pull },
      checksBySha: { def: [] as CheckRunSummary[] },
    };

    // Initial run: no comments.
    const api1 = makeApi({ ...baseFixtures, commentsByNumber: { 2: [] } });
    await runWatch({ api: api1, owner, repos: [repo], statePath, runsDir, nowIso: '2026-02-02T07:00:00.000Z' });

    // Second run: new comment appears.
    const api2 = makeApi({
      ...baseFixtures,
      commentsByNumber: {
        2: [
          {
            id: 99,
            pullRequestReviewId: null,
            userLogin: 'reviewer',
            path: 'a.ts',
            position: 1,
            body: 'Please fix',
            createdAt: '2026-02-02T07:10:00.000Z',
            htmlUrl: 'https://example.test/c',
          },
        ],
      },
    });

    const res = await runWatch({ api: api2, owner, repos: [repo], statePath, runsDir, nowIso: '2026-02-02T07:15:00.000Z' });

    expect(res.changes).toHaveLength(1);
    expect(res.changes[0].reasons).toContain('comments-changed');
    expect(res.changes[0].actionNeeded).toBe(true);
  });
});
