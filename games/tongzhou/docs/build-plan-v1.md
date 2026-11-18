# 同舟 — Build Plan and Handoff Kit v1

Fingerprint: TZ-BP-v1.7 (2026-11-12). V0 attempt 1 was REWORK (TZ-D043); next is V0.2 from `visual-toy-brief-v2.md`, preceded if possible by the style frame (brief §8, card TV02, Design). Wild resolve (T601) and a dictionary extract are pulled forward into V0.2 and I1. Forge cards (T206, T208) follow the spatial forge (SRS FR-301, 302, 313); hands cards (T205) include the deal guarantee (FR-209). The card tables in §5 were cut at v1.0 and patched; re-cut each iteration's cards against the current charter at the start of that iteration (one Tier S session). River view cards (T404, T408, T409, T705) now use three.js per TZ-D037; T402 `projection.js` is optional. Since charter v1.4: I2 uses troubles aboard and 气-as-momentum (SRS FR-606, 607, 614–616), not a run-ending 气; reuse V0 code where it helps. Repo layout additions over SRS §3.1: `server/hold.js`, `client/js/holdView.js`, `client/js/logbook.js`, `content/operators.json`, `tools/make-pack.js`. Governed by `charter-v1.md` and `srs-v2.md`.

## 1. Operating model for weak implementers

The implementer pool is free-tier flash models, a small Sonnet allowance, and a local Qwen on GPU. The plan assumes each has a small working context and uneven reliability. Their real capability is unknown to this plan, so task T001 measures it before any routing is trusted.

| Rule | Why |
|---|---|
| Contracts and tests are written before implementations, by the strongest model | A weak model can satisfy a test; it cannot be trusted to define correctness |
| One task = one module, ≤ 3 files touched, ≤ 250 lines per file | Fits a small context; limits blast radius |
| Frozen files may not be edited by implementer tasks | Stops silent contract drift |
| Every task ends by running `npm test` and appending to `PROGRESS.md` | Cold pickup without chat history |
| Two failed attempts → escalate one tier; never loop a third time on the same model | Cheap kills apply to attempts too |
| The implementer never decides design. Unclear spec → write a `QUESTION:` line in `PROGRESS.md` and stop | Design stays with the router |

### 1.1 Tiers

| Tier | Who | Spend it on |
|---|---|---|
| S | Sonnet (scarce) | Contracts, test authoring for tricky logic, milestone integration review, escalations |
| F | Free flash models | Single-module implementation against existing tests |
| L | Local Qwen (unlimited, slow) | Data conversion, transcription of content tables to JSON, CSS, boilerplate, batch jobs |
| H | John | Part D playtests, content authority, routing, gate verdicts |

### 1.2 Frozen files (edit only via a Tier S task that names them)

`shared/protocol.js`, `test/**`, `docs/**`, `AGENTS.md`, `content/packs/seed.json` (after T201), the `TUNING` export names in `shared/strokeMatch.js`.

## 2. `AGENTS.md` (put at repo root; paste into every prompt)

```
PROJECT: Tongzhou, a LAN co-op browser game. Node server + vanilla JS clients.
HARD RULES
1. Only npm dependency is `ws`. No frameworks, bundlers, CDNs, TypeScript.
   A rendering library is allowed only in client/js/world*.js, behind the renderer
   contract (SRS 8.7), bundled locally and pinned (version in PROGRESS.md). Never a CDN.
   The renderer holds no game rules.
2. ES modules everywhere. Client code targets browsers with WebGL 2 (iOS 15+,
   current Chrome, Firefox, Edge). Plain ES2020 is fine. No top-level await.
3. shared/*.js are pure: no DOM, no fs, no Date.now(), no Math.random().
4. Never send positions of moving things over the network. Motion comes from the clock.
5. Every server event that changes shared state carries `at` = accept time + 600 ms.
6. Player-facing text never says wrong / incorrect / error about a player's action.
7. Files <= 250 lines, functions <= 40 lines.
8. Do not edit frozen files: shared/protocol.js, test/**, docs/**, AGENTS.md.
9. Do only the task card. No extra features, no refactors outside listed files.
10. Finish by running `npm test`, then append a PROGRESS.md entry in the given format.
IF THE SPEC IS UNCLEAR: write `QUESTION: ...` in PROGRESS.md and stop.
```

## 3. Task card template

```
TASK <id> — <title>                                   Tier: <S|F|L>
GOAL        one sentence
FILES       files to create or edit (max 3)
READ FIRST  AGENTS.md; SRS sections <list>; files <list>
DEPENDS ON  <task ids>
INTERFACE   exact exports / message types / DOM ids this task must provide
STEPS       3–7 numbered steps
DONE WHEN   named test files pass; plus any manual check
OUT OF SCOPE what not to touch
```

Prompt wrapper for the router: paste `AGENTS.md`, then the card, then the quoted SRS sections, then the current contents of the listed files. Nothing else.

### 3.1 `PROGRESS.md` entry format (append-only)

```
## <task id> | <date> | <model> | attempt <n> | <PASS|FAIL|QUESTION>
files: <list>
tests: <x passed, y failed>
notes: <max 3 lines>
fingerprint: <unchanged | TZ-Mx-n>
```

### 3.2 Worked example card

```
TASK T302 — Stroke matcher                              Tier: F
GOAL        Implement strokeMatch(userPts, medians) exactly as SRS 8.3.
FILES       shared/strokeMatch.js
READ FIRST  AGENTS.md; SRS 8.3; test/strokeMatch.test.js; test/fixtures/mu.json
DEPENDS ON  T301 (fixtures), T302a (tests, Tier S)
INTERFACE   export const TUNING = { start:0.25, end:0.25, lenMin:0.4, lenMax:2.5,
                                   cos:0.6, mean:0.18, minLen:60 }
            export function resample(points, n)        // -> n points by arc length
            export function strokeMatch(userPts, medians)  // -> { index, shape }
STEPS       1. resample() by cumulative arc length.
            2. Per candidate compute dStart, dEnd, lenRatio, cosDir, mean.
            3. Apply TUNING thresholds; pick the smallest mean; else index -1.
DONE WHEN   node --test test/strokeMatch.test.js passes (12 cases incl. reversed
            stroke rejected, later-stroke matched, scribble -> -1).
OUT OF SCOPE relay rule, quality, any UI.
```

## 4. Milestones and gates

### 4.1 Iteration ladder (v1.3, governs build order; supersedes the milestone order of v1.0–1.2)

Every iteration ends with something real people play for ten minutes. Nothing is built until a playable needs it. The task tables in §5 are a card library; this ladder decides which cards are pulled and when.

| It. | Playable | The one question | Cards pulled (trimmed as noted) | Deliberately not built yet |
|---|---|---|---|---|
| I0 | Paper kit | Is a character split between people fun, and does it pull speech? | T002, T003 | All code |
| V0 | **Visual toy**, in parallel with I0. One device, no network: river, arrivals, troubles aboard, hold, spend, 气 as speed. Built outside Chat from `visual-toy-brief-v2.md`. | Do the river, queue, pile-up and spending read clearly and feel good? | TV01 (one card: the brief itself; Tier F or S) | Split hands, face-down forge, inking, server |
| I1 | **Two phones, one forge.** Type the host URL, take a seat, private hands, face-down forge, reveal as text (character, pinyin, meaning), shared hold. Goal: fill the hold as many times as you can in 5 minutes. | Does it survive screens, or do players stop talking? | T101 (only the messages used), T103, T105 (no heartbeat), T201, T203, T205, T206, T212, T207, T208 | QR, lobby, host panel, clock sync, flight delay, reconnect, bots, inking, river |
| I2 | **Something arrives.** Encounters appear as text cards on a simple countdown; spend from the hold; matrix outcomes narrated; 气 as momentum; troubles stay until solved; fixed-time run. A complete game in text. | Is choosing from the hold a real decision, or trivial? | T406, T407 (countdown instead of conveyor), T410, T209 | 3D, conveyor, flotsam (hands refill by deal), inking |
| I3 | **Ink.** Relay inking, stroke data, tone echo, quality tiers. | Does writing add to the game or drag it? | T301, T302a, T302, T303a, T303, T304, T305, T306, T307 | River, Playwright suite |
| I4 | **River.** Fake-3D world view, conveyor, flotsam by side, tide, clock sync, flight delay. | Does depth add tension and make the horizon readable? | T104, T204, T401a–T405, T408, T409 | Reconnect, perf work |
| I5 | **Rough conditions.** QR join, host panel, reconnect, far oar, fog pause, old-device pass, bot soak. | Does lag stay inside the fiction on real old devices? | T106–T110, T501–T506, T308 | Content tools |
| I6 | **Your book.** List-to-pack tool, wild characters, logbook, first river, audio, dials; then operators and words. | Does a real vocabulary list play well, not just the seed? | T601–T613 | Fleet |
| I7 | **Fleet.** Several boats, one river. | Does it scale to a class? | T701–T706 | Art |
| I8 | **Finish.** Art pass, portable folder. | Release check | T801–T803 | — |

### 4.2 Iteration rules

| Rule | Detail |
|---|---|
| Size | At most about 10 cards per iteration. If it needs more, split the iteration. |
| Exit | A 10-minute play session with real players, run by John, on the fingerprinted build. |
| Verdict | One of GO, REWORK (same iteration again, changed), SCRAP. Logged in the charter Decision Log with what was observed. |
| No run-ahead | No card from the next iteration starts before the verdict. |
| Throwaway allowed | I1 and I2 code may be crude. Tests-first applies to `shared/` logic only until I3. |
| Review | The Tier S review (§7) runs from I3 onward. Before that John's play session is the review. |
| Scrap points | After I0, I1 and I2 the sunk cost is small by design. A SCRAP there is the plan working. |

### 4.3 Kill criteria for the early iterations

| It. | GO when | SCRAP or REWORK when |
|---|---|---|
| I0 | Charter §7 G0 | Charter §7 G0 |
| I1 | Players talk before placing in at least half of attempts; a pair fills the hold 3+ times in 5 minutes; someone asks to go again | Players watch the screen in silence and tap; or they show each other their phones |
| I2 | Players argue about which character to spend at least twice per run; at least one "what happens if…" spend; a backfire gets a laugh | Every arrival has one obvious answer; or the hold is ignored until arrival |
| I3 | Players call strokes or turns aloud; nobody asks to skip inking | Players say inking is the boring part, or one player waits idle |

Old milestone names (M1–M8) remain only as card-number prefixes.

## 5. Task tables

Columns: ID | Tier | Files | Depends | Do | Done when.

### M0 Paper (no code)

| ID | Tier | Files | Dep | Do | Done when |
|---|---|---|---|---|---|
| T001 | H+all | `docs/model-calibration.md` | — | Give every available model the same card (T104) and record pass, attempts, time | Routing table in §6 filled from evidence |
| T002 | H | — | — | Print `tongzhou-paper-kit.html`; run 3 sessions with forward-play rules, one of them the pair fight (river deck vs crossed hands) | G0 verdict logged in charter |
| T003 | H | — | T002 GO | Add the five operator cards to a group that has played; 10 minutes | G0b verdict logged in charter |

### M1 Skeleton

| ID | Tier | Files | Dep | Do | Done when |
|---|---|---|---|---|---|
| T101 | S | `package.json`, `AGENTS.md`, `shared/protocol.js` | — | Scaffold; message type constants and `validate(msg)` per SRS §9 | `test/protocol.test.js` passes |
| T102 | S | `test/clock.test.js`, `test/hub.test.js` | T101 | Author tests for T103–T104 | Tests exist and fail |
| T103 | F | `server/http.js`, `server/index.js` | T101 | Static server for `client/`, `content/`, `data/`; print LAN URLs; `/host` localhost only | Manual: page loads from a phone |
| T104 | F | `shared/clock.js` | T102 | SRS §8.1 | `clock.test.js` passes |
| T105 | F | `server/hub.js` | T102 | WS accept, `hello`/`welcome`, token map, `ping`/`pong`, heartbeat | `hub.test.js` passes |
| T106 | F | `client/js/net.js` | T104, T105 | WS wrapper, auto-reconnect with backoff, token in localStorage, `serverNow()` | Manual: kill server, client reconnects |
| T107 | F | `server/room.js`, `test/room.test.js` (S writes test) | T105 | Boats, seats, `sit`, `lobby` broadcast, host commands | `room.test.js` passes |
| T108 | F | `client/index.html`, `client/js/lobby.js`, `client/css/base.css` | T106, T107 | Nickname, seat picker, lobby list | Manual: 2 devices see each other |
| T109 | L | `client/vendor/qrcode.js`, `client/host.html`, `client/js/host.js` | T107 | Vendor one MIT QR file; show URL + QR; boat/seat controls | Manual: phone joins by scanning |
| T110 | F | `tools/sim-clients.js` | T105 | N bots, options `--latency --jitter --loss`, scripted actions from a JSON file | 10 bots sit and stay 5 min |
| T111 | S | — | all M1 | Integration review against SRS §3, §5.1 | Review notes in `PROGRESS.md`; fingerprint TZ-M1-1 |

### M2 Split-glyph core (text UI)

| ID | Tier | Files | Dep | Do | Done when |
|---|---|---|---|---|---|
| T201 | L then S | `content/packs/seed.json` | — | Transcribe content seed §1–§5 to pack schema; S reviews | `validate-pack` passes |
| T202 | S | `tools/validate-pack.js`, `test/recipe.test.js`, `test/forge.test.js`, `test/hands.test.js` | T201 | Validator + tests incl. 呆/杏 slot order and non-character repel | Tests exist and fail |
| T203 | F | `shared/recipe.js` | T202 | SRS §8.4 (pack match only; wild returns none until M6) | `recipe.test.js` passes |
| T204 | F | `shared/flight.js`, `shared/rng.js` | T101 | `at` helper; mulberry32 seeded RNG | Unit tests pass |
| T205 | F | `server/hands.js` | T202, T204 | Deal, limit, `give` with flight, private `hand` | `hands.test.js` passes |
| T206 | F | `server/forge.js` | T203, T205 | State machine SRS §8.6 up to REVEAL, face-down slots (FR-302); INKING and TONE stubbed so a bonded character goes straight to the hold | `forge.test.js` passes |
| T212 | S then F | `test/hold.test.js`, `server/hold.js`, `client/js/holdView.js` | T206 | Hold places, `spend`, `release`, full-hold block (FR-308–311) | `hold.test.js` passes; manual: spend from a phone |
| T207 | F | `client/station.html`, `client/js/station.js`, `client/js/hand.js` | T205 | Hand view, tap tile, give-to-seat buttons | Manual on phone |
| T208 | F | `client/js/forgeView.js` | T206, T207 | Slots, tap-to-place, variant display, repel animation | Manual: build 明 across 2 phones |
| T209 | F | `client/world.html`, `client/js/world.js` | T206 | Text-only world: forge state and cast log on the host screen | Manual |
| T210 | F | `test/fixtures/script-qing.json` | T110, T206 | Bot script: 3 bots build 晴 at 300 ms jitter | Sim asserts one `cast` of 晴 |
| T211 | S+H | — | all M2 | Review; John runs G1 with 3 humans | G1 verdict; fingerprint TZ-M2-1 |

### M3 Ink and tone

| ID | Tier | Files | Dep | Do | Done when |
|---|---|---|---|---|---|
| T301 | L | `tools/build-data.js`, `data/strokes/*`, `data/dict.json` | — | Convert Make Me a Hanzi files per SRS §7.2–7.3; copy licence files; report which seed tiles lack stroke data | All seed characters have stroke files |
| T302a | S | `test/strokeMatch.test.js`, `test/fixtures/*.json` | T301 | 12 cases from real medians | Tests exist and fail |
| T302 | F | `shared/strokeMatch.js` | T302a | See §3.2 | Tests pass |
| T303a | S | `test/ink.test.js`, `test/quality.test.js` | T302a | Lock, smear, fade, P7 same-seat fade, solo exemption | Tests exist and fail |
| T303 | F | `server/ink.js` | T302, T303a | SRS FR-401–407 | `ink.test.js` passes |
| T304 | F | `shared/quality.js` | T303a | SRS §8.5 | `quality.test.js` passes |
| T305 | F | `client/js/glyph.js` | T301 | Draw characters from stroke paths with y-flip; fallback to system font | Manual: 晴 renders on old phone |
| T306 | F | `client/js/inkPad.js` | T303, T305 | Pointer capture, resample to ≤ 24, wet ink, verdict rendering, ghost per dial | Manual |
| T307 | F | `server/tone.js`, `client/js/tonePad.js` | T303 | SRS FR-501–505 | `tone.test.js` (S writes) passes |
| T308 | S | `test/e2e/ink.spec.js` | T306 | Playwright, two pages, real pointer events, ink 木 in relay | Spec passes |
| T309 | S+H | — | all M3 | Review + Part D | Fingerprint TZ-M3-1 |

### M4 River

| ID | Tier | Files | Dep | Do | Done when |
|---|---|---|---|---|---|
| T401a | S | `test/conveyor.test.js`, `test/projection.test.js`, `test/effects.test.js`, `test/schedule.test.js` | — | Tests from SRS §8.2 and the seed matrix | Tests exist and fail |
| T401 | F | `shared/conveyor.js` | T401a | `s(t)`, `z(obj,t)`, segment append | Tests pass |
| T402 | F | `shared/projection.js` | T401a | `project()` exactly as SRS §8.2 | Tests pass |
| T403 | F | `server/schedule.js` | T204, T401a | Seeded scenes: encounters and flotsam with `s` positions | Same seed → same schedule |
| T404 | F | `client/js/world.js` | T402 | three.js scene reusing V0 where possible: river, banks, sprites placed by distance, boat, troubles aboard | Manual: 30 fps on a laptop |
| T405 | F | `server/flotsam.js` | T403, T205 | Offers by side, grab arbitration with RTT backdate (FR-204), drop | `flotsam.test.js` (S) passes |
| T406 | F | `server/effects.js` | T401a | Matrix resolve, potency by tier, domain default | Tests pass |
| T407 | F | `server/run.js` | T403, T406 | Encounter lifecycle, troubles aboard, drain and recovery, speed from 气, fixed-time end (FR-606, 607, 614–616) | `run.test.js` (S) passes |
| T408 | F | `client/js/world.js` (cast part), `client/js/castFx.js` | T404, T305 | Extruded glyph drop; tier render styles; outcome text | Manual |
| T409 | F | `client/js/worldStrip.js` | T404 | River view embedded above the controls on every device; capability check; frame governor (FR-617, 618, 707) | Manual on John's oldest phone |
| T410 | F | `client/js/result.js` | T407 | Result screen FR-608 | Manual |
| T411 | S+H | — | all M4 | Review; John runs G2 | G2 verdict; fingerprint TZ-M4-1 |

### M5 Lag as play

| ID | Tier | Files | Dep | Do | Done when |
|---|---|---|---|---|---|
| T501 | S | `shared/hash.js`, `test/hash.test.js`, `test/resilience.test.js` | — | Canonical state hash; tests for doze, spill, resume | Tests exist |
| T502 | F | `server/hub.js`, `server/hands.js` | T501 | Dozing, tile spill, resume within 60 s (FR-704) | Tests pass |
| T503 | F | `server/hub.js` | T501 | Far-oar badge (FR-703) | Tests pass |
| T504 | F | `client/js/net.js`, `client/js/station.js` | T501 | Fog-bank overlay, resync (FR-705–706) | Manual: pull host Wi-Fi 5 s |
| T505 | F | `tools/sim-clients.js` | T501 | Soak mode: 30 bots, 500 ms jitter, 5% loss, 10 min, hash compare | Zero hash mismatches at end |
| T506 | H | `docs/device-matrix.md` | T505 | Measure oldest phone and laptop | G3 verdict; fingerprint TZ-M5-1 |

### M6 Content and teacher

| ID | Tier | Files | Dep | Do | Done when |
|---|---|---|---|---|---|
| T601 | F | `shared/recipe.js` | T301 | Wild resolve via `dict.json` decomposition | New tests (S) pass |
| T602 | F | `server/room.js`, `client/js/host.js` | — | Dials per seat (charter §5.8), tone step toggle | Manual |
| T603 | F | `client/js/audio.js` | — | Three-tier fallback FR-903 | Manual on 3 devices |
| T604 | F | `server/report.js` | T407 | Run log + CSV export | Test passes |
| T605 | L | `docs/pack-authoring.md` | T202 | Guide for John: schema, matrix rules, validator use | John authors one pack unaided |
| T606 | L | `tools/suggest-families.js` | T301 | List phonetic families from dict for a given character list | Output reviewed by John |
| T607 | F | `server/forge.js`, `client/js/forgeView.js` | T601 | Pocket a cast character as a tile (nested composition) | Tests (S) pass |
| T608 | S then L | `test/makePack.test.js`, `tools/make-pack.js` | T301, T601 | Vocabulary list → pack + fit report (FR-905–906) | Tests pass; John's book list produces a valid pack |
| T609 | F | `server/room.js`, `client/js/host.js` | T608 | Lesson filter (FR-907) | Manual |
| T610 | S then F | `test/operators.test.js`, `content/operators.json`, `server/hold.js` | T212, G0b GO | Operators on the hold (FR-908) | Tests pass |
| T611 | S then F | `test/words.test.js`, `server/hold.js` | T212 | Words from adjacent held characters (FR-909) | Tests pass |
| T612 | F | `client/js/logbook.js`, `server/report.js` | T407 | Logbook (FR-612). Replaces T804 | Manual |
| T613 | F | `server/schedule.js` | T403 | First-river scene order (FR-613) | Schedule test (S) passes |

### M7 Fleet

| ID | Tier | Files | Dep | Do | Done when |
|---|---|---|---|---|---|
| T701 | S | `test/fleet.test.js` | — | Tests for FR-801–804 | Tests exist |
| T702 | F | `server/run.js`, `server/room.js` | T701 | Lanes, shared conveyor, per-boat 气 | Tests pass |
| T703 | F | `server/flotsam.js`, `client/js/hand.js` | T701 | Cross-boat throw | Tests pass |
| T704 | F | `server/effects.js` | T701 | Area effects, capsize, rescue | Tests pass |
| T705 | F | `client/js/world.js` | T702 | Draw up to 6 boats in lanes | Manual |
| T706 | H | — | all M7 | 30-bot soak, then class playtest | G4 verdict |

### M8 Finish

| ID | Tier | Files | Dep | Do | Done when |
|---|---|---|---|---|---|
| T801 | Design | `docs/art-spec.md` | G2 | Ink-wash art spec: palette, brush shapes, glyph tiers | John approves |
| T802 | F | `client/js/world.js`, `client/css/base.css` | T801 | Apply art spec | Part D |
| T803 | L | `start.bat`, `start.command`, `README.txt` | — | Portable folder: bundled Node binary + launcher; firewall and hotspot notes | Runs on a clean PC |
| T804 | F | `client/js/album.js`, `server/report.js` | T604 | Discovery album of outcomes seen | Manual |

## 6. Routing table (fill after T001)

| Model | Tier assumed | T104 pass? | Attempts | Notes |
|---|---|---|---|---|
| Sonnet | S | | | |
| Flash model A | F | | | |
| Flash model B | F | | | |
| Local Qwen | L | | | |

Reroute rule: a model that fails T104 twice is demoted to Tier L work only.

## 7. Review protocol at each milestone (Tier S, one session)

1. Run `npm test` and the sim script; paste results.
2. Audit against charter §9 drift questions; answer each yes/no with file evidence.
3. Grep for red-flag phrases (charter §9).
4. List every file over 250 lines.
5. Bump the fingerprint; write the review entry in `PROGRESS.md`.

## 8. Risk register

| Risk | Sign | Response |
|---|---|---|
| Weak model edits tests to pass | Diff touches `test/**` | Reject attempt; restore; escalate |
| Old-browser syntax slips in | `?.` or `??` in `client/` | Grep in review step; add a lint script at T111 |
| Stroke data missing for variant forms (氵亻讠) | T301 report | Render variants with system font; glyph.js fallback (T305) |
| Guest Wi-Fi isolation | Phones cannot reach host | Host PC hotspot; documented at T803 |
| Windows firewall blocks port | First run prompt ignored | README step; server prints a hint if no client connects in 60 s |
| Matrix authoring load | Blank cells feel flat | Domain defaults; authoring rules; T606 helper |
| Classroom noise | G4 debrief | Fewer boats per room; optional "whisper river" variant to test |

## 9. First five actions for the router

1. Review all Chinese in `content-seed-v1.md` (pinyin, part names, effect tags, operator table).
2. Run T002 (paper, G0), then T003 (G0b). Nothing below matters if G0 is NO-GO.
3. If GO, build I1 only (§4.1). Spend Sonnet on T101 and the `recipe`, `forge` and `hold` tests; everything else on free models.
4. Play I1 with two people for ten minutes. Log GO, REWORK or SCRAP before any I2 card starts.
5. Run T001 calibration alongside I1, using the recipe card as the common task.
