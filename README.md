# pr-autopilot

A small CLI that helps an agent (and a human) run a tight GitHub workflow:

- create a branch
- make incremental commits
- open a PR
- track review comments
- track CI status

## Status
Early scaffold. First milestone: read-only GitHub integration (list PRs, fetch review threads, fetch check runs) via `GITHUB_TOKEN`.

## Security
Never commit tokens. Use env vars or a local `.env`.

## Dev

```bash
npm install
npm test
npm run typecheck
npm run lint
```
