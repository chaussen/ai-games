# The Character Game — Claude Code handoff

Build target: **one classroom learning game** that fuses the handscroll **Journey** (levelling,
ranks, seals, spaced review) with the **Forge** (the in-stage character-building game), driven by a
generated character-decomposition graph.

## Read in this order

### `01-brief/` — what to build
1. **Character Game - Design Spec.md** — the primary spec. Hierarchy, two-currency scoring, the
   parts-before-wholes scaffold, navigation, milestones, store, teacher console, data model, worked example.
2. **Character Game - Wireframes.html** — open in a browser. Lo-fi UI + flow for every screen and system.
3. **The Forge - Handoff SRS.md** — the gameplay engine spec (three forge grains, PREVIEW→FORGE→REVEAL,
   the DAG, systematic decoys, the `characters.json` pipeline). The spec in §1 builds on this.
4. **CLAUDE.md** — project-wide rules (pinyin/ruby invariants, fonts, colours, print). Follow them.

### `02-systems/` — the two existing prototypes being fused (source of truth for look + behavior)
- **Learning Journey - Scroll.html** + `journey/scroll.js` — the scroll, XP, 科举 ranks, 印 seals,
  ink-fade review, minimap. The integration host.
- **The Forge (game).html** + `journey/forge-game.js` — the in-stage game; `journey/forge-stroke-data.js`
  is its demo stroke data.
- `journey/tweaks-panel.jsx` — the tweaks panel scaffold both use.

### `03-shared-data/` — reuse verbatim; do NOT reinvent
- **stroke-cell.js** — the locked, canonical stroke-order SVG renderer. Use it for all stroke drawing.
- **stroke-data.json** — makemeahanzi stroke paths + medians (subset; regenerate for full scope).
- **character-library.json** — W/R/S character status per band (a character-sourcing input).

### `04-context/` — only if the game pulls Studio content
- **Character Studio - HANDOFF.md** — the Learn/Exercises app; explains `CHAR_INDEX`, radicals,
  enrichment, and the audio (file→TTS) hook the game can borrow.

## Important: what does NOT exist yet (greenfield — build it first)

- **`characters.json`** (the decomposition/forging graph) and **`components.json`** (the parts deck) —
  specified in *The Forge - Handoff SRS* §5–§6 but **not yet generated**. The build pipeline that
  produces them (makemeahanzi dictionary + IDS + frequency) is **task #1**. Everything downstream
  (parts-before-wholes scaffolding, decoys, scheduling) depends on it.
- **Store catalogue, teacher console, 文 wallet, Parts Deck, Review Hub** — designed in the spec/wireframes,
  not yet coded.

## Build order suggestion

1. Data pipeline → `characters.json` + `components.json` (HSK 1–2 / 中文 Book 1 first).
2. Refactor the Forge to consume resolved round objects from the graph (no hard-coded rounds).
3. Wire the Forge as the stage-opener inside the Journey; implement the 3-band checkpoint arc.
4. Implement the two-currency scoring (文 wallet + XP/rank) per spec §6, with the SRS anti-farm valve.
5. Add Store, Parts Deck, Review Hub, then the Teacher Console.

## Open decisions (spec §12) — confirm with the product owner before locking economy numbers
Store items + prices · scoring preset values · Band 1 chapter grouping · teacher-console v1 scope ·
decay schedule (1/3/7/21 d) · 文 coin art (geometry mock provided).

> Paths inside the copied HTML files (e.g. `journey/scroll.js`, `assets/...`) reflect the original repo
> layout, preserved here under `02-systems/` and `03-shared-data/`. Restructure as needed for the new app.
