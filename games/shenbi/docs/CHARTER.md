# Charter

Written 2026-11-22 from a planning session with John. Binding decisions are marked **[John]**.

## 1. Intent

Something open and free where Chinese characters turn into real objects that interact with the game world and
with players. The key idea is 神笔马良: **writing makes things**. Compare Minecraft: many different ways to work
with objects. The difference: the objects come from writing characters, and they can be wielded, thrown, and
they cause effects.

Layers: (1) writing = learning, (2) things come alive = fun, (3) free choice = solve puzzles or just play, e.g.
throw fire at each other, add 很 to an adjective to strengthen it. A level target can remain, but the world is
free to explore on the basis of Chinese writing.

## 2. Decisions

- **[John] New folder, new codebase** `games/shenbi/`. Tongzhou stays frozen as reference. Do not archive it.
- **[John] 2D side view, grid-like world.** Not 3D. Not Inkblade-style free placement; a grid/cell world is fine.
- **[John] Curated vocabulary of ~100-200 characters** with hand-designed behaviours, in tiers (VOCAB-TIERS.md).
- **[John] Co-op is a must.** The sim is server-authoritative with 1-4 phones from day one. Solo = a crew of one.
- **[John] PvP on by default, but it is play, not fighting.** See §4.
- **[John] Simplicity first.** The key is free-style objects, not the Inkblade look. No cut-paper look, no ink
  droplet transit in early phases. Look and feel comes later (§6, Phase 7).
- **[John] Focus first on the reaction engine and the recogniser.** They are the real challenges.
- **[John] Writing pad: reduce interruption**, design left to the builder. Decision in §5.
- **[John] Docs are committed and pushed** so other agents and sessions can pick up.
- Name: **Shenbi / 神笔** (working; John said low priority, builder decides). Easy to rename.

## 3. Scope

In: the sandbox, the reaction engine, glyph cards, modifiers, the Almanac, the recogniser at 100-200
characters, co-op crew, playful PvP, optional puzzle isles later.
Out for now: 3D, open-vocabulary recognition (any character), accounts, saving to a cloud, art polish, audio.

## 4. Playful PvP

Players can aim effects at each other. No HP bar, no death, no loss. Effects on bodies are comic and reversible:
knockback; soaked (water); singed and hopping (fire, wears off); chilled and slow (ice, short); stuck in mud;
blown by wind; crowned with a small tree (wood). A knob table `BODY` (off / playful / rough, default
`playful`) generalises forge-2d's `BODY.knock`. Each player has a visible **calm** toggle to stop being a
target. Nobody can be trapped: a visible way back to spawn always exists (no restart-only soft-locks).

## 5. The writing pad (decision)

Not a modal. Tapping 书 opens a small **docked pad** in a screen corner (about a quarter of the width in
landscape). The world keeps running. After a short pause the recogniser offers the top three as **chips beside
the pad**, each with pinyin and meaning. One tap puts the object in hand and clears the pad for the next
character, so chained writing (很, then 火) needs no reopening. The pad collapses to a thumb-sized chip. Ink,
cooldown and pool knobs (own/crew; relaxed/standard/strict) carry over from forge-2d `CONJURE`. Final tuning
happens on real phones.

## 6. Phases

| Phase | What | Gate |
|---|---|---|
| 0 | These docs, committed and pushed | John reviews |
| 1A | **Reaction engine spike**: grid, ~8 materials, ~12 rules, wield/throw, body effects, deterministic | soak test + scripted scenes |
| 1B | **Recogniser spike**: 100-150 characters, confusion matrix, real handwriting samples | RECOGNISER.md targets |
| 1C | Join: crew of 1-4, flat arena, docked pad, plain flat look | John plays on his phone |
| 2 | Modifiers + Almanac | modifier algebra tests |
| 3 | Vocabulary tiers T1-T3 as content-only drops | no new engine code needed |
| 4 | Co-op hardening on real Wi-Fi | John plays with others |
| 5 | Bigger world, creatures, optional puzzle isles (port forge-2d isles) | |
| 6 | Automated play-testing (adapt forge-2d lab minds), reaction fuzzing | |
| 7 | Look and feel: ink look, droplet transit (Inkblade `07-fx.js`), audio | late, optional |

1A and 1B are independent and can run in parallel. Every phase ends with a hand-off entry; Phase 1 ends with a
retrospective (repo rule for anything built for outside review).

## 7. Risks, in order

1. Reaction-engine sprawl: combinations that are dull or chaotic. Mitigation: tag vocabulary, small rule table,
   soak tests, every rule data not code.
2. Recogniser confusion at 150+ characters, especially with children's handwriting (unmeasured today).
3. Writing friction: pad interrupts play. Mitigation: §5.
4. Co-op determinism with many entities and cells. Mitigation: authoritative server, snapshot/restore tests.
5. Scope creep toward "Minecraft". The success test: a new tier of characters is a **content-only** drop.

## 8. Repo rules that apply

One folder per game; never import from another game or from 学字坊 files; self-contained (vendored libraries,
no CDN, no npm); README with what/run/controls/home-network caveats; runnable `smoke-test.mjs` on a test port
(never 3000); pinyin and meaning beside every Chinese character shown; screenshots only from a running build;
trunk-based on `master`; all numbers are profiled knobs, none hard-coded per level.
