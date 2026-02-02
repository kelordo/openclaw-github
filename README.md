# pr-autopilot

A small CLI that helps an agent (and a human) run a tight GitHub workflow:

- create a branch
- make incremental commits
- open a PR
- track review comments
- track CI status

## Status
Early scaffold.

Current milestone: branch + commit orchestration (local git integration).

Implemented commands (WIP; output format will change):

- `pr-autopilot --version`
- `pr-autopilot pr list --repo owner/name [--state open|closed|all] [--json] [--pretty] [--json-envelope]`
- `pr-autopilot pr comments (--repo owner/name --pr <number> | --pr-url <url>) [--json] [--pretty] [--json-envelope]`
- `pr-autopilot pr checks (--repo owner/name --pr <number> | --pr-url <url>) [--json] [--pretty] [--json-envelope]`
- `pr-autopilot pr plan (--repo owner/name --pr <number> | --pr-url <url>) [--only-attention] [--json] [--pretty] [--json-envelope]`

`--json-envelope` wraps output as `{ schema, data }` so downstream scripts can lock onto a stable schema version.

Schemas are documented in [docs/OUTPUT.md](docs/OUTPUT.md).

## Security
Never commit tokens. Use env vars or a local `.env`.

## Output

See [docs/OUTPUT.md](docs/OUTPUT.md) for the current text and JSON output conventions.

## Prereqs

- Node.js >= 20 (we use the npm that ships with Node; **pnpm is not required**)
- Git (for local branch/commit orchestration)

Optional (nice-to-have):
- `rg` (ripgrep) for fast code search while developing (fallback: `grep -R`)
- `pnpm` (via `corepack enable && corepack prepare pnpm@latest --activate`) if you prefer it locally (not required)

## Dev

```bash
# Prefer a clean, reproducible install in CI
npm ci

# One-shot local check (lint + typecheck + tests + build)
npm run ci

# Or run individual steps
npm test
npm run typecheck
npm run lint
```
