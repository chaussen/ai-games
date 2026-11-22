# Rules spec: R1-R6 (for the phase-1 rules agent)

Read `UPGRADE.md` and `PLAYTEST-FINDINGS.md` first. This doc is the contract: what the sim must do, in terms precise
enough to implement and to test (`TEST-SPEC.md`). Where a value is a starting guess it is a **knob** in `sim.js`
with `relaxed / standard / strict` profiles (house rule: an isle never carries its own numbers). Nothing here is built yet.
Names such as `stepWalls`, `QI`, `springs`, `returnStone`, `snapshot()`/`restore()` are in `sim.js` today.

## 0. Principles

1. **Delivery is the only trigger.** Elements act on the world only through a delivery event (§1). Position alone never does.
2. **Everything is data.** Reactions, counters, builds and bearing live in tables in `rules.js` / `content.js`; the sim reads them.
3. **Everything survives `snapshot()`/`restore()`** (crew mode: phones only restore and draw). Add new state to both.
4. **One player and a crew behave the same**; with one player none of the body rules change.
5. **Meaning is visible**: every reaction emits an event with `cause`, `target`, `result` so the page can say it in one line.

## 1. R1: deliveries (replaces the passive branch of `stepWalls`)

A **delivery** is one of:

| Mode | Trigger | Counts as arriving when |
|---|---|---|
| `throw` | a stone thrown by a player | it ends its flight (lands or hits rock) within `reach(g)` of the target's nearest cell, **or** passes through a target cell. Flight over, not "ever within reach". |
| `set` | a stone placed with set-down / drop / beside | it comes to rest within `reach(g)` of the target, placed this frame by a player (stone has `placedBy` and `placedAt === now`). Regrown spring stones and stones that merely slid or were pushed do **not** deliver. |
| `verb` | the contextual button (§1.1) | pressed while carrying an agent glyph, facing the target within `reach(g)`. The stone stays in hand through the 0.4 s wind-up; it is spent at the end of the reaction. |

Carried stones and stones lying near a wall never react. (Existing "nearby on arrival at the isle" cases, e.g. a stone
that regrows beside a wall, also never react.)

### 1.1 Contextual verbs

GRAB button label priority is unchanged except one new slot between placement verbs and OFFER: when a carried stone
is an agent for a target in `reach`, facing it, the button says its verb: **泼 pō pour** (水 沐 淋), **点 diǎn light**
(火 炎 焚 灶 赤), **照 zhào shine** (日 月 明 昌 早 杲 好 朋), **砍 kǎn chop** (金). Pinyin and meaning accompany it per house rules.
Screen budget unchanged (it replaces a label, adds no button). Throw and set still work on the same target.
Knob `VERB.on` (true; false in strict makes players choose throw or set themselves).

## 2. R2: the reaction (telegraph then consequence)

State on the world, serialised: `this.reacts = [{ id, kind, target:{id,x0,x1,y0,y1}, ch, by, t0, dur, mode }]`.
Timeline for one reaction (knob `REACT.dur`, 0.8 s; relaxed 1.0, strict 0.6):

1. `t = 0`: validated, the agent stone is committed (follows its flight or hand to the target and is *spent* at `t = dur`).
   Event `react.start { id, kind, ch, by, x, y }`. Hurtful walls (T, F) **stop hurting** from now on; they stay solid.
2. `0 < t < dur`: renderer plays the effect; the sim advances `progress = t/dur` (ink uses it to shrink the wall cell by
   cell from the top). Walls stay solid until `t = dur` (so the player sees it happen before walking through).
3. `t = dur`: the cells are cleared, `cellsV++`, event `react.done { id, kind, ch, by, result }`, the agent stone leaves
   (§3), counters fire (§3.2).

Re-delivery to a wall already reacting is ignored and the stone is **not** spent (event `react.refused { why: 'busy' }`).
Two players may deliver in the same frame: lowest player id wins; the other is refused as above. A reaction whose target
disappears early (a counter already removed it) ends with `result: 'moot'`, stone not spent.

## 3. R3: cost and counters

### 3.1 Spent agents
At `react.done` the agent stone state becomes `gone` through the existing path so `regrow` springs work as today: a
spring stone regrows after `REGROW` (3.5 s); a written (Conjure) stone is simply gone and the player's ink is **not**
refunded. On non-regrow isles a spent stone is gone for good, so the level must supply enough stones (validator in
`TEST-SPEC.md` §5: every route's stone budget must exist; a dead-end check ensures no isle becomes unwinnable by spending).

### 3.2 Counter table (`rules.js`, data not branches)
`COUNTERS = [{ when:{ agent:'fire' }, hits:'wood-structure', within:'reach', result:'burn' }, ...]`. Starting set:

| Delivery | Also affects (within the agent's reach of the delivery point) | Result |
|---|---|---|
| fire (火 炎 焚 灶 赤) | wood bridge cells, wood trunk (木 build), lying 木-family stones | bridge/trunk burns away (cells back to `_` gap or `.`), stone scorched = spent |
| water (水 沐 淋 雨) | earth mound / ramp (土 田 build) | washes away (cells cleared) |
| water | embers `L` | becomes a steam crossing for `STEAM.t` (3 s) |
| earth (土 田) delivered to `F` | flames | smother: wall removed (alternative answer to 水) |
| earth | wood sprout / trunk base | buries it (cells cleared) |
| fire then water within `CRACK.window` (6 s) on a boulder `R` | boulder | cracks: removed. Either alone only scorches/wets (visual, no change) |
| light | nothing | no counter (light is the safe element) |
| metal 金 delivered to `D` | wood structures within reach (bridge, trunk, 木 stones) | chopped: cells cleared (use 金 on a gate, not beside your bridge) |

Counters emit `react.start/done` with `kind: 'collateral'` so the page tells the player what they just did ("火 burns the 木 bridge").
A bridge or trunk that burns while a player stands on it drops them as a normal fall (existing safe-ground return); never kills.

### 3.3 Reaction table (`rules.js`, new `REACTIONS`)
Each row `{ target, agent: {el|glyphs}, verb, mode: ['throw','set','verb'], spends: true, result }`:

| Target | Agents | Verb | Result |
|---|---|---|---|
| `T` thorns | fire | light 点 | cells cleared |
| `F` flames | water; earth | pour 泼; set 土 | cells cleared |
| `S` shade | light | shine 照 | cells cleared |
| `R` boulder | fire then water; 2 players pushing | light 点 + pour 泼 | cleared |
| `D` wooden gate | metal 金 (chop); fire | chop 砍 (金) or light 点 (火) | cleared; fire also burns wood within reach (§3.2) |
| `M` iron bars | fire (melts); 金 cannot | light 点 | cleared |
| `R` boulder (alt) | wood 木 (roots split it after `ROOT.t` 5 s) | set 木 at its foot | cleared; the 木 is spent |
| `L` embers | water (steam), earth (cover) | pour 泼 | passable for `t` / permanent |
| `C` cliff foot (socket) | build glyphs (§5) | set | structure grows (R5) |

Reach: unchanged `reachOf(g)` (1.3, or 2.6 for 炎 焚 淋 明 昌 杲). Reach now decides how far a throw may land, a real skill, not a free radius.

## 4. R4: bearing vs inert stones

`content.js` glyph gains `bear: true|false` (default false), and `build` (one of `trunk`, `ramp`, `peak`, `folk`, `lift`,
`anchor`, or absent). Starting assignment (`ELEMENTS.md` §3 has the full list):

- bearing: 木 林 森 (build `trunk`), 土 田 (build `ramp`), 山 (build `peak`), 人 从 众 (build `folk`), 石 (build `anchor`)
- everything else is inert: 口 十 日 月 明 水 火 金 雨 云(云 lifts but is not a platform until set) …

Support level: `level(k) = 1` if the stone rests on static rock, else `1 + level(stone below)`. A **player may stand on
stone `k` iff `k.g.bear` or `level(k) == 1`.** Stacking itself is unchanged (forging by "on top" still works: 日 on 木 is 杲,
十 on 口 is 古), only *standing* is limited, and the forged result is a new stone at its own level.

Inert stone at level >= 2: landing on it **slides you off** toward the nearer side at `BEAR.slide` (3 u/s) for 0.25 s, with
the tag line "口 cannot hold you" (pinyin + meaning). It stays solid to the side so it still blocks and can be pushed.
Knob `BEAR.inert: 'slide' | 'solid'`. `solid` is today's behaviour, for A/B in playtest; the default is `slide`.
Knob `BEAR.stackMax: 3`: no more than three bearing stones may be stacked and stood on (people pyramids stay modest).
The old guarantee "stand on a stone to set another on top" is preserved at level 1.

Head-standing on other players (`BODY`) is unchanged.

## 5. R5: sheer cliffs and sockets

- New map cell **`C`**: sheer rock. Solid like `#`. Wall-kick **never refills** 轻功 on `C` (`wallKey` is bypassed: no source
  `w…` is registered for `C` faces); the player slides down it. It draws as smooth wash with a **socket mark** at its foot.
- **Socket** = any standing cell (rock top) whose side or top is a `C` cell, within `SOCKET.reach` (1.5 cells) of the
  cliff face foot. Sockets are implicit (derived from the map), but a level may add `sockets: [{ x, y, face }]` to override.
- **Cliff** = a vertical run of `C` of height >= `CLIFF.min` (3). The level must declare `answers: [...]` per cliff (§ data below).
  Cliffs of height 1-3 may stay `#`; a plain jump plus one step clears them as today.
- **Building.** A bearing stone with a `build` kind, **set down or thrown to land** at a socket, becomes a structure:

| build | Glyphs (height h in cells) | Shape (cells), foot at socket | Burns? | Washes? |
|---|---|---|---|---|
| `trunk` | 木 h3, 林 h5, 森 h7 | a 1-wide trunk against the face with a 1-cell branch ledge every 1 cell of height, alternating sides, topped by a ledge at the cliff top | yes | no |
| `ramp` | 土 h2, 田 h3 | a staircase of earth, one cell run per cell rise, on the open side | no | yes |
| `peak` | 山 h5 | a stepped triangle, base 2h+1 cells | no | no |
| `folk` | 人 1, 从 2, 众 3 | no cells: bearing stone stacks (§4), drawn as people linked arm to arm; limit `BEAR.stackMax` | n/a | n/a |
| `anchor` | 石 | no cells: an immovable bearing stone (cannot be pushed or carried off by current `W`) | no | no |

  Cells used by builds use new chars `w` (wood) and `e` (earth) (solid; `w` burns, `e` washes). Each shape must be
  **climbable by a player using only plain jumps (no 轻功 leaps)**: ledges at most 1 cell apart in height and at most 2
  cells apart horizontally (jump apex 1.65, reach ~2.6 horizontally; test `TEST-SPEC.md` §3.4). If the shape does not fit
  (blocked by rock or another stone) the build fails with `react.refused { why: 'no room' }` and the stone is **not** spent.
  Sockets stack: a taller glyph builds higher, so the level chooses the glyph by cliff height. Structures persist
  (serialised in `built`, §9) until a counter removes them.
- **Hints (R5/R6).** Within `HINT.radius` (3 cells) of a socket, if the player carries a glyph whose `build` fits, the socket mark
  glows (renderer) and the isle's message line may say "木 grows here" once per isle. `HINT.mode`: `'glow'` (standard, relaxed
  also adds an arrow), `'off'` (strict). A cliff with no `answers` is a level error (validator).

## 6. R6: clouds removed; lifts and updrafts

- `clouds` in isle data are **deprecated**: `stepGems` stops reading them, ink stops drawing them; validators fail an
  isle that still lists `clouds` (the level agent removes them; phase 1 patches the existing 6 isles with a stand-in, see `HANDOFF.md`).
- **云 cloud stone (`build: 'lift'`).** Set it down (it floats 0.3 above its spot) and stand on it (a lift is a platform while it lasts, even though the glyph is not `bear`):
  it rises at `LIFT.speed` (2.2 u/s) for `LIFT.t` (4 s) up to `LIFT.max` (6 cells) or until blocked overhead, then
  drifts down and disperses (spent). A player may step off at any height. Can be carried, thrown, forged (云 on 水 is 雨).
- **风 wind stone.** Thrown or set, it creates an **updraft column** at its resting cell for `GUST.t` (5 s): a player standing in it gets
  upward acceleration (`GUST.up`, 22 u/s²) until they leave it; thrown stones in it float. Column height `GUST.h` (4 cells).
  An existing vent `V` in the map is a permanent column, active only when a 风 stone rests on or beside it (so vents are
  a designed lift that still needs the right character).
- Gems stay as 轻功 refills; the isle must teach each new mechanic on a calm stretch in view first (`LEVEL-BRIEF.md` §4 rule L5).

## 7. New cell semantics (summary; art in `ELEMENTS.md`)

| Cell | Solid | Hurts | Notes |
|---|---|---|---|
| `C` | yes | no | sheer, no wall refill, shows socket |
| `R` | yes | no | boulder; needs fire then water, or pushed by 2 players |
| `D` | yes | no | gate; burns or pushed open |
| `L` | no | yes (throws back) | embers; steam crossing after water |
| `W` | no | pushes | current: stones drift, players drift; 石 / 土 dam |
| `V` | no | no | vent; lifts with a 风 stone present |
| `M` | yes | no | iron bars; melt with fire |
| `w` `e` | yes | no | built wood / earth |

`HURTS` in `sim.js` gains `L`. Cells must be added to `findHedges`-style run detection if they remove as walls (R D).

## 8. Profiles (starting values)

| Knob | relaxed | standard | strict |
|---|---|---|---|
| `REACT.dur` | 1.0 | 0.8 | 0.6 |
| `VERB.on` | true | true | false |
| `BEAR.inert` | `slide` | `slide` | `slide` |
| `BEAR.stackMax` | 4 | 3 | 2 |
| `HINT.mode`, `HINT.radius` | `glow+arrow`, 4 | `glow`, 3 | `off` |
| `LIFT.t` | 5 | 4 | 3 |
| `CRACK.window` | 9 | 6 | 4 |
| `STEAM.t` | 4 | 3 | 2 |

## 9. Contracts to freeze early (so phases 1 and 2 can overlap)

**Events** (page listens in `app.js`; all carry `{ id, by, x, y }` plus):
`react.start { kind, ch, target }`, `react.done { kind, ch, result }`, `react.refused { why }`, `build { ch, build, h, x, y }`,
`build.fail { why }`, `slide { ch }`, `lift { id }`, `gust { ch, x, y }`, `collateral { what, result }`.
**Snapshot additions**: `reacts[]`, `built[]` (`{id,build,ch,cells:[[x,y,c]...],t}`), per-stone `spent`, `lift[]`, `gust[]`. Grid rows already travel
only when `cellsV` moves; new cell chars ride in them. `restore()` rebuilds from the same fields.
**Level data additions** (`isles.js`): `biome: 'wood'|'fire'|'water'|'earth'|'light'`, `cliffs` (derived) with `answers`
declared as `answers: { '<x>': ['木','土'] }` keyed by the cliff's foot column, `beats: [...]` (names only, for the validator),
`stones` as before, `clouds` removed.
**`content.js`** (generated by `tools/pack.mjs` from `content/*.json` of the 3D game; check how `pack.mjs` is wired in this
folder before editing, `content.js` header says "do not edit by hand") gains `bear`, `build`, `h`.

## 10. Edge cases the implementation must handle

- A thrown stone that hits a player first (knock modes) still delivers only at the end of its flight.
- A stone delivered to a wall while a *second* wall is also in reach: only the nearest target reacts (tie: lower x).
- Offering (献) at the pavilion is not a delivery to walls; the goal glyph that "melts shade" (好, 沐, 灶: isles 11, 14, 17)
  no longer does so passively: those isles are re-laid in phase 3; in phase 1 the stand-in is that the offered stone is a
  `verb` delivery from the pavilion side (patched minimal, listed in `HANDOFF.md`).
- Regrow springs: a spring that regrows a stone inside a *burning/reacting* zone does not trigger it (no placed-by).
- Conjure writing a stone beside a wall: written stones appear in hand, no delivery until the player acts.
- Dusk (杳) dimming and glow gems are untouched.
- Restoring a snapshot mid-reaction resumes at `progress`; the server steps, phones interpolate.
- The pad's *goal* rule is unchanged (never write the isle's goal).
