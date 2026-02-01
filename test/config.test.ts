import { describe, expect, it } from 'vitest';
import { parsePullRequestUrl, parseRepoSlug } from '../src/config.js';

describe('config', () => {
  it('parses repo slug', () => {
    expect(parseRepoSlug('openclaw/pr-autopilot')).toEqual({ owner: 'openclaw', repo: 'pr-autopilot' });
  });

  it('parses pull request URL', () => {
    expect(parsePullRequestUrl('https://github.com/openclaw/pr-autopilot/pull/12')).toEqual({
      owner: 'openclaw',
      repo: 'pr-autopilot',
      pullNumber: 12,
    });
  });
});
