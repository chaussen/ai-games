# Working agreements for this repo

## Scope

This repo hosts one product: **学字坊 · The Character Game**, the classroom
Chinese-character learning game for Casey Chinese School. Entry point:
`index.html` (see `game/README.md` for architecture). Do not add unrelated
prototypes or side projects here — anything exploratory belongs in its own
repo.

The game is open (no trial gating, no expiry) — students and teachers get in
with the class codes handled in `game/app.js`.

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
