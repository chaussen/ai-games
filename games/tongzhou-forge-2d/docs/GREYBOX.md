# Side-view greybox: what it answers, what shipped, what was found

Plan: `games/tongzhou-forge/docs/forge/SIDE-VIEW.md` §5 (FG-D019), step 1. Built 2026-11-19.
The 3D build is kept as tag `forge-3d-2026-11-19` and folder `games/tongzhou-forge` (Part 1 of the
plan, fixing the 3D, was **not** done first: John asked for the 2D experiment directly).

**The question (gate P2, John on his phone):** on a 6" phone, is it clear where you are, is forging
obvious, and does 轻功 feel like flying? Then: play this and the 3D side by side and pick one.

## 1. Every earlier finding, and what the greybox does about it

| # | Finding (playtests 1 and 2, G1) | In the greybox |
|---|---|---|
| 1 | Toasts sit over the stick, stay 4 to 16 s, stack | **One message line** at the top, newest replaces older, 2.5 s (3.5 s for a dud). `UI.msg`, `UI.msgDud` knobs. Never over the pad (checked) |
| 2 | Labels everywhere, too many layers | **Screen budget**: goal, word card, message line, ☰, stick, two buttons. Nothing else shows (checked on eleven screens). Pinyin kept: under every stone on the ground, in bare paper; knob `labels: all / near / card` in ☰ |
| 3 | The goal is a small chip | **Big goal glyph** top-left (52 px, element colour) with pinyin and meaning; a **beam** over the pavilion and the want glyph ghosted in it |
| 4 | Hard to see where you are, gaps vs steps, slipping into water | **Side view**: a gap is a gap. Bare-paper **edge lines** on every walkable top and cliff face; **石青 river** one unit below every ground, darker; **landing shadow** + dotted drop line while in the air (red when it falls on water); gold outline on your body; edge arrow when off screen; **coyote** time, **jump buffer**, **ledge nudge** (`ASSIST` knobs); respawn well back from the edge |
| 5 | 轻功 lost "flying higher and higher" | **The chain**: one leap per charge; the ground gives a charge and resets the chain; touching something **new** in the air (a wall face, a stone's side, a gem, a **cloud**) gives another. Apex float, ink trail, gold ring under your feet while you can still leap. Pushing into a wall climbs it; anything else kicks you off it. Camera climbs with you. `QI` knobs |
| 6 | Buttons cover the world | Upright, the camera keeps your feet **above the pad**; two buttons only (JUMP, GRAB), 66 px, bottom-right; the stick floats bottom-left; ☰ holds restart, isle, play profile, labels, sound, voice |
| G1 | After a failed 明 you could not see how; the message was false | Same rules as the 3D fix (FG-D017): a **frame** round every resting placement (two columns BESIDE / two rows ON TOP), red with ✕ after a dud, dashed **NOT QUITE** after a near miss; the message names the arrangement ("月 left, 日 right: makes nothing · they go together another way") |
| 3D | BESIDE stones overlapped (iso diagonal) | Gone: beside is touching left-right on the page |
| new | (John, 2026-11-19) Chinese on the buttons | One big character per button, pinyin and English small: 跳 tiào JUMP, 拿 ná GRAB, 旁 páng BESIDE, 上 shàng ON TOP, 扔 rēng THROW, 放 fàng SET DOWN, 落 luò DROP, 献 xiàn OFFER |

## 2. What the greybox is

- **Two isles**: Sun and Moon (明 = 日 left of 月; 火 burns thorns, 木 bridges a gap, 日 waits on a
  tower you climb with 轻功) and Dawn (杲 = 日 on 木; 木 on 日 makes 杳 and dusk; a cloud chain to a
  glow-gem). Each has two scripted winning routes in `sim-test.mjs`.
- **One player**, sim in the page (`sim.js`, pure, deterministic, also runs in node). No rooms yet.
- **Placement in page axes**: GRAB facing a stone at your level sets yours **BESIDE** it on your side
  (you step back); standing on a stone, or in the air above one, sets it **ON TOP**; walking with it
  **THROWS**; standing still **SETS DOWN** (a stone set over an edge tips in). Lean on a stone for
  0.2 s to push it. A dashed ghost square shows where the stone will go (placement only, never the
  result: P9; off in strict).
- **Ink on paper**: paper ground, three parallax ridge layers, mist, 石青 river, ink silhouettes with
  bare-paper rims, the Ma Shan Zheng brush face. Plain shapes otherwise (it is a greybox).

## 3. Knobs (all in `sim.js` except UI)

`FORGE` (classifier, snap, rescue, cooldown, wrong-life, dud hint, near, push), `QI` (jump and leap
height, float, chain cap, carry cap, refill sources, `wallKey` face / band / any, kick, cooldown),
`ASSIST` (coyote, buffer, nudge, keep the stone when you fall, `minJump`). Each has profiles
relaxed / standard / strict, switched together from ☰ → Play. `UI` in `app.js`: labels, message
seconds, card seconds, win delay, sound, voice.

## 4. Defect log (found while building and testing on six screens)

| Found by | Defect | Fix |
|---|---|---|
| sim-test bot | A stone set down over a ledge balanced on the corner, so 木 set at a gap never fell in | Resting on rock with its middle over air: it tips over the edge |
| sim-test bot | A leap off a wall always kicked away, so you could not climb a face | Pushing into the wall leaps straight up; otherwise kick |
| sim-test bot | Walking into a stone pushed it at once: walking up to a piece or past one shoved it | Push only after leaning 0.2 s |
| sim-test bot | A pushed stone still counted as "never moved", so pushing two pieces together never forged | Pushing sets `from` |
| sim-test bot | Dusk was announced before the forge that caused it | `forge` event first, then `dusk` |
| design | Sun and Moon's hedge (3 tall) could not be crossed carrying 日 without 火: one way only | Hedge 2 tall: burn it, or jump + leap over it |
| design | Dawn's clouds 2.7 apart: the top one was 0.15 out of reach | 2.4 apart; reach per link is about 2.4 |
| screen-check | **A tapped JUMP was a 0.4 hop** (a finger tap lasts 60-100 ms and letting go cut the jump), so on touch the leap and the chain never happened | `ASSIST.minJump` 0.14 s: a tap clears a rock (1.2), holding goes to 1.56 |
| screen-check | Respawn on the lip of a gap; with the stick still held you walked straight back in (5 times) | Safe ground needs rock 0.7 either side |
| screen-check | Upright phone: 70% sky, small stones; tablet zoomed in far too much | Upright scale `min(W/7.2, H/14)` |
| screen-check | Dud message squeezed to three lines (CSS width) ; buttons low-contrast on dark ground; seams in edge lines; dusk veil greyed your outline | `fit-content` line; opaque paper buttons; overlapping rims; veil under stones and you |
| screen-check (iPad, Mac) | A 12.9" iPad and a 13" Mac drew 4.6 to 5.2 million canvas pixels: half a phone's frame rate (headless), and a held JUMP came out short when frames stalled | Canvas capped at a phone's worth of pixels (`UI.maxPx` 3.2 M): big screens draw a little softer, iPad Pro 30 → 45 fps, Mac 28 → 39 (headless) |
| screen-check (laptop) | The check's in-page leap tapped JUMP as a touch, which (rightly) switched a laptop to the touch pad | Laptops are driven by Space in the check; it now fails if the pad ever shows on a keys-only laptop. Touch screens are detected by `pointer: coarse`, no `?touch=1` |
| screen-check | Brush font lacked 跳 拿 旁 扔 放 献 落 | `tools/font.py` re-subset (257 characters, 69 KB) |

Screens checked (page area after the browser's bars): phones 390×844, 360×740 and both on their side;
iPad 10.9" 820×1106 and 1180×746, iPad mini 744×1059, iPad Pro 12.9" 1366×950; laptops 1366×657,
13" Mac 1440×790, 1080p 1920×960. Judged from the screenshots: iPad landscape is the roomiest view;
iPad portrait shows ten units across, so two thirds of it is sky (room for 轻功, but the ground band is
small); on the 1366×657 laptop 日 on its tower sits just under the goal box.

Harness notes (not game defects): Chrome's DevTools `touchEnd` lists the fingers lifted; Python→page
round trips on a DPR-3 page cost 0.2 to 0.3 s, so the screen check fires timing-critical leaps inside
the page through the JUMP button's own pointer handlers. Real touches are used for walking, GRAB, a
jump and a leap.

## 5. Known gaps

- One player only; no server rooms, QR, board view, body forging, boost or friend's-head refill.
- Two isles of nine; no judge; stage data is hand-written ASCII.
- No writing pad (Conjure) and no pictograph for every root character.
- Audio is sine blips; voice uses the browser's zh-CN voice if there is one.
- Nobody has played it on a real phone yet: that is gate P2.

## 6. Gate P2 questions for John

1. Upright and sideways: can you always see where you are and where you will land?
2. Do jumps over gaps land? Do you fall in the river by accident?
3. Is forging obvious: BESIDE from the side, ON TOP by standing on or dropping from above?
4. Does the cloud chain feel like flying higher and higher? Too easy, too hard?
5. Is the screen calm? Do you still read the pinyin and meaning?
6. 2D or 3D?
