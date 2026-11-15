# Working agreements for this repo

## Scope

This repo hosts **学字坊 · The Character Game** (the production classroom
Chinese-character game for Casey Chinese School) **and a gallery of AI-built
games under `games/`**.

| Path | Role | Rules |
|---|---|---|
| `index.html`, `game/`, `assets/`, `build-pipeline/`, `CNAME`, `.nojekyll` | 学字坊 — production product served by GitHub Pages from `master` root | Leave the entry point at the root. `index.html` is what `play.caseychinese.org` serves. |
| `games/<game>/\` | Self-contained prototypes and experimental games | One folder per game, each with its own README, own server, own tests. |

The game is open (no trial gating, no expiry) — students and teachers get in
with the class codes handled in `game/app.js`.

### Rules for `games/`

- **One folder per game.** A game never imports from another game and never
  touches 学字坊 files (`index.html`, `game/`, `assets/`,
  `build-pipeline/`).
- **No separate repos.** Games live here, in `games/`. Do not promote a game
  to its own repository.
- **Self-contained.** Prefer zero-install: vendored libraries in
  `vendor/`, no CDN, no `npm install`. If a game genuinely needs npm, commit
  the lockfile and add a `node_modules/`-safe `.gitignore` entry (already
  global).
- **Every game has a README** covering: what it is, how to run it, controls,
  and its home-network caveats.
- **Anything built for outside review also gets a retrospective** — design
  intent, what actually shipped, defect log, known gaps.
- **Runnable tests.** A game with a server ships a `smoke-test.mjs` (or
  equivalent) that boots the real server on a test port and exercises it.
  Do not use port 3000 in tests — that may be a live family server.

## Branching: trunk-based, `master` only

This repo is developed trunk-based. Work directly on `master` — do not create
feature/working branches for day-to-day changes. Commit and push to `master`
unless explicitly told otherwise for a specific task.

## Testing

### 学字坊: production only

There is no staging environment. Verify changes against the live deployment
(`play.caseychinese.org`, served via GitHub Pages from `master`'s `CNAME`)
rather than setting up separate test environments or long-lived test
branches. Local static-server + headless-browser checks before pushing are
fine for catching obvious breakage, but the source of truth for "does this
work" is the production site after `master` deploys.

### `games/`: run the game's own tests

Each game's `smoke-test.mjs` is the contract. Run it before committing:

```sh
cd games/wobble-works/2d && node smoke-test.mjs && node hoist-test.mjs && node solo-test.mjs
cd games/wobble-works/3d && node smoke-test.mjs
cd games/firefly-relay && node smoke-test.mjs
```

Screenshots used as evidence must be captured from a running build, never
hand-drawn or mocked up.
