# The Character Game — Integrated Design Spec

**Journey + Forge, fused into one classroom learning game.**
Casey Chinese School · Character Studio · Design spec v1.0 · 2026‑06‑17

Companion file: **`Character Game - Wireframes.html`** (lo‑fi UI + flow set — read it alongside this).
Source systems this builds on: `Learning Journey - Scroll.html` / `journey/scroll.js` (the scroll, XP,
科举 ranks, 印 seals, ink‑fade review) and `The Forge - Handoff SRS.md` (the stroke→atom→composite DAG,
three forge grains, books‑as‑playlists).

---

## 0. How to read this

1. **§1 The two-currency model** — the one decision everything hangs on.
2. **§2 The hierarchy** — how units/lessons/levelling/seals fit together for *any* book (中文 *and* Band 1).
3. **§3 The character scaffold** — parts‑before‑wholes, vocab vs. parts deck (the critical join most tools miss).
4. **§4 Workflow & navigation** — every screen and how you move between them.
5. **§5 Screen specs** — what each screen contains.
6. **§6 Backend scoring** — exact formulas, floors, caps, anti‑farm, defaults.
7. **§7 Milestones & ceremonies** — when the game celebrates.
8. **§8 The 文 store & teacher console.**
9. **§9 Data model.** §10 **文 coin brief.** §11 **Worked example.** §12 **Open decisions.**

---

## 1. The two-currency model (the spine)

One number cannot be both a *score* and a *wallet* without one job poisoning the other. So we split it.
The two never convert into each other.

| | **经验 XP → 科举 rank** | **文 (wén) — award token** |
|---|---|---|
| Measures | **Achievement / status** | **Effort / diligence** |
| Earned by | performance — stars, mastery, speed, combo | showing up, completing, improving, consistency |
| Spendable? | **No** — it is prestige; it only ever goes up and drives rank | **Yes** — the only thing the award store accepts |
| Felt as | "I'm becoming a 状元" (long arc) | "I can get a sticker this week" (short arc) |
| Fairness role | rewards the strong without blocking the rest | gives every willing student a reachable path |
| Resets / decays? | never | never (only character *ink* fades — a nudge, not a penalty) |

**Why this is the whole answer to "how do we set fair award standards":**
talent earns *rank*; effort earns *awards*. A struggling-but-willing student and a top student both bank 文
for doing the work — the top student simply also climbs rank faster. Nobody watches the awards go only to
the fast kids, and rank stays meaningful because it can't be bought.

> 文 is both an ancient unit of coin **and** the word for "writing / a character" — the pun is the brand.
> Visual: an ancient round cash‑coin with a square hole. See §10.

---

## 2. The hierarchy — one structure, every book

Different books group lessons differently (中文 = **3 lessons per unit**; Band 1 = **flat units, no grouping**).
We absorb that with **one flexible 5‑level tree**, where the *Chapter* is the configurable joint between
**content** and the **reward / levelling system**.

```
SERIES                         e.g. 中文 · or Casey Bands
  └─ BOOK                       the progress key (中文第一册 · Band 1)        ── the scroll's full length
       └─ CHAPTER (卷)          earns a 印 SEAL + triggers a RANK check       ── a season panel on the scroll
            └─ STAGE            one teaching session = one FORGE run          ── a node cluster on the path
                 └─ CHECKPOINT  the micro‑nodes inside a stage (§3)           ── the small seals on the path
                      └─ CHARACTER / PART
```

### 2.1 The Chapter is "a list of stages + a seal" — nothing more
A chapter is defined **per book** as: *which stages, in what order, sealed by which 印, themed which season.*
That single indirection lets every book keep its own native grouping while sharing one reward cadence:

| Book | Native grouping | Chapter = | Stages per chapter |
|---|---|---|---|
| **中文 Book 1** | 3 lessons → 1 unit | **the 3‑lesson unit** | 3 (matches today's seasons) |
| **Band 1 (Casey)** | flat units, no grouping | **teacher‑defined cluster** (e.g. 2 units, or 1 unit) | configurable |

**The reward cadence is decoupled from "how many lessons in a unit":**
- **Per stage** (every session): stars + 文 (completion) + XP (by stars). The everyday loop.
- **Per chapter** (a milestone): 印 seal + a 文 bonus + the XP that usually triggers a **rank‑up ceremony**.

So 科举 rank‑ups land naturally at chapter boundaries — a clean ceremony rhythm — whether a chapter is
three 中文 lessons or one Band unit. **This is the integration of units + levelling + awards: the chapter
absorbs the structural difference so the scoring engine never has to care.**

### 2.2 What maps to what on the scroll
- **Book** → the whole handscroll.
- **Chapter (卷)** → a seasonal scene panel + the 关/印 **gate** at its end (already built).
- **Stage** → a teaching session's node, which expands into its checkpoints (§3) when opened.
- **Checkpoint** → the small path seals: Parts → Wholes → Use.

---

## 3. The character scaffold — parts before wholes (the critical join)

The textbook is ordered **thematically**; the writing system is built **structurally** (a composite needs
its parts first — the DAG). They optimise different things and *will* collide. We resolve it at **two
different scales** so neither overrides the other.

### 3.1 Macro = textbook order, **locked**
Chapters and stages follow the book exactly. A weekend class teaches Unit *n* this Saturday; homework and the
print book must match. The game is the **practice layer for what was taught**, never a competing
curriculum — so we never globally re‑sequence stages.

### 3.2 Micro = structural, **inside each stage** — the 3‑band arc
Opening a stage, the engine decomposes its target characters and lays the checkpoints out as a forging arc:

```
 ┌── BAND 1 · 部件 PARTS ──┐   ┌── BAND 2 · 合字 WHOLES ──┐   ┌── BAND 3 · 应用 USE ──┐
 radicals / sound‑parts /     the stage's actual target      the communicative payload
 simple pictographs the        characters — now forgeable     (词语 word · 句子 sentence ·
 targets are built from        because their parts are owned   theme) the textbook cares about
 (stroke‑forge)                (component / radical‑forge)     (capstone checkpoint)
```

- **Parts band** comes first even though parts may not be "vocabulary." Owned parts show as quick **review**;
  new ones as **just‑in‑time atoms**.
- **Wholes band** is the stage's syllabus characters, forged once their parts are owned.
- **Use band** is the theme — the *why* the textbook chose these characters.

**The unit supplies the *what* + the *why*; the graph supplies the *order within*.** That is the merge.

### 3.3 Three rules for cross-stage dependencies
A part a stage needs may be owned already, taught later, or be no vocabulary word at all:

| The needed part is… | Treatment |
|---|---|
| **Already owned** (earlier stage) | a **review checkpoint** — reinforce via faded‑ink recall, don't re‑teach |
| **A real character taught later** | introduce now as a **preview atom**; when its own stage arrives, that stage treats it as **review + deepening** (add story/word/sentence/production). Early = recognition, later = depth — good spaced exposure |
| **Not a vocabulary word** (bound radical 氵, obscure phonetic) | a **building‑block atom** with a one‑line gloss: "a part you'll use, not a word to master" |

### 3.4 The split that keeps both systems honest (the bit most tools miss)
Count **two separate inventories**:

- **Vocabulary characters** — textbook‑defined. This is the mastery ring, the book's official count, what a
  parent/teacher recognises. Only the *Wholes* (and any target that is itself an atom) count here.
- **Building‑block components** — the **Parts Deck**: a growing collection of owned components, shared
  across the *entire* scroll. It is the collection meta‑game **and** the gating mechanism (own the parts →
  unlock the wholes) **and** the decoy source for the Forge.

Parts collect underneath without inflating the textbook's character count; wholes stay tied to the syllabus.
A part forged in Chapter 3 is owned everywhere — later stages needing it show review, not "new."

---

## 4. Workflow & page navigation

### 4.1 Screen map
```
              ┌─────────────┐
              │  LOCK / code │  (class code, e.g. 2580 — existing Studio gate)
              └──────┬──────┘
                     ▼
        ┌──────────────────────────┐   ◀── home base; everything returns here
        │   THE SCROLL  (Journey)   │
        │  header: rank · XP · 文 ·  │
        │  seals · streak | minimap │
        └─┬───────┬────────┬───────┬┘
          │       │        │       │
   tap a  │  tap  │  tap   │  tap  │ tap header chips
   stage  │ 文    │ deck   │review │
          ▼ wallet▼        ▼       ▼
 ┌───────────────┐ ┌──────┐ ┌──────┐ ┌──────────┐
 │  STAGE SHEET   │ │ 文   │ │PARTS │ │ REVIEW   │
 │ 3‑band preview │ │STORE │ │ DECK │ │ HUB      │
 └───────┬───────┘ └──┬───┘ └──────┘ │(faded ink)│
         │ begin       │ redeem       └────┬─────┘
         ▼             ▼                   │ practise
 ┌───────────────┐  ┌──────────┐           ▼ (a Forge run of due chars)
 │   FORGE RUN    │  │ REDEEM   │     ┌───────────┐
 │ PREVIEW→FORGE  │  │ overlay  │     │ FORGE RUN │
 │ →REVEAL ×N     │  └──────────┘     └───────────┘
 └───────┬───────┘
         ▼
 ┌───────────────┐  all roads up to a ceremony then back to THE SCROLL:
 │ STAGE CLEAR    │ ─▶ (if chapter done) CHAPTER SEAL ─▶ (if threshold) RANK‑UP
 │ stars +文 +XP  │
 └───────────────┘

 TEACHER CONSOLE  — separate gated entry (teacher code): scoring config · grant 文/awards · roster
```

### 4.2 The core loop (student, one session)
1. Land on **The Scroll** at "you are here."
2. Tap the current **stage** → **Stage Sheet** shows the 3‑band arc + the rewards on offer.
3. **Begin** → **Forge Run**: parts → wholes → use, each round PREVIEW→FORGE→REVEAL.
4. **Stage Clear**: stars, **文 coins fly to the wallet**, XP fills the bar, characters "ink" onto the scroll.
5. If it completes a chapter → **Seal** ceremony → often a **Rank‑up**.
6. Spend 文 in the **Store** whenever; review faded ink from the **Review Hub** when prompted.

### 4.3 Persistence & context (classroom reality)
- Everything is **per book** (progress key) and survives refresh/quit (localStorage; server later).
- **Home practice == class practice** — identical 文/XP; the platform doesn't care where.
- **Absence is forgiving**: no token/XP decay; returning + clearing due reviews grants a small *welcome‑back*
  bonus. Catch‑up is a win, not a chore.

---

## 5. Screen specs

### 5.1 The Scroll (home) — *exists, extend*
- **Header** gains a **文 wallet chip** beside XP/rank, plus the existing seals + streak.
- Header chips are **navigation**: tap 文 → Store; tap mastery ring → Parts Deck; a **复习 badge** → Review Hub.
- Scroll body: each stage node opens to show its **checkpoint band** (Parts/Wholes/Use) as small seals on the
  path (see §3.2); chapter gates and season panels unchanged.

### 5.2 Stage Sheet — *exists, restructure to 3 bands*
- Header: chapter · stage no. · theme (中文 / English).
- **Band rail**: Parts (review + new atoms) · Wholes (target chars) · Use (word/sentence). Owned/new/locked
  states per checkpoint.
- Reward strip: "+10 文 on completion · up to ★★★ · +XP." Locked stages explain the gate.
- CTA: **Begin** (current) / **Refresh ink** (due) / **Practise again** (done).

### 5.3 Forge Run — *exists in The Forge; wire in*
- Three grains: **stroke** (order on the tianzige), **component 会意** (meaning parts combine),
  **radical 形声** (meaning slot + sound slot). Round lifecycle **PREVIEW → FORGE → REVEAL** with
  progressive hints (per Forge SRS §4). Heat / combo / cracks / stars preserved.
- Run = the stage's checkpoints in 3‑band order; parts forged here enter the **Parts Deck**.

### 5.4 文 Store — *new* (§8.1)
### 5.5 Parts Deck — *new*: the owned‑components collection; tap a part to see what it builds.
### 5.6 Review Hub — *new*: faded‑ink characters grouped by due‑ness; "refresh" launches a Forge run.
### 5.7 Ceremonies — *exist*: Stage Clear, Chapter Seal, Rank‑up (§7).
### 5.8 Teacher Console — *new* (§8.2).

---

## 6. Backend scoring system

> All numbers are **tunable defaults** for a ~2–3 h/week + homework community school. Teacher‑configurable (§8.2).

### 6.1 文 (the wallet) — sources, floor, cap, anti‑farm

| Source | 文 | Rule |
|---|---:|---|
| **Complete a stage** (first clear) | **+10** | flat — ★ and ★★★ pay the **same** 文 (stars feed XP, not the wallet) |
| **Chapter seal** (all stages cleared) | **+40** | milestone bonus |
| **Due review cleared** (ink faded) | **+8** | the SRS schedule decides what's due |
| **Non‑due re‑practice** | **+1** | token‑starved on purpose |
| **Weekly attendance floor** | **+20** | guaranteed for showing up + ≥1 task; **home counts** |
| **Streak** | **+5 / session** | soft‑capped (≈ +25/wk) |
| **Bonus quest** (拓展 take‑home / help a peer) | **+5–15** | optional, teacher‑awardable |
| **Welcome‑back** (clear dues after absence) | **+10** | turns catch‑up into a win |

- **Floor** = the +20 attendance grant: the absent / struggling always bank a baseline.
- **Cap** = **~80 文/week from practice**; beyond it, extra work still earns **XP & mastery**, just not more
  wallet — so a grinder can't lap the class and the store economy stays stable.
- **Anti‑farm valve** = re‑clearing an already‑cleared stage pays **+1**; only **due** reviews pay **+8**, and
  *the schedule, not the student, decides due‑ness.* Legitimate repetition is rewarded; grinding isn't.
  → directly answers "students who retry lower levels again and again."

### 6.2 XP → 科举 rank (the status track) — *exists*
- Stage clear: **+10 XP / character**, plus **stars**: ★ +0 · ★★ +5 · ★★★ +15 (speed/combo add small amounts).
- Chapter seal: **+100 XP** (this is what usually tips a rank‑up at a chapter boundary).
- Rank ladder unchanged: 学童 → 蒙生 → 书生 → 秀才 → 举人 → 贡士 → 进士 → 状元 (thresholds in `scroll.js`).
- XP **never spent, never decays.**

### 6.3 Mastery & spaced review (the ink‑fade loop) — *exists, formalise*
- Per character **0–3 mastery**. A clear sets it high; it **decays on a schedule** → ink fades → the char is
  **due**. Due chars resurface as **review checkpoints**.
- Clearing a due char pays **+8 文**, restores mastery, re‑inks the scroll.
- Suggested decay: review at ~1d / 3d / 7d / 21d gaps (Leitner‑style), per character, adjustable.

### 6.4 Owned parts (the deck / gate)
- A component forged at the **stroke grain** becomes **owned** (boolean), shared across the whole book/scroll.
- **Gating:** a composite checkpoint is forgeable only when **all its parts are owned** (auto‑inserts a
  just‑in‑time atom if a needed part is missing — §3.3).
- Parts are counted in the **Deck**, *not* in the vocabulary mastery ring (§3.4).

### 6.5 Fairness summary (maps each worry → the lever)
| Worry | Lever |
|---|---|
| Some students aren't strong | 文 pays **completion**, not stars → awards reachable regardless of skill |
| Some aren't willing | low **everyday award tier** + **self‑improvement** earning (beat your own best) |
| Some are absent / work at home | **no decay**, home == class, attendance **floor**, **welcome‑back** bonus |
| Some retry lower levels repeatedly | re‑practice **+1**; only **due** reviews pay → schedule‑gated, un‑farmable |
| Keep the top students engaged | **XP / 科举 rank** + prestige awards reward genuine achievement |

---

## 7. Milestones & ceremonies (when the game celebrates)

| # | Milestone | Trigger | Feedback |
|---|---|---|---|
| 1 | **Part forged** | a stroke‑grain checkpoint cleared | micro‑toast + card flips into the **Parts Deck** |
| 2 | **Character forged** | a whole cleared | toast + the char "inks" onto the scroll |
| 3 | **Stage clear** | all checkpoints in a stage done | reveal overlay: stars · **文 coins fly to wallet** · XP bar fills |
| 4 | **Chapter seal (印)** | all stages in a chapter cleared | seal‑stamp ceremony · **+40 文** · scroll unrolls the next season *(exists)* |
| 5 | **Rank‑up (科举)** | XP crosses a rank threshold (usually at a seal) | 升级 ceremony + confetti *(exists)* |
| 6 | **Streak / attendance** | session logged | small banner + streak dots advance |
| 7 | **Award redeemed** | spend 文 in store | coins leave wallet → a claim ticket for the teacher |

Ceremony rhythm: small/continuous (1–3) keep the session lively; chapter/rank (4–5) punctuate; the store (7)
is the tangible payoff students chase.

---

## 8. The 文 store & teacher console

### 8.1 文 Store — two tiers, two ladders
Awards are usually **stationery, but not limited to — anything the teacher chooses to give.** So the store is a
**teacher‑editable catalogue**, not a fixed list. Items carry a price in 文 and a tier.

| Tier | Bought with | Examples (teacher‑set) | Pricing intent |
|---|---|---|---|
| **Everyday** | **文** | sticker, ink stamp, eraser, pencil, "choose the song", line‑leader | ~**30 文** — reachable in **week 1** by anyone diligent |
| **Treasure** | **文** | nicer stationery, small toy, certificate, bookmark set | ~**150 文** — ~2 weeks' diligence, faster with bonus quests |
| **Prestige** | **rank, not 文** | rank ceremony, 状元 honour board, badge | **earned**, never bought → keeps achievement meaningful |

Redemption flow: pick item → confirm (coins animate out of the wallet) → a **claim ticket** appears for the
teacher to honour in class (and to mark fulfilled in the console). The student's 文 is held/decremented at
redemption.

### 8.2 Teacher Console (gated by a teacher code)
- **Scoring config**: every default in §6 is a dial — completion 文, attendance floor, weekly cap, streak,
  due‑review payout, decay gaps, XP weights. Sensible presets ("standard / generous / strict").
- **Catalogue editor**: add/edit/retire store items, set price + tier + stock; (optional) upload an item image.
- **Grant**: hand out 文 or a bonus‑quest reward to a student/group (covers home + offline work the app can't see).
- **Roster**: per‑student rank, XP, 文 balance, streak, due‑review count, redeemed/pending claims; mark claims fulfilled.
- **Class sync note**: set which **chapter/stage** the class is on, so "current" matches the lesson taught.

---

## 9. Data model (additions; reuse Forge §6 graph & Studio CHAR_INDEX)

```jsonc
// books/<bookId>.json  — the playlist + chapter binding (the §2 joint)
{
  "id": "zw-b1",
  "series": "中文",
  "title": "中文 · 第一册",
  "chapters": [
    { "id":"c1", "vol":"卷一", "season":"春", "seal":"春印",
      "stages": ["L1","L2","L3"] },          // ← 中文: 3 lessons. Band 1 would list its own stage ids.
    { "id":"c2", "vol":"卷二", "season":"夏", "seal":"夏印", "stages":["L4","L5","L6"] }
    // …
  ]
}

// stages/<stageId>.json — resolves to the 3‑band checkpoint arc
{
  "id":"L8", "title":"家人 · My family", "theme":"family",
  "targets": ["的","有","爸","妈","哥","姐","妹","和","爱"],   // vocabulary characters (counted)
  // bands are COMPUTED from the character graph (§3.2), not hand‑authored:
  // parts ← decompose(targets) − owned   |   wholes ← targets   |   use ← word/sentence(theme)
}

// localStorage: ccs-game-v1
{
  "book": "zw-b1",
  "xp": 245, "rank": 3,
  "wen": 64,                                 // ← the wallet
  "wenWeek": { "iso":"2026-W25", "fromPractice": 38 },   // cap tracking
  "streak": 5, "lastSession": "2026-06-14",
  "stars":   { "L1":3, "L2":3, "L3":2 },     // per stage
  "mastery": { "妈":3, "好":2, "马":3 },       // per character 0..3 (decays)
  "due":     ["L2"],                          // SRS surfaced
  "owned":   ["女","马","子","日","月","口"],   // Parts Deck (gating + collection)
  "seals":   ["春印"],
  "claims":  [ { "item":"sticker", "wen":30, "status":"pending", "ts":"…" } ]
}

// store/<bookId>.json — teacher‑editable catalogue
{ "items":[
  { "id":"sticker", "name":"Sticker", "tier":"everyday", "price":30, "img":null, "stock":null },
  { "id":"cert",    "name":"Certificate", "tier":"treasure", "price":150 }
]}
```

---

## 10. The 文 coin — visual brief

A **round cash‑coin with a square central hole** (天圆地方 — round heaven, square earth), the form of pre‑modern
Chinese money. It reads instantly as "currency" and the central character is **文**.

- **Form:** circle, ~1:1; square hole centred (~28–32% of width); the glyph **文** sits **above** the hole
  (real coins place legends around the hole — keep it legible at 20 px in the header chip).
- **Material:** warm metal — bronze/gold rim (`--gold #E0A23A`) with a slightly darker face; a thin inner ring
  bevel. On the dark header, a soft glow; in the store, a fuller coin with subtle shine.
- **States:** flat outline (locked/placeholder) · solid metal (owned) · a small **stack** glyph for the wallet total.
- **Motion:** on a stage clear, coins **fly from the reveal into the wallet chip** and the count ticks up.
- **Build:** pure geometry (circle + square hole + glyph) — no illustration needed; an SVG with two `<circle>`/
  `<rect>` and the 文 glyph. A seal‑script 文 is a nice upgrade later. *(A working mock sits in the wireframe.)*

---

## 11. Worked example — 中文 Chapter "家人 My family" (Lesson 8)

Lesson 8 (`的有爸妈哥姐妹和爱`) is *already* a phonetic‑series cluster around 女 — which the thematic book leaves
implicit. The 3‑band arc makes the pattern teachable:

**BAND 1 · Parts** (stroke‑forge / review)
- `女` woman — **review** (owned from L4 子女); the semantic anchor of 妈姐妹好.
- `马 mǎ` — sound of **妈** · `且 qiě` — sound of **姐** · `未 wèi` — sound of **妹** · `子` — in **好** ·
  `可 kě` — sound of **哥**. Several are **building‑block atoms** (sound‑parts, not unit vocabulary) → glossed,
  enter the **Parts Deck**, not the vocab count. `马` is itself taught later as vocabulary → **preview atom**.

**BAND 2 · Wholes** (radical / component forge — parts now owned)
- `妈 = 女 + 马` · `姐 = 女 + 且` · `妹 = 女 + 未` · `好 = 女 + 子` · `哥 = 可 + 可`.
- Forged back‑to‑back, the student *sees it*: **女 + a sound = a family‑woman word.** The writing system's logic
  becomes visible — the payoff of structural‑within‑thematic.

**BAND 3 · Use** (the textbook theme)
- 词语 爸爸 / 妈妈 / 哥哥 · 句子 我爱我的家 — production, the *why* of the unit.

**Rewards for the stage:** +10 文 on completion (any stars) · XP by stars · the 5 wholes ink onto the scroll ·
the 6 parts join the Deck. Completing all three lessons of 卷三 → **秋印** seal + 40 文 + likely **rank‑up**.

---

## 12. Open decisions to confirm
1. **文 coin art** — geometry mock in the wireframe; want a seal‑script 文 / a custom illustration later?
2. **Store catalogue** — seed list + prices per tier (the §8.1 numbers are placeholders).
3. **Scoring presets** — ship "standard / generous / strict"? confirm the §6 defaults for "standard."
4. **Chapter definition for Band 1** — 1 unit = 1 chapter, or cluster units? (中文 is settled: 3 lessons = 1 chapter.)
5. **Teacher console scope for v1** — full roster + catalogue editor, or config + grant only to start?
6. **Decay schedule** — confirm the 1/3/7/21‑day spaced‑review gaps.

*End v1.0 — pair with `Character Game - Wireframes.html`.*
