# Automated play-testing: research log

Goal (John, 2026-11-20): **robust automated game testing** for Glyph Isles 2D, as close to real human
play as is feasible and repeatable, running on its own and reporting a result. A PASS cannot promise
fun; it should secure a **bottom line** before real players get the game. Order of questions:
**technology first** (what can see, operate and act as several players), then metrics, then thresholds.

This file is the research log. Session 1 (2026-11-20) covers the technology landscape and three spikes; session 2
(2026-11-20) adds the page's lockstep seam and a human input model; session 3 (2026-11-20) adds a test player's
mind that plays every isle with no script and recovers from its own thumb's mistakes. The spikes live in `lab/autotest/` and run
against the real build. **Where to pick up:** [`AUTOTEST-HANDOFF.md`](AUTOTEST-HANDOFF.md), one entry per session.

---

## 1. Frame: what the standards say automation can and cannot do

| Body / document | What we take from it |
|---|---|
| ISTQB CTAL **Test Automation Engineering** v2.0 (2024) | The **generic test automation architecture (gTAA)** has four layers: *generation* (what to try), *definition* (tests and scripts), *execution* (the runner), *adaptation* (the glue to the system under test). We use it below to place every tool. |
| ISTQB **Game Testing** CT-GaMe (v1.0.1 2022, v2.0 2025) | Game-specific areas: mechanics, graphics, sound, level, controllers, localization; v2.0 adds AI and physics testing, and puts more weight on accessibility, usability and fairness. **Playtesting is a human, experience-based activity**: automation supports it but does not replace it. |
| ISTQB **Foundation** (CTFL 4.0) | Test levels (component / integration / system / acceptance), the **test oracle problem** (how a machine knows the right answer), experience-based and exploratory testing. |
| ISTQB **AI Testing** CT-AI v2.0 and **Testing with Generative AI** CT-GenAI (2025) | Risks of using AI as a tester: hallucination, non-determinism, bias. An AI verdict needs its own checking before anyone acts on it. |
| ISO/IEC **25010:2023** | Quality characteristics to measure against. Since 2023: *interaction capability* (was usability, now with **user engagement** and **inclusivity**), *faultlessness* (was maturity), *flexibility* (was portability), new *safety*. |
| Research: EA SEED (Bergdahl 2020, Gordillo 2021), Holmgård *procedural personas* (2019), iv4XR / aplib agents, VideoGameBench (2025), VideoGameQA-Bench (NeurIPS 2025) | Agents find stuck spots, exploits and coverage holes; personas model *styles* of play; current vision-language models are **poor players** but **useful glitch spotters and bug-report writers**. |

**Our reading:** automation can own the oracle questions that have a machine answer (does it run, can it be
won, do inputs do what the screen says, does anything break, overlap, freeze, or soft-lock, does it hold up
on the target screens and with several players). Humans keep the questions with no machine answer: fun,
pace, whether a child gets it. A third kind sits between them: *heuristic* questions (is this readable,
confusing, unfair), where an AI observer can **flag** but not **decide**.

---

## 2. What exists today, and the gap

| Test | Mind | Sees by | Acts by | Fidelity |
|---|---|---|---|---|
| `sim-test.mjs` (293 checks, 42 wins) | scripted routes (`bot.mjs`, `routes.mjs`) | reading sim state | calling the sim | rules only, no page |
| `smoke-test.mjs` | — | HTTP | HTTP | server and font |
| `screen-test.mjs` / `screen-check.py` | short scripted moves | DOM rects, `WF2D` hooks, pixel probe | **real CDP touch**, keys | 11 screens, layout budget, contrast |
| `play-test.mjs` / `tools/play-check.py` | scripted routes | sim state | **injected inside `world.step`** (skips touch) | real page, renderer, messages |

**The gap:**
1. Nothing plays **from what is on screen** through **the real controls**. The route bot reads exact sim
   state and presses inside the sim, so it can't notice, for example, that a label hides a stone or that
   the stick ignores a sloppy thumb.
2. Nothing plays **off the scripted routes**. Every route is a known-good path; nobody explores.
3. Nothing plays **like a person**: no reaction time, no wrong presses, no hesitation, no children's hands.
4. Nothing runs **more than one player** (2D has no rooms yet; the 3D server does).
5. Nothing runs on **a real mobile browser** (Chromium with touch emulation is not Safari on an iPad, nor
   Chrome on a phone).

---

## 3. "Genuine" has three axes

A human tester **sees** pixels, **acts** through a finger on glass, and **thinks** like a player. For each
axis there is a ladder, from cheap and exact to costly and realistic:

| Rung | SEE (perception) | ACT (actuation) | THINK (mind) |
|---|---|---|---|
| 0 | sim state (exact) | call the sim | scripted route |
| 1 | page hooks (`WF2D`), DOM rects | inject into the page loop | random / monkey |
| 2 | **render-state check**: the sim says a stone is at (x, y); do the pixels show it there? | **synthetic touch through CDP** (the browser's real input path) | search / planner over the sim (finds any path, shortcuts) |
| 3 | pixel CV: template match, OCR | OS-level input in an **Android emulator** (`adb`, real mobile Chrome) | persona agents (styles of play; child-like timing and errors) |
| 4 | vision-language model (VLM) on screenshots | real phone over `adb` / USB | LLM agent with a test charter (exploratory) |

**Principle:** use the cheapest rung that can catch a given defect, and use the high rungs to **cross-check**
the low ones. Don't build everything at rung 4. Example: the main bot thinks from sim state (rung 0, fast and
exact) but presses through CDP touch (rung 2), and a render-state check (rung 2) proves that what it "knew"
was also on screen.

---

## 4. Technology landscape (gTAA layers)

### 4.1 Execution: where the game runs

| Option | Here? | Verdict |
|---|---|---|
| **Sim in Node** (pure, deterministic, no `Math.random`) | yes | **Measured: 2,900× real time on one core** (Spike 2). Thousands of episodes per isle in seconds. The base for exploration, search, personas, balance. |
| **Chromium + Playwright (Python)** | yes (1.60, `/usr/bin/chromium`) | Already used. Real renderer, real CDP touch, device emulation. Not a real mobile browser. |
| Playwright **WebKit** (Linux build) | not installed (one download) | Nearest thing to Safari on Linux. Not iOS Safari, but it catches WebKit-only canvas, font and pointer quirks. Cheap to add. |
| Playwright **Firefox** | installed | Third engine; low priority (no target device runs it). |
| **Android Emulator** (AVD, KVM) + Chrome + `adb` | KVM present; SDK not installed (~several GB) | Real mobile Chrome, real Android touch stack, OS-level input. Playwright's `_android` is **experimental**; touch gestures beyond tap are uncertain, so drive the page through CDP over `adb forward`, or with `adb shell input`. Feasible; worth one session. |
| **Real Android phone** over USB / Wi-Fi `adb` | depends on John's devices | The highest fidelity that can still run on its own. Same tools as the emulator. |
| iPhone / iPad Safari | **not on Linux** | Needs macOS + Xcode, or a paid cloud device farm (BrowserStack, Sauce, LambdaTest: real iPhones, external service, cost). Keep iOS to manual playtests unless that changes. |

### 4.2 Time control: making a real-time game testable

- **Playwright clock** (`page.clock.install` + `pause_at` + `run_for`) controls `requestAnimationFrame`
  and `performance.now` in the real page. **Measured (Spike 1):** paused, 1 s of wall time gave 0 frames;
  `run_for(1000)` gave 62 frames in 0.48 s. A slow observer can therefore play a real-time platformer one
  slice at a time. Note: `install()` alone does **not** freeze; you must `pause_at`.
- **Repeatability caveat (measured):** through real touch, three identical runs ended at x = 26.815, 26.892 and
  26.738: **±1 sim step**. The page's fixed-step accumulator keeps a fraction of a frame across restarts, and
  fake rAF ticks every 16 ms against a 16.67 ms step. So: **bit-exact replay is a sim-level property; page-level
  runs are repeatable in outcome, not frame by frame**, unless the page gets a test seam (e.g. `?lockstep=1`: one
  sim step per animation frame, accumulator reset on restart). The seam is small, but it touches the product,
  so it is a decision for John.
- **Session 2: the seam is in** (John said yes). `?lockstep=1` makes each animation frame exactly one sim step and
  draws exactly where the sim is; `WF2D.lockstep` reports it. **Measured** (`lockstep-repeat.py`): the same touch
  script three times gives 27.025 / 27.025 / 27.102 without it and 26.795 three times with it, 138 frames each.
  So page runs under a paused clock are now **bit-exact**: `run_for(16 × N)` = N steps.
- CDP `Emulation.setVirtualTimePolicy`: an alternative; not tested, and probably not needed.
- **Multiplayer:** the 3D server advances its sim on a wall-clock `setInterval`, and a browser's fake clock
  can't pause it. Lockstep multiplayer tests need a server test clock (e.g. `TEST_CLOCK=1`: the server steps
  only when told to). Without one, multiplayer tests run in real time and are judged on outcomes.

### 4.3 Adaptation: input

| Option | Fidelity | Notes |
|---|---|---|
| `WF2D.setStick` / `world.press` | low | Skips the touch layer; fine for rules. |
| **CDP `Input.dispatchTouchEvent`** | good | Same path as a finger in the browser: pointer events, multi-touch (stick held while JUMP is tapped). Already in `screen-check.py`; **works under the paused clock** (Spike 1). |
| Playwright `touchscreen.tap` | fair | Taps only; no hold or drag. |
| `adb shell input` / `sendevent` (emulator, phone) | high | Passes through Android's touch stack and Chrome's gesture handling (scroll, zoom, long-press menus: the things that bite children). |

**Human-likeness in input** is a model on top of any of these: reaction delay, aim error around the button
centre, hold-time spread, thumb drift on the stick, accidental second touches, lifting the thumb mid-run. The
parameters should be **calibrated from recorded human play** (§4.6), not guessed.

### 4.4 Perception: "seeing" the game

| Option | Here? | Verdict |
|---|---|---|
| Sim state / `WF2D` | yes | Exact; it is the oracle, not the player's view. |
| **Render-state consistency** | yes (Spike 3 writes the ground truth) | Project every stone, wall and the hero to screen; check the pixels there (glyph present, not covered by the HUD, contrast). Catches "the sim is right but the player can't see it". Cheap, deterministic, no AI. **Recommended core "see" test.** |
| Pixel CV (OpenCV template matching, OCR) | not installed (pip) | Glyph tiles are crisp and flat: template matching should work well. Chinese OCR (PaddleOCR) is heavy. Useful if we ever need to play with no hooks at all (real phone screenshots). |
| **VLM via headless Claude** (`claude -p`, image in, JSON out) | yes (Claude Code 2.1.329, John's subscription) | **Measured (Spike 3):** from pixels only, it found both stones within ~3 px, read the goal 明, the message line and the GRAB button text correctly. **19 s per frame.** Its "anything wrong" list mixed real usability points with noise. **Verdict: an advisory observer at checkpoints, never a gate or a player.** |
| VLM as **player** | — | VideoGameBench (2025): the best model finished under 1% of the games in real time and 1.6% when the game paused for it, with a "knowing-doing gap" (right idea, wrong press). Even with our paused clock, a 60-120 s isle at 4 decisions a second is 240-480 calls ≈ 1-2.5 hours. Not a viable main player today. |

### 4.5 Generation: the "mind" of the test player

| Mind | Finds | Cost here | Evidence |
|---|---|---|---|
| Scripted routes (have) | regressions on known paths | built | 42 wins per sim run |
| **Monkey / random** | crashes, NaN, escaping the map, inside-rock, soft-locks | **Spike 2: 7 h of play per isle-set in 8.7 s** | found a real (if benign) overlap on Dawn (§5) |
| **Search / planner over the sim** (BFS / A* on coarse state, or MCTS) | *any* winning path, unintended shortcuts, unwinnable states, the minimum number of actions | moderate (needs an action abstraction: go-to, take, place) | **built in session 3** (`lab/autotest/mind.mjs`, §5): wins all 21 isles with no script, and through the motor channel |
| **Novelty / Go-Explore** (keep the runs that reach new cells, restart from them) | coverage holes, unreachable gems, ledges you can't leave | low-moderate | EA SEED curiosity-driven coverage (CoG 2021) |
| **Procedural personas** (utility weights: explorer, rusher, collector, "random child") | how different styles fare; whether the "wrong" style gets stuck | moderate | Holmgård et al., IEEE ToG 2019 |
| Reinforcement learning (PPO) | exploits, balance | **high** (training stack, Python/torch, tuning) | EA SEED 2020; heavy for one person's game |
| **Imitation from human traces** | plays "like John's kids" | needs recording first | Generative personas (Barthet & Liapis) |
| **LLM charter agent** (exploratory session: "try to confuse the order of stones", writes a report) | heuristic issues, confusing moments, missing feedback | high per run; fine nightly on a few isles | CT-GenAI risks apply: verify every claim |

### 4.6 Data from real play (the bridge to "human-like")

The 3D server already logs playtest events to JSONL (`--log`). If the 2D page recorded **input traces**
(stick value and button presses per frame, plus isle and seed) during John's family playtests, we would get:
(a) **replays as regression tests** (bit-exact in the sim), (b) **calibration** for the human input model
(reaction times, hold lengths, how often a GRAB is wrong), (c) data for **imitation personas**. This is the most
direct route to "as genuine as human play". Privacy: device-local, no names, John's call.
**Session 2:** John marked it low priority. Parked. What it would buy, concretely: the numbers in
`lab/autotest/human.mjs` (`PERSONAS`) are guesses, and a few recorded family runs would replace them with
measurements (how late a child really presses JUMP at an edge, how often GRAB is missed).

### 4.7 Multiplayer

| Need | Tool | Notes |
|---|---|---|
| Several real clients | N Playwright browser contexts in one Chromium | Each context is a separate player; ~100-200 MB each, so 8 on this laptop is comfortable. |
| Many light clients | protocol bots in Node (WebSocket, the same messages the page sends) | Load and sync tests: 16 players, joins and leaves, reconnection. |
| Bad networks | a small Node TCP proxy between client and server that adds delay, jitter and drops | Zero-install and exact. CDP network throttling is not reliable for WebSocket frames (to confirm). Linux `tc netem` needs root. |
| Mixed crews | some rung-2 page bots + some Node bots + one VLM observer | Matches the "crew" idea without 16 browsers. |
| Lockstep | server test clock (§4.2) | Otherwise judge outcomes in real time. |

The 2D game has no rooms yet, so a multiplayer spike would run against the 3D server (`games/tongzhou-forge`)
to prove the harness, then move to 2D when rooms land.
**Session 2 decision (John: "whichever is faster and easier"):** build the crew harness against the **3D server
now**, in **real time**, judged on outcomes. No server test clock, so the 3D game is not touched. Node protocol
bots, N browser contexts and the lag proxy carry over to 2D when rooms land.

### 4.8 Oracles: how a machine knows something is wrong

| Oracle | Kind | Example here |
|---|---|---|
| Invariants **with tolerance** | implicit | Not inside rock for more than N frames; never below the map; no NaN; no console error. |
| **Soft-lock detection** | implicit | From any reachable state, the search agent can still win (or the isle's restart is one tap away). |
| **Metamorphic** | relation | relaxed ≥ standard ≥ strict in success rate; the same input trace gives the same sim trace in all three looks (the renderer must not affect rules); a win stays a win at 50 fps and 60 fps. |
| **Differential** | two implementations | Sim in Node vs sim in the page, fed the same trace: identical events. |
| Render-state consistency | perception | §4.4. |
| Golden screenshots | regression | Only under the paused clock (the ink look animates); per-region, with tolerance. |
| Performance | measured | Frame time under CPU throttling (CDP `Emulation.setCPUThrottlingRate`): the README notes 40 ms frames on a software rasteriser. |
| VLM advisory | heuristic | "Hard to read", "overlaps", "looks broken": goes to a human triage list, never fails a build alone. |

### 4.9 Commercial and open tools looked at

| Tool | What it is | Fit |
|---|---|---|
| **nunu.ai** | multimodal agents that play and test games (YC; $6M, 2025) | Engine-agnostic SaaS aimed at studios; cost and external hosting. Watch, don't adopt. |
| **modl.ai** (modl:test) | AI bots for bugs, performance, balance, "no SDK" | Studio-oriented, paid. |
| **Regression Games** | AI agents for Unity | Unity only. |
| **Airtest / Poco** (NetEase, open source) | image-recognition game automation, Android / Windows / web | The image-template idea is right for a real phone; the project looks quiet (last push 2024). Borrow the idea, not the tool. |
| **iv4XR / aplib** (EU research, Java) | BDI test agents with tactics, goals and model-based testing | Good ideas (goal-structured agents, tactics like "explore", "go to"); Java plumbing is out of place here. Borrow the pattern. |

None beats a small, zero-install harness built around this game's pure sim and `WF2D` hooks, which match the
repo's rules (no CDN, no npm unless needed, tests boot the real server on a test port).

---

## 5. Spikes (evidence)

### Session 1 spikes (2026-11-20)

All three are in `lab/autotest/`, run against the real server on test port 3491.

| Spike | What it showed |
|---|---|
| `lockstep.py` | The real page can be **paused and stepped** with Playwright's clock and driven by **real CDP touch**; outcome-repeatable, ±1 sim step frame-to-frame (§4.2). |
| `monkey.mjs` (seeded) | 20 × 60 s random episodes on each of 21 isles (7 h of play) in 8.7 s. No crash, NaN or map escape. Coverage 34-66% of open cells per isle. **One flag on Dawn** (below). Random play forges a few characters but wins nothing, as expected. |
| `replay-dawn.mjs` | Replays the flag. A thrown 木 lands as a bridge **on the frame the hero falls into that gap**, so the bridge appears around the hero. The sim pushes the hero up onto the bridge within ⅓ s and play goes on. **Benign but real**: a visible pop. It shows why invariants need a tolerance and why flags go to triage. |
| `see.py` + `claude -p` | Ground truth vs a pixel-only VLM read on Sun and Moon (`see-sun.*`). Positions within ~3 px, all text right, 19 s per frame. |

**Observations to triage (not yet confirmed as defects):**
- At the start of Two Trees (phone, landscape), the hero on the boat sits **partly behind the 跳 JUMP button**
  while the title card is up (`lab/autotest/lockstep-a.png`). `screen-check` checks the feet during play;
  it may not cover the first frames. To check against the screen budget.
- The VLM found the red "makes nothing" banner hard to read over the sky, and called the card's grey
  stroke-form glyph "a broken 木". Usability points for John, not verdicts.

### Session 2 spikes (2026-11-20)

| Spike | What it showed |
|---|---|
| `lockstep-repeat.py` | The `?lockstep=1` seam gives bit-exact page runs through real touch (§4.2). |
| `human.mjs` | A **motor channel** between a test player's mind and the game. Timing error on each planned press (lognormal), stick placement spread and the page's dead zone, JUMP hold spread, taps that miss a button of the measured size (JUMP 66 px, GRAB 58 px across) and a second tap after noticing. Seeded. Personas `steady`, `rusher` and `kid` are **uncalibrated guesses** (§4.6). |
| `personas.mjs` | Every isle's two routes × each persona × 10 seeds (14 s). The route bot as written wins 100%. Through the channel: steady 38%, rusher 34%, kid 19% mean. |
| `ablate.mjs`, `trace.mjs` | **Why so low: the bots, not (only) the game.** With all noise at zero the channel wins 100%, but a **single frame (16 ms) of delay** already fails Friends, Leaf and Crowd 3 of 3. Traced on Friends: one late input leaves the hero on the ground at (17, 2) instead of up on the clouds at (13.6, 9.9), and the route bot's `go` can't climb back. A person would ride the clouds again. |
| `clone-probe.mjs` | The `World` can be deep-copied (prototypes, Maps, Sets; no closures inside): **0.2 ms per copy**, and the copy plays the same future as the original. A search mind that tries moves on copies is affordable. |

**What session 2 changes in the design.** The scripted routes are fixed paths. They prove each isle can be won;
they are not players. Under any human imperfection they fail where a person would just try again, so their
failure rate under noise measures the bot, not the isle. A human-like test player needs a **mind that replans
from wherever it is**: a goal-directed search on world copies over a few macro moves (walk to, jump toward,
leap, take, GRAB as), re-planned every half second, driving the motor channel. Then a persona's win rate and
time-to-win per isle become a real **difficulty and precision signal** for session 5's thresholds. The motor
channel stays as built. Results are recorded in this order: zero noise = 100% first, then personas.

### Session 3 spikes (2026-11-20): a mind that recovers

`lab/autotest/mind.mjs` is a test player with **no script**. It reads the isle (the wanted character, its one
recipe, the stones, walls and gaps) and decides again every 0.2 s from wherever it is. It presses only what a
person can press, so it drives the motor channel (`human.mjs`) exactly as the route bots did. Three layers:

1. **Plan** (stateless, recomputed every decision): deliver the wanted character if it exists; else make it
   from its recipe (carry one piece and set it BESIDE on the right side, or stand on the lower piece and GRAB ON
   TOP), making a missing piece first (森 needs 林). If the place to go can't be reached it asks *"reachable if
   this wall or gap were gone?"* and fetches what clears it (fire, water, light; wood or earth with a long
   enough span, or makes one: Forest's five-wide gap needs a 林). The carry leg is checked before a piece is
   picked up. A stone in hand that is no use is set down where it can't forge by accident. Last resorts: send
   a stranded stone home by the river (a stone in water floats home), move a stone that boxes another in, and
   restart the isle as a stuck person would from the menu.
2. **Map**: a graph of the places a body can stand (rock tops, stone tops). Its edges are short moves *played
   on world copies* (walk; jump with 0-6 leaps at different moments; land on a ledge; ride the clouds), so it
   knows what the physics allows. Edges are cached by the exact layout near them.
3. **Act**: every 0.2 s it plays each candidate move from the real state on a copy, to landing, and takes the
   one with least *time + cost to go*. Near the goal it walks to the spot and presses GRAB when the button
   says the right thing; before a forge it checks on a copy that GRAB now makes the right character.

It allows for its own **median** hand latency (a person learns their own timing) but not the random part,
which stays an error it must recover from. It sees sim state and predicts the physics exactly: that is its
known gap against a person (§4.4, §4.6).

| Spike | What it showed |
|---|---|
| `mind-zero.mjs` | **Acceptance 1 met: 21 of 21 isles won at zero noise with no script**, median 10 s of game time per isle (Forest 27 s, Drench 21 s, Rest 19 s: the two-step and fetch-a-clearer isles). 3-13 s of CPU per isle with a cold cache. |
| `mind-personas.mjs` | **Acceptance 2:** every isle x {ideal, steady, rusher, kid} x 8 seeds, 180 s cap, restart when stuck. Results below. The same personas through the *route bots* in session 2: steady 38%, rusher 34%, kid 19%. |
| `mind-ablate.mjs` | One noise source off at a time: what each costs a persona on an isle (below). |
| `mind-trace.mjs` | The mind's plan log, the isle's events and the end state of one run: how every finding below was found. |
| `friends-trap.mjs` | A seeded random thumb (independent of the mind's map) checks the Friends "trap" (below). |

**Final sweep** (`node lab/autotest/mind-personas.mjs 8`: 21 isles x 3 personas x 8 seeds + ideal, 693 runs,
180 s cap, 17 min on 7 cores; raw runs in `lab/autotest/mind-personas.json`). Win rate / median seconds to win:

| Isle | ideal | steady | rusher | kid | kid / ideal |
|---|---|---|---|---|---|
| two-trees | 100% 8 | 100% 10 | 100% 10 | 100% 12 | 1.5 |
| sun-and-moon | 100% 11 | 100% 13 | 100% 13 | 100% 21 | 1.9 |
| dawn | 100% 10 | 100% 11 | 100% 11 | 100% 19 | 1.9 |
| old-leaf | 100% 10 | 100% 11 | 100% 11 | 100% 16 | 1.6 |
| friends | 100% 10 | 100% 11 | 100% 11 | 100% 17 | 1.7 |
| rest | 100% 19 | 100% 23 | 100% 22 | 100% 30 | 1.6 |
| early-light | 100% 10 | 100% 11 | 100% 11 | 100% 16 | 1.6 |
| fruit-field | 100% 10 | 100% 11 | 100% 11 | 100% 16 | 1.6 |
| red-earth | 100% 10 | 100% 11 | 100% 11 | 100% 14 | 1.4 |
| good | 100% 10 | 100% 11 | 100% 11 | 100% 14 | 1.4 |
| apricot | 100% 10 | 100% 10 | 100% 10 | 100% 15 | 1.5 |
| partner | 100% 10 | 100% 12 | 100% 12 | 100% 16 | 1.6 |
| bathe | 100% 10 | 100% 11 | 100% 11 | 100% 14 | 1.4 |
| leaf | 100% 10 | 100% 11 | 100% 12 | 100% 15 | 1.5 |
| stove | 100% 10 | 100% 12 | 100% 12 | 100% 13 | 1.3 |
| blaze | 100% 10 | 100% 11 | 100% 11 | 100% 14 | 1.4 |
| forest | 100% 27 | 100% 32 | 100% 31 | 100% 35 | 1.3 |
| **crowd** | 100% 12 | 100% 16 | 100% 14 | 100% **33** | **2.8** |
| **burn** | 100% 12 | 100% 14 | 100% 14 | 100% **32** | **2.7** |
| drench | 100% 21 | 100% 26 | 100% 25 | 100% 30 | 1.4 |
| **flourish** | 100% 11 | 100% 12 | 100% 12 | 100% **26** | **2.4** |
| **all** | **100% 10** | **100% 11** | **100% 11** | **100% 17** | 1.7 |

Per run: the kid misses 4.6 taps, falls in the river 0.5 times and hits thorns 0.3 times (steady and rusher:
almost never); 4 of the 504 persona runs restarted. Session 2's route bots through the same channel won 38%,
34% and 19%.

**Defects found and fixed in the mind during the session** (each from a trace; the lesson of session 2 again:
a test player's failure is the test player's until shown otherwise):

| # | Symptom | Cause | Fix |
|---|---|---|---|
| M1 | took a piece, couldn't pass with it, set it down, took it again (Rest) | planned one leg at a time | check the carry leg first; clear the wall before picking the piece up |
| M2 | Forest: "nothing fills a gap of five" | only looked for loose stones | make a filler from a recipe (林); never use the wanted character as one |
| M3 | started a second 林 while the first was still in the air | read the world mid-throw | watch a stone land before deciding |
| M4 | "no way" while standing inside a just-forged stone | no map node there | off-centre nodes; nearest node on the level |
| M5 | GRAB grabbed and then set down again (kid) | pressed every frame while the delayed press was on its way | one GRAB, then watch for 0.7 s |
| M6 | jumped in place forever beside a gap (steady, Old Leaf) | a no-progress move scored best | line up on the node (stand still) and require progress |
| M7 | couldn't get onto a two-wide tower top | every climb kept the stick held and flew over | a "land on the ledge" move (let go once over higher ground) |
| M8 | rusher never faced the stone | a 0.25 stick nudge rounds to 0 for a full-tilt thumb | turn with one short tap |
| M9 | the chosen climb did nothing | **executed the move object the rollout had used up** | run a fresh copy of the chosen move |
| M10 | a seed's trace differed from the same seed in the sweep | edge cache keyed on stone positions rounded to 0.25 | exact keys: one seed is one exact run |
| M11 | moved a piece back and forth forever | relocated a piece that wasn't the one in the way | relocate only the partner whose side is blocked |
| M12 | stood on the stone it wanted to take | GRAB takes the stone beside you first | step off it on the free side |
| M13 | Friends at zero noise: 0 of 6 | planned leaps as instant; a leap is lift-and-tap (70 ms), so the identical failure repeated | plan with its own median latency; seeded variety after a restart; restart when nothing is made for 75 s |
| M14 | Burn: "no way to take 林", restarts | the 林 lay between the gap and the 火: nowhere to stand to take it | move the stone that boxes it in |
| M15 | Early Light at zero noise: one climb failed identically for 40 s | a leap through a thumb is *lift*-and-tap; the lift cuts a jump still rising, and the plan didn't know | the rollouts lift the thumb too |
| M16 | two leaps one frame apart (a wasted wall refill) | a move re-chosen mid-air forgot the leap already on its way | no second air JUMP while one is in flight |
| M17 | the same, from the other side | "hold JUMP while rising" put the thumb back on the button after a leap: on glass that is a tap | never hold JUMP again without meaning a press |

**Findings in the game** (for John's triage; numbers from the final sweep):

1. **Defect, fixed in `sim.js`: a thrown stone could hang in the air for good.** On Dawn the kid threw 日 at the
   木 from the ground: it came down on the 木's top corner, the "slide off a corner" rule moved it aside but kept
   its throw speed, so every frame it flew back over the corner and slid off again. It hung beside the 木 at
   the 木's top height; GRAB can't take a stone that isn't resting and its spring doesn't regrow, so the isle
   was stuck until a restart. Reproduced in the pure sim (any plain THROW from standing height 2.7 short of a
   resting stone), fixed with one line (the slide also stops the stone's sideways speed), and a regression
   check added to `sim-test.mjs` (fails before the fix, passes after). All game tests pass.
2. **Near soft-lock: the pillar on Friends (and Leaf, same layout).** Drop off the pillar's *left* side
   without its stone and the left area (pavilion, one 月) is walled in by a pillar 7 high. The mind finds no way
   up and restarts. `friends-trap.mjs` (200 seeded random minutes, independent of the mind's map) found the
   way: **2 times in 200**, by a four-leap chain (brush the 月 in the air, the pillar wall, then the high gem
   at (10.5, 11)). Reachable, but hidden: a child will restart. A design question, not a bug: a way back
   (a cloud on the left, or the pillar stone regrowing when it is far from home), or let the restart be it.
3. **A late GRAB turns ON TOP into BESIDE**, which is a dud ("mirror") and can box a piece in. On Burn the 林
   ended between the gap and the 火 with nowhere to stand to take it; the way out is to move the 火 (the mind
   learned to, M14). Duds per isle in the final sweep (24 persona runs per isle): dawn 7, blaze 7, forest 6, crowd 6, rest 5, flourish 5, burn 5, others 0-2.
4. **Restarts** (no way on for 15 s, the same step for 40 s, or nothing made for 75 s): 4 in 504 persona runs, all the kid's (Crowd 2, Forest 1,
   Flourish 1). The pillar trap of finding 2 was entered 3 times in 24 kid runs by earlier versions of the
   mind and not at all by the final one: it is a configuration that exists, not a frequent one.

**Ablation: what costs the kid its time** (`mind-ablate.mjs <isle> kid 6`, one noise source off at a time;
median seconds to win, all 6 of 6 won in every row):

| Isle | kid | no timing error | exact stick | no missed taps | exact JUMP hold | no noise | Reading |
|---|---|---|---|---|---|---|---|
| burn | 33.6 | **14.0** | 39.0 | 34.8 | 39.0 | 11.3 | **timing**: carrying 木 over the 2-high thorn hedge at x 22 with the one leap a carrier gets (all 25 thorn hits in 6 kid runs were there, holding 木) |
| crowd | 42.9 | **17.9** | 21.0 | 22.5 | 42.8 | 12.5 | **timing** first, then stick and taps: climbing the tower for the third 人 |
| friends | 17.1 | 13.6 | 18.5 | 13.8 | 17.2 | 10.5 | timing and missed taps, mildly: the cloud stair |
| early-light | 15.0 | 15.8 | 26.2 | 15.2 | 15.5 | 11.1 | nothing dominant (the exact-stick row is a seed effect; 6 seeds is few) |

So the isles that cost a child most are the ones that ask for a **timed leap while carrying** (Burn, Crowd),
not the ones with the most steps (Forest, Drench). That is a precision signal per isle, of the kind session 6
can put a budget on.

**What session 3 changes.** The test player is now a mind, not a script: it wins every isle with no route and
recovers from its own thumb, so the persona numbers measure the *isle* (how much time each kind of imprecision
costs, where a player gets stuck) rather than the bot. It found a real defect the route bots could not (they
never throw at the wrong spot) and a near soft-lock. Two caveats hold every number: the personas are still
**uncalibrated guesses** (§4.6), and the mind predicts physics perfectly where a person misjudges. The
render-state check (sim truth vs the drawn frame) was not reached and moves to session 4, where the page is
driven anyway.

---

## 6. Emerging shape (to be confirmed in sessions 3-5)

A **fidelity ladder**, each level with its own job and repeatability promise:

| Level | Runs | Mind / see / act | Repeatable as | Job |
|---|---|---|---|---|
| **L0 sim swarm** | every commit, seconds | monkey, search, novelty, personas / sim state / sim API | bit-exact (seeded) | winnable, no soft-locks, no exploits, invariants, balance numbers |
| **L1 page lockstep** | every commit, minutes | route + persona bots / state + render check / **CDP touch** | outcome (N runs) | controls do what the screen says; what the sim knows is visible |
| **L2 page real time** | nightly | human-model bots (reaction, aim error) / state / CDP touch, CPU-throttled | outcome, statistical | timing on slow phones, the jump physics in the page |
| **L3 Android emulator** | nightly / pre-release | L1 bots / state / `adb` input in mobile Chrome | outcome | the real mobile browser and touch stack |
| **L4 crew** | pre-release | N contexts + Node bots / proxy with bad network | outcome | sync, joins, lag |
| **Observer** | on demand only (John: no nightly) | VLM on screenshots | advisory | readability, overlaps, "looks broken" → triage list; e.g. a one-off look if a dark theme is tried |
| **Humans** | before each hand-over | John's family | — | fun, pace, understanding (CT-GaMe playtesting) |

---

## 7. Decisions for John (answered 2026-11-20)

| # | Question | John | What it means |
|---|---|---|---|
| 1 | `?lockstep=1` test seam in the page | **yes** | Done in session 2 (§4.2). |
| 2 | Android phone over USB; iOS | **yes**, "tell me what to install" | Install list in `AUTOTEST-HANDOFF.md`. iOS stays manual (no device cloud). |
| 3 | Nightly VLM observer | **no nightly**; "dark theme maybe" | The observer is on demand only; a candidate use is checking a dark theme if one is tried. |
| 4 | Opt-in input recorder | "what for? low priority" | Parked. What it buys is in §4.6. |
| 5 | Crew harness on 3D now or wait | "whichever is faster and easier" | 3D server now, real time, no server test clock (§4.7). |

Also from John: **write a hand-off at the end of every session** (`AUTOTEST-HANDOFF.md`).

## 8. Plan for the next sessions (revised in session 3)

- **S3, a mind that recovers:** done (§5). The search mind wins every isle with no script and through the motor
  channel; persona win rates, time-to-win, restarts and ablations per isle; one sim defect fixed.
- **S4, the page, then the real mobile browser:** first the render-state check as a real test (the mind plays
  in the page under `?lockstep=1` through CDP touch; each frame, the hero, stones and GRAB label drawn where the
  sim says), then the phone over `adb` (Chrome, `adb reverse` + CDP), then the Android emulator. WebKit build
  for Safari's engine.
- **S5, crew:** contexts + Node protocol bots + lag proxy against the 3D server, in real time.
- **S6, metrics and thresholds** (John's questions 1 and 2), mapped to ISO 25010:2023 and CT-GaMe areas, using
  the numbers from S3-S5. Candidates from S3: zero-noise mind wins every isle (a gate, ~2 min); per persona,
  win rate within a time cap, restarts per run, and time-to-win as a multiple of the ideal (a difficulty
  budget per isle).

## Sources

- ISTQB CT-GaMe: [certification page](https://istqb.org/certifications/certified-tester-game-testing-ct-game/),
  [v1.0.1 syllabus](https://www.istqb.org/wp-content/uploads/2024/11/ISTQB_CT_GaMe_Syllabus_v1.0.1_LtrKuyi.pdf),
  [v2.0 announcement](https://istqb.org/istqb-strengthens-its-global-certification-portfolio-with-five-new-and-updated-certifications/)
- ISTQB CTAL-TAE v2.0: [syllabus](https://www.istqb.org/wp-content/uploads/2024/11/ISTQB_CTAL-TAE_Syllabus_v2.0.pdf)
- ISTQB CT-GenAI: [BCS page](https://www.bcs.org/qualifications-and-certifications/certifications-for-professionals/software-testing-certifications/istqb-certified-tester-testing-with-generative-ai-ct-genai/);
  CT-AI v2.0: [release note](https://istqb.org/istqb-releases-certified-tester-ai-testing-ct-ai-syllabus-version-2-0/)
- ISO/IEC 25010:2023 changes: [arc42 summary](https://quality.arc42.org/articles/iso-25010-update-2023)
- Taesiri et al., VideoGameQA-Bench (NeurIPS 2025): [arXiv 2505.15952](https://arxiv.org/abs/2505.15952?context=cs)
- Zhang et al., VideoGameBench (2025): [arXiv 2505.18134](https://arxiv.org/pdf/2505.18134)
- Bergdahl et al., Augmenting Automated Game Testing with Deep RL (CoG 2020): [arXiv 2103.15819](https://arxiv.org/pdf/2103.15819);
  Gordillo et al., curiosity-driven coverage (CoG 2021): [arXiv 2103.13798](https://arxiv.org/pdf/2103.13798)
- Holmgård et al., Automated Playtesting with Procedural Personas (IEEE ToG 2019): [arXiv 1802.06881](https://arxiv.org/pdf/1802.06881)
- Generative Personas That Behave and Experience Like Humans: [arXiv 2209.00459](https://arxiv.org/pdf/2209.00459)
- iv4XR / aplib: [framework](https://github.com/iv4xr-project/iv4xr-framework), [aplib](https://github.com/iv4xr-project/aplib)
- AI for Games in the Foundation Model Era (2026 survey): [arXiv 2609.16679](https://arxiv.org/pdf/2609.16679)
- Bi, Li & Zhai, *FFitts law: modeling finger touch with Fitts' law* (CHI 2013): the touch-spread model behind `PADS`/`aim` in `human.mjs`
- Playwright [clock](https://playwright.dev/python/docs/clock), [Android (experimental)](https://playwright.dev/docs/api/class-android)
- Airtest / Poco: [docs](https://airtest.doc.io.netease.com/en/tutorial/1_quick_start_guide)
- nunu.ai: [YC launch](https://www.ycombinator.com/launches/Jzd-nunu-ai-ai-agents-to-play-and-test-games),
  [GamesBeat](https://gamesbeat.com/nunu-ai-raises-6m-for-ai-agents-dubbed-unembodied-minds-for-game-testing/)
