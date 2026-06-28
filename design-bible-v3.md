# Hanzi Sandbox — Design Bible v3

**Single source of truth. Every agent reads this first and writes back to it.**
**Nothing is real until it's in this doc.**

---

## How to use this doc — read first

Three agents work on this game and share no memory. This doc is the only thing that
travels between them. It stays coherent only if everyone obeys the protocol below.

**Status tokens:** `[LOCKED]` settled · `[LEAN]` working default, may still change · `[OPEN]` undecided.
**Roles per section:** `decide` = who resolves it · `validate` = who feel-tests it · `build` = who implements it.

**Protocol**
- The human is the **router**: carries the relevant *slice* to an agent, carries the result back here.
- Write decisions as **tables/registries, not prose.** Prose is where agents drift.
- To change a `[LOCKED]` item, never edit it silently — add a **Decision Log** entry that supersedes it.
- An agent's local opinion (a color, a shortcut, a tuning) is not real until written back here.

**Per-agent contract**
- **Chat (logic & content):** authors doctrine, ontology, property tags, matrix, character registry, puzzle vocab. Writes as tables.
- **Claude Design (feel & fairness):** prototypes + playtests; returns verdicts as Decision Log entries; proposes (never silently edits) logic changes.
- **Claude Code (systems & scale):** implements `[LOCKED]` contracts verbatim; if implementation forces a change, logs it.

---

## 0. Pillars — the spine, keep stable  `[LOCKED]`

- **Play before learning.** Every mechanic must first justify itself as enjoyable gameplay. Educational value is only permitted if it emerges naturally from play. If a mechanic would be removed the moment it stopped teaching, it doesn't belong in the core loop.
- **Character in action.** A Chinese character is dropped into the world and *does what it means.* 火 burns. 水 floods. 上 lifts. The animation IS the lesson.
- **The world responds.** Every deployed character visibly alters terrain, the spirit, or another character. If the world doesn't change, the character wasn't understood.
- **Emergence over prescription.** Characters are toys, not keys. Players ask "what happens if...?" — not "which character solves this?" Surprising interactions are features, not bugs.
- **Learning is implicit.** Players absorb meaning through cause and effect. Text is minimal. Etymology reveals itself through gameplay. The player should finish a session saying "I discovered a clever solution" — not "I learned five characters." Both happen; the first drives the second.

**Fun Gate — applies to every design decision:**
> Before adding any mechanic, ask: "Would this be worth keeping if it taught nothing?"
> If the answer is no, it belongs outside the core loop.

**v1 scope cuts:** open world, multiplayer, avatars, second art style, combat/fighting (parked as future co-op hook), mandatory stroke tracing, mandatory pronunciation gates, SRS scheduling, in-loop assessment.

---

## 0.5 Character Selection Doctrine  `[LOCKED]`  *(decide: chat)*

Every character must pass this filter before entering any registry.
The test: **can a player read the game logic from the visual form without being told anything?**

### The Six Script Types (六书) and their game viability

| Type | Chinese | What it is | Game treatment |
|---|---|---|---|
| **Pictograph** | 象形 | Direct picture of thing | ✅ **Tier A** — deploy freely |
| **Indicative** | 指事 | Abstract spatial mark on pictograph | ✅ **Tier A** — deploy freely |
| **Compound ideograph** | 会意 | Two+ semantic parts combine | ✅ **Tier B** — deploy with part-animation |
| **Phono-semantic** | 形声 | One semantic + one phonetic component | ⚠️ **Tier C** — semantic radical only; full char is lore unless exception-flagged |
| **Derivative cognate** | 转注 | Archaic, rare | ❌ Skip entirely |
| **Loan/phonetic** | 假借 | Sound borrowed, form has no visual logic | ⚠️ **Tier D** — functional convention only |

### Tier rules

**Tier A — Deploy freely** *(象形 + 指事)*
Form teaches meaning without explanation. Layer 1 content. No annotation needed on deploy.

**Tier B — Deploy with part-reveal** *(会意)*
Both components are semantic. On deploy: character splits into components (tween apart, hold 400ms,
snap back), then acts. The split-snap IS the etymology lesson. No text needed.
Example: 明 splits → 日 pulses + 月 pulses → snap → illuminates area.

**Tier C — Radical extraction** *(形声)*
The phonetic component must never appear as meaningful in a game context.
Default rule: the **semantic radical** is the deployable piece. The full character is a lore collectible only.

**Tier C exception — radical-transparent compounds:**
A 形声 character qualifies for active play if the semantic radical so visually dominates that the
phonetic component reads as decoration. These must be approved case-by-case and flagged
`[形声-exception]` in the registry.
Approved: 冰 (semantic 冫 dominates). Candidates requiring review: 晴, 江, 河.
The exception test: cover the phonetic component — does the character still make visual sense? If yes, consider approving.

**Tier D — Functional convention** *(假借 numbers)*
一二三 have genuine visual logic (stroke count) and may appear as Modifiers.
四五六七八九十 do not — phonetic loans with no pictographic connection.
Rule: 四+ appear only in a distinct UI register (number glyph style) as quantity conventions.
The game teaches their function, not etymology, because there is no visual etymology to teach.

### The 形声 trap
形声 characters make up ~80% of modern Chinese. They will look tempting.
**Do not add them without explicit Chat approval and Tier C/exception flagging.**
When in doubt: use the radical, not the full character.

---

## 1. Character Ontology  `[LOCKED]`  *(decide: chat · validate: Design)*

Five classes. Every deployable character fits exactly one.

| Class | Job | Acts on | Visual cue | Etymology types |
|---|---|---|---|---|
| **Force** | a natural process that spreads or transforms | terrain cells | color pulse / spread animation | Tier A, Tier B, Tier C radicals |
| **Tool** | a physical object placed in the world | a specific cell edge or tile | solid shape drops into world | Tier A, Tier B |
| **Creature** | an autonomous agent with idle behavior | spirit, terrain, other entities | moves independently; has idle animation | Tier A, Tier B |
| **State** | a condition applied to the spirit | the spirit itself | aura ring around spirit | Tier B only |
| **Modifier** | scales or redirects another character's effect | next deployed character | glows, awaits target | Tier A (spatial) + Tier D (quantity) |

**Creature idle behavior** `[LEAN]` — Creatures animate and behave even when not solving a puzzle.
鱼 swims in water tiles. 鸟 perches and preens. 人 walks idly. This makes the world feel alive
and invites "what happens if I put this here?" experimentation before any puzzle intent.

**Modifier mechanic** — played immediately before the character it modifies. UI: Modifier card
glows, next card played is the target. Modifier consumes on use.
上 + 木 = wood grows upward. 三 + 石 = three stones placed.

**Lore characters** — no class, no effect, no deploy. Collectible reveals earned through play.
李 is lore. All 形声 full characters are lore unless exception-flagged.

---

## 2. Property Tag System  `[LEAN]`  *(decide: chat · build: Code · validate: Design)*

Characters carry a set of **physical/behavioral tags**. The engine resolves interactions from
tag collisions rather than hard-coded scripts. This enables emergent outcomes without
enumerating every pair.

### Tag vocabulary

| Tag | Meaning |
|---|---|
| `is_hot` | emits heat; ignites flammable things, melts frozen things |
| `is_cold` | emits cold; freezes liquid things, slows living things |
| `is_flammable` | catches fire when touching `is_hot` |
| `is_wet` | extinguishes `is_hot`; softens `is_dry` |
| `is_buoyant` | floats on liquid tiles; can carry things across |
| `is_structural` | forms platforms, bridges, or barriers |
| `is_sharp` | cuts `is_organic` and `is_fibrous` things |
| `is_luminous` | emits light; resolves darkness terrain |
| `is_living` | affected by heat, cold, fear; has autonomous behavior |
| `is_heavy` | sinks in liquid; fills gaps; startles `is_living` nearby |
| `is_organic` | burned by `is_hot`; grows when near `is_wet` + `is_luminous` |
| `is_fibrous` | cut by `is_sharp`; entangles `is_living` |
| `emits_sound` | detected by 耳; affects `is_living` behavior |
| `vector_up/down/left/right` | directional force applied to adjacent entities |

### Tag assignments — Layer 1 seed

| char | tags |
|---|---|
| 火 | `is_hot`, `is_luminous`, `is_flammable` |
| 水/川 | `is_wet`, `flows` |
| 木 | `is_flammable`, `is_buoyant`, `is_structural`, `is_organic` |
| 山 | `is_structural`, `is_heavy` |
| 石 | `is_heavy`, `is_structural` |
| 土 | `is_structural` (loses tag when `is_wet` applied) |
| 刀 | `is_sharp` |
| 弓 | `vector_right` (or aimed direction) |
| 日 | `is_hot`, `is_luminous` |
| 月 | `is_luminous` (dim) |
| 雨 | `is_wet`, `flows` |
| 鸟 | `is_living`, `vector_up` (carries) |
| 鱼 | `is_living`, `is_buoyant` (in water) |
| 人 | `is_living` |
| 上 | `vector_up` |
| 下 | `vector_down` |
| 大 | `amplify` (×2 on next character's effect radius) |
| 小 | `reduce` (×0.5 on next character's effect radius) |

### Engine resolution rules (priority order)

1. `is_hot` + `is_flammable` → target ignites (gains `is_hot`; loses `is_structural` over time)
2. `is_hot` + `is_wet` → steam produced (obscures vision temporarily)
3. `is_wet` + `is_hot` thing → extinguishes (target loses `is_hot`)
4. `is_cold` + `is_wet` → freezes (target gains `is_structural`, `is_heavy`)
5. `is_heavy` + liquid tile → sinks (fills if enough mass)
6. `is_sharp` + `is_fibrous` → cuts (clears)
7. `is_sharp` + `is_structural` (ice/stone) → cracks (partial clear)
8. `is_luminous` + darkness terrain → resolves
9. `is_living` + `is_hot` nearby → flees (autonomous behavior change)
10. `vector_*` + `is_living` or object → pushes in direction

**This does not replace the interaction matrix entirely.** Puzzle-specific outcomes that
require designer control (e.g., 门 dams a river) are still hard-coded. The tag system
handles *emergent* interactions; the matrix handles *authored* ones.

---

## 3. Three-Layer Progression  `[LOCKED]`  *(decide: chat · tune: Design)*

| Layer | Name | Core mechanic | What the player learns | Etymology types |
|---|---|---|---|---|
| **1** | Character as World Force | Deploy single characters; observe tag-driven outcomes | What each character means through what it does | Tier A + Tier D |
| **2** | Character as Composed Meaning | Part-reveal animations; Modifier class active; radical families visible | How characters relate; radical as building block | Tier A + Tier B + Tier D |
| **3** | Character as Fusion | In-world fusion (push radicals together); chain composition | How characters were etymologically constructed | Tier B fusion |

### Within each layer: five acts

| Act | Teaches | Mechanic introduced |
|---|---|---|
| **Teach** | one character, one effect | single deploy, immediate world response |
| **Choose** | decisions matter | multiple valid characters, a red herring |
| **Compound** | planning | sequence two characters; order matters; tag interactions |
| **Constrain** | mastery | limited hand, live wrong-character hazards |
| **Discover** | emergence | unscripted sandbox moment; no tutorial, no quest, no text |

**Discover act** — each layer ends with a free-play sandbox where hidden interactions exist
but are never telegraphed. A player who finds Rain+Sun→rainbow earns a lore card.
The Discover act has no failure state. Completion = spirit reaches goal by any means.

---

## 4. Character Registry — Layer 1 Seed  `[LEAN — growing]`  *(author: chat · build: Code)*

```js
{
  char, pinyin, gloss, class, etymology_type, tier_rule,
  visual_logic,     // what a player reads from the form alone
  property_tags[],  // engine behavior
  deploy_anim,      // what happens on deploy
  idle_anim,        // for Creatures only
  effect,           // engine key (for hard-coded outcomes)
  color,
  layer_unlock      // 1 | 2 | 3
}
```

### Layer 1 — Tier A deployables (象形 + 指事)

| char | pinyin | gloss | class | etymology | visual logic | property tags | color | layer |
|---|---|---|---|---|---|---|---|---|
| 火 | huǒ | fire | Force | 象形 | flame shape | `is_hot, is_luminous, is_flammable` | #E8472B | 1 |
| 水 | shuǐ | water | Force | 象形 | flowing streams | `is_wet, flows` | #4A90D9 | 1 |
| 木 | mù | tree/wood | Tool | 象形 | trunk+roots+branches | `is_flammable, is_buoyant, is_structural, is_organic` | #6B8E4E | 1 |
| 山 | shān | mountain | Tool | 象形 | three peaks | `is_structural, is_heavy` | #8B7355 | 1 |
| 日 | rì | sun | Force | 象形 | circle + center dot | `is_hot, is_luminous` | #F5A623 | 1 |
| 月 | yuè | moon | Force | 象形 | crescent shape | `is_luminous` (dim) | #B8C4D4 | 1 |
| 雨 | yǔ | rain | Force | 象形 | drops from cloud | `is_wet, flows` | #6B9FBF | 1 |
| 田 | tián | field | Tool | 象形 | grid of plots | `is_structural` | #C4A35A | 1 |
| 川 | chuān | river/flow | Force | 象形 | three flowing lines | `is_wet, flows, vector_right` | #5B8FA8 | 1 |
| 石 | shí | stone | Tool | 象形 | cliff + rock | `is_heavy, is_structural` | #9E9E8F | 1 |
| 土 | tǔ | earth/soil | Tool | 象形 | ground + mound | `is_structural` (loses when wet) | #C4956A | 1 |
| 刀 | dāo | blade | Tool | 象形 | blade + edge | `is_sharp` | #B0B0B0 | 1 |
| 弓 | gōng | bow | Tool | 象形 | curved bow | `vector_right` (aimed) | #8B6914 | 1 |
| 口 | kǒu | mouth | Force | 象形 | open square = mouth | `emits_sound` | #E8A090 | 1 |
| 手 | shǒu | hand | Tool | 象形 | five fingers | `is_sharp` (push), `vector_*` | #D4A574 | 1 |
| 目 | mù | eye | Force | 象形 | eye shape | `is_luminous` (reveals only) | #5B8C5A | 1 |
| 耳 | ěr | ear | Force | 象形 | ear shape | detects `emits_sound` | #C4856A | 1 |
| 门 | mén | gate | Tool | 象形 | two-panel gate | `is_structural` (blocking) | #8B6040 | 1 |
| 网 | wǎng | net | Tool | 象形 | grid/mesh | `is_fibrous` (traps `is_living`) | #7A8C6E | 1 |
| 鸟 | niǎo | bird | Creature | 象形 | bird with tail | `is_living, vector_up`; idle: perches+preens | #6B9FD4 | 1 |
| 鱼 | yú | fish | Creature | 象形 | fish shape | `is_living, is_buoyant`; idle: swims | #4A8FA8 | 1 |
| 人 | rén | person | Creature | 象形 | standing figure | `is_living`; idle: walks | #D4A574 | 1 |
| 子 | zǐ | child | Creature | 象形 | child with arms out | `is_living` (small); idle: follows | #98C4D4 | 1 |
| 上 | shàng | up/above | Modifier | 指事 | line above base | `vector_up` on next char | #A0C4A0 | 1 |
| 下 | xià | down/below | Modifier | 指事 | line below base | `vector_down` on next char | #A0A0C4 | 1 |
| 一 | yī | one | Modifier | 指事 | single stroke | ×1 count | #E0E0D0 | 1 |
| 二 | èr | two | Modifier | 指事 | two strokes | ×2 count | #E0E0D0 | 1 |
| 三 | sān | three | Modifier | 指事 | three strokes | ×3 count | #E0E0D0 | 1 |
| 大 | dà | big | Modifier | 指事 | arms spread wide | `amplify` ×2 on next char | #C4A060 | 1 |
| 小 | xiǎo | small | Modifier | 指事 | small mark | `reduce` ×0.5 on next char | #C4C4A0 | 1 |
| 本 | běn | root/origin | Tool | 指事 | tree + mark at base | `is_structural` (anchors) | #8B7040 | 2 |
| 末 | mò | tip/end | Force | 指事 | tree + mark at top | `vector_up` (reach/extend) | #A08060 | 2 |

### Layer 2 seed — Tier B (会意, unlock after Layer 1 complete)

Part-reveal animation on deploy. Both components must already be known from Layer 1.

| char | pinyin | gloss | class | components | visual logic | property tags | color | layer |
|---|---|---|---|---|---|---|---|---|
| 明 | míng | bright | Force | 日+月 | sun+moon = full brightness | `is_luminous` (strong) | #E0C84B | 2 |
| 休 | xiū | rest | State | 人+木 | person leans on tree | pauses spirit | #7BA05B | 2 |
| 好 | hǎo | good | State | 女+子 | woman+child = goodness | reduces next penalty | #D98AA8 | 2 |
| 安 | ān | peace | State | 宀+女 | woman under roof = safe | immunity to one backfire | #9E8FC0 | 2 |
| 从 | cóng | follow | Creature | 人+人 | one follows another | `is_living`; mirrors spirit path | #C4906A | 2 |
| 众 | zhòng | crowd | Force | 人+人+人 | three people | `is_heavy, vector_right` (rush) | #B07850 | 2 |
| 林 | lín | grove | Tool | 木+木 | two trees | `is_flammable, is_buoyant, is_structural` (short) | #4A7C59 | 2 |
| 炎 | yán | flame | Force | 火+火 | fire doubled | `is_hot` (wide), `is_luminous` | #D8472B | 2 |
| 朋 | péng | friend | Creature | 月+月 | two moons | `is_living`; assists spirit | #4FA89B | 2 |
| 看 | kàn | look/see | Force | 手+目 | hand over eye | `is_luminous` (wide reveal) | #6B9F6B | 2 |
| 男 | nán | man | Creature | 田+力 | field+strength | `is_living, is_heavy` (push) | #7A8C6A | 2 |
| 尖 | jiān | sharp | Tool | 小+大 | small on large = point | `is_sharp` (piercing) | #8A8F98 | 2 |
| 森 | sēn | forest | Tool | 木+木+木 | three trees | `is_flammable, is_structural` (long bridge) | #2E6B40 | 3 |
| 焱 | yàn | blaze | Force | 火+火+火 | three fires | `is_hot` (area), `is_luminous` | #C43820 | 3 |

---

## 5. Discovery Registry  `[LEAN — growing]`  *(author: chat · validate: Design)*

Hidden interactions with no tutorials. Never telegraphed. Reward curiosity.
Engine produces these from tag collisions — they are not scripted.
This table documents them so Design can verify they fire correctly.

| trigger | outcome | discovery note |
|---|---|---|
| 雨 + 日 (same sky) | brief rainbow arc appears | no effect on terrain; pure wonder moment |
| 火 + 石 | stone glows red-hot; emits heat aura briefly | not a solution, but feels right |
| 火 near 鸟 | bird startles and flies off | 鸟 becomes unavailable temporarily |
| 水 flowing into 火 active | steam cloud + brief darkness | teaches sequencing danger visually |
| 大 + 雨 | torrential rain; floods faster | teaches modifier magnitude |
| 三 + 人 | crowd of three walks; can push light objects | intuition bridge to 众 |
| 鱼 + 网 | fish is caught; web fills | wrong move; teaches trap logic |
| 日 + 月 (both active, no puzzle) | full illumination + subtle tide effect | preview of 明 |
| 口 near 鸟 | bird responds; changes direction | teaches sound interaction |
| 火 + 木 already placed | wood burns; spirit path disappears | key Constrain-act hazard, also a discovery |

---

## 6. Interaction Matrix — Layer 1 authored outcomes  `[LEAN — validate: Design]`

Hard-coded outcomes that complement (not replace) the tag system.
Use when designer intent must override emergent behavior.

`✓` = solves/clears · `✗` = backfires/worsens · `~` = partial/side-effect · `—` = no authored override (tag system handles)

### 6a. Force × Terrain

| char | river/water | ice-wall | thorns/vines | darkness | chasm/pit | mud/bog | shadow-web |
|---|---|---|---|---|---|---|---|
| 火 | ~ steam (obscures) | ✓ melts | ✓ burns clear | ✓ lights briefly | — | ~ dries → cracked | ✓ burns web |
| 水/川 | ✗ deepens | ~ softens | — | — | — | ✓ washes clear | — |
| 日 | ~ evaporates (slow) | ~ softens slightly | ~ dries brittle | ✓ full light | — | ~ dries surface | ✓ dissolves web |
| 月 | — | — | — | ✓ dim light (partial) | — | — | ~ dims web |
| 雨 | ✗ floods deeper | ✓ melts slowly | — | — | — | ✗ worsens | — |
| 目 | — | — | — | ✓ reveals path | — | — | ✓ sees through |
| 口 | — | — | — | — | — | — | ~ vibrates (weakens) |
| 耳 | — | — | — | ✓ detects path by sound | — | — | ~ detects edges |

### 6b. Tool × Terrain

| char | river/water | ice-wall | thorns/vines | darkness | chasm/pit | mud/bog | shadow-web |
|---|---|---|---|---|---|---|---|
| 木 | ✓ raft → cross | — | ✗ absorbed | — | ✓ log-bridge (short) | ✗ sinks | — |
| 山 | ✓ dam (redirects) | — | — | — | ✓ fills large pit | ✓ solid footing | — |
| 石 | — | — | — | — | ✓ fills pit (partial) | ✓ hardens | — |
| 土 | — | — | — | — | ✓ fills pit (crumbles if wet) | ✓ hardens (dry only) | — |
| 刀 | — | ✓ cracks | ✓ cuts single | — | — | — | ✓ cuts |
| 弓 | — | — | ✓ pins back | — | — | — | ✓ pins |
| 门 | ✓ dams river | — | — | — | — | — | — |
| 网 | ✗ traps spirit | — | — | — | ~ catches falling spirit | — | — |
| 手 | — | — | ✓ pushes aside (temp) | — | — | — | ✓ tears |
| 田 | — | — | — | — | ✓ platform over pit | — | — |

### 6c. Creature × Terrain

| char | river/water | ice-wall | thorns/vines | darkness | chasm/pit | mud/bog | shadow-web |
|---|---|---|---|---|---|---|---|
| 鸟 | ✓ carries spirit over | — | ✓ flies over | — | ✓ carries over | ✓ flies over | ✓ flies through |
| 鱼 | ✓ carries spirit through | — | — | — | — | ✓ swims through | — |
| 人 | ~ wades (slow) | — | ✗ gets caught | — | — | ~ trudges | ✗ gets stuck |
| 子 | ~ follows spirit | — | — | — | — | — | — |

### 6d. Modifier combos (authored)

| modifier + char | effect |
|---|---|
| 上 + 木 | wood grows upward → ladder over wall |
| 上 + 鸟 | bird carries spirit upward |
| 下 + 水 | water flows down → drains flooded tile |
| 下 + 土 | earth drops → fills chasm from above |
| 大 + 火 | fire spreads wide (2-tile radius) |
| 小 + 火 | fire is precise (single tile, no steam) |
| 三 + 石 | three stones → fills wide chasm |
| 二 + 木 | two logs → longer bridge |

### 6e. Character × Character (sequencing consequences)

| deployed → already placed ↓ | 火 | 水/川/雨 | 木 | 山 |
|---|---|---|---|---|
| 木 raft/bridge | ✗ burns raft | ✓ preserves | — | — |
| 土 fill | — | ✗ washes away | ~ absorbs (mud) | — |
| 火 active | — | ✗ extinguishes | ✗ burns wood | — |
| 门 dam | ✗ burns door | — | — | — |

### 6f. State effects (spirit)

| char | effect |
|---|---|
| 休 | spirit pauses safely (buys time vs. timer) |
| 好 | next obstacle interaction has reduced penalty |
| 安 | immune to one wrong-deploy backfire |

---

## 7. Puzzle Vocabulary  `[LEAN — validate: Design]`  *(author: chat · validate: Design)*

```js
{ id, layer, act, obstacle, terrain, valid_solutions, red_herrings, notes }
```
Every solution must trace to a matrix cell or tag resolution.
≥2 valid paths from Choose act onward. Discover act has no required solution.

### Layer 1 puzzles

| id | act | obstacle | terrain | valid solutions | red herrings | notes |
|---|---|---|---|---|---|---|
| L1-P01 | Teach | spirit can't cross | river | [木 raft] | — | first deploy; one answer |
| L1-P02 | Teach | path blocked | thorns | [火 burn] | — | teaches fire |
| L1-P03 | Teach | spirit lost | darkness | [日, 月] | — | moon dimmer but works |
| L1-P04 | Choose | can't cross | river | [木 raft, 山 dam] | [水] | water deepens |
| L1-P05 | Choose | path blocked | thorns | [火, 刀, 手] | [雨] | rain does nothing |
| L1-P06 | Choose | spirit lost | darkness | [日, 目] | [月] | moon partial only |
| L1-P07 | Compound | chasm then river | chasm+river | [石 fill, 木 raft] | [土] | soil washes in river |
| L1-P08 | Compound | river then thorns | river+thorns | [木 raft, 刀 cut] | [火] | steam hides river |
| L1-P09 | Compound | mud then dark | mud+dark | [土 harden, 日 light] | [水] | water worsens mud |
| L1-P10 | Compound | timed thorns (regrow) | thorns+timer | [大+火] | [刀] | knife too slow; teaches Modifier |
| L1-P11 | Compound | wide chasm | chasm | [三+石] | [石 alone] | teaches quantity Modifier |
| L1-P12 | Constrain | raft placed, fire hazard | river | [avoid fire, 水 carefully] | [火] | char×char hazard |
| L1-P13 | Constrain | river + darkness, limited hand | river+dark | [木, 日] | [雨] | rain kills light |
| L1-P14 | Constrain | all L1 terrains | compound | [player-authored] | many | mastery level |
| L1-P15 | Discover | free sandbox | mixed | [any] | — | no failure state; lore unlocks on discovery |

### Layer 2 puzzles — seed

| id | act | obstacle | terrain | notes |
|---|---|---|---|---|
| L2-P01 | Teach | introduce 明 | darkness | part-reveal teaches 日+月 |
| L2-P02 | Teach | introduce 从 | river with spirit | 从 creates follower ally |
| L2-P03 | Choose | darkness + web | dark+shadow-web | [明, 看, 目+刀] |
| L2-P04 | Compound | crowd to push boulder | blocked path | [三+人 or 众] — teaches 会意 intuition |
| L2-P05 | Constrain | State timing | timer+backfire | [安 then 休 then 明] |
| L2-P06 | Discover | free sandbox | mixed | hidden: 三+人 triggers 众 lore card |

### Layer 3 puzzles — fusion (会意 in-world compose)

Old P01–P15 re-indexed as L3-P01–L3-P15. In-world fusion replaces UI bench:
player physically moves/drops radicals onto each other in the world to fuse.

---

## 8. Fusion Model — Layer 3 only  `[LOCKED]`  *(decide: chat · build: Code · validate: Design)*

- **In-world fusion** — player drags/pushes a radical onto another in the terrain. On contact, components snap together with part-reveal animation, producing the fused character in place.
- **Chain fusion** — outputs are re-fusable. Tier = power.
- Tier ladder: 木→林→森 · 火→炎→焱 · 日+月→明 · 明+星→晶
- **Tier = fusion steps.** Base = 0, one fuse = 1, re-fuse = 2. Max depth 3 for v1.
- Matching is **multiset** (order-independent).
- Ingredients = **infinite stamps** in L3 Teach + Choose acts.
- Depletion in L3 Constrain act only.

### Fusion Registry  `[LOCKED · growing]`

| inputs | char | pinyin | gloss | class | tier | effect | color |
|---|---|---|---|---|---|---|---|
| 木+木 | 林 | lín | woods | Tool | 1 | woods | #4A7C59 |
| 日+月 | 明 | míng | bright | Force | 1 | bright | #E0A82E |
| 火+火 | 炎 | yán | flame | Force | 1 | flame | #D8472B |
| 冫+水 | 冰 | bīng | ice | Force | 1 | ice [形声-exception] | #5FB6CE |
| 氵+目 | 泪 | lèi | tear | Force | 1 | tear | #4A78C2 |
| 人+木 | 休 | xiū | rest | State | 1 | rest | #7BA05B |
| 女+子 | 好 | hǎo | good | State | 1 | good | #D98AA8 |
| 日+生 | 星 | xīng | star | Force | 1 | star | #E8C04B |
| 山+石 | 岩 | yán | rock | Tool | 1 | rock | #7A736B |
| 宀+女 | 安 | ān | peace | State | 1 | peace | #9E8FC0 |
| 月+月 | 朋 | péng | friend | Creature | 1 | friend | #4FA89B |
| 口+鸟 | 鸣 | míng | chirp | Creature | 1 | chirp | #6FB0D8 |
| 小+大 | 尖 | jiān | sharp | Tool | 1 | sharp | #8A8F98 |
| 氵+木 | 沐 | mù | wash | Force | 1 | wash | #6CC2C9 |
| 林+木 | 森 | sēn | forest | Tool | 2 | forest | #2E6B40 |
| 炎+火 | 焱 | yàn | blaze | Force | 2 | blaze | #C43820 |
| 冰+水 | 凌 | líng | surge | Force | 2 | surge | #3A7FAF |
| 明+星 | 晶 | jīng | crystal | Force | 2 | crystal | #D4E8F0 |
| 朋+朋 | — | — | — | — | — | OPEN | — |

**李 (木+子):** lore-only. No class, no deploy. Collectible discovery.

---

## 9. Lore & Etymology Reveal System  `[LEAN]`  *(decide: chat · build: Code)*

Lore cards earned through play — never during puzzles, always after or on discovery.
A card shows: character, pinyin, gloss, oracle-bone form, one-line etymology note.
Never tested. Never required. Optional reading.

形声 full characters appear only as lore cards. Example: use 冫 enough times →
earn 冷 card: "冷 cold — 冫 signals meaning; 令 is the sound clue."

**Ambient audio** — when a character deploys and acts, it speaks its pronunciation (SpeechSynthesis,
native voice quality). This is ambient, not a gate. The sound plays as the animation fires.
The player hears the word as they see it act. No interaction required.

Lore gallery lives in MetaScene. Scaffold data structure now; build gallery UI in v1.5.

---

## 10. Narrative Wrapper  `[LEAN — keep thin]`  *(author: chat)*

A spirit moves through a world made of language. Characters are forces of nature, objects,
creatures, states of being. Deploy them and the world reshapes. Guide the spirit home.

No story text during puzzles. Minimal framing between layers.
The animations carry the narrative. The characters are the characters.

---

## 11. Architecture & Build  `[LOCKED]`  *(decide: chat · build: Code)*

- **Framework:** Phaser.js v3 via CDN. Single HTML file for Layer 1 prototype.
- **Data:** All content (character registry, puzzle vocab, fusion recipes, property tags) in external JSON/JS data files. Engine code never contains content.
- **Scenes:** MetaScene (layer map, puzzle tiles, lore gallery) + PuzzleScene (terrain grid, hand, bench).
- **Persistence:** localStorage boolean flags per puzzle completion.
- **Property tag engine:** each character carries a `tags[]` array; engine checks tag collisions on deploy and resolves emergent outcomes before checking hard-coded matrix overrides.
- **Modifier mechanic:** "pending modifier" state in PuzzleScene. First card sets modifier; second card is target.
- **Part-reveal animation (Tier B):** split → hold 400ms → snap → effect. Reusable Phaser tween keyed to `components[]`.
- **Creature idle:** Creatures run a low-priority behavior loop when not solving a puzzle. Implemented as a Phaser state machine per Creature class character.
- **In-world fusion (Layer 3):** drag a radical tile onto another; on overlap, collision triggers fusion animation and produces fused character in place.
- **Ambient audio:** SpeechSynthesis fires on character deploy, speaking pinyin. No player action required.
- **Fighting/combat:** not in scope. Parked as future co-op mechanic.

### Implementation rules (carry forward from prototype)

1. Duplicate radicals in `availableRadicals` must accumulate: `hand[r] = (hand[r] || 0) + count`
2. `puzzle.notes` must never render in player-visible UI
3. Completion = spirit reaches goal tile. No other condition.
4. Act gating: Teach puzzles unlock in order; subsequent acts unlock after all prior act puzzles complete.
5. Design receives the full file set for playtesting — never game.html alone.
6. Tag resolution fires before matrix lookup. Matrix overrides win when both apply.

---

## 12. Quality Gates  `[LOCKED]`  *(apply: all agents)*

These tests apply before any character enters the registry and before any puzzle ships.

**Toy Test** — place the character in an empty sandbox with no puzzles.
Does it have ≥3 interesting tag-driven interactions with other characters or terrain?
If no → redesign the tag set or remove the character.

**Fun Gate** — would this mechanic be worth keeping if it taught nothing?
If no → it belongs outside the core loop (lore, optional, post-game).

**Sandbox Test** — does this character only solve one specific puzzle and nothing else?
If yes → expand its tag set or reconsider its inclusion.

**3-Second Rule** — from player intent to visible world response: ≤3 seconds.
Any UI interruption (pop-up, confirmation, assessment check) that breaks this is not allowed in the core loop.

---

## 13. What is NOT in this game  `[LOCKED]`

Any agent proposing these must log a Decision entry first.

- ❌ Stroke order tracing (mandatory)
- ❌ Pronunciation gates before deployment
- ❌ Flashcards or quiz modes
- ❌ HSK level framing or vocabulary lists
- ❌ 形声 characters as puzzle pieces (unless exception-flagged by Chat)
- ❌ 四五六七 as anything other than UI quantity conventions
- ❌ XP, streaks, badges, level-up rewards
- ❌ SRS scheduling or memory interval locks
- ❌ Bridging activities or assessment overlays inside gameplay
- ❌ 500-recipe fusion database
- ❌ SQLite, server backend, app store distribution
- ❌ Thematic world chapters with narrative text
- ❌ Combat / fighting system (v1)
- ❌ Multiplayer (v1)
- ❌ Open world (v1)
- ❌ Rotating characters to change meaning

---

## Decision Log — append-only, newest on top

| date | id | decision | by | status | supersedes |
|---|---|---|---|---|---|
| 2026-06-28 | D030 | Rotating characters to reverse meaning (下→上) rejected: breaks visual consistency | chat | LOCKED | — |
| 2026-06-28 | D029 | Mandatory stroke tracing and pronunciation gates rejected: destroy 3-second action loop | chat | LOCKED | — |
| 2026-06-28 | D028 | SRS/Leitner interval locks rejected: contradicts infinite-stamp model, breaks flow | chat | LOCKED | — |
| 2026-06-28 | D027 | Ambient audio added: SpeechSynthesis fires on deploy (not a gate); hears word as it acts | chat | LEAN | — |
| 2026-06-28 | D026 | In-world fusion for Layer 3: drag radical onto radical in terrain; UI bench mechanic removed | chat | LEAN | D007-fusion |
| 2026-06-28 | D025 | Creature idle behavior added to ontology: Creatures animate independently of puzzle state | chat | LEAN | — |
| 2026-06-28 | D024 | Discover act added as 5th act in each layer: free sandbox, no failure, lore on discovery | chat | LEAN | — |
| 2026-06-28 | D023 | Discovery Registry established: documents hidden tag-collision moments for Design validation | chat | LEAN | — |
| 2026-06-28 | D022 | Quality Gates section added: Toy Test, Fun Gate, Sandbox Test, 3-Second Rule — all mandatory | chat | LOCKED | — |
| 2026-06-28 | D021 | Property Tag System added: tags drive emergent interactions; hard-coded matrix handles authored overrides | chat | LEAN | — |
| 2026-06-28 | D020 | "Play before learning" added as Pillar 0; Fun Gate added to pillar block | chat | LOCKED | — |
| 2026-06-28 | D019 | 四五六七 excluded from v1; quantity beyond 三 uses multiple 三 cards | chat | LOCKED | — |
| 2026-06-28 | D018 | Lore card system scaffolded in data now; gallery UI deferred to v1.5 | chat | LEAN | — |
| 2026-06-28 | D017 | Part-reveal animation: split → hold 400ms → snap → effect | chat | LEAN | — |
| 2026-06-28 | D016 | Modifier class: spatial (上下大小) and quantity (一二三). Played before target. | chat | LEAN | — |
| 2026-06-28 | D015 | Layer 1 puzzle vocabulary (L1-P01–L1-P15 incl. Discover). L2 seeded. L3 = old P01–P15. | chat | LEAN | D008 |
| 2026-06-28 | D014 | Interaction matrix retained for authored overrides; tag system handles emergent outcomes | chat | LEAN | D007 |
| 2026-06-28 | D013 | Character registry seeded: 33 L1 + 15 L2 compounds + fusion registry | chat | LEAN | D001 |
| 2026-06-28 | D012 | Three-layer progression: L1 single chars, L2 compounds+modifiers, L3 fusion | chat | LOCKED | — |
| 2026-06-28 | D011 | 形声-exception rule: 冰 approved; others require Chat approval + flag | chat | LOCKED | — |
| 2026-06-28 | D010 | Character Selection Doctrine (§0.5) locked | chat | LOCKED | — |
| 2026-06-28 | D009 | Core pillar: "Character in action / world responds" | chat | LOCKED | — |
| 2026-06-22 | D006 | Tier-2 chains: 森/焱/凌/晶 locked; max depth 3 for v1 | chat | LEAN | — |
| 2026-06-22 | D005 | Infinite stamps in Teach+Choose; depletion = Constrain act only | chat | LOCKED | — |
| 2026-06-22 | D004 | 李 = lore-only | chat | LEAN | — |
| 2026-06-22 | D000 | v1 scope cuts: open world, multiplayer, avatars, 2nd art style | chat | LOCKED | — |
