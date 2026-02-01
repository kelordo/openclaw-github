import { z } from 'zod';

export const RepoSlugSchema = z
  .string()
  .min(3)
  .refine((s) => s.includes('/'), 'repo must be in the form "owner/name"');

export function parseRepoSlug(repo: string): { owner: string; repo: string } {
  const parsed = RepoSlugSchema.parse(repo);
  const [owner, name] = parsed.split('/', 2);
  if (!owner || !name) throw new Error(`Invalid repo: ${repo}`);
  return { owner, repo: name };
}

export const PullRequestUrlSchema = z.string().min(1);

export function parsePullRequestUrl(url: string): { owner: string; repo: string; pullNumber: number } {
  const input = PullRequestUrlSchema.parse(url);

  let u: URL;
  try {
    // Allow bare `github.com/...` by implicitly adding https.
    u = input.startsWith('http://') || input.startsWith('https://') ? new URL(input) : new URL(`https://${input}`);
  } catch {
    throw new Error(`Invalid --pr-url: ${url}`);
  }

  // We only support GitHub web URLs for now.
  if (u.hostname !== 'github.com') throw new Error(`Unsupported --pr-url host: ${u.hostname}`);

  // Expected: /{owner}/{repo}/pull/{number}
  const parts = u.pathname.split('/').filter(Boolean);
  const [owner, repo, pullLiteral, numberLiteral] = parts;

  if (!owner || !repo || pullLiteral !== 'pull' || !numberLiteral) {
    throw new Error(`Invalid GitHub PR URL: ${url}`);
  }

  const pullNumber = Number(numberLiteral);
  if (!Number.isInteger(pullNumber) || pullNumber <= 0) throw new Error(`Invalid GitHub PR number in URL: ${url}`);

  return { owner, repo, pullNumber };
}

const EnvSchema = z.object({
  GITHUB_TOKEN: z.string().min(1).optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export function readEnv(input: NodeJS.ProcessEnv = process.env): Env {
  // We keep token optional to allow non-GitHub commands (like ping) to run.
  return EnvSchema.parse({
    GITHUB_TOKEN: input.GITHUB_TOKEN,
  });
}
