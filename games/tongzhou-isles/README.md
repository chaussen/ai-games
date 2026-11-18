# 同舟 · Glyph Isles — prototype V0.5

> Carry the characters. See what they do. Together.

A co-op game for one Wi-Fi and a room of phones. Every Chinese character is a
stone you can pick up, and **each one does what it means**: 木 thrown into a gap
grows into a bridge, 火 burns a thorn hedge, 水 puts out a wall of flames. Set two
stones side by side and they may become a new character: 木 + 木 = 林. Each stage
has a shrine waiting for one character, and when it gets it the world answers
(林 covers the island in trees, 明 turns night into day, 休 puts everyone to sleep).

This is the redesign of [同舟 V0.2](../tongzhou/) (the river-and-forge toy). It
answers one question: **is a character game fun when you have a body, the
characters are things, and nothing is a quiz?** It is a prototype with three
stages, not the game.

## The story, in one breath

The crew sails down a river in one boat (同舟, "in the same boat"). At every
isle mist has closed the river. The pavilion on the isle wants one character.
Bring it, the world answers, the mist lifts, **everyone climbs back aboard and
the boat sails on** to the next isle.

So each thing has one job: the **boat** is how a stage starts and ends, the
**pavilion** is the lock on the river, the **characters** are the keys and the
tools, and the isle is the playground in between.

## The look

同舟 means "in the same boat", so the game is set on water and painted like a
scroll (V0.2, after John's first play: "it feels like the merging of two games").

- **Isles in a river.** Grey-green rock stands in rippling water that thins into
  mist. Behind it one painted backdrop: ranges of ink mountains, a flat red sun
  (a pale moon at night), a few birds, paper grain.
- **The crew comes and goes by boat.** A junk with a battened sail and a red
  lantern carries everyone in, waits at the landing, and carries them out. Its
  deck is real floor. Every wobbler wears a bamboo rain hat. Falling off an isle is a
  splash with rings on the water.
- **Characters are brush-written, not printed.** Each one stands in the world as
  a brush character in the mineral ink of what it does (石绿 wood, 朱砂 fire,
  石青 water, 藤黄 light, 墨 people) with a rim of bare paper. The face is Ma Shan
  Zheng, the same one Inkblade uses, bundled as a 58 KB subset so phones do not
  fall back to a print font.
- **Root characters show how they were first drawn.** The card for 木 火 水 日 月
  人 carries the ancient pictograph beside the modern form.
- **The shrine is a pavilion** with vermilion posts; the character it wants
  hangs above the roof. The interface is paper, ink and a red 同舟 seal.

The engine, renderer and network layer are a fork of
[Wobble Works 3D](../wobble-works/3d/) (copied, not imported; this folder is
self-contained).

## Run it

```sh
cd games/tongzhou-isles
node server.js                # port 3000
PORT=3001 node server.js      # if a family server already has 3000
```

Open `http://localhost:3000/?board=1` on the TV or laptop. Phones scan the QR
code. No install, no npm, no CDN, no internet: Three.js r128, the QR library
and the brush font (SIL Open Font License, `vendor/MaShanZheng-OFL.txt`) are in
`vendor/`. Node 18+ (22+ to run the tests).

| URL option | Effect |
|---|---|
| `?board=1` | The shared screen: whole stage, QR code, roster |
| `?mute=1` | Do not speak the characters aloud |
| `?lite=1` | No shadows, for a slow device |

## How to play

| | Phone | Keyboard |
|---|---|---|
| Move | drag anywhere on the left half | W A S D or arrows |
| Jump | JUMP | Space |
| Leap (轻功) | JUMP again in mid-air: the button turns gold and says LEAP | Space again |
| Pick up / throw / set down / join / boost a friend | the orange button (it names what it will do) | E, F, J or Enter |
| Row the boat | stand on deck and walk into its side | same |
| Quick call | Here! · Wait · Go! · Nice | 1 – 4 |
| Respawn yourself | ⌂ | R |
| Restart the stage | hold ↺ for a second | Backspace (board) |

A keyboard player can play on the board screen itself: press a movement key.
Board keys: **N** / **P** next / previous stage.

The rules:

1. **The shrine shows the character it wants.** Bring it that character.
2. **A stone does what its character means.** Nothing needs to be forged first.
   - 木 林 森 (wood): thrown into a gap, it grows a bridge 3, 5 or 7 cells long.
   - 火 炎 焚 (fire): carried near thorns, it burns them down.
   - 水 沐 淋 (water): carried near flames, it puts them out.
3. **Two stones side by side may become one.** Face a stone while holding
   another and the button says JOIN. Thirteen pairs work, all real characters.
   A pair that makes nothing says so and nothing is lost.
4. **Stones are heavy.** A carrier walks slower and cannot leap in mid-air,
   but jumps as high as anyone (one step). A thrown stone flies flat and will
   not climb a step: pass it to a friend, or use a lift.
5. **Empty hands can leap.** Jump again in mid-air for one long, floating leap
   (轻功 qīnggōng, "light-foot"): about twice as far and one step higher. It
   crosses a 3-wide gap, so a free player can get ahead and catch a pass, but
   the stone still needs a bridge or a throw. The leap recharges in 4 seconds;
   picking up a gem recharges it at once. No leap clears thorns or flames.
6. **All aboard.** When the pavilion has its character, go back to the boat. It
   leaves when everyone awake is on deck, or 12 seconds after the first one
   boards (stragglers are picked up anyway), or after 40 seconds regardless.
7. **There is always more than one way.** The rules are physical, not scripted,
   so a stage has no single path. All of these are tested routes:
   - **Row the boat.** Walk into the side of the deck and the boat goes that
     way (a rail stops you walking overboard; where deck meets land you step
     off). It goes wherever there is water, carries stones, and parked in a gap
     it is a bridge. Stage 1 can be finished without 木 ever touching the gap.
   - **Boost a friend.** Empty hands facing a friend: the button says BOOST and
     flings them up and forward, stone and all. That crosses a 3-wide gap.
   - **Heads are steps, and springboards.** Stand on a friend; if they jump,
     you are sprung high.
   - **Walls are just tall.** Thorns and flames stand 2.6 high. One wobbler
     alone cannot jump them, but jump + leap from a friend's head (or a crate)
     can. Their tops throw you off again ("Ouch!").
8. **Nothing is lost.** A used-up stone grows back where it started. A stone
   that falls floats back. Fall yourself and you reappear on the last safe tile.

Every stone always shows its pinyin and meaning. The first time a character is
met, and every time one is made, a card shows it large and the browser's zh-CN
voice says it. Found characters stack up on the left edge.

The interface is English first. Players are learners of Chinese, so every
button, hint and message is plain English; Chinese appears as the characters
being played with (always with pinyin and meaning) and as small extras.

## Stages

| # | Stage | Shrine | Teaches |
|---|---|---|---|
| 1 | Two Trees · 双木成林 | 林 | carry, 木 becomes a bridge, 木 + 木 = 林 |
| 2 | Sun and Moon · 日月同明 | 明 | 火 burns thorns, 日 + 月 = 明 |
| 3 | Lean on a Tree · 人木为休 | 休 | 水 douses flames, 人 + 木 = 休, a stone rides a lift while a friend holds the plate |

Every stage can be finished by one player, and in more than one way; `sim-test.mjs` proves it.

### Stages are data, and a judge decides (V0.5)

Stages live as JSON in `content/stages/`, characters and recipes in `content/glyphs.json`;
`node tools/pack.mjs` packs them into `content.js`, which server and browser load. The format is
in [docs/STAGES.md](docs/STAGES.md).

`node tools/judge.mjs <stage.json>` accepts or rejects a stage. It checks the shape and the
placement, then two bots play the stage in the real `sim.js` with stick and button input. A stage
passes only if a recorded input log wins it, and only if there is a second way that avoids a
mechanic the first way needs. Every rejection is a sentence saying what to change.

```
PASS ✓ sun-and-moon
  way 1: needs boost + burn, about 15s
  way 2: needs bridge + burn, about 21s
```

`node tools/gen-stages.mjs --model <name> --n 10` asks a local model (any OpenAI-compatible
endpoint, Ollama by default) for stages, judges each, and sends the judge's sentences back until
the stage passes or the tries run out. Passing stages land in `content/candidates/` with their
routes. To ship one: move it to `content/stages/`, add its id to `content/order.json`, run
`node tools/pack.mjs`.

For other models taking over: [AGENTS.md](AGENTS.md) is the whole rulebook, and `tasks/` holds
small jobs, each with a check that prints `DONE`.

## Files

| File | Role |
|---|---|
| `content/` | Stages, characters and recipes as JSON. The source of truth. |
| `content.js` | Generated from `content/` by `tools/pack.mjs`. Never edited by hand. |
| `levels.js` | Map parsing and the joining rule. Shared by server and browser. |
| `sim.js` | Every rule. No I/O. |
| `server.js` | Static files, hand-rolled WebSocket, 60 Hz tick, 30 Hz snapshots |
| `app.js` | Three.js renderer, touch and keyboard input, HUD, speech |
| `sim-test.mjs` | Each stage solved solo, plus every rule, in under a second |
| `smoke-test.mjs` | Real server on :3456, real WebSocket play-through of stage 1 |
| `tools/judge.mjs`, `tools/judge/` | The judge: `lint.mjs` (shape and placement), `solve.mjs` (bots in the real sim), `rules/` (extra rules, one file each) |
| `tools/gen-stages.mjs`, `tools/gen-prompt.md` | Generate → judge → repair loop for a local model |
| `judge-test.mjs` | Shipped stages pass with two ways, broken stages fail for the right reason, the loop repairs a stage (about a minute) |
| `AGENTS.md`, `docs/STAGES.md`, `tasks/` | Handover: rules, stage format, task cards with checks |
| `tools/capture.py` | Screenshots from a running build (server on :3472, headless Chromium, four wobblers driven over the real protocol) |

```sh
node sim-test.mjs && node smoke-test.mjs && node judge-test.mjs
```

No test uses port 3000.

## Retrospective

### Why the first 同舟 was not fun, and what changed

| V0.2 (river and forge) | Why it hurt | Glyph Isles |
|---|---|---|
| No body. The player is a pair of hands over a tile tray. | Nothing is fun to do before you know any Chinese. | A wobbler that runs, jumps, carries and throws. Moving is fun on its own. |
| Forge first: two tiles must make a real character before anything happens. | The reading test sits in front of the toy. A wrong guess gives nothing. | Single characters work alone. Joining is an upgrade you discover, not a gate. |
| The payoff is a line of text ("a tree grows on the bank"). | "Does what it means" was told, not shown. | The stone turns into the thing, in the world, with a huge glowing character over it. |
| Pressure meter, troubles piling up, a bogged boat. | Punishes slow readers, who are the audience. | No timer pressure, no fail state, nothing lost. |
| Flat sepia, static, bare glyphs on beige tiles. | Reads as a worksheet. | Ink-wash isles on water; every glyph is brush-written and carries pinyin, meaning and an ink colour that says what it does. |

What was kept from the charter: characters act by meaning (P4 as element
families), forward play (P8: make and try, never recall on demand), nothing
stalls (P13), mixed levels in one room (a beginner carries and holds plates; a
reader spots that 日 and 月 make the shrine's 明). What was dropped for now:
split hands, stroke relay, tones, the hidden-information talk. They made the
game a coordination exam before it was a toy.

### What shipped

Three stages, 19 characters, 13 recipes, three world effects, three shrine
answers, a boat that carries the crew between isles, a mid-air leap on a
cooldown, phone and keyboard play for up to 16 on a LAN, spoken characters, a
found-characters strip. V0.4 adds a rowable boat, boosting, springing and
physical walls. 72 sim checks and 41 smoke checks pass.

### Defects found and fixed while building

- A used-up 木 grew back underneath a freshly made 林 and turned it into 森
  without anyone choosing to. Stones now regrow only on a clear pad
  (`sim-test.mjs` covers it).
- Setting a stone beside another became a pass whenever a friend stood further
  along the same line. Facing a nearby stone now wins: the button says JOIN.
- A newly made stone could pop straight into the hands of whoever stood there.
  It now lands first.
- V0.1 kept Wobble Works' pastel sky islands and put characters on printed
  tiles. It played like two games glued together. V0.2 replaced the whole look
  (see "The look").
- V0.2 had a boat that was scenery and a shrine that was the goal: two ideas
  that did not meet. V0.3 gives the boat the start and the end of every stage.
- The score card covered the shrine's answer. It waits four seconds, then
  shrinks to a strip so the way back to the boat stays visible.
- With the leap, thorns and flames could simply be jumped. V0.3 made them stop
  anything in the air above them, which was a scripted rule. V0.4 makes them
  2.6 high instead: too tall alone, climbable with help.
- V0.3 was "controlled": each obstacle had one answer (John: "should still
  provide the wide range of options", as the 2D silly-physics version did).
  V0.4 removes single answers: the boat is free on the water, friends can be
  thrown, walls have a height.
- V0.2 drifted toward Chinese-only labels (stage names, title card). Labels
  are English first again.
- Effects ran in slow motion on a slow renderer. They now follow real time.

- **Messages sat where nobody looked.** The stage hint, the leap intro and
  the errors were a pill at the top of the screen. They are now notes that
  slide in low on the left (goal, new move, character, oops), each character
  note with its glyph, pinyin and meaning; the goal is repeated when the crew
  lands.
- **A carrier's hop was no jump at all.** 0.32 high read as a dead button.
  Carriers now jump the normal 1.2; only the mid-air leap is withheld.

### Known gaps

- **The judge proves a floor, not a ceiling.** A pass is certain (the input log replays). A fail can
  be the bots' ignorance: they do not push crates, stand on heads, throw stones across gaps or up
  ledges, or hold a plate with a stone. Routes that need those are invisible to it. It also does
  not look for dead ends, and it plays with two bots, never one or sixteen.
- **The generator has only met a stand-in model.** `judge-test.mjs` runs the loop against a fake
  endpoint. How often a real small model produces a passing isle is not known; the script prints
  the pass rate and the reasons for rejection, which is the number to look at first.
- **The task cards have not been given to a weak model.** Each check was shown to fail now and to
  pass with a throwaway reference solution, nothing more.

- **V0.3 and V0.4 have not been played by a human.** The leap distance, its
  4-second recharge, the 12-second boarding wait, the boat's speed and the
  boost distance are first guesses.
- Shortcuts are allowed on purpose (rowing past the thorns skips 火), so a
  stage no longer guarantees its lesson. Whether that costs learning is a
  question for a classroom, not for the tests.
- A boat rowed away and abandoned strands whoever is left without a bridge
  until the stage ends (⌂ does not bring the boat back).
- When the boat leaves from somewhere other than its landing, it sails off in
  its usual direction and may pass through rock on the way out.
- Not run on a real phone. Speech depends on the device having a zh-CN voice.
- The bundled font subset holds about 130 characters. Add to the list in the
  subset command before using new ones:
  `python3 -m fontTools.subset MaShanZheng-Regular.ttf --text=... --flavor=woff2`.
- Only six root characters have a pictograph. Rock faces are flat colour, with
  no brush texture yet.
- Placement order does not matter yet (口 over 木 = 呆, 木 over 口 = 杏 is the
  obvious next rule: stack a stone on another for top-bottom, side by side for
  left-right).
- LAN only. For school use the plan is one Cloudflare Durable Object per class
  code running `sim.js` unchanged, with static files on Pages. Not built.
- Three stages is about five minutes of play.

## Home-network caveats

A phone that says "site can't be reached" almost always means this computer's
firewall is blocking the port. Phone and computer must be on the same subnet;
guest Wi-Fi with client isolation will not work. Plain `http://192.168.x.x` is
not a secure context, so there is no wake lock: a phone whose screen dims turns
its wobbler into a napping statue (which still weighs down a plate) and wakes it
when the screen comes back. A phone that drops off Wi-Fi keeps its wobbler for
90 seconds.
