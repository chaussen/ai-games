# Glyph cards

A **card** is the single data record that makes a character into an object. Everything else is generic code.
Cards live in `cards.json` (generated into `content.js` for browser and server, as forge-2d does).

## 1. Schema

```json
{
  "ch": "火", "py": "huǒ", "en": "fire", "tier": 1,
  "tags": ["fire", "hot", "light"],
  "form": "element",
  "verbs": { "wield": "torch", "throw": "fireball", "place": "flame" },
  "params": { "power": 1, "size": 1, "duration": 8, "speed": 1 },
  "mods": ["very", "not", "big", "small"]
}
```

- `form`: `element` `nature` `creature` `thing` `property` `modifier` `compound`.
- `verbs`: what the object **is** when wielded (held, swung or used), thrown, or placed (set down into the grid).
  Each value names a behaviour from a small shared library (torch = light and ignite what it touches; fireball =
  projectile with R1/R9 on hit; flame = a fire cell). New behaviours are added to the library, not per card.
- `params`: numbers that modifiers scale. Defaults 1.
- `look`: later (Phase 7). Early phases draw a plain flat shape with the character on it.
- Pinyin and meaning are mandatory on every card (project rule).

## 2. First cards (T0 + T1 core, 60 characters)

Tags in `[]`. Existing forge-2d characters keep their meaning; behaviours below are the new work.

**Elements** (form `element`)
火 fire [fire hot light flammable-source] · 水 water [water wet liquid] · 木 wood [wood flammable solid growing] ·
土 earth [earth solid heavy] · 金 metal [metal solid heavy hot-conductor] · 冰 ice [cold solid] ·
石 stone [earth solid heavy]

**Nature** (`nature`)
日 sun [light hot] · 月 moon [light cold] · 风 wind [wind push] · 雨 rain [water wet] · 雷 thunder [fire push] ·
电 lightning [fire light] · 云 cloud [wet airy] · 山 mountain [earth heavy solid] · 光 light [light] ·
雪 snow [cold wet] · 星 star [light] · 天 sky [airy]

**Plants** (`element`/`thing`)
木 (above) · 林 grove [wood growing] · 森 forest [wood growing heavy] · 叶 leaf [plant flammable airy] ·
果 fruit [plant living] · 杏 apricot [plant living] · 草 grass [plant flammable growing] · 花 flower [plant]

**Fire family** (`compound`) 炎 blaze [fire hot big] · 焚 burn [fire flammable-source] · 灶 stove [fire solid] ·
明 bright [light] · 昌 flourish [light growing]

**Water family** 沐 bathe [water wet] · 淋 drench [water wet] · 泉 spring [water liquid] · 河 river [water liquid] ·
海 sea [water liquid heavy]

**Bodies** (`creature`) 人 person [living] · 从 follow [living, trails you] · 众 crowd [living, several] ·
休 rest [living, sits under a tree] · 女 · 子 · 好 (cosmetic/social cards, cheer effect) · 马 horse [living ride] ·
鸟 bird [living airy] · 鱼 fish [living water]

**Things** (`thing`) 门 door [solid] · 车 cart [solid heavy rolls] · 船 boat [floats] · 刀 knife [metal cut] ·
灯 lamp [light] · 桥 bridge [wood solid] · 屋 house [wood solid] · 田 field [earth growing] · 口 mouth/opening
[hole, a gap you can pass] · 十 cross [solid, a post]

**Properties** (`property`; see MODIFIERS.md) 大 big · 小 small · 热 hot · 冷 cold · 快 fast · 慢 slow · 轻 light ·
重 heavy · 高 tall · 低 low

**Modifiers** (`modifier`) 很 very · 不 not · 太 too · 多 many · 少 few

**Forging** (existing rule): two cards forge a compound by position (`rules.js` `fuse`: 木+木 -> 林, 日+月 -> 明,
...). A compound may be written directly **or** forged; both give the same card.

## 3. Example behaviours

| Card | wield | throw | place |
|---|---|---|---|
| 火 | torch (lights, ignites) | fireball (R1, R9 on hit) | flame cell |
| 水 | water jug (pour a stream) | splash (R2, R10) | water cell |
| 木 | staff (shove) | log (knockback, floats) | seed: grows a tree (R6) |
| 土 | clod (heavy swing) | clod (R11 lands as dirt) | dirt cell |
| 金 | blade (R16 cut) | thrown blade (R16, sticks) | metal block |
| 风 | fan (push cone) | gust (R13/R14) | updraft |
| 冰 | ice shard | ice shot (R27, R8) | ice cell |
| 日 | sun lantern (light, warm) | sunburst (light R17) | sun that lights an area |
| 雷 | staff of thunder (zap) | bolt (R23) | strike at a point |
| 人 | wave (cheer) | — | a helper that follows/mimics (Phase 5) |
| 马 | ride (speed up) | — | a horse companion (Phase 5) |

## 4. Rules for adding a card

1. Fill the schema; pinyin and meaning required.
2. Assign existing tags and an existing behaviour first. If neither fits, propose a **new tag** or **new
   behaviour** in REACTIONS.md and note it in HANDOFF.md.
3. Add stroke data (RECOGNISER.md) and re-subset the font.
4. The pair test (REACTIONS.md §7) must still pass.
