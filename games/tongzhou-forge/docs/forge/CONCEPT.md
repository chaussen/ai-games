# Positional Forge: concept

Date: 2026-11-18. Status: **design, no code yet**. Read this first, then `DESIGN.md`.

## 1. The question this answers

The 同舟 charter's oldest test is the **reskin test**: swap every Chinese character for a sprite.
If the game plays the same, the Chinese is decoration.

Today's Glyph Isles fails it. Fusion is "two stones within 0.95 units, order does not matter"
(`sim.js` `stepFusion`, `levels.js` "Order does not matter"). 木 + 木 = 林 works just as well as
🌲 + 🌲 = 🌳. The stones could be any icons.

The charter already had the answer. Decision **TZ-D044** (2026-11-12, LOCKED) says: *the second
tile's position relative to the first is the structure*. It was lost when 同舟 merged with Wobble
Works physics (`tongzhou-isles`) and has not come back since.

## 2. The idea

Chinese characters have **positional grammar**: the same pieces in different places make different
characters.

| Pieces | Arrangement | Character |
|---|---|---|
| 日 木 | sun **above** tree | 杲 gǎo, bright (sunrise) |
| 日 木 | tree **above** sun | 杳 yǎo, dim, vanished (sunset) |
| 口 木 | mouth above tree | 呆 dāi, blank, dull |
| 口 木 | tree above mouth | 杏 xìng, apricot |
| 十 口 | 十 above 口 | 古 gǔ, old |
| 口 十 | 口 **beside** 十 | 叶 yè, leaf |
| 亡 心 | 亡 above heart | 忘 wàng, forget |
| 心 亡 | heart beside 亡 (心 becomes 忄) | 忙 máng, busy |
| 囗 木 | tree **inside** an enclosure | 困 kùn, trapped |

In the game, the arrangement is made **in the world**, with stones and with bodies:

- **Beside**: left and right *as seen on the screen*.
- **Above**: stacked. A stone rests on a stone, or a player stands on a friend's head.
- **Inside**: a stone goes into a hollow frame stone (囗, 门).
- **Co-op body forging**: each player holds a piece and the crew stands in formation. Any of them
  can trigger the forge, and the new stone goes to whoever triggered it.

### Why it passes the reskin test

With sprites, "A on B makes X, B on A makes Y" is an arbitrary shaped recipe that players have to
memorise. With characters, **the result looks like what you built**: stack 日 on 日 and 昌
appears, and 昌 *is* that stack. The output records the arrangement. Remove the Chinese and the
rule becomes arbitrary, so the Chinese carries weight.

Closest precedent: Minecraft's shaped crafting grid, which proves shape-based recipes are fun.
The difference here is that the grid is the world and the crew's own bodies, not a menu.
Pico Park's player-stacking proves bodies-as-structure is a strong couch co-op toy.

## 3. The governing principle: the middle point

> Grammar is strict. Forging play is meant to be relaxed. The game lives at the middle point between
> them, and finding it will take tuning iterations. (John, at plan approval, 2026-11-18)

This is the central design problem, not a detail:

- **Too strict**: every wobbly landing is a dud, players feel tested, and the toy dies.
- **Too relaxed**: position stops mattering, and the game fails the reskin test again.

The pressure shows up in many technical places: the classifier's tolerances, snapping, order
sensitivity, what a dud costs, what a wrong-but-real character costs, formation tolerance in body
forging, how stages mix strict and loose checks, and even the judge, whose bots have perfect hands.
`DESIGN.md` §2, the **Strictness map**, lists every place this pressure appears as a named knob,
and `PLAYTEST.md` describes the loop for moving those knobs.

The starting hypothesis, to be proven or broken in playtest:

> **Forgive the hand, not the grammar.** Help players put a stone where they meant to put it
> (snapping, generous cones, clear placement labels). Do not change what that placement means.
> Where the grammar is forgiven (a stage profile may allow it), show it happening, never hide it.

## 4. Pillars

1. **The arrangement is the character.** What you build in the world is what you read on the stone.
2. **Trying is free.** A wrong arrangement costs nothing. The stones stay, and you try again.
3. **Any hand can finish it.** In a formation, any participant can trigger the forge.
   Nobody's role is only to stand still.
4. **Relaxed hands, honest grammar.** See §3.
5. **Show after, never before** (charter P9). No outcome previews and no near-miss shimmer
   (decided 2026-11-18). Placement labels (BESIDE / ON TOP / INSIDE) describe the hand's action,
   never what it will make.

## 5. What carries over from 同舟 and Glyph Isles

One boat and one crew; no lose state; the pavilion wants one character; stones are used up
(with a per-stage `regrow` fallback); bridges, burning and dousing; boost, leap and plates;
the judge plays every stage in the real sim; English first, and every character shows its pinyin
and meaning; the phone controller and TV board; LAN, no install, no CDN.

## 6. Out of scope

- Handwriting or Conjure. The code stays in this copy but is dormant: no forge stage lists
  `conjure`, and nothing new depends on it.
- Learning metrics, SRS and scores. This is a game-feel project; the learning comes along with play.
- Open character sets. The set is closed and hand-picked (`CONTENT.md`).

## 7. Where things are

| Doc | What |
|---|---|
| `DESIGN.md` | The rules, the strictness map, edge cases, open questions |
| `SPEC.md` | Exact data formats, constants, functions, events, wire, judge |
| `CONTENT.md` | Characters, minimal pairs, elements, stage sketches, MMAH quirks |
| `PLAYTEST.md` | Gates G1 and G2, the tuning loop, what to log |
| `ROADMAP.md` | Phases, cards, status, progress log, decision log |
