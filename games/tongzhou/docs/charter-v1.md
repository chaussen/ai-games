# 同舟 Tóngzhōu ("Same Boat") — Charter v1

| Field | Value |
|---|---|
| Fingerprint | TZ-CH-v1.8 (2026-11-12) |
| Track state | PRE-PROTOTYPE. No code exists. Next gate: G0 (paper). |
| Source of truth | This file. Companions: `srs-v2.md`, `build-plan-v1.md`, `content-seed-v1.md` |
| Router | John. Chat = analysis/arbitration. Design = feel/playtest. Code = implementation (weak-model pool). |

## 0. Cold pickup (read this first)

同舟 is a co-op game for 2–5 players per boat (up to 6 boats in one room) on a LAN. A crew drifts down an ink-wash river drawn in fake 3D. Things approach from the horizon. As they drift, the crew makes Chinese characters and stores them in a shared hold, then spends them on whatever has arrived, and it **does what it means** in the world. No single player can make a character alone: components sit in different hands, strokes must be written in relay, and the fastest way to coordinate is to say things out loud in Chinese. One PC runs the server; everyone joins in a browser.

Title source: 同舟共济, "in the same boat, cross together".

## 1. Brief and hard requirements

| ID | Requirement (from John) | How 同舟 meets it |
|---|---|---|
| R1 | 3D, fake allowed | River view in 3D or fake 3D. The rendering technology is open behind a locked renderer contract (P12). Depth axis has a job: it is the schedule (P2). |
| R2 | Co-op on LAN/WLAN, one machine serves, quick join | Node server on one PC, browser clients, URL + QR join. |
| R3 | Old laptops/phones, lag tolerated or turned into play | Every device shows its own river view above its controls if it can run the river renderer; a device that cannot is a controller only or sits out. A shared big screen is optional. World motion is computed locally from a synced clock, so extra views cost no network. Lag is absorbed by ink flight and drying (§5.9). |
| R4 | Mixed levels in one session | Beginners' whole characters are the advanced players' radicals (P5). |
| R5 | Scale 2–4 at home and 20–30 in class | Boat = 2–5. Class = fleet of boats on one river. |
| R6 | Core loop carries component structure, handwriting/stroke order, recognition+meaning, sound | One character passes through four hands (§5.1). |
| I1 | Chat's job ends at docs | No game code in these deliverables. |
| I2 | Weak free/local models implement over many iterations | Task cards, frozen contracts, tests first (`build-plan-v1.md`). |

## 2. Brainstorm shootout

| # | Candidate | One line | Verdict | Reason |
|---|---|---|---|---|
| C1 | Bridge Orders | Spaceteam with hanzi: your screen orders things only others can do | RETIRED (TZ-D025) | Proven loud fun, but orders are a correctness check and recall-first. |
| C2 | Triplet Sculpture | Each player sees a different projection of one 3D block | KILLED | Dark-twin fail: works identically with Latin letters. Skill is geometry. |
| C3 | Dragon-boat Rhythm | Paddle strokes are character strokes, on the beat | KILLED | Rhythm skill is reskin-lossless; identity overlaps Inkblade. Its clock trick is kept. |
| C4 | Voxel Co-build | Build a world out of characters, Minecraft-style | KILLED | Needs positional sync and real 3D on old devices. Substrate is navigation, not characters. |
| C5 | Glyph Tower Defence | Characters are towers | KILLED | Fun Gate fail: characters are skins. Co-op is parallel play. |
| C6 | 同舟 split-glyph crew | Nobody holds a whole character | **SELECTED (Track A)** | See §3. |
| C7 | Manual-and-Bomb | Keep Talking with a hanzi manual | KILLED | Content is consumed once; caps at 2–3 players. |

## 3. First-principles analysis

### 3.1 The unexamined assumption
Two assumptions, shared by Hanzi Sandbox, Inkblade and almost every hanzi game:

1. **One learner on one screen holds the whole character.** Multiplayer is then bolted on as a shared space.
2. **Lag is a wire problem.** So the design fights it with netcode.

Both are rejected here. A character has four faces (形 form, 音 sound, 义 meaning, 笔 strokes). Put the faces in different people and the character can only exist when it crosses the room. And the fastest channel on a LAN is not the wire. It is the air: speech has zero lag, costs nothing on a 2014 phone, and is itself the sound skill.

### 3.2 Substrate
The game is made of **information gaps between people**, bridged by spoken Chinese. Player skill attaches to four predictions:

| Prediction | What the player gets from it |
|---|---|
| Semantic radical → domain of effect | "氵 will do something watery" even for an unknown character |
| Phonetic component → sound | Hearing "qíng", reach for 青 |
| Structure → slot | 口 over 木 is 呆, 木 over 口 is 杏 |
| Stroke order → whose turn | The brush passes hands in stroke order |

### 3.3 Dark-twin test
Replace hanzi with arbitrary symbols and random recipes. Team coordination survives (the Spaceteam chassis, roughly a third of total skill). All four predictions in §3.2 vanish: every recipe becomes a lookup, every relay becomes memorised order. Skill changes materially. **PASS**, with the chassis honestly declared theme-independent.

### 3.4 Identity claim
> **No one holds a whole character. A crew must speak it, part it and stroke it into the world together, and it then does what it means.**

### 3.5 Nearest relatives and distance

| Relative | Shared | Distance |
|---|---|---|
| Spaceteam | Asymmetric screens, shouting | Their words are noise. Ours are real names, sounds and tones, and solutions are open. |
| Overcooked | Co-op assembly under pressure | Their stations are positions. Ours are representations of one object. No twitch, no positional sync. |
| Scribblenauts | A word becomes a thing that acts | Solo and typed there. Here it is built from parts by a crew. |
| Jackbox | Phones as controllers, one host | Architecture borrowed outright. |
| Hanzi Sandbox | Characters as matter, recipes | Solo and spatial there. Its 形声 exclusion is reversed here (P4). |
| Inkblade | Stroke order is mechanical | Solo combo there. Here order is the turn order between people. |
| 笔画接龙 (classroom stroke relay) | Relay writing | Known classroom practice, given stakes and a world. |

### 3.6 Where theory is wrong or silent

| Theory | Use | Limit here |
|---|---|---|
| Flow | Challenge-skill balance | Assumes one player. A mixed crew needs interdependence, not matched difficulty. |
| Intrinsic integration (Habgood) | Content inside the mechanic | Stops at mechanics. We put content inside the communication channel. |
| MDA | Vocabulary | Treats the room as outside the system. Here the room is the fast half of the system. |
| Koster | Fun is pattern learning | Fits well: radical and phonetic regularities are the patterns. |

## 4. Named principles (original contributions)

| ID | Name | Definition |
|---|---|---|
| P1 | **Air-Gap Principle** | Anything latency-critical travels through the room as speech. The wire carries only facts that tolerate a second of delay. |
| P2 | **Depth-is-Time** | The depth axis of the fake-3D view is the schedule. Lag costs distance to the horizon, never correctness. |
| P3 | **Split-Glyph Doctrine** | Until a character bonds, its 形 音 义 笔 are never together on one screen. Bonding is the reveal. |
| P4 | **Radical-as-Physics** | The semantic radical fixes the domain of a character's effect; the phonetic is used only for sound. This makes 形声 characters the engine. Supersedes the Hanzi Sandbox 六书 constraint for this game only. |
| P5 | **Seed-Character Ladder** | A beginner's whole characters (日 木 口 女) are the advanced player's radicals, so mixed levels are interdependent by the writing system itself. |
| P6 | **Drying-Ink Latency** | Every shared action has a visible physical duration (flight, drying) at least as long as worst expected round trip. Network delay hides inside it. |
| P7 | **Brush-Passes-Hands** | No player may write two strokes in a row. Stroke order becomes turn order without any assignment UI. |

| P8 | **Forward Play** | Play runs tiles → character → use, never problem → recalled character → tiles. Knowledge is a shortcut, never a key. |
| P9 | **Show After, Never Before** | The game shows what a thing is and what an action did. It never shows in advance what will work. A picture on a forged character is the thing being itself; an icon saying "this solves that" is a hint and is banned. |
| P10 | **Closed-Class Operators** | Function words (不 很 太 吗 了 再 也) are operators on other characters in the hold. They are a small closed set, authored once, valid in every pack. |
| P11 | **Playable, Not Vivid** | Every character must be makeable, inkable, sayable and castable. Not every character needs an authored effect. The three-interactions Toy Test applies to each radical domain, not each character. |
| P12 | **Detachable View** | The river view is a pure function of game state behind a fixed contract. It holds no rules and can be replaced by any technology, or removed, without touching the game. |
| P13 | **Nothing Stalls** | With no lose state, a stuck state is the real failure. So every action changes something (a spend that solves nothing still chips), and the deal always allows at least two characters. |

Inherited and still binding: Fun Gate, Differentiated Failure, No-inert-glyph, Stability rule ("never surface wrong"), dark-twin test.

## 5. Game design

### 5.1 Core loop (forward play, v1.2; supersedes the v1.0 recall-first loop, see TZ-D018)

Making and using are separate. The forge is always open while things drift in; the crew tackles them when ready. Nobody is asked to recall a character from its meaning.

| Phase | Step | What happens | Skill carried | Channel |
|---|---|---|---|---|
| Make | 1 Call | Players read their tiles aloud and agree what to try: "我有日 rì. 你有什么?" Hands are private. | Sound, component names | Voice |
| Make | 2 Part | The forge is one square with no structure menu. The first tile goes in face down; the second is placed where it belongs relative to it (left, right, above, below, inside, around). Placement is forgiving by default: if another arrangement of the same two tiles is the real character, they slide into it. Tiles morph by position: 水 on the left becomes 氵. | Component structure | Wire |
| Make | 3 Reveal | If it is a character it bonds: the glyph is shown, the voice says it once, and its picture appears. If not, the tiles slide back at no cost. | Recognition | World |
| Make | 4 Stroke | The bonded character is inked in relay. No player twice in a row. | Stroke order, handwriting | Wire + voice |
| Make | 5 Tone | One crew member who did not write the last stroke seals the tone with a swipe shaped like the tone mark. It is an echo of what the voice just said. | Tone | Wire |
| Store | 6 Hold | The finished character waits in the boat's shared hold as glyph plus picture. | Meaning | World |
| Use | 7 Choose | Something arrives, drawn as a thing. The crew picks a held character to spend. Several may work. | Meaning, world logic | Talk |
| Use | 8 Act | The character drops into the world as a 3D glyph and does its meaning. | Recognition, meaning | World |

Knowing a character lets a crew go straight to it. Not knowing it means exploring. Both are legitimate play.

### 5.2 Objects

| Object | Definition |
|---|---|
| Tile | One component, or a whole character that cannot be split (了, 也, 不). Private to its holder. Hand limit 4 (5 in a two-seat boat). |
| Hold (舱) | One per boat, shared and visible to the whole crew and on the world view. Holds 2 finished characters in a two-seat boat, 3 otherwise. Each shows glyph plus picture. |
| Logbook | The crew's record of every character forged and every outcome seen. It records what was found, never what has not been. |
| Forge (砚) | One per boat. Shared slots laid out as a 田 frame. |
| Flotsam | Tiles floating down the river. Offered to the seats on the side they pass. |
| Encounter | Something approaching: obstacle, creature, person, weather. Has tags it reacts to. |
| 气 qì | The boat's momentum, 0 to 10. The only meter. Sets speed. |
| Trouble | An encounter that reached the boat unanswered. Rides with the boat until solved. |

### 5.3 Bonding outcomes (Differentiated Failure)

| Placed combination | Outcome |
|---|---|
| Character in the pack | Bonds. Goes to inking. |
| Real character not in the pack ("wild") | Bonds. Gets the default effect of its radical domain. Logged as a discovery. |
| Not a character | Tiles are shown for 2 s, then slide back to their owners. No message and no cost. Trial and error is allowed. |

### 5.4 Inking verdicts (Stability rule)

| Stroke drawn | Verdict | Look |
|---|---|---|
| Matches next stroke in order | Lock | Crisp black |
| Matches a later stroke | Accepted out of order | Smeared grey; lowers quality |
| Matches nothing | Fades | Wet ink evaporates |
| Same player as previous stroke | Fades | Brush icon tilts toward the others |

The word "wrong" never appears.

### 5.5 Quality and potency

Q = 0.45 × order ratio + 0.35 × mean shape score + 0.20 × tone hit.

| Tier | Q | Potency | Render |
|---|---|---|---|
| 楷 kǎi | ≥ 0.80 | ×1.0 | Crisp regular script |
| 行 xíng | 0.50–0.79 | ×0.7 | Running, slightly loose |
| 草 cǎo | < 0.50 | ×0.4 | Wild and wobbly; still works, comically |

### 5.6 Encounters and open solutions
An effect matrix (tag × encounter → outcome) decides what a cast character does. Outcomes are solve, partial, backfire, or flavour. Backfires are content, not penalties: scolding the gatekeeper makes him bar the gate; growing a forest next to a fire feeds the fire. Seed matrix is in `content-seed-v1.md`. A partial result halves the trouble's drain. Encounters are drawn as things (a gate with its keeper), never as bare characters, and never display what they respond to (P9).

### 5.7 Troubles, 气 and flow (v1.4; supersedes the v1.0 failure rules)

There is no lose state. 气 is the boat's momentum.

| Rule | Design |
|---|---|
| Arrive in order, leave in any order | Things drift in from the horizon in sequence. One that reaches the boat unanswered becomes a **trouble aboard** and stays visible until solved. |
| Forge and tackle when ready | The crew may spend a held character on any trouble aboard or on the nearest incoming thing, at any time. The crew picks the target. |
| Troubles drain 气 | Each trouble aboard drains 气 steadily and may add its own effect (fog dims the horizon, fire burns a tile now and then). |
| Bogged, not beaten | 气 never goes below 0. At 0 the boat stops and nothing new arrives. |
| Recovery | Clearing troubles lets 气 recover and the boat moves again. |
| Faster and faster | Speed rises with 气 and with each trouble cleared in a row, so a crew doing well meets arrivals sooner. The river regulates its own difficulty. |
| A run | A fixed time (default 8 minutes). The result is distance travelled and what was discovered. A river still ends at the Dragon Gate (鲤鱼跳龙门) if the crew gets that far. |

### 5.8 Levels and scaffold dials

| Dial | L1 beginner | L2 | L3 |
|---|---|---|---|
| Hand content | Whole simple characters | Radicals and phonetics | Rare components, nested parts |
| Pinyin on own tiles | Shown | On tap | Hidden |
| Ink outline | Full ghost + next-stroke hint | Ghost only | Blank 田字格 |
| Tone pad | Two choices | Four | Five incl. neutral |

Dials are per seat, so one boat can mix levels.

### 5.9 Lag as play

| Network symptom | In-world treatment | Principle |
|---|---|---|
| 50–400 ms jitter | Every shared action is an ink projectile with 600 ms flight. All clients see it land at the same server time. | P6 |
| Stroke verdict round trip | Your stroke shows at once as wet ink. The verdict arrives as it "dries". | P6 |
| Stale world view | River motion is a pure function of synced clock. Nothing positional is sent. | P2 |
| Two players act at once | First arrival wins; the other tile bounces back. In inking, P7 already orders turns. | P7 |
| Sustained RTT > 400 ms | Seat gets the 远 "far oar" badge: grab windows doubled, never chosen for tone seal. | — |
| Disconnect | The seat "dozes off" (睡). Its tiles spill overboard as flotsam for 20 s. Rejoin within 60 s restores the seat. | — |
| Host stalls | A fog bank freezes the river for everyone until snapshots resume. | — |
| Slow device | The river view lowers its resolution, then hides. Controls are plain page UI and stay usable. | — |

### 5.10 Why people play again (no XP, streaks, badges, timers-as-reward)

| Source | Mechanism |
|---|---|
| Discovery | "What does 泡 do to a rock?" Each character × encounter outcome is findable once and recorded in an album of what happened. |
| Variance | Seeded rivers: different encounter and flotsam mixes each run. |
| Comedy | Backfires and 草-tier casts land on every screen at once, so the whole crew sees them. |
| Felt mastery | A crew that knows its strokes is audibly faster. |

### 5.11 Class scale and teacher

| Item | Design |
|---|---|
| Fleet | Up to 6 boats in lanes on one river, one shared speed. Area effects help neighbours. Tiles can be thrown to an adjacent boat. |
| Capsize | A boat at 0 气 is towed. Its crew can still ink for other boats until a 救-type character rights it. |
| Teacher/host panel | Choose content pack, set dials per seat, pause, end, export a run report (characters cast, quality tiers). |

### 5.12 Character classes (how any vocabulary list fits)

| Class | Examples | In the hold it… | Authoring |
|---|---|---|---|
| Thing or action | 炮 杏 跑 晴 | Acts on encounters through the matrix | Hand-authored |
| Other content word | 意 时 觉 | Gives the default effect of its radical domain | Automatic |
| Function word | 的 了 吗 不 很 | Is an operator on another held character (P10) | Once, shared by all packs |
| Unsplittable | 了 也 不 我 | Arrives as a whole tile; skips the Part step; still inked and toned | Automatic |
| Two-character word | 火山 朋友 | Forms when its characters sit side by side in the hold (later milestone) | Automatic from the list, effects optional |

### 5.12a Polyphones (多音字, TZ-D041)

| Situation | Rule |
|---|---|
| At bonding | The voice says each listed reading. |
| Tone seal | Any listed reading's tone is a hit. No valid reading is ever a miss. |
| Meaning | The sealed reading decides which meaning and picture the held character takes: 好 sealed ˇ is "good", sealed ˋ is "to be fond of". |
| In a word | The word fixes the reading: 好人 is hǎo, 爱好 is hào. |
| Which readings | Only those John lists in the pack. |

This turns the problem into play ("what if I seal it the other way?") without ever marking a real reading as a miss. It first matters at iteration I3.

### 5.13 Where content comes from

| Item | Design |
|---|---|
| Default source | One whole-book vocabulary list, all mixed into the river |
| Lesson option | Entries may carry a lesson tag; the host can filter a run to chosen lessons |
| Generation | A tool sorts the list into the classes above, works out the tiles needed, and writes a pack plus a fit report (vivid / default / operator / word) |
| Authority | John decides which default-only characters deserve authored effects and approves all Chinese |

### 5.14 First river

The first river teaches one step per scene with no text: scene 1 combine and reveal, scene 2 ink, scene 3 tone, scene 4 hold and choose, scene 5 everything.

## 6. Open disagreements and risks

| # | Position | Status |
|---|---|---|
| X1 | Four skills in one loop is a kitchen-sink risk. Accepted only because they are four faces of one object. Tone seal is the weakest link and is cut first if iteration I3 shows drag. | [LEAN] |
| X2 | "Addictive" is defined as unprompted replay requests. Engagement mechanics stay banned. | [LOCKED] |
| X3 | Public internet play breaks P1 unless voice chat is added. Non-goal for v1. | [LOCKED] |
| X4 | 3D is the game's body, not its identity. P2 gives it a real job, nothing more is claimed. | [LOCKED] |
| X5 | The host must be a PC. A phone cannot host. | [LOCKED] |
| X6 | Alpha-player risk (one strong student runs the boat). Counters: private hands, P7, tone seat rotation. Tested at G0. | [OPEN] |
| X7 | Several boats shouting in one classroom may be too loud. Tested at G4. | [OPEN] |
| X8 | Guest Wi-Fi with client isolation blocks LAN play. Fallback: host PC runs its own hotspot. | [OPEN] |

## 7. Prototype ladder and Go/No-Go

| Gate | Build | Single question | GO when (observable) | NO-GO when |
|---|---|---|---|---|
| G0 | Paper kit (`content-seed-v1.md` §6), forward-play rules. One session is a pair fight: river deck vs crossed hands. | Is a character split across people fun, and does it pull speech? | In 2 of 3 sessions: players talk before placing in at least half of forge attempts, using a Chinese name or sound; one unprompted "again"; nobody idle > 30 s in a 5-min run; the beginner starts at least one character | Players place silently throughout, or one player directs everything |
| G0b | Paper, five operator cards (不 很 太 吗 了) added to a group that has played G0 | Do operators add play or only rules? | Players use an operator unprompted and predict its result aloud | Operators are ignored or need re-explaining |
| V0 | Visual toy, one device, no network (`visual-toy-brief-v2.md`). Attempt 1: REWORK (TZ-D043). V0.2 pending. | Do the river, the queue, the pile-up and spending read clearly and feel good? | See brief §7 | See brief §7 |
| G1 | Iteration I1 build (criteria in build plan §4.3 govern) | Does it survive screens? | 3 humans cast ≥ 6 characters in 5 min and talk more than they tap-and-wait | Players read each other's screens instead of speaking |
| G2 | Iteration I4 build, one boat | Is a whole river fun? | Part D by John: ≥ 2 unintended solutions seen; replay asked | Encounters feel like quiz gates |
| G3 | Iteration I5 build on John's real devices | Does lag stay inside the fiction? | 300 ms jitter + 5% loss: no player names "lag" in debrief | Players blame the network |
| G4 | Iteration I7 fleet in a class | Does it scale? | 4+ boats finish a river; teacher can run it unaided | Noise or setup time kills it |

Fight protocol at G0 (pair session only): same pair, same tiles, river-deck rules and crossed hands back to back, order alternated. Verdict logged here. No hybrid mid-fight. Track B (orders) is retired, see TZ-D025.

## 8. Decision Log (append-only, newest first)

| ID | Date | Decision | Status | Supersedes |
|---|---|---|---|---|
| TZ-D052 | 2026-11-12 | The list of every real two-part character the seed tiles can make (107, in `wild-seed.json` and content seed §10) is the wild list for V0.2 and I1; John decides which to hide as obscure | [OPEN] | — |
| TZ-D051 | 2026-11-12 | Look before tool: a style frame is produced and chosen before more river code; low-resolution art caps are removed; a small art target is pulled forward | [LOCKED] | Narrows TZ-D012 |
| TZ-D050 | 2026-11-12 | Rendering technology is open again (canvas, three.js, other). What is locked is the renderer contract (P12, SRS §8.7); the front end is detachable (John) | [LOCKED] | TZ-D037, TZ-D040 |
| TZ-D049 | 2026-11-12 | Every real character bonds from the first build, not from I6 | [LOCKED] | Scheduling of wild resolve |
| TZ-D048 | 2026-11-12 | The river provides: hidden dealer help toward useful tiles, only while the boat is stopped | [LEAN] | — |
| TZ-D047 | 2026-11-12 | Every spend chips; three chips clear a trouble | [LEAN] | — |
| TZ-D046 | 2026-11-12 | Deal guarantee: hands in a boat always allow at least two characters; tiles are consumed on bonding and refilled | [LOCKED] | — |
| TZ-D045 | 2026-11-12 | Forgiving placement by default; strict placement is an advanced dial | [LEAN] | — |
| TZ-D044 | 2026-11-12 | Spatial forge: one square, no structure menu; the second tile's position relative to the first is the structure | [LOCKED] | Six-slot forge with structure switch |
| TZ-D043 | 2026-11-12 | V0 attempt 1 (built with Sonnet, played solo by John): REWORK. Soft-locked at the second arrival (tiles not consumed, none dealt). Findings: structure-first forging is overwhelming; 木+目 did not bond; placeholder look too weak to judge. Multi-target variant and two players untested | [LOCKED] | — |
| TZ-D042 | 2026-11-11 | SRS consolidated as `srs-v2.md`; `srs-v1.md` is a superseded stub | [LOCKED] | SRS v1.0–1.6 |
| TZ-D041 | 2026-11-11 | Polyphones (多音字): a character lists the readings John accepts; the tone of any listed reading is a hit; the sealed reading picks the meaning the held character takes; inside a word the word's reading wins. Rare and literary readings are not listed | [LEAN] | — |
| TZ-D040 | 2026-11-11 | three.js is pinned to the current stable release on the day V0 starts (WebGL 2). John confirms all his devices are recent enough; no r162 fallback. The version number is recorded in PROGRESS.md and changes only by a log entry. Floor: iOS 15+, current Chrome, Firefox, Edge or Safari | [LOCKED] | TZ-D039 |
| TZ-D039 | 2026-11-11 | three.js version is pinned by a test on the oldest device John wants to support: current release if it has WebGL 2, otherwise r162 (last release with WebGL 1) | [OPEN] | — |
| TZ-D038 | 2026-11-11 | Own-screen model: every capable device renders the river itself above its controls; a shared big screen is optional, not required. Devices too old for three.js are controller-only or dropped (John) | [LOCKED] | Narrows TZ-D003 |
| TZ-D037 | 2026-11-11 | River view uses three.js, one pinned version, bundled with the game, never from a CDN. Controls stay plain page UI | [LOCKED] | TZ-D005; the "no WebGL" clause of TZ-D004 |
| TZ-D036 | 2026-11-11 | Spend variant "a character hits every trouble aboard" is tested in V0 against single target | [OPEN] | — |
| TZ-D035 | 2026-11-11 | Visual toy V0 is built outside Chat, in parallel with the paper test, because readability and tension cannot be judged on paper or in text | [LOCKED] | — |
| TZ-D034 | 2026-11-11 | A run is a fixed time (default 8 min); result is distance and discoveries | [LEAN] | — |
| TZ-D033 | 2026-11-11 | No lose state. 气 is momentum: never below 0; at 0 the boat is bogged and nothing new arrives; clearing troubles restores 气; speed rises with 气 and with consecutive clears (John) | [LOCKED] | Run-end rules of v1.0; scroll edge cut |
| TZ-D032 | 2026-11-11 | Arrive in order, leave in any order: unanswered encounters become visible troubles aboard until solved; crew picks the target; forge and tackle when ready | [LOCKED] | §5.7 v1.0 |
| TZ-D031 | 2026-11-11 | Timing start values: 60 s lookahead, an arrival about every 45 s at base speed; tuned in V0 and I2 | [LEAN] | — |
| TZ-D030 | 2026-11-11 | Build order is the iteration ladder in `build-plan-v1.md` §4.1: every iteration ends in a 10-minute playable with a GO / REWORK / SCRAP verdict; no run-ahead; infrastructure only when a playable needs it | [LOCKED] | Milestone order M1–M8 |
| TZ-D029 | 2026-11-11 | Packs are generated from a whole-book list with a fit report; lesson filter stays available; John is content authority | [LOCKED] | — |
| TZ-D028 | 2026-11-11 | Two-character words form from adjacent characters in the hold; later milestone | [LEAN] | — |
| TZ-D027 | 2026-11-11 | Function words are operators on the hold (P10), authored once; tested at G0b | [LEAN] | — |
| TZ-D026 | 2026-11-11 | The bar is "playable, not vivid" (P11); Toy Test applies per radical domain | [LOCKED] | — |
| TZ-D025 | 2026-11-11 | Track B (orders) retired without a fight: it is recall-first, which John's difficulty review rejected. Track A is the only track | [LOCKED] | TZ-D002 |
| TZ-D024 | 2026-11-11 | A partial result halves the consequence; one player may supply both tiles, since the partner still inks and seals | [LEAN] | — |
| TZ-D023 | 2026-11-11 | First river teaches one step per scene with no text (§5.14) | [LEAN] | — |
| TZ-D022 | 2026-11-11 | Tone seal is an echo of the voice heard at bonding | [LEAN] | refines TZ-D010 |
| TZ-D021 | 2026-11-11 | Show After, Never Before (P9): no responds-to icons; forged characters carry pictures; encounters are drawn as things; logbook records findings | [LOCKED] | — |
| TZ-D020 | 2026-11-11 | Face-down forge; a failed combination costs nothing | [LOCKED] | — |
| TZ-D019 | 2026-11-11 | Shared, visible hold (2 in a two-seat boat, 3 otherwise); making and using are decoupled; no timer on making | [LOCKED] | — |
| TZ-D018 | 2026-11-11 | Forward Play (P8) replaces the recall-first loop of v1.0 | [LOCKED] | §5.1 v1.0 |
| TZ-D017 | 2026-11-11 | G0 adds a pair session: river-deck rules (D013–D016) fight "crossed hands" (partner sees my tiles' glyphs, I see only their pinyin) | [OPEN] | — |
| TZ-D016 | 2026-11-11 | Hand limit is 5 in two-seat boats (4 otherwise) | [LEAN] | — |
| TZ-D015 | 2026-11-11 | Tide rotation: a tile held unplayed for 60 s washes overboard into the other side's stream | [LEAN] | — |
| TZ-D014 | 2026-11-11 | Flotsam is face-down on the world view; its glyph is shown only to the seats it is offered to (all boat sizes) | [LOCKED] | — |
| TZ-D013 | 2026-11-11 | The river is a seeded shuffled deck of at least 3× total hand capacity; port flotsam is offered only to port seats, starboard only to starboard | [LEAN] | — |
| TZ-D012 | 2026-11-11 | Art deferred; placeholder shapes until G2 passes | [LOCKED] | — |
| TZ-D011 | 2026-11-11 | No speech recognition, ever in v1. Sound is human-to-human plus tone seal | [LOCKED] | — |
| TZ-D010 | 2026-11-11 | Tone seal step included, first to cut | [LEAN] | — |
| TZ-D009 | 2026-11-11 | P7 Brush-Passes-Hands is the relay rule (solo boats exempt) | [LEAN] | — |
| TZ-D008 | 2026-11-11 | Wild characters get radical-domain default effects | [LEAN] | — |
| TZ-D007 | 2026-11-11 | 形声 characters are in scope via P4 | [LOCKED] | HS 六书 constraint (this game only) |
| TZ-D006 | 2026-11-11 | River motion deterministic from synced clock; only discrete events on the wire | [LOCKED] | — |
| TZ-D005 | 2026-11-11 | Rendering: Canvas 2D pseudo-3D. No WebGL, no three.js | [LOCKED] | — |
| TZ-D004 | 2026-11-11 | Stack: Node + `ws` server on host PC; vanilla ES-module browser clients; no bundler, no CDN | [LOCKED] | — |
| TZ-D003 | 2026-11-11 | World and station are separate views; any device may open either | [LOCKED] | — |
| TZ-D002 | 2026-11-11 | Track A (同舟 open river) is primary; Track B (orders) fights it at G0 | [LOCKED] | — |
| TZ-D001 | 2026-11-11 | New idea started; prior games not carried over except doctrines | [LOCKED] | — |

## 9. Baseline check (audit new work against this)

Drift-detector questions:

1. Can one player make a character alone in a boat of two or more? (Must be no.)
2. Does any screen show form, sound, meaning and stroke order of a character together before it bonds? (Must be no.)
10. Does anything tell players in advance which character will work on an encounter? (Must be no.)
11. Is any player ever required to recall a character from its meaning in order to proceed? (Must be no.)
12. Does a failed combination cost anything? (Must be no.)
13. Can any entry of a vocabulary list be made, inked, said and cast? (Must be yes.)
3. Does any message say or imply "wrong" or "incorrect"? (Must be no.)
4. Is any position of a moving object sent over the network? (Must be no.)
5. Does every shared action have a visible duration ≥ 600 ms? (Must be yes.)
6. Does a real character with no authored effect still do something? (Must be yes.)
7. Would this mechanic stay if it taught nothing? (Must be yes.)
8. Can a station screen run with the world view switched off? (Must be yes.)
9. Can any player learn another player's tile without being told? (Must be no: hands private, flotsam face-down on the world view.)

14. Can a run be lost? (Must be no: the boat is bogged at 气 0 and recovers.)
15. Must a player choose a structure before placing tiles? (Must be no.)
16. Can the game reach a state where no character can be made, or where nothing a player does changes anything? (Must be no.)
17. Does the river view contain any game rule, or does the game need it to be playable? (Must be no.)
18. Does a real character fail to bond because it is not in the pack? (Must be no.)

Red-flag phrases in any spec or code review: "game over", "lose", "scroll edge", "hint", "weakness icon", "responds-to", "order card", "time limit to build", "correct answer", "wrong", "XP", "streak", "daily", "badge", "speech recognition", "sync position", "library from CDN", "game rule in the renderer", "structure menu", "choose structure first", "npm install <anything but ws>", "CDN", "leaderboard between students".

## 10. Document map

| File | Purpose | Reader |
|---|---|---|
| `charter-v1.md` | Identity, design, decisions | Everyone |
| `srs-v2.md` | Requirements, protocol, schemas, algorithms, wireframes | Code agents |
| `build-plan-v1.md` | Milestones, task cards, model routing, handoff rules | John, Code agents |
| `content-seed-v1.md` | Seed tiles, characters, encounters, matrix, paper kit | John, content authors |
| `visual-toy-brief-v2.md` | Self-contained handoff for the V0 visual toy | The agent building V0 |
| `tongzhou-paper-kit.html` (file, not a project doc) | Printable cards, rules, tally, wireframes | John |
