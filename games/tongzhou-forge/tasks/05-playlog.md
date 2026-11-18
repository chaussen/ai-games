# Task 05 — read the playtest log (for gate G1)

**Goal.** A small command-line tool that reads one playtest log and prints the G1 numbers from
`docs/forge/PLAYTEST.md` §4, so whoever runs a playtest gets the numbers in one command.

**You may change:** create `lab/playlog.mjs` (one file, plain Node, no packages). **Change nothing else.**

## The input

`node server.js --log` writes `logs/playtest-<date>.jsonl`: one JSON object per line. Every line has
`ts` (milliseconds), `sess` (session id), `stage` (stage id), `profile` (`relaxed`, `standard` or
`strict`), `st` and `t` (the event type), plus the event's own fields. The ones you need:

| `t` | Fields you use | Meaning |
|---|---|---|
| `stage` | — | A stage starts in this session. It begins a **visit**, which lasts until the next `stage` line with the same `sess`. |
| `try` | `why` | Someone placed two stones. `why` is `ok`, `wrong` (it made a real character nobody wanted), `norel` (not quite placed), `mirror` (the other order would make something), `dud` (nothing at all) or `cooldown` (tried again too soon). |
| `forge` | — | Two stones became one. |
| `win` | — | The stage was won. |

Skip blank lines. A line that is not valid JSON is a **bad line**: count it and go on. Other event
types (`join`, `dud`, `dusk`, `split`, `profile`, `leave`) are counted as events and otherwise ignored.
A real example is `tasks/checks/fixtures/playlog.jsonl`.

## What to compute

One **group** per stage-and-profile pair, in the order each pair first appears. Each event belongs to
the group named by its own `stage` and `profile`. For each group:

| Field | How |
|---|---|
| `tries`, `forges` | count of `try` lines, count of `forge` lines |
| `triesPerForge` | `tries / forges` rounded to 2 decimals; `null` when `forges` is 0 |
| `norel`, `mirror`, `dud`, `cooldown`, `wrong` | count of `try` lines with that `why` |
| `failed` | `norel + mirror + dud` |
| `handShare`, `grammarShare` | `norel / failed` and `mirror / failed`, rounded to 2 decimals; `null` when `failed` is 0 |
| `firstForge` | for each visit that has a `forge`: seconds from the visit's `stage` line to its first `forge` (use `ts`). The average, rounded to 1 decimal; `null` if none |
| `wins`, `winTime` | the number of visits with a `win`; the average seconds from `stage` to `win`, rounded to 1 decimal (`null` if none) |
| `flags` | the names of the measures outside the PLAYTEST healthy range, in this order: `triesPerForge` (below 1.2 or above 3), `handShare` (0.4 or more), `grammarShare` (below 0.2 or above 0.6), `firstForge` (60 or more). A `null` is never flagged. |

## Output

- `node lab/playlog.mjs <file> --json` prints exactly one JSON object:
  `{ "lines": <good events>, "bad": <bad lines>, "sessions": <distinct sess>, "groups": [ { "stage", "profile", ...the fields above } ] }`.
- `node lab/playlog.mjs <file>` prints a short table for people: one line per group with the stage,
  profile, tries per forge, the shares as percents (`67%`), seconds to first forge, wins, and the flags.
- Never print a player id (`by`, `id`). The log keeps ids only, and the report does not need them.
- A missing file: print a message naming it and exit 1. No file argument: print a usage line and exit 2.

Worked example, from the fixture: the `dawn` / `relaxed` group has 4 tries (2 `norel`, 1 `mirror`,
1 `ok`) and 1 forge 28 s after its `stage` line, so `triesPerForge` 4, `failed` 3, `handShare` 0.67,
`grammarShare` 0.33, `firstForge` 28, and `flags` `["triesPerForge", "handShare"]`.

## Done when

`node tasks/checks/t05.mjs` ends with `--- TASK 05 DONE ---`.
