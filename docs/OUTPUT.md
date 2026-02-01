# Output formats

This CLI is intentionally human-readable by default.

When you need machine-readable output, pass `--json` (optionally `--pretty`).
If you want a stable wrapper for downstream tooling, add `--json-envelope` which wraps as:

```json
{ "schema": "<schema-id>@<version>", "data": <payload> }
```

## Grouped text output

### `pr list` (grouped)
PRs are bucketed into: `open`, `draft` (open drafts), `merged`, and `closed`.
Within each bucket, PRs are sorted by PR number descending.

Example:

```text
open (2)
  - #15 Fix flaky tests https://...
  - #12 Add pr plan command https://...

draft (1)
  - #16 WIP: refactor formatter https://...

merged (1)
  - #11 Ship the thing https://...

closed (1)
  - #10 Wontfix: older approach https://...
```

### `pr comments` (grouped)
Comments are grouped by file path, then by `pullRequestReviewId` (review thread) when present.
Within a file/review, comments are sorted by position (when available), then time.

Example:

```text
src/cli.ts (3)
  Review 12345 (2)
    - #111 alice (pos 10): Please rename this flag.
    - #112 alice (pos 12): Also add a test.
  Other comments (1)
    - #113 bob: Nit: trailing whitespace.
```

### `pr checks` (grouped)
Checks are bucketed into: `failed`, `pending`, `unknown`, `neutral`, `success`.
Within a bucket, checks are grouped by suite prefix when the check name contains `" / "`.

Example:

```text
failed (1)
  CI (1)
    - test (ubuntu-latest): completed/failure https://...

success (2)
  CI (2)
    - build (ubuntu-latest): completed/success https://...
    - lint: completed/success https://...
```

### `pr plan`
`pr plan` prints a short PR header and a summary (counts).

If there are any checks/comments, it also prints an `Action items` section that surfaces:
- failing checks (grouped by suite prefix when present)
- pending checks (grouped)
- review comments grouped by file (most-commented files first; only the top 5 files are shown here), with a small preview clustered by review id when available

Then it prints the full grouped comment and check blocks, indented under their section headers to keep the overall output readable.

Example (abridged):

```text
PR #12: Add pr plan command
https://github.com/o/r/pull/12
State: open

Summary
  - Comments: 3 across 2 files
  - Checks: 2 (failed=1 success=1)

Action items
  - Failing checks (1)
    CI (1)
      - test (ubuntu-latest) https://github.com/o/r/actions/runs/1
  - Review comments (3)
    - src/cli.ts (2)
      Review 12345 (2)
        - alice (pos 10): Please add a test. https://...
        - … +1 more
    - src/format.ts (1)
      - bob (pos 7): Can you group these by review? https://...

Review comments (3)
  ...

Checks (2)
  ...
```

Use `--json` if you want to feed an agent or script.
