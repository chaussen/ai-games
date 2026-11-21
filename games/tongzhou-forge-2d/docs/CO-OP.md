# Co-op in the 2D Forge: one isle, up to four phones, bodies that touch

Plan and record for the crew. John asked on 2026-11-21: "2D co-op with Conjure is the next. i want to add physics on
players themselves. they may bump each other, block each other, or even fight with blocks (optional). but co-op means
they can forge one character together while drawing their own." Then: "leave that [forging together] for design
only. i can ask claude design about how two players forge together. you just give me your proposed gameplay. build
other co-op components first."

So this step builds everything around forging together. **Forging together itself is only a proposal (§6)**, which
John will take to Claude Design.

**Status (2026-11-21): built.** Rooms (one crew per server), player bodies, knock (optional, off by default), the pad
in a crew, the board's crew controls. §9 is the hand-off.

Sources (copied, never imported): `games/tongzhou-forge/server.js` (the RFC 6455 WebSocket and the living-room rule)
and `games/tongzhou-forge/docs/forge/DESIGN.md` §5 (body forging, FG-D007, the basis of §6).

---

## 1. What it is

Open the board (`/board`), choose **同舟 together**, and every phone that scans the QR code joins **one isle**. Up to
four players, each in their own colour, each with their own stick, JUMP, GRAB and writing pad, each with their own ink.
The server runs the isle; the phones draw it.

The players are **bodies**. Walk into a friend and you shove them along. If they push back, nobody moves. Jump onto a
friend's head and you ride along with them. Stack three high to reach what nobody reaches alone. Stand on the stone a
friend carries over their head. Lean on a friend long enough and you slip past them, so a narrow ledge never traps
anyone.

Writing is per player and the isle never waits: while you write, the others play on. When you write, every phone sees
your strokes in ink over your head, drawn into the stone in your hands, and reads "● wrote 木 mù · tree" in your colour.

Thrown stones fly through friends unless the crew chooses otherwise (☰ or the board): **knock a friend back**, or
**knock what they carry loose**. Nothing is ever lost: a knocked-loose stone lies on the isle.

Alone (`/`, no `?crew=1`), nothing changed: the page runs the sim itself, as before.

## 2. Decisions (CO-, newest last; each is a knob where it can be)

| ID | Decision | Why |
|---|---|---|
| CO-01 | **One crew per server**, joined with `?crew=1`. The board's QR link adds it by default (**同舟 together**). **Each alone** is one chip away, and `/` stays solo. A fifth phone is told the crew is full and plays alone | A living room has one isle on the TV. Solo must keep working for the tests, the lab and one child at home |
| CO-02 | **The server runs the isle; phones mirror it.** The server steps `sim.js` at 60 Hz and sends a full snapshot 30 times a second (map only when it changes). The phone `restore()`s it and draws between the last two. No prediction on the phone | The sim is deterministic and already the contract; one source of truth means no desync to debug. LAN latency is small. Prediction is a later knob if phones feel late (§8) |
| CO-03 | **Players are solid** (`BODY.solid`). Walk into a friend on the ground and they are **shoved** at half your speed after 0.12 s of leaning (`shove`, `shoveDelay`). If they push back, it is a **stalemate**. In the air, a friend is a wall you can kick off, and touching them refills 轻功 once per chain (`QI.refill` already listed `head`) | "bump each other, block each other". Shoving like a stone makes a friend feel heavy, not like rock |
| CO-04 | **Heads are ground.** Land on a friend (or on the stone they carry) and you stand there. You **ride** along when they walk or jump (`ride`). Carriers step before their riders, so a tower moves as one. A tapped hop (1.17 high) still climbs onto a friend (1.2 tall) through the ledge nudge (`ASSIST.nudge`) | Stacking is what bodies are for in a side view (Pico Park), and the basis of forging on top (§6) |
| CO-05 | **No restart-only states between friends.** Lean on a friend for `slip` seconds and you slip past them. Two friends in one spot (a respawn, a stopped slip) drift apart at `part` units/s. A friend who leaves drops their rider | John's rule that a restart must never be the only way out: a child blocking a corridor must not trap another child |
| CO-06 | **Knock is optional and off by default** (`BODY.knock`: `off` / `push` / `loose`), a crew choice in ☰ and on the board, kept across isles like the profile. A thrown stone hits each friend at most once per throw, never the thrower. `push` throws them back with a short stun; `loose` also knocks what they carry out of their hands. Nothing is lost | "or even fight with blocks (optional)". Co-op first; rough play is opt-in, and a knocked stone stays on the isle |
| CO-07 | **The living-room rule** (3D game): anyone may restart, change the isle, the profile or the knock, for everyone. The phone's own look, labels and sound stay its own | The 3D game's rule; children share one isle |
| CO-08 | **In a crew the pad never pauses the isle** (`UI.padPause` is solo only). The strokes travel with the write (at most 20 strokes of 32 points) and every phone replays them over the writer's head. The server drops malformed strokes, but the write itself still counts | CONJURE.md §7: "with rooms, padPause must go and the strokes should travel with the write" |
| CO-09 | **Your colour.** The server gives each phone a slot (1-4: vermilion, azurite, malachite, wisteria). Your figure keeps the gamboge rim. Friends are drawn in their own colour: ink gives each their colour and hairstyle (`WInk.PLAYERS`), One Stroke their colour as the sash (flat, no alpha), greybox a coloured outline. Messages about a friend start with their colour dot | You must always know which one is you; friends must be told apart without names (no names: children, no typing) |
| CO-10 | **A lost connection keeps its place for 30 s** (`GONE_AFTER`), and a phone that comes back (same tab: `sessionStorage`) gets the same player and colour. A duplicated tab is a new player, never a takeover | Phones sleep and Wi-Fi drops; children reload |
| CO-11 | **Forging together is not built** here; §6 is the proposal for Claude Design | John's instruction |

## 3. Knobs

`BODY` in `sim.js` (profiles like `FORGE` / `QI` / `ASSIST` / `CONJURE`):

| Knob | relaxed | standard | strict | Meaning |
|---|---|---|---|---|
| `solid` | true | true | true | players block each other; false: they pass through (the rule before CO-OP) |
| `shove` | 0.5 | 0.5 | 0.5 | a shoved friend moves at this share of your speed (0: a friend is a wall) |
| `shoveDelay` | 0.12 | 0.12 | 0.12 | seconds of leaning before they move |
| `slip` | 0.6 | 1.0 | 1.5 | seconds of leaning before you slip past a friend (0: never) |
| `ride` | true | true | true | standing on a friend, you move with them |
| `part` | 1.5 | 1.5 | 1.5 | units/s two overlapping friends drift apart |
| `knock` | off | off | off | `off` / `push` / `loose`; the crew's choice (`world.setKnock`) overrides it |
| `knockV` | 5 | 5 | 5 | how hard a knock throws a friend |

Server (`server.js`): `STEP` 1/60 s, `SNAP_EVERY` 2 (30 snapshots/s), `MAX_CREW` 4, `GONE_AFTER` 30 s.

## 4. Spec

**Sim (`sim.js`):**
- `bodyBoxes(q)`: a player's body box, plus their carried stone's box (you can stand on it). `topOf(q)`.
- `boxes(..., { bodies })` and every player sweep take the friends from `bodiesFor(p)`. That excludes: p itself, anyone
  standing on p (`ridesOn`), anyone p is slipping past (`p.slip`, ids), and anyone p already overlaps
  (`bodyOverlap`). Alone, it returns `null` and nothing changes.
- `step()`: everyone's start position goes in `x0`/`y0`. Players step in `depth()` order (carriers first). `ride(p)`
  moves a rider by its carrier's motion this step, then `stepBodies()` ends finished slips and parts overlapping
  friends.
- Horizontal hit on a body: nudge onto their head (`ASSIST.nudge`), else shove (both on the ground at one level, they
  do not push back, after `shoveDelay`), else block. After `slip` seconds you slip. `p.bump`/`p.bumpOn` time the lean.
- `knock(k)` in `stepStone` for flying stones when `bd.knock !== 'off'` and two or more players: once per throw
  (`k.hit`, reset on grab).
- `setKnock(mode)`, `useKnobs()`. `bd` = the profile's BODY with the crew's knock.
- `snapshot(opt)` → plain data. References become ids: support `'T'` / `'p:<id>'` / `'s:<id>'`, hold/holder/thrower
  ids, spring index. `opt.cells === false` leaves the map out. `restore(s)`: loads the isle if it differs, applies
  profile and knock, and reuses player and stone objects by id (keys starting `_` are the page's and survive). The
  map version `cellsV` goes up with every load, bridge and burnt wall.
- Events: `bump { id, other }`, `slip { id, other }`, `knock { id, by, s, ch, lost, x, y }`, `knockMode { knock }`,
  `nudge` (now also onto heads).

**Wire (`/ws`, JSON text frames):**

| Phone → server | |
|---|---|
| `{ t: 'join', id? }` | id from this tab's `sessionStorage` to come back to your place |
| `{ t: 'in', x, j }` | stick (−1..1, two decimals) and JUMP held; on change and every 0.1 s |
| `{ t: 'press', what: 'jump' \| 'grab' }` | |
| `{ t: 'write', ch, pick, strokes, n }` | strokes 0..1, y down; `n` matches the answer |
| `{ t: 'isle', i }` · `{ t: 'profile', name }` · `{ t: 'knock', mode }` | anyone (CO-07) |

| Server → phone | |
|---|---|
| `{ t: 'joined', id, slot, max }` · `{ t: 'full', max }` | |
| `{ t: 'snap', s, e }` | snapshot (numbers to 4 decimals; `cells` only on a new isle, a changed map or a new phone) and the events since the last one; a `write` event carries `strokes` |
| `{ t: 'wrote', ok, why, ch, s, n }` | to the writer only, at once |
| `{ t: 'roster', players: [{ id, slot, here }] }` | on every join and leave |

HTTP: `GET /crew.json` (isle, profile, knock, players with slot and `here`). `POST /crew { profile?, knock? }` (the
board).

**Page (`app.js`):** `?crew=1` → `connect()`. Until the first snapshot the isle stands still. `netFrame()` applies
the snapshots, sets `_px/_py` from the last ones, and handles the events. `netInput()` sends the hands. `press()`,
`restart()`, `goIsle()` and the profile/knock choices go to the server. `tryWrite()` sends; `wrote()` closes the pad
or shows why. A full crew, or no answer after 15 tries, → `alone()`: this phone plays solo, and the message says why.
☰ gains **Thrown stones** (crew only). `WF2D.crew()` for the checks.

**Board (`board.html`, `board.js`):** **Play**: 同舟 together (default) / each alone. In a crew, a **Crew** line (a
dot per player in their colour, hollow while away, and the isle) and **Thrown stones** chips. The board posts its
profile and knock to the crew when it opens and when a chip changes; it follows a phone that changes them.

## 5. Tests

- `sim-test.mjs`, group **bodies** (27): pushing against each other is a stalemate; walking into a still friend
  shoves them; `shove 0` is a wall; leaning long enough slips past and the slip ends once apart; landing on a head;
  riding a walking friend; going up with a jumping friend and landing on their head again; a head is a step higher
  than the ground; a tapped hop climbs on; a tower of three walks as one, and the top falls onto the bottom when the
  middle leaves; standing on a carried stone; a friend's side refills 轻功; `solid false`; overlapping friends part;
  alone, no bodies; knock off/push/loose (never lost), the knock survives the next isle, unknown → off. Group
  **snapshot** (6): restore(snapshot) through JSON is the same; a copy made half way through **steps on bit for bit
  like the original for 500 steps with four players** writing, throwing and knocking; restore switches isle and keeps
  the page's `_` keys; no cells leaves the map; standing on a friend survives.
- `crew-test.mjs` (new, real server on port 3489, WebSocket clients that mirror the world like the page) (37): join,
  ids and colours, both mirror both, the map once, the roster; a shove over the wire, never overlapping, the bump
  event, both phones agree; a write answered, the strokes to everyone, the stone in the writer's hands marked theirs,
  the goal refused, bad strokes dropped but the write counts; anyone changes the isle (the map comes once, and right),
  the knock and the profile; `POST /crew`, junk changes nothing; a fifth phone is turned away; a lost connection keeps
  its place and comes back to it with the map; a duplicate id never takes over; a snapshot with four players is under
  6 KB.
- `crew-check.py` via `crew-check-test.mjs` (new, port 3490): **four headless phones in one crew**, ink upright, One
  Stroke sideways, greybox upright, ink sideways, all with real touches. Four players in four colours on every phone;
  A's stick shoves B on every phone; A jumps onto B's head and rides when B walks; B writes 木 by real touches while
  the isle plays on, and A sees the stone in B's hands, B's strokes over B's head, and "wrote" in the message line;
  C sets the knock in ☰ and every phone follows; B throws at A and A's phone says "knocked you back"; the board on a
  laptop shows four in the crew and a link that joins it. Screenshots in `screenshots/crew/`.
- Unchanged and still passing: `smoke-test`, `write-test`, `write-isle-test`, `screen-test` in all three looks
  (solo).

## 6. Forging one character together: proposed gameplay (for Claude Design)

John: "co-op means they can forge one character together while drawing their own." This is my proposal for Design to
work from, not a decision. Two layers: the first comes almost free with what is built; the second is the signature.

### 6.1 Layer 1: body forging (the 3D rule, now physical)

Each player writes **their own** piece and holds it over their head. The **crew's formation is the placement**:

- **⿰ beside**: two friends stand shoulder to shoulder (bodies now touch exactly), each holding a stone. The left
  stone is first: 女 held on the left, 子 on the right, makes 好.
- **⿱ on top**: one friend stands on the other's carried stone (CO-04 makes this real). The top friend's stone is
  over the bottom friend's: 日 over 木 makes 杲.

**Any** of them presses GRAB. Its label becomes **合 hé FORGE** for any formation, valid or not (labels name the
action, never the result, P9). Valid: both stones become one, in the presser's hands, with a seal in **both colours**.
A dud: both keep their stones, and the message names the arrangement. The trigger is the 3D game's FG-D007, which
exists so the bottom player is never "just standing still".

Why it fits: positional grammar stays the core rule. **Where you stand decides where your piece goes**, which is the
side view's own version of "where a piece sits decides what it means". It needs no new pad and no new UI except the
FORGE label and the two-colour seal.

### 6.2 Layer 2: two brushes, one character (双笔成字)

The writing version: each child **writes their own half of one character on their own phone, at the same time**.

1. Two friends in a formation (beside, or one on the other's head), hands empty, both tap WRITE within a few
   seconds. Each pad opens as a **half-square**, following the formation: beside gives the left or right half; on a
   head gives the top or the bottom half. You see **your half live and your friend's half live** in their colour
   (strokes streamed through the server at, say, 10 a second).
2. Each writes any piece they can write here. Each half is read on its own phone, and each child taps their own
   guess.
3. When both have tapped, the server fuses the pair with the formation's operator: left + right, or top + bottom.
   - Valid: the two drawings come together in the air between them, in two colours, and print as one stone, held by
     the player who started (or the bottom/left one). Each spends one drop of ink.
   - A dud: each child gets **their own piece** as a stone in their hands (nothing is wasted). They can swap places
     and forge again by body (6.1), or on the ground.
4. On a **co-op isle** the goal's pieces lie nowhere, and its writing list lets you write only the pieces. The goal
   can still never be written by one person (CJ2-03 holds: two people write two pieces; the crew forges the goal).

What it teaches: the parts of a character, their order, and that **position is meaning**: writing 子 left of 女 makes
nothing. Two children have to agree out loud: "you go left".

### 6.3 Co-op isles (content idea)

- **Lean on a Friend (人木为休, crew)**: 木 sits on a pillar two players high. One stands on a friend's head to reach
  it. Then 人 + 木 by formation.
- **Partners (伙)**: 人 and 火 lie on two islands with no bridge. One player carries, the other writes. Forging
  needs them side by side, mid-river, on the boat (body forging works where ground forging cannot, 3D DESIGN §5.3).
- **Good (女子为好), two brushes**: nothing lies on the isle. Each writes their half.

Every crew isle stays winnable by one player (the 3D rule) unless it is marked `crew: true`, and then it is only in
the crew's isle list.

### 6.4 Questions for Design

1. How does a formation show that it is one (a frame round both bodies? the two stones joined by a brush line)?
   And what is the FORGE label's look in each style?
2. The half-square pad: on a phone held upright, does a half-square leave enough room to write? Or is it a full
   square with the friend's half shown faintly?
3. How do the two colours meet in the printed stone, a split seal, or the strokes in two inks?
4. What does a child see while waiting for a friend to finish their half?

## 7. Defect log

| Found by | Defect | Fix |
|---|---|---|
| crew-check (real touches, phone) | A tapped JUMP hops 1.17 high and a friend is 1.2 tall: a child tapping JUMP at a friend bumped their side every time and never got on | The ledge nudge (`ASSIST.nudge`, 0.3) now covers heads, as it does ledges and stones (sim-test: "a tapped hop into a friend climbs onto their head") |
| screenshots (four phones) | In the ink look a friend on your head floated a third of a body above it, and higher still over a carried stone: that hero is drawn 30 of 44 units tall and a carried thing lower than its sim box. In One Stroke, a friend floated over the small carried tree | Renderer only: ink draws a rider lower by what the friends under them lack (`sink`, `HEAD_UNITS` 30). In both painted looks, a carried stone with a friend on it stays a block (not the thing), so they stand on something |
| crew-check screenshot | The board opened with `?knock=push` posted "fly through friends" to the crew (it ignored its own link) | The board reads `knock` from its link and keeps it there |
| sim-test (writing it) | A restored world's snapshot differed as text: reused objects keep their old key order | Not a defect of the sim (the order means nothing). The test compares with sorted keys |
| sim-test (writing it) | Shoving moved you to `sx.v + dx` (past your own reach) | You follow the shoved friend to their edge, never further than your own step |

## 8. Known gaps

- **Not played on real phones over Wi-Fi yet.** The phones draw the server's isle with no prediction (CO-02). Input
  takes the Wi-Fi round trip plus up to 1/30 s to show, and drawing between snapshots adds another 1/30 s: about
  70-100 ms. That may feel late for jumps on a phone. Measure on John's phone first. If it is late, predict your own
  player on the phone (a knob, so the playtest can compare).
- **The camera follows only you.** A friend off-screen is not shown at the screen's edge (the off-screen pointer is for
  the goal only). The board does not show the isle, only the QR code and the crew.
- **Forging together is §6, not built.** In a crew today, forging is what it always was: stones on the ground.
- **The lab cannot play a crew.** `lab/autotest` is solo; its minds know nothing of bodies (alone, nothing changed).
  The page-mind was not rerun after this change. Solo `screen-test` and the solo checks pass.
- One crew per server, four players at most. A fifth phone plays alone. A tab closed for good keeps its place for
  30 s.
- Knock is one choice for the whole crew, not per player.

## 9. Hand-off

Newest first.

### Session 1 (2026-11-21): the crew, bodies, knock

**State**
- Built as in §1-§5: `BODY` and bodies in `sim.js`, `snapshot`/`restore`, the crew in `server.js` (WebSocket copied
  from `games/tongzhou-forge`), crew mode in `app.js` (`?crew=1`), all players drawn in all three looks, ☰ Thrown
  stones, the board's Play / Crew / Thrown stones rows, `POST /crew` and `/crew.json`.
- Launchers (`games/board`, John: "similarly i need startup scripts"): `board.sh 2d` takes `crew` (default) or
  `alone` and `off`/`push`/`loose`, in any order with the look and profile. `board-2d` and its variants now start
  a crew. New: `board-2d-rough` (knock push) and `board-2d-alone`. `install.sh` was run on this machine (`~/bin` and
  the Games menu). The board smoke test checks them (31).
- Tests: `sim-test` 457, `crew-test` 37 (new, port 3489), `crew-check-test` (new, port 3490, four headless phones),
  and the solo suite unchanged (`smoke-test`, `write-test`, `write-isle-test`, `screen-test` ×3).
- Not pushed (this network blocks github.com). Commits wait on local `master`.

**Resume**
```sh
cd games/tongzhou-forge-2d
node sim-test.mjs && node crew-test.mjs && node crew-check-test.mjs && node smoke-test.mjs
node server.js     # http://localhost:3300/board → 同舟 together; phones scan the code
# by hand: two browser tabs at http://localhost:3300/?crew=1 (each tab is a player)
```

**For John**
1. Play it with two or more phones (`board-2d`, or Games → "Board: Glyph Isles 2D (crew, ink scroll)", then scan): do jumps feel late (CO-02, §8)? Do children find the
   head-standing, and is shoving fun or annoying (`BODY.shove`)?
2. Is "slip past after 1 s of leaning" the right escape, or too easy to grief with?
3. Take §6 to Claude Design: layer 1 (body forging) is ready to build once the FORGE look is designed; layer 2 (two
   brushes) needs Design's half-pad.
4. Knock: off by default. Try `push` and `loose` and say if they stay.

**Next session's goal (suggested):** after Design, build §6.1 body forging. Acceptance: in `sim-test`, two players
holding 日 and 月 shoulder to shoulder, either presses GRAB, and 明 is in the presser's hands; a tower of 日 over 木
makes 杲; a dud keeps both. Plus a crew-check where two phones do it by real touches. Or, if phones feel late, first
add prediction for your own player.
