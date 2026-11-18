# Idea 3: function words (particles, glue words) in the co-op world

Status: **DESIGN ONLY. Not started.** Written 2026-11-18. Needs John's review before building.

## 1. Where this comes from

The original 同舟 concept (`games/tongzhou/docs/charter-v1.md` principle **P10**, decision
**TZ-D027**, seed table in `content-seed-v1.md` §8) treated function words as **operators**: a
small closed set, authored once, that acts on another character instead of doing something alone.

| Word | Original rule |
|---|---|
| 不 bù | invert: reverses the effect |
| 很 hěn | scale: ×1.5 stronger |
| 太 tài | overshoot: far too strong, backfires |
| 吗 ma | preview: shows the outcome without spending |
| 了 le | instant: takes effect at once |
| 再 zài | repeat: repeats the last character spent |
| 也 yě | carryOver: also applies to the next thing |

When the game was merged with the Wobble Works co-op physics (2026-11-17) this was lost. This
file brings it back in a form that fits stones, throwing and co-op.

All of these are in the B1 band: 不 很 太 吗 了 再 也 的 和 把 在 给 吧 呢 没 就 都 还 又 个 只 条 张.

## 2. Core rule: content words are found, function words are only written

- Nouns and verbs are **stones** lying on the isle: found, carried, used up.
- Function words never lie around. The only way to get one is to **write it** on the phone pad.
  This gives writing a job that no found stone can do, and these characters are short and very
  common: ideal practice.
- A written function word appears as a small red **seal** (印) floating beside its writer.
  Grabbing a stone with a seal ready stamps it; the stone shows its new name, e.g. "很木 · a big tree".
  A seal can also be thrown at a bridge, a lift or a friend.
- Costs ink like any conjure. A seal not used within ~30 s fades (no hoarding).

## 3. Tier 1: operators (build first: 不, 吗, 和)

| Word | Stamped on | Effect | Why it matters |
|---|---|---|---|
| 不 | a built bridge or burned hedge | Undone: the bridge falls back into its 木 stone; the hedge regrows. | The **undo** for used-up stones: wasting a stone stops being a soft-lock. |
| 吗 | a stone, then throw it | A ghost stone flies and shows the ghost bridge / burn / fusion, and nothing is spent. | Lets the crew **ask** before spending a scarce stone. Exactly what 吗 means. |
| 很 | a stone | Stronger: 很木 spans ×1.5, 很水 reaches further. | Covers gaps one stone cannot. |
| 太 | a stone | Too strong: 太火 also burns the nearby bridge; 太木 overgrows and blocks a path. | Teaches 很 vs 太 by consequence. |
| 了 | a lift or plate-held door | Locks it in its current state ("done"). | Frees the friend stuck standing on the plate. |
| 再 | the crew (no target) | The next stone used up leaves one copy behind. | One stone, used twice. |
| 也 | a stone | Its effect also hits the nearest second target. | A double-up (two hedges at once). |

## 4. Tier 2: structure words as physical connectors

| Word | Becomes | Effect |
|---|---|---|
| 和 and | a rope | Between two players: tethered (wobble co-op chaos). Between two stones: they travel as a pair; if they form a word (火+山, 朋+友) they become a **word stone** (brings back TZ-D028, two-character words). |
| 把 grip | a handle / grapple | Thrown at a far stone, pulls it to you. Sets up the 把-construction later. |
| 给 give | a homing pass | The stamped stone flies to a chosen teammate. |
| 在 at | an anchor | Marks a spot; stranded stones float back here instead of their start. |
| 的 | a plank | Only spans between two word pedestals (see Tier 3). |

## 5. Tier 3: grammar built from the world (optional bonus pavilions only)

- **Sentence plinths**: a pavilion wants a phrase. A row of pedestals with gaps; content stones go on
  pedestals, only 的 / 和 / 了 seals bridge the gaps; the door opens when the line reads as a real
  phrase (我的朋友, 木和火, 下雨了). Word order learned by building it.
- **Measure-word carts** (个 只 条 张): carts accept only matching stones (条 long things 鱼 河 路;
  只 animals; 张 flat things). Sorting and delivery co-op; drills a classic learner headache.
- **吧 / 呢 as crew pings**: writing 木吧 shows "let's use 木!" above the writer on the board.

## 6. Rules that must hold

1. **Never required.** Every stage stays solvable without function words, like conjuring. They are
   power and expression, not keys (charter P8). Sentence plinths are optional bonus pavilions only.
2. **Show after, never before** (P9): a stamped stone shows its name and English gloss; nothing tells
   the crew in advance which seal will solve the puzzle. 吗 is the player *asking*, so it is allowed.
3. One closed list, authored once in `content/operators.json` (new), valid for every stage.
4. Deterministic in the sim, tested in `conjure-test.mjs` (or a new `particle-test.mjs`).

## 7. Sim sketch (for the strong model; not a spec yet)

- `Game.conjure(id, ch)`: if `ch` is in `OPERATORS`, create a seal `{op, by, t}` on the player
  (`p.seal`) instead of a stone. Same refusal order and ink.
- `holdStone()`: if `p.seal`, apply it to the stone: `k.mod = op`, emit `stamp`.
- Effects read `k.mod` where they already act: `gapRun(cx, cz, span * (mod === 'scale' ? 1.5 : 1))`,
  wall `reach`, etc. 吗 makes `k.ghost = true`: it runs the same checks but emits `preview` and
  never calls `consume()` or `growBridge()`.
- 不 on a bridge: new `unbuild(bridge)` removes the mover and adds a 木 stone at its centre.
- The judge's solver ignores seals (rule 1).

## 8. Order

不, 吗, 和 first: 不 and 吗 matter most now that stones are used up (one undoes waste, one prevents
it); 和 is the most fun with co-op physics; all three are early-B1 and have few strokes. Then the
other operators, then Tier 2, then Tier 3 after a separate stage-design pass.
