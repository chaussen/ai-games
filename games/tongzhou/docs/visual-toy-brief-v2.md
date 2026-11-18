# 同舟 — Visual Toy V0.2: Handoff Brief

Fingerprint: TZ-V0-brief-v2.0 (2026-11-12). Supersedes `visual-toy-brief-v1.md`. Governed by `charter-v1.md` (v1.8). For a Design or Code agent outside Chat. Self-contained apart from two data files named in §2.

## 0. Why a second build

V0.1 was played by John on 2026-11-12. Verdict: REWORK (TZ-D043). It soft-locked at the second arrival, so it never answered its question.

| Finding | Fix in this brief |
|---|---|
| Players must pick a structure, then drag. Overwhelming. | Spatial forge, no structure menu (B6–B8) |
| Used tiles stayed; no new tiles; stuck at 饿 | Tiles are consumed and refilled with a deal guarantee (B9–B10); nothing can stall (B13–B14) |
| 木 + 目 did not bond although 相 is a real character | Every real character bonds (B8), using `wild-seed.json` |
| Visuals weak; placeholder emoji and low-resolution caps | Caps removed; rendering technology is open behind a contract (§5); a style frame comes first (§8) |

## 1. Purpose

One question: **do the river, the queue of arrivals, troubles piling onto the boat, and spending a character on them read clearly and feel tense and satisfying?** Plus one new sub-question: **can a fresh player work out forging in under a minute without being told?**

Still a toy. One device, one player or two sharing. No network, no split hands, no inking, no tones.

## 2. Inputs and expected output

| Item | Requirement |
|---|---|
| Data in | `wild-seed.json` (107 real characters the 27 seed tiles can make, with pinyin, gloss, structure, parts) and the matrix, tags and encounters in `content-seed-v1.md` §2–§5. |
| Deliverable | A small folder: `index.html`, `engine.js` (all game rules, no drawing), `controls.js` (DOM: tray, forge, hold), one or more `renderer-*.js` (river view, §5), the data files. Runs from any one-line static server with no internet. |
| Technology | Controls: plain DOM. River view: the builder's choice (plain canvas, three.js, Pixi, anything bundled locally, no CDN). State the choice and why in one line. |
| Look | Follow the style frame from §8 if John supplies one. Otherwise placeholder, but full resolution: no texture or pixel-ratio caps. |
| Fingerprint | `TZ-V0.2-n` shown in a corner; bump on every change. |

## 3. Screen

```
+--------------------------------------------------------------+
| RIVER VIEW (renderer)                                        |
|   far: fog        mid: beast                                  |
|   BOAT   aboard: rocks, gate (each with its chip marks)       |
+--------------------------------------------------------------+
| 气 ●●●●●●○○○○   speed ▶▶▶      distance 412 m     time 3:10    |
+--------------------------------------------------------------+
| HOLD:  [晴 sunny]  [炮 cannon]  [   ]     tap one, then a trouble |
+--------------------------------------------------------------+
| FORGE: one square.                 TRAY: 日 月 木 口 火 包 青 水 |
|   [   first tile   ]               (8 tiles, refills)         |
+--------------------------------------------------------------+
```

## 4. Behaviour

| # | Behaviour |
|---|---|
| B1 | The river moves toward the camera. Speed = 8 m/s × 气/10 × (1 + 0.1 × troubles cleared in a row). At 气 0 the boat stops and nothing new arrives. |
| B2 | Encounters spawn at the horizon in a seeded order, about every 360 m, visible from 480 m. |
| B3 | An encounter that reaches the boat unanswered becomes a trouble aboard and stays, visibly, until solved. |
| B4 | Each trouble aboard drains 气 (1 per 6 s) and applies its own effect from `content-seed-v1.md` §4. 气 never goes below 0. |
| B5 | With no troubles aboard, 气 recovers 1 per 4 s up to 10. |
| B6 | **Spatial forge, no structure menu.** Drag or tap a tile into the square: it sits in the middle. Drag a second tile to where it belongs relative to the first: left, right, above, below, or onto it (inside). Tap alternative: after the first tile, five ghost positions appear around and on it; tap one. |
| B7 | **Forgiving by default.** If the chosen arrangement is a real character, it bonds. If not, but another arrangement of the same two tiles is, the tiles slide into that arrangement and bond. If both arrangements exist (口 above 木 = 呆, 木 above 口 = 杏), the player's placement decides. A debug toggle switches forgiveness off. |
| B8 | **Every real character bonds.** Look-up is `wild-seed.json`. On bonding show the glyph large, its pinyin, and its meaning (picture for seed characters, the dictionary gloss otherwise), then move it to the hold. Variant forms display by position (水 on the left shows 氵). If nothing matches, the tiles slide back to the tray: no message, no cost. |
| B9 | **Tiles are consumed.** Both tiles leave the tray on bonding and two new ones are dealt at once. |
| B10 | **Deal guarantee.** After every deal, the tray must allow at least two different characters. If not, redraw the newest tile until it does. |
| B11 | Spending: tap a held character, then a trouble aboard or the nearest incoming thing. A large glyph drops in, then the outcome plays with one line of text from the matrix. A character with no authored tags uses its radical's default from `content-seed-v1.md` §3. |
| B12 | Outcomes: solve removes the trouble; partial halves its drain; backfire doubles its drain for 10 s. |
| B13 | **Every spend chips.** Any result other than solve also puts one chip on the trouble. Three chips clear it. |
| B14 | **The river provides.** While the boat is stopped, each newly dealt tile is chosen so that, with a tile already in the tray, it makes a character that solves or partly solves something aboard, if such a tile exists. No sign of this is shown. |
| B15 | On first load only, a ghost hand drags two tiles together once (日 then 月 to its right) and the result is real. It shows how to forge, never which tiles to pick later. |
| B16 | A run lasts 5 minutes. End screen: distance, troubles cleared, every outcome seen. No lose state. |
| B17 | Debug toggles: forgiveness on/off (B7); "a spent character hits every trouble aboard" on/off; river-provides on/off (B14). |
| B18 | Record and replay: the engine can save the sequence of view objects (§5) for a run as JSON and play it back with no input. This lets different renderers be compared on the same run. |

## 5. Renderer contract (locked; the technology behind it is free)

The river view draws what it is given and knows no game rules.

```
createRenderer(containerElement, assets) -> {
  render(view, nowMs),      // called every frame
  resize(width, height),
  pick(x, y) -> id | null,  // which incoming thing or trouble is under this point
  dispose()
}

view = {
  boat:     { qi, speed, streak, distance, stopped },
  incoming: [ { id, kind, label, picture, dist } ],          // dist in metres, 0..480
  aboard:   [ { id, kind, label, picture, chips, drainMul } ],
  hold:     [ { char, pinyin, meaning, picture } | null ],
  fx:       [ { type: 'bond'|'cast'|'outcome'|'board'|'clear', char?, targetId?, result?, text?, at } ],
  timeLeft
}
```

| Rule | Detail |
|---|---|
| No rules in the renderer | It never changes `view`, never decides an outcome, never reads the data files except its own art assets. |
| No input except `pick` | All other input goes through `controls.js`. Troubles and incoming things are also listed in the DOM, so the game is fully playable with the river view removed. |
| Swap test | Deleting the renderer file and loading another must need no change to `engine.js` or `controls.js`. |

## 6. Tunables (one object at the top of `engine.js`)

Base speed 8 m/s; lookahead 480 m; spawn spacing 360 m; drain 1 气 per 6 s per trouble; recovery 1 per 4 s; speed bonus +10% per consecutive clear; hold 3 places; tray 8 tiles; chips to clear 3.

## 7. Self-test before handing back

| Check | Pass when |
|---|---|
| No internet | Loads from a local static server with no outside requests and no console errors |
| Cannot stall | An automated loop of 500 random legal actions never reaches a state where the tray allows no character |
| 相 | 木 then 目 to its right bonds as 相 with pinyin and gloss |
| Forgiveness | 目 then 木 to its right also bonds as 相; with forgiveness off it does not |
| 呆 and 杏 | Both can be made, by placement |
| Consumed | After any bond the two tiles are gone and two new ones arrived |
| Bogged and freed | Let 4 troubles board: boat stops, 气 shows 0, not below; clear one: boat moves |
| Chips | Three non-solving spends on one trouble clear it |
| Swap test | §5 swap test passes with a second, trivial renderer (text only is enough) |
| No verdict words | The words wrong, incorrect, fail, game over appear nowhere |

## 8. Style frame (separate small task, may go to a different agent, do first if possible)

| Item | Requirement |
|---|---|
| Deliverable | One static image or HTML mock of the river view at one moment: two things incoming, two troubles aboard, a hold of three, the 气 bar. Two alternative looks if cheap (for example ink-wash and one other). |
| Purpose | John picks a look before any more rendering code is written. The look then decides the rendering technology, not the reverse. |
| Not required | Animation, code quality, responsiveness. |

## 9. Verdict (John plays ten minutes; then one fresh person plays with no explanation)

| GO when | REWORK or SCRAP when |
|---|---|
| The fresh person forges a first character within 60 s unaided | They need the forge explained |
| A watcher can say what is coming and what is aboard | The queue or pile is unreadable |
| John wants "one more" after the timer | Spending feels like pressing the matching button |
| Being bogged then freed feels like relief | Being bogged is dead time, or the hidden help (B14) is noticed and resented |
| At least one outcome or unexpected character gets a reaction | Outcomes are noise |

Report back: verdict; which toggles felt better (B17); tunables that felt right; renderer technology used and how it ran on John's oldest phone and laptop.
