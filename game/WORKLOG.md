# Worklog — 学字坊 / The Character Game

Running log of changes made outside the original handoff build. Newest first.

---

## 2026-06-17 — Teacher console completion + B2–B4 forge wiring

**Status: implemented, tested & committed** on branch `master`.
Touched: `game/state.js · game/screens.js · game/styles.css · game/data.js · game/README.md`.
Same session also purged the superseded root prototypes + `journey/` (live app is `index.html` →
`game/` + `assets/`; old prototypes remain in git history and under `claude-code-handoff/`).

### 1. Teacher console — completed to spec §8.2
- **Scoring** tab: all §6 dials now present (added non-due, streak, welcome-back, ★★/★★★ XP)
  plus a **spaced-review decay** editor (the 1/3/7/21-day Leitner steps).
- **Catalogue** tab: was read-only → now a **full editor** (inline edit name/tier/price/rank-min,
  retire, and an *Add award* form). Catalogue is persisted in state (`store.catalogue`) and read by
  the student Store; a migration backfills it for older saves.
- **Grant** tab: added **⭑ Whole class** target and 拓展 bonus-quest quick-amounts (+5/+10/+15).
- **Roster** tab: added a **Pending claims** panel with **Mark fulfilled** per claim.
- **Class sync** tab: **new** — set the current stage (grouped by chapter/卷); moves "you are here"
  without disturbing cleared stages.
- Persisted additions: `catalogue`, `current` (class-sync). State API gained `catalogueAdd/Update/Retire`,
  `setDecay`, `setCurrent`, `pendingClaims`, and whole-class `grant('all', …)`.

### 2. B2–B4 fully wired into the forge
Graph (`characters.json`) and `stroke-data.json` already covered every B1–B4 write-char and its
scaffold atoms (audited: 0 missing). The only gap was the **Use band**, where each book stores its
content differently. Fixed in `data.js`:
- `useBand` strips inline `(pinyin)` from `组词` words (B2/B3 format) → clean, selectable tiles.
- `useBand` accepts `造句` as the example sentence (B4 uses it instead of `句子`).
- A sentence becomes a build-round only at **2–10 Han chars** (longer B4 sentences stay word-only —
  tapping 14–18 chars against the heat timer is a slog).
- `buildUseRound` builds tiles from **Han characters only** → punctuation (。，) is never tappable.

**Verified (Node harness over the real data):** 470/470 Parts+Wholes rounds and every Use round build
with no errors across all 32 units; no non-Han tiles in any Use round.

### Follow-ups left open
- **Content gap (not wiring):** `content-b2.json` ships empty `en` on `组词`, so most B2 word rounds
  cue from pinyin instead of English. Author the B2 glosses to light them up — no code change needed.
- **Backend / multi-student tracking — deferred phase.** The teacher console is feature-complete but
  runs on local + simulated data: roster peers are fake and grants to them are in-memory only. A real
  backend (multi-student accounts/auth, server persistence, cross-device sync so "home == class" truly
  holds, a live roster) is named in the design spec (§4.3 "server later") but never specced. It would
  need its own data-model/API design before build. Open decision §12 #5 (console scope) still pending.
