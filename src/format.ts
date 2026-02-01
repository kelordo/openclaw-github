import type { CheckRunSummary, PullDetails, PullRequestSummary, ReviewComment } from './github/api.js';

export function normalizeOneLine(s: string): string {
  return s.replaceAll(/\s+/g, ' ').trim();
}

function indentBlock(text: string, prefix = '  '): string {
  return text
    .split('\n')
    .map((line) => (line.length ? prefix + line : line))
    .join('\n');
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

export function formatPullsGrouped(prs: PullRequestSummary[]): string {
  if (prs.length === 0) return '';

  // Bucket PRs into action-oriented groups. This keeps output stable across
  // different `--state` values and surfaces what you likely care about first.
  type Bucket = 'open' | 'draft' | 'merged' | 'closed';

  function bucket(pr: PullRequestSummary): Bucket {
    if (pr.state === 'open') return pr.draft ? 'draft' : 'open';
    return pr.merged ? 'merged' : 'closed';
  }

  const BUCKET_ORDER: Bucket[] = ['open', 'draft', 'merged', 'closed'];
  const groups = groupByKey(prs, (pr) => bucket(pr)).sort(
    (a, b) => BUCKET_ORDER.indexOf(a.key as Bucket) - BUCKET_ORDER.indexOf(b.key as Bucket),
  );

  const lines: string[] = [];

  for (const g of groups) {
    const items = [...g.items].sort((a, b) => b.number - a.number);

    lines.push(`${g.key} (${items.length})`);
    for (const pr of items) {
      lines.push(`  - #${pr.number} ${normalizeOneLine(pr.title)} ${pr.htmlUrl}`);
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd() + '\n';
}

export function formatCommentsGrouped(comments: ReviewComment[]): string {
  if (comments.length === 0) return '';

  // Show the most-commented files first; this makes it easier to spot where review attention is concentrated.
  const groups = groupByKey(comments, (c) => c.path).sort(
    (a, b) => b.items.length - a.items.length || a.key.localeCompare(b.key),
  );
  const lines: string[] = [];

  for (const g of groups) {
    lines.push(`${g.key} (${g.items.length})`);

    // Within each file, group by the review id (thread) when present.
    // This keeps multi-comment review threads clustered together.
    const byReview = groupByKey(g.items, (c) => (c.pullRequestReviewId == null ? 'no-review' : String(c.pullRequestReviewId))).sort(
      (a, b) => {
        if (a.key === 'no-review' && b.key !== 'no-review') return 1;
        if (b.key === 'no-review' && a.key !== 'no-review') return -1;

        const aNum = Number(a.key);
        const bNum = Number(b.key);
        if (Number.isFinite(aNum) && Number.isFinite(bNum)) return aNum - bNum;

        return a.key.localeCompare(b.key);
      },
    );

    const showReviewHeader = byReview.length > 1;

    for (const reviewGroup of byReview) {
      const header =
        reviewGroup.key === 'no-review' ? 'Other comments' : `Review ${reviewGroup.key}`;
      if (showReviewHeader) lines.push(`  ${header} (${reviewGroup.items.length})`);

      const sorted = [...reviewGroup.items].sort((a, b) => {
        const posCmp = compareNullableNumber(a.position, b.position);
        if (posCmp !== 0) return posCmp;
        // createdAt is ISO from GitHub; lexical sort works, but keep safe.
        const dateCmp = a.createdAt.localeCompare(b.createdAt);
        if (dateCmp !== 0) return dateCmp;
        return a.id - b.id;
      });

      const hasPositioned = sorted.some((c) => c.position != null);
      const hasUnpositioned = sorted.some((c) => c.position == null);

      for (const c of sorted) {
        const who = c.userLogin ?? 'unknown';
        const body = normalizeOneLine(c.body);
        const pos = c.position != null ? ` (pos ${c.position})` : hasPositioned && hasUnpositioned ? ' (no position)' : '';
        const url = c.htmlUrl ? ` ${c.htmlUrl}` : '';
        const prefix = showReviewHeader ? '    -' : '  -';
        lines.push(`${prefix} #${c.id} ${who}${pos}: ${body}${url}`);
      }
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

function formatCheckStatus(r: CheckRunSummary): string {
  const concl = r.conclusion ?? '-';
  return `${r.status}${concl !== '-' ? `/${concl}` : ''}`;
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
    const groups = groupByKey(items, (r) => splitCheckName(r.name).group).sort(
      (a, c) => c.items.length - a.items.length || a.key.localeCompare(c.key),
    );
    for (const g of groups) {
      // Only show a subgroup header when it adds information.
      const showHeader = !(groups.length === 1 && g.key === 'checks');
      if (showHeader) lines.push(`  ${g.key} (${g.items.length})`);

      const sorted = [...g.items].sort((a, c) => {
        const la = splitCheckName(a.name).label;
        const lb = splitCheckName(c.name).label;
        const cmp = la.localeCompare(lb);
        return cmp !== 0 ? cmp : a.name.localeCompare(c.name);
      });
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
  lines.push(`State: ${pull.state}${pull.merged ? ' (merged)' : ''}${pull.draft ? ' (draft)' : ''}`);
  lines.push('');

  lines.push('Summary');
  lines.push(`  - Comments: ${comments.length} across ${commentFileCount} file${commentFileCount === 1 ? '' : 's'}`);
  lines.push(`  - Checks: ${checks.length}${checks.length ? ` (${formatCheckSummary(checkCounts)})` : ''}`);
  lines.push('');

  // Action-oriented grouping: surface what likely needs attention first.
  const failedChecks = checks.filter((c) => bucketCheck(c) === 'failed');
  const pendingChecks = checks.filter((c) => bucketCheck(c) === 'pending');
  const commentByFile = groupByKey(comments, (c) => c.path).sort((a, b) => b.items.length - a.items.length || a.key.localeCompare(b.key));

  if (failedChecks.length || pendingChecks.length || comments.length) {
    lines.push('Action items');

    const attentionChecks = [...failedChecks, ...pendingChecks];
    if (attentionChecks.length) {
      lines.push(`  - Checks needing attention (${attentionChecks.length})`);

      const sections: { label: string; items: CheckRunSummary[] }[] = [
        { label: 'Failing', items: failedChecks },
        { label: 'Pending', items: pendingChecks },
      ];

      for (const section of sections) {
        if (section.items.length === 0) continue;
        lines.push(`    - ${section.label} (${section.items.length})`);

        const grouped = groupByKey(section.items, (r) => splitCheckName(r.name).group).sort(
          (a, b) => b.items.length - a.items.length || a.key.localeCompare(b.key),
        );

        for (const g of grouped) {
          const showHeader = !(grouped.length === 1 && g.key === 'checks');
          if (showHeader) lines.push(`      ${g.key} (${g.items.length})`);

          const sorted = [...g.items].sort((a, b) => {
            const la = splitCheckName(a.name).label;
            const lb = splitCheckName(b.name).label;
            const cmp = la.localeCompare(lb);
            return cmp !== 0 ? cmp : a.name.localeCompare(b.name);
          });

          for (const r of sorted) {
            const { label } = splitCheckName(r.name);
            const url = r.detailsUrl ?? '';
            const prefix = showHeader ? '        -' : '      -';
            lines.push(`${prefix} ${label}: ${formatCheckStatus(r)}${url ? ` ${url}` : ''}`);
          }
        }
      }
    }

    if (comments.length) {
      lines.push(`  - Review comments (${comments.length})`);

      // Keep the action-items section short: show the most-commented files first,
      // then elide the rest.
      const maxFiles = 5;
      const shownFiles = commentByFile.slice(0, maxFiles);
      const hiddenFiles = commentByFile.length - shownFiles.length;

      for (const f of shownFiles) {
        lines.push(`    - ${f.key} (${f.items.length})`);

        // Mirror `formatCommentsGrouped` structure: within each file, cluster by review id when possible.
        const byReview = groupByKey(f.items, (c) => (c.pullRequestReviewId == null ? 'no-review' : String(c.pullRequestReviewId))).sort(
          (a, b) => {
            if (a.key === 'no-review' && b.key !== 'no-review') return 1;
            if (b.key === 'no-review' && a.key !== 'no-review') return -1;

            const aNum = Number(a.key);
            const bNum = Number(b.key);
            if (Number.isFinite(aNum) && Number.isFinite(bNum)) return aNum - bNum;

            return a.key.localeCompare(b.key);
          },
        );

        const showReviewHeader = byReview.length > 1;

        const maxPreview = 3;
        let shown = 0;

        for (const reviewGroup of byReview) {
          if (shown >= maxPreview) break;

          const header = reviewGroup.key === 'no-review' ? 'Other comments' : `Review ${reviewGroup.key}`;
          if (showReviewHeader) lines.push(`      ${header} (${reviewGroup.items.length})`);

          const sorted = [...reviewGroup.items].sort((a, b) => {
            const posCmp = compareNullableNumber(a.position, b.position);
            if (posCmp !== 0) return posCmp;
            const dateCmp = a.createdAt.localeCompare(b.createdAt);
            if (dateCmp !== 0) return dateCmp;
            return a.id - b.id;
          });

          const hasPositioned = sorted.some((c) => c.position != null);
          const hasUnpositioned = sorted.some((c) => c.position == null);

          for (const c of sorted) {
            if (shown >= maxPreview) break;
            const who = c.userLogin ?? 'unknown';
            const body = normalizeOneLine(c.body);
            const pos = c.position != null ? ` (pos ${c.position})` : hasPositioned && hasUnpositioned ? ' (no position)' : '';
            const url = c.htmlUrl ? ` ${c.htmlUrl}` : '';
            const prefix = showReviewHeader ? '        -' : '      -';
            lines.push(`${prefix} ${who}${pos}: ${body}${url}`);
            shown++;
          }
        }

        const remaining = f.items.length - shown;
        if (remaining > 0) {
          const prefix = showReviewHeader ? '        -' : '      -';
          lines.push(`${prefix} … +${remaining} more`);
        }
      }

      if (hiddenFiles > 0) {
        lines.push(`    - … +${hiddenFiles} more file${hiddenFiles === 1 ? '' : 's'}`);
      }
    }

    lines.push('');
  }

  lines.push(`Review comments (${comments.length})`);
  if (comments.length === 0) lines.push('  (none)');
  else lines.push(indentBlock(formatCommentsGrouped(comments).trimEnd()));
  lines.push('');

  lines.push(`Checks (${checks.length})`);
  if (checks.length === 0) lines.push('  (none)');
  else lines.push(indentBlock(formatChecksGrouped(checks).trimEnd()));

  return lines.join('\n').trimEnd() + '\n';
}
