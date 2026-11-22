# Elements: the full catalogue (input for rules, art and level design)

Everything an isle may contain, what answers it, what the wrong answer costs, and how it must look. The level agent
designs only from this list; the rules agent implements exactly this list; nothing else appears in a level.
Specs for behaviour are in `RULES-SPEC.md`; this doc says *what exists and why it is meaningful*.

## 1. The organising idea: five elements and light

John accepted "wood makes a bridge": the character's meaning *is* the tool. To make that systematic, the game adopts the
Chinese five elements (五行) as one learnable frame, plus light. The **controlling cycle** (相克) gives every element a
natural counter, so answers feel inevitable once known, and wrong answers cost something real:

```
水 water  puts out   火 fire        (existing: flames)
火 fire   melts      金 metal       (new: iron bars; burns wood and thorns too)
金 metal  chops      木 wood        (new: wooden gates; cuts a bridge or trunk)
木 wood   roots split 土 earth      (new: boulders; plants grow where earth is)
土 earth  dams       水 water       (new: currents; smothers flames; washes away in water)
```

Light (日 月 明 …) is the safe element: it removes shade and reveals dusk-only gems, and never harms anything.
Folk (人 从 众) are the sixth family: people carry, lift and push. Weather (云 风 雨) is air and sky.

## 2. Cells: terrain and obstacles

Existing cells keep their meaning. New cells are marked **new**. "Answers" lists what solves it; "wrong" lists what costs.

| Cell | Name | Answers | Wrong / cost | Why it makes sense |
|---|---|---|---|---|
| `.` | air | | | |
| `#` | rock | | | solid |
| `~` | water (river) | 木 bridge (span 3/5/7 by glyph); leap if short | fall in: back to safe ground | |
| `_` | gap a wood or earth stone fills | 木 grows a bridge; 土/田 raises a mound | 火 near a bridge burns it; 水 near a mound washes it | |
| `T` | thorn hedge | 火 burns | burns 木 nearby | thorns are dry brush |
| `F` | wall of flames | 水 douses; 土 smothers | stone spent either way | |
| `S` | wall of shade | light shines | | |
| `b` | boat deck | | | |
| `C` **new** | sheer cliff | build glyphs at its foot: 木 林 森 trunk, 土 田 ramp, 山 peak, 人 从 众 ladder, 云 lift, 风 updraft | stacking inert stones slides you off; leaping gets no wall refill | a smooth face has no holds; you need a tree, a slope, a ladder of people, or the sky |
| `R` **new** | boulder | 火 then 水 cracks it; 木 roots split it slowly; 2+ players push | fire alone only scorches; water alone only wets | thermal shock; roots in rock |
| `D` **new** | wooden gate | 金 chops; 火 burns | fire also burns nearby wood (a bridge); 金 chops nearby wood too | metal on wood |
| `M` **new** | iron bars | 火 melts | | heat softens iron |
| `L` **new** | ember field | 水 makes a steam crossing for 3 s; 土 covers it for good | walking in throws you back | embers hiss under water |
| `W` **new** | current / waterfall | 土/田 dams it; 石 holds a stone in it | stones and loose players drift downstream | dams stop rivers; a rock holds against the stream |
| `V` **new** | updraft vent | a 风 stone beside it lifts you; 云 lasts longer | | wind needs wind |
| `w` `e` **new** | built wood / earth | (made by builds) | `w` burns, `e` washes away | |

Dropped: a "门 gate" glyph (a stone that opens a gate) was considered and cut: the gate is an obstacle (`D`) and
answered by metal or fire, not by a word that merely "opens" things. The loose cloud pickup is removed (R6).

## 3. Glyphs

### 3.1 Existing 36 (keep, add `bear` and `build`; reach and span unchanged)

| Family | Glyphs | `el` | Role after upgrade |
|---|---|---|---|
| Wood | 木 林 森 | wood | **bearing**, `build: trunk` h 3/5/7; bridges span 3/5/7; burns |
| Wood (forged) | 杏 果 叶 | wood | span 3 bridges; inert (not platforms) |
| Fire | 火 炎 焚 赤 灶 | fire | `light 点` agent; reach 1.3 (炎 焚 2.6); inert |
| Water | 水 沐 淋 | water | `pour 泼` agent; reach 1.3 (淋 2.6); inert |
| Light | 日 月 明 昌 朋 好 杲 早 | light | `shine 照` agent; reach 1.3 (明 昌 杲 2.6); inert |
| Earth | 土 田 | earth | **bearing**, `build: ramp` h 2/3; fills gaps; smothers flames |
| Folk | 人 从 众 | folk | **bearing**, `build: folk` (stack of up to `BEAR.stackMax`, drawn as people) |
| Folk (other) | 休 伙 女 子 口 十 呆 古 | folk | inert pieces for recipes. 口 十 are exactly the "stepping stones" John flagged: they must never carry height |
| Dusk | 杳 | dusk | sets dusk; inert |

### 3.2 New glyphs (6; all have stroke data in `games/shenbi/vendor/strokes.json`, to be copied, never imported)

| Glyph | Pinyin | Meaning | `el` | `bear` / `build` | Role | Appears as |
|---|---|---|---|---|---|---|
| 金 | jīn | metal | metal | no | `chop 砍` agent for `D`; the fifth element, missing today | a stone on isles that have gates; writable |
| 云 | yún | cloud | air | lift | set it and stand on it: rises 4 s, then disperses; replaces the loose clouds | a stone near high cliffs; writable |
| 风 | fēng | wind | air | gust | updraft column 5 s; powers vents `V`; floats thrown stones | stone beside vents |
| 石 | shí | rock | earth | **bear**, `anchor` | immovable bearing stone; holds in currents `W`; weighs down | a stone on water isles |
| 山 | shān | mountain | earth | **bear**, `peak` h 5 | at a cliff foot raises a stepped peak; the strongest earth builder | rare, one per few isles; writable on later isles only |
| 雨 | yǔ | rain | water | no, reach 2.6 | water agent with reach 2.6; also forged: **云 on 水 makes 雨** | forged, or lies on water isles late in the game |

Recipe added: `['⿱', '云', '水', '雨']` (云 above 水 is rain). Optional later: 山 = 石 on 石 was rejected (not a character
decomposition). Every new glyph needs: pinyin + meaning in `content.js`, strokes in `vendor/strokes.json` (via
`node tools/strokes.mjs --glyphs` after adding to content), a font-subset rerun (`tools/font.py`, the smoke test fails
otherwise), a stone drawing in `things.js`/`ink.js`, and recogniser coverage at the accuracy bar in `TEST-SPEC.md` §6.

## 4. Biomes (an isle's identity beyond its goal)

Each isle declares one `biome`; it chooses palette, props, backdrop and which obstacles dominate. The five elements give five biomes,
so even with the same recipe two isles look and play differently.

| Biome | Look (ink) | Terrain and props | Dominant obstacles | Tools that lie there |
|---|---|---|---|---|
| wood 木 | green wash, pines, bamboo | groves, trunks, mossy steps | thorns `T`, wooden gates `D`, gaps | 木 火 金 |
| fire 火 | ochre and vermilion, cracked ground, smoke | ember fields, lava cracks, kilns | flames `F`, embers `L`, boulders `R` | 水 土 火 |
| water 水 | blue-grey, mist, reeds | wide rivers, waterfalls, wet cliffs, stepping islets | currents `W`, wide gaps, flames on the far bank | 木 土 石 水 |
| earth 土 | warm brown-grey, terraces | tall cliffs `C`, boulders, ramps, ruins | cliffs `C`, boulders `R`, iron bars `M` | 土 山 人 木 |
| light 光 | pale gold / night blue, lanterns | caves and overhangs, shade, glow gems at dusk | shade `S`, dusk | 日 月 云 风 |

Biome order is a teaching ramp (`LEVEL-BRIEF.md` §6), not random. Dusk or night remains `pal`.

## 5. First-appearance rule (R6)

A mechanic is introduced **in sight, on a calm stretch, with its tip naming it**, once, before any isle requires it, with
a harmless first example where failing costs nothing (a short cliff `C` of height 3; a single `D` gate with the 金 lying
next to it; one `W` stream 1 cell wide). The isle tip uses the form: "<glyph> <pinyin> <meaning>: what it does." Examples:
"金 jīn metal chops wood: set it to the gate." "云 yún cloud lifts you: set it and stand on it." No hint arrow after the
first isle that uses it (standard); strict mode removes hints.

## 6. How things look and move (for the art agent)

All in the **ink** look (and greybox for testing). One Stroke is obsolete and not drawn (`OBSOLETE-ONE-STROKE.md`).
Rules for every element: draw the *thing*, with the character on a small vermilion tag (see `things.js`, flat fills, no alpha
tints, no large gradient per frame, bake bands). The telegraph (R2) is the art's main job:

| Event | Telegraph in ink |
|---|---|
| 水 poured/thrown on flames | water arc, white steam bursts at the flame cells, flame tongues shrink downward over `REACT.dur` |
| 火 on thorns | the stone becomes a fireball, thorns blacken from the near end, ash drifts |
| light on shade | beam from the stone, the wash lifts like paper being peeled up |
| 金 on gate | a clean chop mark, splinters, the gate leans and falls |
| 木 at a cliff foot | sprout, trunk climbs the face and branches fan out in one 1.2 s growth |
| 土 / 田 ramp | earth wells up from the ground in a stepped slope |
| 云 lift | a cloud forms under the player and rises; tapers when time is nearly over |
| collateral | the bystander flashes and the one-line message names both |

One message line per reaction: "水 shuǐ water puts out 火 huǒ fire." Pinyin and meaning always accompany Chinese text.
Sound: a distinct short sound per element (hiss, whoosh, chop, creak, rumble, wind); `app.js` audio has the voice/sound hooks to extend.

## 7. Open questions (do not block phase 1; decide in playtest)

- Do `W` currents carry the *player* or only stones? Start with stones only; players are pushed lightly.
- Should 山 be writable at all on early isles (it makes cliffs trivial)? Default: only on isles 17+; on earlier isles it is not in the writable set.
- Is `M` iron bars worth the art? It gives fire a second target; keep if the level agent needs it, else drop.
