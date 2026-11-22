# Glyph Isles 2D upgrade (2026-11-22): meaning solves it

**Status: docs only. No code has changed.** Written after John's first playtest of the 2D with Conjure. Any agent
taking a phase starts here, then reads the doc named in the phase's section of `HANDOFF.md`.

| Doc | Read it when |
|---|---|
| `UPGRADE.md` (this) | first: why, what was decided, the six rules, the phases |
| `PLAYTEST-FINDINGS.md` | you need John's five findings, the measured data and root causes with file and line |
| `RULES-SPEC.md` | you are implementing the rules in `sim.js` / `rules.js` (phase 1) |
| `ELEMENTS.md` | you are adding cells, glyphs or art (phase 2), or designing levels (phase 3) |
| `LEVEL-BRIEF.md` | you are the level-design agent (phase 3): self-contained |
| `TEST-SPEC.md` | you are writing or running tests, or doing the manual playtest (every phase) |
| `HANDOFF.md` | you are picking up a phase: read-first list, order of work, done criteria, log |
| `OBSOLETE-ONE-STROKE.md` | you wonder what happened to the One Stroke look |

Scope fence: the work is inside `games/tongzhou-forge-2d`. Shenbi (`games/shenbi`) is a separate project handled by
another agent; do not read its code to change it. Its **stroke data** may be *copied* (never imported) for new glyphs.
Forging one character together (CO-OP.md §6) stays frozen until this upgrade is playtested.

## 1. Why (in one paragraph)

The bots prove each of the 23 isles is *winnable*. They cannot say whether winning is *interesting*. John's
playtest found the game gets boring quickly: terrains are near-identical, the few obstacles are solved by "walk near
them holding the right stone", tall cliffs can only be passed by stacking meaningless stones (口, 十) and abrupt
clouds. The common thread: **the only verb is "bring a stone near", and a stone's meaning is a label, not a
mechanism.** The upgrade makes meaning the mechanism, makes every reaction a visible deliberate act with a cost, and
re-lays the isles from a richer vocabulary.

Note the count: John says 24 isles; the code has **23** (`isles.js`: 21 beta isles + 2 writing isles). Treat 23 as
the truth unless an isle was added elsewhere; the level agent's ramp (`LEVEL-BRIEF.md` §6) lists all 23.

## 2. Decisions (John, 2026-11-22)

| # | Decision | Source |
|---|---|---|
| U-D1 | Fix these systematic flaws **before** adding co-op forging or new isles. | John |
| U-D2 | **Cliffs are answered by meaning tools only**: characters whose meaning is growing, building or climbing (木 林 森, 土 田, 人 从 众, 山 and new 云). 口 / 十 / 日 and other inert stones may not be stacked to gain height. | John, option 1 |
| U-D3 | **Free-floating clouds are removed.** Lift comes from something the player makes (云 stone) or a visible updraft (风). | John (#4) |
| U-D4 | **A few new characters**, about 6, chosen for gaps, each with a rule and recipe before any level uses it. | John |
| U-D5 | **Plan all elements first, then hand to a level-design agent.** | John (#1) |
| U-D6 | **One Stroke is obsolete.** Do not touch its code. Stop maintaining it; ink and greybox are the maintained looks. | John (#5) |
| U-D7 | Wood making a bridge is the accepted model of "meaningful representation". Every new element should feel that natural. | John (#4) |
| U-D8 | Docs and test specs now; implementation in later sessions by other agents. | John |

## 3. The six rules (full specs in `RULES-SPEC.md`)

- **R1 Acts, not proximity.** A reaction needs a deliberate delivery: throw, set down at it, or a contextual verb
  (泼 pour / 点 light / 照 shine) when facing the target. Carrying or lying near does nothing.
- **R2 Telegraph, then consequence.** About 0.8 s of visible cause and effect, attributed in one line. No frame-skip vanishing.
- **R3 Cost and counters.** The delivering stone is spent. Wrong answers cost something (火 burns a 木 bridge; 水 washes a
  mound), so order of actions matters.
- **R4 Bearing vs inert.** Only bearing glyphs hold weight above one stone-height. 木 / 土 / 人 grow or build structures at a
  **socket**; they are not block piles.
- **R5 Sheer cliffs and sockets.** Cell `C` gives no 轻功 wall refill. Every cliff over 3 cells declares its meaning answers.
  The world shows its own word (socket mark) so the solver is never guessing.
- **R6 Seen before used.** No loose clouds. New mechanics first appear on a calm stretch, in view, named in the isle tip.

## 3b. The organising idea and the new glyphs

The five elements (五行) and their controlling cycle give every obstacle a natural, learnable answer: 水 puts out 火, 火 melts 金,
金 chops 木, 木 roots split 土, 土 dams 水; light is the safe sixth. Six new glyphs fill the gaps: **金** (metal, missing today),
**云** (cloud lift, replaces loose clouds), **风** (wind updraft), **石** (immovable rock), **山** (mountain peak), **雨** (rain, made by 云 on 水).
New cells: `C` sheer cliff, `R` boulder, `D` wooden gate, `M` iron bars, `L` embers, `W` current, `V` vent. Detail: `ELEMENTS.md`.

## 4. Phases

| Phase | Who | What | Gate |
|---|---|---|---|
| 0 | this session | all docs and test specs in this folder; One Stroke flagged | John reads |
| 1 | rules agent | R1-R6 in `sim.js`, `rules.js`, `content.js`; tests; existing 23 isles patched minimally to stay winnable | `TEST-SPEC.md` §1-4 pass |
| 2 | element/art agent | new cells and glyphs, ink art, telegraph, sounds, strokes for new glyphs, font subset | screen checks + screenshots read |
| 3 | level-design agent | relay 23 isles from `LEVEL-BRIEF.md`; validators enforce the constraints | `TEST-SPEC.md` §5 pass |
| 4 | John + agent | playtest on real phones; defect log; tuning knobs | John's checklist `TEST-SPEC.md` §8 |

Phases 1 and 2 may overlap after the cell and event contracts in `RULES-SPEC.md` §9 are frozen. Phase 3 cannot start before
phase 1's `answers` / `biome` data fields exist (they are data only; a stub can land early).

## 5. What stays true

Solo play unchanged except as the rules say; the crew (`server.js`, `snapshot()` / `restore()`) keeps working, so every
new state is serialisable; knobs live in `sim.js` with relaxed / standard / strict profiles, never in an isle; the screen
budget (goal, card, one message line, ☰, stick, two buttons) is respected: the contextual verb *replaces* the label on the
GRAB button, it adds no button; pinyin and meaning accompany every Chinese character shown; port 3000 is never used in tests.
