# 学字坊 · The Character Game — integrated build

Fuses the **Journey** handscroll and the **Forge** into one classroom learning game,
driven by the generated character-decomposition graph. Entry point: **`../The Character Game.html`**.

## Run it
`fetch()` needs a server (file:// is blocked):
```bash
cd ..                       # repo root
python3 -m http.server 8000
# open http://localhost:8000/The%20Character%20Game.html
```
Class code **2580** (student) · **1357** (teacher → opens the console).

## Architecture (vanilla JS, one `window.GAME` namespace)
```
assets/data/characters.json ─┐
assets/data/components.json ─┼─▶ data.js     ContentService + Scheduler
assets/data/stroke-data.json─┘               · resolveStage() → 3-band arc (Parts→Wholes→Use)
assets/data/playlists/*.json─┘               · buildRound()  → resolved forge round + graph decoys
                                  state.js    persistence (ccs-game-v1), the two-currency engine
                                              (文 wallet w/ weekly cap + anti-farm; XP→科举 rank),
                                              SRS ink-fade schedule, Parts Deck, seals, claims,
                                              teacher dials, simulated roster
   forge.js   the Forge Run engine — one loop everywhere: PREVIEW (see it) → FORGE (it's gone,
              rebuild it on a BLANK grid) → REVEAL. Stroke atoms: tap strokes, with shape-based
              order leniency (shape-matched strokes interchangeable across the whole glyph;
              the grid always fills in canonical writing order) + chunking for big atoms
              (pictographs are never chunked). Component/radical: recall the structure first
              (⿰/⿱/⿴…), then drag parts onto the revealed zones. Use: build the word on a
              growing line, count hidden. heat·combo·cracks·stars;
              progressive hint ladder (§4.1–§4.2, §8)
   scroll.js  the Scroll home + the 3-band Stage Sheet; header = rank/XP + 文 wallet + deck ring
              + 复习 badge + seals + streak
   screens.js 文 Store · Parts Deck · Review Hub · Teacher Console (slide-up panels)
   app.js     orchestrator/router: lock gate, stage runs, §6 scoring application, and the
              Stage Clear / Chapter Seal / Rank-up ceremonies (with 文 coin-fly)
```

## What maps to the spec
- **Two currencies** (§1, §6): completion pays flat **文** (capped ~80/wk, re-clears pay +1,
  only schedule-due reviews pay full → anti-farm); stars/mastery feed **XP→rank**, never spent.
- **One book, chapters as the joint** (§2): all four bands' flat units (B1–B4, 32 units) clustered
  2-per-chapter into seasonal 卷 so seals + rank ceremonies land on chapter boundaries. B1's four
  chapters are hand-named; the rest are generated from the playlist (`state.js` `getChapters`), so
  adding lessons needs only content + a rebuild — chapters/seals/ranks absorb them automatically.
- **Parts-before-wholes** (§3): each stage's wholes are decomposed *pedagogically* — grain is
  driven by etymology (pictographs like 口 目 米 水 stroke-forge; 会意 build by meaning; 形声 build
  by meaning+sound), not raw IDS. The Parts band is a recursive scaffold (deepest stroke atoms →
  assembled intermediates); a hard part with no clean named split is forged as chunked stroke
  steps. Cue generosity follows a level = chapter baseline + teacher dial; english→character is
  only ever its own Use exercise, never mixed into the structure forge.
- **Graph-driven decoys** (§5.5): meaning-slot decoys from `hints.visuallySimilar` /
  `semanticallyAdjacent` + component siblings; sound-slot decoys from the phonetic pool
  (different syllable; tone-variants at hard/expert).
- **Screens** (§5, §8): Store (tiers + claim tickets), Parts Deck, Review Hub, Teacher Console
  (presets + dials + grant + roster).

## Tuning / data
Scoring defaults live in `state.js` (`PRESETS` standard/generous/strict) and are teacher-editable
at runtime. To regenerate the graph, see `../build-pipeline/build-characters.js`.

## Known gaps (v1)
- Use-band English glosses are shown only when the source `组词` gloss lines up 1:1 with its words
  (`data.js` `useBand`); when it doesn't, the round falls back to a pinyin cue rather than risk a
  mislabel. B1's glosses are curated; B2–B4 `组词` pairings have not all been audited.
- Catalogue editor is read-only in the teacher console; roster peers are simulated (no backend).
