# 神笔 Shenbi (working title): write a character, it becomes a real thing

From 神笔马良 (Ma Liang and the Magic Brush): whatever the boy painted came alive. Here, whatever you **write**
comes alive. Write 火 and you hold a fire you can throw. Write 很 first and it is a bigger fire.

**Status: Phase 0, docs only. No code yet.** The design is written down so any later model or session can pick it
up. Start with `docs/HANDOFF.md`.

## What it is

A free-play, open, free-to-play-forever sandbox for a crew of 1-4 phones (co-op is a must; playful PvP is on).
A side-view, grid-like world. You write Chinese characters with your finger; an offline recogniser reads them;
the character becomes an object you can wield, throw, place and combine. Objects react to the world and to each
other (fire burns wood, water douses fire, 很 makes it stronger). Optional puzzles and goals sit on top, but the
world is free: you can solve things or just play.

1. Writing characters is the learning part.
2. Objects coming alive is the fun part.
3. You choose: puzzles, or throwing fire at your friends.

## Where it came from

- `games/tongzhou-forge-2d/` (frozen reference, not archived): write pad (Conjure), recogniser, deterministic
  sim, co-op server, knob tables, test lab. Code is **copied** from there, never imported (repo rule).
- `/home/zni/projects/inkblade/` (separate repo): the ink-and-world look John likes. Look and feel is deferred to
  a late phase here (see CHARTER §6).
- The name Tongzhou is retired for this direction. `games/TONGZHOU.md` points here.

## Docs (read in this order)

| File | What |
|---|---|
| `docs/HANDOFF.md` | **Start here.** State, next steps, rules for the next session |
| `docs/CHARTER.md` | Intent, decisions from John, scope, phases, risks |
| `docs/REACTIONS.md` | The reaction engine: materials, tags, rule table (the hard problem) |
| `docs/GLYPH-CARDS.md` | The card schema (one record per character) and the first 60 cards |
| `docs/MODIFIERS.md` | 很, 不, 大, 小 ... how they change a card, with worked examples |
| `docs/VOCAB-TIERS.md` | The curated 100-200 character set and the order it ships in |
| `docs/RECOGNISER.md` | The other hard problem: scaling the recogniser, tests, handwriting samples |

## How to run / controls / home-network caveats

Not built yet. The README gets these sections when Phase 1 ships (repo rule: every game README covers what it
is, how to run it, controls and home-network caveats). Planned: Node server, no npm, no CDN, test ports 3500+
(never 3000), phones join over the home Wi-Fi; github.com may be blocked on that network.
