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
