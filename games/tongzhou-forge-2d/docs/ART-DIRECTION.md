# Art direction plan: 水墨江湖 · ink jianghu

Status: **ink look built and the default** (2026-11-19, §8), from Claude Design's boards. Decision FG-D020. John answered §7 the same day (see
§7): both styles as a comparison, no sword, and Claude Design goes first, so **code waits for
Design's frames**. He added one idea: stones show the thing they mean (§3.7). A paste-ready brief for
Claude Design is `docs/ART-BRIEF.md` (with an addendum for §3.7); round 2 (One Stroke, fixed tiles and
the 字/物 sheet) is `docs/ART-BRIEF-ONE-STROKE.md`.

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

The rest of this plan is B. **John wants both built as a comparison** (§7), so A is drawn too and
both stay behind the art switch; every part below (the hero, the stones, §3.7's objects) is made in
both styles.

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

> **Superseded 2026-11-20:** John redesigned the hero (bun and hairpin, no hat, four players with their own colour and
> hairstyle). The build follows `docs/design/Hero.dc.html`; the list below is the original plan.

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
- **No sword, no weapon** (John: the children already ask for weapons; maybe later). Hands stay
  free for carrying.

### 3.3 The stones: movable type (活字), and fixed tiles

John: **some are movable and some are tiles**, like other platform games. Two looks, never confused:

- **Movable stones** are type blocks (below): light, raised glyph, a paper slip with the pinyin. You
  can carry them.
- **Fixed glyph tiles** are carved into the rock itself (阴刻, the glyph cut into a dark face, inked in
  its element colour): part of a wall, a step or a tower top. You cannot lift them, but you can set a
  movable stone beside or on top of one to forge. This is a **rules change** (today every stone is
  movable): a fixed piece in the stage data, the forge check accepting it as a partner, and a puzzle
  shape that comes from it (the 日 carved high on a cliff: bring 月 up to it). It goes through
  `sim.js` and `sim-test.mjs` like any rule, and is planned in its own short note before code.

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

### 3.7 字 and 物: a stone shows the thing it means

John: *"mu is a tree. see a person carrying a tree … or throwing a wood away. this mimics the
original 2d version that i can summon planks and objects to block road."* In the earlier isles game a
character became its thing (木 grew a plank bridge). Here the stone keeps its glyph and **shows its
thing whenever it is doing something**. It is the same rule as "visible characters first": the
meaning is seen, not only read.

**The rule that keeps it readable: at rest it is always the block.** Lying on the ground, beside or on
top of another stone, it is a square block, because BESIDE and ON TOP are read from squares and
nothing may look bigger or more walkable than it is. Its thing appears only **in your hands, in the
air, and when it acts**. The glyph never disappears: on the object it sits on a small vermilion tag
(like a seal on a scroll), big enough to read at 30 px.

**The words stay too** (John, 2026-11-19: *"we can still see the character, pinyin and meaning
right?"*). Yes, and it is a rule: the glyph is on the tag; **pinyin and meaning are on the word card**,
which already follows the stone you carry. When you throw it, the card must **keep that stone until it
lands** (today it jumps to the nearest stone lying on the ground, so this needs a small change in
`pickCard`). At rest the block has its pinyin slip, as now.

Two levels; build the first, then the second:

| Level | When | What you see | Cost |
|---|---|---|---|
| 1 · moments (easy) | thrown, dropped, acting | Leaving your hands, the block **opens into its thing** in the air (a spinning log, a ball of fire, a splash of water, a little sun) and **folds back** into the block as it lands. Acting, it becomes the thing for real: 木 in a gap grows into a plank bridge, 土 into a mound, 火 burns the hedge, 水 puts out flames, 日 lights the shade | Renderer only. The sim already sends `throw`, `bridge`, `place`, `thud` and the wall events |
| 2 · carried (harder, more fun) | while you carry it | **You carry the thing**: a whole small tree on your shoulder, a torch held out in front, a water jar hugged to the chest, a sun disc held up (lighting the night around you), a moon lantern. The hero gets one carry pose per kind of thing instead of the single overhead pose | One pose per kind on the hero's skeleton, and the size limit below |

**The things, by element** (current stones in bold, forged ones too):

| Glyph | Carried | Thrown | Acting |
|---|---|---|---|
| **木** wood | a small tree over the shoulder (roots and leaves) | a log turning end over end | planks laid across the gap, rope-tied (the bridge) |
| **火** fire | a torch held out | a fireball with a short tail | the hedge catches and burns away |
| **日** light | a bright disc held up, warming the colours nearby | a sun arcing over | the shade melts back |
| **月** moon | a crescent lantern | a crescent spinning | (no action yet) a soft glow where it lands |
| 水 water | a jar hugged to the chest | a splash in the shape of the glyph | the flames hiss out |
| 土 earth | a basket of earth on the back | a clod | a mound rises in the gap |
| 明 / 杲 / 杳 (forged) | 明 a bright lamp; 杲 a sun caught in branches; 杳 a dark tree with the sun under it | as carried | carried to the pavilion, it is offered as the thing, then printed (§3.3) |

**Size limit**: a carried thing may stick out at most about half a stone beyond the hero, so it never
hides the landing shadow, a ledge you are aiming for, or the HUD. The collision box stays the stone's
square: the tree on your shoulder does not hit walls.

**Not in this plan**: throwing 木 to **build a wall that blocks a road**, as in the earlier game. That is
a new rule (a thrown stone becoming terrain), so it is a game idea for after the art, with its own
plan.

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
| V4 | Type-block stones, frames, effects, the forge print and the win scroll; HUD skin; **字/物 level 1** (things in the air and when acting) | Screen budget check passes unchanged |
| V4b | **字/物 level 2**: carry poses per kind of thing (tree, torch, jar, disc, lantern) | Each carried thing seen in screenshots on the phone sizes; landing shadow never hidden |
| V5 | Performance and readability pass, then playtest on John's phone (gate P2 questions plus: does it feel 江湖? can you still see where you are?) | **Gate V5**: ink becomes the default, or goes back to the drawing board |

**Checks added to `screen-test.mjs`**, run for both arts:

- **Contrast probe**: for each visible walkable top, sample just above and just below it; it fails
  under 3:1. The same probe runs on you against what is behind you.
- **FPS floor**: ink may not be more than 10% slower than the greybox on any of the eleven screens.
- **Pose coverage**: a screenshot of each hero pose, and each carried thing, on the phone sizes.

Rough size: V1 is one session; V2 to V4 are two to three; V5 is one, plus John's playtest.

## 7. Questions and John's answers (2026-11-19)

1. A or B? **Both, as a comparison.** Both get built and stay switchable (`?art=cut | ink | greybox`).
2. Stones as movable type blocks? **Some movable, some fixed tiles like other games** (§3.3: movable
   = type blocks, fixed = glyphs carved in the rock; the fixed ones need a rules change).
3. A sword? **No.** The children already ask for more weapons; maybe in the future.
4. Claude Design first, or V1 in code? **Design first: John has handed the brief over. Code waits
   for Design's frames**, then V1 draws them in canvas.
5. (New) Stones show their thing: §3.7. Level 1 with V4, level 2 right after.

## 8. What shipped (2026-11-19) and what is still missing

Claude Design delivered eight boards for direction B (copied to `docs/design/`: two style frames at
night and one at daybreak, the hero pose sheet, the stone, the palette, the HUD skin, the win
scroll; tokens in `docs/design/tokens.json`). They are drawn in canvas in **`ink.js`**, the
default look; the greybox stays as `?art=greybox` and ☰ → Look.

**Built, matching the boards**

| Part | As built |
|---|---|
| Landscape | Sky wash and moon (or low sun at daybreak); 平远 far band and 深远 middle band of karst pillars (hemp strokes, pines, cloud wisps), each over a sea of mist; the 留白 mist band; the play layer in full ink with axe-cut texture kept out of the top of every walkable cell, a bare-silk rim on tops and a thinner one on cliff faces; the river as Ma Yuan line patterns with a crest and the moon's reflection; silk grain and an aged edge on the far layers |
| Built things | The pavilion (upswept eaves edged in gilt, finial, lantern, the wanted character as a gilt-dashed ghost above it, a faint gilt beam kept for finding it); the 乌篷船 boat with its awning and punt pole; thorn hedges as ink bushes with ochre berries and no rim; plank bridges with rope lashings; 轻功 clouds as 祥云; gems as jade discs |
| Hero | All eight poses from the pose sheet (stand, a two-frame run, jump, 轻功 leap, wall push, carry, land, fall) as brush paths, ribbons that flutter with speed, the gamboge rim drawn as a fattened copy of the same strokes. **The sword line on the boards is left out** (John: no weapons) |
| Stones | 活字 type blocks (face, grain, bevel, raised glyph with an umber shadow) inside the stone's exact box, and a tilted paper slip with the pinyin |
| Effects | 墨晕 ink ring on a leap, a dry-brush wisp trail, landing dust, the forged character printed in vermilion with a 印 seal |
| HUD | Mounted paper cards with an azurite brocade band; the goal card in ink, vermilion with a 成 seal once the character is made; the message as a paper strip with cut ends, glyphs in element colours; brushed 三 menu; 圆相 ensō stick; ink-stone JUMP rimmed in gamboge; 58 px paper GRAB, gilt for 献; the win sheet as the scroll's end with a colophon (character, pinyin, meaning, its two parts, a vertical line such as 日月为明, a 同舟 seal) |

**Checks** (`screen-check.py`, both looks, eleven screens): the screen budget, real touch, and a
**contrast probe** at every visible walkable top (ink 11:1 on phones and iPads, 4:1 on two laptops
where the top meets the darker sky; greybox 4.4:1; the floor is 3:1). **Frame rate**, headless
Chrome at the same moment: ink 61 fps on every phone and iPad and on two laptops, 50 on the 13" Mac;
the greybox 42 to 61. The first ink build ran at 5 fps: big gradient fills and stretched image
copies are slow to rasterise without a GPU, so the sky, both mountain bands, the mist band and the
river's wash are painted once and copied unscaled (rules in `AGENTS.md`).

**One Stroke 一笔 built (2026-11-19, same day).** Claude Design's round 2 boards (copied to
`docs/design/one-stroke/`; its hand-off had no `tokens.json`, so `tokens.json` there is written from the
Palette board) are drawn in canvas in **`cut.js`**, behind `?art=cut` and ☰ → Look: paper, ink and
vermilion; sky in the isle's one accent (moon-night blue-grey, daybreak yellow); far triangles and two
bands of arches on one shared baseline; scale-arc river; solid-ink play layer with a bare-paper line inside
every walkable top and cut dashes on cliff faces only; thorns as black triangles; the boat, plank bridge
(with a vermilion tag) and pavilion as cut paper; the hero as nine stroke poses in Design's own
viewBox with the gamboge rim and vermilion sash; stones as paper squares in a notched ink border with a
pinyin slip (forged characters keep a vermilion glyph); the HUD and win as vermilion/paper slips with cut
corners and a seal. The forge presses a vermilion seal. Checks (`ART=cut node screen-test.mjs`): the
screen budget on eleven screens, 60 fps everywhere, contrast at walkable tops 14.7:1 (3.6:1 on the two laptops
where the top meets the darker sky).
Not drawn: the empty-hands word card, the dotted stick line when pushed, the fixed tile board and the
carried things (below).

**Built: §3.7 level 1 (things in the air and acting), both painted looks.** `things.js` draws six things
(木 log, 火 fireball, 日 sun, 月 crescent, 水 splash, 土 clod; forged characters stay blocks). A thrown stone
opens into its thing right after it leaves your hands and folds back into the block as it nears the ground;
the glyph rides on a vermilion tag. When 木 bridges a gap or 火 burns a hedge, the thing shows for half a
second where it acts. The word card keeps the thrown stone until it lands (`pickCard`). Flat fills only, no
alpha, so it is safe in One Stroke. Evidence: `screenshots/cut/things-thrown.png`, `screenshots/things-thrown-ink.png`
(a stone pinned in the air, from the running build). The sim is untouched.

**Built: §3.7 level 2, carried things (steps 1 and 2 of `docs/CARRIED-THINGS.md`).** A held 木 火 日 月 shows its
thing instead of the block: a tree over the shoulder, a torch held out, a sun held up, a crescent lantern. One
Stroke has the three poses from Design's boards (`shoulder`, `hold`, overhead `carry`); the ink look keeps the
overhead pose with the thing standing on the hands. The tag stays upright when you face left. Renderer only.
Evidence: `screenshots/cut/carried-things.png`, `screenshots/carried-things-ink.png` (each thing, facing right
then left, from the running build).

**Not built yet**

1. **§3.7 level 2, remaining parts** (`docs/CARRIED-THINGS.md`): the 水 jar and 土 basket (Design drew no boards for
   them; still the block overhead), the ink look's own hold/shoulder poses, and the 日 night light (step 3).
2. **Fixed glyph tiles** carved in rock (§3.3, `Stone.dc.html`): a rules change, its own note first.
3. Acting for 水 (puts out flames), 土 (mound), 日 (melts the shade) and the 月 glow: their things are drawn
   (thrown), but only 木 and 火 flash when they act.
4. Forging is a vermilion print and a seal, not yet the stroke-by-stroke brushing; the win does not
   roll the scroll on.
5. Design's two Latin faces (Alegreya Sans, Cormorant Garamond) are not vendored: the page uses the
   system face and Georgia italic for the meaning on the win scroll.
6. Nobody has played the ink look on a phone: gate V5 (John's playtest) decides whether it stays the
   default.
