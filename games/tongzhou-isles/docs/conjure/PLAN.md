# Conjure prototype: draw a character, it becomes a stone

Status: PLAN ONLY. No code has been written. Written 2026-11-17.
Files in this folder: `PLAN.md` (this: what and why), `SPEC.md` (exact formats and rules),
`TASKS.md` (ordered work, who does it, how it is checked).

## 1. Goal

A player opens a drawing pad on their phone, writes a Chinese character with a finger, the game
recognises it, and a stone of that character appears on the isle. The stone behaves like every
other stone: it can be carried, thrown, fused (女 + 子 = 好) and, if it has an element, bridges,
burns or douses.

Writing by hand is the preferred input. Voice is out: it depends on each device. Typing a word
and picking from a list stay as fallbacks so nobody is ever blocked.

## 2. Decisions already made

| Decision | Why |
|---|---|
| Work in a parallel copy: `games/tongzhou-conjure/` | The main game keeps working while the idea is tried. Repo rule: one self-contained folder per game, no imports between games. Backport by hand only after the prototype proves itself. |
| Recognition runs **on the phone**, offline | No internet and no accounts is a repo rule. Children's drawings never leave the room. Zero server load. |
| Recognise among a **closed set** (the characters the crew may conjure), not all 9000 | 20 to 100 candidates is far easier than the whole language. Accuracy goes up and the data stays small. |
| Show the **top 3 guesses** and let the player tap one | Forgives scribbles. The tap is also the moment the learner sees pinyin and meaning. |
| Conjuring is a **bonus**, never required by a stage | Every stage stays provably solvable with conjuring off, so the judge stays valid and unchanged. |
| An **ink budget** limits conjuring | Without a cost, conjuring skips every puzzle. |
| The sim stays deterministic and gets one new entry point: `game.conjure()` | Tests and the judge keep working. With conjuring off, behaviour must be identical to today. |
| No AI model is needed at runtime | A model only appears later, offline, to tag characters with an element (phase 5). |

## 3. How it fits the current game

Facts checked in the code on 2026-11-17:

- Stones are made by `addStone(ch, x, y, z, spring)` in `sim.js`. Fusion already creates a spring-less stone with `from` set, so a conjured stone can follow the same path: no spring, `from` = where it appeared.
- A loose stone that nobody is near for 10 s floats back to `from` or `home` (`returnStone`). A conjured stone therefore returns to where it was conjured. Fine for the prototype.
- `MAX_STONES` already caps the count; conjure must respect it.
- What a stone does comes from `LV.GLYPHS[ch].el` (wood, fire, water or nothing). A character without `el` is inert but can still fuse. So any character in `content/glyphs.json` can be conjured today with no engine change.
- The server accepts `input`, `act`, `call`, `visibility`, `ping`, `admin`. We add one message, `conjure`.
- The phone controller is a touch stick plus two buttons. We add a third button and a full-screen pad.

## 4. Architecture

```
 phone (controller)                      server (authoritative)              board (TV)
 ┌──────────────────────┐   conjure      ┌──────────────────────┐   conjured  ┌──────────────┐
 │ pad: draw strokes    │ ─────────────▶ │ check: phase, set,   │ ──────────▶ │ replay ink   │
 │ recognise (offline)  │  {ch, strokes} │ ink, cap, cooldown   │ {id,ch,     │ stroke, then │
 │ top 3, player taps   │                │ game.conjure(p, ch)  │  strokes,s} │ stone pops   │
 └──────────────────────┘                │ new stone near p     │             └──────────────┘
        ▲ ink left, allowed set          └──────────────────────┘
        └──────────── snapshot / joined ──────────┘
```

- The phone sends the **chosen character** plus the **strokes** (normalised, thinned) so the board can replay the drawing. The server never runs the recogniser; it only checks that the character is allowed and the player has ink.
- Allowed set = the stage's `conjure` list (new optional field) or, if absent, the stage's own characters. Stored in stage JSON, so `pack` and `lint` can check it.
- A character outside the allowed set is rejected with a visible "the isle does not know that one" so a misrecognition is never silent.

## 5. Recognition options (decided in phase 1)

Phase 1 is a bake-off. Candidates, cheapest first:

1. **Template matcher over stroke data** (self-written, about 200 lines). Stroke medians come from an open data set such as Make Me a Hanzi; check its licence before vendoring. With only 20 to 100 characters to tell apart, a simple matcher (resample, normalise, compare per stroke, allow stroke-order variation) may be enough.
2. **An existing open handwriting matcher** such as HanziLookupJS (MIT, as far as I recall; verify the licence and size before vendoring). Larger data, more tolerant of messy writing.
3. **Small neural net** trained on the closed set from the samples we collect. Only if 1 and 2 fail the gate. Heaviest to build and to vendor.

Gate (proposal, adjust after seeing real samples): across the conjurable set, drawn on a phone by at least 3 different people, the right character is in the top 3 at least 90% of the time and is first at least 70% of the time. Recognition takes under 200 ms on a mid-range phone.

If no option passes, the fallback is a **pick palette** (the allowed characters as tiles, draw to confirm shape optional). The rest of the pipeline is unchanged, so the prototype is not wasted.

## 6. Player experience

1. Tap **Draw** (third button). The pad opens full screen with the ink left shown as drops.
2. Two modes: **Trace** (faint guide character, for beginners; also raises accuracy) and **Free** (blank). Trace is the default; Free earns a bonus later.
3. Draw. After 600 ms with no new stroke, the guesses appear: three tiles with the character, pinyin and English meaning.
4. Tap a tile. The pad closes, one drop of ink is spent.
5. On the board the strokes replay as brush ink above the player, collapse into a stone, and the stone pops up in front of the player (same pop as fusion).
6. Everyone sees what was conjured and by whom (the existing `call` bubble can carry "Mia conjured 木").

English first: every tile shows pinyin and meaning. The pad's labels are English.

## 7. Limits and fairness

- Ink: 3 drops at the start of a stage; one drop returns every 25 s (numbers in `SPEC.md`, tuned in playtest).
- One conjure per player per 4 s; at most 3 conjured stones alive per player; `MAX_STONES` respected.
- A pad open does not freeze the player's body; the character stands still but the game goes on (prototype choice; revisit if it feels unsafe).
- Spectators and away players cannot conjure.

## 8. What changes in the copy, and what does not

| Area | Change |
|---|---|
| `sim.js` | add `conjure()`, ink fields, events. Existing behaviour untouched when no conjure happens. |
| `server.js` | add the `conjure` message with validation; send allowed set and ink. |
| `levels.js`, `content/` | optional stage field `conjure`; judge ignores it. |
| `app.js`, `index.html`, `style.css` | pad UI on the phone, replay animation on the board. |
| `vendor/` | the recogniser and its data, with licence text. |
| `tools/judge/*` | unchanged. A new lint code `conjure-unknown` flags a `conjure` entry that is not in `glyphs.json`. |
| Tests | new `conjure-test.mjs` (sim and wire); the four existing tests must still pass unchanged. |

## 9. Risks

| Risk | Answer |
|---|---|
| Children's strokes are messy | Trace mode, top-3 pick, closed set, and the pick-palette fallback. |
| Recogniser data is too big to ship | Closed set means only those characters' data is packed (`tools/pack` step). |
| Licence of stroke data | Check before vendoring; if unclear, write own data for the closed set (about 100 characters is feasible). |
| Conjuring makes every puzzle trivial | Ink budget; stage designers decide the allowed set; conjuring is never the only route. |
| Latency on the board | Replay is cosmetic and starts on message arrival; the stone appears at the server's moment, the replay is just ahead of it. |
| Touch handling differences (iOS Safari) | `touch-action: none` on the pad, pointer events, test on a real iPhone and an Android phone. |
| Weak models break the sim | Phase 2 (sim and server) is done by the strong model only; weak models get UI and tooling cards. |

## 10. Definition of done for the prototype

- A real phone can draw 木, 火, 水, 女, 子 and get the right stone, in a live session with the copy running on a port that is not 3000.
- 女 and 子 conjured by two players fuse into 好.
- The gate numbers in section 5 are measured and written down, pass or fail.
- Existing tests and the new `conjure-test.mjs` print `ALL ... PASSED`.
- README and a short retrospective exist in the copy. Screenshots, if any, are from the running build.
- A written go or no-go for backporting into `tongzhou-isles`.
