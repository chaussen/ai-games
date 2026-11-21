# Conjure in the 2D Forge: write a character, hold the stone

Plan and record for bringing **Conjure** (the writing pad) back into the side-view game. It was a greybox scope
cut (`GREYBOX.md` §5, "No writing pad") that never came back. John asked for it on 2026-11-21: "eventually i want
drawing mechanism. imagine four players, each conjuring own objects", then "while play test auto is not complete,
i want to add conjure from conjure 2d. plan and implement. you may also leave hand off materials just in case".

Sources (copied, never imported): `games/tongzhou-conjure` (the first Conjure: pad, recogniser, ink, wire format;
`docs/conjure/`) and `games/tongzhou-forge` (its G1 pad: opens blank, *Ideas to try*, FG-D018; the order-tolerant
recogniser on Make Me a Hanzi stroke data, cards B3 and B4).

**Status (2026-11-21): built for one player; the sim is ready for four; two writing isles (§7a).** §8 is the hand-off.

---

## 1. What it is

A third verb next to JUMP and GRAB: **书 shū WRITE**. It opens a writing square. You write a character with your
finger (or the mouse). The game reads it on the device, offline, and shows its best guesses with pinyin and
meaning. Tap one, and if this isle knows it, **the stone appears in your hands**, the ink of your strokes drawn
in the air over your head as it forms. From then on it is an ordinary stone: carry it, throw it, set it beside
or on top, burn thorns, bridge a gap.

Why it matters: writing is the learning core John wants back. Finding and placing stones teaches what the parts
mean and where they go; writing teaches how the character is made.

## 2. Decisions (CJ2-, newest last; each is a knob where it can be)

| ID | Decision | Why |
|---|---|---|
| CJ2-01 | **Each player conjures their own.** Ink, the cooldown and the stones you wrote belong to the player who wrote them. A written stone carries its writer (`k.by`) and shows the writer's colour (the four `WInk.PLAYERS` colours). Anyone may carry or use any stone: the isle is co-op. | John: "four players, each conjuring own objects". The 3D chose one crew pool (CJ-02); here `CONJURE.pool` is `'own'` (default) or `'crew'` so the playtest can compare |
| CJ2-02 | **Built for one, ready for four.** The game is still one player in the page (no rooms). The sim takes any number of players and `sim-test` runs four writers at once. Rooms, phones and the board are the next big step, not this one | Keep this step small enough to finish and test; the sim is what a server will run |
| CJ2-03 | **What an isle lets you write:** the isle's `write` list if it has one, else the characters of the stones lying on it. **Never the isle's goal** (3D CJ-06): you make the goal, you don't write it | Writing must not skip the forge, and a short list keeps the recogniser honest |
| CJ2-04 | **The recogniser reads against every character in the game** (36), not only the isle's few. A drawing is named for what it looks like; if that is not on this isle, the tile says so and cannot be used | With two candidates every scribble "is" one of them, which would teach nothing |
| CJ2-05 | **Where the stone appears:** in your hands when they are empty; with your hands full, it drops in front of you (a 木 written over a gap grows a bridge, like any 木 that falls there) | The common case needs no extra step; the full-hands case still does something useful |
| CJ2-06 | **Ink:** each player has a few drops; one write costs one; drops come back with time. Out of ink, the pad still opens (practise), but nothing appears | Scarcity keeps writing a choice, never a stuck state |
| CJ2-07 | **Your written stones are capped** (`own`). Writing past the cap makes your **oldest** written stone fade (it says so), instead of refusing | QoL rule: no restart-only states. A written stone thrown somewhere unreachable must not block writing |
| CJ2-08 | **The pad opens blank**, no Trace mode; *Ideas to try* lists what this isle lets you write with pinyin and meaning; tapping one shows it as a model to copy (3D FG-D018). "Use … without drawing" appears only for a chosen idea, and not in strict (`CONJURE.pick`) | Serves strong writers and learners; the pick is an accessibility fallback |
| CJ2-09 | **One player: the isle waits while the pad is open** (`UI.padPause`). With rooms it cannot (others play on) | Children write slowly; nothing should happen to you while you write |
| CJ2-10 | **Practice memory stays on the device** (`localStorage`): a character written from memory, read first, and accepted three times gets a ✓ in *Ideas to try* | 3D D8; never sent anywhere |
| CJ2-11 | **Screen budget changes on purpose:** a third pad button, **书 shū WRITE**, smaller: upright, left of GRAB and low (so the camera keeps its place); sideways, above JUMP; on a laptop, bottom right (key C). The pad sheet while writing. `screen-check.py`'s list gains `write` and `writepad` | AGENTS.md: the budget changes only on purpose |

## 3. Knobs (`CONJURE` in `sim.js`, profiles like `FORGE` / `QI` / `ASSIST`)

| Knob | relaxed | standard | strict | Meaning |
|---|---|---|---|---|
| `ink` | 3 | 2 | 1 | drops a player holds at most (and starts with) |
| `regen` | 10 | 15 | 25 | seconds for one drop to come back |
| `cooldown` | 0.5 | 1 | 2 | seconds between two writes by one player |
| `own` | 3 | 2 | 1 | written stones one player may have at once; one more fades the oldest |
| `pick` | true | true | false | "Use … without drawing" for a chosen idea |
| `pool` | own | own | own | `'own'`: ink per player (CJ2-01); `'crew'`: one shared pool, cap +1 per extra player |

Client (`UI` in `app.js`): `padPause` (true), `padMinScore` (0.15, below it the pad says it can't read the
drawing and offers the ideas), `practiceMaster` (3).

## 4. Spec

**Sim (`sim.js`, pure, deterministic):**
- `world.writable()` → the characters this isle lets you write (CJ2-03).
- `world.write(id, ch, { pick })` → `{ ok: true, stone, held }` or `{ ok: false, why }`. Checks, in order:
  `phase` (isle not in play), `away` (no such player), `want` (the goal), `unknown` (not on this isle),
  `pick` (a pick where `CONJURE.pick` is off), `cooldown`, `ink`. Then: past `own`, the oldest written stone of
  this player that still exists fades (`fade` event; a held one leaves the hands). The stone goes into the hands
  if they are empty, else drops in front (CJ2-05). Ink −1, cooldown set.
- Player fields: `ink` (drops, fractional while refilling), `wcd` (cooldown), `wrote` (ids of their written stones
  still on the isle). Stone fields: `by` (writer id), `conj: true`, `home` = the writer's safe ground (so a written
  stone that falls in the river floats back there).
- Events: `write { id, ch, s, held, pick }`, `fade { id, s, ch }`, `writeNo { id, ch, why }`.
- Ink comes back every step (per player, or the crew pool). A written stone forges, bridges, burns, scores like
  any other. `world.load()` (restart, next isle) refills everyone.

**Page (`app.js`, `index.html`, `style.css`):**
- `#write` button (data-pad, data-hud `write`): 书 shū WRITE with the player's ink as dots under it. Upright phone:
  left of GRAB, low; sideways: above JUMP; laptop: bottom right. Keys: **C** opens and closes the pad, Esc closes
  it, Enter takes the first usable guess, Backspace clears.
- `#writepad` sheet (data-hud `writepad`): ink drops and ✕, the square with a 米字格 grid, the status line, result
  tiles (top 3 with pinyin and meaning; a tile not on this isle is greyed, "not on this isle"), *Ideas to try*,
  the "Use … without drawing" button for a chosen idea, Clear.
- The recogniser runs 0.5 s after the last stroke. A tap on a usable tile calls `world.write`. Yes: the pad closes,
  the strokes are replayed in ink above the hero and shrink into the stone, the message line says
  "You wrote 木 mù tree", the voice says it. No: the pad stays open with the drawing and says why.
- `vendor/recogniser.js` (copied from the 3D forge, unchanged) and `vendor/strokes.json` (Make Me a Hanzi medians
  and outlines for the 36 glyphs, made by `tools/strokes.mjs`; licences in `vendor/`). Served by `server.js`.

## 5. Tests

- `sim-test.mjs`, group **Write**: in your hands; full hands drop it in front; every refusal reason; ink runs out
  and comes back; the cooldown; the cap fades the oldest (also one held); four players with their own ink and
  their own stones; `pool: 'crew'`; a written 木 beside 木 forges 林; a written 木 dropped over a gap bridges;
  a written stone that falls in the river floats back to the writer's safe ground; restart refills ink;
  determinism; on every isle the first writable character appears in your hands at the spawn; and a third Two Trees
  route, `write_it`, wins without touching the isle's stones (write 木, throw it into the gap, write another,
  carry it over, wait for a drop, write a third beside it). Routes for other isles that use writing are later work (§7).
- `write-test.mjs` (new, node only): the recogniser on the shipped `strokes.json` reads every one of the 36
  characters' own medians first (with a little jitter and a reversed stroke), and a scribble is read as no
  usable character. Synthetic, so **not proof that children's writing is read** (same caveat as the 3D's B2).
- `smoke-test.mjs`: the recogniser and stroke data are served; `strokes.json` has every glyph.
- `screen-check.py` (every screen, all three looks): `write` is in the budget and does not overlap the other pad
  buttons; the pad opens, fits the screen, and on phones **real touches draw 木 from its stroke data**; the
  recogniser names 木 first; tapping the tile closes the pad and 木 is in your hands; screenshots of the open pad.

## 6. Defect log

| Found by | Defect | Fix |
|---|---|---|
| write-test (measuring) | The 3D pad offered any guess scoring 0.15 or more. Against the 36 characters, random scribbles score 0.5 to 0.7, so every scribble would have been offered as a character | `UI.padMinScore` 0.65: sloppy copies of the characters score 0.66 or more, 98% of scribbles fall under it. Tune on real samples |
| screen-check (small phone, sideways) | The boat's title card comes later in the page and sat over the writing square: the first strokes dismissed the card instead of drawing (1 of 4 strokes arrived, 木 read as 子) | The pad sits on top (`z-index`) and the title hides while the pad is open |
| screen-check (sideways phones) | WRITE left of GRAB, low, covered your feet when the camera stops at the isle's end | Sideways, WRITE goes above JUMP. Upright it stays left of GRAB, so the camera does not move |
| screenshots | The writer's colour dot on a held stone floated beside it in the ink look (that look draws a held stone lower than the sim's box) | The dot shows only on stones lying loose |
| screen-test | With the pad steps, a full run of the slow greybox look passed `screen-test.mjs`'s 300 s limit and was cut off silently | Limit 900 s |

## 7. Known gaps

- **Real handwriting is unmeasured.** The recogniser is checked on its own templates with jitter; children's
  writing on phones has never been collected (3D ROADMAP B2). Gate before any classroom use.
- **One player.** No rooms, phones-as-pads or board yet; the sim is ready (CJ2-02). With rooms, `padPause` must
  go and the strokes should travel with the write so the board can replay them (3D wire format, `SPEC.md` §4).
- **No isle is designed around writing yet.** Every isle is still won by finding stones; writing is a shortcut
  and a way to recover a lost piece. An isle that *needs* a written character (a piece that lies nowhere) is the
  next content step, with routes in `routes.mjs`.
- The model for an idea is the brush font's glyph, not an animated stroke order (the medians are there to do it).
- The autotest lab (`lab/autotest/`) does not write. Its page-mind still wins Two Trees and Sun and Moon with every
  check passing after this change (sideways, ink; the WRITE button moves the sideways camera anchor by a few pixels).
  The full 21-isle run was not repeated.
- Writing time does not count in the isle's time while the pad pauses it (one player).
- Children may not know they can write: WRITE blinks only on the two writing isles (CJ2-15); elsewhere nothing points at it except the button itself and the ☰ key list.

## 7a. Writing isles (session 2, 2026-11-21)

Until now every isle could be won from the stones lying on it, so writing was a shortcut. John: "you can go"
(next step (b) of §8). Two isles where **a piece lies nowhere**, so the only way through is to write it.

| ID | Decision | Why |
|---|---|---|
| CJ2-12 | **A writing isle has a `write` list and too few pieces.** Some character the goal needs lies on it fewer times than the recipe uses it (counted down the recipe tree). `sim-test` checks this for every isle with a `write` list, and runs two winning routes for each, both with a write | The rule makes "needs writing" a fact the test proves, not a claim in a tip |
| CJ2-13 | **One Tree** (书木成林 shū mù chéng lín, "write a tree to make a grove"), isle 2, right after Two Trees: the same isle with one 木. A grove needs two. Write the other | The lesson right after its twin: the only change is the missing tree |
| CJ2-14 | **Water the Tree** (书水为沐 shū shuǐ wéi mù, "write water to make bathe"), right after Bathe: 木 lies behind a wall of flames and there is no 水 anywhere. The 水 you write douses the flames, then goes left of 木 for 沐. Its `write` list is only 水 | A written stone used twice: first as a tool, then as a piece |
| CJ2-15 | **WRITE calls on a writing isle:** until you have written there, the WRITE button blinks (a vermilion ring in steps, no alpha: safe in One Stroke). It stops after your first write on that isle | §7: "children may not know they can write" |
| CJ2-16 | Both keep `regrow`: the isle's own stones grow back, written ones never do. Ink comes back with time, so neither isle can get stuck | QoL: no restart-only states |

The title cards use only characters already in the brush font subset (书 木 成 林 水 为 沐), so `tools/font.py`
needs no rebuild. The isle count goes from 21 to 23; the lab's play-test mind cannot write yet, so its "all
isles" run skips these two until it learns (§7).

## 8. Hand-off

Kept up to date at the end of each session. Newest first.

### Session 2 (2026-11-21): writing isles, and the board launcher

**State**
- §7a built: **One Tree** (isle 2) and **Water the Tree** (after Bathe), 23 isles in all. Each has a `write`
  list and too few pieces; `sim-test` proves that the stones alone cannot make the goal, that the stones plus
  writes can, and that two scripted routes win each isle, every one with a write (424 checks). WRITE blinks on
  a writing isle until you write there (CJ2-15).
- `write-isle-test.mjs` (new, port 3487): both isles in all three looks, upright and sideways. The call is on,
  the character is written by real touches and read first, the stone is in your hands, the call stops, and
  the written 水 douses the flames. Screenshots in `screenshots/write-isles/`.
- Regression found and fixed: `screen-check.py` chose the cloud-chain isle by number (`goIsle(1)`), which the
  new isle 2 moved. It now chooses by id. The lab minds skip writing isles in their "all" runs (they cannot
  write); `mind-zero` still wins 21 of 21 of the rest.
- **The board:** `/board` (board.html, board.js, `vendor/qrcode.js` copied from `games/tongzhou-forge`, MIT)
  shows a QR code for phones with the look and profile in the link. `games/board/` is the launcher for the
  board machine: `board.sh` plus `install.sh`, which made `board-2d`, `board-2d-onestroke`, ..., `board-3d`,
  `board-conjure`, `board-isles` and `board-stop` in `~/bin` and the desktop menu. Port 3000 only (firewall).
  `games/board/smoke-test.mjs` checks it on test port 3488 (26 checks).
- The 3D-game launches only start the existing servers and boards; their boards were not re-checked here.
- Not pushed: this network blocks github.com (John, 2026-11-21). Commits wait on local `master`.

**For John**
1. Play One Tree and Water the Tree: did you notice the blinking WRITE? Is writing 水 next to the flames clear
   from the tip alone?
2. On the board machine: `board-2d` (or the menu: Games → Board). Do the phones reach it, and is the QR code
   big enough from across the room?
3. Next: more writing isles (one per element?), or rooms for four on top of the board?


### Session 1 (2026-11-21): plan and build, one player

**State**
- Built as planned in §1-§5: `CONJURE` knobs and `world.write()` in `sim.js`; WRITE button, pad, recogniser,
  ink replay and writer marks in `app.js` / `index.html` / `style.css`; `vendor/recogniser.js` (copied from
  `games/tongzhou-forge`, unchanged) and `vendor/strokes.json` (36 characters, `tools/strokes.mjs`, licences in
  `vendor/`); `server.js` serves `vendor/*.js|json`.
- Tests: `sim-test` 394 (Write group plus the `write_it` route), `write-test` 7 (new), `smoke-test` 34,
  `screen-test` in all three looks on all eleven screens with the pad drawn by real touches (laptops: the mouse).
  `lab/autotest/page-mind.mjs` still wins Two Trees and Sun and Moon with every check passing.
- Not done: rooms for four (CJ2-02), an isle that needs writing, real handwriting samples (§7).

**Resume**
```sh
cd games/tongzhou-forge-2d
node sim-test.mjs && node write-test.mjs && node smoke-test.mjs && node screen-test.mjs && ART=cut node screen-test.mjs && ART=greybox node screen-test.mjs
node server.js     # http://localhost:3300/ : tap 书 WRITE (or C), write 木 on Two Trees
node tools/strokes.mjs --glyphs   # after adding a character to content.js (needs ../../build-pipeline/data)
```

**For John (playtest questions)**
1. On your phone: is the WRITE button where your thumb finds it (left of GRAB upright, above JUMP sideways)?
2. Does the pad read what you write? Try sloppy, small, and in the wrong stroke order. If good writing is refused
   or scribbles are accepted, `UI.padMinScore` (0.65) is the knob; better still, save some real samples (3D B2).
3. Ink 2, one back every 15 s, two written stones each: too much, too little? Does writing make isles too easy?
4. Should "Use … without drawing" stay (accessibility), or go once children can write?
5. Next: rooms with four players on phones (each their own ink and colour, the sim is ready), or first an isle
   that needs a written character?

**Next session's goal (suggested):** after John plays it, either (a) rooms: a server running `sim.js` with up to
four phones, each its own pad, the strokes sent with the write and replayed for everyone; acceptance: four
headless phones each write and the others see the stone in the writer's colour; or (b) one or two isles that need
a written character (a piece lying nowhere), each with two routes in `routes.mjs`.
