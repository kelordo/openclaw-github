import type { RequestError } from '@octokit/request-error';

export type CliError = {
  message: string;
  code: number;
};

function isOctokitRequestError(err: unknown): err is RequestError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    typeof (err as { status?: unknown }).status === 'number' &&
    'message' in err &&
    typeof (err as { message?: unknown }).message === 'string'
  );
}

function getHeader(err: RequestError, header: string): string | undefined {
  const headers = err.response?.headers as Record<string, string | undefined> | undefined;
  if (!headers) return undefined;
  return headers[header] ?? headers[header.toLowerCase()];
}

export function formatCliError(err: unknown): CliError {
  if (err instanceof Error && err.message.includes('GITHUB_TOKEN is required')) {
    return { message: err.message, code: 2 };
  }

  if (isOctokitRequestError(err)) {
    const status = err.status;
    const msg = err.message;

    const requestId = getHeader(err, 'x-github-request-id');
    const suffix = requestId ? ` (request id: ${requestId})` : '';

    if (status === 401) {
      return { message: `GitHub authentication failed. Check GITHUB_TOKEN.${suffix}`, code: 2 };
    }

    if (status === 403) {
      const isRateLimit = /rate limit/i.test(msg);
      const retryAfter = getHeader(err, 'retry-after');
      if (isRateLimit) {
        return {
          message: `GitHub API rate limit exceeded. Try again later${retryAfter ? ` (retry-after: ${retryAfter}s)` : ''}.${suffix}`,
          code: 3,
        };
      }

      return {
        message: `GitHub API denied the request (403). Your token may be missing permissions.${suffix}`,
        code: 2,
      };
    }

    if (status === 404) {
      return {
        message: `GitHub resource not found (404). Check the repo/PR number and token permissions.${suffix}`,
        code: 2,
      };
    }

    return { message: `GitHub API error (${status}): ${msg}${suffix}`, code: 2 };
  }

  const msg = err instanceof Error ? err.message : String(err);
  return { message: msg, code: 2 };
}
