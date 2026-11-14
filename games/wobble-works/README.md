# WOBBLE WORKS · 搭把手

> **One heavy Glow Core. No referee.**
> A family co-op — and occasionally anti-co-op — game for a home WLAN. One
> laptop is the workshop and the scoreboard; every phone is a wobbler.

Two builds live in this folder and **share one server entry point**
(`server.js`); a `--mode` switch picks which one runs.

| Mode | Folder | What it is |
|---|---|---|
| **2d** (default) | [2d/](2d/) | **The original side-view game**, recovered byte-for-byte from the session that wrote it (see §8). Small cartoon wobblers with two independently grabbing hands, fixed full-level camera, chapter campaign: plates, gates, ropes, water, wind, see-saws, tool budget. Matter.js + Canvas 2D. Its own [README](2d/README.md). |
| **3d** | [3d/](3d/) | The later **3D arena experiment**: free-roam physics playground with five beacons, crates, trampolines, tackles and a scoreboard. Cannon.js + Three.js. |

```sh
cd games/wobble-works
node server.js               # 2D original (default)
node server.js --mode=3d     # 3D arena
WOBBLE_MODE=3d node server.js
```

One mode runs per process. To have both up at once, start two processes on
different ports (`PORT=3001 node server.js --mode=3d`).

The Matter.js, Cannon.js, Three.js and QR libraries live once in
[vendor/](vendor/) and are served to whichever build is running.

| | |
|---|---|
| Players | 2–16 on one Wi-Fi |
| Devices | Any modern browser — PC, TV, phone, tablet |
| Install | none. No npm, no CDN, no account, no internet |
| Docs | [2d/README.md](2d/README.md) · [RETROSPECTIVE.md](RETROSPECTIVE.md) (covers both builds) |

---

## 1. Quick start

```sh
cd games/wobble-works
node server.js [--mode=2d|3d]
```

Open **http://localhost:3000/?board=1** on the TV/PC. Everyone else scans the QR
code and is playing in about three seconds.

```sh
PORT=3000                 HTTP + WebSocket port
HOST=0.0.0.0              bind address
LAN_IP=192.168.0.196      force the IP printed in the QR code
WOBBLE_MODE=2d|3d         same as --mode
```

Requirements: Node 18+. Port 3000 is the default — use another port if a
family server is already running.

## 2. 2D original

Controls, chapter rules, architecture and home-network notes are in
[2d/README.md](2d/README.md).

## 3. 3D arena

### Controls

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

### Rules

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

### The world

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

## 4. Architecture

```
  laptop / TV ── node server.js [--mode=2d|3d] ── one authoritative physics world
     │ board view                                   (Matter.js in 2d, Cannon.js in 3d)
     │                                               60 Hz tick · 20 Hz snapshots
     └── /ws ── hand-rolled RFC 6455 ───────────────────┘
                       ▲
        phones · tablets · other laptops  (thin clients, a handful of flags)
```

- **Server:** zero dependencies. `http` + a minimal RFC 6455 implementation +
  the vendored physics library. Binds 0.0.0.0, prints the real LAN IPs. The
  launcher `server.js` loads `2d/server.js` or `3d/server.js`.
- **3D client:** Three.js r128, gradient sky, fog, floating nameplates, confetti.
- **2D client:** Canvas 2D, fixed camera over the whole level, cartoon wobblers
  with two independent hands, ripples at the feet on every jump.
- **Netcode:** clients send input flags; the server sends `state` at 20 Hz. No
  client-side prediction — on a LAN the round trip is 1–3 ms, so there is nothing
  to hide. See [RETROSPECTIVE.md](RETROSPECTIVE.md) section 5.

## 5. Verification

```sh
cd 2d && node smoke-test.mjs   # 2D contract, real server on :3431, 17 checks
cd 3d && node smoke-test.mjs   # 3D contract, real server on :3455
cd 3d && node scoring-test.mjs # 3D scoring + tackle regression, :3466
```

Both tests boot the real server through `../server.js` with the matching mode.
None use port 3000. 3D screenshots are in [3d/screenshots/](3d/screenshots/),
produced by [3d/capture-screens.py](3d/capture-screens.py).

## 6. Home-network caveats

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

## 7. Files

| Path | What it is |
|---|---|
| [server.js](server.js) | Launcher: `--mode=2d|3d` picks which build's server runs |
| [vendor/](vendor/) | Shared offline libraries: Matter.js, Cannon.js, Three.js, qrcode |
| [2d/](2d/) | Original 2D build: `server.js` (Matter.js authority), `app.js` (canvas client), `levels.js`, `index.html`, `style.css`, `wireframe.html`, `smoke-test.mjs`, and `tools/` (diagnostic and capture scripts from the original session) |
| [3d/](3d/) | 3D build: `server.js` (Cannon.js authority), `app.js` (Three.js client), `levels3d.js`, `index.html`, `style.css`, tests, `screenshots/` |
| [lan-doctor.sh](lan-doctor.sh) | Read-only LAN diagnostics |
| [RETROSPECTIVE.md](RETROSPECTIVE.md) | Retrospective for both builds |
| [docs/design-v1-2d.md](docs/design-v1-2d.md) | The original 2D design document |

## 8. How the two builds relate

The 3D arena replaced the 2D game in place, and the replacement overwrote the 2D
runtime in a folder that was not under version control. A first attempt rebuilt
2D from the design document and level data. It did not look or play the same.
The real 2D code was later recovered from the transcript of the session that
wrote it, by replaying that session's file writes and edits in order up to the
point just before the 3D rewrite. That recovered code is `2d/`. The earlier
reconstruction has been removed. [RETROSPECTIVE.md](RETROSPECTIVE.md) section 12
has the history.

The family's feedback was that the 2D version was friendlier and funnier; the
3D arena is kept as an experiment.

## 9. Licences

Three.js r128 — MIT. Cannon.js 0.6.2 — MIT. Matter.js 0.20.0 — MIT.
qrcode-generator 1.4.4 — MIT, © 2009 Kazuhiko Arase. All vendored unmodified for
offline LAN play.
