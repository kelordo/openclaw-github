import { describe, expect, test } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { getCurrentBranch, getStatusPorcelain, isWorkingTreeClean } from '../src/git/git.js';

function sh(cmd: string, args: string[], cwd: string) {
  return execFileSync(cmd, args, { cwd, stdio: 'pipe' }).toString('utf8');
}

describe('git helpers', () => {
  test('detects clean vs dirty working tree', async () => {
    const dir = mkdirSync(join(tmpdir(), `pr-autopilot-git-test-${Date.now()}`), { recursive: true });

    try {
      sh('git', ['init'], dir);
      sh('git', ['config', 'user.email', 'test@example.com'], dir);
      sh('git', ['config', 'user.name', 'Test'], dir);

      writeFileSync(join(dir, 'README.md'), 'hello\n', 'utf8');
      sh('git', ['add', '.'], dir);
      sh('git', ['commit', '-m', 'init'], dir);

      expect(await isWorkingTreeClean({ cwd: dir })).toBe(true);
      expect(await getStatusPorcelain({ cwd: dir })).toEqual([]);

      // Make it dirty.
      writeFileSync(join(dir, 'README.md'), 'hello world\n', 'utf8');
      const lines = await getStatusPorcelain({ cwd: dir });
      expect(lines.length).toBeGreaterThan(0);
      expect(await isWorkingTreeClean({ cwd: dir })).toBe(false);

      const branch = await getCurrentBranch({ cwd: dir });
      expect(branch).toBeTypeOf('string');
      expect(branch.length).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
