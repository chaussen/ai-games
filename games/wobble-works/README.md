# WOBBLE WORKS · 搭把手

> **One heavy Glow Core. No referee.**
> A family co-op — and occasionally anti-co-op — game for a home WLAN. One
> laptop is the workshop and the scoreboard; every phone is a wobbler.

Two builds live in this folder and **share one server entry point**
(`server.js`); a `--mode` switch picks which one runs.

| Mode | Folder | What it is |
|---|---|---|
| **2d** (default) | [2d/](2d/) | **The original side-view game**, recovered byte-for-byte from the session that wrote it (see §8). Small cartoon wobblers with two independently grabbing hands, fixed full-level camera, chapter campaign: plates, gates, ropes, water, wind, see-saws, tool budget. Matter.js + Canvas 2D. Its own [README](2d/README.md). |
| **3d** | [3d/](3d/) | **The 3D co-op rebuild**: fixed isometric camera, five hand-built stages on floating workshop islands, plates, gates, lifts and crates, pass the Core to a friend. Custom grid physics + Three.js. Its own [README](3d/README.md). |

```sh
cd games/wobble-works
node server.js               # 2D original (default)
node server.js --mode=3d     # 3D co-op stages
WOBBLE_MODE=3d node server.js
```

One mode runs per process. To have both up at once, start two processes on
different ports (`PORT=3001 node server.js --mode=3d`).

The Matter.js, Three.js and QR libraries live once in [vendor/](vendor/) and are
served to whichever build is running. (`cannon.min.js` is left over from the
earlier 3D arena; nothing loads it now.)

| | |
|---|---|
| Players | 2–16 on one Wi-Fi |
| Devices | Any modern browser — PC, TV, phone, tablet |
| Install | none. No npm, no CDN, no account, no internet |
| Docs | [2d/README.md](2d/README.md) · [3d/README.md](3d/README.md) · [RETROSPECTIVE.md](RETROSPECTIVE.md) (2D and the earlier 3D arena) |

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
[2d/README.md](2d/README.md). Wobblers have stick-man legs and floppy arms; grab an object
and walk into it to push, walk away to pull, hold JUMP to hoist. Stage 1 has a low brick
wall: two players haul the Core over quickly, one player alone can do it slowly. The door
opens only while something (a wobbler or the Core) stands on the plate.

## 3. 3D co-op stages

Controls, rules, stage list, architecture, tests and a short retrospective are in
[3d/README.md](3d/README.md). In one paragraph: the camera is fixed and never
turns; the TV shows the whole stage; phones have a stick and two buttons. The
team carries one heavy Glow Core to a beacon. A carrier cannot jump and the Core
cannot climb a step by itself, so players pass it to each other, hold pressure
plates for each other, and ride lifts. Every stage can also be finished alone,
more slowly, by parking crates on plates.

This replaced the earlier 3D arena (free-roam field, orbit camera, individual
scoring and tackles) after feedback that the camera was too much for a casual
game and the look was mechanical. The arena is in git history;
[RETROSPECTIVE.md](RETROSPECTIVE.md) still describes it.

## 4. Architecture

```
  laptop / TV ── node server.js [--mode=2d|3d] ── one authoritative physics world
     │ board view                                   (Matter.js in 2d, grid physics in 3d)
     │                                               60 Hz tick · 20-30 Hz snapshots
     └── /ws ── hand-rolled RFC 6455 ───────────────────┘
                       ▲
        phones · tablets · other laptops  (thin clients, a handful of flags)
```

- **Server:** zero dependencies. `http` + a minimal RFC 6455 implementation +
  the vendored physics library. Binds 0.0.0.0, prints the real LAN IPs. The
  launcher `server.js` loads `2d/server.js` or `3d/server.js`.
- **3D client:** Three.js r128, fixed orthographic isometric camera, procedural
  pastel dioramas, DOM name tags, confetti.
- **2D client:** Canvas 2D, fixed camera over the whole level, cartoon wobblers
  with two independent hands, ripples at the feet on every jump.
- **Netcode:** clients send inputs; the server sends snapshots (20 Hz in 2d, 30 Hz in 3d). No
  client-side prediction — on a LAN the round trip is 1–3 ms, so there is nothing
  to hide. See [RETROSPECTIVE.md](RETROSPECTIVE.md) section 5.

## 5. Verification

```sh
cd 2d && node smoke-test.mjs   # 2D contract, real server on :3431, 17 checks
cd 2d && node hoist-test.mjs   # 2D two-player hoist over the stage 1 wall, :3432
cd 2d && node solo-test.mjs    # 2D one-player slow hoist + hold-down pressure plate, :3433
cd 3d && node sim-test.mjs     # 3D: every stage solved solo + co-op rules, no server
cd 3d && node smoke-test.mjs   # 3D contract, real server on :3455, real play-through
```

The smoke tests boot the real server through `../server.js` with the matching mode.
None use port 3000. 3D screenshots are in [3d/screenshots/](3d/screenshots/),
produced from a running build by [3d/tools/capture.py](3d/tools/capture.py).

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
| [vendor/](vendor/) | Shared offline libraries: Matter.js, Three.js, qrcode (Cannon.js is unused) |
| [2d/](2d/) | Original 2D build: `server.js` (Matter.js authority), `app.js` (canvas client), `levels.js`, `index.html`, `style.css`, `wireframe.html`, `smoke-test.mjs`, and `tools/` (diagnostic and capture scripts from the original session) |
| [3d/](3d/) | 3D build: `sim.js` (the game), `server.js`, `app.js` (Three.js client), `levels.js`, `index.html`, `style.css`, tests, `tools/`, `screenshots/` |
| [lan-doctor.sh](lan-doctor.sh) | Read-only LAN diagnostics |
| [RETROSPECTIVE.md](RETROSPECTIVE.md) | Retrospective for the 2D build and the earlier 3D arena (the 3D rebuild's is in its README) |
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

The family's feedback was that the 2D version was friendlier and funnier. The
3D arena has since been replaced by the co-op rebuild in `3d/` (section 3).

## 9. Licences

Three.js r128 — MIT. Cannon.js 0.6.2 — MIT. Matter.js 0.20.0 — MIT.
qrcode-generator 1.4.4 — MIT, © 2009 Kazuhiko Arase. All vendored unmodified for
offline LAN play.
