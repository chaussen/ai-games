# Vocabulary tiers (curated, 100-200 characters)

Decision [John]: curated tiers with hand-designed behaviours, quality over breadth. Not open-vocabulary.

## Tiers

| Tier | Contents | About | Ships with |
|---|---|---|---|
| T0 | The 36 forge-2d characters: 木林森火炎焚水沐淋日月明昌朋人从众休伙女子好杲杳口十田土呆杏果叶古早赤灶 | 36 | Phase 1C |
| T1 | Elements and nature: 金石冰山风雨雷电云雪光星天 | ~14 | Phase 1C/3 |
| T2 | Creatures and things: 马鸟鱼牛羊狗龙车船门刀灯桥屋 | ~14 (grow to ~35) | Phase 3 |
| T3 | Properties and modifiers: 大小热冷快慢轻重高低 + 很不太多少 | ~15 (grow to ~25) | Phase 2-3 |
| T4 | More compounds and phrases (forge or write). **Proposed set (Phase 1B, recogniser-ready, no cards yet):** 江河湖海泉池波洗洒泪汗游泳 (water) · 灰炭烛烟 (fire) · 花草苗枝竹 (plant) · 坡坝墙 (earth) · 针钉锁镜 (metal) · 雾虹霞 (sky) · 伞网舟贝 (things) · 虫蛇鹿燕 (creatures) · 爸妈哥弟 (people) | 44 proposed | after |

Total 100-200 once all tiers are in. **The architecture test: every tier after T1 is a content-only drop** (a
cards.json addition, stroke data, font re-subset; no engine code). If a tier needs engine code, the engine
design is wrong; fix the tags.

## Choosing a character (criteria)

1. **Visible effect** first (John, earlier memory: after balance, the count of makeable characters with obvious
   visual effects is the key).
2. A **simple structure** (few strokes) early, so children can write it; harder characters later.
3. **Distinct from look-alikes** already in the set, or mitigated (RECOGNISER.md).
4. Teaches something real: common characters from the school's curriculum (学字坊 level lists may guide, but the
   game never imports from 学字坊 files; copy a list of characters, not code).
5. A clear mapping onto an existing tag, or a good reason for a new tag.

## Unlock order

Open question for Phase 2: free for all, or earned in the Almanac. Default until decided: **everything in the
tier set is writable from the start** (free play), with the pad showing only characters whose tier is enabled
for the room (a room/profile knob), so a teacher can run a T0-only session.

## Font and data per character

Add: card (GLYPH-CARDS.md), stroke data (RECOGNISER.md), font subset (forge-2d `tools/font.py` pattern), and a
row in the Almanac list. Pinyin and meaning on the card are mandatory.
