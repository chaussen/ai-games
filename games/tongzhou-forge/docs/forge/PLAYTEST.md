# Positional Forge: playtests and the tuning loop

The forge only works if it sits at the middle point between strict grammar and relaxed play
(`CONCEPT.md` §3). No document can find that point; playtests can. This page says how to run them,
what to watch, what to log, and how to move the knobs (`DESIGN.md` §2).

## 1. Gates

| Gate | After | Question | Isle | People |
|---|---|---|---|---|
| **G1** | Phase 3 | Is building 杲 vs 杳 by stacking **fun or fiddly**? | `dawn` | 1 to 3 players, at least one who reads no Chinese |
| **G2** | Phase 4 | Is body forging (stand on a friend, anyone presses) **fun**, and does nobody feel stuck holding still? | `on-my-shoulders` | 2 to 4 players |
| G3 | Phase 6 | Does a run of 6+ stages keep the middle point (no stage too strict or too loose)? | all shipped | 2 to 4 |

Each gate ends in one of: **keep** (move on), **retune** (change knobs and re-run the same gate),
or **kill** (write down why in the ROADMAP decision log and stop that branch).

## 2. Running a session

1. `node server.js --log` in `games/tongzhou-forge` (port 3200). The board is at `http://<host>:3200/?board=1`.
2. Phones join through the QR code. `tools/puppets.mjs` can add bodies when people are short.
3. Say nothing about the rules beyond the stage hint. Note the time at the start.
4. Run the isle once per profile, `relaxed`, `standard` and `strict`, in an order rotated between
   groups. (A temporary `?strict=` board override for testing is a Phase 3 card; it is never sent by
   phones.)
5. After each run, ask three questions out loud and note the answers word for word:
   - "What was annoying?"
   - "What made you laugh or go 'oh!'?"
   - "Was it ever *your fault* or *the game's fault* when it didn't work?"

## 3. The tuning loop

```
play → read the log + the notes → classify every failed try → move ONE group of knobs → play again
```

| Symptom | Likely side | Knobs to move |
|---|---|---|
| Many `norel` tries within 1.5× the cones; "the game's fault" | hand too strict | widen K1 to K3, raise K4 snap, check the K9 label |
| `dud` with `why: mirror` repeated by the same crew, and frustration | grammar felt as a trap | try K5 rescue on this stage, or make K12 easier (fewer pairs) |
| `dud` with `mirror` once, then success, and laughter | **the middle point**: keep it | nothing |
| Stages solved without anyone noticing order or position | too relaxed | narrow cones, rescue off, put a minimal pair on the stage's path |
| Wrong-but-real results (杳) block progress, and people give up | wrong too costly | K7 `wrongLife`, `regrow`, or the split verb (DESIGN Q1) |
| The bottom player idles in body forging | role problem | check that the bottom player triggers in the log; arm-hold visibility; stage design |
| Judge hand margin < 70% on a stage | stage too fiddly | widen cones for that stage's profile, or redesign the placement spot |

Rules: change **one knob group per iteration**. Write every change in the ROADMAP progress log
with the before and after values and the session that motivated it. Profiles are the unit of
change: a stage's profile can move, but a stage never carries private knob values.

## 4. What the log records (`logs/playtest-<date>.jsonl`)

One line per event, from the sim's `try`, `forge`, `dud`, `split`, `stage`, `win` and `join` events,
with the session id, stage, profile and seconds since the stage started.

| Measure | From | Healthy range (first guess) |
|---|---|---|
| Tries per forge | `try` / `forge` | 1.2 to 3 |
| Hand-error share | `norel` / all failed tries | < 40% |
| Grammar-error share | `dud` with `mirror` / all failed tries | 20% to 60%: present but not dominant |
| Time to first forge | `stage` → first `forge` | < 60 s |
| Body forges by bottom player | `forge` with `by` = the supported-on player | > 25% of body forges |
| Stage time vs judge par | `win` | < 3× par |

These ranges are guesses, to be replaced by the first G1 numbers.

## 5. Evidence

Screenshots and clips come only from a running build (repo rule). Store them in `screenshots/forge/`,
named `<gate>-<date>-<what>.png`, and reference them from the ROADMAP log.
