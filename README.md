# AI Games

A gallery of small, AI-built games plus one production classroom product.
Everything here is meant to be run on a home Wi-Fi network from a single laptop:
one screen as the board, every phone as a controller. No accounts, no app
installs, no internet.

## What is in here

| Path | Game | Players | Tech | Runs on |
|---|---|---|---|---|
| `index.html` + `game/` | **学字坊 · The Character Game** — classroom Chinese-character learning game (production, Casey Chinese School) | class of students | vanilla JS, static | GitHub Pages · [play.caseychinese.org](https://play.caseychinese.org) |
| [games/wobble-works/](games/wobble-works/) | **Wobble Works** — two builds, one launcher (`--mode=2d|3d`): the original side-view **2D** chapter campaign (default, recovered from its original build session) and a free-roam **3D arena** experiment | 2–16 | Node + hand-rolled WebSocket, Cannon.js + Three.js (3D), Matter.js + Canvas 2D (2D) | `node server.js [--mode=3d]` on the LAN |
| [games/firefly-relay/](games/firefly-relay/) | **Firefly Relay** — one-button rhythm relay; keep the spark alive from lantern to lantern | 2–12 | Node + WebSocket, Canvas 2D | `node server.js [--mode=3d]` on the LAN |
| [games/cavern-rush/](games/cavern-rush/) | **Crystal Cavern Rush** — 90-second 3D crystal collecting race with proximity multipliers | 2–8 | Node + `ws`, Three.js | `npm install && npm start` |
| [games/neon-dash/](games/neon-dash/) | **Neon Dash** — single-file solo runner | 1 | one HTML file, Canvas | open the file |

The production product lives at the repo root because GitHub Pages serves it
from `master`'s root (`CNAME` → `play.caseychinese.org`). Everything
experimental lives under `games/`.

## The LAN games (same room, same Wi-Fi)

Wobble Works, Firefly Relay and Crystal Cavern Rush all follow one shape:

```
   laptop / TV   ──  node server.js  ──  authoritative simulation
        │  screen                        ▲ 20–30 snapshots per second
        │                                │
   phones / tablets ── browser ── QR or short LAN URL, nothing to install
```

Open the board URL on the host machine, then let everyone else scan the QR code.
A firewall that drops the port is the number one cause of "site can't be
reached" on Android — see each game's README section on home-network caveats.

## Documentation standard

Every game folder carries:

- `README.md` — what it is, how to run it, how it is built.
- A retrospective or design document where one exists, written to be read by
  someone who was not there when it was built.

| Document | Why it exists |
|---|---|
| [games/wobble-works/RETROSPECTIVE.md](games/wobble-works/RETROSPECTIVE.md) | Full design-and-build retrospective for **both** Wobble Works builds: intent vs. shipped artifact, defect log, the 2D recovery history, open risks. Written for external review. |
| [games/wobble-works/docs/design-v1-2d.md](games/wobble-works/docs/design-v1-2d.md) | The original 2D campaign design and its research table — now implemented in `games/wobble-works/2d/`. |
| [games/wobble-works/2d/wireframe.html](games/wobble-works/2d/wireframe.html) | Historical wireframes and level schematics. |
| [games/firefly-relay/wireframe.html](games/firefly-relay/wireframe.html) | Firefly Relay wireframes, research table, roadmap. |

## Working agreements

See [CLAUDE.md](CLAUDE.md): trunk-based on `master`, production testing for
学字坊, and each prototype stays self-contained.
