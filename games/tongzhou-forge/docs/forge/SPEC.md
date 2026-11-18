# Positional Forge: exact formats and rules

Everything a coder needs to build the forge without guessing. The rules and the reasons behind them
are in `DESIGN.md`. Numbers marked (tune) are starting values, and they live in exactly one place:
`FORGE` in `sim.js`.

## 1. Files touched, by phase

| File | Change | Phase |
|---|---|---|
| `content/glyphs.json` | `recipes` become `[op, first, second, result]` | 2 |
| `content/forms.json` (new) | variant forms by slot | 2 (data), 3 (shown) |
| `tools/recipes.mjs` (new) | checks recipes against the MMAH IDS and lists minimal pairs | 2 |
| `tools/pack.mjs` | packs `forms`, runs the recipe check, refuses to pack on a mismatch | 2 |
| `levels.js` | op-aware `RECIPES`, `fuse(op, a, b)`, `forms`, `mirrors()` | 2 |
| `sim.js` | `FORGE`, `relate()`, stones on stones, op-aware `stepFusion`, `launch()` modes, body forging | 2, 4 |
| `server.js` | playtest log (JSONL), `strict` passed through; no new client messages | 3 |
| `app.js`, `style.css`, `index.html` | stack drawing, arm hold, labels, forge burst, variant forms, 杳 dimming | 3, 4 |
| `tools/judge/solve.mjs`, `lint.mjs`, `index.mjs` | op-aware closure, placement actions, body action, `order-trap`, `--sloppy` | 2 (keeps passing), 5 |
| `forge-test.mjs` (new) | forge rules on the real sim, plus wire tests on port 3462 | 2+ |
| `sim-test.mjs`, `judge-test.mjs`, `tasks/checks/t03.mjs`, `tools/gen-stages.mjs` | updated for the op-aware `fuse` | 2 |
| `docs/STAGES.md` | `strict` field, the new recipe format, the forge moves table | 5 |

## 2. Recipe data

`content/glyphs.json`:

```json
"recipes": [
  ["⿰", "木", "木", "林"],
  ["⿱", "木", "林", "森"],
  ["⿰", "日", "月", "明"],
  ["⿰", "人", "木", "休"],
  ["⿱", "火", "火", "炎"],
  ["⿱", "林", "火", "焚"],
  ["⿰", "水", "木", "沐"],
  ["⿰", "水", "林", "淋"],
  ["⿰", "人", "人", "从"],
  ["⿱", "人", "从", "众"],
  ["⿰", "人", "火", "伙"],
  ["⿱", "日", "日", "昌"],
  ["⿰", "月", "月", "朋"],
  ["⿰", "女", "子", "好"]
]
```

These are the existing 14 recipes with their real structure: 焚 is 林 **on** 火, 森 is 木 on 林,
众 is 人 on 从, and 昌 is 日 on 日.

- `op`: `⿰` (first is left), `⿱` (first is on top), `⿴` (first is the closed frame),
  `⿵` (first is the frame open at the bottom), `⿱⿰` (pyramid: `[op, top, base, result]`,
  where base is a two-character string such as `"口口"`).
- Every character is a key in `glyphs`. Recipes use **base** characters (水, not 氵).
- `[op, a, b, r]` is checked by `tools/recipes.mjs` against MMAH `dictionary.txt` `decomposition`:
  - Variants are normalised before comparing: 忄→心, 氵→水, 亻→人.
  - Explicit aliases: 曰→日 (for 昌). Every alias is listed in the tool with a comment.
  - Nested IDS such as `⿱木⿰木木` match a recipe whose second piece is itself a recipe result
    (`⿰木木` = 林), or a pyramid recipe.
  - A mismatch prints the dictionary's IDS and exits 1. `tools/pack.mjs` will not write `content.js`
    while the tool fails.
- `tools/recipes.mjs --pairs <chars>` prints every two-piece character MMAH can build from
  `<chars>` in each op, grouped by piece set, and marks minimal pairs. It is a design aid that
  produces `CONTENT.md` §2.

`content/forms.json`:

```json
{ "水": { "⿰1": "氵" }, "心": { "⿰1": "忄" }, "人": { "⿰1": "亻" } }
```

The key is `op + slot` (slot 1 = first). Display only.

## 3. `levels.js` API (shared by server and browser)

```js
OPS                // ['⿰', '⿱', '⿴', '⿵', '⿱⿰']
RECIPE_LIST        // the recipes as [op, first, second, result]; iterate this, not RECIPES' keys
RECIPES            // { [op + a + b]: result }   e.g. RECIPES['⿱日木'] === '杲'
fuse(op, a, b)     // result character or null. Order matters.
mirrors(a, b)      // every [op, first, second, result] for this pair of characters, in any op and order
form(ch, op, slot) // the variant glyph to draw, or ch
```

The old two-argument `fuse(a, b)` is removed, not kept as an alias, so every caller is found and
fixed. `fuse` throws on an unknown op, so a stale two-argument call fails loudly.

**F2.1 bridge (temporary).** Until `relate()` exists (F2.6), `sim.js` fuses two touching stones with
`bridgeRecipe(a, b)` = `mirrors(a, b)[0]`: any op, any order, exactly as before. The judge's join
action does the same until F2.8. The `fuse` event already carries `op`. Search for `F2.1 bridge` to
find every place to remove.

## 4. `FORGE` constants (`sim.js`)

```js
const FORGE = {
  // classifier (K1-K3, K8)
  besideD: 0.4, besideR: [0.4, 1.3], besideY: 0.45, ideal: 0.62,   // (tune)
  bodyD: 0.55, bodyStill: Infinity,                                  // (tune)
  // forgiveness (K4-K7)
  snap: 0.15, rescue: 'off', dudCd: 0, wrongLife: Infinity,         // (tune)
  // client (K9, K10): sent to the board once per stage
  assist: 'label+snap', forms: true,
  // bodies
  holdLow: 0.55,          // arm hold while a friend stands on your head
  // enclosure (phase 7)
  inR: 0.3,
  profiles: {
    relaxed:  { besideD: 0.55, besideR: [0.35, 1.5], besideY: 0.6, bodyD: 0.7, snap: 0.2, rescue: 'unique', wrongLife: 12 },
    standard: {},
    strict:   { besideD: 0.25, besideR: [0.5, 1.1], besideY: 0.25, bodyD: 0.35, bodyStill: 0.5, snap: 0, dudCd: 1.5, assist: 'none', forms: false },
  },
};
```

`loadStage` sets `this.fz = forgeKnobs(L.strict || 'standard')`: `FORGE` merged with the profile,
frozen, without `profiles`, plus `fz.profile` (the name). An unknown name falls back to `standard`
in the sim; the judge rejects it (`bad-value` at `strict`). `sim.js` exports `FORGE`, `PROFILE`
and `forgeKnobs`.
Every rule reads `this.fz`, never `FORGE` directly. K9 and K10 (client) read `snap.fz`
(§6).

## 5. Sim functions

| Function | Signature | Notes |
|---|---|---|
| `relate(a, b, mode, fz)` | `(stone, stone, 'ground'\|'body', knobs) → {op, first, second, err} \| null` | Pure, module level (exported). Uses R, D, Y and `support` (body: the holders' `support` and, when `bodyStill` is finite, their speed). `err` = ‖(r err, q/maxD, y/besideY)‖/√3, where r err is 0 at `ideal` and 1 at a `besideR` edge; ⿱ `err` is the horizontal offset. `DESIGN.md` §3 |
| `bestRelation(k, others, mode, fz)` | `→ {op, first, second, err, partner} \| null` | Pure. ⿱ first, then smaller `err`, then lower partner id |
| `ground(x, z, r, maxY, self, heads, stones)` | `stones` = true adds a stones pass (stone bodies and the aim prediction only) | Round footprints (`hypot < r + OR`); any loose stone except one resting on `self`. Sets `b.support` to the stone below; a stack rides a deck through the support chain |
| `settle(k)` | runs when a loose stone becomes grounded | Snap (K4) and then a forge or dud attempt |
| `stepFusion()` | op-aware; keeps the "two stones still where they grew" rule | Uses `relate()`, then `fuse()`, then rescue |
| `tryForge(a, b, rel, by)` | `→ result stone \| null` | The single path for ground and body forges. Emits `forge` or `dud` |
| `formation(p)` | `→ {partner, rel} \| null` | Both holding; `relate(…, 'body')`; above uses holder support |
| `launch(p)` | new modes `forge` and `stack`; the `join` mode now means beside | Priority: dunk > forge > join/stack > pass > toss/place |
| `forgeHeld(p)` | on GRAB in `forge` mode | Result into `p`'s hands; dud keeps both |
| `ground(..., heads)` | a holder may now be stood on | Their stone uses `holdLow` while their head is occupied |
| `stepWrong(dt)` | K7: counts down unwanted results and splits them back | Only when `wrongLife` is finite |

Determinism rules: no `Math.random`. Ties are broken by stone id. Snap moves are computed from
`dt`. A replay with forge disabled is out of scope (forging *is* the game now), but a replay of a
recorded input log must produce bit-identical snapshots (the existing determinism check).

## 6. Snapshot and events

Snapshot additions:

- Stone tuple gains index 8 `rel`: `[op, slot, partnerId]` when the stone is settled or held in a
  relation, else `0`. The client uses it for relation ticks and variant forms.
- Stone state letter `h` stays. Index 9 `low`: `1` when the stone is in an arm hold.
- `fz`: `{ assist, forms }` once per stage in the `stage` message (not every snapshot).
- Aim mode strings gain `'stack'` and `'forge'`. The client labels are `ON TOP`, `FORGE`, and
  `BESIDE` for the old `join`.

Events:

| Event | Fields | When |
|---|---|---|
| `forge` | `op, a, b, ch, x, y, z, s, by, held, rescued` | A forge succeeded (`held` = the result went to a hand) |
| `dud` | existing fields + `op, why` | `why`: `dud` (no recipe), `mirror` (another arrangement would be a recipe; **log only**, never shown in game, P9) |
| `try` | `op, a, b, why, err, by, mode` | Every attempt, including `norel` near misses within 1.5× the cones. **Log only**, never sent to clients |
| `split` | `s, ch, a, b` | K7 split-back or a future split verb |

`try` and the `why` of `dud` go only to the playtest log (`server.js` writes
`logs/playtest-<date>.jsonl` when started with `--log`). Clients never see `mirror`.

## 7. Wire

There are no new client messages. Body forging uses the existing `{type:'act', a:'grab'}`. The
server passes `forge` events through like `fuse` today. The `fuse` event name is kept as an alias
for one phase so the board's effects keep working during Phase 2.

## 8. Judge

- `lint.mjs`: closure over `[op, a, b]` (an arrangement of what is on the isle can make the wanted
  character). `want-unmakeable` names the op ("put 日 on top of 木").
  - New `order-trap` (warning, not failure): the wanted character's arrangement has a mirror that is
    another real character on this isle. This is a design flag, and good stages do this on purpose.
  - New `strict` field validation.
- `solve.mjs`: the action "joins h to k" becomes **"sets h beside k (left/right)"** and **"sets h on
  top of k"**. Each walks the bot to the approach side the rule needs (`DESIGN.md` §4.3). New
  two-bot action **"body forge"**: bot A holds a, bot B holds b, they take the formation, and A
  presses GRAB (a second variant has B press, so both initiators are proven).
- `judge.mjs --sloppy N`: replays each winning route N times (default 20) with seeded noise of
  ±0.15 on every placement target and walk goal, and reports the **hand margin** (the share of
  replays that still win). It is advisory, printed under the route, and does not fail a stage.
  This is how the judge measures fiddliness, since its bots otherwise have perfect hands.

## 9. Tests

`forge-test.mjs` (real sim, no mocks). Wire checks use port 3462 (smoke test 3460, conjure test 3461).

| Group | Checks |
|---|---|
| Classifier | beside on screen axes; depth-only offset is `null`; besideR edges; support beats beside; err ties broken by id |
| Order | 日 left of 月 = 明; 月 left of 日 = dud, nothing consumed |
| Stacking | a stone rests on a stone; 日 on 木 = 杲; 木 on 日 = 杳; lifting the bottom drops the top; 林 on 火 = 焚 |
| Placement | approach from screen-left: BESIDE on the left; approach from the front: ON TOP; the aim label matches the landing |
| Forgiveness | snap lands on the ideal spot; `rescue:'unique'` forges 明 from 月日 and leaves 杲/杳 alone; `dudCd`; `wrongLife` splits back |
| Profiles | `strict` field picks the profile; unknown profile is a lint error |
| Body | beside formation forges; above formation forges; **bottom initiator** and **top initiator** each receive the result; invalid FORGE keeps both; pass to an empty-handed friend still works next to a formation; standing on a holder moves their stone to the arm hold |
| Determinism | the same input log gives the same snapshots |
| Wire | a forge over a real WebSocket server produces a `forge` event on the board |
