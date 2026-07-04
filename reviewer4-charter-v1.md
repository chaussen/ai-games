# Hanzi Sandbox — Reviewer-4 Charter v1
## The Substrate-Literacy Track

**Status: PARALLEL TRACK.** This document governs a new game model to be prototyped and tested *against* the existing v3 track (design-bible-v3.md). It does not replace the bible until the fight protocol (§8) resolves. Nothing in the bible is deprecated by this document alone.

**This document is self-contained.** An agent (human or AI) with zero prior context must be able to read only this file and (a) understand why the game exists in this form, (b) continue development without drifting, and (c) audit any existing work against the baseline checks in §9.

---

## 0. How to use this document — read first

**Audience:** any future agent — a different AI model, a human developer, a designer, a reviewer — picking up this project cold.

**Reading order for a cold start:**
1. §1 (the thesis, one page) — if you understand nothing else, understand this
2. §4 (the formal model) — this is what you build
3. §9 (baseline checks) — this is how you know you haven't broken it
4. Everything else as reference

**Status tokens** (inherited from design-bible-v3.md):
`[LOCKED]` settled for this track · `[LEAN]` working default, may change · `[OPEN]` undecided, needs a ruling.

**Protocol rules (inherited and binding):**
- Nothing is real until it is written in this document (or the bible, for the v3 track).
- Decisions are recorded in the append-only Decision Log (§11), newest first, single-row table entries.
- `[LOCKED]` items are never silently edited — a superseding log entry is required.
- Write decisions as tables and registries, not prose. Prose is where agents drift.

**Relationship to design-bible-v3.md:**

| Question | Answer |
|---|---|
| Which document governs the v3 card-deployment build (P01–P06 and any continuation)? | design-bible-v3.md, unchanged |
| Which document governs the composition prototype (§7)? | This charter, exclusively |
| Which sections of the bible remain authoritative for BOTH tracks? | §0.5 Character Selection Doctrine · §12 Quality Gates (extended here by §9) · §13 exclusion list · the multi-agent protocol and Decision Log format |
| What happens if the tracks conflict? | They don't interact until the fight protocol (§8) resolves. Until then, neither track imports mechanics from the other without a log entry in both documents |
| Who arbitrates? | The human router (John). Agent roles: Chat = logic/content/arbitration · Design = feel/playtest verdicts · Code = implementation of locked contracts |

---

## 1. The Thesis  `[LOCKED]`

*(If this section is ever violated, the project has failed regardless of how good the game is.)*

### 1.1 One sentence

> **Hanzi is the material the world is made of, and literacy is the crafting skill.**

Not "deploy a character to affect the world." The world is *built out of character-stuff*, and playing means **reading, breaking, and composing** it.

### 1.2 The problem this solves

Every prior design of this game — and every educational hanzi game ever shipped — shares one structure: the character is a **label on a toy**. The player sees 火, translates it (via animation, tutorial, or inference) to "fire," and then plays with fire. The fire is the game; the character is a handle. This is a **translation game**, and translation games have two fatal properties:

1. **The label peels off.** Player skill accumulates entirely in the physics (which obstacles fire clears) and not at all in the writing system. Reskin the game with abstract runes and the player's skill transfers 100% — proof that no literacy was ever load-bearing.
2. **The learning is context-bound.** Knowledge acquired as "the red card clears thorns" does not transfer to reading static text, because the player never performed a reading operation. They performed a matching operation.

### 1.3 The isomorphism principle  `[LOCKED]`

The fix is not better animations or more educational scaffolding. The fix is structural:

> **Every core gameplay motion must be isomorphic to a literacy motion.**

| Gameplay verb | Literacy operation | Where it lives in this model |
|---|---|---|
| Perceive the world | **Decoding** (reading) | The world is rendered *as glyphs* (§4.6) |
| Break a thing apart | **Analysis** (decomposition of compounds into components) | The DECOMPOSE primitive (§4.1) |
| Attach a part to a thing, in a position | **Synthesis** (compound formation, radical placement) | The COMPOSE primitive + slot grammar (§4.2–4.3) |
| Learn what holds together | **Orthographic knowledge** (which combinations are real characters) | The stability rule (§4.4) |
| Predict what an unseen thing does | **Lexical inference** (the #1 real-world reading skill) | Component tags × position (§4.3) |

Under this principle, the player's hands physically learn to take characters apart and put them together — which is, not metaphorically but actually, what reading Chinese is. This is a stronger bar than Habgood & Ainsworth's intrinsic integration ("gameplay requires processing the learning content"). Call it **substrate-literacy design**: *the learning target must be the rendering substrate and resource system of the game, not its content.* No shipped game meets this bar; Baba Is You comes closest but its words are English labels on rules, not composable material.

### 1.4 The three tests (summary — full protocol in §9)

1. **Illiterate Fun Test** — a player who never realizes it's Chinese must still find the alchemy compelling.
2. **Transfer Test** — after ~10 hours, shown a real unseen character containing known components, the player should *have a guess* about its behavior/meaning from parts + positions.
3. **Detachability Test** — reskinning with arbitrary runes must make the game *worse* (less legible, less composable). If a reskin is lossless, the model has failed.

### 1.5 The three laws (replacing the v3 five pillars for this track)  `[LOCKED]`

**Law 1 — The world is written.** Terrain is not "a river with a 水-card solution." The river *is* a lane of flowing 水 glyphs. A mountain is stacked 山. A forest is a stand of 木. The world is literally legible; reading the level is the core perceptual act.

**Law 2 — Components are conserved matter.** Nothing is summoned from a UI hand. Everything is harvested from the world and recomposed. Break 林 and you hold two 木. Composition — the single most game-like property of Chinese — is the *first* verb, not a Layer-3 reward.

**Law 3 — Position is a mechanic.** The same component does different work depending on where it attaches, exactly as in real orthography (氵 left = flows; 灬 bottom = slow heat from below; 囗 enclosing = containment). This gives a second axis of mastery — *where*, not just *what* — and it is the axis that transfers to real reading, because radical position is the primary decoding cue in Chinese.

### 1.6 Genre, named precisely

**Legible-world alchemy puzzler.** The moment-to-moment loop:

```
READ the world (glyph perception = decoding)
  → HARVEST components (break compounds = analysis)
    → COMPOSE (attach parts at slots = synthesis)
      → the world RE-WRITES itself (feedback = new text to read)
        → READ again …
```

Nearest relatives, and the distance from each: Doodle God (recipe discovery, but menu-bound, no space), Noita/Powder Toy (material simulation, but illiterate matter), Baba Is You (words as physics, but English labels, not composable), Tears of the Kingdom (compose-anything, but parts are machines, not signs), Scribblenauts (vocabulary as summoning — the translation game perfected, i.e., the anti-model).

---

## 2. Why Chinese — the uniqueness case  `[LOCKED]`

*(This section exists so a future agent understands the design space is not transferable to alphabets, and so the game's identity claim can be defended.)*

Chinese writing is **the only living writing system that is itself a compositional physics** — a 3,000-year-old, human-debugged system with three properties no alphabet has:

### 2.1 Position is semantic

The same component performs different semantic work depending on where it sits in the character square. This is a genuine spatial grammar:

| Component | Position | Orthographic meaning | Examples | Game translation |
|---|---|---|---|---|
| 水 → 氵 | left side | "behaves like liquid / involves water" | 河 江 沐 洗 泪 | attached left: target gains flow behavior |
| 火 → 灬 | bottom | "heat applied from below / sustained heat" | 煮 蒸 热 照 | attached under: slow heat, cooking, transformation over time |
| 火 | left/beside | "open flame" | 炒 烧 灯 | attached beside: direct burning |
| 口 → 囗 | full enclosure | "boundary, containment" | 国 园 困 圈 | enclosing: traps/contains the enclosed thing |
| 宀 | top | "under a roof / sheltered" | 安 家 宁 室 | attached above: shelters/protects what is below |
| 艹 | top | "plant matter" | 花 草 苗 | attached above: organic growth |
| 心 → 忄 | left (or 心 bottom) | "of the mind/heart" | 情 怕 想 | interiority, state effects |
| 辶 | wrapping left-bottom | "motion, travel" | 过 进 逃 | wrapping: grants movement |

An alphabet has letter *order* but no letter *geography*. In Chinese, geography carries meaning — which means a spatial game can encode real orthography in its spatial mechanics with zero artistic license.

### 2.2 Components conserve

Characters are not invented ad hoc; they are composed from a closed set of ~200 recurring components (radicals and common phonetics) under strict combination rules. This is, structurally, **a crafting system with a fixed periodic table** — the exact shape of a game resource system. ~80–90% of characters a learner will ever meet are combinations of pieces they already have.

### 2.3 Form encodes force

Visual topology has behavioral meaning independent of any specific reading:
- **Enclosure** (囗 门 匚) reads as containment/gating before you know the pronunciation.
- **Repetition scales intensity**: 木→林→森 (tree/woods/forest), 火→炎→焱 (fire/blaze/inferno), 人→从→众 (person/follow/crowd). A doubling/tripling mechanic is already native to the script.
- **Stroke density and symmetry** correlate with mass/stability in intuitive ways the game can honor.

### 2.4 The stable-recipe insight

The set of real Chinese characters is precisely **the set of component combinations that history kept**. Millions of combinations were possible; a few thousand were useful, learnable, and distinct enough to survive. This makes real orthography a natural *stability rule* for a crafting game (§4.4): the writing system IS the recipe book, and discovering what holds together IS discovering Chinese. No content needs to be invented — 3,000 years of curation already did the level design.

### 2.5 What alphabets cannot do

English letterforms are arbitrary (nothing about "W" is wet). Combining letters produces sound, not meaning. There is no positional grammar and no conservation of semantic parts. Therefore: this game concept is **not reskinnable to another language**, which is simultaneously its market identity and its Detachability Test (§9.3) in reverse.

---

## 3. Theoretical grounding — where this sits in game theory  `[LEAN]`

*(For a future agent who needs to defend or extend the model. Each row: what the established theory says, and what this design does with it.)*

| Theory | Core claim | This design's relationship |
|---|---|---|
| Koster, *Theory of Fun* | Fun = the brain mastering new patterns; boredom = pattern exhausted | The component calculus generates combinatorial pattern space (~25 components × 6 slots × reactions) instead of authored puzzle patterns that exhaust. Positional grammar adds a second pattern axis |
| Papert, Constructionism | Deep learning happens when building shareable, manipulable artifacts ("objects to think with") | Characters become literal objects-to-think-with: physical, decomposable, recomposable. The player *constructs* orthography |
| Habgood & Ainsworth, intrinsic integration | Learning content must live in the core loop, not as extrinsic reward | **Exceeded, not just met.** Their bar: gameplay requires processing content. This bar: gameplay motions are isomorphic to literacy motions (§1.3). Named: substrate-literacy design |
| Scribblenauts' Objectnaut engine | Tag-based property systems scale interactions without authoring every pair | Adopted as the reaction layer (§4.5) — but tags attach to *components* and mix under composition, making the tag system load-bearing rather than decorative |
| Baba Is You | Words as physical, manipulable rule-objects | The nearest ancestor. Difference: Baba's words are English labels manipulating rules; here the signs are composable *material* constituting the world |
| Csikszentmihalyi, Flow | Uninterrupted challenge-skill matching; fast feedback | Inherited from v3: the 3-Second Rule stands. Composition must resolve visually in ≤3s |
| Self-Determination Theory | Autonomy, competence, relatedness drive intrinsic motivation | Autonomy: no solution sets, only situations (§6.3). Competence: the world's legibility grows with the player's. Relatedness: out of scope v1 |
| The "chocolate-covered broccoli" critique | Educational content + arbitrary game = neither works | Dissolved structurally: there is no coating because there is no separable filling. Remove the characters and the game breaks (§9.3) |

**Original contributions this charter asserts (not found in mainstream literature):**
1. **Substrate-literacy design** (§1.3) — the learning target as rendering substrate + resource system.
2. **Spatial grammar as physics** (§2.1) — radical position rules as game mechanics.
3. **Orthographic stability as recipe curation** (§2.4) — the real lexicon as the crafting system's "what holds together" rule.
4. **The dark-twin inversion test** — not "is it fun without the characters?" but "does player *skill* change without the characters?" (§9.3).

---

## 4. The Formal Model — Component Calculus  `[LOCKED core / LEAN details]`

*(This is what gets built. Spec before engine. Six primitives; everything in the game is an expression in this calculus.)*

### 4.1 Primitives

```
MATTER      := a component instance (from the component table, §5)
COMPOUND    := MATTER or COMPOUND with another MATTER attached at a SLOT
SLOT        := left | right | top | bottom | enclose | under
TAGS(x)     := base tags of x, transformed by slot rules when composed
REACTION    := tag collision between adjacent world cells (rule table §4.5)
DECOMPOSE   := strike a COMPOUND apart into its components (costs one action; may cost entropy, see OPEN-3)
```

Design invariant `[LOCKED]`: **the answer to "what does X do?" must always reduce to "what are its components, in what slots?"** If a behavior cannot be expressed in the calculus, it either becomes a slot rule, a tag, a reaction — or it does not enter the game. A short authored-exceptions list is permitted (§4.7) and must stay short.

### 4.2 Composition mechanics

- The player **carries components** (small inventory, e.g., 3 slots at v1 — tune in playtest).
- To compose: hold a component, target a MATTER/COMPOUND in the world, choose a SLOT (radial/directional pick — must resolve in one gesture, ≤3s rule).
- To decompose: strike a COMPOUND; it splits into components which drop as carryable MATTER.
- Composition happens **in the world, in place** — never in a menu, bench, or UI panel. (This is the load-bearing difference from v3's fusion bench and from Doodle God.)

### 4.3 Slot rules — position transforms tags  `[LEAN — v1 seed]`

Format: `(tag, slot) → transformed effect on the host`.

| Attached component (form) | Slot | Rule | Orthographic warrant |
|---|---|---|---|
| 水 (renders as 氵 when attached) | left | host gains `flows`; liquid behavior; can traverse water | 河 江 沐 |
| 火 (renders as 灬 when attached) | under | host gains `is_hot_slow`: transforms over time instead of igniting (dries, cooks, hardens) | 煮 蒸 热 |
| 火 | left/right | host gains `is_hot`: open flame, ignites adjacents | 灯 烧 |
| 口 (renders as 囗 when enclosing) | enclose | host is contained: cannot move, cannot spread, effects trapped inside | 困 圈 国 |
| 宀 | top | host gains `is_sheltered`: immune to rain/attack from above | 安 家 |
| 木 | left (as 木) | host gains `is_structural`, `is_flammable` | 林 材 |
| 上 | top | host gains `vector_up` (rises) | 指事 logic |
| 下 | bottom | host gains `vector_down` (sinks/descends) | 指事 logic |
| 日 | top/right | host gains `is_luminous`, `is_hot` (mild) | 晴 暖 |
| repetition (same component ×2, ×3) | beside/stacked | intensity scaling: ×2 widens, ×3 maximizes (木→林→森 pattern) | §2.3 |

Rule for growth of this table `[LOCKED]`: every new slot rule must cite an orthographic warrant (real characters exhibiting the pattern). No invented positional semantics.

### 4.4 The stability rule — orthography as pedagogy  `[LOCKED]`

- A composition matching a **real character** (in the stable-recipe registry) **locks**: it snaps, glows, persists, and acts with full power. Its pronunciation plays (ambient SpeechSynthesis, inherited from v3 D027).
- A composition that is **not** a real character is **allowed but unstable**: it does something small/interesting for a moment (a fizzle, a spark, a wobble — never nothing), then falls apart back into components.

This single rule is the entire pedagogy. The player is never told "wrong." The world simply demonstrates which combinations history kept. Discovering what holds together = discovering Chinese. (This is Review 2's "interesting, not correct" made structural, and it satisfies the Fun Gate: even the failures are toys.)

**Stability registry v1 seed** (compositions that lock — grows with the component table):

| Composition | Character | Effect sketch |
|---|---|---|
| 木+木 (beside) | 林 | wide structural stand; flammable as a unit |
| 木+木+木 | 森 | dense forest; blocks passage; major fuel |
| 火+火 (beside) | 炎 | wide blaze |
| 日+月 (beside) | 明 | strong illumination, wide radius |
| 人+木 (person left of tree) | 休 | rest state: pauses/heals the avatar |
| 氵+木 (water-left on tree) | 沐 | washing: cleanses soot/mud from target |
| 氵+目 | 泪 | tear: single water drop, precise extinguish |
| 宀+女 | 安 | peace zone: shelter aura |
| 口+鸟 | 鸣 | birdsong: attracts/redirects creatures |
| 小+大 (small atop large) | 尖 | point: piercing tool |
| 冫+水 | 冰 | ice: freezes water surface, walkable |
| 上+木 (mark atop tree)* | 末 | treetop/tip: extends reach upward |
| 下-mark at tree base* | 本 | root/anchor: fixes object in place |

\* 本/末 are 指事 marks, not two-component compounds — implement as a "mark" variant of composition. `[OPEN-5]`

### 4.5 The reaction layer — tag collisions  `[LEAN]`

Inherited from v3 §2 with minor cleanup; reactions fire between **adjacent world cells** after composition/placement resolves.

Tag vocabulary: `is_hot`, `is_hot_slow`, `is_cold`, `is_flammable`, `is_wet`, `flows`, `is_buoyant`, `is_structural`, `is_sharp`, `is_luminous`, `is_living`, `is_heavy`, `is_organic`, `is_fibrous`, `is_sheltered`, `emits_sound`, `vector_up/down/left/right`.

Resolution rules (priority order, X deployed onto/adjacent-to already-present Y):
1. `is_hot` + `is_flammable` → ignition (target gains `is_hot`, loses `is_structural` over time, decomposes to ash-matter)
2. `is_hot` + `is_wet` → steam (obscures; both diminished)
3. `is_wet` + `is_hot` → extinguish
4. `is_cold` + `is_wet` → freeze (gains `is_structural`, walkable)
5. `is_heavy` + liquid cell → sinks/fills
6. `is_sharp` + `is_fibrous` → cuts
7. `is_luminous` + darkness matter → reveals/clears by luminosity magnitude (日=2, 明=3, 月=1, 目=reveal-only)
8. `is_living` + `is_hot` adjacent → flees
9. `vector_*` → pushes adjacent movable matter

Deploy-order semantics are explicit (rule 2 vs 3): the first-listed tag belongs to the newly placed/composed thing.

### 4.6 The world is text — rendering doctrine  `[LOCKED]`

- Every world cell's content is rendered **as its glyph(s)**, styled by state (a burning 木 is a 木 glyph with flame particles; wet earth is 土 tinted dark). No icon layer, ever. Icons are the translation game re-entering through the art door.
- Terrain is authored by *writing* it: a river is a lane of 水, a cliff is stacked 山, darkness is a field of dense dark matter. The level editor is, in effect, a text editor. (Placeholder art doctrine from v3 carries over: flat color glyphs + procedural tweens are sufficient until the unified art pass.)
- The avatar ("spirit") survives **demoted**: it is the player's cursor-body in the world — it walks, carries, strikes, composes. It is not an escort objective. Goals are situations, not spirit-reaches-tile (§6.3).

### 4.7 Authored exceptions list  `[LEAN — keep short]`

Hard-coded behaviors permitted only when the calculus cannot express a designed necessity. v1 list: **empty**. Any addition requires a Decision Log entry with the reason the calculus could not express it. If this list exceeds ~10 entries, the calculus is failing — escalate to the human router.

---

## 5. Component Table — v1 material set  `[LEAN]`

~25 components for v1. Selection doctrine: bible §0.5 applies unchanged (Tier A 象形/指事 freely; Tier B 会意 emerge as stable recipes, not as raw matter; 形声 excluded except flagged exceptions; 四五六七 excluded).

| # | Component | Pinyin | Gloss | Base tags | Attached form / notes |
|---|---|---|---|---|---|
| 1 | 水 | shuǐ | water | `is_wet, flows` | 氵 when left-attached |
| 2 | 火 | huǒ | fire | `is_hot, is_luminous` | 灬 when under-attached; drop `is_flammable` from v3 (fire fueling fire handled by ignition rule) |
| 3 | 木 | mù | wood/tree | `is_flammable, is_buoyant, is_structural, is_organic` | — |
| 4 | 山 | shān | mountain | `is_structural, is_heavy` | — |
| 5 | 石 | shí | stone | `is_heavy, is_structural` | — |
| 6 | 土 | tǔ | earth | `is_structural` (lost when wet) | bakeable: 灬-under hardens to brick-state |
| 7 | 日 | rì | sun | `is_hot(mild), is_luminous(2)` | — |
| 8 | 月 | yuè | moon | `is_luminous(1)` | — |
| 9 | 雨 | yǔ | rain | `is_wet, flows` | area effect from above |
| 10 | 口 | kǒu | mouth | `emits_sound` | 囗 when enclosing |
| 11 | 门 | mén | gate | `is_structural(blocking)` | openable/closable; enclosure-family |
| 12 | 刀 | dāo | blade | `is_sharp` | primary decompose tool upgrade |
| 13 | 人 | rén | person | `is_living` | — |
| 14 | 女 | nǚ | woman | `is_living` | needed for 安 好; Tier A 象形 |
| 15 | 子 | zǐ | child | `is_living(small)` | — |
| 16 | 鸟 | niǎo | bird | `is_living, vector_up` | — |
| 17 | 鱼 | yú | fish | `is_living, is_buoyant` | — |
| 18 | 心 | xīn | heart | state-family anchor | 忄 when left-attached `[OPEN-6]` |
| 19 | 目 | mù | eye | `is_luminous(reveal-only)` | — |
| 20 | 耳 | ěr | ear | detects `emits_sound` | — |
| 21 | 手 | shǒu | hand | `vector_*(push)` | the player's physical-verb component |
| 22 | 上 | shàng | up | mark: `vector_up` | 指事 mark |
| 23 | 下 | xià | down | mark: `vector_down` | 指事 mark |
| 24 | 大 | dà | big | mark: amplify | 指事 |
| 25 | 小 | xiǎo | small | mark: reduce | 指事 |
| 26 | 冫 | bīng-radical | ice/cold | `is_cold` | bound radical; exists as harvestable frost-matter `[形声-exception lineage: 冰]` |
| 27 | 宀 | mián | roof | shelter mark | bound radical; harvestable from ruins/structures |

Bound radicals (氵灬囗忄冫宀) — resolution of the v3 gap A2: they are **not independent matter**; 氵/灬/囗/忄 are *forms* that 水/火/口/心 take when attached; 冫 and 宀 are harvestable environmental matter (frost patches, ruined roofs). `[LEAN]`

Every component must pass the **Toy Test** at entry: ≥3 interesting interactions (compositions + reactions combined). The calculus makes this nearly automatic — a component with 2 slot rules and 1 reaction passes — but the check is still mandatory.

---

## 6. What survives from v3, what dies  `[LOCKED as audit]`

*(So no future agent resurrects dead patterns or discards salvaged ones.)*

| v3 element | Verdict | Rationale |
|---|---|---|
| Property tag engine (bible §2) | **SURVIVES, promoted** | Correct substrate; tags now attach to components and mix under composition — load-bearing, not decorative |
| Character Selection Doctrine (bible §0.5) | **SURVIVES intact** | Tier A = raw matter; Tier B = stable recipes; Tier C = ore requiring refinement; Tier D = excluded |
| Quality Gates (bible §12) | **SURVIVES, extended** | Fun Gate, Toy Test, Sandbox Test, 3-Second Rule all stand; §9 adds three track-specific tests |
| Exclusion list (bible §13) | **SURVIVES** | All exclusions stand, incl. no stroke-gates, no SRS, no quizzes, no 四五六七 etymology |
| Ambient audio (D027) | **SURVIVES** | Pronunciation on stable-lock, never a gate |
| Multi-agent protocol + Decision Log | **SURVIVES** | Process was never the problem |
| Discovery Registry concept (bible §5) | **SURVIVES, transformed** | Becomes the stability registry + reaction table; discovery is ambient, not a fifth act |
| Spirit-reaches-goal completion | **DIES (demoted)** | Escort objective on an alchemy system is drag; avatar survives as the player's body/cursor |
| Card hand / deploy loop | **DIES** | The summoning UI *is* the translation layer. Harvest-from-world replaces it |
| Five acts (Teach→Choose→Compound→Constrain→Discover) | **DIES as structure** | A material system teaches through world composition; pacing wisdom survives in §6.3 |
| Three layers (single→compound→fusion) | **DIES — inverted** | Composition is verb #1, not the endgame |
| Interaction matrix (bible §6) | **DIES** | Replaced by tags × slots; residue goes to the authored-exceptions list (§4.7), currently empty |
| Modifier-as-card-played-first (D016) | **DIES, re-based** | 上大小 are marks you *attach* — same content, orthographically honest |
| Puzzles P01–P06 as built | **SUNK COST** | Useful as playtest learning; nothing carries over mechanically |
| Rotation-morphing rejection (D030) | **SURVIVES as rejection** | Still banned: rotating 下 into 上 breaks form integrity |
| Fire-constructs principle (Review 2, was in limbo) | **RESOLVED — adopted** | 灬-under transforms (bakes 土 to brick, cooks, dries): fire as maker, natively |
| Resource Entropy (Review 2, was in limbo) | **RESOLVED — replaced** | Conservation of matter (Law 2) does the job better: overuse depletes local matter physically, no artificial entropy meter |

---

## 7. Milestone Roadmap  `[LEAN]`

### M0 — The Composition Room (build this first, before anything else)

**One room. Five components: 水 火 木 口 上. The slot system. Compose + decompose verbs. Nothing else.**

| Spec item | Value |
|---|---|
| Engine | Phaser.js v3, single HTML file, placeholder glyph rendering (flat color + tweens) |
| World | One screen, small grid; a pond (水-cells), a tree stand (木木), scattered 石 as inert props, a dark corner |
| Verbs | walk (avatar), pick up, strike (decompose), compose (target + slot pick) |
| Stability set live | 林, 森, 炎, 沐 (needs 氵-attach), 鸣 excluded (no 鸟 yet) — plus unstable-fizzle for everything else |
| Reactions live | rules 1–3, 7 (§4.5) |
| Explicitly absent | goals, puzzles, spirit-objective, UI hand, tutorial, text |
| Session target | 15 minutes of unprompted engagement |

**The one question M0 answers:** *is taking characters apart and sticking them together in positions inherently fun for 15 minutes?*

**Go / No-Go criteria:**
- **GO** if playtesters (Design agent + at least one human) voluntarily continue past 10 minutes, attempt ≥8 distinct compositions, and at least one unstable-fizzle produces delight rather than frustration.
- **NO-GO** if engagement is exhausted <5 minutes or composition feels like menu-work. A NO-GO kills this track cleanly; the v3 track continues unharmed. That is the point of the parallel structure.

### M1 — Widen the table (post-GO)
Expand to ~12 components; add 灬-under and 囗-enclose slots; stability set to ~10; introduce conservation pressure (finite local matter).

### M2 — The world is text
Author 2–3 rooms written entirely in glyph-matter; test Law 1 (do players *read* levels?); first Transfer Test probe (§9.2).

### M3 — Situations
Introduce goals as situations ("get across," "make light," "free the trapped 鸟") with zero solution sets; verify ≥3 emergent solutions per situation arise in playtest without authoring.

### 6.3→M3 note on situations `[LOCKED]`
A situation is authored as **terrain + desire**, never as terrain + solution list. If a situation is only solvable one way, it is re-written (geometry changed), not annotated. This inherits and completes the v3 D052 insight: geometry is the only authoring tool.

---

## 8. Fight Protocol — how the two tracks resolve  `[LOCKED]`

| Step | Action | Owner |
|---|---|---|
| 1 | Build M0 (this charter) — do **not** pause v3 authoring if capacity allows, but M0 takes priority on Code time | Code |
| 2 | Design playtests M0 against Go/No-Go, files verdict as Decision Log entries in **both** documents | Design |
| 3 | **GO** → v3 puzzle authoring (P07+) freezes; M1–M3 proceed; bible enters legacy-reference status (its surviving sections per §6 get ported into this charter's registries) | Router |
| 4 | **NO-GO** → this charter is archived with a post-mortem entry; v3 resumes exactly where it stood (P07 authoring next); the salvageable ideas (fire-constructs, bound-radical resolution, luminosity magnitudes) are offered to the v3 track as individual rulings | Router |
| 5 | No hybrid without a ruling: mechanics do not migrate between tracks mid-fight | All |

---

## 9. Baseline Check Protocol — the drift detector  `[LOCKED]`

*(The most important section for continuity. Any agent, before accepting any new work — a mechanic, a component, a room, an art choice — runs this checklist. Any "wrong answer" = stop and escalate to the human router with a Decision Log draft.)*

### 9.1 The Ten Questions (run on every addition)

| # | Question | Required answer |
|---|---|---|
| 1 | Can this new thing's behavior be expressed as components + slots + tags + reactions? | YES (or it goes to §4.7 with a log entry) |
| 2 | Does this add a UI menu, bench, hand, or panel where composition happens outside the world? | NO |
| 3 | Does this render any game object as an icon instead of its glyph? | NO |
| 4 | Does this introduce a "correct/incorrect" judgment surfaced to the player? | NO (stability/instability only) |
| 5 | Does any new slot rule cite a real orthographic warrant? | YES |
| 6 | Does any new stable recipe correspond to a real character passing bible §0.5 doctrine? | YES |
| 7 | Does the player action resolve visually in ≤3 seconds? | YES |
| 8 | Would this mechanic be worth keeping if it taught nothing? (Fun Gate) | YES |
| 9 | Does this reintroduce anything from the DIES column of §6? | NO |
| 10 | Does this require the player to *summon* rather than *harvest/compose*? | NO |

### 9.2 The three track tests (run at every milestone)

| Test | Method | Pass condition |
|---|---|---|
| **Illiterate Fun Test** | Playtest with a tester who is told nothing about Chinese | Sustained voluntary play; tester describes it as a crafting/alchemy game, not a language app |
| **Transfer Test** (from M2) | Show the player a real unseen character composed of known components (e.g., knows 木 and 灬 → show 杰-style or 焚) | Player offers a behavioral/semantic guess grounded in parts + position |
| **Detachability Test** | Thought-experiment (or A/B mock): replace all glyphs with arbitrary runes of equal visual complexity | The reskin must be *worse* — less legible, compositions arbitrary. If lossless, escalate: the model has regressed to a translation game |

### 9.3 Red-flag phrases (drift smells)
If any design note, handoff, or commit message contains these patterns, audit immediately:
"add it to the player's hand" · "the card for X" · "the correct solution is" · "show an icon for" · "unlock this character" (characters aren't unlocked; matter is *encountered*) · "teach puzzle for X" (the world teaches by being made of X) · "fusion bench" · "deploy".

### 9.4 What "on track" looks like (positive definition)
Progress reports should be describable in sentences like: *"Added 雨 as sky-matter; it composes 下-marked to drain, and its 氵-attach warrant is 漏-family; three new stable recipes; the bog room is now written in 土 and 水."* If progress can't be narrated in material terms, it probably drifted.

---

## 10. Open Questions Registry  `[OPEN]`

| id | Question | Blocking? |
|---|---|---|
| OPEN-1 | Inventory size and carry rules (3 slots? weight-based? is_heavy carryable?) | M0 tuning |
| OPEN-2 | Slot-pick gesture design (radial menu vs drag-direction) — must survive touch + mouse, ≤3s | M0 |
| OPEN-3 | Decompose cost model: free? tool-gated (刀 upgrades)? entropy (matter degrades per cycle)? | M1 |
| OPEN-4 | Phonetic components as inert "ballast" matter for future Tier-C synthesis (Review 0's one good idea) — v2 question, park it | No |
| OPEN-5 | 指事 marks (上下大小 on 本/末 pattern): separate "mark" verb or a slot variant? | M0 |
| OPEN-6 | 心/忄 state-family: do states attach to the avatar via composition (compose 忄 onto self)? Charming if it works | M1 |
| OPEN-7 | Stable-recipe discovery persistence: does a discovered recipe auto-lock forever, or must it be re-composed each time? (Memory vs friction tradeoff) | M1 |
| OPEN-8 | Multi-cell compounds: can a composition span world cells (a 林 occupying 2 cells)? | M1 |

---

## 11. Decision Log — this track — append-only, newest on top

| date | id | decision | by | status | supersedes |
|---|---|---|---|---|---|
| 2026-07-04 | R4-D024 | **M0.3 fix pass implemented and verified — R4-D023's stateless-resolution ruling shipped, T1–T8 all PASS.** `resolveZone(px, py, r, c)` now clamps the release point onto the host cell's rect (Phaser.Math.Clamp, no-op if already inside) before running the untouched `cellLocalZone` geometry; `resolveHostAndZone(pointer)` does host-cell selection (unchanged: cell under the pointer if legal, else nearest legal adjacent neighbor within the 1.25 cell-width radius, computed fresh from the avatar's live neighbor set every call) and calls `resolveZone` on whichever cell it picks. `lastValidTarget` is deleted outright — both `updateZoneOverlay` and `onChipDragEnd` now call the same `resolveHostAndZone`, satisfying the overlay/resolver parity invariant by construction. All verification per the R4-D020 LOCKED rule: real dispatched pointer events only (headless Chromium + CDP `Input.dispatchMouseEvent` through the actual canvas and Phaser's input plugin; `onChipDragStart/onChipDrag/onChipDragEnd` never invoked directly). Results: **T1 PASS** (north, in-band, locks 末) · **T2 PASS** (south, 6px overshoot, locks 末) · **T3 PASS** (east, 6px overshoot, locks 末 at both 8-step and 60-step drag interpolation — one of the two directions R4-D022 found broken) · **T4 PASS** (west, both densities, same — the other broken direction) · **T5 PASS** (~200px overshoot snaps back in all 4 directions, forgiveness radius unchanged) · **T6 PASS** (25-point 5×5 in-cell geometry scan, zero `enclose` hits, plus real-dispatched spot checks per zone: top→末, left/right→林, left→沐, bottom→fizzle) · **T7 PASS** (44-sample parity sweep along an E→W path crossing the cell and drifting toward a top-band overshoot — the exact geometry that broke D020/D021 — overlay-resolved and release-resolved zone matched at every sample) · **T8 PASS** (林/森/炎/沐 recipes; luminosity 火=1/炎=2 magnitudes; D016 adjacency snap-back, D017 zero-movement chip click, D018 middle-chip top-edge click regressions all hold). Zero console errors across the full suite. No deviations from `m0.3-code-handoff.md` required. Full build note in `m0-composition-room.html`. Part D remains held pending Design's independent A-series re-verification per R4-D023 | code | LEAN | implements R4-D023 |
| 2026-07-04 | R4-D023 | **Pre-spec arbitration on the R4-D022 defect: zone resolution ruled STATELESS — the resolved zone is a pure function of release position, never of hover history.** In-cell release resolves via existing `cellLocalZone()` geometry (untouched since R4-D011); overshoot release within the 1.25 cell-width radius resolves by projecting the release point onto the host cell rect and running the same geometry on the projection. `lastValidTarget` deleted as a resolution input — any history-based fallback is path-dependent by construction, which is why D020/D021 patched N/S and left E/W broken. New binding invariant: overlay and resolver share one `resolveZone(pointerPos, hostCell)` function — the zone painted at any pointer position equals the zone a release there produces (makes silent snap-backs honest by design, not by luck). Escalation clause **[CONFIRMED by router]**: this is the fifth Code pass on the slot-pick gesture (D015/D016/D017–18/D020–21/now); if this pass bounces, OPEN-2 reopens as a **design** problem (gesture redesign — R4-D008 full-width-band alternative or explicit zone snap), not a sixth patch. Handoff `m0.3-code-handoff.md` issued with T1–T8, all real-dispatched-pointer per the R4-D020 verification lock. Part D remains held. Fight protocol untouched | chat + router | LEAN | supersedes R4-D020/D021 fix approach |
| 2026-07-04 | R4-D022 | **M0.2 re-test — BOUNCE.** R4-D016/D017/D018 verify clean (adjacency snap-back, zero-movement chip click, zone geometry regression all PASS). R4-D020/D021's overshoot-forgiveness for 末 is approach-direction-dependent: locks reliably from north/south, silently snaps back from east/west (confirmed via real dispatched pointer drags, both coarse 8-step and 60-sample fine-grained, ruling out test-density artifacts; ~200px control confirms the 1.25 cell-width forgiveness radius is not the bug). Root cause: the fallback freezes on the last-hovered zone, and lateral approaches tend to exit the cell while that zone is still left/right, not top. Recommend keying the fallback on proximity-to-band-at-exit rather than last-resolved-zone. 上 Toy Test flagged direction-dependent, not a clean pass. Part D held pending fix. Fight protocol untouched | design | LEAN | flags R4-D020/D021 |
| 2026-07-04 | R4-D021 | **末 live-play defect (R4-D020) fixed: root cause was H3 — the 'top' slot band sits against the edge of an out-of-reach cell from every approach direction, and the reach-highlight frame visually invites exactly the few-pixel overshoot that silently fails there.** All prior self-tests (S3/S4/S9 etc.) called `onChipDragStart/onChipDrag/onChipDragEnd` directly, bypassing Phaser's real drag pipeline, which is why they never caught this — reproduced instead via headless Chromium + CDP-dispatched real mousedown/mousemove/mouseup (handler-level invocation banned per R4-D020). For all 4 adjacency approaches, the 上+木(top)→末 recipe's target band sits at the edge of the host cell farthest from the avatar, immediately against the boundary of a cell one step *out of reach* (R4-D016); `showReachHighlight`'s frame (R4-D017) is drawn right up against that same boundary. A release just 2–6px past the host's top edge, from every approach direction, fell straight through the out-of-reach check in `onChipDragEnd` to a silent snap-back — no fizzle, no feedback, indistinguishable from doing nothing; confirmed 12/12 across direction × overshoot-depth combinations, matching the router's report exactly. H1 (chip circles occluding the band) and H2 (an overlapping chip intercepting dragend) were tested and ruled out by direct coordinate computation and live test (T2); H4/H5 checked clean — the 末 recipe is provenance-independent and 木-onto-standalone-上 already fizzles visibly (T3), no second defect there. Fix, input-layer only, R4-D016/D017/D018 left unchanged: `updateZoneOverlay` now records `lastValidTarget` (cell + zone) whenever the drag legitimately hovers a reachable, non-inert cell; a new `resolveDropTarget(pointer)` tries the raw release pixel first (unchanged common-case behavior) and falls back to `lastValidTarget` only if that fails and the release is still within one cell-width of it — a release that never touched a legal target, or that wandered far away afterward (a deliberate cancel), still snaps back exactly as before. This forgives the final pixel of a drag that was clearly aimed correctly; it does not widen which cells are reachable. T1–T7 all PASS via real dispatched pointer events (headless Chromium + CDP): 末 locks from all 4 approach directions with realistic overshoot; unaffected by other filled chips nearby; reverse-order fizzle confirmed visible; plain-click no-op (R4-D017 regression) and 9-point chip-click bail (R4-D018 regression) both hold; 林/森/炎/沐 recipes and fire/blaze darkness-clear magnitudes all resolve correctly; far-cell release still snaps back with the blocked-X overlay confirmed live mid-drag (R4-D016 regression). Zero console errors across the full suite | code | LEAN | R4-D020 |
| 2026-07-03 | R4-D018 | **Fixed chip/board click overlap: "clicking the middle inventory chip sometimes moves the avatar up one cell; it's meant to do nothing on click."** Root cause: chips are world-anchored (a satchel, not a screen panel — R4-D008), and the middle chip sits directly above the avatar with only ~2px of clearance to the cell boundary above; its 15px-radius hit circle means a click landing in roughly the top third of that circle falls past the boundary into the cell above. The global board-tap handler had no awareness a chip was there — it unconditionally converted pixel position to a grid cell and called onCellTap, walking the avatar into that cell. R4-D017's drag-distance threshold fixed the chip's *own* misfiring on a plain click but didn't touch this separate global handler, so the leak remained. Fix: the board-tap listener now runs `this.input.hitTestPointer(pointer)` first and bails if the pointer is over any chip's hit circle, before ever converting to a grid cell. Verified live via headless Chromium + CDP: filled both chip 0 and the middle chip (index 1), clicked the middle chip at 9 points spanning its full hit circle including the exact top-edge case that used to leak — avatar position and inventory unchanged in all 9; a regular tap on open board ground elsewhere still walks the avatar normally. Full regression suite (S1-S9 + affordance + adjacency + reach) re-run clean, zero console errors | code | LEAN | extends R4-D017 |
| 2026-07-03 | R4-D017 | **Reach visibility + click/drag disambiguation, fixing two observations raised against R4-D016.** (1) "It can only drag to four squares, and I like the chip's draggable highlight — add similar clues on cells that aren't draggable, because I still want to try the other cells": an out-of-reach cell went completely silent on hover under R4-D016, reading as broken rather than unreachable, so players kept probing cells that could never work. (2) "Clicking a collected character can drop it directly in front — inconsistent with dragging; it might feel like chips only need a click": Phaser's drag-start threshold defaults to 0px, so a plain click (which always carries a pixel or two of pointer jitter) could register as a micro-drag and silently resolve wherever it landed, undermining "drag is the one gesture" (R4-D006). Both fixes are affordance-only: `this.input.dragDistanceThreshold = 8` filters out click jitter so only a deliberate drag ever starts a compose attempt; a persistent reach-highlight now frames the (up to) 4 valid neighbor cells for the whole drag, drawn once at drag start rather than discovered cell-by-cell on hover; and a hovered out-of-reach cell now shows a dimmed blocked-X instead of nothing. Verified live via headless Chromium + CDP: a zero-movement click on a filled chip changes nothing on the board or in inventory; crossing the 8px threshold does trigger a real drag with the reach highlight visible; hovering a far cell shows the blocked X while the reach highlight persists; release there snaps back and clears both overlays; in-reach compose unaffected. Full regression suite re-run clean, zero console errors | code | LEAN | extends R4-D016 |
| 2026-07-03 | R4-D016 | **Placement/composition range: avatar-adjacent (orthogonal, reach 1) only; carried matter travels with the avatar; no world-to-world drag; ranged matter movement expressible only via the calculus (弓/鸟/vector marks), never via an input affordance.** Raised as follow-up feedback on the R4-D015 discoverability fix: the drag was now visible, but nothing constrained where it could land — a carried component could be dropped on any cell on the board, composing two cells that were never near each other. That's the same summoning/telekinesis failure §4.2 already rules out ("composition happens in the world, in place"), just one remove from the original card-hand problem. Ruling: pick up → walk → compose; the ≤3s rule (§9.1 Q7) is unaffected since its clock runs from compose-gesture-intent to visible resolution, not from harvest — walking to the target is play, not latency. Shipped: `onChipDragEnd`'s target-validity check now rejects any cell that isn't `isAdjacent` to the avatar (diagonals excluded v1 — cheaper to add than remove later), and `updateZoneOverlay` is gated identically so the overlay never advertises a target the drop would then reject. Verified live via headless Chromium + CDP: a drag released on a far cell shows no overlay and snaps back with the target cell unchanged; an in-reach cell (walked to first) still composes correctly; full regression suite re-run with an explicit walk step ahead of every compose, all green, zero console errors. **One cost logged honestly, not yet acted on:** adjacent-only makes fizzle-experimentation more expensive (walk back, re-pick, walk again) — but Part D (R4-D012) recorded **zero composition attempts of any kind**, so there is no fizzle-retry friction data yet to act on. The proposed undo-strike rider (decompose returns components at your feet) stays a watch-item for the next Part D run, not its own entry, until that session actually surfaces the friction | chat + code | LOCKED | partially closes OPEN-1 |
| 2026-07-03 | R4-D015 | **Discoverability fix shipped for R4-D012's BOUNCE** (compose gesture had zero discoverability — a filled inventory chip was a static 15px circle indistinguishable from an empty one, so nothing invited a player to grab and drag it). Fix is affordance-only, no new mechanic, no text/tutorial (still forbidden by §7 M0 scope): a chip that just received matter now pops 3x then settles into a continuous slow breathing pulse for as long as it's filled (works on touch, no hover required), paused during an active drag and resumed if the drag snaps back rather than consuming the chip; filled chips also brighten their stroke on mouse hover (additive, not a replacement for the pulse). Separately, the drag-time zone overlay (R4-D011) is extended to empty walkable ground — previously only occupied host cells got a visible overlay, so "drop here to free the slot" (which already worked mechanically) was invisible, matching John's "can't swap or give up" complaint; empty ground now shows a distinct "place here" ring during drag. Verified live via headless Chromium + CDP: chip scale visibly cycles at rest immediately after harvest with zero drag input; pointerover sets the hover/stroke state; the drop ring appears over empty ground mid-drag and clears on release with the slot correctly freed; idle pulse resumes after a snap-back (off-grid or invalid-target) release. Full S1–S9 regression suite from R4-D011 re-run clean against this build, zero console errors, zero regressions. **Ready for Design to re-run Part D** (the still-untested human session) — per the retest protocol, no GO/NO-GO can be filed until that happens | code | LEAN | — |
| 2026-07-03 | R4-D012 | **Part D human session run (John, unprompted, no tutorial) — BOUNCE: compose gesture has zero discoverability, not a fun/mechanics problem.** Session data: walk+harvest loop was immediately legible and produced delight ("moving like a maze," interested to see characters picked up); zero menu-work-feel reported (clean pass). But **0 compositions were attempted** — John filled the 3-slot inventory and had no path forward ("can't swap or give up"), never discovering that inventory chips are drag targets. Direct re-test (this pass) dispatching real synthetic `mousedown/mousemove/mouseup` at a chip and dragging it onto the remaining tree confirms the underlying pipeline is flawless end-to-end (drag → zone overlay → 林 lock, full inventory slot freed) — so the defect is not the mechanic, it's that nothing about a resting inventory chip (15px circle, near-invisible fill/stroke, no motion, cursor-only hover cue) invites a player to grab and drag it. This blocks scoring the ≥8-composition and fizzle-affect Go/No-Go metrics entirely, since the player never reaches them. **Verdict: BOUNCE** (not GO, not NO-GO — a newly discovered defect per retest protocol Part E). Recommend a minimal affordance fix (idle pulse/glow on filled chips, or a first-touch nudge cue) before Part D is re-run. Fight protocol untouched | design (Claude) | LEAN | — |
| 2026-07-03 | R4-D011 | **M0.1 fix-pass verification: R4-D008 and R4-D009 both CONFIRMED FIXED against the live build.** Direct interaction testing (via the actual drag/overlay/composition event handlers, not just source review) confirms: zone geometry has zero dead zone and 0% `enclose` reachability across a full-cell scan (fixes R4-D008); 上+木 at the top zone locks 末 end-to-end (snap, glow, "mò", growth glyph), with correct fizzle behavior for every other host including a second 上 onto the new 末 (fixes R4-D009); 口 fully absent from grid/components (fixes the R4-D007 flag); luminosity magnitudes (火=1, 炎=2) verified live against a level-2 dark cell. Ten Questions re-run clean, both prior deltas (Q2, Q4) now PASS clean, zero regressions in 林/森/炎/沐, zero console errors. **Fight protocol §8 step 3/4 remains held** — this is a build-quality confirmation, not a GO/NO-GO: Part D (the untested human session) has not been run, and per the retest protocol's hard rule no verdict can be filed without it. Full detail in `M0.1 Composition Room - Playtest Report.dc.html` | design (Claude) | LEAN | R4-D008, R4-D009, R4-D010 |
| 2026-07-03 | R4-D010 | **M0 Go/No-Go verdict: CONDITIONAL — NOT YET GO.** Playtested `m0-composition-room.html` directly (drag-compose flow, harvest/strike loop, all four M0 rulings). The core loop (read→harvest→carry→attach→lock-or-fizzle) is genuinely satisfying and passes the Fun Gate and Illiterate Fun Test *in concept* — 林 forming under a natural "drop beside" gesture, the lock-pulse+pronunciation, and the spark/shake fizzle all land. But the *build* has two concrete defects that risk a false NO-GO in real human play: the slot-pick geometry (R4-D008) and 上's zero-success-path (R4-D009). Fight protocol step 3/4 is **held**: do not archive this track (concept is not the problem) and do not freeze v3 authoring yet (verdict is not a clean GO). Fix R4-D008 + R4-D009, then run the real 10–15 min human session before re-filing | design (Claude) | LOCKED | — |
| 2026-07-03 | R4-D009 | **Design verdict on OPEN-5 (上 as fixed-top-only mark): REVISE.** The mark-as-slot-variant approach is mechanically sound and cheap, but as shipped in M0, 上 has **no consuming recipe at all** (末 = 上+木 is in the stability registry §4.4 but not in this build's `resolveComposition`), so every single attempt to use 上 fizzles by construction — confirmed by direct test (dragged 上 onto 林, onto 木, at every zone; 100% fizzle, 0% variance). A component that *cannot* ever succeed reads as broken after 2–3 tries, not as a toy — this violates the spirit of §4.4's "never nothing, always interesting" pedagogy even though the fizzle animation itself is fine. Fix: either implement the minimal 末 recipe (上-mark at top of a standalone 木) for M0, or cut 上 from the M0 five-component set until a recipe exists — do not ship a component with a deterministic 0% success rate | design (Claude) | LEAN | R4-D005 (M0 build ruling) |
| 2026-07-03 | R4-D008 | **Design verdict on OPEN-2 (single-drag + 3×3-zone slot picker): REVISE — this is the most likely NO-GO driver.** Tested `cellLocalZone()` directly: it is not an even 3×3 grid. The x-check runs before the y-check, so `left`/`right` claim both top corners *and* both bottom corners as full-height ~24px-wide strips, leaving `top`/`bottom` reachable only through a narrow ~24×24px sliver in the dead-center column — roughly 11% of the cell's area — and a release aimed at the visual center of the glyph (where a player's eye/thumb naturally lands) resolves to `enclose`, not a directional slot. There is also **zero visual affordance**: no zone highlight, no hover state, no cell subdivision drawn — players are aiming at invisible boundaries. On touch this is worse: a fingertip occludes the ~24px target it needs to hit. This is exactly the "feels like menu-work" failure mode named in charter §7 — precision-guessing at a hidden layout is menu interaction wearing a drag costume. Recommend: draw the zone boundaries as a faint overlay during drag (removed on release), and/or widen top/bottom to full-width bands with left/right as corner-only remainders, before the human session runs | design (Claude) | LEAN | R4-D005 (M0 build ruling) |
| 2026-07-03 | R4-D007 | **Design verdict on the invented 火/口/上 source points + fire's luminous magnitude: PARTIAL AFFIRM.** The magnitude scheme (火=1, 炎=2, confirmed by direct test: single 火 clears a level-1 dark cell but only dents a level-2 cell from 2→1; 炎 finishes it 1→0) is not itemized in §4.5's magnitude table, but it is a faithful, warranted extrapolation of the already-`[LOCKED]` §2.3 repetition-scales-intensity pattern (木→林→森, 火→炎→焱) — affirm it and add it to §4.5's table as a named rule so it stops being "invented, unspec'd." The hearth/waystone points (renewable 火/上 deposits) are a reasonable, low-cost world-authoring choice consistent with Law 2. **Flag:** the vent (口 source) is a dead end in M0 — no stability recipe in this build consumes 口, and none of the four live reaction rules (1–3, 7) key off `emits_sound`, so 口 currently fails its own Toy Test (needs ≥3 interesting interactions, has zero). Either give 口 one live interaction before the human session, or cut the vent from M0 and reintroduce 口 at M1 with 鸣 | design (Claude) | LEAN | R4-D005 (M0 build ruling) |
| 2026-07-03 | R4-D006 | **Design verdict on OPEN-1 (3-slot inventory): AFFIRM.** Direct play confirms 3 slots is not felt as a constraint: because composition always targets a component already resting in the world (never carried-onto-carried), the practical pattern is harvest-one/place-as-host, harvest-one/attach — at most 2 slots in flight for any M0 recipe, with the 3rd as comfortable slack. No inventory-management feel emerged in testing. Keep at 3 for M1; revisit only if a future recipe needs 3+ simultaneous carries | design (Claude) | LEAN | R4-D005 (M0 build ruling) |
| 2026-07-02 | R4-D005 | Bound radicals resolved: 氵灬囗忄 are attached *forms* of 水火口心, not independent matter; 冫宀 are harvestable environmental matter | chat (Reviewer-4) | LEAN | v3 gap A2 |
| 2026-07-02 | R4-D004 | Fire-constructs adopted natively via 灬-under slot rule (bake/cook/dry); Resource Entropy replaced by conservation of matter (Law 2) | chat (Reviewer-4) | LOCKED | limbo items from review triage |
| 2026-07-02 | R4-D003 | M0 = five-component composition room (水火木口上); Go/No-Go criteria per §7; M0 precedes any further puzzle authoring on either track | chat (Reviewer-4) | LOCKED | — |
| 2026-07-02 | R4-D002 | Parallel-track fight protocol adopted (§8): v3 bible remains authoritative for its track until M0 verdict; no mechanic migration without dual log entries | chat (Reviewer-4) | LOCKED | — |
| 2026-07-02 | R4-D001 | Substrate-literacy model adopted for this track: three laws (world is written / components conserve / position is a mechanic); component calculus (§4) is the formal core; isomorphism principle is the design invariant | chat (Reviewer-4) | LOCKED | — |

---

## Appendix A — Glossary (for cold-start agents)

| Term | Meaning |
|---|---|
| **Substrate-literacy design** | Design principle: the learning target must be the game's rendering substrate and resource system, not its content (§1.3) |
| **Translation game** | The failure pattern: signs are labels on toys; skill accrues to the toys, not the signs |
| **Component calculus** | The six-primitive formal model (§4.1) |
| **Slot** | One of six attachment positions (left/right/top/bottom/enclose/under) with tag-transforming rules |
| **Stable / unstable** | A composition matching / not matching a real character; stable locks and persists, unstable acts briefly and falls apart |
| **Stability registry** | The list of real-character recipes live in the current build (§4.4) |
| **Situation** | A goal authored as terrain + desire with no solution list (§7 M3) |
| **Fight protocol** | The procedure by which this track and the v3 track are tested against each other (§8) |
| **The bible** | design-bible-v3.md — authoritative for the v3 card-deployment track and for the shared sections listed in §0 |
| **Router** | The human (John) who carries slices between agents and makes binding calls |
| **Tier A/B/C/D** | Character viability tiers from bible §0.5 (象形/指事 free · 会意 composed · 形声 restricted · 假借 functional) |

*End of Charter v1.*
