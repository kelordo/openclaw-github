import { describe, expect, it } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

import { main } from '../src/cli.js';

function sh(cmd: string, args: string[], cwd: string) {
  return execFileSync(cmd, args, { cwd, stdio: 'pipe' }).toString('utf8');
}

describe('cli git status', () => {
  it('prints grouped text by default', async () => {
    const dir = join(tmpdir(), `openclaw-github-cli-git-${Date.now()}`);
    mkdirSync(dir, { recursive: true });

    try {
      sh('git', ['init'], dir);
      sh('git', ['config', 'user.email', 'test@example.com'], dir);
      sh('git', ['config', 'user.name', 'Test'], dir);

      writeFileSync(join(dir, 'README.md'), 'hello\n', 'utf8');
      sh('git', ['add', '.'], dir);
      sh('git', ['commit', '-m', 'init'], dir);

      const writes: string[] = [];
      const origWrite = process.stdout.write;
      process.stdout.write = (chunk: unknown) => {
        writes.push(String(chunk));
        return true;
      };

      try {
        const code = await main(['node', 'pr-autopilot', 'git', 'status', '--cwd', dir]);
        expect(code).toBe(0);

        const out = writes.join('');
        expect(out).toContain('On branch');
        expect(out).toContain('Working tree clean');
      } finally {
        process.stdout.write = origWrite;
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('prints JSON envelope when --json-envelope is set', async () => {
    const dir = join(tmpdir(), `openclaw-github-cli-git-${Date.now()}`);
    mkdirSync(dir, { recursive: true });

    try {
      sh('git', ['init'], dir);
      sh('git', ['config', 'user.email', 'test@example.com'], dir);
      sh('git', ['config', 'user.name', 'Test'], dir);

      writeFileSync(join(dir, 'README.md'), 'hello\n', 'utf8');
      sh('git', ['add', '.'], dir);
      sh('git', ['commit', '-m', 'init'], dir);

      const writes: string[] = [];
      const origWrite = process.stdout.write;
      process.stdout.write = (chunk: unknown) => {
        writes.push(String(chunk));
        return true;
      };

      try {
        const code = await main([
          'node',
          'pr-autopilot',
          'git',
          'status',
          '--cwd',
          dir,
          '--json',
          '--json-envelope',
        ]);
        expect(code).toBe(0);

        const parsed = JSON.parse(writes.join('')) as {
          schema: string;
          data: { branch: string; clean: boolean; porcelain: string[] };
        };

        expect(parsed.schema).toBe('pr-autopilot/git-status@1');
        expect(parsed.data).toHaveProperty('branch');
        expect(typeof parsed.data.branch).toBe('string');
        expect(parsed.data).toHaveProperty('clean');
        expect(parsed.data).toHaveProperty('porcelain');
      } finally {
        process.stdout.write = origWrite;
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
