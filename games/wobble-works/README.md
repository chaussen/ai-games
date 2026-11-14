# WOBBLE WORKS · 搭把手

> **One heavy Glow Core. Five beacons. No referee.**
> A family co-op — and occasionally anti-co-op — game for a home WLAN. One
> laptop is the workshop and the scoreboard; every phone is a wobbler.

**Two builds ship in this folder, served by the same process:**

| Mode | What it is | Board URL |
|---|---|---|
| **3D ARENA** | free-roam physics playground. Five beacons, crates, trampolines, a chasm, tackles and a running scoreboard. | `/?board=1` |
| **CLASSIC 2D** | the original side-view chapter campaign. Plates, gates, ropes, water, wind, see-saws and a shared tool budget. | `/classic/?board=1` |

Both are playable from the same QR code and the same `node server.js` — you pick
a mode on the board, not on the server. The board header links across.

**Status: both playable and verified.** 64 automated assertions (18 3D, 12
scoring/tackles, 34 2D), 17 screenshots captured from live runs.

| | |
|---|---|
| Players | 2–16 on one Wi-Fi (3D, 7 exercised) · 2–12 (2D, 3 exercised) |
| Devices | Any modern browser — PC, TV, phone, tablet |
| Install | none. No npm, no CDN, no account, no internet |
| Host | `node server.js` on one machine |
| Session | 3D: open-ended, goals rotate · 2D: five chapters, then free play |
| Docs | [RETROSPECTIVE.md](RETROSPECTIVE.md) — full retrospective covering **both** builds |

---

## 1. Quick start

```sh
cd games/wobble-works
node server.js
```

Open **http://localhost:3000/?board=1** for the 3D arena, or
**http://localhost:3000/classic/?board=1** for the classic side view. Everyone
else scans the QR code on whichever board is up and is playing in about three
seconds.

Optional environment variables:

```sh
PORT=3000                 HTTP + WebSocket port (both modes)
HOST=0.0.0.0              bind address
LAN_IP=192.168.0.196      force the IP printed in the QR code
```

Requirements: Node 18+ (tested on Node 26). Three.js r128, Cannon.js 0.6.2 and
Matter.js 0.20.0 are vendored in [vendor/](vendor/) — unmodified, MIT, offline.

## 2. Controls

### 3D arena

| | Phone | PC keyboard |
|---|---|---|
| Move | on-screen joystick / ◀ ▶ ▲ ▼ | W A S D or arrow keys |
| Jump | JUMP | SPACE |
| Drag the Core | GRAB (hold) | J or K |
| Lift / carry overhead | LIFT | E |
| Throw | THROW | Q |
| Quick call | 1–4 buttons | 1–4 |

Board-only keys: **B** adds a bot, **N** advances to the next goal, **H** toggles
the help sheet, **C** cycles the camera.

### Classic 2D

| | Phone | PC keyboard |
|---|---|---|
| Walk | ◀ ▶ | A D or ← → |
| Jump | JUMP | SPACE |
| Grab left hand | ✋L (hold) | J or Q |
| Grab right hand | ✋R (hold) | K or E |
| Quick call | 👋 😱 | — |

Both hands on the same object means **carrying**: you move it with you, slower.
The board has chapter tabs, the tool dispenser (crate / plank / barrel), hints,
reset and next.

## 3. Rules — 3D arena

1. **One Core.** It spawns above the plaza and only one player can carry it.
2. **Carrying slows you down** (8.5 m/s → 6.2 m/s). Everyone can see the carrier.
3. **You can steal it.** Charging into the carrier knocks the Core loose
   (**+25** to the tackler). A shove that lands nobody gets nothing.
4. **You can throw it.** A thrown Core flies ballistically — the intended way to
   reach beacons that are too high to walk to.
5. **Scoring is individual.** Whoever the Core belongs to when it enters a beacon
   gets **+100** and the crown; the last other player to touch it gets **+50**.
6. **No game over.** Fall off the world and you respawn on the plaza.
7. **A dormant phone is not a missing player.** Dim the screen and your wobbler
   becomes a napping statue with a 💤 tag.

## 4. Rules — Classic 2D

1. **The Core is too heavy for one wobbler** on flat ground: one pusher moves it
   ~100 px/s, four move it ~190 px/s. Solo is possible, slow, and usually a bad
   plan.
2. **Two hands, one object.** Grabbing with both hands carries it; grabbing with
   one drags it. Gravity still applies, so a plank on two springs is a swing.
3. **Plates open gates.** Stand on the plate — or park a crate there — and the
   gate slides up. Latch plates stay open, momentary ones do not.
4. **Falling in is free.** Water poofs you back to the last checkpoint and sends
   the Core back to the start. No lives, no score loss.
5. **The dispenser is shared.** Chapters 2–4 give a fixed budget of crates,
   planks and barrels for the whole room; FREE PLAY gives unlimited parts.
6. **Route medals.** The way you finish names the medal: CATAPULT CREW,
   HUMAN CHAIN, TWO-HAND CARRY, BRIDGE BUILDERS, or CHAOS GREMLINS if you made it
   up as you went.

## 5. The world

### 3D arena

A 96 × 96 m arena with a 14 m tower, a fortress, a chasm and a trampoline pit.

| Beacon | Position | Height | The trick it asks for |
|---|---|---|---|
| SUMMIT BELL | 26, −26 | y 14.5 | climb the spiral ramp and throw from the top |
| SKY HOOP | −25, −25 | y 11.0 | launch from the trampolines and carry/throw mid-air |
| FORTRESS CHALICE | −24, 24 | y 9.2 | build a crate staircase up the battlements |
| CHASM BEACON | 25, 25 | y 7.5 | cross the see-saw plank over the pit |
| MEADOW POST | 0, 36 | y 2.2 | walk it in — the freebie, and the ambush spot |

32 static colliders, 6 movable crates (1.6 m, 18 kg), 4 bounce pads, 1 see-saw,
16 spawn points.

### Classic 2D

Five spaces, all on one screen-height band (ground top y = 760):

| Chapter | Space | Structure | What is in it |
|---|---|---|---|
| 1 THE DOOR | 1500 × 820 | scripted | one plate, one gate, the Core |
| 2 THE SEE-SAW | 1800 × 860 | semi-scripted | high deck, momentary plate, see-saw, rope, planks, water |
| 3 THE GAP | 2300 × 900 | semi-open | chasm, water, rope, wind zone, see-saw, barrel, two planks |
| 4 BELL ISLAND | 2500 × 1000 | open | connected islands, water channels, wind, shared budget of 16 parts |
| 5 FREE PLAY | 2300 × 900 | sandbox | no beacon, unlimited parts |

Measured: run speed 337 px/s, jump 290 px, ~0.78 s to apex. The highest ledge
sits 200 px above the ground, so a jump clears everything the levels ask for and
a lot they do not.

## 6. Architecture

```
  laptop / TV  ──── node server.js ────┬── one authoritative Cannon.js world (3D)
     │  board view                     │      60 Hz tick · 20 Hz snapshots
     │                                  └── one authoritative Matter.js world (2D)
     │                                         60 Hz tick · 20 Hz snapshots
     │                                            ▲
     └── /ws (3D)  /ws2d (2D) ── hand-rolled RFC 6455 ──┘
                       ▲
        phones · tablets · other laptops  (thin clients, a handful of flags)
```

- **Server:** zero dependencies. `http` + a minimal RFC 6455 implementation +
  Cannon.js + Matter.js. Binds 0.0.0.0, prints the real LAN IPs, self-diagnoses
  firewalld. One upgrade route per mode (`/ws`, `/ws2d`), one process.
- **3D client:** Three.js r128, one draw call per body, gradient sky, exponential
  fog, floating nameplates, confetti, goal rings.
- **2D client:** Canvas 2D, one camera per role (board follows the Core, phone
  follows your wobbler), snapshot interpolation, warm workshop palette.
- **Netcode:** clients send input flags; the server sends `state` at 20 Hz. No
  client-side prediction — on a LAN the round trip is 1–3 ms, so there is nothing
  to hide. See [RETROSPECTIVE.md](RETROSPECTIVE.md) section 5.

## 7. Verification

```sh
node smoke-test.mjs       # 3D contract, real server on :3455, 18 assertions
node scoring-test.mjs     # scoring + tackle regression, real server on :3466, 12 assertions
node classic-smoke.mjs    # 2D contract, real server on :3457, 34 assertions
```

3D coverage: static files, vendored bundles, level data, board join, three
controller joins, snapshots containing players / Core / crates / active goal,
movement, jump, lift, throw, bot spawn, goal rotation, AFK-on-dim, instant wake.

2D coverage: assets, `/` still serving the 3D shell, board join with level data,
snapshot cadence, two controllers with distinct colours, jump height, movement,
grab input, chapter switching, sandbox budget, prop drops, reset, fresh chapter
state, survival across disconnects — plus a headless win path: plate opens gate,
Core reaches the beacon, medal and points are awarded.

Screenshots are in [screenshots/](screenshots/) (3D) and
[screenshots/2d/](screenshots/2d/) (2D), produced by
[capture-screens.py](capture-screens.py) and
[capture-classic.py](capture-classic.py) — Playwright + headless Chromium driving
real servers. Zero console errors in both.

## 8. Home-network caveats

**"The site can't be reached" on Android** is almost always the firewall.

```sh
firewall-cmd --query-port=3000/tcp                    # "no" means blocked
sudo firewall-cmd --zone=public --add-port=3000/tcp   # now
sudo firewall-cmd --permanent --zone=public --add-port=3000/tcp
sudo firewall-cmd --reload                            # and after reboot
```

Then check, in order: same subnet (compare the phone's IP with the QR address),
AP / client isolation on guest Wi-Fi, and a virtual NIC winning the IP ranking
(override with `LAN_IP=…`). `bash lan-doctor.sh` dumps interfaces, listeners and
the firewall verdict.

The server does **not** query the firewall on start (that triggers a polkit
password prompt). Opt in with `FIREWALL_CHECK=1 node server.js`.

Plain `http://192.168.x.x` is not a secure context, so the clipboard API may be
unavailable — the Copy button has a fallback.

## 9. Files

| File | What it is |
|---|---|
| [server.js](server.js) | Zero-dep HTTP + WebSocket + authoritative Cannon.js simulation, bot AI, scoring, AFK, and the `/ws2d` route; ~870 lines |
| [levels3d.js](levels3d.js) | 3D level data: 5 beacons, 16 spawns, 32 statics, 4 pads, 6 crates, 1 see-saw |
| [index.html](index.html) | 3D board view (`?board=1`) and controller view in one document |
| [app.js](app.js) | Three.js scene, cameras, nameplates, HUD, QR, confetti; 891 lines |
| [style.css](style.css) | 3D skin: warm cardboard board + portrait phone |
| [classic/](classic/) | **the 2D build** — see below |
| [levels.js](levels.js) | 2D chapter geometry — still the single source of truth for the classic build |
| [smoke-test.mjs](smoke-test.mjs) | 18 assertions, 3D |
| [classic-smoke.mjs](classic-smoke.mjs) | 34 assertions, 2D |
| [capture-screens.py](capture-screens.py) / [capture-classic.py](capture-classic.py) | Playwright screenshot pipelines |
| [puppet-driver.mjs](puppet-driver.mjs) | Six scripted wobblers for 3D screenshots and load checks |
| [lan-doctor.sh](lan-doctor.sh) | Read-only LAN diagnostics |
| [RETROSPECTIVE.md](RETROSPECTIVE.md) | Retrospective: intent vs. shipped for both builds, defect log, honest gaps |
| [docs/design-v1-2d.md](docs/design-v1-2d.md) | The original 2D design document (now implemented in `classic/`) |
| [wireframe.html](wireframe.html) | Historical wireframes |

Inside `classic/`:

| File | What it is |
|---|---|
| [classic/index.html](classic/index.html) | board view + phone controller |
| [classic/sim2d.js](classic/sim2d.js) | Matter.js world: players, hands, Core, plates, gates, ropes, wind, water, medals |
| [classic/net2d.js](classic/net2d.js) | the `/ws2d` room and its 60 Hz / 20 Hz loops |
| [classic/app2d.js](classic/app2d.js) | Canvas renderer, cameras, HUD, board tabs, phone deck |
| [classic/style2d.css](classic/style2d.css) | The 2D skin |

## 10. A note on the two builds

The 3D arena is not a sequel to the 2D game; it replaced it, and the replacement
deleted the 2D runtime (the folder was untracked at the time). The family then
asked for the side view back, so it was rebuilt from the surviving level data,
the vendored Matter.js and the original design document — same geometry, new
code. [RETROSPECTIVE.md](RETROSPECTIVE.md) section 12 records exactly what is
original and what is reconstruction.

The honest difference: the 3D build has more freedom, more accidents and a
tackle button. The 2D build is easier to read, easier to laugh at, and a better
first game — a jump is a shape you can see the end of.

## 11. Licences

Three.js r128 — MIT. Cannon.js 0.6.2 — MIT. Matter.js 0.20.0 — MIT.
qrcode-generator 1.4.4 — MIT, © 2009 Kazuhiko Arase. All vendored unmodified for
offline LAN play.
