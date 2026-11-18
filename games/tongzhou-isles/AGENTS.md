# Rules for any model working in this folder

Read this page, then the one task card you were given. You do not need to read anything else.

## What you may touch

| You are doing | You may change | You may NOT change |
|---|---|---|
| A new stage | one new file in `content/candidates/` | everything else |
| Characters and recipes | `content/glyphs.json` | everything else |
| A task card from `tasks/` | only the files the card lists | everything else |

Never change these, whatever the task says: `sim.js`, `levels.js`, `server.js`, `tools/judge/*.mjs`
(the files directly in that folder), `tools/judge.mjs`, any `*-test.mjs`, `tasks/checks/`, `vendor/`,
and anything outside this folder. `content.js` is generated: never edit it, run `node tools/pack.mjs`.

If a test or check fails, fix your own work. Do not edit the test. If you believe the test is wrong,
stop and say so in your answer.

## Commands

```sh
node tools/pack.mjs                     # after ANY change in content/: rebuilds content.js
node tools/judge.mjs content/candidates/my-isle.json    # is this stage good? prints what to fix
node sim-test.mjs && node smoke-test.mjs && node judge-test.mjs   # all must end with "ALL ... PASSED"
node tasks/checks/t01.mjs               # the check named on your task card
```

No `npm install`, no internet, no new dependencies, no port 3000.

## You are done when

1. The check on your task card prints `DONE`.
2. The three test commands above all print `ALL ... PASSED`.
3. You changed only the files you were allowed to change.

## Facts that are easy to get wrong

- Text players see is English first. A Chinese character always comes with pinyin and an English meaning.
- A position `[x, z]` is in map column `floor(x)`, row `floor(z)`. Row 0 is the first string of `map`.
- Stage format: `docs/STAGES.md`. A stage is finished only when `node tools/judge.mjs` prints `PASS`.
