# Reaction engine (the hard problem, part 1)

Goal: a **general, data-driven** way for things to affect each other, so a new character is a data row, not new
code. Style: Noita/falling-sand-lite on a coarse grid. Deterministic, fixed-step, snapshot/restore bit-for-bit
(the forge-2d `sim.js` discipline). Not Inkblade's one-off effects.

## 1. World

- **Cell grid**, one material per cell, typed arrays. Starting size about 160x90 cells; chunked so that sleeping
  chunks cost nothing. Measure on John's Android early.
- **Entity layer** above the grid: objects (written things), players (bodies), creatures, projectiles.
- Grid-like on purpose (John): no pixel-free physics. Entities have positions in cell units with sub-cell
  velocity, as in forge-2d.

## 2. Materials (v0, 12)

air, dirt, stone, wood, plant (grass/leaf), water, fire, ash, steam, mud, ice, metal.
Each material has: `solid` (blocks bodies), `flow` (none / fall / liquid / rise), and `tags`.

## 3. Tags (the shared vocabulary)

Elements: `fire` `water` `wood` `earth` `metal`. States: `hot` `cold` `wet` `dry` `light` `dark` `heavy` `light-weight`
(spell `airy`). Matter: `flammable` `solid` `liquid` `living` `growing`. Forces: `wind` `push` `lift`.
Every card (GLYPH-CARDS.md) and every material carries tags. Rules match on tags, never on characters.

## 4. Rule format

A rule is data: `{ id, a, b, ctx, effect, note }`.

- `a`, `b`: tag expressions (`fire`, `water+solid`, `!wet`). `a` is the active thing (thrown object, burning
  cell); `b` is the thing it touches (cell, entity, body).
- `ctx` (optional): `adjacent`, `inside`, `on-top`, `hit` (thrown contact), `near:N`.
- `effect`: one or more of: `become(material)`, `spawn(material|entity)`, `remove(a|b)`, `spread(rate)`,
  `heat(+/-n)`, `push(v)`, `body(effect, secs)`, `grow(kind)`, `light(radius)`, `sound(id)`.
- Strength scales with the card's `params.power`, `size`, `duration` (modifiers change those; MODIFIERS.md).
- **Rules never run on a pair without a rule.** "No rule" is explicit: the pair test (§7) lists it.

## 5. Rule table v0 (about 28; Phase 1A implements the first 12, marked *)

| id | a | b | ctx | effect |
|---|---|---|---|---|
| R1* | fire | flammable | adjacent | b becomes fire; fire spreads at `power`-scaled rate; burnt cells become ash |
| R2* | water | fire | adjacent/hit | fire removed; spawn steam (rises, fades) |
| R3* | fire | wood(entity) | hit | wood object burns: becomes fire for `duration`, then ash |
| R4* | water | earth/dirt | on-top | becomes mud |
| R5* | water | plant | adjacent | plant grows (kind: grass) over time |
| R6* | wood(seed object) | mud/dirt+wet | on-top | grow(tree): a wood/plant column, height by `size` |
| R7* | fire | ice | adjacent | ice becomes water |
| R8* | cold | water | adjacent | water becomes ice |
| R9* | fire | body | hit | body singed: hops, smoke, wears off in `duration` (playful, no damage) |
| R10* | water | body | hit | body soaked: slower, drips; douses fire on the body |
| R11* | earth | air | hit | earth object lands: becomes dirt cells (builds terrain) |
| R12* | any thrown | body | hit | knockback by mass x speed (`BODY.knock`) |
| R13 | wind | fire | near | fire spreads one extra step along the wind |
| R14 | wind | body/object | near | pushed |
| R15 | metal | fire | adjacent | metal glows hot; touching it singes (R9) |
| R16 | metal | solid | hit | cut/chop: wood and plant cells removed |
| R17 | light | dark | near | dark region lit; shade removed |
| R18 | heavy | ice/floor | on-top | cracks ice; breaks thin floors |
| R19 | wood | water | on-top | wood floats; becomes bridge/raft |
| R20 | earth | water | inside | fills water, makes dam |
| R21 | fire | steam | adjacent | nothing (explicit no-op) |
| R22 | plant | fire | adjacent | flammable, same as R1 |
| R23 | thunder | any | hit | becomes fire + push; sets flammables alight |
| R24 | rain | fire | near | douses (as R2), grows plants (as R5) |
| R25 | living(creature) | fire | near | flees or is singed (utility AI, Phase 5) |
| R26 | water | metal | adjacent | cools; steam if hot |
| R27 | ice | body | hit | chilled: slow for `duration` |
| R28 | tree(grown) | body | on-top | crowned: small tree on the head (comic, wears off) |

## 6. Safeguards against runaway chaos

- **Budget caps**: max active fire cells, max objects, max cells changed per step. Over the cap, the oldest
  effect fades first.
- **Everything decays**: fire burns out to ash; steam fades; singe and soak wear off; grown trees stop at a
  height cap; objects older than `ttl` fade. No effect is permanent except placed terrain.
- **No soft-lock**: grown or built terrain never seals a player in; a visible way back to spawn is always there.
- **Per-player rate limits**: written objects capped per player (forge-2d `CONJURE.cap`).

## 7. Tests (Phase 1A pass criteria)

1. **Truth tests**: one scripted scene per rule R1-R12, asserting the exact outcome.
2. **Pair test**: for every tag pair of every card and material, a rule exists or an explicit no-op is listed.
3. **Soak test**: random writes, throws and uses for N simulated minutes with 1-4 simulated players; asserts no
   NaN, caps respected, fire count returns to baseline, no entity leak.
4. **Determinism**: two runs from the same seed are bit-identical; `restore(snapshot())` mid-run is identical
   to continuing.
5. **Phone budget**: step time p95 under 4 ms on John's Android (adb), measured not guessed.

## 6b. Design notes for the builder

- Prefer few, strong, readable reactions to many subtle ones. A child should see *why* it happened (a short
  "fire + wood" label may appear; the Almanac records it).
- Keep rules symmetric where possible (water douses fire; fire boils water).
- When a character needs a behaviour no rule gives, first ask whether a new **tag** fixes it for many characters;
  new engine code is the last resort.

## 8. As built in Phase 1A (2026-11-22)

Files: `reactions.js` (data: materials, rules, no-ops, behaviours, knobs), `sim.js` (world + effects),
`cards.json` (7 cards), `sim-test.mjs` (83 checks). Decisions made while building, so the next model need not
rediscover them:

- **Full scan, no chunk sleeping.** The grid is scanned every tick; 160x90 costs about 0.25 ms in node (p95 with
  4 wild players). Chunk sleeping is deferred to Phase 5 and only if a measurement on the phone asks for it. This
  keeps every cell timer (`aux`) a plain per-cell counter.
- **Tags:** every cell also has the implicit tag `cell`; air has the tag `air` (so rules can say "lands on air");
  objects `object`; bodies `body`+`living`; a thrown object `thrown`; a wielded one `wielded`; a placed wood seed
  `seed`. Rules tell cell from entity with these.
- **Contexts:** `adjacent` and `on-top` run in the cell scan with a per-tick `rate`; `hit` runs once on impact
  (rate ignored); `inside` runs each tick for a body standing in a cell.
- **R11 is generic.** Any thrown object lands on the air cell before the impact as the cell its throw behaviour
  names (`land`): earth -> dirt, water -> water, fire -> fire (unfed, lasts `duration`), ice -> ice, stone ->
  stone, log and blade `stay` as objects. Cells landed = 1 + `size` (spills beside and above). So "earth builds
  terrain" is data, not code.
- **R2 is symmetric on purpose:** water adjacent to fire turns the fire into steam (the water is kept).
  Consequence kept deliberately: fire melts ice (R7), the meltwater douses the fire (R2), and the remaining ice
  freezes it again (R8). A small fire beside ice does not melt a lake.
- **R27 (chilled)** was added to the first set because the ice card needed a body effect.
- **Mud is solid for collision** (so a seed can rest on it) but halves your speed and jump. Mud dries to dirt after
  about 30 s, ash fades after 10 s, steam after 1.6 s, fire after 2.2 s when it burned something (leaves ash) or
  `duration` when it was written (leaves nothing).
- **Caps (standard):** fire 400, water 2500, objects 32, 6000 cell changes per tick. Over the fire cap no new fire
  starts and existing fire drains three times faster; stress test: a 3000-cell plant field under the strict cap
  (200) never passes it and burns out.
- **Never entomb a player:** `place` refuses a cell that overlaps any body; terrain that grows into a body
  (ice over water, a landed clod) lifts the player out, or sends them home (`unstick`). `home` always works.
- **Not built yet:** 风 and R13/R14 (wind), R15-R26, creatures, the modifier algebra, the Almanac.
- **Phone budget not measured.** The 4 ms p95 target (section 7.5) is only checked in node.

## 9. As built in Phase 1C (2026-11-22)

Additions the crew server needed, all in `sim.js`, none touching the rule data:

- **`cellsV`** bumps on every `put()`. The server sends the grid only when it moves; entity snapshots go
  15 times a second regardless. A settled arena sends no grids at all.
- **`wire()` / `applyWire()`** — the network form of a snapshot: JSON-safe, cells as row strings (one
  character per cell, `0123456789ab` = the material index, 160×90 ≈ 15 KB), knobs (`profile`, `body`) ride
  along so a phone follows the room when anyone changes them. A phone applies it to a `World` it never steps.
  `snapshot()`/`restore()` stay full-fidelity for the determinism tests (typed arrays, in process).
- **`setProfile()` / `setBody()`** — the living-room rule: anyone on the Wi-Fi may set the room's knobs
  (POST /crew); every phone follows on the next snapshot.
- **`removePlayer(id)`** — a lost phone's seat expires after 30 s (GONE knob on the server); its objects
  return to air, held pointers clear.
- **Writing is out-of-band**: the server calls `sim.give(p, ch)` when the pad's chip is tapped, replies
  `wrote {ok, why}` (`no-ink`, `cooling`, `unknown`), and pushes a `give 火` event for everyone's label line.
- **The arena** (server `buildArena`): stone floor rows 0-7, dirt rows 8-10, a pond held in a stone basin
  (water on dirt makes mud and soaks away — R4 — and a single-deep pond spreads until it finds dirt; the
  basin is the fix), wood posts and a grass patch to burn and grow. Spawns sit clear of the pond.
