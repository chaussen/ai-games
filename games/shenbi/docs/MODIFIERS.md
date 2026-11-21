# Modifiers (很 and friends)

Idea from John: "add 很 to some adjective to enhance it." A modifier is a card that, written **before** (or
forged beside) another card, produces a **derived card** with changed `params` and sometimes flipped tags.
Derivation happens once, at write time; the derived card then behaves like any other card.

## 1. Mechanism

`derive(mod, card) -> card'` is pure and deterministic. A modifier lists `mods` it accepts on cards (GLYPH-CARDS.md
`mods`). Writing a modifier puts it in hand as a "pending modifier" chip; the next card written or the card in the
other hand is transformed. The Almanac records `很+火`. The result shows both characters with pinyin and meaning
(`很火 hěn huǒ, very fire`).

## 2. v0 modifiers

| Mod | Meaning | Effect on params | Tag effect |
|---|---|---|---|
| 很 hěn very | intensify | power x2, size x1.5, duration x1.5 | none |
| 太 tài too | overdo | power x3, but unstable: duration x0.5, `kick` (it shoves the holder) | adds `unstable` |
| 不 bù not | negate | none | flips: fire<->water pair (not-fire = douse zone), hot<->cold, light<->dark, solid<->hole (see table) |
| 大 dà big | scale | size x2, mass x2 | none |
| 小 xiǎo small | scale | size x0.5, speed x1.3 | none |
| 多 duō many | count | spawns 3 copies in a fan | none |
| 少 shǎo few | count | duration x2 (lasts longer, one) | none |

`不` negation table (v0): 火 -> an anti-fire zone (extinguishes cells and bodies in radius, no steam), 水 -> a
drying zone (water cells vanish), 热 -> 冷, 冷 -> 热, 光 -> 暗-zone, 重 -> 轻, 快 -> 慢. Anything not in the
table: "the brush doesn't know how to un-write that yet" and the pad keeps the modifier in hand.

## 3. Adjective cards as modifiers

Adjectives (大 小 热 冷 快 慢 轻 重 高 低) work the same way, with fixed (not x2) effects: 冷 + 水 -> 冰 (derived
ice card, not a new character); 热 + 水 -> steam; 大 + 木 -> big tree seed; 重 + 木 -> heavy log. The **tier
system** (VOCAB-TIERS.md) introduces adjectives only in T3, because the grammar is the harder lesson.

## 4. Stacking and caps

- 很很火: allowed, capped: modifier stack depth 2; `power` cap 4; duration cap 3x. Capping prevents runaway
  (REACTIONS.md §6).
- 太 cannot be combined with 很 (both intensify); the second is ignored with a gentle "same direction" note.
- 不不火: cancels (a joke the Almanac records).

## 5. Worked examples

1. Write 很, then 火: `很火` fireball, radius 1.5x, burns 1.5x longer, R1 spreads at double rate.
2. Write 不, then 火 and throw it at a burning tree: the anti-fire zone puts it out (no steam).
3. Write 冷, then 水 and throw it at a lake: the surface freezes to ice (R8); players can walk over it.
4. Write 多, then 水: three splashes in a fan; one hits a friend (R10: soaked, harmless).
5. Write 大, then 木, place it: a tall tree (R6 with size x2, height cap applies).

## 6. Tests

- Algebra: `derive` is deterministic; stack caps hold; `不不` cancels; unknown pairs fall back with a message.
- Every derived card passes the pair test.
- The Almanac records each derivation once.
