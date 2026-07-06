# M1 Planning Spec v1.1 — Widen the Table
**Track:** Reviewer-4 / substrate-literacy (reviewer4-charter-v1.md governs)
**Authorized by:** R4-D019 (M1 planning begins; duration bar re-derived here) · adopted as R4-D030/D031 · amended per Part D findings (R4-D032/D033)
**Reading order for cold pickup:** charter §1, §4, §9.0–9.1 → this spec → build handoff (§8 below)

---

## 0. What M1 answers

M0 answered: *is compose/decompose inherently fun for one sitting?* (CONDITIONAL GO, R4-D019 — loop metrics passed, duration untested at spec'd width.)

M1 answers exactly one deferred question: **does the loop sustain >10 minutes of voluntary play at real material width (~12 components, ~10 recipes)?** This is the M1 duration gate. It is also the gate holding the bible's legacy-porting (D019) — a FAIL here reopens §8 step 4 (v3 resumes via the bible's D054 dormancy checklist).

Not in M1: goals/situations (M3), multi-room authoring (M2), Transfer Test probes (M2), creatures with real autonomy, art.

---

## 1. Component set — 12  `[LEAN]`

Live 4 carry over; 8 join. Every newcomer's Toy Test is itemized — ≥3 interactions (compositions + reactions), per charter §5.

| # | comp | status | base tags | Toy Test (≥3) |
|---|---|---|---|---|
| 1 | 水 | live | `is_wet, flows` | extinguish · 沐 · 泪 · freezes (no 冫 in M1 — reaction dormant) |
| 2 | 火 | live | `is_hot, is_luminous(1)` | ignite · dark-clear · 炎 · **灬-under transform (new)** |
| 3 | 木 | live | `is_flammable, is_buoyant, is_structural, is_organic` | 林/森 · burns · 休/本/末/困/相 host |
| 4 | 上 | live | mark: `vector_up` | 末 · rises host · fizzle-family |
| 5 | 下 | new | mark: `vector_down` | ① 本 (root-anchor) ② 下-marked 木 sinks in water instead of floating — inverts buoyancy, pure toy ③ mark-fizzles |
| 6 | 日 | new | `is_hot(mild), is_luminous(2)` | ① clears darkness-2 ② 明 ③ adjacent `is_wet` ground dries slowly (mild heat, never ignites) |
| 7 | 月 | new | `is_luminous(1)` | ① clears darkness-1 ② 明 ③ 朋 (stretch) |
| 8 | 土 | new | `is_structural` (lost when wet) | ① 灬-under bakes → brick-state (permanent structural) ② +水 → mud (loses structural) ③ fills gaps |
| 9 | 口 | new (returns per R4-D007) | `emits_sound` | ① 鸣 ② 困 (enclose) ③ sound attracts adjacent 鸟 |
| 10 | 鸟 | new | `is_living, vector_up` | ① flees adjacent `is_hot` (rule 8) ② 鸣 ③ perches on 木/林/森 (idle tween — a toy, not a system) |
| 11 | 人 | new | `is_living` | ① 休 ② flees adjacent `is_hot` ③ carryable-glyph oddity: a harvested 人 walks a slow idle loop when placed (minimal tween) |
| 12 | 目 | new | `is_luminous(reveal-only)` | ① reveals darkness contents without clearing ② 泪 (stretch) ③ 相 (stretch) |

**Cut from M1, parked for M2:** 石 (thin without 山/刀), 山, 刀 (OPEN-3 tool-gating deferred), 心/忄 (OPEN-6), 女/宀, 雨, 鱼, 耳, 手, 大/小, 冫.

**Luminosity magnitude table (extends §4.5 rule 7):** 月=1 · 火=1 · 日=2 · 炎=2 · 明=3. Darkness levels 1–3 authored in the M1 room.

---

## 2. Slot additions — two new, per charter §7 M1 scope  `[LEAN]`

| Slot | Attached form | Only M1 component with the form | Rule | Warrant |
|---|---|---|---|---|
| **under** | 火 → 灬 | 火 | host gains `is_hot_slow`: transforms over time, never ignites — 土→brick, wet→dry, (M2: cook) | 煮 蒸 热 照 |
| **enclose** | 口 → 囗 | 口 | host contained: cannot move/spread/act; effects trapped inside; strike the 囗 to release | 困 圈 国 园 |

Existing slots unchanged: left (氵 live via 沐, extends to 泪), beside (林炎明朋相休鸣), top-mark (末), bottom-mark (本, new).

### 2.1 The enclose gesture — ruling  `[R4-D031]`

Enclose was made deliberately unreachable in the D011 geometry (the D008 dead-zone fix). M1 needs it back without regressing. Ruling:

- A **center zone** (inner 33% box of the cell) resolves to `enclose` — **active only when the dragged matter has an enclosing form** (M1: 口 only). For all other matter, the center zone does not exist; geometry is byte-identical to D011's (top/bottom full-width bands, left/right middle split).
- The honest overlay (D023/D024 parity invariant) paints a live 囗 preview when hovering the center zone with 口 — the player sees the wrap before releasing. This is why the ruling is safe now and wasn't at D008: the zones are no longer invisible.
- 口 released on the **left zone** attaches beside (鸣-family). Both real orthographic positions of 口 are therefore playable, and the distinction is itself the lesson (口-left speaks, 囗-around contains).
- Same stateless resolver (`resolveHostAndZone`) — the enclosure-family check is a parameter of `cellLocalZone`'s zone map, not a second code path. No history, no special-casing beyond the component-form gate.

### 2.2 Transformative fizzles — ruling  `[folded into R4-D030]`

An unstable composition (e.g., 火-under-土 — not a character) still **fires its slot-rule reaction during its brief life**, then falls apart. Lasting world effects are legitimate fizzle outcomes: 火-under-土 bakes the 土 to brick-state, *then* the union collapses and the 火 drops free. This deepens §4.4's "never nothing, always interesting" — some fizzles are tools. No "wrong" is ever surfaced; the world just keeps what happened.

---

## 3. Stability registry — 10 core + 3 stretch  `[LEAN]`

| Composition | Char | Effect | Status |
|---|---|---|---|
| 木+木 beside | 林 | wide stand | live |
| 林+木 | 森 | dense, blocks passage, major fuel | live |
| 火+火 beside | 炎 | wide blaze, luminosity 2 | live |
| 氵+木 | 沐 | cleanses target | live |
| 上-mark on 木 | 末 | extends reach upward (grows one cell) | live |
| 日+月 beside | 明 | luminosity 3, wide radius | new |
| 下-mark on 木 | 本 | anchors host: immovable, vector-immune | new |
| 囗 enclosing 木 | 困 | contained tree: can't grow/burn/act until released | new |
| 口+鸟 beside | 鸣 | birdsong pulse: attracts/redirects 鸟, sound wave clears… nothing yet — pure sound toy | new |
| 人+木 (person left) | 休 | rest aura: pauses hazards in radius briefly | new |
| 氵+目 | 泪 | single precise water drop — surgical extinguish | stretch |
| 月+月 beside | 朋 | companion glyph follows avatar, grants +1 carry slot while following | stretch |
| 木+目 beside | 相 | inspect: reveals the component seams of a target compound (diegetic reading, no text) | stretch |

All 13 are real characters; all parts Tier A per bible §0.5. Stretch recipes ship only if the core 10 land without schedule pressure — cut silently, no log entry needed (they're `[LEAN]` rows in this spec, not charter promises).

---

## 4. Conservation pressure  `[LEAN — the other new M1 system]`

Law 2 gets teeth. M0's renewable source points become **finite charges**:

| Source | Charges | Notes |
|---|---|---|
| pond (水) | 4 | draining the pond visibly lowers it |
| hearth (火) | 3 | dims per draw, dead when spent |
| tree stand (木) | as-authored count | already finite in M0 |
| sky-slot (日/月) | 1 each | you can take the sun down. Once. |
| others (土口鸟人目上下) | authored per-instance | scattered matter, no regen |

Decompose remains the recycling loop: matter is never destroyed except by fire (ash) — burning is the room's only true sink. Tune counts in playtest; the design intent is *felt scarcity by minute 8, never a hard wall*.

**OPEN rulings this spec makes** (folded into R4-D030):

| id | Ruling |
|---|---|
| OPEN-3 | Decompose stays **free** in M1 (刀 out of set; entropy stays dead per Law 2). Revisit at M2 with 刀. |
| OPEN-6 | Deferred to M2 (心 not in the M1 set). |
| OPEN-7 | **Dissolved.** Stability is a property of the writing system, not player progress — a real character always locks, discovered or not; there is no unlock state to persist. Composed objects persist physically until decomposed or burned. |
| OPEN-8 | Single-cell compounds in M1. Multi-cell is a world-authoring (M2) concern. |

---

## 5. The M1 duration gate — bar derivation  `[LOCKED on adoption]`

D019 deferred the >10-min bar because it was derived for a 5-component room and tested on 4. Re-derivation, shown so the gate can't be waived-by-mismatch again:

- M0.1 measured ~5 min voluntary on 4 components / 5 recipes ≈ 9 discoverables.
- M1 fields 12 components / 10 recipes / 2 new slots / conservation ≈ 3× the pattern space (Koster: engagement scales with unexhausted pattern, sub-linearly).
- Bar: **>10 minutes voluntary**, comfortably inside a conservative 2× scaling. If 3× the material can't double the engagement, the loop does not scale and the track should not proceed to M2.

| Gate | criterion |
|---|---|
| G1 | >10 min voluntary play before stopping — router session, plus **≥1 naive human** (first §9.2 Illiterate Fun data point) |
| G2 | ≥15 distinct composition attempts across the session |
| G3 | ≥6 of the 10 core recipes discovered unprompted |
| G4 | Fizzle affect stays delight-side; ≥1 transformative fizzle (e.g. baking) found and *reused deliberately* |
| G5 | Zero menu-work verbatims; enclose gesture used successfully without instruction |

**PASS →** bible legacy-porting unlocks (D019's deferral resolves); M2 authoring begins.
**FAIL →** §8 step 4 in full: this track archives with post-mortem; v3 resumes via the bible D054 dormancy checklist. No partial credit, no second conditional.

---

## 6. Ten Questions pre-check (§9.1, run on this spec's additions)

| Q | Verdict |
|---|---|
| 1 calculus-expressible | YES — everything above is components+slots+tags+reactions; authored-exceptions list stays empty |
| 2 out-of-world composition | NO — enclose is a zone, not a panel |
| 3 icons | NO — 囗 preview is a glyph |
| 4 correct/incorrect surfaced | NO — transformative fizzles deepen the opposite |
| 5 slot warrants | YES — 灬: 煮蒸热; 囗: 困圈国 |
| 6 recipes pass §0.5 | YES — all 13 real, Tier A parts |
| 7 ≤3s | YES — bake-over-time starts visibly <1s (glow onset), completes ambiently |
| 8 Fun Gate | YES — each newcomer's Toy Test itemized in §1 |
| 9 DIES reintroduction | NO — 朋's +1 carry is a companion effect, not a UI hand |
| 10 summon | NO — sky-slot 日/月 are harvested (the sun is matter; that's the pitch) |

---

## 7. What could kill M1 (named risks)

| Risk | Watch |
|---|---|
| Enclose center-zone re-opens D008 | Mitigated: component-form gated + honest overlay. Self-test T-E series below is the tripwire |
| Conservation reads as punishment, not texture | G4/G5 verbatims; if scarcity frustrates, halve the sink (slower burn), don't add regen |
| 12 components dilute instead of deepen | G3 is the detector — <6 recipes found means the space stopped inviting |
| 鸟/人 living-matter tweens balloon scope | They are tweens, not systems. Any behavior needing a state machine is M2+ |

---

## 8. Code build handoff — M1 room

**File:** `m1-composition-room.html` (fork of the R4-D024 M0 build — carry all verified input work forward untouched: D016 adjacency, D017/D018 disambiguation, D023/D024 stateless resolver).

**Requirement #1 — BUILD_ID (R4-D026 as refined in R4-D030):** header comment + in-app corner text, format `R4-D030-YYYYMMDD-n`, bumped `n` on every delivered iteration. Router records sha256-8 alongside at routing time. No BUILD_ID → the deliverable is invalid before testing begins.

Build items, in order:
1. Component table → 12 per §1 (data-only where possible; 口 un-comments with its D007-fixed citation)
2. Luminosity magnitude table per §1; darkness levels 1–3 authored in-room
3. `under` slot: 灬-render on attach + `is_hot_slow` transform loop (土→brick visible bake ≈2s glow-then-harden)
4. `enclose` slot per §2.1: center-zone in `cellLocalZone`'s zone map, **gated on dragged-matter enclosing-form**; 囗 render; strike-to-release; overlay paints 囗 preview via the shared resolver — one code path, zero history
5. Transformative fizzles per §2.2: unstable unions fire slot reactions during life, drop components on collapse, world keeps the consequence
6. Stability registry → 10 core recipes (stretch 3 only if trivially cheap)
7. Finite sources per §4 with visible depletion states
8. Room re-author: pond, hearth, stand, sky-slot, dark corner (levels 1–3), scattered matter — one screen still

**Self-tests — all real dispatched pointer events (R4-D020 lock), all fingerprint-cited:**

| id | test |
|---|---|
| T-R1–R10 | each core recipe locks, **×4 approach directions** (now the permanent standard, per the D022 lesson) |
| T-E1 | 口 dragged to center zone of 木 → 囗 preview paints → release → 困 locks |
| T-E2 | 口 released on left zone of 鸟 → 鸣 (beside, not enclose) |
| T-E3 | 木 (non-enclosing) hovered dead-center → **no** enclose zone; resolves per D011 geometry, byte-identical |
| T-E4 | parity sweep across the center zone with 口 and with 木 — painted == resolved at every sample |
| T-U1 | 火-under-土 → glow onset <1s → brick-state → union collapses, 火 drops free |
| T-U2 | 火-under-木 → no slow path: `is_flammable` host ignites per reaction 1 (priority check) |
| T-C1 | hearth exhausts at 3 draws, visibly dead; pond at 4 |
| T-C2 | burning 木 yields ash-matter, not nothing (Law 2 sink is visible) |
| T-REG | full M0 regression: 林森炎沐末 ×4 directions, D016/D017/D018 checks, zero console errors |

**Then:** Design independent verify (fingerprint-matched, §9.0 preconditions) → router M1 gate session (§5, with one naive human) → gate verdict filed.

---

## 9. v1.1 amendments — from the M0 Part D human session (R4-D032/D033)

**A1 — Slot-seam affordance (new build item, extends item 4's overlay work):**
While a drag hovers any host, paint ALL zone seams on that cell faintly (hovered zone
highlighted as now; enclose center-box seam appears only for enclosure-family matter,
per §2.1). Geometry is shown; outcomes are NEVER shown — no hinting which zone locks.
Self-test T-A1: hover each of the 12 components over a 木 host; seams visible in every
case; no lock-prediction rendered anywhere.
Warrant: Part D F1 — router could not tell 上 belonged at the top until mid-drag guessing.

**B1 — No-inert-glyph room rule (R4-D033, amends charter §4.6):**
Every glyph placed in the M1 room must be matter — harvestable, composable, or
reactive. Inert glyph props are banned: a written thing that refuses to be matter
teaches that reading the world is unreliable (Law 1 violation; Detachability failure
at 1-tile scale). 石 is removed from the room (parked for M2 with 山/刀). Ash (灰)
residue from burning is affirmed CORRECT as-is: it is matter, accepts placement, and
is Law 2's visible sink.
Self-test T-B1: iterate every glyph in the seeded room; each must respond to at least
one of harvest / compose-host / reaction. Zero inert glyphs.

**C1 — Conservation note (no change):** Part D F2 (all 木 burned, renewable hearth,
monotone decay toward ash) is resolved by §4's finite hearth — first field evidence
for the felt-scarcity design. Watch G4 for whether ash-afterlife wants more than
ground-residue status; do not add a 灰 recipe in M1.
