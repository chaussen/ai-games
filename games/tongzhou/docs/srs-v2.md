# 同舟 — Software Requirements Specification v2

Fingerprint: TZ-SRS-v2.1 (2026-11-12). Consolidates v1.0–v1.6 and decisions TZ-D001 to TZ-D052 (v2.1 adds the V0 rework findings: spatial forge, deal guarantee, chips, wild characters from the first build, renderer contract). Supersedes `srs-v1.md`. Governed by `charter-v1.md`; if this file and the charter disagree, the charter wins and the conflict is logged.

Section numbers 3, 5.1, 7, 8.1–8.6, 9 and 10 match v1 so that task cards in `build-plan-v1.md` still point at the right place. Requirement IDs are stable; retired IDs are listed in §12. Each requirement group says which iteration first needs it.

## 1. Scope

A LAN co-op browser game. One PC runs a Node server. 2–30 players join from phones, tablets and laptops on the same network. No internet is needed at run time.

Out of scope for v1: internet play, accounts, speech recognition, native apps, hosting from a phone, devices older than John's own (they set the floor).

## 2. Terms

| Term | Meaning |
|---|---|
| Host | The PC running the server. May also show the river full-screen on a shared display (optional). |
| Controls | A player's private page UI: hand, forge, hold, writing pad. |
| River view | The three.js view of the river, shown above the controls on every capable device. |
| Boat | A crew of 1–5 seats. |
| Seat | One player's place. Odd seats are port (left), even seats starboard (right). |
| Tile | One component, or a whole character that cannot be split. Private to its holder. |
| Forge | The boat's shared, face-down assembly slots. |
| Hold | The boat's shared, visible store of finished characters. |
| Encounter | A thing drifting toward the boat. |
| Trouble | An encounter that reached the boat unanswered. Stays aboard until solved. |
| 气 | The boat's momentum, 0–10. Sets speed. |
| Pack | A JSON content bundle: tiles, characters, words, encounters, matrix. |
| Flight | Fixed 600 ms between the server accepting a shared action and it taking effect. |
| `at` | Server-clock time (ms) at which an event takes effect. |

## 3. Architecture

```
            Host PC                                   Same LAN / WLAN
 +--------------------------------+
 | node server/index.js           |      ws://HOST:8080/ws      +---------------------------+
 |  http: static files (client/,  | <-------------------------> | phone:  river view + controls |
 |        content/, data/)        | <-------------------------> | laptop: river view + controls |
 |  ws:   rooms, hands, forge,    | <-------------------------> | tablet: river view + controls |
 |        hold, ink, run, effects |                             +---------------------------+
 +--------------------------------+
        |  http://localhost:8080/world  (optional shared screen)   /host (teacher panel, localhost only)
```

| Layer | Technology | Rule |
|---|---|---|
| Server | Node.js 18 LTS or later, ES modules | Only npm dependency: `ws`. |
| Client controls | Vanilla JS, ES modules, DOM, 2D canvas for the writing pad | No framework, no bundler, no CDN. All files served by the host. |
| Client river view | Open (TZ-D050): plain canvas, three.js or another library, bundled locally and pinned once chosen | Lives only in `client/js/world*.js` behind the renderer contract (§8.7). Holds no game rules. Starts only after a capability check; on failure the device runs controls only. |
| Shared | `shared/*.js` pure functions | Imported by both server and client. No I/O, no DOM, no `Date.now()`, no `Math.random()` inside. |
| Data | JSON files | No database. |
| Tests | `node --test`; Playwright for pointer tests | Real dispatched pointer events only. Direct handler invocation is banned. |

### 3.1 Repository layout

```
tongzhou/
  AGENTS.md  PROGRESS.md  package.json
  docs/                charter, srs, build plan, content seed, briefs
  server/  index.js http.js hub.js room.js hands.js forge.js hold.js ink.js tone.js
           schedule.js run.js effects.js flotsam.js report.js
  shared/  protocol.js clock.js flight.js recipe.js strokeMatch.js quality.js
           conveyor.js rng.js hash.js
  client/  index.html station.html world.html host.html
           js/ net.js lobby.js station.js hand.js forgeView.js holdView.js inkPad.js
               tonePad.js glyph.js world.js castFx.js worldStrip.js result.js
               logbook.js audio.js host.js
           css/ base.css   vendor/ three.module.js qrcode.js
  content/ packs/seed.json  operators.json
  data/    mmah/ (raw source)  strokes/<codepoint>.json  dict.json
  tools/   build-data.js validate-pack.js make-pack.js sim-clients.js
  test/    *.test.js  e2e/*.spec.js  fixtures/
```

`world.js` builds the three.js scene. `worldStrip.js` embeds it above the controls and runs the frame governor.

## 4. Platform targets

| Class | Minimum | Budget |
|---|---|---|
| Host PC | Windows 10, macOS 10.15 or Linux; 4 GB RAM | Server under 150 MB RAM with 30 clients |
| Phone/tablet | WebGL 2: iOS 15+, Android with current Chrome | Controls are DOM; river view at 20 fps or better |
| Laptop | Current Chrome, Firefox, Edge or Safari with WebGL 2 | River view 30 fps at 960×540 |
| Network | 802.11n, up to 400 ms RTT, 5% loss | Game stays inside the fiction (charter §5.9) |

## 5. Functional requirements

### 5.1 Session and lobby (basic join from I1; QR, host panel and resume from I5)

| ID | Requirement |
|---|---|
| FR-101 | Server starts with one command and prints every LAN URL it is reachable on. |
| FR-102 | `/host` shows the join URL and a QR code. `/host` is served only to localhost. |
| FR-103 | A player joins by opening the URL, entering a nickname, and tapping a free seat. |
| FR-104 | A session token is stored in `localStorage`. Reopening the page resumes the same seat. |
| FR-105 | Host can create 1–6 boats, set seats per boat (1–5), choose a pack or lesson filter, set dials per seat, set run length, start, pause and end a run. |
| FR-106 | Players may join mid-run into a free seat and receive a full snapshot. |

### 5.2 Hands and flotsam (deal-only hands from I1; flotsam and tide from I4)

| ID | Requirement |
|---|---|
| FR-201 | Each seat holds up to 4 tiles (5 in a two-seat boat; dial). Hand contents are sent only to that seat. |
| FR-202 | A player can give a tile to another seat in the same boat. The tile is in flight for 600 ms. |
| FR-203 | Flotsam items spawn from the run schedule and are offered to the seats on the side they pass, while within grab range. |
| FR-204 | A grab is granted to the first valid request by server time, after backdating each request by half that client's measured RTT, capped at 200 ms. Losers get a "slipped away" event. |
| FR-205 | A full hand cannot grab. A player may drop a tile overboard; it becomes flotsam behind the boat for 20 s. |
| FR-206 | The flotsam schedule is a seeded shuffle of at least 3× the boat's total hand capacity per scene. |
| FR-207 | Flotsam glyphs are sent only to the seats on the offered side. Every other client receives the item without its tile and draws an unlabelled crate. |
| FR-208 | Tide: a tile held unplayed for 60 s leaves the hand and becomes flotsam offered to the opposite side. The holder sees a 10 s warning ripple on the tile. |
| FR-209 | Deal guarantee: after every deal or refill, the tiles across all hands in a boat must allow at least two different characters. If not, the newest tile is redrawn until they do. |
| FR-210 | The river provides: while a boat is stopped, each newly dealt or offered tile is chosen so that, with a tile already in the boat's hands, it makes a character that solves or partly solves a trouble aboard, if such a tile exists. Nothing indicates this to players. Host toggle. |

Before I4, hands refill by dealing from a seeded shuffle when a tile is used.

### 5.3 Forge (from I1)

| ID | Requirement |
|---|---|
| FR-301 | Each boat has one forge: a single square. There is no structure menu. |
| FR-302 | The first tile goes into the square. The second tile is placed where it belongs relative to the first: left, right, above, below, inside it, or around it. Drag works; so does tap (after the first tile, ghost positions appear to tap). Each placed tile is shown to everyone only as a filled position; glyphs are sent to other clients when both tiles are in (face-down forge). |
| FR-303 | A tile shows its slot variant when revealed (for example 水 in `left` renders 氵). |
| FR-304 | When both tiles are in, the server derives structure and part order from the placement (left/right → `LR`, above/below → `TB`, inside/around → `ENC`) and resolves it with `recipe.resolve` (§8.4). |
| FR-313 | Forgiving placement (default; per-seat dial, off at L3): if the placed arrangement is not a character but another arrangement of the same two tiles is, the tiles slide into that arrangement and bond. If the placed arrangement is a character, it always wins (呆 vs 杏). |
| FR-305 | Result `pack` or `wild`: the glyph, pinyin and picture (or gloss for wild) are revealed to the boat, the host speaks the character once, and the forge enters INKING. For a character with several listed readings the voice speaks each (FR-506). Result `none`: the placed tiles are revealed for 2 s, then return to their owners. No text is shown and nothing is lost. |
| FR-306 | Any crew member may remove a tile from the forge before the structure is complete; it returns to its owner. |
| FR-307 | There is no timer on making. The crew may abandon a bonded character; its tiles return to their owners. |
| FR-311 | Both tiles of a character may come from one seat. Inking and tone rules still apply. |
| FR-312 | A whole tile (an unsplittable character or an operator) is placed alone in the square and resolves by itself when the square is tapped again. |

Before I3, INKING and TONE are skipped: a bonded character goes straight to the hold.

### 5.4 Inking (from I3)

| ID | Requirement |
|---|---|
| FR-401 | In INKING every seat in the boat sees a writing pad (田字格). Outline visibility follows the seat's dial. |
| FR-402 | A stroke is captured from pointer down to pointer up, resampled to at most 24 points, normalised to a 0–1024 box, and sent. |
| FR-403 | The drawing client renders its own stroke at once as wet ink. Other seats see it on the `ink` event. |
| FR-404 | The server judges each stroke with `strokeMatch` (§8.3) against all remaining strokes: next in order locks (crisp); a later stroke is accepted out of order (smeared); no match fades. |
| FR-405 | In boats with 2+ occupied seats, a stroke from the seat that produced the previous locked or smeared stroke fades (Brush-Passes-Hands). |
| FR-406 | Locked and smeared strokes are drawn from the reference stroke path, not from the player's raw line. |
| FR-407 | When all strokes are placed, the forge enters TONE (if enabled), then the character goes to the hold. |
| FR-408 | The words "wrong", "incorrect", "error", "错" never appear in player-facing UI about a player's action. |

### 5.5 Tone seal (from I3)

| ID | Requirement |
|---|---|
| FR-501 | One occupied seat is chosen at random, excluding the seat of the final stroke and any seat with the far-oar badge. |
| FR-502 | That seat sees the finished character and tone choices per its dial. Pinyin is hidden; the voice already spoke it at bonding, so the seal is an echo. Input is a swipe shaped like the tone mark, or a tap on the mark. |
| FR-503 | Timeout is 8 s. Timeout counts as a tone miss and the primary reading is used. |
| FR-504 | After the seal, everyone sees the pinyin with tone and the host plays the syllable if audio is available. This happens on hit and on miss. |
| FR-505 | The tone step can be disabled per run. Quality is then rescaled over order and shape. |
| FR-506 | Polyphones (多音字): a character may list several readings in the pack. The tone of **any** listed reading is a hit. The sealed reading decides which meaning, picture and tags the held character takes. A listed reading with no meaning of its own uses the primary meaning. When a character merges into a word (FR-909), the word's reading and meaning replace its own. |

### 5.6 Hold and spending (from I1; targets from I2)

| ID | Requirement |
|---|---|
| FR-308 | Each boat has one hold: 2 places in a two-seat boat, 3 otherwise. A finished character enters the hold as glyph plus picture. The hold is visible to the whole boat and in the river view. |
| FR-309 | The forge cannot bond while the hold is full. Any crew member may release a held character; it casts with its domain default effect. |
| FR-310 | Any crew member may spend a held character (`spend`). Spending is the cast. |
| FR-615 | A spend names a target: a trouble aboard, or the nearest incoming encounter in range. |

### 5.7 Encounters, troubles, 气 and the run (from I2; conveyor from I4)

| ID | Requirement |
|---|---|
| FR-601 | Quality and tier are computed by `quality.js` (§8.5). |
| FR-602 | A cast happens when a held character is spent. The effect is resolved from the pack matrix against the target; with no target in range, the domain default applies. Potency follows the tier. |
| FR-603 | The river view shows the character as a large glyph dropping in, then the outcome as a short animation with one line of text. Render style follows the tier. |
| FR-604 | A run is generated from `(seed, pack, runLength)` by `schedule.js` and is identical for the same inputs. |
| FR-605 | River position is computed on every client from `conveyor.js` and the synced clock. No positions are transmitted. |
| FR-606 | An encounter that reaches the boat unanswered becomes a trouble aboard (`enc` state `aboard`) and stays until solved. Troubles are drawn on or beside the boat and listed in the controls. |
| FR-607 | 气 starts at 10, range 0–10, never negative. Each trouble aboard drains 气 at its pack rate (default 1 per 6 s) and may add its own effect. With no troubles aboard 气 recovers 1 per 4 s. |
| FR-614 | Boat speed v = 8 × 气/10 × (1 + 0.1 × consecutive clears) m/s, sent as `seg` events. The consecutive-clear count resets when a trouble boards. At v = 0 no encounter spawns. |
| FR-611 | Outcomes: solve removes the target; partial halves its drain; backfire doubles its drain for 10 s; flavour does nothing harmful. Every spend that does not solve also puts one chip on the target; three chips clear it. No action is ever without effect. |
| FR-610 | Encounters are drawn as things with at most a small character label. No UI shows which tags, domains or characters an encounter responds to. |
| FR-616 | There is no lose state. A run lasts a fixed time (default 8 min, host setting). The result shows distance, troubles cleared and discoveries. |
| FR-608 | The result screen lists characters cast with tier, and first-time discoveries (character × encounter outcomes). It shows no per-player ranking. |
| FR-609 | Every cast and outcome is appended to a run log on the host (`runs/<timestamp>.json`). |
| FR-612 | The logbook lists characters forged (glyph, all listed readings, picture) and outcomes seen (character × encounter → what happened). It shows nothing undiscovered. Viewable from any device at any time. |
| FR-613 | The first river of a new crew follows the scene order in charter §5.14. |

Before I4 there is no conveyor: encounters appear on a countdown derived from the same speed formula.

### 5.8 River view (from I4; prototyped in V0)

| ID | Requirement |
|---|---|
| FR-617 | Every device shows the river view above its controls when the capability check passes. `/world` remains available as a full-screen view for an optional shared screen. |
| FR-618 | No fixed art budget. The look follows the approved style frame; the frame governor (FR-707) is the only limit. |
| FR-619 | The river view implements the renderer contract (§8.7). It shows depth (things far away are later), what is incoming, and what is aboard with its chips. The game stays fully playable with the river view removed, because incoming things and troubles are also listed in the controls. |
| FR-620 | Flotsam crates show no glyph in the river view (FR-207). |

### 5.9 Lag as play and resilience (flight from I4; the rest from I5)

| ID | Requirement |
|---|---|
| FR-701 | Every event that changes shared state carries `at = acceptTime + 600`. Clients animate toward `at` and apply the change at `at`. |
| FR-702 | Clients estimate clock offset continuously (§8.1) and expose `serverNow()`. |
| FR-703 | A seat whose median RTT exceeds 400 ms for 10 s gets the far-oar badge: grab window doubled, excluded from tone seal. The badge clears after 10 s under 250 ms. |
| FR-704 | A seat with no heartbeat for 5 s is marked dozing. Its tiles become flotsam for 20 s. Reconnecting within 60 s restores the seat and any tiles not yet taken. |
| FR-705 | If a client receives nothing for 2 s, it shows the fog-bank overlay and stops its local river clock. On reconnect it requests a snapshot. |
| FR-706 | The server sends a full snapshot at 2 Hz including a state hash. A client whose hash differs twice in a row requests a resync. |
| FR-707 | The river view on each device measures its frame time; above 66 ms average it lowers its pixel ratio, above 120 ms it hides itself and the device continues with controls only. |

Before I4, events apply on arrival with no flight delay and no clock sync.

### 5.10 Fleet (I7; partly open)

| ID | Requirement |
|---|---|
| FR-801 | Up to 6 boats share one river, each in a lane. |
| FR-802 | A tile may be thrown to an adjacent boat (flight 1200 ms); it lands in that boat's nearest-side flotsam offer. |
| FR-803 | Effects flagged `area` in the pack apply to adjacent lanes at half potency. |
| FR-804 | OPEN: how each boat's 气 and speed combine in a fleet (one convoy speed or separate), and what a bogged boat's crew can do for neighbours. Decide before I7; the v1.0 capsize rule is retired. |

### 5.11 Content and teacher tools (I6)

| ID | Requirement |
|---|---|
| FR-901 | Packs are validated by `tools/validate-pack.js` against §7 and the matrix authoring rules in `content-seed-v1.md` §5. |
| FR-902 | Any real character absent from the pack resolves as `wild`: it bonds, shows its dictionary gloss, and takes its radical's default effect. This is in from the first build (TZ-D049); before the full data pipeline it uses a precomputed list such as `wild-seed.json`. |
| FR-903 | Audio fallbacks, in order: bundled clip `audio/<pinyin+tone>.mp3`; `speechSynthesis` with a `zh` voice; pinyin text only. |
| FR-904 | Host can export a run report as CSV: character, reading, tier, time, boat. |
| FR-905 | `tools/make-pack.js` takes a vocabulary list (CSV: entry, optional lesson tag) and writes a pack: classes per charter §5.12, tiles needed, domain defaults, unsplittable entries as whole tiles. |
| FR-906 | The same tool writes a fit report: counts and lists of vivid (authored), default-only, operator, word, polyphone (for John to choose listed readings), and any entry it could not classify. |
| FR-907 | The host can run a whole pack or filter by lesson tag. |
| FR-908 | Operator tiles are whole tiles. Once inked and held, an operator is spent onto another held character and changes it per `content/operators.json`, which is independent of any pack. |
| FR-909 | When two held characters sit in adjacent hold places and form a word in the pack, they merge into one held word with its own reading, picture and tags. |

## 6. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-01 | No request leaves the LAN at run time. No analytics. |
| NFR-02 | Messages are JSON, each under 1 KB except snapshots (under 8 KB) and stroke data (lazy, per character). |
| NFR-03 | Server handles 30 clients at 2 Hz snapshots under 5% of one core on the host class in §4. |
| NFR-04 | All gameplay text supports Chinese and English labels via a strings table. |
| NFR-05 | Colour is never the only carrier of state. Touch targets at least 44 px. |
| NFR-06 | Each source file at most 250 lines. Each function at most 40 lines. |
| NFR-07 | Every shared module has unit tests. `npm test` runs with no network and no browser. |
| NFR-08 | The build fingerprint (`TZ-<iteration>-<n>`) is shown on screen and bumped on every redistribution. |
| NFR-09 | Only nicknames are collected. Run logs stay on the host. |
| NFR-10 | Any rendering library is bundled locally, pinned to one version recorded in `PROGRESS.md`, and used only inside the renderer. |

## 7. Data schemas

### 7.1 Pack (`content/packs/<name>.json`)

```json
{
  "id": "seed", "version": 2,
  "tiles": [
    { "id": "shui", "base": "水", "variants": { "left": "氵" },
      "nameZh": "三点水", "pinyin": "shuǐ", "domain": "water", "level": 1 }
  ],
  "chars": [
    { "char": "晴", "structure": "LR", "parts": ["ri", "qing"], "level": 2,
      "class": "thing", "lesson": "L3",
      "readings": [
        { "pinyin": "qíng", "tone": 2, "meaning": "sunny", "picture": "sun", "tags": ["weather-clear"] }
      ] },
    { "char": "好", "structure": "LR", "parts": ["nv", "zi"], "level": 1, "class": "thing",
      "readings": [
        { "pinyin": "hǎo", "tone": 3, "meaning": "good", "picture": "thumbs-up", "tags": ["cheer"] },
        { "pinyin": "hào", "tone": 4, "meaning": "to be fond of", "picture": "heart-eyes", "tags": ["cheer"] }
      ] }
  ],
  "words": [
    { "word": "火山", "chars": ["火", "山"], "pinyin": "huǒshān", "meaning": "volcano",
      "picture": "volcano", "tags": ["fire", "earth"] }
  ],
  "encounters": [
    { "id": "fog", "nameZh": "雾", "name": "Fog", "picture": "fog",
      "aboard": { "drainPer6s": 1, "effect": "dimHorizon" } }
  ],
  "matrix": { "weather-clear": { "fog": { "result": "S", "text": "The fog lifts." } } },
  "domainDefaults": { "water": { "type": "riverLevel", "amount": 1 } }
}
```

| Rule | Detail |
|---|---|
| `parts` order | `LR` = [left, right]; `TB` = [top, bottom]; `ENC` = [outside, inside]. A whole tile has `structure: "WHOLE"` and one part. |
| `readings` | At least one. The first is primary. Only readings John lists are accepted; rare or literary readings are left out. |
| `class` | `thing`, `default`, `operator`, `whole`. Optional; `make-pack` fills it. |
| `picture` | An asset id, an emoji, or a short gloss. Placeholder until the art pass. |
| `result` | `S` solve, `P` partial, `B` backfire, `F` flavour. |

### 7.2 Stroke data (`data/strokes/<codepoint>.json`)

```json
{ "char": "木", "strokes": ["M 121 480 L ... Z"], "medians": [[[121,480],[870,470]]] }
```

Source: Make Me a Hanzi `graphics.txt`. Coordinates are a 1024 box with y up; to draw on a 2D canvas apply `y' = 900 - y`. Confirm the licence files of the source repository at card T301 and ship them in `data/mmah/`.

### 7.3 Dictionary (`data/dict.json`)

`{ "晴": { "pinyin": ["qíng"], "def": "clear weather", "decomp": "⿰日青", "semantic": "日", "phonetic": "青" } }` from Make Me a Hanzi `dictionary.txt`.

### 7.4 Operators (`content/operators.json`)

```json
{ "不": { "op": "invert" }, "很": { "op": "scale", "x": 1.5 }, "太": { "op": "overshoot" },
  "吗": { "op": "preview" }, "了": { "op": "instant" }, "再": { "op": "repeat" }, "也": { "op": "carryOver" } }
```

## 8. Algorithms (reference; implement exactly)

### 8.1 Clock sync (`shared/clock.js`)

```
sample(t0, serverTime, t1): rtt = t1 - t0; offset = serverTime - (t0 + t1)/2
keep last 8 samples; use the offset of the sample with the smallest rtt
serverNow(localNow) = localNow + offset;  medianRtt = median of kept rtts
```
Client pings every 2 s (every 500 ms for the first 4 s).

### 8.2 Conveyor and 气 (`shared/conveyor.js`)

```
segments: [{ t0, s0, v }]            // server time ms, river metres, metres/second
s(t)  = s0 + v * (t - t0) / 1000     using the last segment with t0 <= t
dist(obj, t) = obj.s - s(t)          // metres ahead of the boat; visible when 0 < dist < 480
                                     // dist <= 0 and unanswered -> trouble aboard

speed(qi, streak) = 8 * (qi / 10) * (1 + 0.1 * streak)     // m/s; a new segment on every change
qi update each second:  qi += (troubles == 0 ? 1/4 : -sum(drainPer6s)/6);  clamp to 0..10
spawn spacing: one encounter every ~360 m of river; nothing spawns while v == 0
```

In the three.js scene an object sits at `z = -dist`, `x` by lane or side. All values above live in one exported `TUNING` object.

### 8.3 Stroke matching (`shared/strokeMatch.js`)

```
input: user points U (<=24, 0..1024 box), reference medians M[k] for remaining strokes
resample U and each M[k] to 16 points by arc length
for each k:
  dStart = dist(U[0], M[k][0]) / 1024;  dEnd = dist(U[15], M[k][15]) / 1024
  lenRatio = len(U) / len(M[k])
  cosDir = cosine between (U[15]-U[0]) and (M[k][15]-M[k][0])   // skip if both lengths < 60
  mean = average dist(U[i], M[k][i]) / 1024
  ok = dStart < 0.25 && dEnd < 0.25 && lenRatio > 0.4 && lenRatio < 2.5
       && cosDir > 0.6 && mean < 0.18
  shape = clamp(1 - mean / 0.18, 0, 1)
pick the ok candidate with the smallest mean
return { index: k | -1, shape }
```
All thresholds live in one exported `TUNING` object.

### 8.4 Recipe resolve (`shared/recipe.js`)

```
resolve(structure, partIds, pack, dict):
  1. find pack.chars where structure and parts match exactly -> { kind:'pack', char }
  2. else build the glyph list from tile base forms; look up any dict entry whose
     decomp equals structure symbol + parts (⿰ LR, ⿱ TB, ⿴/⿵/⿶/⿷ ENC) -> { kind:'wild', char }
  3. else { kind:'none' }
```
Slot order matters: `TB [kou, mu]` is 呆, `TB [mu, kou]` is 杏. Step 2 is in from the first build. If the placed arrangement resolves to `none` and forgiveness is on (FR-313), try the other arrangements of the same two tiles in this fixed order and take the first hit: LR ab, LR ba, TB ab, TB ba, ENC ab, ENC ba.

### 8.5 Quality (`shared/quality.js`)

```
order = lockedCount / strokeCount;  shape = mean shape of locked and smeared strokes
tone  = 1 if the sealed tone equals the tone of any listed reading, else 0
Q = 0.45*order + 0.35*shape + 0.20*tone        // tone disabled: Q = 0.56*order + 0.44*shape
tier = Q >= 0.80 ? 'kai' : Q >= 0.50 ? 'xing' : 'cao';  potency = { kai:1.0, xing:0.7, cao:0.4 }
```
Before I3 every character is tier `kai`.

### 8.6 Forge and hold state machines

```
Forge:
EMPTY --place--> ASSEMBLING --structure complete--> RESOLVING
RESOLVING --none--> REVEAL-MISS (2 s, tiles go home) --> EMPTY
RESOLVING --pack|wild--> REVEAL --> INKING --all strokes--> TONE --seal|timeout--> to HOLD --> EMPTY
INKING --abandon--> EMPTY (tiles go home)
RESOLVING is refused while the hold is full.

Hold place:
FREE --character arrives--> HELD --spend(target)--> FREE     (the cast happens here)
HELD --release--> FREE                                       (domain default effect)
HELD + adjacent HELD forming a pack word --> one HELD word   (I6)
HELD operator --spend(onto)--> modifies the other HELD character, operator place FREE  (I6)
```

### 8.7 Renderer contract (locked; technology behind it is open)

```
createRenderer(containerElement, assets) -> {
  render(view, nowMs),      // every frame
  resize(width, height),
  pick(x, y) -> id | null,  // incoming thing or trouble under this point
  dispose()
}
view = {
  boat:     { qi, speed, streak, distance, stopped },
  incoming: [ { id, kind, label, picture, dist } ],          // dist in metres, 0..480
  aboard:   [ { id, kind, label, picture, chips, drainMul } ],
  crates:   [ { id, dist, side } ],                          // never a glyph
  hold:     [ { char, pinyin, meaning, picture, tier } | null ],
  fx:       [ { type: 'bond'|'cast'|'outcome'|'board'|'clear', char?, targetId?, result?, text?, at } ],
  timeLeft
}
```

| Rule | Detail |
|---|---|
| No rules in the renderer | It never changes `view`, decides nothing, and reads no data files except its own art. |
| No input except `pick` | Everything else goes through the DOM controls. |
| Swap test | Replacing the renderer file needs no change anywhere else. A text-only renderer must pass. |
| Replay | A recorded sequence of `view` objects can drive any renderer with no server, for comparing looks. |

## 9. Protocol (`shared/protocol.js`)

Every message is `{ "t": "<type>", ...fields }`. Server events that change shared state include `at` (from I4; before that, omitted).

| Dir | Type | Fields | Notes |
|---|---|---|---|
| C→S | `hello` | token?, name | First message |
| S→C | `welcome` | id, token, serverTime, build | |
| C→S | `ping` | t0 | |
| S→C | `pong` | t0, serverTime | |
| C→S | `sit` | boat, seat | |
| S→C | `lobby` | boats[], seats[], pack, running | Broadcast on change |
| C→S | `host` | cmd: start/pause/resume/end/config, args, hostKey | Localhost only |
| S→C | `run` | seed, segments[], schedule[], startAt, runLength | Full run description |
| S→C | `seg` | t0, s0, v | Speed change |
| S→C | `hand` | tiles[] | Private |
| C→S | `give` | tileId, toSeat | |
| C→S | `grab` | floatId | |
| C→S | `drop` | tileId | |
| S→C | `float` | id, tile? (offered seats only), s, side, at | Spawn |
| S→C | `floatGone` | id, bySeat?, at | Taken or passed |
| C→S | `place` | tileId, pos: first/left/right/above/below/inside/around | `pos` of the second tile is relative to the first |
| C→S | `unplace` | tileId | |
| S→C | `forge` | boat, state, slots{} (filled flags only until complete), char?, readings?, picture?, strokeCount?, at | State change |
| C→S | `abandon` | | Leave INKING |
| C→S | `stroke` | pts[[x,y]…] | Max 24 points |
| S→C | `ink` | boat, seat, verdict: lock/smear/fade, index?, shape?, at | |
| S→C | `toneAsk` | choices[] | Private to chosen seat |
| C→S | `tone` | n | |
| S→C | `hold` | boat, places[] (char or word, pinyin, meaning, picture, tier), at | On change |
| C→S | `spend` | place, target?, onto? | `target` = encounter id; `onto` = another hold place, for operators |
| C→S | `release` | place | |
| S→C | `cast` | boat, char, pinyin, tier, q, result, text, encounterId?, at | |
| S→C | `enc` | id, kind, state: incoming/aboard/resolved, drain?, chips?, at | |
| S→C | `qi` | boat, value, streak, at | |
| S→C | `seat` | boat, seat, status: awake/dozing/far | |
| S→C | `snap` | full state, hash | 2 Hz |
| C→S | `resync` | | Request snapshot |
| S→C | `end` | reason, summary | |

Invalid or out-of-state client messages are ignored silently and counted in a server metric.

## 10. Wireframes (ASCII, low fidelity)

### 10.1 Device, portrait phone, building

```
+----------------------------------+
| RIVER VIEW (three.js)            |
|   far: 🌫   mid: 🐉   crate ?     |
|   ==BOAT==  aboard: 🪨 🚪         |
+----------------------------------+
| 气 ●●●●●●●○○○  ▶▶  412 m   5:10  |
+----------------------------------+
| HOLD (shared) [晴 ☀] [杏 🍑] [  ] |   tap one, then tap a trouble
+----------------------------------+
| FORGE (shared, face down)        |
|          . above .               |
|   left  [   ▮   ]  right         |   first tile in the square;
|          . below .               |   second goes where it belongs
|   (or onto it = inside)          |
+----------------------------------+
| MY HAND (private)                |
| [ 青 ] [ 木 ] [ 口 ] [    ]      |
| give to: (1) (3)        [drop]   |
+----------------------------------+
| from my side: [ 日 → grab ]      |
+----------------------------------+
```

### 10.2 Device, inking

```
+----------------------------------+
| RIVER VIEW (keeps running)       |
+----------------------------------+
| 气 ●●●●●●●○○○        晴  3/12    |
+----------------------------------+
|  +----------------------------+  |
|  |             |              |  |   ghost outline per dial
|  |   田字格 writing pad        |  |   own stroke = wet ink at once
|  |-------------+--------------|  |
|  |             |              |  |
|  +----------------------------+  |
|  brush: with you / with others   |   icon only, no text verdicts
|  HOLD stays tappable             |
+----------------------------------+
```

### 10.3 Device, tone seal (chosen seat only)

```
+----------------------------------+
|               晴                 |
|   [ ˉ ]   [ ˊ ]   [ ˇ ]   [ ˋ ]  |   swipe the shape or tap
|   ▓▓▓▓▓▓▓▓░░░░  time             |
+----------------------------------+
```
For 好 both ˇ and ˋ are hits and lead to different meanings.

### 10.4 River view, full screen (optional shared screen)

```
+------------------------------------------------------------+
|  mountains                         horizon (fog at 480 m)   |
|              🌫 fog          crate ?                         |
|           /        🐉 beast            \                     |
|         /                                \                   |
|       /        ====BOAT 1====              \                 |
|     /     aboard: 🪨 🚪    hold: [晴][炮]     \               |
+------------------------------------------------------------+
| 气 ●●●●●●●○○○ | speed ▶▶▶ | distance 412 m | 5:10 | TZ-I4-3 |
+------------------------------------------------------------+
```

### 10.5 Host panel

```
Join: http://192.168.1.20:8080   [QR]
Pack: [seed ▼]  Lessons: [all ▼]  Boats: [1]  Seats: [3]  Run: [8 min]  Tone step: [on]
Boat 1: (1) Mei L1  (2) Tom L2  (3) —                 [Start] [Pause] [End]
```

## 11. Verification requirements

| ID | Requirement |
|---|---|
| V-01 | Unit tests for every `shared/` module, including negative cases (non-character combinations, out-of-order strokes, same-seat strokes, a second reading's tone counted as a hit). |
| V-02 | `tools/sim-clients.js` runs N bot clients with injected latency, jitter and loss, plays a scripted run, and asserts an identical final state hash on all bots. |
| V-03 | Playwright specs drive two pages with real pointer events to build and ink 木 and 明. Canvas offsets are measured, not assumed. |
| V-04 | Every iteration ends with a live play session run by John. Synthetic passes do not substitute. |
| V-05 | A device run on John's oldest phone and laptop is recorded at I5 with measured frame times. |
| V-06 | Verdicts are valid only for the fingerprint they were run on. |

## 12. Retired from v1

| Item | Replaced by |
|---|---|
| Canvas 2D pseudo-3D and `shared/projection.js` | three.js river view (FR-617–620) |
| Scroll edge; run ends at 气 0 | No lose state; 气 as momentum (FR-607, 614, 616) |
| One-off on-miss consequences | Troubles aboard with ongoing drain (FR-606, 611) |
| 45 s dissolve timer on a bonded character | No timer on making (FR-307) |
| Responds-to icons on encounters | Banned (FR-610) |
| Instant cast after tone | Hold, then spend (FR-308–310, 615) |
| Station "world strip" as a reduced renderer | Full river view on every capable device (FR-617) |
| Chrome 70 / iOS 12 floor | WebGL 2 floor (§4) |
| FR-804 capsize and tow | OPEN, to be redesigned (FR-804) |
| Six named forge slots and a structure switch | One square, spatial placement, forgiving by default (FR-301, 302, 313) |
| three.js as the fixed river technology; art budget caps | Renderer contract with open technology; no caps (§8.7, FR-618) |
| Wild characters scheduled for I6 | In from the first build (FR-902) |
