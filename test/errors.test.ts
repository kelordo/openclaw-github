import { describe, expect, it } from 'vitest';
import { formatCliError } from '../src/errors.js';

// Lightweight shape-compatible fake of @octokit/request-error
function makeRequestError(params: {
  status: number;
  message: string;
  headers?: Record<string, string>;
}) {
  return {
    status: params.status,
    message: params.message,
    response: {
      headers: params.headers ?? {},
    },
  };
}

describe('formatCliError', () => {
  it('formats 401 auth errors', () => {
    const err = makeRequestError({ status: 401, message: 'Bad credentials' });
    expect(formatCliError(err).message).toMatch(/authentication failed/i);
  });

  it('formats rate limit 403 errors and includes retry-after', () => {
    const err = makeRequestError({
      status: 403,
      message: 'API rate limit exceeded',
      headers: { 'retry-after': '120' },
    });
    const out = formatCliError(err);
    expect(out.code).toBe(3);
    expect(out.message).toMatch(/rate limit/i);
    expect(out.message).toMatch(/retry-after: 120s/);
  });

  it('formats rate limit 403 errors and can include reset time', () => {
    const err = makeRequestError({
      status: 403,
      message: 'API rate limit exceeded',
      headers: { 'x-ratelimit-reset': '1700000000' },
    });
    const out = formatCliError(err);
    expect(out.code).toBe(3);
    expect(out.message).toMatch(/resets at:/i);
    expect(out.message).toMatch(/2023-11-14T22:13:20\.000Z/);
  });

  it('formats 403 forbidden errors and can include scope hints', () => {
    const err = makeRequestError({
      status: 403,
      message: 'Resource not accessible by integration',
      headers: {
        'x-oauth-scopes': 'repo, read:org',
        'x-accepted-oauth-scopes': 'repo',
      },
    });

    const out = formatCliError(err);
    expect(out.code).toBe(2);
    expect(out.message).toMatch(/denied/i);
    expect(out.message).toMatch(/token scopes:/i);
    expect(out.message).toMatch(/required scopes:/i);
  });

  it('formats 404 errors', () => {
    const err = makeRequestError({ status: 404, message: 'Not Found' });
    expect(formatCliError(err).message).toMatch(/not found/i);
  });
});
