# WOBBLE WORKS 3D — Retrospective

| | |
|---|---|
| Subject | **Wobble Works 3D** (搭把手) — a chaotic free-roam co-op / anti-co-op physics arena for a home WLAN |
| Where it lives | `games/wobble-works/` |
| Document date | 2026-11-14 |
| Build status | playable prototype; 18 of 18 automated assertions passing; 10 evidence screenshots |
| Written for | external reviewers, playtesters, and whoever evaluates the design or the code |
| Companions | [README.md](README.md) (how to run), [design-v1-2d.md](docs/design-v1-2d.md) (superseded plan), [screenshots/](screenshots/) (evidence), [wireframe.html](wireframe.html) (historical wireframes) |

This document is a retrospective, not a pitch. It records what was intended,
what was actually built, why the two diverged, what broke on the way, and what
is still not good enough. It is written so that someone who was never in the
room can judge the work.

---

## 0. How to read this document

Every substantive claim carries an evidence label:

| Label | Meaning |
|---|---|
| **[M]** | **Measured.** A number produced by a test, harness or instrumented run. Reproducible. |
| **[O]** | **Observed.** Seen in a running build, a screenshot, or a live session — but not quantified. |
| **[A]** | **Asserted.** Designed, reasoned or intended. Not verified. |
| **[U]** | **Unverified.** Believed to be true, never tested. Treat as a research question. |

Two conventions worth stating up front:

1. **"Expected" means the design intent at the time the feature was specified** —
   including intent that was later dropped. It is not retro-fitted to match what
   shipped.
2. **Where the build contradicts the design, the build wins** and the
   contradiction is recorded in §3 and §8 rather than smoothed over.

A concrete example of why that matters: until this document was written, the
folder's README described a 2D Matter.js campaign with four chapters and route
medals. None of that exists. The shipped game is a 3D Cannon.js arena with an
individual leaderboard — two of those words ("2D", "medals") were wrong, and the
leaderboard was a **deliberate reversal** of the original design (§2.4). That is
now §3 of this document, and called out at the top of the README.

---

## 1. Origin

### 1.1 The brief

Verbatim, the original instruction was:

> "i need creative idea for family co-op games that run on home WLAN or LAN. it can
> be playable on PC or mobile devices together. easy to pick up but fun and
> addictive. you can make a prototype or even just wireframe to support your idea
> based on research"

Four requirements, one implicit fifth:

| # | Requirement | What it rules out |
|---|---|---|
| 1 | **Family** co-op | competitive-only design; anything requiring fast reactions or reading |
| 2 | **Home WLAN / LAN** | cloud matchmaking, accounts, internet dependency |
| 3 | **PC *or* mobile, together** | anything that needs a controller, a native app, or identical hardware |
| 4 | **Easy to pick up, fun, addictive** | tutorials, deep tech trees, long load screens |
| 5 (implicit) | **Research-backed** | vibes-only design |

The room this has to work in is a living room: one TV or laptop, four to eight
people of mixed ages and mixed device quality, on domestic Wi-Fi, with no IT
department present. That room constrains the design harder than any game
reference does.

### 1.2 The constraints that actually shaped the build

| Constraint | Consequence in the build |
|---|---|
| No installs, no store | The whole client is HTML + three vendored JS files served over plain HTTP. [O] |
| Mixed devices, phones dominate | Portrait phone layout is the primary controller; the board is a second, richer view. [O] |
| Domestic Wi-Fi is not a game network | One authoritative simulation on the host; clients are dumb. Snapshots are 20 Hz and heavily smoothed. [A] |
| A phone screen dimming is normal | Screen-visibility became a **gameplay state**: an AFK wobbler becomes a napping statue with a 💤 tag, and a reconnect wakes it instantly. [M] |
| Nobody will read instructions | Four to six verbs, discoverable on touch. Everything else is world affordance. [O] |
| The host's firewall will block port 3000 | The server self-checks `firewall-cmd` at boot and prints the exact command to fix it. [M] |
| Families have different skill levels | Carrying slows you down but never disables you; failing costs a respawn, never progress. [A] |

### 1.3 The research pass

The design was assembled from a small number of load-bearing findings rather
than a broad survey. The full citation table survives in
[docs/design-v1-2d.md](docs/design-v1-2d.md) §2; the ones that actually changed
decisions were:

| Finding | Source | What it changed |
|---|---|---|
| Human: Fall Flat began as a controls prototype; playtesting with the creator's son showed he ignored the puzzles and played with the physics | Wikipedia, *Human: Fall Flat* | **Physics is the content.** Ship a small consistent rule set and author terrain, not puzzles. |
| "Countless" solutions; the only goal is the exit; co-op is one shared experience | GamingBolt interview | **No marked route.** Do not signal the intended solution. |
| Independent two-arm control was the original prototype goal | Fanatical / TheGamer interviews | Two grab inputs instead of one interact button (later simplified, §8.5). |
| BOTW "chemistry engine": few consistent rules applied everywhere → many solutions | GDC 2017 *Change and Constant* | Grab/push/lift feel identical on the Core, crates, and other players. |
| Low floor, high ceiling, **wide walls** | Resnick, *Designing for Wide Walls* | Never add a verb; widen what the verbs can do. |
| Authoritative server + dumb clients works in a LAN; interpolate, never extrapolate rigid bodies | Gambetta I & III, Gaffer *Snapshot Interpolation* | One 60 Hz simulation on the host; 20 Hz snapshots; no prediction, no rollback. |
| Slapstick makes repeated unfair failure fun | IGN review; *Die-r Consequences* (IEEE CoG 2021) | Under-a-second respawn, no lives, no score loss. **That this "keeps groups playing" is a hypothesis, not a finding.** |

**Research corrections that were applied rather than repeated:**

- The Zelda *Change and Constant* talk is **GDC 2017**; GDC 2024's Zelda talk is
  *Tunes of the Kingdom*. An earlier draft conflated them.
- No GDC talk by Tomas Sakalauskas could be located; the claim was dropped.
- "Guided emergence" had no citable source and is not used as a term.
- No source confirmed Jackbox or AirConsole work **fully offline** — the design
  does not claim they do.
- "Level Design in a Day" as a kishōtenketsu source could not be verified.

These corrections matter for external review because the most seductive failure
mode of a research-backed design document is a citation that nobody checked.

### 1.4 Concept selection

Three concepts were generated from the brief:

| Concept | Shape | Why it was kept or dropped |
|---|---|---|
| **Firefly Relay** (萤火接力) | one button, one spark relayed between phones, hidden difficulty | **Kept and built first** — the minimum viable answer to "easy to pick up". Later judged *"a low-challenge-level game"* by the user and left as the low end of the range. |
| **Wobble Works** (搭把手) | one heavy shared object moved by four verb-physics | **Kept as the higher-challenge sibling.** Difficulty lives in terrain and other players, not in timing. |
| **Crystal Cavern Rush** | 3D crystal collection with proximity multipliers | Built earlier as a separate exploration; kept as prior art, not developed further. |

Wobble Works won the main slot because it is the only one of the three where the
**other players are the level**: the same rule set produces cooperation on one
run and sabotage on the next, without any authored branching.

---

## 2. Design intent

### 2.1 The five pillars

| Pillar | Statement | Still true in the build? |
|---|---|---|
| P1 Zero friction | A guest is playing within three seconds of opening a URL. | **Yes** — QR → name → play. [O] |
| P2 Physical comedy | Failure is funny, and the physics is the joke. | **Yes, partly** — the capsule bodies topple, get launched, and steal from each other; the art is too crude to be charming. [O] |
| P3 One shared object | Nobody owns a piece of the puzzle. | **Yes** — exactly one Core exists at all times. [M] |
| P4 No marked answer | The level never tells you the right route. | **Yes** — no arrows, no ghost, no tutorial. All five beacons are shown as dim rings; only the active one is lit. [O] |
| P5 No game over | Falling costs a respawn, never progress. | **Yes** — `y < −5` teleports to the plaza; the Core respawns. Nothing is deducted. [M] |

### 2.2 Version 1 — the 2D campaign (designed, mostly not built)

The first full design was a Matter.js, top-down campaign:

| Chapter | Space | Structure | Planned valid routes |
|---|---|---|---|
| CH.1 THE DOOR | one flat room, plate, latching gate, beacon | SCRIPTED | 1 intended, several accidental |
| CH.2 THE SEE-SAW | high deck, non-latching plate, see-saw, rope, planks | SEMI-SCRIPTED | 3–4 |
| CH.3 THE GAP | chasm, water, rope, wind, see-saw, two planks, barrel | SEMI-OPEN | 4+ |
| CH.4 BELL ISLAND | one connected island, summit bell, shared tool budget | OPEN | effectively open |
| FREE PLAY | no goal, no clock, unlimited parts | SANDBOX | — |

Binding it together: a **weight-transfer model** (one wobbler leans on the Core
→ ~16 px/s; three → ~56 px/s; four bots → ~80 px/s), **route medals** derived
from which mechanics were used (HUMAN CHAIN, CATAPULT CREW, BRIDGE BUILDERS,
THE ACROBATS, CHAOS GREMLINS), a persistent **Family Scrapbook**, two
independent grab hands with spring constraints, and **no leaderboard at all** —
the research on intergenerational play said shared goals beat individual
scoring.

**What actually survives from v1:** the four-beat *kishōtenketsu* intent, the
"no marked answer" principle, the see-saw, the crates, the bounce pads, the
chasm, and the no-lives respawn. **What does not survive:** the 2D renderer,
the chapter campaign, the plates and gates, the ropes, the wind zone, the water,
the tool dispenser budget, the route medals, the scrapbook, and the ban on
leaderboards.

### 2.3 The 3D pivot

The user then asked for a different game, in their own words:

> "prefer 3d. you may choose to use Canvas for everything, or three.js. this gives
> higher level of free play."

> "it is very free style. the players can basically wander around without doing the
> task. this is like a small open world with some level of physics. keep or enhance
> this point"

> "interaction between players. the players can bump or even push/pull each other"

Three requirements, each of which moved the design measurably:

| Requirement | Design response |
|---|---|
| 3D | Server-side **Cannon.js 0.6.2**, client-side **Three.js r128**. The 2D Matter.js world was retired to `levels.js` / `vendor/matter.min.js` (still present, unused). |
| Free roam, wander without doing the task | A 96 × 96 m arena with five separated zones and no forced order. The goal is a beacon you can ignore. |
| Players can bump and push each other | Player bodies are dynamic (mass 16, no fixed rotation lock in X/Z) and genuinely collide; a charging player can knock the Core out of a carrier's hands. |

### 2.4 The chaos amendment

Then came the request that inverted the original social design:

> "co-op enhancement: instead of collaboration, the players can also do nothing, or
> compete with each other. whoever finally achieves the goal gets highlighted with
> some reward/congratulations. this makes it more chaotic and fun because some
> players enjoy hampering others"

This is a **reversal of v1's most research-backed decision**. v1 had no
leaderboard on purpose. The build now has:

- individual scores (**+100** goal, **+50** assist, **+25** tackle) [M]
- a traveling crown on the current leader [O]
- an MVP pill and a leaderboard on the board view [O]
- a celebration banner and confetti on every score [O]
- a deliberate **tackle** mechanic that lets a third party strip the Core off
  a carrier [M]

The reasoning was that in a family room, the *interesting* failure is social, not
physical: someone will absolutely shove their sibling off the tower, and the game
should acknowledge that instead of pretending it did not happen. The cost is
recorded honestly in §8.6: **sabotage currently pays nothing unless the saboteur
personally ends up holding the Core.**

### 2.5 The vertical-goal amendment

> "goal design: the goal can be anywhere in the 3d world, so there must be some way
> to let players to lift the object... e.g. a few players relay to pass the ball to
> a location mid-air."

This turned the Core from a pushable object into a **throwable** one, and made
height the main design axis. The result is the beacon table in §4.5: heights from
2.2 m (walk it in) to 14.5 m (tower summit), with deliberately different verbs
required — walk, stack, bounce, bridge, climb-and-throw.

### 2.6 The terrain amendment

> "add more solid terrains to open more solution options: they can keep jumping to
> carry the object, or using world items to reach there, or stepping on each other
> to get there."

Three additions followed:

1. **Auto-step assist** — if a moving player is grounded and nearly stalled for
   120 ms, they get a small hop (4.2 m/s). This is what makes "step on each
   other's shoulders" and "shove a crate against a wall and climb it" actually
   work instead of being theoretically possible. [M]
2. **Crates became genuinely useful** — 18 kg, 1.6 m, movable, stackable. [O]
3. **The chasm became a real hole** — the ground is four slabs, not a plane, so
   the see-saw spans an actual pit (§7, defect 5). [O]

### 2.7 Intent timeline

| Phase | Trigger | What changed |
|---|---|---|
| 1 | Original brief | Pick a concept. Wobble Works chosen as higher-challenge sibling. |
| 2 | Research pass | v1 2D campaign designed: chapters, plates, medals, weight-transfer, no leaderboard. |
| 3 | "prefer 3d" | Renderer and physics replaced. Arena replaces campaign. |
| 4 | "keep or enhance free style" | Five separated zones, no forced order, wanderable world. |
| 5 | "players can bump or push/pull" | Player bodies collide; tackle mechanic born. |
| 6 | "whoever achieves the goal gets highlighted" | Scoring, crown, MVP, celebration; the v1 leaderboard ban is reversed. |
| 7 | "the goal can be anywhere ... relay to pass the ball mid-air" | Lift / carry / ballistic throw; beacons at five different heights. |
| 8 | "add more solid terrains" | Auto-step hop, stackable crates, real chasm hole, spiral ramp. |
| 9 | "give me screenshots ... evaluate first" | Scripted 7-player simulation; six defects found and fixed (§7). |

---

## 3. Expected vs. actual — the headline matrix

| Dimension | Expected / designed | Actually shipped | Verdict |
|---|---|---|---|
| Renderer | 2D top-down Canvas | **3D Three.js r128** with gradient sky, fog, orbit and follow cameras | Changed on request |
| Physics | Matter.js 2D | **Cannon.js 0.6.2**, server-side, 60 Hz | Changed on request |
| Structure | 4 chapters + sandbox, gated progression | **5 rotating beacons in one open arena** | Collapsed into arena |
| Verbs | left, right, jump, two grab hands | move, jump, grab-drag, lift, throw, 4 quick calls | Simplified; throw added |
| Cooperation model | weight-transfer forces, nobody solos | **anyone can carry alone**, but slowly, and anyone can steal | Reversed |
| Player conflict | not designed for | **tackle** strips the Core, +25 | Added on request |
| Scoring | none; route medals only | **individual 100/50/25, crown, MVP** | Reversed |
| Failure cost | poof + respawn < 1 s | respawn at plaza, Core respawns at y=18 | As designed |
| Route signalling | none | none — dim rings for all five beacons | As designed |
| Join flow | URL / QR, name + emoji | QR → name → play, **3 s** | As designed |
| AFK | not considered | napping statue + 💤, instant wake on reconnect | Added after a real bug report |
| Max players | "the more the better" | 16 hard cap, **7 exercised** | Unproven above 7 |
| Art | "warm cardboard workshop" | grey-box primitives with a warm palette and nameplates | **Fell short** |
| Hosting | zero install, no internet | zero-dependency Node server, vendored libs | As designed |
| Documentation | README + wireframe | README (now accurate), retrospective, superseded design doc | This document |

The honest summary: **the mechanics went roughly as intended and the production
values did not.** The single largest gap between expectation and artifact is not a
bug — it is that a game about charming little people looks like debugging
geometry.

---

## 4. The game that exists

### 4.1 The loop in one sentence

Spawn on the plaza, see a lit beacon somewhere in a 96 × 96 m arena, get the
Core there — by walking, stacking crates, bouncing, crossing a see-saw, or
climbing a tower and throwing it — while everyone else does the same, or gets in
your way; whoever holds the Core when it touches the beacon gets the crown and
the celebration, then the next beacon lights up and it starts again.

### 4.2 Verbs and their real numbers

All of these are server-authoritative — the client only sends six flags.

| Verb | Implementation | Numbers |
|---|---|---|
| Move | Velocity steering toward the input vector, `x` and `z` in [−1, 1] | Free speed **8.5 m/s**, carrying **6.2 m/s**, steering lerp **0.35** per tick, frictionless contact so speed is not eaten |
| Jump | Impulse on Y, only when grounded | **11.2 m/s**, grounded test `y < 1.3` or `abs(vy) < 0.25` |
| Auto-step | If pressed against a ledge while grounded and nearly stalled, hop | fires after **120 ms** of stall, **4.2 m/s** — this is what makes shoulder-standing and crate-climbing work |
| Grab / drag | Within 2.5 m of the Core, pulls it toward a point 1.3 m in front of the player | additive **×4.0** toward the hand point |
| Lift / carry | Within **2.5 m**, instantly becomes the carrier | Core is positioned at **+2.3 m** above the player and inherits player velocity |
| Throw | Released with fixed human throw or a ballistic bot throw | human: **16.5 m/s** horizontal, **9.8 m/s** vertical |
| Tackle | Charge into the carrier while pressing a direction | within **1.6 m**, closing speed **> 5.0 m/s**, attacker must be faster than the victim, **900 ms** cooldown, **+25** |
| Quick call | Cosmetic bubble above the sender | ≤ 10 characters, appears on every screen |

The tackle rule is worth spelling out because its naive version was a real bug
(§7, defect 3). The conditions are, in order: the other player must be carrying;
**I** must not be carrying; **I** must be actively steering; my closing speed
toward them must exceed 5 m/s; my speed must exceed theirs; and I must not have
tackled in the last 900 ms. The "my speed must exceed theirs" test is the one
that stops a bystander from being credited for the collision that the *carrier*
caused.

### 4.3 The Core

| Property | Value |
|---|---|
| Shape | Sphere, radius **0.85 m** |
| Mass | **12 kg** (vs. 16 kg player) |
| Damping | angular **0.3** |
| Spawn | (0, 3, 8) above the plaza |
| Respawn after a goal | y = **18**, straight down, after a **2200 ms** celebration |
| Respawn on falling | y < −5 → back to (0, 18, 0) |
| Ownership | exactly one carrier at a time, or none |

It is deliberately not heavy enough to pin a player and not light enough to
trivialise throwing. A carrier is visibly slower, which is the entire reason a
tackle is tempting.

### 4.4 Scoring

| Event | Points | Side effects |
|---|---|---|
| Core enters the active beacon | **+100** to the owner | crown transfers, banner + confetti, goal rotates |
| Someone else last touched it | **+50** to that player | assist is named in the celebration |
| Successful tackle | **+25** to the attacker | victim loses the Core; Core pops up and sideways |
| Leader | — | crown, MVP pill, top of the board leaderboard |

Scores are per-session only. Nothing is persisted; there is no database, no
account, no file except an optional legacy save from the 2D era (unused).

### 4.5 The five beacons

| # | Beacon | Position (x, z) | Height | Radius | Asked-in route | Mechanics it forces |
|---|---|---|---|---|---|---|
| 1 | SUMMIT BELL | 26, −26 | **14.5 m** | 3.4 | climb the 7-step spiral, throw from the platform | stacking heights, carrying upstairs, ledge throwing |
| 2 | SKY HOOP | −25, −25 | **11.0 m** | 3.6 | trampoline launch and a mid-air throw | timing, bounce pads, aerial carrying |
| 3 | FORTRESS CHALICE | −24, 24 | **9.2 m** | 3.4 | crate staircase up the battlements | movable props, building, cooperative stacking |
| 4 | CHASM BEACON | 25, 25 | **7.5 m** | 3.4 | cross the see-saw plank over the pit | leverage, balance, the risk of the pit |
| 5 | MEADOW POST | 0, 36 | **2.2 m** | 3.6 | walk it in | the freebie — and therefore the ambush spot |

Rotation is deterministic: index + 1 modulo 5 on every score. The board operator
can also advance it manually (`N` key or `nextGoal`), which exists because a
stuck round in a living room needs a human override. **[A] This is a design
smell**: the game is meant to be self-running, and the fact that a manual
next-goal control was needed at all is evidence that error recovery is manual.

### 4.6 World inventory

| Category | Count | Detail |
|---|---|---|
| Static colliders | **32** | 4 ground slabs, 1 abyss floor, 4 perimeter hedges, 1 plaza stage, tower + 7 spiral steps, 4 canyon pillars, 3 fortress tiers + 1 ramp, 2 chasm flanks, 3 meadow posts |
| Movable bodies | **6** crates | 1.6 m cubes, 18 kg, angular damping 0.5 |
| Hinged bodies | **1** see-saw | 9 × 3 × 0.4 m, 35 kg, hinge on Z |
| Trigger volumes | **4** bounce pads | impulses 26 / 22 / 22 / 25 m/s; fires when the body is on the pad with `vy <= 1.0` |
| Spawn points | **16** | ring around the plaza, radius 0–6 m |
| Goal volumes | **5** | spheres of radius 3.4–3.6 |
| Arena extent | **96 × 96 m** | hedges at ±48, respawn line at y = −5 |
| Player colours | **16** | fixed palette, assigned by join order |

### 4.7 Zone tour

The arena is four quadrants plus a northern meadow, all reachable from the
central plaza at any time. There is no gate, no key and no lock.

**Central Plaza.** A low stone disc 7.5 m across at y = 0.25. Its 0.25 m rim is
the first thing that teaches the auto-step hop. The Core spawns above it, so
every round begins with everyone in the same place.

**ZONE 1 — Spiral Tower (north-east).** A 14 m stone column with seven
cantilevered wooden steps winding around it. Each step is offset by roughly 90°
of a 5.2 m radius and rises 2 m. Climbing a 2 m rise with an 11.2 m/s jump is
feasible but not comfortable — which is the point: the carrier has to be
escorted, or the Core has to be thrown up the spiral step by step. The summit is
a 6 m wooden platform with the bell hanging over it.

**ZONE 2 — Bounce Canyon (north-west).** Four 6 m stone pillars and four bounce
pads. The pads fire the *player* straight up at 22–26 m/s; SKY HOOP floats at
11 m in the middle. This is the most kinetic zone and the one that reads best in
motion — a wobbler crossing it spends most of its time airborne.

**ZONE 3 — Fortress (south-west).** Three concentric stone tiers (15 m → 11 m →
6 m footprint) forming a stepped pyramid, 4 m + 2 m + 3 m tall, with a ramp on
the east face. Six crates are scattered around it — the intended route is a crate
staircase, the actual route is usually four people shoving each other up the
ramp.

**ZONE 4 — See-Saw Chasm (south-east).** The ground has a genuine 10 × 10 m hole
between two platform blocks. A 9 m hinged plank spans it at y = 3.2. Below is an
abyss floor at y = −9 — below the respawn line, so falling is a respawn, not a
soft landing. CHASM BEACON sits above the far side.

**ZONE 5 — Meadow (north).** Three wooden posts and a crossbeam framing MEADOW
POST at y = 2.2. It is the only beacon a single player can score without help,
which makes it the designated fight.

### 4.8 Session shape

| t | What happens |
|---|---|
| 0 s | Board opens on the TV. QR code appears. |
| 3 s | First player scans, types a name, is standing on the plaza. Toasts announce joins. |
| 5–20 s | Everyone wanders. Someone finds the Core. Somebody else finds the tower. |
| 20–60 s | First carry attempt. First theft. First fall into the chasm. |
| ~60 s | First score — usually MEADOW POST. Banner, confetti, crown. Next beacon lights. |
| 2–10 min | Repeated rounds. The room learns that throwing exists. Chaos peaks. |
| open-ended | Nothing ends. There is no timer, no win state, no session summary. |

**There is no ceremony at the end because there is no end.** That was
deliberate (open world over campaign) and it is the single biggest open question
about the design — see §8.6.

### 4.9 The anti-cooperation layer

Three systems exist purely so that a player can be a problem:

1. **Tackle** — described in §4.2. Costs the victim the Core, pays the attacker
   25.
2. **Body shoving** — players are dynamic bodies; walking into someone moves
   them. On the tower spiral and the see-saw this is enough to end a run.
3. **Standing in the way** — the plaza and the fortress ramp are narrow enough
   that two determined bodies can deny a route without any mechanic at all.

What does **not** exist: a way to block a throw, a way to knock someone off a
ledge on purpose (the physics does it, but there is no shove verb), and any
reward for causing a fall. This gap is §8.6.

---

## 5. Technical architecture

### 5.1 Process map

```
 ┌──────────────────────────── host laptop ────────────────────────────┐
 │  node server.js                                                    │
 │    ├─ static file server (index.html, app.js, levels3d.js, vendor/) │
 │    ├─ /config.js  →  real LAN IPs + gameMode:3d                     │
 │    ├─ /ws         →  hand-rolled RFC 6455 WebSocket                 │
 │    ├─ Cannon.js world  ·  authoritative  ·  60 Hz fixed tick        │
 │    └─ 20 Hz snapshot broadcast                                      │
 └──────────────▲──────────────────────────────▲──────────────────────┘
                │ 6 input flags                │ 6 input flags
      ┌─────────┴────────┐            ┌────────┴─────────┐
      │ phone (portrait) │            │ board (?board=1) │
      │ Three.js view    │            │ Three.js view    │
      │ joystick + 4 btns│            │ scoreboard + HUD │
      └──────────────────┘            └──────────────────┘
```

The board is not privileged: it runs the same renderer and receives the same
snapshots. A board-only client is a spectator; a keyboard-equipped laptop can be
both.

### 5.2 The server

| Property | Value |
|---|---|
| Files | [server.js](server.js) — **848 lines** |
| Dependencies | **none** (Node core modules only) |
| HTTP | `http.createServer`, static whitelist by extension |
| WebSocket | hand-rolled: `Sec-WebSocket-Accept = base64(sha1(key + GUID))`, GUID `258EAFA5-E914-47DA-95CA-C5AB0DC85B11` |
| Tick | **60 Hz** (`1000/60 ms`) |
| Snapshots | **20 Hz** |
| Player cap | **16** (declared, not enforced — §8.5) |
| Persistence | none |
| Ports | 3000 default, `PORT` override |
| Diagnostics at boot | LAN IP ranking, firewall verdict, board URL, QR payload |

The WebSocket layer is about 120 lines: handshake, frame parse (opcode, mask,
extended length), frame write, close. It exists because the project's standing
constraint is "zero install", and a hand-rolled implementation was cheaper than a
dependency. The risk is accepted and recorded in §8.5.

### 5.3 Physics

| Parameter | Value | Why |
|---|---|---|
| Gravity | **(0, −22, 0) m/s²** | ~2.2 g. Arcade-snappy jumps; real gravity makes a 14 m tower tedious. |
| Solver iterations | 10 | Stable stacking of 6 crates without a frame spike. |
| Default contact | friction 0.3, restitution 0.2 | for world bodies |
| Player ↔ world contact | **friction 0.02, restitution 0** | **Critical.** With normal friction the steering lerp is eaten and players move at 0.24 m/s (§7, defect 1). |
| Player body | compound: sphere r 0.6 at +0.6, sphere r 0.55 at +1.35, mass 16, `fixedRotation`, angular damping 0.99 | A capsule that cannot spin out of control. |
| Cylinder colliders | inscribed box, half-extent `radius × 0.96` | Cannon 0.6.2 convex cylinders **never collide with spheres** (§7, defect 2). |
| Crate | box 1.6 m, mass 18, angular damping 0.5 | Big enough to stand on, light enough to shove. |
| See-saw | box 9 × 3 × 0.4, mass 35, `HingeConstraint` on Z | A real lever, not a scripted animation. |

### 5.4 Protocol

**Client → server**

| Type | Payload | Notes |
|---|---|---|
| `join` | `{name, board, playerId?}` | `playerId` reattaches an existing wobbler instead of creating a new one |
| `input` | `{x, z, jump, grabL, grabR, lift, throw}` | sent at input rate; each flag is a boolean, `x`/`z` are −1..1 |
| `visibility` | `{hidden}` | mobile screen dim/sleep → AFK statue |
| `call` | `{text}` | cosmetic bubble, ≤ 10 chars |
| `addBot` | — | board only, in practice |
| `dropBall` | — | operator rescue |
| `nextGoal` | — | operator override |

**Server → client**

| Type | Payload | Rate |
|---|---|---|
| `joined` | `{id, name, color, board, activeGoal}` | once per join |
| `state` | full snapshot (§5.5) | 20 Hz |
| `fx` | `{event}` — `goalScored`, `tackle`, `throw`, `lift`, `jump`, `bounce`, `ballDrop`, `goalChanged`, `call` | on occurrence |
| `toast` | `{text}` — joins | on occurrence |

**There is no ping/pong and no RTT measurement in the current build.** The player
object carries an unused `rtt` field left over from the 2D design, and nothing
sets it. Latency is simply assumed to be 1–3 ms on a home LAN. **[U]** — this has
not been measured on a real phone.

### 5.5 Snapshot schema

```json
{
  "type": "state",
  "t": 1763000000000,
  "players": [
    { "id":"p-abc12", "name":"Mia", "color":"#ff4757",
      "x":4.21, "y":1.02, "z":-2.34, "rot":1.57,
      "carrying":true, "crown":false, "afk":false,
      "score":100, "goals":1, "tackles":0,
      "bubble":"😱", "bot":false }
  ],
  "ball": { "x":4.21, "y":3.32, "z":-2.34, "carrierId":"p-abc12" },
  "goal": { "id":"skyhoop", "name":"SKY HOOP",
            "x":-25, "y":11, "z":-25, "r":3.6, "color":16776960 },
  "crates": [ { "id":"c1","x":-14,"y":1,"z":19,
                "qx":0,"qy":0,"qz":0,"qw":1 } ],
  "seesaws": [ { "id":"ss1","x":25,"y":3.2,"z":25,
                 "qx":0.13,"qy":0,"qz":0,"qw":0.99 } ],
  "crownHolder": "p-abc12"
}
```

Numbers are rounded to 2 decimals before serialisation — this cuts the payload
roughly in half and the client is interpolating anyway. Positions are sent
absolutely (no delta encoding); at 20 Hz with ≤ 16 players and 7 dynamic bodies
the message is small enough that compression was not worth the complexity. **[A]**

Note what the snapshot does *not* contain: the beacons the player is not currently
chasing (the client gets only the active goal and hard-codes the rest from
`levels3d.js`), any static geometry, or any timing information beyond a
timestamp.

### 5.6 The client

| Property | Value |
|---|---|
| File | [app.js](app.js) — **891 lines** |
| Renderer | Three.js **r128**, WebGL, single canvas |
| Scene | gradient sky via canvas texture, `FogExp2(0x7c8db0, 0.0075)`, hemisphere + directional light |
| Materials | `MeshLambertMaterial` per zone colour; dark `abyss` material for the pit floor |
| Bodies drawn | players as capsules, Core as an emissive sphere with a halo, crates as boxes, see-saw as a box, statics as boxes/cylinders |
| Cameras | free orbit (radius 78, height 56) for the board; per-player follow camera for phones |
| Smoothing | position lerp **0.35** per frame toward the last snapshot |
| Nameplates | canvas-texture sprites, distance-scaled, **staggered vertically** when players overlap |
| Goal markers | a dim torus + spark for **every** beacon; the active one is replaced by the lit beacon |
| Celebration | confetti particle burst + banner + crown transfer |
| Phone extras | joystick, jump, 2 grab, lift, throw, 4 call buttons, a compact scoreboard |
| Debug hook | `window.__camPose = {pos, look}` freezes the camera at a pose — this is how the screenshots were taken |

The nameplate stagger is worth noting as a design detail learned from the
screenshots: with six players in one frame, naive nameplates stack into an
unreadable black slab. Each frame, plates within 3.2 m horizontally and 3.5 m
vertically are pushed apart by 0.52 m and scaled by
`clamp(10 / max(7, dist), 0.55, 1.5)`.

### 5.7 AFK and screen dimming

This started as a user bug report:

> "very fast and easy to join, but if mobile is dimmed, the player disappeared.
> maybe show something to tell the player it is offline"

The fix treats dormancy as a first-class state rather than a disconnect:

| Trigger | Server behaviour |
|---|---|
| `visibilitychange` with `hidden = true` | `afk = true`; carrying is released; the statue pose is sent in every snapshot |
| `visibilitychange` with `hidden = false` | `afk = false` on the next input — instant wake |
| socket close | `afk = true`, avatar kept for **90 s**, then removed |
| rejoin with the same `playerId` | reattach to the existing body, `afk = false` |

Every other client renders an AFK wobbler as a napping statue with a 💤 tag and
a greyed-out leaderboard row. The player is visibly *still in the room*, which is
what the report actually asked for. [M]

### 5.8 Discovery, QR and the LAN IP problem

- The server enumerates interfaces, filters virtual adapters (Docker, libvirt,
  VPN, Tailscale), and **ranks home-LAN addresses first** — 192.168/16 and
  10/8 ahead of everything else.
- `/config.js` injects the chosen IP into the page, so the QR code never encodes
  `localhost` when the board is opened on the host itself.
- `LAN_IP` overrides a wrong guess; `?host=…` on the board URL does the same per
  session.
- Plain `http://192.168.x.x` is **not a secure context**, so `navigator.clipboard`
  may be unavailable — the copy button has a manual-selection fallback.

### 5.9 Firewall self-check

On startup the server shells out to `firewall-cmd --query-port=<port>/tcp` (if
present) and prints a blunt warning with the exact three commands when the port
is blocked. This exists because the first real-world test failed exactly that
way:

> "the server is running on my archlinux machine. when i try to get in from my
> android mobile, chrome says the site can't be reached"

The diagnosis was firewalld's default public zone. No code was wrong; the network
was. The self-check is the scar tissue. [M]

### 5.10 Why there is no client-side prediction

The clients are deliberately dumb: they send flags and interpolate snapshots.
That is normally a bad architecture for an action game, and here it is the right
one:

- The host and the phones are on the same switch. Round trip is 1–3 ms, so
  prediction would fix a problem that does not exist on a home LAN. **[A]**
- Two of the three contracts are rigid bodies whose motion is non-linear; Gaffer's
  snapshot-interpolation write-up is explicit that extrapolation fails there, so
  the client interpolates rather than predicts.
- Deterministic lockstep was rejected: bit-level determinism across a phone's
  Wi-Fi bufferbloat spike would stall the whole room.

The accepted cost is that a *remote* play (over the internet) would feel laggy and
needs prediction, reconciliation and rollback. That is roadmap item P1, not a
bug.

### 5.11 What was deliberately not built

| Not built | Why |
|---|---|
| Accounts, persistence, profiles | The room is the identity. |
| Matchmaking | Everyone is in the same room. |
| Audio | No assets, and the LAN story is fine without it. |
| Level editor | Out of scope for a prototype. |
| Mobile haptics | Requires the Vibration API and a secure context. |
| Chat | Quick-call bubbles only; a keyboard on a controller screen is friction. |
| Anti-cheat | The host is trusted and the stakes are a sibling's honour. |

---

## 6. Verification

### 6.1 The automated contract

`smoke-test.mjs` boots the **real server** on port 3455 and drives it with one
spectator board and three WebSocket controllers — the same protocol a phone uses.

| # | Assertion | Proves |
|---|---|---|
| 1 | `/config.js` returns `gameMode:3d` | dynamic config path |
| 2 | `/` serves the 3D shell | static root |
| 3 | `/vendor/three.min.js` > 500 KB | vendored renderer, not a CDN |
| 4 | `/vendor/cannon.min.js` > 100 KB | vendored physics |
| 5 | `/levels3d.js` contains `SUMMIT BELL` | 3D world data reachable |
| 6 | board joins as spectator | board role |
| 7 | 3 controllers join with IDs | join + ID assignment |
| 8 | snapshot contains 3 players | broadcast fan-out |
| 9 | snapshot contains the Core | ball serialisation |
| 10 | snapshot contains ≥ 6 crates | dynamic body serialisation |
| 11 | active goal is `summit` | goal state |
| 12 | controller moved on X | input → physics |
| 13 | controller lifted off the ground | jump impulse + grounded test |
| 14 | lift attaches the Core | carry mechanic |
| 15 | throw launches the Core | throw mechanic |
| 16 | a bot joins and is flagged `bot` | bot spawn |
| 17 | `nextGoal` rotates the beacon | operator override |
| 18 | `visibility{hidden:true}` marks AFK, `false` wakes | dormancy state machine |

Result: **18/18 pass**, final line `ALL 3D PHYSICS & NETWORKING TESTS PASSED`.
Reproduce with `node smoke-test.mjs`. Runtime ≈ 6 s. [M]

Note what is *not* asserted: scoring a goal end-to-end, tackle attribution, the
ceiling of players, or physics stability over a long session. Those were checked
with throwaway diagnostics (§6.2), not with a permanent test. **[A] That is a
gap** — the two most behaviour-critical systems (scoring and tackles) are the
ones with no regression test.

### 6.2 Diagnostic harnesses

Three throwaway scripts were written to see inside a live simulation:

| Script | What it did | What it found |
|---|---|---|
| `diag.mjs` | board + controllers, prints message counters | a harness artefact made it report zero messages; replaced |
| `diag3.mjs` | counts snapshots received over time | confirmed 59 snapshots in ~3 s at 20 Hz — the server was fine |
| `diag4.mjs` | six puppets + one bot, logs **every** `goalScored` and `tackle` fx with positions and a periodic score dump | the tackle attribution bug (§7, defect 3): a motionless player had accumulated 14 tackles and 350 points |

`diag4.mjs` is the single most valuable artefact in this folder after the
server itself. Before it existed, the player with the most points in the room was
the person whose phone was face-down on the table.

### 6.3 The screenshot pipeline

Screenshots were captured from a live build, not mocked up:

1. `capture-screens.py` spawns `server.js` on port 3470.
2. It spawns `puppet-driver.mjs`, which connects **six scripted wobblers** over
   the real WebSocket protocol. Each puppet steers toward a target zone using the
   same `input` messages a phone sends.
3. Playwright launches headless Chromium with SwiftShader, opens the board with
   `?board=1`, and registers handlers for `pageerror` and console errors.
4. For each shot, `window.__camPose` is set to a hand-chosen position and the
   page is allowed 1.4 s to settle.
5. Phone shots open a second context at portrait viewport and drive the
   controller UI; the AFK shot dispatches a synthetic `visibilitychange`.

Zero page errors and zero console errors were recorded across the run. [M]

The six puppets and their behaviour:

| Puppet | Zone | Behaviour |
|---|---|---|
| Tower Tina | (20, −20) | walks to the tower base and stays there |
| Bounce Bo | (−25, −25) | stands on the super bounce pad, permanently airborne |
| Fortress Fred | (−17, 25) | climbs the fortress ramp |
| Sleepy Sal | (0, 32) | twitches near the meadow, then goes AFK at 20 s |
| Meadow Mia | (0, 38) | stands **inside** the meadow beacon |
| Plaza Pat | (3, 3) | idles on the plaza |

Plus one autonomous server-side bot, which is why the bot appears in shots.

### 6.4 Screenshot inventory

All ten live in [screenshots/](screenshots/).

| File | Shows | What it is evidence of |
|---|---|---|
| `01-world-overview.png` | the whole arena from the orbit camera | all five beacons exist and are marked; the four quadrants plus meadow are legible from one viewpoint |
| `02-plaza.png` | the plaza with wobblers and the Core | spawn area, nameplates, the Core's halo |
| `03-tower.png` | the 14 m spire with its spiral | a vertical route exists and is climbable in principle |
| `04-bounce-canyon.png` | pillars, pads, airborne puppets | bounce pads fire players; SKY HOOP floats overhead |
| `05-fortress.png` | the stepped fortress and crates | stackable props and a climbable ramp |
| `06-seesaw-chasm.png` | the pit, the plank, the abyss | the chasm is a real hole with a hinged bridge |
| `07-goal-action.png` | carrier + spectators at the meadow | several players, one Core, one goal, readable HUD |
| `08-goal-celebration.png` | banner, confetti, crown, MVP | the reward moment fires and reads clearly |
| `09-phone-follow-cam.png` | portrait phone UI over the board | controller layout, joystick, call bar |
| `10-phone-afk.png` | dimmed phone | the AFK statue/💤 affordance |

### 6.5 What this evidence can and cannot support

**Supported:** the world exists as described; five beacons are present and
visually distinct; six simultaneous clients can join, move and be rendered
together; a score event produces a visible celebration; the phone layout is
usable at portrait size; the chasm, pads, crates and tower are real physics
objects, not decoration.

**Not supported:** that any of it is *fun*; that a family can score the tower,
sky hoop, fortress or chasm beacons; that 10–15 players work; that the game runs
smoothly on a mid-range Android phone; that the tackle mechanic feels fair.

Only MEADOW POST was scored during the capture run, and it was scored by the bot.

---

## 7. Defect log

Every entry below was found by running the thing, not by reading it. Fixes are in
the current source.

| # | Symptom | Root cause | Fix | Verified by |
|---|---|---|---|---|
| 1 | Players moved at **0.24 m/s** — visibly crawling | Cannon contact friction between player spheres and the world ate the steering lerp every tick | dedicated low-friction contact material: player ↔ world **friction 0.02, restitution 0** | 28 m crossed in ~4 s [M] |
| 2 | Players and puppets **fell through the plaza stage** | Cannon 0.6.2's convex `Cylinder` never collides with spheres | cylinders get an **inscribed box** collider (half-extent = radius × 0.96) while the mesh stays cylindrical | puppets stand on the stage [M] |
| 3 | **350 points** and the crown went to a player who never touched anything | Tackle attribution read velocity *after* the solver; collision resolution transfers the carrier's momentum into the bystander, making the victim look like the attacker | snapshot `preV` before `world.step`; require closing speed > 5, attacker faster than victim, attacker actively steering, 900 ms cooldown | the AFK player stays at **0 pts**; remaining tackles are all real charges [M] |
| 4 | Round **stalled for 40 s** after a goal; nothing could score | the previous carrier kept `carrying = true`, so it teleported the respawned Core to its own head forever | `respawnBall` clears every `carrying` flag; plus a 9 s carry timeout and a 2.6 s stuck-throw for bots | next round starts immediately [M] |
| 5 | The "See-Saw Chasm" had **no chasm** | ground was one 100 × 100 plane | ground rebuilt as **four slabs** leaving a 10 × 10 m hole, with a dark abyss floor 9 m below | screenshot `06` [O] |
| 6 | Four of five zones looked like **empty grey slabs** | only the *active* beacon was drawn | a dim torus + spark for every beacon, hidden for the active one | screenshot `01` [O] |
| 7 | Six nameplates merged into an **unreadable black slab** | all plates at the same world Y | per-frame de-overlap: +0.52 m per nearer player, distance scaling 0.55–1.5 | screenshot `07` [O] |
| 8 | Phone **toast covered the joystick and call bar** | toast anchored at the bottom | phone toasts moved to `bottom: 232px` with a width cap | screenshot `09` [O] |
| 9 | Sky was **black** and the orbit camera was cramped | no sky or fog; camera radius too small | gradient canvas sky, `FogExp2`, orbit radius 78 / height 56 | screenshot `01` [O] |
| 10 | A puppet **never went AFK** in the capture run | the driver stored its socket in a closure, not on the state object, so the later `visibility` send silently no-oped | socket stored on the state object; heartbeat every 5 s | leaderboard shows `Sleepy Sal 💤` [M] |
| 11 | Bot **could not reach elevated beacons**; it circled with the Core | its throw was flat (16.5 m/s horizontal, no arc) | ballistic throw aimed at the beacon: horizontal `min(18, max(6, dist × 1.5))`, vertical `min(26, sqrt(2 × 22 × height) + 3)` | tower and hoop become reachable in principle [M] |
| 12 | The user reported the Core **reaching the goal without scoring** | [U] the original collision-event formulation did not fire reliably; it was replaced rather than repaired | unconditional per-tick `dist3(core, activeGoal) < goal.r` check — it cannot miss | scores now fire on contact [M] |

Two engineering lessons worth carrying forward:

- **Read physics state before the solver, not after.** Every attribution rule that
  inspects velocity must decide *what the player intended*, and the solver
  rewrites velocities to satisfy constraints. Pre-step intent, post-step position.
- **A prototype's most dangerous bug is a scoring bug.** A wrong number in a
  mass or a radius produces jank that players laugh at. A wrong number in
  attribution produces a game that silently rewards the wrong person, and nobody
  reports it because it looks like luck.

---

## 8. Honest assessment

### 8.1 What works better than expected

- **The chaos is real.** Tackles, theft, the crown moving, and a leaderboard that
  rewards being closer to the Core produce actual table-talk. The interaction
  between two players is not a scripted emote; it is two rigid bodies and a
  velocity test.
- **Climbing is genuinely free-form.** The auto-step hop plus 18 kg crates plus
  dynamic player bodies means shoulder-standing, crate stairs and shoving a crate
  into a corner all work without being authored. This is the "wide walls" idea
  actually paying off, not just being cited.
- **The AFK statue solves a real social problem.** A dimmed phone used to look
  like a disconnected player; now the room can see who is still present.
- **Operational simplicity.** One process, zero dependencies, four vendored
  files, a self-diagnosing firewall check, a QR code. The whole thing fits on a
  USB stick and runs on a ten-year-old laptop.

### 8.2 What landed as designed

Zero-install join; no marked route; no lives and no score loss; under-a-second
respawn; physics as content; the host is authoritative and the clients are thin;
beacons at five different heights requiring five different tricks.

### 8.3 What fell short

| Gap | Honest statement |
|---|---|
| **Art** | It is grey boxes, cylinders and two-sphere capsules. The reference was Human: Fall Flat, whose appeal is almost entirely charm. This build borrows the physics and none of the character. |
| **Zone identity** | The tower reads as a tower, but the fortress, canyon and meadow are the same grey stone in different arrangements. A player cannot say "let's go to the fortress"; they say "the one on the left". |
| **Beacon coverage** | Only one beacon is active at a time, so four-fifths of the arena is scenery at any moment. The world looks big and plays small. |
| **Discoverability of verbs** | Nothing tells a player that LIFT or THROW exist. The buttons are on the phone, but the *idea* of throwing the Core at a beacon is not communicated anywhere. Second and third sessions are better than the first, which is the wrong curve for a party game. |
| **Bot AI** | Single-target, cannot climb, needs a ballistic throw hack to reach high beacons. It is a load generator that occasionally scores, not an opponent. |
| **Scaling** | "The more players the better" was the brief; **7 concurrent clients is all that has been exercised**. Zones are sized for about six. No evidence exists for 10–15. |
| **Audio** | None. A room playing this is silent except for people. |
| **Replay value** | Five beacons, one Core, one verb set. There is no progression, no unlock, no variation between sessions. |

### 8.4 What was abandoned

The chapter campaign, plates and gates, ropes, wind, water, the shared tool
budget, the weight-transfer model, route medals, the Family Scrapbook, two
independent hand constraints, and measurement of round-trip latency. Each was
dropped for a reason recorded in §2; none is coming back without a new decision.

### 8.5 Known rough edges in the code

| Issue | Severity | Note |
|---|---|---|
| `MAX_PLAYERS = 16` is declared but **never enforced** | Medium | the 17th client would join and take a spawn slot modulo 16 |
| No RTT measurement; `player.rtt` is dead; the board's `📶 LAN` pill is static | Low | the server answers protocol-level pings, but the client never sends one |
| Hand-rolled WebSocket does not handle **continuation frames** or `permessage-deflate` | Low | fine for small JSON control messages; would break on large fragmented payloads |
| No input rate limiting | Low | a hostile client could flood the server; irrelevant for a family LAN |
| `levels.js`, `vendor/matter.min.js`, `wireframe.html` are **dead code** from the 2D era | Low | kept deliberately, referenced from the superseded design doc |
| `diag.mjs`, `diag3.mjs`, `diag4.mjs`, `browser-test.cjs`, `cyl-test.cjs` are dev leftovers | Low | useful as debugging artefacts, not part of the product |
| No regression test for scoring or tackles | **High** | the two mechanics with real bugs are the two with no assertions |
| No CI | Medium | tests are run by hand |
| The `Toggle Cam` button gives no feedback beyond a toast | Low | cosmetic |

### 8.6 The design tension I would raise first

You asked for a game where "some players enjoy hampering others". The build
faithfully added disruption, and then **paid for it with a scoring system that
only rewards finishing**.

That means:

- The player who is best at knocking someone off the tower gets **0 points**.
- The player who stands next to the Core gets **+50** without doing anything.
- Being annoying is thermodynamically pointless: the optimal strategy is to
  follow whoever is carrying and tackle them *last*, not to cause chaos.

So the game currently *permits* anti-cooperation and does not *reward* it. That
is a coherent design, but it is not the design described in the brief. The
cheapest honest fix is a small set of disruption payouts, e.g.:

| Proposed event | Points | Rationale |
|---|---|---|
| Forcing the carrier to drop the Core within 15 m of the active beacon | +15 | rewards last-second denial, which is the funniest possible moment |
| Causing a fall that costs the room a carried Core | +10 | acknowledges the physics comedy without rewarding griefing at the start of a round |
| Assisting a score by placing the Core (already +50) | +50 | already exists |

This is a hypothesis, not a conclusion. It should be playtested with an actual
family before it is written into the rules.

---

## 9. Threats to validity

Anyone reviewing this work should weigh these:

1. **No human playtest has been run.** Every behavioural claim comes from bots,
   puppets or the author driving the UI. Bots are a physics sanity check, not a
   fun check.
2. **Seven concurrent clients is the tested maximum**, on one machine, mostly over
   loopback. The 16-player cap is a constant, not a capacity.
3. **Only one Android device ever ran the game**, and it was used to discover the
   firewall bug rather than to test gameplay. Real-phone frame rate,
   touch latency and battery behaviour are unmeasured.
4. **The screenshots are staged.** They prove geometry, UI and rendering, not
   emergent play. Camera poses were chosen by hand.
5. **No balance data.** Speeds, impulses, masses and point values were tuned by
   feel and by watching bots.
6. **No accessibility work.** Colour-only player identification, no audio cues,
   no one-handed mode, small touch targets in the call bar.
7. **No long-session test.** Nobody has left this running for an hour with
   clients joining and leaving.
8. **Physics determinism is untested.** Nothing depends on it in the current
   architecture, but it is also not ruled out as a source of desync.

---

## 10. Roadmap

Ordered by what would change the experience most per unit of work.

**P0 — fixes that address this document's own findings**

1. Reward disruption (§8.6). Cheapest change with the largest effect on the
   stated goal.
2. **Regression tests for scoring and tackles**, driven by the `diag4` harness
   rather than hand-written assertions.
3. **Discoverability:** a one-line prompt on the first carry ("LIFT is not the
   only option — try THROW"), shown once per device.
4. **Overlap beacons:** allow two active beacons so the world stops feeling
   four-fifths empty.
5. **Enforce `MAX_PLAYERS`** and move the cap into `levels3d.js`.
6. **Scale test with 12–16 bots** and resize the zones if it breaks.

**P1 — quality**

7. An art pass: distinct materials and silhouettes per zone, a face or an eye on
   the wobblers, and a warm sky. This is the single biggest gap between the build
   and its reference.
8. Audio cues for lift / throw / score / tackle (no external assets needed —
   oscillator synthesis is enough).
9. RTT measurement and a real latency pill.
10. Client-side prediction for internet play.

**P2 — ambition**

11. A simple persisted level editor (drag boxes, save JSON — the level format is
    already pure data).
12. Automatic "blooper" replay of the last 5 s before each goal.
13. Per-player colour-blind palettes and a one-handed control scheme.

---

## 11. Metrics

| Metric | Value |
|---|---|
| Lines of code in the folder | **3,692** (including legacy 2D and throwaway diagnostics) |
| Lines in the shipped 3D build | **2,453** (server 848, client 891, level data 111, HTML 181, CSS 422) |
| Lines of documentation | **1,488** (this retrospective, README, superseded design doc, wireframe) |
| Server dependencies | **0** |
| Vendored libraries | 2 used (Three.js 603 KB, Cannon.js 132 KB) + QR generator 57 KB |
| Automated assertions | **18**, all passing |
| Screenshots | **10** |
| Beacons | 5 |
| Static colliders | 32 |
| Dynamic bodies | 7 (6 crates + 1 see-saw) + 1 Core + up to 16 players |
| Simulation rate | 60 Hz |
| Snapshot rate | 20 Hz |
| Measured free speed | 8.5 m/s |
| Tested concurrent clients | 7 |
| Player cap (unenforced) | 16 |

---

## Appendix A — File inventory

| File | Lines | Role | Status |
|---|---|---|---|
| `server.js` | 848 | HTTP + WebSocket + authoritative simulation + bot AI + scoring | **shipped** |
| `app.js` | 891 | Three.js renderer, cameras, HUD, phone UI, confetti | **shipped** |
| `levels3d.js` | 111 | beacons, spawns, statics, pads, crates, see-saw (pure data) | **shipped** |
| `index.html` | 181 | board view + controller view + firewall hint | **shipped** |
| `style.css` | 422 | board and portrait phone presentation | **shipped** |
| `smoke-test.mjs` | 136 | 18 assertions against the real server | **test** |
| `puppet-driver.mjs` | 55 | six scripted wobblers | **test** |
| `capture-screens.py` | 109 | Playwright screenshot pipeline | **test** |
| `verify-browser.py` | 44 | single-page error check | **test** |
| `diag4.mjs` | 75 | scoring / tackle diagnostic | **dev** |
| `diag3.mjs` | 44 | snapshot counter | **dev** |
| `diag.mjs` | 82 | original message harness (superseded) | **dev** |
| `browser-test.cjs` | — | early headless check | **dev** |
| `cyl-test.cjs` | — | cylinder collision reproduction | **dev** |
| `lan-doctor.sh` | — | read-only LAN diagnostics | **ops** |
| `levels.js` | 185 | 2D chapter geometry | **legacy, unused** |
| `wireframe.html` | 418 | historical wireframes and research table | **legacy** |
| `vendor/three.min.js` | — | Three.js r128, MIT | **vendored** |
| `vendor/cannon.min.js` | — | Cannon.js 0.6.2, MIT | **vendored** |
| `vendor/qrcode.js` | — | qrcode-generator 1.4.4, MIT | **vendored** |
| `vendor/matter.min.js` | — | Matter.js 0.20.0, MIT | **legacy, unused** |

---

## Appendix B — Runbook

**Host**

```sh
cd games/wobble-works
node server.js
# open http://localhost:3000/?board=1 on the TV machine
```

**Firewall (the most common reason a phone cannot reach the host)**

```sh
firewall-cmd --query-port=3000/tcp        # "no" means blocked
sudo firewall-cmd --zone=public --add-port=3000/tcp
sudo firewall-cmd --permanent --zone=public --add-port=3000/tcp
sudo firewall-cmd --reload
```

**Prove the port from another device on the same Wi-Fi**

```sh
curl -m 3 http://<host-ip>:3000/config.js
```

Timeout → firewall or AP isolation. Connection refused → wrong port or dead
server. `bash lan-doctor.sh` answers the same question with more detail.

**Tests**

```sh
node smoke-test.mjs          # 18 assertions, port 3455
node diag4.mjs               # scoring / tackle view, port 3464
python3 capture-screens.py   # 10 screenshots, port 3470
```

**Never use port 3000 for tests** — that is the family's live server.

---

## Appendix C — Glossary

| Term | Meaning here |
|---|---|
| **Wobbler** | A player character: a two-sphere capsule with a nameplate. |
| **Core** | The single shared glowing ball. The only object that scores. |
| **Beacon** | A goal volume in the air. Five exist; one is active at a time. |
| **Carrier** | The unique player currently holding the Core. |
| **Tackle** | Charging into a carrier at speed to strip the Core. |
| **Crown** | A visual mark on the current leader; transfers on every score. |
| **Statue / AFK** | A wobbler whose phone has gone dark; rendered napping with 💤. |
| **Puppet** | A non-bot scripted client used for screenshots and load checks. |
| **preV** | A velocity snapshot taken before the physics solver runs, used for intent-based attribution. |
| **Zone** | One of the five themed areas of the arena. |

---

*End of retrospective. Corrections and disagreements are welcome — the point of
writing this down is that the next person can see exactly which claims are
measured and which are still guesses.*
