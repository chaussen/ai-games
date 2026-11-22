# Hand-off

Newest entry first. Every session adds an entry. Rules: update the status table, list what changed, what is
verified, what is not, and the next step.

## Session 1 (2026-11-22): Phase 1A, the reaction engine

**State.** Phase 1A is built and green: `node sim-test.mjs` runs 83 checks (truth test per rule R1-R12 and R27,
wield/place/pour, ink and caps, home, the pair test over every material x card x body, soak with 1, 2 and 4 players
for 3 simulated minutes each, a fire-cap stress field, determinism and restore-continues-bit-for-bit). Design
decisions are in REACTIONS.md section 8.

**Verified by running:** all of the above, in node. **Not verified:** step time on a phone (node p95 is 0.26 ms
at 160x90), anything on a screen (there is no UI yet), co-op over a network (no server yet).

**Next.** 1B recogniser (this same session, see below), then 1C: server + docked pad + a flat arena page, phones
join over Wi-Fi.

## Session 0 (2026-11-22): the plan and the docs, no code

**State.** Phase 0 is written: README, CHARTER, REACTIONS, GLYPH-CARDS, MODIFIERS, VOCAB-TIERS, RECOGNISER, and
this file. `games/TONGZHOU.md` points here. No code, no tests, nothing played. The original planning notes
(research findings and the technical evaluation) are summarised below so a later model need not redo them.

**Verified by reading, not by running**: forge-2d reusable pieces and sizes as of commit 915d7d8: `sim.js` 1237
lines, `app.js` 1335, `ink.js` 775, `isles.js` 593, `cut.js` 481, `server.js` 245, `things.js` 167, `rules.js` 43,
`vendor/recogniser.js` 322; tests: sim-test 424 checks, write-test, smoke (3481), crew-test (3489),
write-isle-test (3487), screen-test (3482), play-test, lab autotest minds. Inkblade is the separate repo
`/home/zni/projects/inkblade` (not inside ai-games) with `src/07-fx.js` (droplet transit) and
`src/10-world-render.js`; its unbuilt "sandbox interaction web" is the thing REACTIONS.md designs.

**Technical verdicts** (full table in the planning session): recognising 100-200 characters offline is feasible
(risk: look-alikes, children's handwriting); characters-to-objects via data cards is feasible; a tag-based
reaction engine on a grid is feasible and cheap in 2D; modifiers as a derived-card grammar are feasible;
co-op/playful PvP on the forge-2d authoritative-server model is feasible (lag 70-100 ms unmeasured on real Wi-Fi);
phone performance must be measured early (Inkblade never did); open vocabulary and 3D are out of scope.

**Decisions from John** (all in CHARTER §2): new folder; 2D grid-like; curated tiers; co-op a must; playful PvP
on; simplicity first (no cut-paper, no droplet look yet); reaction engine and recogniser first; docked pad;
commit and push these docs.

**Next step (Phase 1).** Two independent spikes, can be given to two sessions:
- **1A** reaction engine: `sim.js` (grid + entities, deterministic, snapshot/restore), `reactions.js` (data
  table, rules R1-R12), `cards.json` for the five elements, tests per REACTIONS.md §7, `smoke-test.mjs` on port
  3500 (never 3000).
- **1B** recogniser at 100-150 characters: copy recogniser and `tools/strokes.mjs`, build the synthetic
  handwriting generator and confusion matrix (RECOGNISER.md §2), ask John for real samples.
Then 1C joins them with a crew of 1-4 phones and the docked pad. Before any code, per John's rule (plan before
code for new mechanics): the docs gate is this commit; open an issue-style note here if a design change is needed.

**Rules for the next model.**
- Copy from forge-2d, never import; never touch 学字坊 files or other games.
- Do not use port 3000 in tests. Test ports 3500+.
- Every number is a profiled knob (relaxed/standard/strict); no per-level hard-coded numbers.
- Pinyin and meaning beside every Chinese character shown.
- Do not build things John marked as waiting (e.g. forging a character together, forge-2d CO-OP.md §6).
- Verify UI on real device sizes with real touch; screenshots only from a running build.
- Work directly on `master`; commit and push (remote is `upstream`).

**Open items.** Name may change (working: Shenbi). Whether tiers unlock free or through the Almanac (Phase 2).
How the playful body effects feel (tune on phones). Whether to keep the plain flat look until Phase 7.
