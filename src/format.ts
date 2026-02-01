import type { CheckRunSummary, PullDetails, ReviewComment } from './github/api.js';

export function normalizeOneLine(s: string): string {
  return s.replaceAll(/\s+/g, ' ').trim();
}

type Group<T> = { key: string; items: T[] };

export function groupByKey<T>(items: T[], keyFn: (t: T) => string): Group<T>[] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const arr = map.get(key);
    if (arr) arr.push(item);
    else map.set(key, [item]);
  }
  return [...map.entries()].map(([key, items]) => ({ key, items }));
}

function compareNullableNumber(a: number | null, b: number | null): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a - b;
}

export function formatCommentsGrouped(comments: ReviewComment[]): string {
  if (comments.length === 0) return '';

  const groups = groupByKey(comments, (c) => c.path).sort((a, b) => a.key.localeCompare(b.key));
  const lines: string[] = [];

  for (const g of groups) {
    lines.push(`${g.key} (${g.items.length})`);

    const sorted = [...g.items].sort((a, b) => {
      const posCmp = compareNullableNumber(a.position, b.position);
      if (posCmp !== 0) return posCmp;
      // createdAt is ISO from GitHub; lexical sort works, but keep safe.
      const dateCmp = a.createdAt.localeCompare(b.createdAt);
      if (dateCmp !== 0) return dateCmp;
      return a.id - b.id;
    });

    for (const c of sorted) {
      const who = c.userLogin ?? 'unknown';
      const body = normalizeOneLine(c.body);
      const pos = c.position != null ? ` (pos ${c.position})` : '';
      const url = c.htmlUrl ? ` ${c.htmlUrl}` : '';
      lines.push(`  - #${c.id} ${who}${pos}: ${body}${url}`);
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd() + '\n';
}

type CheckBucket = 'failed' | 'pending' | 'success' | 'neutral' | 'unknown';

function bucketCheck(r: CheckRunSummary): CheckBucket {
  const status = r.status;
  const conclusion = r.conclusion;

  if (status !== 'completed') return 'pending';
  if (conclusion === 'success') return 'success';
  if (conclusion === 'neutral' || conclusion === 'skipped' || conclusion === 'cancelled') return 'neutral';
  if (conclusion === 'failure' || conclusion === 'timed_out' || conclusion === 'action_required') return 'failed';
  return 'unknown';
}

const BUCKET_ORDER: CheckBucket[] = ['failed', 'pending', 'unknown', 'neutral', 'success'];

export function formatChecksGrouped(runs: CheckRunSummary[]): string {
  if (runs.length === 0) return '';

  const buckets = new Map<CheckBucket, CheckRunSummary[]>();
  for (const r of runs) {
    const b = bucketCheck(r);
    const arr = buckets.get(b);
    if (arr) arr.push(r);
    else buckets.set(b, [r]);
  }

  const lines: string[] = [];
  for (const b of BUCKET_ORDER) {
    const items = buckets.get(b);
    if (!items || items.length === 0) continue;

    lines.push(`${b} (${items.length})`);
    const sorted = [...items].sort((a, c) => a.name.localeCompare(c.name));
    for (const r of sorted) {
      const concl = r.conclusion ?? '-';
      const url = r.detailsUrl ?? '';
      lines.push(`  - ${r.name}: ${r.status}${concl !== '-' ? `/${concl}` : ''}${url ? ` ${url}` : ''}`);
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd() + '\n';
}

export function formatPrPlanText(input: {
  pull: PullDetails;
  comments: ReviewComment[];
  checks: CheckRunSummary[];
}): string {
  const { pull, comments, checks } = input;

  const lines: string[] = [];
  lines.push(`PR #${pull.number}: ${pull.title}`);
  lines.push(`${pull.htmlUrl}`);
  lines.push(`State: ${pull.state}${pull.draft ? ' (draft)' : ''}`);
  lines.push('');

  lines.push(`Review comments (${comments.length})`);
  if (comments.length === 0) lines.push('  (none)');
  else lines.push(formatCommentsGrouped(comments).trimEnd());
  lines.push('');

  lines.push(`Checks (${checks.length})`);
  if (checks.length === 0) lines.push('  (none)');
  else lines.push(formatChecksGrouped(checks).trimEnd());

  return lines.join('\n').trimEnd() + '\n';
}
