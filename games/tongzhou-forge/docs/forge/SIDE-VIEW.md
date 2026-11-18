# Plan: fix the 3D view, then a side view (approved direction, 2026-11-18)

**Update 2026-11-19:** John asked for the side view directly. Part 1 (fix the 3D) is **not done**;
§4 is done (tag `forge-3d-2026-11-19`); §5 step 1, the greybox, is built in `games/tongzhou-forge-2d`
(see its `docs/GREYBOX.md`: every finding below and what the greybox does about it). Next: gate P2
on John's phone.

**Start here next session.** This is the handover for the work after John's second phone playtest.
Nothing in here is built yet. Order: **Part 1 (fix 3D) → gate → Part 2 (side view)**. Part 2 starts
whatever the gate says, because John wants both tried; the gate only decides which one we keep going
with.

## 0. John's decisions (2026-11-18)

1. **Try to fix the 3D first.** If it does not work, keep a copy of it anyway, then work on the side
   view. John likes the **Inkblade** look (`~/projects/inkblade`); use it as a reference, not a spec.
2. **The phone is the main screen.** Design for a 6" phone on its own; if it fits a small screen, the
   TV/laptop board will be fine.
3. **Keep pinyin and meaning.** The game needs language exposure. Declutter *how* they are shown;
   never remove them.

## 1. What the playtest showed

| # | Finding | Cause in the build |
|---|---|---|
| 1 | Too much on a 6" screen; toasts block the controller and stay too long | `#feed` sits just above the stick (`style.css` `html.pad #feed`, bottom 166 px / 214 px portrait). `FEED` in `app.js`: goal 16 s, new move 8 s, char 6.5 s, warn 4.5 s, info 4 s; they stack |
| 2 | Every stone carries pinyin and meaning, plus sprites, buttons, forged glyphs, intros, hints, warnings | Every layer was added for one reason and none was counted against a budget. "Imagine four players" |
| 3 | The goal character is not clear | It is a small "shrine" chip (`.wantcard`) beside stage name, gems and clock |
| 4 | Hard to see where you are; gaps, cliff edges and water are hard to judge; often slipped into water | Fixed isometric camera: height and depth share one screen direction, so a gap and a step look alike |
| 5 | 轻功 has lost the "flying higher and higher" feeling | A mid-air leap adds only about 0.5 units of height (`LEAP_V` 5.6, `G` 30; jump plus leap tops out near 1.7), then waits `QI_CD` 4 s; the iso view flattens what height there is |
| 6 | Buttons are big and cover the world | The world is drawn under the pad; nothing reserves space for it |

Diagnosis: 1, 2, 3 and 6 are layout, not the web (a native app with the same layers would be as
crowded; the web stays, for QR join with no install). 4 and 5 come from the isometric view, which
also fights the grammar: ⿰/⿱ are screen axes, so in iso "beside" lives on a world diagonal
(FG-D005, defect F2.5) and side-by-side stones overlap (0.62 apart, glyphs 1.35 wide).

## 2. The screen diet (both parts)

Budget on a phone: **one message line, one goal, one word card, two buttons, the stick.** A board
check enforces it (count visible HUD elements and check that none overlaps the pad's rectangles).

| Thing | Now | Planned |
|---|---|---|
| Pinyin and meaning on stones | On every stone, always | **Kept** (decision 3). Every stone shows glyph + small pinyin under it. The stone you are next to or holding shows a **word card** at the top: big glyph, pinyin, meaning (and the pictograph for root characters, as now). A forge result gets the card for longer. On a crowded screen, pinyin on far stones fades first, the glyph never. A knob `labels: all / near / card` so the playtest can choose |
| Messages | Stack over the stick, 4 to 16 s | One line at the top, newest replaces older, about 2.5 s (3.5 s for a dud reason), never over the controls. Knob for durations |
| Goal | Small "shrine" chip | One big glyph top-left (about 56 px, element colour) with its pinyin; a beam or banner over the pavilion in the world. Stage name, gems and clock leave the phone HUD (board keeps them) |
| Intros and hints | Big title card, goal note, "new move" notes | Title card only while on the boat; one tip per isle, shown once, tap to dismiss |
| Buttons | DRAW, GRAB, JUMP, quick calls, respawn, restart | JUMP and GRAB only, about 56 px, translucent, bottom corners. DRAW, calls, respawn, restart go into a small ☰ drawer |
| World under buttons | Yes | The camera keeps a bottom band free; your feet and the ground line under you stay above the controls |
| Where am I | Small ring | Your body gets a bright outline; an arrow at the screen edge when you are off screen; friends dimmer on your phone |
| Four players | Every name tag and label | Phones: no name tags, only your own card. Board: names allowed |

## 3. Part 1: fix the 3D (keep `games/tongzhou-forge`)

Goal: find out whether the iso diorama can be made readable and fun on a 6" phone.

1. **Screen diet** (§2), all of it.
2. **Readability of the ground:**
   - a **landing shadow**: a dark disc straight below you on whatever is under you (the strongest cue
     for "where will I land" in 3D platformers), plus a thin line down to it while in the air;
   - **edge lines** along every cliff and shore, and water drawn clearly lower and darker;
   - a slightly lower camera tilt on phones if it helps the gap-vs-step problem (knob);
   - optional **edge forgiveness**: a short coyote time and a small nudge back from water edges
     (knob, off in strict).
3. **轻功 chain**: a leap off something new refills it (a friend's head, a stone, a wall, a gem,
   later a cloud). Higher `LEAP_V`, a short float at the apex, a trail. Knobs as a `QI` group
   (leap height, refill sources, chain cap, cooldown), same rules as `FORGE` (FG-D003).
4. **Tests:** existing suites stay green; `t10` grows the diet check (no HUD element over the pad on
   a 390×844 portrait and an 844×390 landscape phone); screenshots from the running build.

**Gate P1 (John on his phone, one player, isles 1, 2, 4):** can he see where he is and land jumps
over gaps, is the screen calm, does 轻功 feel like flying? Record answers in ROADMAP §3.

## 4. Keep a copy, whatever the gate says

Before Part 2: tag the 3D build (`git tag forge-3d-<date>`), push the tag, and leave
`games/tongzhou-forge` as the 3D game (frozen unless it wins the gate). The side view is a **new
folder** copied from it, `games/tongzhou-forge-2d` (one folder per game; never import across; the
3D game keeps its own README and tests). Note it in the gallery and the root of both READMEs.

## 5. Part 2: side view (`games/tongzhou-forge-2d`)

### Shape
- Side-scrolling isles, Canvas 2D, no Three.js. World axes = page axes: **beside** is touching on
  left-right, **on top** is resting on top, standing on a friend's head is visibly ⿱.
- 轻功 goes vertical: the chain from §3.3; the phone camera climbs with you, the board camera
  frames the crew. Isles get height: the pavilion on a cliff, a gem high up, a stone passed up
  head to head.
- Carries over: forge rules and knobs, recipes, 36 characters and effects, server, rooms, QR join,
  playlog, the judge's idea. Rewritten: renderer, sim movement and collision (x/z → x/y), the nine
  isles, the judge's bot moves.

### Look: Inkblade as reference
What to borrow from Inkblade (`~/projects/inkblade`, `README.md` and
`inkblade-3d-transition-visuals-exploration.md`); copy ideas, never code across repos:
- ink on paper: a paper ground, brush-ink silhouettes, a rim of bare paper, mineral colours
  (石青 water, 藤黄 light) as accents;
- shan-shui depth: far ridgelines and mist layers with **parallax** as the camera moves (Inkblade's
  own finding: motion parallax is what makes depth read);
- the Ma Shan Zheng face (already bundled here as a subset in `vendor/`);
- characters manifest as what they mean (木 grows a tree), with a short ink transition.
Not required: its combat, stroke cutting or exact palette.

### Steps
1. **Greybox, about an hour, throwaway:** isles 2 (Sun and Moon) and 4 (Dawn), one player, the 轻功
   chain, the screen diet. Plain shapes and glyphs. Question: on the phone, is it clear where you
   are, is forging obvious, does leaping feel like flying?
2. If yes: write the phase cards in ROADMAP (docs and review before code, as for any big change),
   then port the sim, the renderer in the ink style, the nine isles and the judge, porting tests as
   we go.
3. **Gate P2:** John plays the 2D greybox and the fixed 3D side by side on the phone and picks one.

## 6. Housekeeping found today

- Not fixed from G1: BESIDE glyphs overlap (goes away in 2D); the goal note covers quick-call
  buttons on portrait (goes away with the diet); controller and movement niggles (part of §3.2).
- Test ports in use: 3460 to 3462, 3474 to 3476, 3480. New checks take 3481 upward. Never 3000.
- The local server for phone play runs on 3000 here (firewall), `PORT=3000 node server.js`.
