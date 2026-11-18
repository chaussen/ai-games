# Art direction plan: 水墨江湖 · ink jianghu

Status: **plan, nothing built** (2026-11-19). Proposed decision FG-D020. Stop for John's review before
any code (the plan-first rule). A paste-ready brief for Claude Design is `docs/ART-BRIEF.md`.

John's ask: more unique Chinese traditional styling, a martial-artist feel, Chinese landscape terrain
(mountains and rivers, Liyue in Genshin as the bar). **Either extremely simple (a stick man on
geometry) or extremely stylish. No middle ground.**

## 1. Where the greybox sits now: the middle ground

The greybox is exactly the look to leave behind. Soft sine-wave hills in flat grey-violet, a
rounded-corner HUD, a hero who is a gold trapezoid with a cartoon eye, a puffy clip-art cloud. It is
neither bare enough to be graphic nor rich enough to be painted. It reads as a generic mobile game,
and nothing in it says China except the characters on the stones.

What it gets right, and the new art must keep (these came from two playtests and the screen checks):

1. You always see where you are: walkable tops and cliff faces have a bare-paper edge line; you have a
   gold outline; a landing shadow and drop line while in the air.
2. Water is clearly lower and darker than any ground.
3. Stones read at a glance: big glyph, element colour, pinyin under it.
4. The screen budget: goal, word card, message line, ☰, stick, two buttons. Nothing else.
5. Same frame rate as now on all eleven screens.

## 2. Two extremes, and the pick

### A. 一笔 One Stroke (extreme simple)

- Two inks and paper. 墨 black and 朱 vermilion on warm 宣纸 paper, one accent colour per isle,
  no gradients, no texture.
- Geometry as cut paper. Mountains are flat stacked triangles and arcs like a paper-cut or a
  seal carving. Ground is ink blocks with a paper rim, as now but crisper.
- The hero is a character. A head dot (点) on 大, a person with arms spread: five brush strokes that
  bend at the joints. Running, it leans; leaping, it becomes 人 tucked; carrying, 天 with the stone
  as its top stroke.
- Good: cheap, sharp, very readable, clearly its own thing. Weak: little landscape, no Liyue, and
  "martial" lives only in the motion.

### B. 水墨江湖 Ink Jianghu (extreme stylish): **recommended**

A Song-dynasty landscape scroll you walk through, painted in ink and mineral colour, with a tiny
swordsman figure flying up its cliffs.

Why B: the game is about characters written with a brush, and ink painting is the same art as
calligraphy, using the same brush, ink and paper. A painted world makes the glyphs belong there
instead of sitting on top of it. It is also the only route to the Liyue feel John asked for.
Not middle ground, because B takes A's best idea: in real shan-shui the people (点景人物) are a few
strokes inside a rich landscape. **A rich world with a figure of very few strokes is how the
tradition itself does it.**

The rest of this plan is B. A stays the fallback if the style frames (§6, step V1) disappoint.

## 3. Direction B in detail

### 3.1 The landscape: borrow the real sources, not Genshin

Liyue is drawn from real places and real paintings. Go to those same sources, never to Genshin's
assets or look (we do not recreate a specific game):

| Source | What we take |
|---|---|
| Guilin and Yangshuo karst, Zhangjiajie sandstone pillars | Tall, narrow stone towers rising from mist and river: perfect 轻功 terrain, already our shape (towers, gaps) |
| 王希孟《千里江山图》 (1113) | 青绿山水 blue-green palette: azurite 石青 and malachite 石绿 over ink, on aged silk |
| 郭熙《早春图》 and his 三远 (high, deep, level distance) | Three depth bands, which map straight onto our parallax layers |
| 马远《水图》 (twelve studies of water) | The river drawn as line patterns: ripples by day, swirls at a rapid, a calm mirror at night |
| 黄公望《富春山居图》 handscroll | Each isle is one scroll that unrolls left to right; mist bands (留白) cut the layers apart |
| Huangshan | Pines clinging to cliff edges, a sea of clouds below: clouds you leap on |

**Depth bands** (far to near, the play layer always darkest):

1. **Sky and silk**: aged silk tone, a soft wash, sun or moon as a faint disc.
2. **Far (平远, parallax 0.1)**: pale ink ridgelines with a 石青 wash, almost flat.
3. **Middle (深远, 0.3)**: karst pillars in 石绿 over light ink, hemp-fibre texture (披麻皴), a pine or
   pagoda on top, waterfalls as untouched silk.
4. **Mist (留白)**: a band of bare silk that separates the middle from the play layer. This band is
   what keeps the play layer readable.
5. **Play layer (高远, 1.0)**: rock in dense ink with axe-cut texture (斧劈皴) on the cliff faces
   only. Tops carry the bare-silk rim, never texture. Walkable things are the only dense ink in the
   picture.
6. **Foreground (1.3, rare)**: an out-of-focus branch or reed tip at the very bottom edge, below the
   pad and away from where you land.

**Built things**: the pavilion with upswept eaves (飞檐), vermilion pillars and gold ridge tiles; stone
arch and plank bridges; terraced paddies as steps; a lone boat (乌篷船) at the start; prayer flags or
lanterns for wind.

### 3.2 The hero: 侠 in a few strokes

- **Silhouette first**, readable at 30 px: a conical bamboo hat (斗笠), a long robe flaring at the
  hem, and a **vermilion sash with two long ribbons** (飘带). No face; the hat says who it is.
- **Brush-stroke body**: about 8 tapered strokes on a small skeleton (hips, chest, head, two arms, two
  legs), so it reads as painted, not as a sprite.
- **The ribbons carry the 轻功**: a short chain that trails, flutters at the apex, and streams
  straight down in a fall. Flying should show in the cloth, not in effects.
- **Poses**: stand (hand on the hat brim), run (low lean, robe back), jump (knees up), 轻功 leap
  (flying-dance spread, 飞天), wall push (one foot on the face), carry (the stone over the head on both
  palms), land (crouch, then robe settles), fall in the river (hat floats a moment).
- **Telling which one is you** stays: a thin gold (藤黄) rim on the silhouette. Later, friends get
  their own sash colours.

### 3.3 The stones: movable type (活字)

Placing pieces next to each other to make a character is what 毕昇's movable type does. So **stones
become type blocks**: square blocks of fired clay (or pale wood), the glyph raised on the face in the
element colour, a small paper slip (签) underneath with the pinyin. Forging is **printing**: the
pieces press together, a vermilion impression of the new character lands on the scroll, and the seal
stays where it was made.

### 3.4 Effects: ink does the work

| Moment | Effect |
|---|---|
| 轻功 leap | A ring of ink blooms under the feet (墨晕) and fades into the silk; the ribbons snap out |
| In flight | A dry-brush trail (飞白) behind you, short, thinning |
| Landing | A small splash of dry-brush dust |
| Forge | The new character is brushed stroke by stroke over the stones, then a red seal (印) stamps it |
| Dud | The ink smudges and runs a little; the red ✕ frame stays as now |
| Win | The scroll rolls on to its end; a colophon (题跋) in the brush font with the character, pinyin and meaning, and your seal |
| Ambient | Cranes far off, falling leaves or petals by isle, mist drifting, grass and flags in the wind |

### 3.5 Palette (tokens)

Silk 绢 `#e9dcc0`, aged silk `#d6c39e`, ink 墨 `#1d1b1a` with washes at 12 / 28 / 50%, azurite 石青
`#2f6f8f` (deep `#1f4e6e`), malachite 石绿 `#4f9a7a` (pale `#9cc3a5`), ochre 赭石 `#a0603a`,
vermilion 朱砂 `#c23a2b`, gamboge 藤黄 `#e0a526` (you, 轻功), gilt 泥金 `#c9a24a` (the pavilion).
Glyph colours keep the current element palette, since they carry meaning.

Each isle gets a time of day that changes the washes, not the inks: Sun and Moon is **moon night**
(indigo washes, cold silk); Dawn is **daybreak** (pink-gold mist, then dusk on 杳). Later isles:
blue-green noon, snow, rain.

### 3.6 HUD and buttons

Stay calm and stay in the same places. Cards become silk mounted on a darker border (装裱), with no
rounded app bubbles. JUMP and GRAB become round ink-stone discs with the brush character in white
(白文). ☰ becomes a small seal. The message line becomes a strip of paper. No new HUD elements.

## 4. Readability rules (these win over style every time)

1. **Value order**: play layer darkest, middle about half, far about a quarter. Only walkable things,
   you and the stones use dense ink.
2. **Nothing that looks walkable and isn't.** Decor that could be read as a ledge sits in the far or
   middle bands at low contrast, or is not drawn.
3. Walkable tops are plain: bare-silk rim, no texture, no grass covering the edge.
4. Water keeps its own colour (石青) and pattern, lower than any ground.
5. You (the gold rim and the vermilion sash) and the stones (light blocks with coloured glyphs) are the
   most salient things on screen.
6. Effects fade in under 0.6 s and never cover the landing shadow.
7. The mist band always sits between the middle layer and the play layer.

These become **automatic checks** (§6): contrast probes in the page, not taste.

## 5. How it is built

- **Procedural, no image files**: everything is drawn in canvas from code, so it scales to every
  screen, stays small, and has no licence questions. One shared primitive, `brush(path, widths,
  dryness)`, draws tapered and dry-brush strokes for terrain, the hero, effects and the win
  colophon.
- **Baked layers**: sky, far, middle and paper grain are painted once per isle into offscreen
  canvases (within the `UI.maxPx` cap) and slid for parallax. Each frame costs a few `drawImage` calls
  plus the play layer, the hero and effects.
- **Renderer only**: `sim.js` and the rules are untouched; the art reads the same state.
- **`?art=greybox | ink`**: the greybox stays as a switch (also in ☰) for A/B tests and slow devices.
- **Optional painted assets later**: if Claude Design produces painted plates, they come in as
  vendored WebP files with a licence record, only for the far layers.

## 6. Steps and gates

| Step | What | Done when |
|---|---|---|
| V0 | This plan and `ART-BRIEF.md` | John reviews; optionally hands the brief to Claude Design |
| V1 | **Style frames**: a `lookdev.html` page draws one scene (Sun and Moon: boat, gap, thorns, the 日 tower, pavilion) in A and in B, at phone landscape and portrait; screenshots taken from the running page | **Gate V1: John picks A or B** (or sends Claude Design's frames as the target) |
| V2 | The brush primitive; sky, far, middle, mist and play layer; the river; the pavilion and the boat, behind `?art=ink` | Both isles playable in ink; contrast probes pass |
| V3 | The hero: skeleton, poses, ribbons; the gold rim | Every pose seen in screenshots on all eleven screens |
| V4 | Type-block stones, frames, effects, the forge print and the win scroll; HUD skin | Screen budget check passes unchanged |
| V5 | Performance and readability pass, then playtest on John's phone (gate P2 questions plus: does it feel 江湖? can you still see where you are?) | **Gate V5**: ink becomes the default, or goes back to the drawing board |

**Checks added to `screen-test.mjs`**, run for both arts:

- **Contrast probe**: for each visible walkable top, sample just above and just below it; it fails
  under 3:1. The same probe runs on you against what is behind you.
- **FPS floor**: ink may not be more than 10% slower than the greybox on any of the eleven screens.
- **Pose coverage**: a screenshot of each hero pose on the phone sizes.

Rough size: V1 is one session; V2 to V4 are two to three; V5 is one, plus John's playtest.

## 7. Open questions for John

1. A or B? (Recommended: B, with the hero in a few strokes.)
2. Stones as movable type blocks (活字): yes, or keep plain tiles?
3. A sword on the hero's back (pure look, there is no combat), or none?
4. Claude Design first (style frames as the target), or V1 in code first?
