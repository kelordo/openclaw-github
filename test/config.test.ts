import { describe, expect, it } from 'vitest';
import { parseRepoSlug } from '../src/config.js';

describe('config', () => {
  it('parses repo slug', () => {
    expect(parseRepoSlug('openclaw/pr-autopilot')).toEqual({ owner: 'openclaw', repo: 'pr-autopilot' });
  });
});
