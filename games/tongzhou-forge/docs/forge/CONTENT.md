# Positional Forge: content

Characters, minimal pairs, elements and stage sketches. Every IDS below was read from MMAH
`build-pipeline/data/dictionary.txt` on 2026-11-18. Once Phase 2 exists, `tools/recipes.mjs` is the
authority and this page is a design record.

## 1. Rules for choosing characters

1. **Closed set.** Only characters in `content/glyphs.json` exist. An arrangement whose result is
   outside the set is a dud, even when it is a real but rare character (炏 kài, 仌 bīng, 吅 xuān).
   This keeps mirrors honest without asking beginners to meet obscure characters.
2. **Pieces a beginner can name.** Every piece must be a character that can stand alone and has a
   clear picture: 日 木 口 十 心 人 火 水 女 子 月 田 土 大 囗 门. Pieces such as 亡, 中, 今, 隹 and 京
   are later and optional.
3. **Every result can do something** (charter P11 "playable, not vivid": each **element** needs
   three interactions, not each character).
4. **Minimal pairs are the spice, not the meal.** At most one pair a stage relies on, early on
   (strictness knob K12).

## 2. Minimal pairs (same pieces, different place, two real characters)

Generated from the seed pieces 日 月 木 口 十 心 亡 中 人 女 子 火 水 囗 门 大 土 田 王 工 力 九 台 今 加 京 军 隹 又.
Variants are normalised (忄 = 心, 氵 = 水, 亻 = 人).

| Pieces | Arrangement A | Arrangement B | Beginner? | Game value |
|---|---|---|---|---|
| 日 木 | 日 ⿱ 木 = **杲** gǎo, bright | 木 ⿱ 日 = **杳** yǎo, dim, gone | yes | ★★★ Sunrise vs sunset; one is light, the other darkens the isle. **The G1 pair.** |
| 口 木 | 口 ⿱ 木 = **呆** dāi, dull | 木 ⿱ 口 = **杏** xìng, apricot | yes | ★★★ A fruit vs a blank face; both are funny |
| 十 口 | 十 ⿱ 口 = **古** gǔ, old | 口 ⿰ 十 = **叶** yè, leaf | yes | ★★★ Different *ops*, not just order: stack vs beside |
| 亡 心 | 亡 ⿱ 心 = **忘** wàng, forget | 心 ⿰ 亡 = **忙** máng, busy (心 becomes 忄) | mid | ★★★ The variant-form showcase |
| 中 心 | 中 ⿱ 心 = **忠** zhōng, loyal | 心 ⿰ 中 = **忡** chōng, worried | mid | ★★ |
| 今 心 | 今 ⿱ 心 = **念** niàn, miss / think of | — | mid | single, but pairs with 今口 |
| 今 口 | 今 ⿱ 口 = **含** hán, hold in the mouth | 口 ⿰ 今 = **吟** yín, chant | mid | ★★ |
| 力 口 | 口 ⿱ 力 = **另** lìng, another | 力 ⿰ 口 = **加** jiā, add | yes | ★★ 加 is very common |
| 隹 木 | 隹 ⿱ 木 = **集** jí, gather (birds on a tree) | 木 ⿰ 隹 = **椎** chuí, mallet | later | ★★ 集 is a lovely picture |
| 土 火 | 土 ⿱ 火 = **赤** chì, red | 火 ⿰ 土 = **灶** zào, stove | yes | ★★ Both fire-like |
| 工 水 | 工 ⿱ 水 = **汞** gǒng, mercury | 水 ⿰ 工 = **江** jiāng, river | yes | ★★ 江 as a water element is great for bridges and rivers |
| 日 京 | 日 ⿱ 京 = **景** jǐng, scenery | 日 ⿰ 京 = **晾** liàng, sun-dry | later | ★ |
| 日 军 | 日 ⿱ 军 = **晕** yūn, dizzy | 日 ⿰ 军 = **晖** huī, sunshine | later | ★ |
| 九 日 | 九 ⿱ 日 = **旮** gā, nook | 日 ⿱ 九 = **旯** lá, nook | later | ★ Both mean "nook", 旮旯 is a word: a joke stage |
| 隹 口 | 隹 ⿱ 口 = **售** shòu, sell | 口 ⿰ 隹 = **唯** wéi, only | later | ★ |
| 人 门 | 门 ⿵ 人 = **闪** shǎn, flash | 人 ⿰ 门 = **们** men, plural | mid | ★★ An enclosure vs beside pair |
| 火 火 | 火 ⿱ 火 = **炎** yán, blaze | (火 ⿰ 火 = 炏, rare: dud) | yes | ★★ Order of *op* only. Already in the game |
| 人 人 | 人 ⿰ 人 = **从** cóng, follow | (人 ⿱ 人 = 仌, rare: dud) | yes | ★★ Already in the game |

### Useful singles (one arrangement only)

- Stacks: 早 日⿱十 (early), 果 田⿱木 (fruit), 李 木⿱子 (plum), 思 田⿱心 (think), 吕 口⿱口,
  昌 日⿱日, 炎, 焚 林⿱火, 森 木⿱林, 众 人⿱从, 赤.
- Beside: 明 林 好 休 伙 沐 淋 朋 从 如 (女⿰口) 江 加 功 (工⿰力).
- Enclosure: 回 囗⿴口, 因 囗⿴大, 困 囗⿴木, 囚 囗⿴人, 问 门⿵口, 间 门⿵日, 闲 门⿵木, 闪 门⿵人.
- Pyramid: 品 口 on 口口, 晶 日 on 日日, 森 木 on 木木, 众 人 on 人人.

## 3. Elements and what new characters do

Existing elements: **wood** (bridges), **fire** (burns thorns), **water** (douses flames), **light**
(the pavilion's dawn palette), **folk** (none yet beyond being wanted).

| Element | New members | What it does in the world | Phase |
|---|---|---|---|
| light | 杲 早 昌 晶 | As today, plus: a light stone set down lights a dark isle (cancels dusk) | 3 |
| **dusk** (new) | 杳 | The isle dims for a while: hidden things show (glow-gems appear in the dark), but the crew sees less | 3 |
| wood | 果 李 杏 集 | Fruit and bird stones are wood too: they bridge (short span) | 6 |
| water | 江 | A long-reach douse; thrown into a gap, it becomes a stream you can't cross (an anti-bridge: wrong-but-real with teeth) | 6 |
| fire | 赤 灶 | Fire with reach | 6 |
| **frame** (new) | 囗 门 | Hollow; things go inside. 门 thrown at a wall stands up as a gate you walk through | 7 |
| **bind** (new) | 困 囚 | Thrown at a moving thing (a lift, the boat), it holds it still while the stone lasts | 7 |
| **mind** (new) | 忘 忙 念 思 | 忙 (busy): the crew moves faster for a while. 忘 (forget): the isle forgets one closed wall or gate. 念 / 思: a ghost shows where a used-up stone was | 6+ |

Rule (charter P9): effects are shown **after** a character exists, never as a promise before.
Each new element gets three interactions before it ships (the Toy Test).

## 4. Stage sketches (to be built and judged in Phases 3 to 6)

| # | Id | Want | Teaches | Sketch | Profile |
|---|---|---|---|---|---|
| 1 | `two-trees` (port) | 林 | beside, carry, bridge | Unchanged except that recipes are now ⿰ (symmetric, so nobody can get it wrong) | standard |
| 2 | `sun-and-moon` (port) | 明 | order matters on screen | 月日 is now a dud. The first taste of order, at no cost | standard |
| 3 | `rest` (port) | 休 | beside with variant 亻 | 人 morphs to 亻 in the left slot | standard |
| 4 | `dawn` (**G1 test isle**) | 杲 | stacking; mirror; dusk | One 日, one 木 (regrow on). 日 on 木 = sunrise, the pavilion opens. 木 on 日 = 杳: the isle dims, a gem glows, and you try again | standard (G1 also runs relaxed and strict) |
| 5 | `old-leaf` | 古 | same pieces, different op | 十 and 口. Beside gives 叶 (a leaf: it floats on water as a little raft). Stacked gives 古 | standard |
| 6 | `on-my-shoulders` (**G2 test isle**) | 炎 | body stacking | Two 火, a stone floor ringed by flames-to-be. The ground route is long; the body route is to stand on your friend's head and either player presses FORGE | standard |
| 7 | `the-forest` | 森 | nesting; pyramid | Three 木: nest (林, then 木 on top) or pyramid (phase 7) | standard |
| 8 | `trapped` | 困 or 囚 | enclosure | A 囗 frame; 木 inside binds a runaway lift; 人 inside is the joke | phase 7 |
| 9 | `busy-or-forget` | 忙 | variant form; mind element | 亡 and 心: 忘 makes the isle forget a gate; 忙 makes the crew fast | relaxed |

## 5. MMAH quirks (record for `tools/recipes.mjs`)

| Character | MMAH IDS | Game recipe | Handling |
|---|---|---|---|
| 昌 | ⿱日曰 | 日 ⿱ 日 | alias 曰→日 (曰 is not a game piece; the shapes read the same on a brush stone) |
| 休 伙 | ⿰亻木, ⿰亻火 | 人 ⿰ … | variant 亻→人 |
| 沐 淋 江 | ⿰氵… | 水 ⿰ … | variant 氵→水 |
| 忙 忡 怡 | ⿰忄… | 心 ⿰ … | variant 忄→心 |
| 森 众 品 晶 | ⿱X⿰YY | nest `X ⿱ (YY)`, or pyramid | nested IDS match either form |
| 束 东 | ⿻ (overlap) | none | ⿻ is not a game op; these characters are excluded |

## 6. Font and stroke data

- `vendor/MaShanZheng-subset.woff2` must contain every glyph in `glyphs.json`, plus the variant forms
  in `forms.json`. Re-subset with `pyftsubset` from the full OFL font (one-time download kept out of
  the repo, see `docs/conjure/OPEN-SET.md` §5). The smoke test checks coverage.
- `vendor/strokes.json` (MMAH, via `tools/strokes.mjs --glyphs`) is kept up to date for the dormant
  Conjure pad and for a stroke-outline fallback.
