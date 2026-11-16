# Wobble Works 3D · 搭把手

> Carry the Glow Core to the beacon, together.
> A fixed-camera co-op game on floating workshop islands, for one Wi-Fi and a
> room full of phones.

This folder is a full rebuild of the 3D build. The earlier free-roam arena
(orbit camera, Cannon.js, individual scoring, tackles) is gone; it is in git
history before this change. The rebuild answers two pieces of feedback:

| Feedback | What changed |
|---|---|
| Rotating the camera is too much for a casual game | The camera is **fixed and isometric and never turns**. The TV always shows the whole stage. Stick-up is always "away", for the entire game. |
| The graphics look mechanical | Each stage is a small pastel diorama: terraced stone that dissolves into haze, arched windows, stepped ramps, soft shadows, a glowing Core, jelly-bodied wobblers with faces. Five stages, five moods (dawn, mint, dusk, citrus, night). |

The game is also now **co-operative only**. There is one team, one Core, one
clock. Nobody can steal or tackle.

## Run it

```sh
cd games/wobble-works
node server.js --mode=3d          # or: WOBBLE_MODE=3d node server.js
PORT=3001 node server.js --mode=3d
```

Open `http://localhost:3000/?board=1` on the TV or laptop. Phones scan the QR
code. No install, no npm, no CDN, no internet: Three.js r128 and the QR library
are vendored in `../vendor/`.

Requirements: Node 18+ (22+ to run the tests, which use the built-in WebSocket
client).

## How to play

| | Phone | Keyboard |
|---|---|---|
| Move | drag anywhere on the left half | W A S D or arrows |
| Jump | JUMP | Space |
| Pick up / throw | the orange button (it names what it will do) | E, F, J or Enter |
| Quick call | Here! · Wait · Go! · Nice | 1 – 4 |
| Respawn yourself | ⌂ | R |
| Restart the stage | hold ↺ for a second | Backspace (board) |

A keyboard player can play on the board screen itself: press a movement key.
Board keys: **N** / **P** next / previous stage, **Backspace** restart.

The rules, all of them:

1. **Get the Glow Core to the beacon.** That clears the stage.
2. **The Core is heavy.** While you hold it you walk slower and cannot jump.
3. **The Core cannot climb a step by itself.** A thrown Core flies flat: it
   crosses a 2-wide gap and bounces off a 1-high step. Ramps and lifts take it up.
4. **A friend changes that.** Face a teammate and the throw becomes a **pass**,
   lobbed into their hands, up to one step higher and up to 5.5 away. The orange
   button and the aim marker both say PASS when that will happen.
5. **Plates work only while something stands on them:** a wobbler, a crate, or
   the Core. A plate and the pillar it moves share a colour.
6. **Stand on a friend's head** to reach a ledge that is too tall to jump.
7. **Nothing is lost.** Fall and you reappear on the last safe tile. A dropped
   or stranded Core floats back. A crate pushed off the island returns home.

Stand still and the throw button sets the Core down just ahead of you; move and
it becomes a toss. A ring on the ground always shows where it will land.

Each stage awards up to three stars: one for finishing, one for all three gems,
one for beating par.

## Stages

| # | Stage | Teaches | Alone | With friends |
|---|---|---|---|---|
| 1 | First Light · 第一束光 | carry, ramp, toss over a gap | toss, then jump after it | pass it across |
| 2 | Hold the Door · 帮我顶住 | plates, gate, bridge | park crates on the plates | hold the plate for each other, leapfrog |
| 3 | Going Up · 升降台 | lift | Core on the lift, crate on the plate, take the steps | one rides, one holds |
| 4 | Bucket Brigade · 接力传递 | passing up steps, two-plate bridge | two crates, then the long ramp route | pass the Core up the terraces |
| 5 | The Works · 大工坊 | everything | all of the above | all of the above, faster |

Every stage can be finished by one player. `sim-test.mjs` proves it by playing
each one with a scripted solo wobbler.

Stages are text maps in [levels.js](levels.js); the comment at the top of that
file is the whole format.

## Architecture

```
levels.js   stage maps + the height-grid parser        (server and browser)
sim.js      the game: movement, Core, plates, pillars  (server only, no I/O)
server.js   static files + RFC 6455 WebSocket + 60 Hz tick, 30 Hz snapshots
app.js      Three.js renderer, touch / keyboard input, HUD
```

- **Physics is custom, not an engine.** The world is a height grid plus a few
  axis-aligned boxes (pillars, crates, wobblers). A lift must carry what stands
  on it and a plate must read what rests on it identically every time; a general
  rigid-body solver made that harder, not easier. The whole simulation is about
  450 lines and steps a stage hundreds of times faster than real time in tests.
- **The server is authoritative.** Clients send a stick vector and button
  presses; the server sends compact array snapshots (about 600 bytes for 16
  players). No client prediction: on a LAN the round trip is a few milliseconds,
  and the client smooths positions between snapshots.
- **The camera is orthographic and fixed**, so world-to-screen is two dot
  products. Name tags are plain DOM, placed with that maths.
- **The board fits the whole stage.** A phone does too when it can; when a stage
  would get too small on a phone, the view glides after your wobbler. It never
  rotates.
- **Visuals are procedural.** No image or model files: terrain is one mesh with
  per-vertex colour, textures are drawn on canvases at load, sound is a few
  oscillator blips.

## Tests

```sh
cd games/wobble-works/3d
node sim-test.mjs      # every stage solved solo + the co-op rules, in under a second
node smoke-test.mjs    # real server on :3455, real WebSocket play-through, ~25 s
```

Neither uses port 3000.

Screenshots in [screenshots/](screenshots/) are taken from a running build by
`python3 tools/capture.py` (real server on :3472, headless Chromium, four
wobblers driven over the real protocol by `tools/puppets.mjs`).

## Home-network caveats

Same as the 2D build — see [../README.md](../README.md) section 6. In short: a
phone that says "site can't be reached" almost always means this computer's
firewall is blocking the port; phone and computer must be on the same subnet;
guest Wi-Fi with client isolation will not work. `bash ../lan-doctor.sh` prints
the diagnosis. The server does not query the firewall unless started with
`FIREWALL_CHECK=1`.

Plain `http://192.168.x.x` is not a secure context, so there is no wake lock:
a phone whose screen dims turns its wobbler into a napping statue (which still
weighs down a plate) and wakes it when the screen comes back. A phone that
drops off Wi-Fi keeps its wobbler for 90 seconds.

## Retrospective

**Intent.** Keep the one idea that worked in both earlier builds — a single
heavy object that a family moves together — and remove what the 3D arena got
wrong for casual players: a camera you had to steer, a big empty field, and
scoring that turned co-op into a scramble.

**What shipped.** Five hand-built stages, fixed isometric camera, two-button
controls, pass / toss / set-down throws chosen by context, plates, gates, lifts,
bridges, crates, head-standing, gems, stars, stage select, reconnect, AFK
statues, procedural visuals and sound.

**Defects found while building.**

| # | Defect | Fix |
|---|---|---|
| 1 | A pillar's top landed at 2.0000000000000004, so "is the bridge up" was false | snap to the exact end height when travel completes |
| 2 | With 16 players on a small spawn court, late joiners were shoved off the edge | spawn tiles are found by flood fill; extra wobblers share a tile, one per corner |
| 3 | A scripted player walking back to a Core that had landed near a ledge stepped into the gap | test fixed; in play the Core is within reach from the landing spot |
| 4 | Wobblers spawned with their backs to the camera | they now face it |
| 5 | The sun, drawn into the sky texture, stretched into an ellipse on wide screens | it is a sprite in the scene |

**Known gaps.**

- Not yet played by the family. Pars, jump distance and throw range are tuned
  against scripted runs, not people.
- The 2-high gate walls in stages 2 and 5 hide a tile or two behind them from
  the fixed camera. Name tags stay visible; there is no see-through outline.
- No bots. A stage is solvable alone, but a lone player gets no helper.
- Crates can be pushed into a corner they cannot be pushed out of. Restarting
  the stage is the way out (board button, Backspace, or hold ↺ on a phone).
- Stage controls are accepted from any client. Fine for a living room.
- Rendering was checked in headless Chromium (software GL) at 1600×900,
  844×390 and 390×844. It has not been profiled on a low-end phone;
  `?lite=1` turns the shadow map off.
- Five stages is about ten minutes of play.

## Licences

Three.js r128 — MIT. qrcode-generator 1.4.4 — MIT, © 2009 Kazuhiko Arase. Both
vendored unmodified in `../vendor/`.
