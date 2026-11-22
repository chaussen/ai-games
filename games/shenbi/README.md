# 神笔 Shenbi (working title): write a character, it becomes a real thing

From 神笔马良 (Ma Liang and the Magic Brush): whatever the boy painted came alive. Here, whatever you **write**
comes alive. Write 火 and you hold a fire you can throw. Write 很 first and it is a bigger fire.

**Status: Phase 1 built — 1A the reaction engine, 1B the recogniser at 122 characters, 1C the crew server, the
docked pad and the flat arena. All tests green (see below). Phase 1 closes when John plays it on his phone
(the 1C gate) and the real-handwriting samples land. Start with `docs/HANDOFF.md`.**

## What it is

A free-play, open, free-to-play-forever sandbox for a crew of 1-4 phones (co-op is a must; playful PvP is on).
A side-view, grid-like world. You write Chinese characters with your finger; an offline recogniser reads them;
the character becomes an object you can wield, throw, place and combine. Objects react to the world and to each
other (fire burns wood, water douses fire, 很 makes it stronger — Phase 2). No HP, no death: getting hit means
being singed, soaked, chilled or knocked back, and there is a calm toggle and a home button for everyone.

1. Writing characters is the learning part.
2. Objects coming alive is the fun part.
3. You choose: puzzles, or throwing fire at your friends.

## Where it came from

- `games/tongzhou-forge-2d/` (frozen reference, not archived): write pad (Conjure), recogniser, deterministic
  sim, co-op server, knob tables. Code is **copied** from there, never imported (repo rule).
- `/home/zni/projects/inkblade/` (separate repo): the ink-and-world look John likes. Look and feel is deferred
  to a late phase here (see CHARTER §6).
- The name Tongzhou is retired for this direction. `games/TONGZHOU.md` points here.

## Docs (read in this order)

| File | What |
|---|---|
| `docs/HANDOFF.md` | **Start here.** State, next steps, rules for the next session |
| `docs/CHARTER.md` | Intent, decisions from John, scope, phases, risks |
| `docs/REACTIONS.md` | The reaction engine: materials, tags, rule table, as-built notes |
| `docs/GLYPH-CARDS.md` | The card schema (one record per character) and the card plan |
| `docs/MODIFIERS.md` | 很, 不, 大, 小 ... how they will change a card (Phase 2) |
| `docs/VOCAB-TIERS.md` | The curated 100-200 character set and the order it ships in |
| `docs/RECOGNISER.md` | The other hard problem: scaling the recogniser, tests, as-built numbers |
| `docs/RETROSPECTIVE.md` | The Phase 1 retrospective (repo rule for anything built for outside review) |

## How to run

Zero-install: Node (no npm, no CDN), everything vendored.

```sh
cd games/shenbi
node server.js            # http://localhost:3500/  (PORT=xxxx to change; tests use 3500+, never 3000)
```

- Open the printed address on a phone on the same Wi-Fi, or open `/board` on this computer: it shows a QR code
  for the phones and sets the room's knobs (play profile, how friends affect each other).
- One phone alone is a crew of one. Up to four phones share one arena. The server is authoritative; a phone
  only draws snapshots and never steps the world.
- Regenerate data after content changes: `node tools/pack.mjs` (cards.json → content.js) and
  `node tools/strokes.mjs --file tools/vocab.txt` (the recogniser's stroke data).

## Controls

- **Stick** (bottom left) walks; **jump** jumps. Drag anywhere on the world to **aim** (an arrow shows it);
  without aiming you act in the direction you face, slightly up.
- **书 shū · WRITE** opens the docked pad (right side, about a quarter of the width in landscape). Write with
  your finger; after half a second of stillness the best three readings appear as chips, each with pinyin and
  meaning. One tap puts the thing in your hand and clears the pad for the next character, so chaining 很 then
  火 needs no reopening. The pad collapses to a thumb chip; the world keeps running while it is open.
- **用 yòng · use** wields what you hold (a torch lights, a jug pours, a blade reaches). **投 tóu · throw**
  throws it. **放 fàng · put** places it into the world (a seed into mud grows a tree). **家 jiā · home** takes
  you back to spawn — it always works; nobody can be trapped.
- **静 jìng · calm** (top right) stops friends targeting you. **☰** opens the room's knobs.
- Keyboard (laptop): ← → walk, Space jump, 1/2/3 = 用/投/放, C write, H home, X calm, drag the world to aim.

## Tests (the contract)

```sh
cd games/shenbi
node sim-test.mjs          # 83 checks: per-rule truth tests, the pair test, soak 1-4 players, caps,
                           #   determinism and restore-continues-bit-for-bit, node step time
node write-test.mjs        # 26 checks: 122 characters, tier targets on clean synthetic writing (top-3 >= 90%),
                           #   confusion matrix, look-alike report, modifiers, scribble gate, speed
node smoke-test.mjs        # 54 checks: boots the real server on port 3501 and plays it like phones do
python3 screen-check.py 3502 screenshots   # 100 checks with real touches on 5 screen sizes (needs Playwright;
                                           #   start `PORT=3502 node server.js` first)
```

## Home-network caveats

- Phones join over the home Wi-Fi by IP; the board's QR code carries the right address. If the router isolates
  clients (guest networks often do), phones cannot reach the server — use a normal network or a hotspot.
- github.com may be blocked on that network; nothing here needs it. Everything is local and vendored.
- The server keeps a lost phone's seat for 30 s, so a refresh takes your own place back; after that the seat
  goes to the next phone.
- The brush font is the device's own CJK font (Noto Sans/PingFang on phones); no font ships with the game yet.

## Known gaps after Phase 1 (deliberate, see CHARTER §6)

Modifiers (很), the Almanac, wind and light rules (R13-R17), creatures, puzzle isles, the ink look and audio —
later phases. The phone-step-time budget (p95 < 4 ms) and the recogniser's phone speed (p95 < 30 ms) are
measured in node only; adb numbers wait for a real phone. Real children's handwriting is unmeasured; the
sample format and folder (`tests/samples/`) are ready.
