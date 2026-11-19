# Brief for Claude Design, round 2: 一笔 One Stroke (cut paper), and the 字/物 sheet

Paste this whole file into the Claude Design project on claude.ai. Attach these screenshots from the
running game (`games/tongzhou-forge-2d/screenshots/`):

- `ink/phone-6in-landscape-3-leap.jpg`, `ink/phone-6in-portrait-1-boat.jpg`, `ink/phone-6in-landscape-2-carry.jpg`
  (your ink boards, as built: where everything sits, and the look this one is compared against)
- `greybox/phone-6in-landscape-3-leap.jpg` (the middle ground both looks leave behind)

## Where things stand

Thank you for round 1. Your **水墨江湖 Ink Jianghu** boards are built into the game and are now its
default look: the scroll landscape, the hero's eight poses from your SVG paths, the type-block stones,
the HUD skin and the win colophon. Two changes to your frames: the thin sword line on the hero's back
was taken out (no weapons, see below), and the Latin labels use the system font.

Your boards worked well as a hand-off: `.dc.html` boards with the SVG path data inline, plus
`tokens.json`. Please deliver round 2 **the same way**.

The game, briefly: a side-view phone game for children learning Chinese. A small martial artist on
islands in a river carries square stones, each with one character (日 月 木 火). Where a stone sits
decides what it means: 日 beside 月 makes 明; 日 resting on 木 makes 杲. Movement is 轻功, chained leaps
up cliffs, stones and clouds. Pinyin and English meaning are always visible.

## Round 2, part 1: the same game in 一笔 One Stroke

The comparison look. The owner wants art that is **either extremely simple or extremely stylish,
never middle ground**. Ink Jianghu is the stylish extreme; this is the simple one. It must be just as
committed: sharp, graphic, clearly its own thing, not a cheaper ink scroll.

**The idea:** two inks on paper, cut like a paper-cut (剪纸) or carved like a seal (篆刻).

- **Paper and two inks.** Warm 宣纸 paper, 墨 black ink and 朱 vermilion. Flat fills only: **no
  gradients, no texture, no blur, no glow**. Flat tints of the two inks are allowed (for example ink at
  12% and 30%, vermilion at 20%) to make depth bands. One extra accent colour per isle at most
  (night: a cool blue-grey; daybreak: a warm yellow). Propose the tokens.
- **Landscape as cut paper.** Mountains are flat stacked triangles and arcs, hard-edged, like layers of
  paper laid over each other. Water is a few repeated arcs or wave lines (like a seal border), not a
  fill with texture. Clouds are the 祥云 curl as one cut shape. The moon or sun is a plain circle,
  perhaps vermilion.
- **The hero is a character.** The strokes of 大 with a dot for the head: a person with arms spread,
  five strokes that bend at the joints. Running, it leans forward. Leaping (轻功), it tucks into 人.
  Carrying overhead, it becomes 天, the stone as its top stroke. Wall push, land and fall: your call,
  staying with the stroke idea. The vermilion sash survives as one short red stroke with two ribbon
  tails; that and a thin gamboge rim are what mark "you". **No hat is needed, no face, no weapon.**
- **Stones**: a paper square with a cut ink border, the glyph in its element colour, a small slip
  under it with the pinyin. Forging 明 is a vermilion seal print.
- **Built things**: the pavilion as a cut-paper roof with upswept eaves and two pillars; the boat as a
  flat hull and awning; thorns as a row of black triangles; plank bridges as short dashes.

## The hard rules (they win over style, in both looks)

1. **Value order.** The play layer (walkable rock) is the darkest, solid black ink. The middle band
   is a lighter tint, the far band lighter still. A strip of **bare paper** always separates the middle
   band from the play layer.
2. **Walkable tops have a bare-paper rim** and nothing on them. Any pattern (cut lines, carving) goes
   only on cliff faces.
3. **Nothing in the play layer looks walkable and isn't.**
4. **Water is clearly lower than any ground** and reads as water.
5. **The hero and the stones are the most salient things on screen.** The hero reads at **30 px
   tall**. Glyphs are large; pinyin is readable at 13 px.
6. **In the air**, a landing shadow under the hero and a thin dotted line down to it. Keep them; style
   them (vermilion over water).
7. **Calm screen**: only the HUD below. Same layout as round 1 (goal card top left, word card top
   right, ☰ in the corner, one message strip, stick bottom left, JUMP bottom right with GRAB beside
   it). Upright, the hero's feet stay above the buttons.
8. **No sword or weapon** on the hero, in either look.

## Round 2, part 2: two kinds of glyph piece (both looks)

The owner wants **movable stones** (what you have) and **fixed glyph tiles carved into the rock**:
part of the ground, the glyph cut into a dark face and inked in its element colour, never carried.
They must never be confused with each other. Show one of each side by side, in Ink Jianghu and in
One Stroke.

## Round 2, part 3: the 字/物 sheet (both looks)

From round 1's addendum; not in your round 1 output. **A stone shows the thing it means while it is
doing something.** At rest it is always the square block (beside and on top are read from squares).
In the hero's hands, in the air, and when it acts, it becomes its thing.

| Glyph | Carried by the hero | Thrown | Acting |
|---|---|---|---|
| 木 wood | a small tree over the shoulder | a log turning end over end | a rope-tied plank bridge across a gap |
| 火 fire | a torch held out | a fireball | a thorn hedge burning away |
| 日 sun | a bright disc held up, lighting the night around the hero | a sun arcing over | shade melting |
| 月 moon | a crescent lantern | a spinning crescent | a soft glow where it lands |

For each glyph: the carried pose (hero holding it), the thrown thing, the acting moment, and the
**fold** between block and thing (two or three in-between frames).

**The words never disappear.** On the thing, the glyph sits on a small vermilion tag (like a seal on a
scroll), readable at a 30 px hero. Pinyin and meaning are on the word card while you carry or throw it,
so they need not be on the thing.

**Size limit**: a carried thing sticks out at most about half a stone beyond the hero and never hides
the landing shadow under them.

## Deliverables

1. **One Stroke frames**: the same scene as round 1 (Sun and Moon isle at night: boat at the left,
   ground, a gap over the river, a low thorn hedge, a tower with the 日 stone on top, the pavilion at
   the right with a ghost of 明, the hero mid-leap carrying 月), at **844×390** and **390×844**, plus
   the daybreak isle at 844×390.
2. **One Stroke hero sheet**: stand, run (two frames), jump, leap, wall push, carry, land, fall, as SVG
   paths. Please use **the same viewBox as your ink hero, `-29 -88 58 104`, feet at y = 0**, so the
   game swaps poses with no other change.
3. **One Stroke stone, HUD and win moment** (goal card, word card, message strip, ☰, JUMP, GRAB; the
   win colophon with a seal).
4. **Fixed tile vs stone**, side by side, both looks.
5. **字/物 sheet**, both looks: carried, thrown, acting and the fold, for 木 火 日 月.
6. **`tokens.json`** for One Stroke (night and daybreak), in the same shape as your round 1 file.

Everything is redrawn in HTML canvas from your paths and tokens (no image files in the game), so flat
shapes and strokes are exactly right. Keep each shape simple enough to draw sixty times a second on a
phone.
