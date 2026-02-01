# Output formats

This CLI is intentionally human-readable by default.

When you need machine-readable output, pass `--json` (optionally `--pretty`).
If you want a stable wrapper for downstream tooling, add `--json-envelope` which wraps as:

```json
{ "schema": "<schema-id>@<version>", "data": <payload> }
```

## Grouped text output

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
`pr plan` prints a short PR header, a summary (counts), followed by grouped comments and checks.

The grouped comment/check blocks are indented under their section headers to keep the overall output readable.

Use `--json` if you want to feed an agent or script.
