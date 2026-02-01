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

## Dev

```bash
npm install
npm test
npm run typecheck
npm run lint
```
