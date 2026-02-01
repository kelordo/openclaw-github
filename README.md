# pr-autopilot

A small CLI that helps an agent (and a human) run a tight GitHub workflow:

- create a branch
- make incremental commits
- open a PR
- track review comments
- track CI status

## Status
Early scaffold.

Current milestone: read-only GitHub integration via `GITHUB_TOKEN`.

Implemented commands (WIP; output format will change):

- `pr-autopilot pr list --repo owner/name [--state open|closed|all] [--json] [--pretty] [--json-envelope]`
- `pr-autopilot pr comments --repo owner/name --pr <number> [--json] [--pretty] [--json-envelope]`
- `pr-autopilot pr checks --repo owner/name --pr <number> [--json] [--pretty] [--json-envelope]`

`--json-envelope` wraps output as `{ schema, data }` so downstream scripts can lock onto a stable schema version.

## Security
Never commit tokens. Use env vars or a local `.env`.

## Dev

```bash
npm install
npm test
npm run typecheck
npm run lint
```
