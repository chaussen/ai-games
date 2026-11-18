# Brief for Claude Design: 同舟 · Glyph Isles, "ink jianghu" style frames

Paste this whole file into Claude Design. Attach the two greybox screenshots named at the end, from
`games/tongzhou-forge-2d/screenshots/greybox/`. The full plan is `docs/ART-DIRECTION.md`.

## The game in one paragraph

A side-view phone game for children learning Chinese. You are a small martial artist on islands in a
river. Square stones each carry one Chinese character (日 sun, 月 moon, 木 tree, 火 fire). Where a stone
sits decides what it means: 日 set beside 月 makes 明 (bright); 日 resting on 木 makes 杲 (sunrise). You
carry stones, set them beside or on top of each other, and offer the made character at a pavilion.
Movement is 轻功: chained leaps up cliff faces, stones and clouds, "flying higher and higher". Pinyin
and English meaning are always visible: language exposure is the point.

## What we want

A **Song-dynasty landscape handscroll you walk through**: ink and mineral blue-green (青绿山水) on aged
silk, karst towers rising from mist and river, a tiny swordsman of few brush strokes flying up its
cliffs. **Extremely stylish, never middle ground.** The current greybox (attached) is the middle
ground to leave behind: soft grey hills, app bubbles, a cartoon hero.

References, by source and never by game: Guilin and Zhangjiajie karst; 王希孟《千里江山图》 (palette);
郭熙《早春图》 and the three distances (depth bands); 马远《水图》 (water as line patterns);
黄公望《富春山居图》 (handscroll, mist bands); Huangshan pines and cloud seas. John named Genshin's
Liyue as the feel to reach. Reach it from these same real sources; **do not copy Genshin's art,
characters, buildings or look.**

## Deliverables

1. **Two style frames**, the same scene at **844×390** (phone on its side) and **390×844** (upright):
   the start of the Sun and Moon isle at night. A boat at the left, ground, a gap over the river,
   a low thorn hedge, a tall stone tower with the 日 stone on top, the pavilion at the right with a
   ghost of 明 above it. The hero mid-leap beside the tower, carrying 月 overhead. HUD in place (see
   Layout).
2. **Hero pose sheet**: stand, run, jump, 轻功 leap (飞天 spread), wall push, carry overhead, land,
   fall. Conical bamboo hat (斗笠), robe, vermilion sash with two long ribbons, no face. A thin gold
   rim marks "you". It has to read at **30 px tall**.
3. **The stone**: a movable-type block (活字, fired clay or pale wood), the glyph raised on its face in
   its element colour, a small paper slip under it with the pinyin. Show 日 月 木 火 and the forged
   明 being printed in vermilion.
4. **Palette and value sheet**: the tokens below adjusted as you see fit, for moon night and daybreak.
5. **HUD skin**: goal card, word card, message strip, ☰, JUMP and GRAB buttons.
6. **The win moment**: the scroll's end with a colophon (character, pinyin, meaning) and a red seal.

Format: PNG frames plus SVG for the hero poses, the stone and the HUD parts, and the palette as hex
tokens. Everything will be **redrawn procedurally in HTML canvas** (no image files in the game), so
prefer shapes that can be made from tapered brush strokes, washes and flat fills. Painted far
backgrounds are welcome as an option.

## Hard constraints (playtested; they win over style)

1. **Value order**: the play layer (walkable rock) is the darkest ink; the middle band about half;
   the far band about a quarter. A **mist band of bare silk** always separates the middle from the
   play layer.
2. Walkable tops have a **bare-silk rim and no texture**. Texture (axe-cut 斧劈皴) only on cliff faces.
3. **Nothing that looks walkable and isn't**, in the play layer.
4. Water is clearly lower than any ground and its own colour (石青).
5. The hero (gold rim, vermilion sash) and the stones (light blocks, coloured glyphs) are the most
   salient things on screen. Glyphs are large; pinyin readable at 13 px.
6. In the air there is a landing shadow and a thin dotted line down to it. Keep them; style them.
7. Calm screen: nothing beyond the HUD listed below.

## Layout (do not move)

- Goal card top-left: big glyph (52 px) with pinyin and meaning under it.
- Word card top-right, then ☰ (38 px) in the corner.
- One message strip, centred under the cards.
- Stick bottom-left (a 116 px ring). JUMP (66 px round) in the bottom-right corner, GRAB beside and a
  little above it. The buttons show one big brush character, with pinyin and English small:
  跳 tiào JUMP, 拿 ná GRAB (it changes to 旁 BESIDE, 上 ON TOP, 扔 THROW, 放 SET DOWN, 落 DROP, 献 OFFER).
- Upright, the hero's feet stay above the buttons.

## Palette tokens (a starting point)

Silk `#e9dcc0`, aged silk `#d6c39e`, ink `#1d1b1a` (washes 12 / 28 / 50%), azurite 石青 `#2f6f8f`
(deep `#1f4e6e`), malachite 石绿 `#4f9a7a` (pale `#9cc3a5`), ochre `#a0603a`, vermilion `#c23a2b`,
gamboge `#e0a526` (you, 轻功), gilt `#c9a24a` (pavilion). Glyph element colours (keep): wood `#1c6b50`,
fire `#c22f1c`, water `#1b5aa6`, light `#b06f06`, earth `#7a4a22`. The brush font is Ma Shan Zheng.

## Attach

`phone-6in-landscape-3-leap.jpg`, `phone-6in-portrait-1-boat.jpg`, `ipad-landscape-7-dawn-high.jpg`
(the current greybox: the look to leave behind, and where everything sits).

---

## Addendum (2026-11-19): paste this as a follow-up message

John's answers after the first brief:

1. **Make both styles**, as a comparison: the ink jianghu frames above, and the same scene in
   **一笔 One Stroke** (two inks, black 墨 and vermilion 朱, on warm 宣纸 paper; flat cut-paper
   mountains of stacked triangles and arcs; no gradients, no texture; the hero drawn like the
   character 大 with a head dot, bending into 人 when leaping and 天 when carrying).
2. **No sword or weapon** on the hero.
3. **Two kinds of glyph piece**: movable stones (the type blocks above) and **fixed glyph tiles carved
   into the rock** (the glyph cut into a dark face, inked in its element colour). They must never be
   confused: show one of each side by side.
4. **A stone shows the thing it means while it is doing something.** At rest it is always the square
   block. In your hands, in the air and when it acts, it becomes its thing, with the glyph kept on a
   small vermilion tag. Please add a **字/物 sheet**, in both styles:

| Glyph | Carried by the hero | Thrown | Acting |
|---|---|---|---|
| 木 wood | a small tree over the shoulder | a log turning end over end | a rope-tied plank bridge across a gap |
| 火 fire | a torch held out | a fireball | a thorn hedge burning away |
| 日 sun | a bright disc held up, lighting the night around the hero | a sun arcing over | shade melting |
| 月 moon | a crescent lantern | a spinning crescent | a soft glow where it lands |

   Limits: a carried thing sticks out at most about half a stone beyond the hero and never hides the
   landing shadow under them; it must still read at a 30 px hero.
