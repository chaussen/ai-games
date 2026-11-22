# Hand-off: the upgrade, phase by phase

Written 2026-11-22 (session 0, docs only). Each later session: read `UPGRADE.md`, the section for your phase here, then
the docs it names. End your session by appending to the **Log** at the bottom (what you did, test counts, patches, what is
next). Rules for this folder: `../../AGENTS.md` (still current, except that One Stroke is obsolete).

## Facts every phase needs

- Folder: `games/tongzhou-forge-2d`. Never import from another game; copy and say where from. Never port 3000 in tests.
- Work on `master` (trunk-based, `CLAUDE.md`). Commit and push only when John asks.
- Knobs live in `sim.js` tables with relaxed/standard/strict profiles; an isle never carries numbers.
- Anything new on a player or stone must survive `snapshot()`/`restore()` (crew phones only restore and draw).
- Looks: ink (default) and greybox are maintained. `cut.js` (One Stroke) is **obsolete: do not edit, do not test** (`OBSOLETE-ONE-STROKE.md`).
  It must still load without crashing, so keep the `world` fields it reads (it ignores new ones); do not remove `world.clouds` until the
  last isles stop listing them; if `cut.js` breaks on a removed field, add the empty field rather than touching `cut.js`.
- `content.js` is generated ("do not edit by hand") from the 3D game's packed content; there is no `tools/pack.mjs` in this folder.
  For the new glyphs, edit `content.js` directly and change its header to say "copied from games/tongzhou-forge, then extended by hand for
  the upgrade (docs/upgrade/ELEMENTS.md)". Do not run another game's pack tool.
- `vendor/strokes.json` is made by `node tools/strokes.mjs --glyphs`; the six new glyphs' stroke data may be copied from
  `games/shenbi/vendor/strokes.json` (copy the `chars` entries; do not import or edit Shenbi). Shenbi is another agent's project.
- Pinyin and meaning accompany every Chinese character on screen; new text means rerunning `tools/font.py`.
- Baselines to record on first run: sim-test check count, wins count, screen-test screens. (Measured by the author of this doc
  before changes: 23 isles, 7 cell types, 6 isles with clouds, the longest cliff column 9.)

## Phase 1: the rules (rules agent)

**Read first:** `RULES-SPEC.md` (all), `PLAYTEST-FINDINGS.md` §3, `sim.js` (`stepWalls`, `stepGems`, stones, `snapshot`/`restore`, `QI`, `BODY`),
`rules.js`, `routes.mjs`, `bot.mjs`, `sim-test.mjs`, `TEST-SPEC.md` §1-4.

**Order of work (each step keeps all existing tests green before the next):**
1. Add the new knob tables with all three profiles (`REACT`, `VERB`, `BEAR`, `HINT`, `LIFT`, `GUST`, `CRACK`, `STEAM`, `ROOT`, `SOCKET`, `CLIFF`). Knob test.
2. `content.js` + `rules.js`: `bear`, `build`, reaction and counter tables (data only). Table tests.
3. R4 bearing: support level and slide; `BEAR.inert='solid'` keeps the old behaviour. T3.3.
4. R1/R2/R3: deliveries and reactions replacing the passive branch of `stepWalls`; spent stones; counters; events; snapshot fields. T1.x, T2.x, T3.1-3.2, 3.8.
   Land this behind `REACT.mode: 'new'|'legacy'` (default `new` after the patched isles pass) so a regression can be bisected.
5. R5: cell `C`; no wall refill; sockets; builds with templates; `HURTS`/solid for new cells. T3.4.
6. R6: remove clouds from `stepGems`; 云 lift; 风 gust and `V`. T3.5, 3.6.
7. Patch the existing 23 isles minimally so every route wins again; log each patch in the Log (isle, what changed, why).
   Known passive-carry users to find with T1.1: every isle with T/F/S walls (3 Sun and Moon, 7 Rest, 8 Early Light, 10 Red Earth, 11 Good, 13 Partner, 14 Bathe, 15 Water the Tree, 17 Stove, 18 Blaze, 21 Burn, 22 Drench, 23 Flourish) and the goal-glyph cases (好 沐 灶).
   Cloud users to replace by 云 stones or short builds: 3, 4, 6, 16, 20, 23.
8. Rewrite `routes.mjs` for the new verbs; add the bot verbs in `TEST-SPEC.md` §4.
9. Update `README.md` (controls: the verb button; the rules), `CONJURE.md` (writing a tool, never the goal), `CO-OP.md` (new state in the wire).

**Done:** `TEST-SPEC.md` §9 row 1. **Pitfalls:** the passive trigger is also how some isles' goal glyph clears the last wall (好 沐 灶): decide the patch, do not leave the isle unwinnable;
`restore()` must not resurrect reactions; `cellsV` must bump on every grid change or phones will not refetch rows; do not make `BEAR.inert` depend on the profile.

## Phase 2: elements and art (art/element agent)

**Read first:** `ELEMENTS.md`, `RULES-SPEC.md` §5-7 and §9 (the frozen contracts), `ART-DIRECTION.md` (ink look), `CARRIED-THINGS.md`,
`things.js`, `ink.js`, the greybox in `app.js`, `TEST-SPEC.md` §6-7.
**Work:** cell drawings (`C R D M L W V w e`), socket marks and hint glow, the telegraph per event (`ELEMENTS.md` §6), the contextual verb on the GRAB
button (`app.js`), message lines, six stone drawings, sounds, strokes + font, `content.js` six glyphs and the 雨 recipe, writing-pad coverage.
Stay inside the ink performance budget (no per-frame large gradients; bake bands via `layer`/`vband`). Keep Chinese out of `ink.js` comments unless the character is in the font subset.
Do not touch `cut.js`. Greybox gets simple coloured shapes plus the same events.
**Done:** `TEST-SPEC.md` §9 row 2; screenshots read and described in the Log.
**Can start** once `RULES-SPEC.md` §9 contracts are implemented as stubs (events firing, cells accepted); art can be built against the stub sim.

## Phase 3: level design (level agent)

**Read first:** `LEVEL-BRIEF.md` (self-contained), `ELEMENTS.md`, `PLAYTEST-FINDINGS.md` §1-2. Do not edit sim or rules.
**Work:** `isles.v2.js`, `ISLE-NOTES.md`, per `LEVEL-BRIEF.md` §8. A second agent (or the rules agent) then encodes the notes' routes in `routes.mjs`,
runs validators (`TEST-SPEC.md` §5), swaps `isles.v2.js` into `isles.js`, and runs S7.8 and S7.10.
**Done:** `TEST-SPEC.md` §9 row 3. **Ask John** when two isles cannot be told apart or the ramp needs a change; do not alter goals or recipes.

## Phase 4: playtest and tuning (John and an agent)

Fresh phone playtest with `board-2d` (see `../../../board/README.md`), checklist `TEST-SPEC.md` §8. Triage into: tuning (a knob), level (an isle), rule (a spec change, write it into `RULES-SPEC.md` first), art.
Only after this does forging together (`../CO-OP.md` §6) come back onto the table, and only with Claude Design's answer.

## Decisions pending (small; propose, then ask John if it matters)

- `BEAR.inert: 'slide'` vs a gentler "cannot stand: the stone tips". Start with slide, A/B with `solid` in playtest.
- `D` gate and `M` iron bars: keep both? The level agent may drop `M` if unused (`ELEMENTS.md` §7).
- Whether 山 is writable on isles before 17.
- Do `W` currents push the player?
- Whether to keep the first isles' tips short because the hint glow carries the teaching.

## Risks

| Risk | Mitigation |
|---|---|
| Re-laid isles are harder or longer than players like | `REACT.dur`, `HINT`, profiles; keep isles 1-6 gentle; playtest |
| New glyphs hurt recogniser accuracy | `TEST-SPEC.md` §6 confusion check; drop or redraw a glyph |
| Crew desync from new state | Extend the snapshot group first; crew tests for every new field |
| The spec turns out wrong at some edge | Change `RULES-SPEC.md` first, then the code; log the change |
| Scope creep into co-op forging | Out of scope until phase 4 |

## Log (append; newest last)

```
### Session N (date, who)
Phase:
Did:
Tests (counts before -> after):
Patches to old isles:
Screenshots read:
Decisions made (and by whom):
Next:
```

### Session 0 (2026-11-22, Claude)
Phase 0. Wrote `docs/upgrade/*` after John's playtest. No code changed. Measured the baseline from `isles.js` and read `sim.js`.
Next: phase 1 (rules agent) and, in parallel after the contracts exist, phase 2.
