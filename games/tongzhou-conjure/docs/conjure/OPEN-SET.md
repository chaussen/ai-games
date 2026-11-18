# Idea 2: many more conjurable characters, and hints for practice

Status: **DESIGN ONLY. Not started.** Written 2026-11-18.
Read `ROADMAP.md` for the order of work. This file says what and why; `ROADMAP.md` says who and when.

## 1. Goal

Today each stage allows 1 to 4 characters. With so few, recognition is trivial (any scribble
with about the right number of strokes comes out as 木) and there is little to practise.
Goal: players can write **any character from their class band** (B1 has 556), plus anything the
crew has found, and get a stone that does something sensible.

## 2. Hard blocker first: the recogniser is not proven

`vendor/recogniser.js` matches drawn stroke *i* against template stroke *i*, on 12 hand-made
templates. `lab/accuracy.mjs` reports 100%, but `lab/samples/` is empty, so it tests jittered
copies of the templates against themselves. **No real handwriting has been measured.** Wrong
stroke order or two strokes joined in one (common for children) will fail.

Before opening the set, do this (ROADMAP stream B):

1. Collect real samples on `lab/draw.html`: at least 3 people, 5 drawings per character, on phones.
   Make `accuracy.mjs` refuse to print a gate result when there are no real samples.
2. Build templates from **Make Me a Hanzi** stroke medians (correct stroke order and count, ~9.5k
   characters). The data is already in this repo at `build-pipeline/data/graphics.txt` (the 学字坊
   build input). Do not load it at runtime from there (repo rule: games never import 学字坊 files).
   Write `tools/strokes.mjs` that reads it once and writes only the needed characters to
   `vendor/strokes.json`, and copy the licence (Arphic Public License for graphics; check the
   repo's licence files) to `vendor/MMAH-LICENSE.txt`. Ask John before vendoring if unsure.
3. Make the matcher tolerate stroke order: match each drawn stroke to its best unused template
   stroke (greedy or Hungarian), penalise stroke-count difference, and only use order as a small
   bonus. Keep the interface in `SPEC.md` section 7 unchanged.
4. Measure top-1 / top-3 on real samples for 30, 100 and 300 candidates. The open-set size we ship
   is the largest that passes the gate (top-3 ≥ 90%, top-1 ≥ 70%, < 200 ms on a mid-range phone).

If accuracy collapses beyond ~50 characters, keep the set small (the stage's characters plus the
crew's found list) and still ship the hints below.

## 3. Which characters are allowed

`allowed = class band (character-library.json B1..B4, copied at build time)  ∪  crew found list`
`minus the stage's want character` (the pavilion's character must be built, never written, or
the puzzle is skipped).

The band list must be copied into this game at build time (`tools/strokes.mjs` can do both), not read
from `assets/` at runtime.

## 4. What a new character does: its radical decides

Every character gets an element from its semantic radical (from `dictionary.txt` `radical` /
decomposition), so nobody has to author hundreds of effects:

| Radical | Element | Examples |
|---|---|---|
| 氵 水 | water (douses flames) | 河 海 湖 江 泉 洗 |
| 火 灬 | fire (burns thorns) | 灯 炎 热 点 |
| 木 | wood (grows a bridge) | 林 桥 果 树 |
| 日 | light | 明 早 晴 星 |
| 亻 人 | folk | 你 他 休 们 |
| anything else | inert (can still fuse) | 口 大 小 |

Reach or span can scale with stroke count (more strokes, stronger). This turns "learning radicals"
into "learning what stones do", which is the strongest teaching hook in the design. Write the result
into `content/glyphs.json` with a tool, never by hand for hundreds of entries; keep authored entries.

## 5. Brush font gap

`vendor/MaShanZheng-subset.woff2` contains 231 characters. B1 alone has 556 (75 covered). The full
font is not on disk. Two ways:

1. Download the full Ma Shan Zheng (OFL, Google Fonts) once, re-subset with fontTools to the
   allowed set. Needs one internet fetch by a human.
2. Draw stones from the Make Me a Hanzi stroke outlines (`strokes` field) instead of the font.
   No font needed, any character works. Preferred.

## 6. Hint ladder (writing help, priced in ink)

| Level | The phone shows | Ink |
|---|---|---|
| Free | blank pad | 1 (a clean free write could refund 0.5; playtest) |
| Clue | pinyin, English, radical and part hint ("water on the left") | 1 |
| Start | stroke count and the first stroke drawn faintly | 1 |
| Show | stroke-by-stroke animation, then trace with a check per stroke | 1.5 |
| Pick | tap the character, no writing (accessibility fallback) | 2 |

- Per-stroke feedback while tracing: the target is known, so each stroke is compared to the template
  stroke as it is drawn (order, direction, rough shape) and flashes right or wrong.
- Practice memory on each phone (localStorage, never sent): a character is "mastered" after N clean
  free writes; the pad suggests characters that are due again (spaced repetition).

### Charter limits (from `games/tongzhou/docs/charter-v1.md`; John to confirm they still apply)

- **P8 Forward Play**: knowledge is a shortcut, never a key. Nothing may *require* recalling a character.
- **P9 Show After, Never Before**: never say in advance what will work.
- **TZ-D025**: recall-first play was rejected in John's difficulty review.

So, **dropped** from the 2026-11-18 review: (a) the board describing a need by meaning so players must
recall the character, and (b) the board nudging "no 木 left — who can write it?". Both break P8/P9.
The ladder above only helps with *writing*; it never tells the crew what to write. The "used up" note
(CONSUMABLE.md) is allowed because it reports what already happened.

## 7. Phone pad defects to fix first (from the 2026-11-18 review)

| ID | Defect | Where |
|---|---|---|
| D1 | The pick palette conjures at once, so choosing a Trace target spends ink. SPEC §5 says pick target first. | `app.js` `renderPalette` |
| D2 | Long strokes are cut, not thinned: `onPadMove` stops adding points after 40. | `app.js` `onPadMove` |
| D3 | The pad closes before the server answers; a refusal loses the drawing. | `app.js` `sendConjure` |
| D4 | Pad x and y are scaled separately, so a non-square pad distorts strokes and the board replay. | `app.js` `onPadDown/Move` |
| D5 | A palette pick with an empty pad sends `strokes: []`; the server drops it silently (no `conjureNo`). | `app.js` `sendConjure` + `server.js` |
| D6 | `accuracy.mjs` reports a pass with zero real samples. | `lab/accuracy.mjs` |
