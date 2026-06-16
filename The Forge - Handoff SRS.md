# The Forge (炼字坊) — Software Requirements Specification

**Handoff document for the AI coding assistant**
Casey Chinese School · Character Studio — game module
Version 1.0 · 2026-06-16

---

## 0. How to read this document

This SRS hands off a **working HTML/JS prototype** plus a set of **required changes** and a
**forward design recommendation**. Read in this order:

1. §1–§3 — what the game is and what already exists (read the prototype code first).
2. §4 — the three product updates you must implement now (these change the prototype).
3. §5 — the **holistic character system** recommendation (the big architectural decision; read carefully).
4. §6–§9 — data model, architecture, difficulty, integration.
5. §10–§12 — assets to acquire, acceptance criteria, open questions.

**Before writing code, read these prototype files** (they are the source of truth for look, feel, and
current behavior):

| File | Role |
|---|---|
| `The Forge (game).html` | Game shell: layout, full CSS, Tweaks wiring |
| `journey/forge-game.js` | Game engine: 3 rounds, heat/combo/cracks/stars, win/finish |
| `journey/forge-stroke-data.js` | Embedded makemeahanzi stroke data (5 chars, demo) |
| `assets/data/stroke-data.json` | 200-char stroke path + median library (makemeahanzi) |
| `assets/stroke-cell.js` | Canonical stroke renderer (palette + transform; reuse it) |
| `assets/character-library.json` | W/R/S status per band (design-time character source) |
| `Learning Journey - Scroll.html` + `journey/scroll.js` | The handscroll "journey" the Forge plugs into (integration target) |

---

## 1. Product vision

> **The Forge** turns *learning a Chinese character* into *building* one. The player forges characters
> at three structural "grains" — strokes, components, and sound+meaning radicals — under light time
> pressure, earning stars for speed and accuracy. Forging mirrors how the character is actually
> constructed, so the player learns the writing system's logic by playing it.

It is the **stage-opener inside the handscroll Journey** (`Learning Journey - Scroll.html`): tapping a
lesson node opens a Forge run over that lesson's characters. The Forge must also run **standalone** as a
practice/arcade mode.

This is a **game, not a flashcard drill**. The non-negotiable design pillar: *every round contains a real
decision that can be wrong, under pressure, with a cost.*

---

## 2. The current prototype — behavior spec

A **run** = a short session of **rounds**. Each round forges one character at one of three grains.

### 2.1 The three forge grains

| Grain | Demo char | Mechanic | Skill trained |
|---|---|---|---|
| **Stroke** | 日 | Tap the character's strokes **in correct writing order** on a tianzige grid; each correct tap inks that stroke (rainbow palette) into its true position; wrong stroke = crack | Stroke order, stroke shape |
| **Component** (会意) | 明 | Pick the components whose **meanings** combine (日 sun + 月 moon → bright). Pool seeded with look-alike decoys (目 eye, 田 field) | Decomposition; component meaning/shape recall |
| **Radical** (形声) | 妈 | Fill a **义/形 meaning** slot (recall: woman → 女) **and** a **声 sound** slot (match pinyin: mā → 马). Decoys: semantic neighbors (母, 子) + other-sound parts (鸟 niǎo, 与 yǔ) | Radical meaning recall + phonetic matching |

### 2.2 Game systems (already built — preserve)

- **Heat bar (火)** drains continuously from round start. Its zone at completion sets the star rating
  (hot ≥62% → ★★★, warm ≥26% → ★★, cool → ★). Creates pace without a hard fail.
- **Combo multiplier** — consecutive correct picks multiply points; a wrong pick resets it.
- **Cracks** — each wrong pick: −heat, breaks combo, shake + red reject animation, and (for known
  decoys) a one-line teaching nudge ("母 *means* mother, but the radical in 妈 is the broader 女").
- **Stars + score + best-score** persisted in `localStorage` (`ccs-forgegame-v1`).
- **Reveal overlay** per round (stars, char, pinyin, meaning, heat/combo/cracks tally) and a **run-finish
  overlay** (total score, star line, forged strip, best).
- **Rail** (bottom) shows the run's rounds and earned stars.
- **Tweaks panel** (hidden until toggled): hints, speak-the-character (TTS), larger character, new run.
- Visual system: studio palette (coral/ink/paper), fonts Manrope / Newsreader / Noto Serif SC,
  per-grain accent color, confetti, `ruby`-free (the Forge shows pinyin as plain text, not ruby).

### 2.3 What is intentionally *not* in the prototype

- No target-memorization phase (added in §4.1).
- Hints are over-generous (fixed in §4.2).
- Only 5 characters have embedded stroke data; decomposition is hand-authored per demo char. The real
  system needs a **data pipeline** (§5).

---

## 3. Tech baseline

- **Vanilla JS engine** (`forge-game.js`), no framework, IIFE, `localStorage` persistence. Keep the
  engine framework-free or port to the host app's stack — but **do not** require a heavy framework just
  for this module.
- **React + Babel** is used *only* for the Tweaks panel (dev convenience). In production the Tweaks panel
  is optional; the game must run without it.
- **Stroke rendering**: makemeahanzi paths in 1024 **Y-up** space, wrapped in
  `<g transform="translate(0,900) scale(1,-1)">`, on a `viewBox="0 0 1024 1024"` tianzige grid.
  Rainbow stroke palette `hsl(8 + t*282, 70%, 45%)`. **Reuse `assets/stroke-cell.js` verbatim** for any
  stroke drawing — it is the locked, canonical renderer.
- Tap-based interactions (not drag) — chosen for reliability on tablets.

---

## 4. REQUIRED UPDATES (implement these on top of the prototype)

These three changes are mandatory for the next build. Each has rationale + spec + acceptance criteria.

### 4.1 Update — Target preview countdown, then hide

**Rationale:** recall, not recognition. The character should be *memorized briefly, then forged from
memory* — this is what makes it a game of skill instead of a copy task.

**Spec — round lifecycle becomes a 3-phase state machine:**

```
PREVIEW  →  FORGE  →  REVEAL
```

- **PREVIEW** (default **3 s**, configurable `previewMs`): show the **target glyph large**, with its
  pinyin + English, and a visible **countdown** (ring or shrinking bar). Optionally play the audio once.
  This is the only place full information is shown.
- **FORGE**: the target glyph **disappears**. The player forges from memory. A minimal *prompt* remains
  (see §4.2 for exactly what). The heat bar starts draining at the **start of FORGE**, not PREVIEW.
- **REVEAL**: unchanged (stars, tally, the now-revealed character).

**Details:**
- The countdown is skippable by tap ("I've got it") — tapping early starts FORGE immediately and grants a
  small **speed bonus** (rewards confidence).
- Stroke grain: during FORGE the faint ghost outline is **difficulty-dependent** — present at Level 1,
  removed at higher levels (see §8). Default for the standalone arcade: ghost **off** after preview.
- Component/Radical grain: the **target glyph in the equation is hidden** during FORGE — show `?`
  in the result position, not `明`/`妈`.
- `previewMs` is a difficulty/Tweak knob (e.g., 5 s easy / 3 s normal / 1.5 s hard / 0 s expert).

**Acceptance criteria:**
- [ ] Round opens in PREVIEW with glyph + countdown; glyph is gone once FORGE begins.
- [ ] Heat does not drain during PREVIEW.
- [ ] Tapping during PREVIEW skips to FORGE and records a speed bonus.
- [ ] The target glyph is never visible during FORGE at default difficulty (no glyph, no `= 明` crutch).

### 4.2 Update — Reduce hints (progressive disclosure)

**Rationale:** the prototype front-loads answers — pinyin + English always on top, stroke-order numbers
always on every piece, and the target character printed in the component equation. That collapses the
decision. Hints must be **earned by struggling**, not given upfront.

**Spec — default hint budget (Level "normal"):**

| Hint | Prototype (now) | Required default |
|---|---|---|
| Target glyph during forge | shown | **hidden** (§4.1) |
| Stroke-order numbers on pieces | always on | **off**; reveal the *next* number only after a wrong tap, and only for that one stroke |
| Pinyin of target | always on top | shown in **PREVIEW only**; in FORGE keep only what a grain *needs* (see below) |
| English meaning of target | always on top | shown in **PREVIEW only**; in FORGE optional, see cue policy |
| Component meanings on cards | (hidden already) | keep hidden; reveal a card's gloss only when it is correctly slotted, or as an earned hint |

**The FORGE-phase cue policy (what stays on screen as the prompt):**
The player needs *some* cue or there's nothing to forge toward. Keep the **minimum sufficient cue per
grain**, configurable via a `cueLevel` setting:

- **Stroke grain** — cue = the (optional) ghost outline + audio on demand. No numbers.
- **Component grain (会意)** — cue = **English meaning only** ("bright"). The player must recall which
  parts mean that. No glyph, no pinyin.
- **Radical grain (形声)** — cue = **English meaning + pinyin** (e.g., "mother · mā"), because the sound
  is a *given input* to the phonetic decision (per product owner: "you know it's said mā"). No glyph.

**Progressive hint ladder (per round, escalating only on failure):**
1. 0 cracks → no hints.
2. After **2 cracks** → reveal one targeted hint (stroke: next stroke's number; parts: dim the wrong
   cards / outline a correct slot's category).
3. After **4 cracks** → reveal the answer for the current step (so no one is hard-stuck), but cap stars at ★.

**Acceptance criteria:**
- [ ] On a fresh normal-difficulty round, no stroke numbers, no target glyph, and only the grain's minimal
  cue is visible.
- [ ] Stroke numbers / card hints appear only after the crack thresholds above.
- [ ] `cueLevel` and `previewMs` are exposed as settings (Tweaks + a real Settings surface).

### 4.3 Update — Book-independent character sourcing

This is the *implementation consequence* of §5. Summary requirement: **the game must not be limited to a
single book's character list.** It must draw from a general, structured **character library** with
decomposition metadata, and schedule characters by structural dependency + frequency (§5). Book lessons
become an optional *playlist/skin* over that library, not the underlying structure.

**Acceptance criteria:**
- [ ] Game content is loaded from a generated `characters.json` (the graph of §5/§6), not hard-coded round
  objects.
- [ ] A "book lesson" is expressed as a filter/playlist (a list of character ids) over that library.
- [ ] Adding a new book = adding a playlist; it requires **no** changes to game logic.

---

## 5. RECOMMENDATION — the holistic character system (book-independent)

> Product owner's prompt: *"all sound parts are essentially individual characters, but hard to coordinate.
> We must have a very systematic approach to look at all characters holistically… not limited to books,
> but a more general character library."*

This is correct, and it is the single most important architectural decision. Here is the recommended
approach.

### 5.1 The core model: a forging dependency graph (DAG)

Every character is a **node**. A composite character has **edges to its components**. Components are
themselves nodes — most are standalone characters (日, 月, 女, 马), some are bound radical forms
(氵 = 水, 亻 = 人, 艹 = 艸). This forms a **directed acyclic graph**:

```
strokes ──▶ atoms (口 木 日 月 女 马 …) ──▶ composites (明 妈 林 好 …) ──▶ higher composites
            (stroke-forged)               (component / radical-forged)
```

**Forging rule:** a character is *forgeable* only once **all its components are owned** (already
forged at the stroke level, or recognized). This makes the progression "individual → complex" automatic,
systematic, and book-independent — it is driven by the structure of the writing system, not by a syllabus.

This also solves the coordination problem the owner raised: because a phonetic component (e.g., 马 in 妈
吗 骂) is a node, it is introduced **once** as a stroke-forge atom, then **reused** everywhere it appears as
a sound part. You never "re-teach" it; the graph guarantees it's owned before any character that needs it.

### 5.2 Classify each character's forge mode from data (don't hand-author)

Decompose and classify **offline in a build step**, producing a static `characters.json` the game reads.
Classification → grain:

- **Stroke forge** — leaf / unanalyzable / pictographic / indicative (象形, 指事), or any node chosen as an
  "atomic component."
- **Component forge (会意)** — 2+ components, all **semantic** (no phonetic).
- **Radical forge (形声)** — has a **semantic** component (the meaning/radical) **and** a **phonetic**
  component (the sound). This is ~80% of characters — the workhorse grain.

### 5.3 Data sources (all open, and we already use one)

| Source | Gives us | Notes |
|---|---|---|
| **makemeahanzi** `dictionary.txt` | per char: `pinyin`, `definition`, `decomposition` (IDS), `radical`, **`etymology`** | **Same project as our stroke data.** `etymology.type` ∈ {pictographic, ideographic, pictophonetic}; for pictophonetic it names **`semantic`** and **`phonetic`** components explicitly — exactly the meaning/sound split the radical grain needs. |
| **makemeahanzi** `graphics.txt` / our `stroke-data.json` | stroke paths + medians | already integrated; the 200-char file is a subset — regenerate for the full in-scope set |
| **CHISE / CJKVI IDS** | full Ideographic Description Sequences for all CJK | fallback decomposition when etymology is absent; gives structural operators (⿰ ⿱ ⿵ …) |
| **Unihan** (`kFrequency`, `kGradeLevel`, radical-stroke) | frequency + grade banding | for curriculum ordering |
| **A modern frequency list** (Jun Da / SUBTLEX-CH) | usage rank | better ordering than Unihan kFrequency alone |
| **HSK / VCAA / book lists** | playlists | become filters over the graph, not the graph itself |

> **Recommendation:** standardize on **makemeahanzi as the spine** (we already use its strokes, so Unicode
> coverage and component names stay consistent), enrich with **IDS** where etymology is missing, and layer
> **frequency** for ordering.

### 5.4 The build pipeline (offline, run once / on data change)

```
makemeahanzi dictionary + graphics  ┐
CJKVI IDS                           ├─▶  build script  ─▶  characters.json   (+ stroke-data.json)
Unihan / frequency list             ┘                       components.json
HSK / book lists                    ──────────────────────▶ playlists/*.json
```

The build script must, per character:
1. Resolve **components** (etymology → IDS fallback). Strip pure structural operators; keep component chars.
2. Tag each component as **semantic** or **phonetic** (from etymology; for 会意 all semantic).
3. Decide **forge grain** (§5.2).
4. Map **bound radical forms** to their parent character (氵→水) and store the gloss/origin.
5. Compute **depth** (longest path to an atom) and attach **frequencyRank** + **strokeCount**.
6. Flag cycles/self-reference → treat as atom. Flag a `treatAsAtom` allow-list (e.g., 青 used as a phonetic
   block even though decomposable).
7. Emit decoy hints (§5.5) or leave decoy generation to runtime (also fine).

The **game never decomposes at runtime** — it consumes the prebuilt graph. This decouples the hard
linguistic data work from gameplay and keeps the client small.

### 5.5 Systematic decoy generation (the engine of challenge)

Decoys must be **computed from the graph**, never hand-written, so they scale to thousands of characters
and stay fair. Three principled pools:

- **Stroke decoys** — strokes lifted from a **visually similar** character (same stroke count / shared
  sub-structure). Optional; ordering alone is already challenging.
- **Meaning-slot decoys (component/radical)** — other components that are **(a) visually confusable**
  (日 vs 目 vs 田 — share a box) or **(b) semantically adjacent** (女 vs 母 vs 子 — the
  "family/person" neighborhood). Pull siblings via shared radical or similar IDS.
- **Sound-slot decoys (radical)** — phonetic components with a **different syllable** at easy levels;
  at hard levels, **same syllable / different tone** (mā vs mǎ vs mà). Tones are the #1 learner error
  and an infinite, fair decoy source. (Per owner: exact tone of the phonetic vs the character is *not*
  the focus — match at the **syllable** level; tone-drift becomes *advanced content*, not a bug.)

This yields a curriculum whose two trained skills are **radical meanings** and **tones/syllable matching**
— the highest-value, most-learnable, most book-independent skills in the language.

### 5.6 Curriculum scheduling (individual → complex, automatically)

- A character is **available** when all its components are owned.
- Order available characters by **(depth, frequencyRank)** — low depth + high frequency first.
- Result: the player forges high-frequency atoms (女 马 日 月 口 木 …) first, which **unlock** the
  high-frequency composites built from them (妈 好 明 林 …), and so on. No book needed to define order.
- **Just-in-time component introduction:** if a needed component is obscure / not an everyday standalone
  character, introduce it *at that moment* as a quick stroke-forge "atom" with a one-line gloss, then use
  it. Never block on whether a component is "a real word."
- **Books as playlists:** a lesson is `["妈","爸","好",…]`. The scheduler still guarantees each char's
  components are forgeable first (auto-inserting any missing atoms as a warm-up), so book order and
  structural order coexist.

### 5.7 The component inventory ("your deck")

The union of all components referenced in-scope (~the 214 Kangxi radicals + a few hundred common phonetic
components). Each is a node; standalone ones are stroke-forgeable, bound ones link to a parent. This deck:
- is the collection meta-game (cards you "own"),
- is the gating mechanism (own the parts → unlock the wholes),
- and the decoy source.

### 5.8 Edge cases to handle in the build (document, don't guess)

- Multiple readings (多音字) — store the character's **target reading** separately from a phonetic's
  reading; sound matching is syllable-level on the **target** reading.
- Phonetic that no longer sounds like the character (sound drift) — still valid as the phonetic node;
  mark `soundDrift:true` so the game can teach it as "advanced."
- Characters with 3+ components — tag each slot semantic/phonetic; the radical grain generalizes to N
  slots (1 phonetic + N−1 semantic, typically).
- Non-decomposable but high-frequency (我, 来 — 假借/borrowed) — **stroke forge**; surface the borrow story
  as a codex note, not a mechanic (do **not** invent a 假借/转注 mini-game; they are historical
  relationships, not construction methods).

---

## 6. Data model

### 6.1 `characters.json` (the graph — generated)

```jsonc
{
  "妈": {
    "char": "妈",
    "pinyin": "mā",
    "meaning": "mother",
    "strokeCount": 6,
    "grain": "radical",                 // stroke | component | radical
    "etymologyType": "pictophonetic",   // pictographic | ideographic | pictophonetic
    "components": [
      { "char": "女", "role": "semantic" },
      { "char": "马", "role": "phonetic", "pinyin": "mǎ" }
    ],
    "depth": 1,                         // 0 = atom
    "frequencyRank": 612,
    "hsk": 1,
    "treatAsAtom": false
  },
  "日": {
    "char": "日", "pinyin": "rì", "meaning": "sun · day",
    "strokeCount": 4, "grain": "stroke", "etymologyType": "pictographic",
    "components": [], "depth": 0, "frequencyRank": 78, "hsk": 1
  }
  // …
}
```

### 6.2 `components.json` (the deck — generated)

```jsonc
{
  "氵": { "char": "氵", "standalone": false, "parent": "水", "pinyin": "shuǐ", "meaning": "water" },
  "女": { "char": "女", "standalone": true,  "pinyin": "nǚ",  "meaning": "woman" }
}
```

### 6.3 `stroke-data.json` (already exists; regenerate for full scope)

`{ "日": { "s": [<svg path d> …], "m": [[[x,y]…]…] }, … }` — makemeahanzi 1024 Y-up.

### 6.4 Playlists

```jsonc
// playlists/book1-lesson7.json
{ "id": "b1-l7", "title": "School & me", "chars": ["学","生","家","好","我","叫","今","年","岁","是"] }
```

### 6.5 Runtime/persisted state

```jsonc
// localStorage: ccs-forge-progress-v1
{
  "owned": ["日","月","女","马","口","木"],     // forged atoms / recognized components
  "mastery": { "妈": 2, "明": 3 },              // 0..3 per character (decays for review)
  "best": 1240,
  "settings": { "previewMs": 3000, "cueLevel": "normal", "difficulty": "normal", "sound": true }
}
```

---

## 7. Architecture

```
characters.json ─┐
components.json ─┼─▶  ContentService     (load graph, resolve a round's parts + decoys)
stroke-data.json─┘         │
playlists/*.json ──────────┤
                           ▼
Scheduler  (availability by owned-components; order by depth+frequency; book-playlist filter)
                           │
                           ▼
ForgeEngine  (round state machine: PREVIEW→FORGE→REVEAL; heat/combo/cracks/stars; hint ladder)
   │            ├─ StrokeRound   (reuse stroke-cell.js renderer)
   │            ├─ PartsRound    (component + radical; slot/decoy logic)
   ▼
Renderer (DOM)        Persistence (localStorage)        Audio (zh-CN TTS)        Tweaks/Settings
```

- Keep `ForgeEngine` framework-free and **decoupled from content** (it receives a fully-resolved round
  object: target, grain, slots, pool-with-decoys, cue policy). The Scheduler/ContentService produce that
  object from the graph. This is the key refactor from the prototype's hard-coded `ROUNDS` array.
- Reuse `assets/stroke-cell.js` for all stroke SVG.
- Mobile/tablet first; tap interactions; ≥44px targets; works offline once data is bundled.

---

## 8. Difficulty model

A single `difficulty` (and per-knob overrides) drives:

| Knob | easy | normal | hard | expert |
|---|---|---|---|---|
| `previewMs` | 5000 | 3000 | 1500 | 0 |
| stroke ghost in FORGE | on | off | off | off |
| stroke numbers | on first attempt | on after 2 cracks | on after 3 cracks | never |
| decoy count (parts) | 1 | 2–3 | 4 | 5+ |
| sound decoys | different syllable | different syllable | + 1 tone-variant | tone-variants |
| heat drain rate | slow | normal | fast | fast |

Difficulty can also **auto-tune** from rolling accuracy (optional, post-MVP).

---

## 9. Integration with the Journey (handscroll)

- Tapping a lesson node in `Learning Journey - Scroll.html` opens a Forge **run** built from that lesson's
  playlist; clearing it returns stars/score to the node and "walks" the forged characters into the scroll
  (the Journey already has the living-scroll reward strip).
- The Forge writes `mastery` per character; the Journey's "ink fades / review" loop reads it.
- Standalone arcade mode = a run scheduled purely by the graph (no book filter).

---

## 10. Assets & data to acquire

- [ ] **makemeahanzi** `dictionary.txt` + `graphics.txt` (MIT/ARR-friendly; verify license for shipping).
- [ ] **CJKVI / CHISE IDS** for decomposition fallback.
- [ ] A **frequency list** (Jun Da modern Chinese, or SUBTLEX-CH) + **Unihan** for grade banding.
- [ ] Build script (Node) producing `characters.json`, `components.json`, regenerated `stroke-data.json`.
- [ ] Decide TTS strategy (browser `speechSynthesis` is the prototype's stopgap; consider prerecorded
      audio for consistent zh-CN voices across devices).

---

## 11. MVP acceptance criteria

**Gameplay**
- [ ] §4.1 preview-countdown-then-hide implemented across all three grains.
- [ ] §4.2 reduced/progressive hints implemented; default round shows no answers.
- [ ] Three grains play exactly as the prototype, minus the removed crutches.
- [ ] Heat, combo, cracks, stars, reveal, finish, best-score all preserved.

**Content / system**
- [ ] Rounds are generated from `characters.json` (no hard-coded round data). §4.3.
- [ ] At least **HSK 1–2 (~300 characters)** fully decomposed, classified, and playable end-to-end,
      proving the pipeline beyond the demo's 5 chars.
- [ ] Decoys generated from the graph (§5.5), not hand-authored.
- [ ] Scheduler enforces "components owned before composite," with just-in-time atom insertion.
- [ ] A book lesson runs purely as a playlist filter with no engine changes.

**Quality**
- [ ] Runs offline after load; tablet-first; ≥44px targets; no console errors.
- [ ] Matches the prototype's visual system (palette, fonts, motion).

---

## 12. Open questions for the product owner

1. **Preview length & ghost:** default `previewMs` (proposed 3 s). the stroke ghost
   stays at the easiest level only.
2. **Failure stakes:** keep the current forgiving model (cracks cost stars, never end a run)
3. **Heat on component rounds:** make component/radical *pure puzzle* (speed bonus only, no drain)
4. **Scope of the first library:** HSK 1–2 for MVP, architected for the full set.
5. **Sound matching strictness:** syllable-only.
6. **Shipping vs generating data:** bundle a prebuilt `characters.json` + checked-in.

---

*End of SRS v1.0. The prototype (`The Forge (game).html`) demonstrates §2 and the look/feel; this document
specifies the §4 updates and the §5 holistic system the next build must implement.*
