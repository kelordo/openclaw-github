import { spawn } from 'node:child_process';

export type GitRunResult = { code: number; stdout: string; stderr: string };

export async function runGit(
  args: string[],
  opts?: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
  },
): Promise<GitRunResult> {
  return await new Promise((resolve, reject) => {
    const child = spawn('git', args, {
      cwd: opts?.cwd,
      env: opts?.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');

    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));

    child.on('error', (err) => reject(err));
    child.on('close', (code) => resolve({ code: code ?? 0, stdout, stderr }));
  });
}

export async function getStatusPorcelain(
  opts?: {
    cwd?: string;
  },
): Promise<string[]> {
  const res = await runGit(['status', '--porcelain=v1'], { cwd: opts?.cwd });
  if (res.code !== 0) {
    const err = new Error(`git status failed (code=${res.code}): ${res.stderr || res.stdout}`.trim()) as Error & {
      code?: number;
    };
    err.code = res.code;
    throw err;
  }

  return res.stdout
    .split('\n')
    .map((s) => s.trimEnd())
    .filter((s) => s.length > 0);
}

export async function isWorkingTreeClean(opts?: { cwd?: string }): Promise<boolean> {
  const lines = await getStatusPorcelain({ cwd: opts?.cwd });
  return lines.length === 0;
}

export async function getCurrentBranch(opts?: { cwd?: string }): Promise<string> {
  const res = await runGit(['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: opts?.cwd });
  if (res.code !== 0) {
    const err = new Error(`git rev-parse failed (code=${res.code}): ${res.stderr || res.stdout}`.trim()) as Error & {
      code?: number;
    };
    err.code = res.code;
    throw err;
  }

  return res.stdout.trim();
}
