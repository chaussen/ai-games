# Task 04 — the forge on the board (ROADMAP card F3.2)

**Goal.** The TV board shows the positional forge: placement labels, stones that sit on stones,
a mark between two stones that are placed together, a burst when two stones become one, variant
forms (水 drawn as 氵 on the left), and dusk (the isle goes dark when 杳 is made).

**You may change:** `app.js` and `style.css`. **Change nothing else** (the server, the sim and the
content already send everything you need).

**Rules you must keep** (from `AGENTS.md`):
- Labels name the **placement**, never the result. Never show which character a placement would
  make, and never colour a mark green or red: a placement mark is the same neutral colour whether
  the stones will make something or not (charter rule P9: show after, never before).
- English first. A Chinese character always comes with pinyin and English (the stone tags already do).

## What the server sends you (already working)

| Where | What |
|---|---|
| snapshot `s.k[i]` | `[id, ch, state, x, y, z, holderId, groundY, rel, low]`. **New:** `rel` is `0`, or `[op, slot, partnerId]` when the stone rests in a placement with another stone: `op` is `"⿰"` (side by side) or `"⿱"` (on top), `slot` is `1` for the left / top stone and `2` for the right / bottom one. `low` is always `0` for now. Stones that rest on stones already have the right `y`. |
| snapshot `s.dk` | Seconds of dusk left. `0` means daylight. |
| snapshot `s.fz`, and `joined.fz` | `{ profile, assist, forms }`. Arrives in the `joined` message and again on the snapshot that starts a stage or changes the profile. Keep the latest one. `forms: false` means: never draw variant forms. |
| snapshot `s.aim[id][3]` | Aim mode. **New:** `"stack"` (puts the stone on top). `"join"` now means side by side. |
| event `forge` | `{ op, a, b, ch, x, y, z, s, by, held, rescued }`: stones `a` and `b` became `ch` at x, y, z (`s` is the new stone's id). The old `fuse` event still comes too, with the same fields; leave your `fuse` handling as it is. |
| event `dusk` | `{ on }` |
| `s.g` | Gem flags. The first `L.gems.length` are the normal gems; the rest are **glow-gems** from the stage's `L.glow` list (same order). |

## What to build

1. **Board `?strict=`.** In `Conn.prototype.open`, the board's join message also sends the page's
   `strict` URL parameter when there is one:
   `{ type: 'join', board: true, strict: new URLSearchParams(location.search).get('strict') || undefined }`.
2. **Aim labels.** Make one table and use it for the phone's GRAB label (in `frame()`, where it
   says `am[3] === 'join' ? 'JOIN'`):
   ```js
   const AIM_LABEL = { join: 'BESIDE', stack: 'ON TOP', forge: 'FORGE', pass: 'PASS', dunk: 'OFFER', toss: 'THROW', place: 'SET DOWN' };
   ```
   On the board's aim marker, `stack` uses the same colour as `join`.
3. **Variant forms.** A function `glyphFor(ch, rel)`: when `fz.forms` is not `false` and `rel` is an
   array, return `LV.form(ch, rel[0], rel[1])`; otherwise return `ch`. Example:
   `glyphFor('水', ['⿰', 1, 7])` is `'氵'`, `glyphFor('水', ['⿰', 2, 7])` is `'水'`. Draw each stone
   with `glyphFor(ch, rel)` from its snapshot tuple, and swap its texture (`brushTex`) when that
   glyph changes. The stone's tag keeps the pinyin and meaning of the real character.
4. **Placement marks.** For every stone whose `rel` has `slot === 1`, draw one small neutral mark
   between it and its partner (`rel[2]`): a short upright bar between two stones side by side, a
   short flat bar between a top stone and the one under it. Remove marks that are no longer in the
   snapshot. Count the marks visible right now (for `state().ticks`).
5. **Forge burst.** On a `forge` event, draw the two pieces `a` and `b` sliding together into the
   new stone over about 0.3 s (side by side for `⿰`, one above the other for `⿱`), then a burst
   (you can reuse `burst()` or `glyphBurst()`). When `rescued` is `true`, start the two pieces in
   the other order so the slide into place is visible. Count bursts (for `state().bursts`).
6. **Dusk.** While `s.dk > 0`: dim the scene (lights to about a third, darker sky or fog) and show
   the glow-gems; in daylight hide them. Build glow-gems like the normal gems in `buildStage()`
   (a different, brighter colour), right after them, from `L.glow`. The gem counter (`$('gems')`)
   has one slot per gem **and** glow-gem, and `s.g` fills them in that order.
7. **The `dusk` element.** Add `dusk` to the `EL` colour table (a deep violet, for example
   `{ a: '#5b4a8a', b: '#2a1f4a', glow: '#b9a6ff' }`), so 杳 is drawn in its own colour.
8. **Inspection API** (the check reads it; keep it small and honest):
   ```js
   window.WForgeUI = {
     AIM_LABEL,
     glyphFor,
     state: () => ({
       profile,      // fz.profile, the latest one received ("relaxed", "standard" or "strict")
       dusk,         // true while the board is drawing dusk
       glowShown,    // how many glow-gems are visible right now
       gemSlots,     // how many slots the gem counter has
       ticks,        // how many placement marks are visible right now
       bursts        // how many forge bursts have played since the page loaded
     })
   };
   ```

## Done when

`node tasks/checks/t04.mjs` ends with `--- TASK 04 DONE ---`. It boots the real server on port
3474, opens the board with `?strict=relaxed` in headless chromium, plays the dawn isle with a bot,
reads `WForgeUI`, fails on any console error, and saves two screenshots in `screenshots/forge/`.
Commit those screenshots with your change. It needs Python Playwright and `/usr/bin/chromium`
(the same as `tools/capture.py`).
