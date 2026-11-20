# Automated play-testing: session hand-offs

One entry per session, newest first. Each says where things stand, how to resume, what is open, and what's next.
The full reasoning and evidence are in [`AUTOTEST.md`](AUTOTEST.md); the experiments are in `../lab/autotest/`
(its README has every command). John asked for this hand-off at the end of every session.

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

**For John to install (Android, decision 2)**
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
