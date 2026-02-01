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

type CheckBucketCounts = Record<CheckBucket, number>;

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

function countCheckBuckets(runs: CheckRunSummary[]): CheckBucketCounts {
  const counts: CheckBucketCounts = { failed: 0, pending: 0, success: 0, neutral: 0, unknown: 0 };
  for (const r of runs) counts[bucketCheck(r)]++;
  return counts;
}

function splitCheckName(name: string): { group: string; label: string } {
  // GitHub Actions check names commonly look like:
  //   "CI / test (ubuntu-latest)" or "build / linux".
  // For non-matching names, keep everything under a default group.
  const sep = ' / ';
  const idx = name.indexOf(sep);
  if (idx === -1) return { group: 'checks', label: name };

  const group = name.slice(0, idx).trim() || 'checks';
  const label = name.slice(idx + sep.length).trim() || name;
  return { group, label };
}

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

    // Within each bucket, group checks by a stable "suite" name (when present)
    // to keep large outputs readable.
    const groups = groupByKey(items, (r) => splitCheckName(r.name).group).sort((a, c) => a.key.localeCompare(c.key));
    for (const g of groups) {
      // Only show a subgroup header when it adds information.
      const showHeader = !(groups.length === 1 && g.key === 'checks');
      if (showHeader) lines.push(`  ${g.key} (${g.items.length})`);

      const sorted = [...g.items].sort((a, c) => a.name.localeCompare(c.name));
      for (const r of sorted) {
        const { label } = splitCheckName(r.name);
        const concl = r.conclusion ?? '-';
        const url = r.detailsUrl ?? '';
        const prefix = showHeader ? '    -' : '  -';
        lines.push(`${prefix} ${label}: ${r.status}${concl !== '-' ? `/${concl}` : ''}${url ? ` ${url}` : ''}`);
      }
    }

    lines.push('');
  }

  return lines.join('\n').trimEnd() + '\n';
}

function formatCheckSummary(counts: CheckBucketCounts): string {
  const parts: string[] = [];
  for (const b of BUCKET_ORDER) {
    const n = counts[b];
    if (n <= 0) continue;
    parts.push(`${b}=${n}`);
  }
  return parts.join(' ');
}

export function formatPrPlanText(input: {
  pull: PullDetails;
  comments: ReviewComment[];
  checks: CheckRunSummary[];
}): string {
  const { pull, comments, checks } = input;

  const commentFileCount = new Set(comments.map((c) => c.path)).size;
  const checkCounts = countCheckBuckets(checks);

  const lines: string[] = [];
  lines.push(`PR #${pull.number}: ${pull.title}`);
  lines.push(`${pull.htmlUrl}`);
  lines.push(`State: ${pull.state}${pull.draft ? ' (draft)' : ''}`);
  lines.push('');

  lines.push('Summary');
  lines.push(`  - Comments: ${comments.length} across ${commentFileCount} file${commentFileCount === 1 ? '' : 's'}`);
  lines.push(`  - Checks: ${checks.length}${checks.length ? ` (${formatCheckSummary(checkCounts)})` : ''}`);
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
