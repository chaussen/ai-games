# Automated play-testing: session hand-offs

One entry per session, newest first. Each says where things stand, how to resume, what is open, and what's next.
The full reasoning and evidence are in [`AUTOTEST.md`](AUTOTEST.md); the experiments are in `../lab/autotest/`
(its README has every command). John asked for this hand-off at the end of every session.

---

## Session 4 (2026-11-21): the mind in the real page, then on John's phone

**State**
- **Built:** `lab/autotest/page-mind.mjs` (the S3 mind playing the real page under `?lockstep=1` through CDP
  touch) and `lab/autotest/cdp.mjs` (a zero-install CDP client for headless Chromium and for Chrome on Android
  over `adb`). Every frame it checks:
  - **state:** the page's world equals the lab's shadow world bit for bit;
  - **GRAB label:** the button says what GRAB would do;
  - **render:** each thing is hidden and the frame redrawn, so the changed pixels show where that thing is
    drawn, against its sim box. Tolerances and why are in AUTOTEST.md §5, S4.
- **Part 1 met:** all 21 isles won in the page, at exactly the sim mind's times, and runs repeat frame for frame.
  - Ink: every check passed on every one of 15,061 frames.
  - One Stroke: the same, apart from one frame (Partner f476, the hero 0.32 u sideways holding a torch out,
    against 0.3 u).
- **Part 2 partly met:** John's ALI-NX1 (Android 15, Chrome 157).
  - Two Trees fully checked on every frame, in portrait and in landscape.
  - Two Trees, Sun and Moon, Stove and Dawn in both orientations, the drawing checked every 30th frame and
    state and label every frame. All won at the sim's times.
- **Product change (test hooks only):** `WF2D.redraw()` (draw the current state again) and `WF2D.fx` (the effects
  list, set aside while measuring), both in `app.js`.
  - Passing after the change: `sim-test` 294, `smoke-test` 30 and `screen-test`.
  - `play-test` (21/21) passed with `redraw` in place, before the one-line `fx` addition.
- **No render defect found in the game.** All nine findings were in the test and are fixed (AUTOTEST.md §5, S4,
  T1-T9). The ones that matter for anyone driving a real page:
  - Chrome holds touch moves until a real frame (T2): wait one real frame after each batch of touches.
  - On Android a tab made by CDP opens in the background (T8).
  - A tab reused across isles at random stopped taking any touch, even real ones (T9): use a fresh tab per isle,
    opened by an intent.
- Logs: `lab/autotest/s4-runs/`.

**Resume**
```sh
cd games/tongzhou-forge-2d
PORT=3491 HOST=127.0.0.1 node server.js &                     # test port, never 3000
PORT=3491 node lab/autotest/page-mind.mjs all                 # headless, ink, ≈17 min; exit 1 on any failed check
PORT=3491 node lab/autotest/page-mind.mjs all --art=cut       # One Stroke
PORT=3491 node lab/autotest/page-mind.mjs all --phone --every=30   # the phone, ≈10 min (phone unlocked, hands off)
adb shell settings put system user_rotation 1                 # landscape for the phone; 0 to put it back
```

**For John**
- **Landscape on your phone loses a quarter of the height to Chrome's bars:** the game gets 776 × 273 of
  816 × 369. Options for later are full screen through Add to Home screen (a manifest), or full screen on the
  first tap. Not built.
- "The mobile game runs slow" during the test is the full render check: about 0.4 s a frame on the phone. The
  game's own frame rate on the phone hasn't been measured yet (next).
- **Conjure (your question):** the writing pad was cut from the 2D greybox ("No writing pad", GREYBOX.md §5) and
  never came back; it isn't in BETA.md's gaps either. Not on purpose. You want it back as four players, each
  conjuring their own objects. That is a big new mechanic, so plan and docs come first, with a review before code.

**Open**
- **S4b, finishing the phone:**
  - all 21 isles on the phone in both orientations (`--every=30`, or fully checked if left running ≈1.5 h each);
  - the game's own frame rate on the phone;
  - the One Stroke hero flag (Partner f476);
  - the T9 root cause in Chrome (not needed while fresh tabs work).
- Not reached: the Android emulator and a WebKit (Safari engine) run.
- Approved game work, not built: the Friends/Leaf cloud and a more forgiving ON TOP (S3 decisions). Then Conjure
  for four players, plan first. `page-mind.mjs` is the check that the page still draws what the sim does after
  either.
- S5 (crew) and S6 (metrics) as planned in AUTOTEST.md §8.

---

## Session 3 (2026-11-20): a mind that recovers

**State**
- **Built:** `lab/autotest/mind.mjs`, a test player with no script. Three layers:
  - a stateless plan from the isle's recipe (deliver, make, clear a wall or gap, make a filler, set aside,
    send home by the river, move a stone that boxes another in, restart when stuck);
  - a navigation graph whose edges are moves played on world copies;
  - a per-0.2 s choice of the move with the least time + cost-to-go.

  It drives `human.mjs` exactly as the route bots did and allows for its persona's median latency. Runners:
  `mind-zero`, `mind-personas`, `mind-ablate`, `mind-trace`, and `friends-trap` (a random-thumb probe).
- **Acceptance 1 met:** 21 of 21 isles won at zero noise with no script, median 10 s of game time.
- **Acceptance 2 met:** 693 runs (21 isles × ideal + 3 personas × 8 seeds), **all won** within 180 s. Median
  time to win: ideal 10 s, steady 11, rusher 11, kid 17 (route bots in S2: 38 / 34 / 19% wins). The kid's
  hardest isles are Crowd (2.8× ideal), Burn (2.7×) and Flourish (2.4×). Ablation shows the cost is **timing**:
  a timed leap while carrying (on Burn, every thorn hit is at the hedge at x 22, holding 木).
- **Game change:** fixed a **sim defect** the mind found. A stone thrown onto another stone's top corner hung in
  the air for good, ungrabbable. The slide-off rule now stops its sideways speed (one line in `sim.js`), and a
  regression check is in `sim-test.mjs` (fails before, passes after). `sim-test` 294, `smoke-test` 30,
  `screen-test` (ink, greybox) and `play-test` 21/21 pass. Logged in `docs/BETA.md` §5.
- 17 defects of the mind itself were found and fixed by tracing (AUTOTEST.md §5, S3, M1-M17). The biggest:
  executing a move the rollout had already used up (M9); planning leaps as instant when a thumb's leap is
  lift-and-tap (M13, M15); putting the thumb back on JUMP, which is a tap on glass (M17).

**Resume**
```sh
cd games/tongzhou-forge-2d
node lab/autotest/mind-zero.mjs                     # 21/21 at zero noise (≈2.5 min)
node lab/autotest/mind-personas.mjs 8               # the persona table (≈13 min on 7 cores)
MAX=120 node lab/autotest/mind-ablate.mjs burn kid 6
node lab/autotest/mind-trace.mjs dawn kid 1000      # how any one run went
```

**For John to triage** (AUTOTEST.md §5, S3, findings 1-4); **John's answers (2026-11-20)** in bold
1. Sim defect, fixed (above). Say if a hovering stone was ever seen in family play.
2. **Friends / Leaf, the pillar's far side.** Drop down the pavilion side without the pillar's stone and the
   only way back up is a hidden four-leap chain. A random player found it 2 times in 200 minutes.
   **Add a cloud on that side** (Leaf too): "be mindful of the player's quality of life; a restart should not be
   the only way out."
3. **A late GRAB turns ON TOP into BESIDE** (a dud) on 12 of 21 isles (up to 7 in 24 runs: Dawn, Blaze). It can
   box a piece in (Burn). **Yes, enhance it, but carefully:** a knob, small steps, measured with the mind before
   and after, and no meant BESIDE may turn into ON TOP.
4. Burn and Crowd ask a child for the most precise thumb. **Fine as is.**

These are written down for later and **not built**; the checks each needs are in AUTOTEST.md §7 (S3 decisions)
and BETA.md's known gaps. They are game work, outside the S4 test work, unless John puts them in a session.

**Open**
- The **render-state check** (sim truth vs drawn frame under `?lockstep=1`) was not reached; it starts S4.
- The personas are still uncalibrated guesses; the mind predicts physics exactly. Both caveats hold every number.
- Kid restarts (4 in 504 persona runs: Crowd 2, Forest 1, Flourish 1) are not traced one by one.
- Cost: a full persona sweep is about 13 minutes on 7 cores. That is fine for nightly, too slow for every
  commit. `mind-zero` (2.5 min) could become a gate (S6).

**Next (S4): the page, then the phone.**
1. The mind plays in the real page: `?lockstep=1`, CDP touch on the measured stick and buttons. Each frame,
   check that the hero, stones, held stone and GRAB label are drawn where the sim says (exact under lockstep).
   Acceptance: a mind run in the page reaches the same win as in the sim, and the render check passes every
   frame of it.
2. The same on the Android phone over `adb`, then the emulator. `adb` is installed (2026-11-20); access opens
   after John's next reboot. **Stop before this step and ask John:** he wants to be there for the phone. Do
   part 1 first and on its own.

---

## Session 2 (2026-11-20): lockstep seam, human motor model, why route bots can't be the mind

**State**
- John answered the five decisions (AUTOTEST.md §7): seam yes; Android phone yes; no nightly VLM; recorder parked;
  crew harness on the 3D server in real time.
- **Product change:** `app.js` reads `?lockstep=1`. Each animation frame is exactly one sim step and draws where the
  sim is; `WF2D.lockstep` reports it. It is off unless asked for, and the normal loop is unchanged.
  `sim-test` 293, `smoke-test` 30 and `play-test` (21 of 21 isles) pass.
- **Built:** `lab/autotest/human.mjs`, a seeded motor channel (timing error, stick spread, dead zone, JUMP hold
  spread, missed taps on the measured buttons, re-tap after noticing) that wraps a `World` for any mind. Personas
  `steady`, `rusher` and `kid` are uncalibrated guesses.
- **Found:** the scripted routes win 100% as written but only 19-38% through the channel. One frame of delay is
  enough to fail some isles, because a route that drifts off its path can't recover (trace: Friends). The
  failure rate measures the bot, not the isle. The `World` deep-copies in 0.2 ms with an identical future, so a
  search mind is affordable.

**Resume**
```sh
cd games/tongzhou-forge-2d
PORT=3491 HOST=127.0.0.1 node server.js &          # test port, never 3000
python3 lab/autotest/lockstep-repeat.py 3491       # free vs lockstep repeatability
node lab/autotest/personas.mjs 10                  # persona win-rate table (≈15 s)
node lab/autotest/ablate.mjs friends clouds_up 3   # one noise source at a time
node lab/autotest/clone-probe.mjs                  # world copy speed and fidelity
```

**Open**
- John's "dark theme maybe" (decision 3) is read as: use the VLM observer on demand, for example to check a dark
  theme if one is tried. Confirm if he meant something else.
- Still untriaged from S1: the hero partly behind JUMP at the Two Trees start; the red dud banner's legibility.

**For John to install (Android, decision 2)**: done for `adb` (2026-11-20, active after a reboot)
```sh
sudo pacman -S android-tools android-udev     # adb; udev rules and the adbusers group
sudo usermod -aG adbusers $USER               # then log out and in again
sudo pacman -S jre21-openjdk-headless         # only for the emulator's sdkmanager (S4); the phone needs none
```
On the phone: Settings → About phone → tap *Build number* 7 times → Developer options → **USB debugging** on.
Plug it in, accept the "Allow USB debugging" prompt, and `adb devices` should list it. Chrome must be installed
on the phone. Nothing else: the test reaches the laptop's server with `adb reverse tcp:3491 tcp:3491` and drives
Chrome over `adb forward tcp:9222 localabstract:chrome_devtools_remote`. The emulator system image (~1.5 GB) can be
downloaded later into `~/Android/Sdk` without sudo.

**Next (S3): a mind that recovers.** A search player on world copies: macro moves (walk to x, jump toward, leap,
take 字, GRAB as …), short look-ahead, re-planned every ~0.5 s, with the goal read from the isle. Acceptance:
1. At zero noise it wins every isle with no script.
2. Through `human.mjs` it gives per-isle persona win rates and time-to-win that differ for game reasons
   (checked by ablation and traces, as in S2).

Then the render-state check (sim truth vs the drawn frame, exact under `?lockstep=1`) becomes a real test.

---

## Session 1 (2026-11-20): standards frame, landscape, three spikes

**State.** `AUTOTEST.md` §1-§6: the ISTQB/ISO frame, the see/act/think ladder, the tools landscape and the fidelity
ladder (L0 sim swarm → L4 crew, observer, humans). Spikes: paused-clock lockstep with real CDP touch
(`lockstep.py`), a seeded monkey at 2,900× real time (`monkey.mjs`, one benign flag on Dawn: `replay-dawn.mjs`),
and a pixel-only VLM read vs sim truth (`see.py`; accurate but 19 s a frame; advisory only). No game code changed.

**Open then:** the five decisions (answered in S2).
