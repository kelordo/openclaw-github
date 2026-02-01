# Milestones

## M0 — Scaffold (done-ish)
- TypeScript + Vitest + ESLint + Prettier
- Placeholder CLI

## M1 — Read-only GitHub (done)
Goal: fetch PR data and present it in a scriptable way.

Deliverables:
- [x] `pr list` (open/closed/all)
- [x] `pr comments` (review comments)
- [x] `pr checks` (check runs)
- [x] `pr plan` (pull summary + comments + checks)
- [x] Improve output (JSON flag, stable fields; grouped text output)
- [x] Better error messages (missing repo/token, API rate limit)
- [x] Paging support for comments/checks

## M2 — Branch + commit orchestration (current)
Goal: help an agent work incrementally.

Deliverables:
- Create/checkout branch (via `git` subprocess)
- Commit helper (message templates; include context)
- Safety checks (clean working tree; up-to-date base)

## M3 — PR creation & update
Deliverables:
- Create PR
- Update title/body
- Push branch

## M4 — Review loop
Deliverables:
- Fetch review threads (GraphQL)
- Track "resolved" state
- Generate a TODO checklist from feedback

## M5 — CI loop
Deliverables:
- Poll checks until completion
- Summarize failing jobs + link logs
- Optional: block merge until green
