# WOBBLE WORKS 3D · 搭把手

> **One heavy Glow Core. Five beacons. No referee.**
> A family co-op — and occasionally anti-co-op — physics arena for a home
> WLAN. One laptop is the workshop and the scoreboard; every phone is a wobbler.
> Nobody can carry the Core alone for long, and nobody has to.

**Status: playable prototype, 3D, verified.** 891-line Three.js client, 848-line
authoritative Cannon.js server, 18 automated assertions green, 10 screenshots
captured from a live 7-player simulation.

| | |
|---|---|
| Players | 2–16 on one Wi-Fi (7 exercised in testing) |
| Devices | Any modern browser — PC, TV, phone, tablet |
| Install | none. No npm, no CDN, no account, no internet |
| Host | `node server.js` on one machine |
| Session | open-ended; goals rotate forever |
| Docs | [RETROSPECTIVE.md](RETROSPECTIVE.md) — full design/build retrospective for external review |

> **Note on older docs.** `docs/design-v1-2d.md` is the superseded Matter.js
> campaign design (4 chapters + sandbox, route medals). It describes a game
> that was designed but never built. What actually exists is described below.

---

## 1. Quick start

```sh
cd games/wobble-works
node server.js
```

Open **http://localhost:3000/?board=1** on the TV / PC. Everyone else scans the
QR code on the board (or types the short LAN link) and is playing in about three
seconds. Press **START**, then **+ Bot** if you want a robot wobbler in the room.

Optional environment variables:

```sh
PORT=3000                 HTTP + WebSocket port
HOST=0.0.0.0              bind address
LAN_IP=192.168.0.196      force the IP printed in the QR code
```

Requirements: Node 18+ (tested on Node 26). Three.js r128 and Cannon.js 0.6.2
are vendored in [vendor/](vendor/) — unmodified, MIT, offline.

## 2. Controls

| | Phone | PC keyboard |
|---|---|---|
| Move | on-screen joystick / ◀ ▶ ▲ ▼ | W A S D or arrow keys |
| Jump | JUMP | SPACE |
| Drag the Core | GRAB (hold) | J or K |
| Lift / carry overhead | LIFT | E |
| Throw | THROW | Q |
| Quick call | 1–4 buttons | 1–4 |

Board-only keys: **B** adds a bot, **N** advances to the next goal, **H** toggles
the help sheet, **C** cycles the camera. The board also has a live scoreboard and
the AFK list.

## 3. Rules

1. **One Core.** It spawns above the plaza and only one player can carry it.
2. **Carrying slows you down** (8.5 m/s → 6.2 m/s). Everyone can see the carrier.
3. **You can steal it.** Charging into the carrier knocks the Core loose
   (**+25** to the tackler). A shove that lands nobody gets nothing.
4. **You can throw it.** A thrown Core flies ballistically — the intended way to
   reach beacons that are too high to walk to.
5. **Scoring is individual.** Whoever the Core belongs to when it enters a beacon
   gets **+100** and the crown; the last other player to touch it gets **+50**.
   The crown moves, the leaderboard updates, the current leader is the MVP.
6. **No game over.** Fall off the world and you respawn on the plaza. Fall in the
   chasm and you respawn. Nothing is ever taken away except the Core.
7. **A dormant phone is not a missing player.** Dim the screen and your wobbler
   becomes a napping statue with a 💤 tag so the room knows you are still there.

## 4. The world

A 96 × 96 m arena with a 14 m tower, a fortress, a chasm and a trampoline pit.
Five beacons, each demanding a different trick.

| Beacon | Position | Height | The trick it asks for |
|---|---|---|---|
| SUMMIT BELL | 26, −26 | y 14.5 | climb the spiral ramp and throw from the top |
| SKY HOOP | −25, −25 | y 11.0 | launch from the trampolines and carry/throw mid-air |
| FORTRESS CHALICE | −24, 24 | y 9.2 | build a crate staircase up the battlements |
| CHASM BEACON | 25, 25 | y 7.5 | cross the see-saw plank over the pit |
| MEADOW POST | 0, 36 | y 2.2 | walk it in — the freebie, and the ambush spot |

| Content | Count |
|---|---|
| Static colliders | 32 (4 ground slabs, 4 hedges, plaza stage, tower + 7 spiral steps, 4 canyon pillars, fortress tier + 3 tops + ramp, 2 chasm flanks, 3 goal posts, 1 abyss floor) |
| Movable crates | 6 (1.6 m, 18 kg) |
| Bounce pads | 4 (impulse 22–26 m/s) |
| See-saws | 1 (9 × 3 m, hinged plank, 35 kg) |
| Spawn points | 16 around the plaza |
| Player bodies | 16 max, compound capsule, mass 16 |

The pit at (25, 25) is real: the ground is built as four slabs that leave a
10 × 10 m hole with an abyss floor nine metres below the respawn line.

## 5. Architecture

```
  laptop / TV  ──── node server.js ─────  ONE authoritative Cannon.js world
     │  board view                           60 Hz physics tick
     │  (Three.js)                           20 Hz snapshots
     │                                            ▲
     └── /ws  ── hand-rolled RFC 6455 WebSocket ──┘
                       ▲
        phones · tablets · other laptops  (thin clients, 6 input flags)
```

- **Server:** zero dependencies. `http` + a minimal RFC 6455 implementation +
  Cannon.js. Binds 0.0.0.0, prints the real LAN IPs, self-diagnoses firewalld.
- **Client:** Three.js r128, one draw call per body, gradient sky, exponential
  fog, floating nameplates, confetti, goal rings.
- **Netcode:** clients send `{type:'input', x, z, jump, grabL, grabR, lift, throw}`;
  the server sends `state` at 20 Hz and the client interpolates. No client-side
  prediction, no reconciliation — on a LAN the round trip is 1–3 ms, so there is
  nothing to hide. See [RETROSPECTIVE.md](RETROSPECTIVE.md) section 5 for why.

## 6. Verification

```sh
node smoke-test.mjs      # boots the real server on :3455, 18 assertions
```

Covered: static files, Three.js and Cannon.js bundles vendored, 3D level data,
board join, three controller joins with IDs, snapshots contain 3 players /
Core / 6 crates / active goal, movement on X, jump, lift, throw, bot spawn, goal
rotation, AFK-on-dim, instant wake. All 18 pass.

Evidence screenshots are in [screenshots/](screenshots/) and were produced by
[capture-screens.py](capture-screens.py) — Playwright + headless Chromium driving
a real server with six scripted players ([puppet-driver.mjs](puppet-driver.mjs))
and one bot. Zero console errors.

## 7. Home-network caveats

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

Plain `http://192.168.x.x` is not a secure context, so the clipboard API may be
unavailable — the Copy button has a fallback.

## 8. Files

| File | What it is |
|---|---|
| [server.js](server.js) | Zero-dep HTTP + WebSocket + authoritative Cannon.js simulation, bot AI, scoring, AFK; 848 lines |
| [levels3d.js](levels3d.js) | Pure data: 5 beacons, 16 spawns, 32 statics, 4 pads, 6 crates, 1 see-saw |
| [index.html](index.html) | Board view (`?board=1`) and phone / PC controller view in one document |
| [app.js](app.js) | Three.js scene, cameras, nameplates, HUD, QR, confetti, interpolation; 891 lines |
| [style.css](style.css) | Warm cardboard workshop skin; responsive board + portrait phone |
| [smoke-test.mjs](smoke-test.mjs) | 18 assertions against the real server |
| [puppet-driver.mjs](puppet-driver.mjs) | Six scripted wobblers for screenshots and load checks |
| [capture-screens.py](capture-screens.py) | Playwright capture pipeline (six camera poses) |
| [lan-doctor.sh](lan-doctor.sh) | Read-only LAN diagnostics |
| [RETROSPECTIVE.md](RETROSPECTIVE.md) | Design-and-build retrospective, intent vs. shipped, defect log |
| [docs/design-v1-2d.md](docs/design-v1-2d.md) | Superseded 2D campaign design + research table |
| [wireframe.html](wireframe.html) | Historical wireframes |
| [levels.js](levels.js), `vendor/matter.min.js` | Legacy from the 2D era; not used by the 3D build |

## 9. Licences

Three.js r128 — MIT. Cannon.js 0.6.2 — MIT. qrcode-generator 1.4.4 — MIT,
© 2009 Kazuhiko Arase. All vendored unmodified for offline LAN play.
