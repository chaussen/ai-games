# Working agreements for this repo

## Branching: trunk-based, `master` only

This repo is developed trunk-based. Work directly on `master` — do not create
feature/working branches for day-to-day changes. Commit and push to `master`
unless explicitly told otherwise for a specific task.

## Testing: production only

There is no staging environment. Verify changes against the live deployment
(`play.caseychinese.org`, served via GitHub Pages from `master`'s `CNAME`)
rather than setting up separate test environments or long-lived test
branches. Local static-server + headless-browser checks before pushing are
fine for catching obvious breakage, but the source of truth for "does this
work" is the production site after `master` deploys.
