import { readEnv, parsePullRequestUrl, parseRepoSlug } from './config.js';
import { createOctokit } from './github/octokit.js';
import { createGitHubApi } from './github/api.js';
import { formatJson } from './output.js';
import { formatChecksGrouped, formatCommentsGrouped, formatPrPlanText, formatPullsGrouped } from './format.js';
import { getCurrentBranch, getStatusPorcelain } from './git/git.js';
import { formatCliError } from './errors.js';
import { readPackageVersion } from './version.js';

type CommandResult = { code: number; stdout?: string; stderr?: string };

function usage(): string {
  return [
    'pr-autopilot (WIP)',
    '',
    'Usage:',
    '  pr-autopilot ping',
    '  pr-autopilot --version',
    '  pr-autopilot pr list --repo owner/name [--state open|closed|all] [--json] [--pretty] [--json-envelope]',
    '  pr-autopilot pr comments (--repo owner/name --pr <number> | --pr-url <url>) [--json] [--pretty] [--json-envelope]',
    '  pr-autopilot pr checks (--repo owner/name --pr <number> | --pr-url <url>) [--json] [--pretty] [--json-envelope]',
    '  pr-autopilot pr plan (--repo owner/name --pr <number> | --pr-url <url>) [--only-attention] [--json] [--pretty] [--json-envelope]',
    '  pr-autopilot git status [--cwd <path>] [--json] [--pretty] [--json-envelope]',
    '',
    'Env:',
    '  GITHUB_TOKEN (required for GitHub commands)',
    '',
  ].join('\n');
}

function getFlag(args: string[], name: string): string | undefined {
  const idx = args.indexOf(name);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

function requireToken(): string {
  const env = readEnv();
  if (!env.GITHUB_TOKEN) throw new Error('GITHUB_TOKEN is required for this command');
  return env.GITHUB_TOKEN;
}

function getPullRef(args: string[]): { owner: string; repo: string; pullNumber: number } {
  const prUrl = getFlag(args, '--pr-url');
  if (prUrl) return parsePullRequestUrl(prUrl);

  const repoSlug = getFlag(args, '--repo');
  const prStr = getFlag(args, '--pr');
  if (!repoSlug) throw new Error('Missing --repo owner/name');
  if (!prStr) throw new Error('Missing --pr <number>');
  const pullNumber = Number(prStr);
  if (!Number.isInteger(pullNumber) || pullNumber <= 0) throw new Error('Invalid --pr <number>');

  const { owner, repo } = parseRepoSlug(repoSlug);
  return { owner, repo, pullNumber };
}

export async function main(argv: string[]): Promise<number> {
  const args = argv.slice(2);
  if (args.length === 0 || hasFlag(args, '--help') || hasFlag(args, '-h')) {
    process.stdout.write(usage());
    return 0;
  }

  if (hasFlag(args, '--version') || hasFlag(args, '-v')) {
    process.stdout.write(readPackageVersion() + '\n');
    return 0;
  }

  const [top, sub] = args;

  try {
    const res = await dispatch(args, top, sub);
    if (res.stdout) process.stdout.write(res.stdout);
    if (res.stderr) process.stderr.write(res.stderr);
    return res.code;
  } catch (err: unknown) {
    const formatted = formatCliError(err);
    process.stderr.write(`${formatted.message}\n`);
    return formatted.code;
  }
}

async function dispatch(args: string[], top: string, sub?: string): Promise<CommandResult> {
  if (top === 'ping') {
    return { code: 0, stdout: 'pong\n' };
  }

  if (top === 'pr' && sub === 'list') {
    const repoSlug = getFlag(args, '--repo');
    if (!repoSlug) throw new Error('Missing --repo owner/name');
    const state = (getFlag(args, '--state') as 'open' | 'closed' | 'all' | undefined) ?? 'open';

    const token = requireToken();
    const { owner, repo } = parseRepoSlug(repoSlug);
    const api = createGitHubApi(createOctokit(token));
    const prs = await api.listPulls({ owner, repo, state });

    if (hasFlag(args, '--json')) {
      const payload = hasFlag(args, '--json-envelope')
        ? { schema: 'pr-autopilot/pr-list@1', data: prs }
        : prs;
      return { code: 0, stdout: formatJson(payload, { pretty: hasFlag(args, '--pretty') }) };
    }

    const text = formatPullsGrouped(prs);
    return { code: 0, stdout: text.length ? text : '(none)\n' };
  }

  if (top === 'pr' && sub === 'comments') {
    const token = requireToken();
    const { owner, repo, pullNumber } = getPullRef(args);
    const api = createGitHubApi(createOctokit(token));
    const comments = await api.listReviewComments({ owner, repo, pullNumber });

    if (hasFlag(args, '--json')) {
      const payload = hasFlag(args, '--json-envelope')
        ? { schema: 'pr-autopilot/pr-comments@1', data: comments }
        : comments;
      return { code: 0, stdout: formatJson(payload, { pretty: hasFlag(args, '--pretty') }) };
    }

    const text = formatCommentsGrouped(comments);
    return { code: 0, stdout: text.length ? text : '(none)\n' };
  }

  if (top === 'pr' && sub === 'checks') {
    const token = requireToken();
    const { owner, repo, pullNumber } = getPullRef(args);
    const api = createGitHubApi(createOctokit(token));
    const checks = await api.listCheckRunsForPull({ owner, repo, pullNumber });

    if (hasFlag(args, '--json')) {
      const payload = hasFlag(args, '--json-envelope')
        ? { schema: 'pr-autopilot/pr-checks@1', data: checks }
        : checks;
      return { code: 0, stdout: formatJson(payload, { pretty: hasFlag(args, '--pretty') }) };
    }

    const text = formatChecksGrouped(checks);
    return { code: 0, stdout: text.length ? text : '(none)\n' };
  }

  if (top === 'pr' && sub === 'plan') {
    const token = requireToken();
    const { owner, repo, pullNumber } = getPullRef(args);
    const api = createGitHubApi(createOctokit(token));

    const pull = await api.getPull({ owner, repo, pullNumber });
    const [comments, checks] = await Promise.all([
      api.listReviewComments({ owner, repo, pullNumber }),
      api.listCheckRunsForRef({ owner, repo, ref: pull.headSha }),
    ]);

    if (hasFlag(args, '--json')) {
      const data = { pull, comments, checks };
      const payload = hasFlag(args, '--json-envelope') ? { schema: 'pr-autopilot/pr-plan@1', data } : data;
      return { code: 0, stdout: formatJson(payload, { pretty: hasFlag(args, '--pretty') }) };
    }

    if (hasFlag(args, '--only-attention')) {
      return { code: 0, stdout: formatPrPlanText({ pull, comments, checks }, { mode: 'attention' }) };
    }

    return { code: 0, stdout: formatPrPlanText({ pull, comments, checks }, { mode: 'full' }) };
  }

  if (top === 'git' && sub === 'status') {
    const cwd = getFlag(args, '--cwd');
    const [branch, porcelain] = await Promise.all([
      getCurrentBranch({ cwd }),
      getStatusPorcelain({ cwd }),
    ]);

    const data = { branch, clean: porcelain.length === 0, porcelain };

    if (hasFlag(args, '--json')) {
      const payload = hasFlag(args, '--json-envelope') ? { schema: 'pr-autopilot/git-status@1', data } : data;
      return { code: 0, stdout: formatJson(payload, { pretty: hasFlag(args, '--pretty') }) };
    }

    if (data.clean) {
      return { code: 0, stdout: `On branch ${data.branch}\nWorking tree clean\n` };
    }

    const lines = [
      `On branch ${data.branch}`,
      `Working tree dirty (${data.porcelain.length})`,
      ...data.porcelain.map((l) => `  ${l}`),
    ];
    return { code: 0, stdout: lines.join('\n') + '\n' };
  }

  return { code: 2, stderr: `Unknown command: ${args.join(' ')}\n\n${usage()}` };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv).then((code) => process.exit(code));
}
