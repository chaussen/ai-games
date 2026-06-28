# Hanzi Sandbox — Claude Code Handoff v1

**Read this entire document before writing a single line of code.**
**Do not invent mechanics. Do not add content. Implement contracts verbatim.**

---

## What you are building

A browser-based puzzle game in Phaser.js v3 (CDN).
A spirit moves through terrain. The player deploys Chinese characters as forces.
Characters do what they mean. The world responds. The spirit reaches the goal.

**This handoff covers: vertical slice — L1-P01, L1-P02, L1-P03 only.**
Exit condition: all three puzzles playable end-to-end. MetaScene gates correctly.

---

## Tech constraints

- Single HTML file output (`game.html`)
- Phaser.js v3 via CDN — no npm, no bundler
- All game content in separate data files (never hardcoded in engine):
  - `data/characters.js` — character registry
  - `data/puzzles.js` — puzzle definitions
- No backend. No SQLite. No app store. localStorage only for completion flags.
- Must run on desktop and touch (pointer events, not separate mouse/touch handlers)

---

## Two scenes — implement both

### MetaScene
- Displays a grid of puzzle tiles (one per puzzle)
- Each tile shows: puzzle id, terrain icon, lock/unlock state
- Unlock logic: L1-P01 always unlocked. L1-P02 unlocks after L1-P01 complete. L1-P03 after L1-P02.
- Completion flags read from localStorage key `hanzi_complete_{id}` (boolean)
- Clicking an unlocked tile launches PuzzleScene with that puzzle id
- On return from PuzzleScene, MetaScene refreshes unlock state

### PuzzleScene
- Terrain grid: 5×4 tiles. Each cell has a terrain type.
- Spirit entity: starts at a defined cell, walks toward goal automatically.
  Spirit is blocked by obstacle terrain and waits for player to act.
- Hand: row of character cards at bottom. Player taps/clicks a card to deploy it.
- Deploy: selected card animates onto the target terrain cell. Tag resolution fires.
  World responds visually. Spirit re-evaluates path.
- Completion: spirit reaches goal cell → play celebration animation →
  write `hanzi_complete_{id} = true` to localStorage → return to MetaScene after 1.5s.
- No score. No timer (for these three puzzles). No fail state in this slice.

---

## Property tag system — implement this, not hard-coded if/else

Characters carry a `tags[]` array. The engine checks tag collisions on deploy.

**Resolution rules (check in this order):**

```js
// 1. is_hot + is_flammable target → target ignites (clears organic obstacles)
// 2. is_hot + is_wet target → steam (visual only, no terrain change in this slice)
// 3. is_wet + is_hot thing → extinguishes
// 4. is_buoyant on liquid tile → creates crossing (raft)
// 5. is_structural on chasm/pit → fills or bridges
// 6. is_luminous on darkness terrain → resolves darkness
// 7. is_luminous (dim) on darkness → partial resolve (spirit can pass but slowly)
```

Tag resolution produces one of: `CLEAR`, `PARTIAL`, `BACKFIRE`, `NO_EFFECT`.
The terrain cell updates its state based on the result.
Hard-coded matrix overrides only exist where a puzzle's `overrides[]` field specifies them.
For this slice there are no overrides — tag system handles everything.

---

## Data contracts — implement exactly

### characters.js

```js
const CHARACTERS = [
  {
    char: '木',
    pinyin: 'mù',
    gloss: 'tree/wood',
    class: 'Tool',
    etymology: '象形',
    tier: 'A',
    tags: ['is_flammable', 'is_buoyant', 'is_structural', 'is_organic'],
    color: '#6B8E4E',
    layer_unlock: 1
  },
  {
    char: '火',
    pinyin: 'huǒ',
    gloss: 'fire',
    class: 'Force',
    etymology: '象形',
    tier: 'A',
    tags: ['is_hot', 'is_luminous', 'is_flammable'],
    color: '#E8472B',
    layer_unlock: 1
  },
  {
    char: '日',
    pinyin: 'rì',
    gloss: 'sun',
    class: 'Force',
    etymology: '象形',
    tier: 'A',
    tags: ['is_hot', 'is_luminous'],
    color: '#F5A623',
    layer_unlock: 1
  },
  {
    char: '月',
    pinyin: 'yuè',
    gloss: 'moon',
    class: 'Force',
    etymology: '象形',
    tier: 'A',
    tags: ['is_luminous_dim'],
    color: '#B8C4D4',
    layer_unlock: 1
  }
];
```

### puzzles.js

```js
const PUZZLES = [
  {
    id: 'L1-P01',
    act: 'Teach',
    layer: 1,
    terrain: [
      // 5 columns × 4 rows, row-major
      // terrain types: 'ground', 'river', 'goal'
      ['ground','ground','ground','ground','ground'],
      ['ground','ground','river', 'ground','ground'],
      ['ground','ground','river', 'ground','ground'],
      ['ground','ground','ground','ground','ground']
    ],
    spirit_start: [0, 1],   // [col, row]
    goal: [4, 1],
    available_chars: ['木'],
    overrides: []
    // Solution: deploy 木 on river tile → is_buoyant on liquid → CLEAR (raft)
  },
  {
    id: 'L1-P02',
    act: 'Teach',
    layer: 1,
    terrain: [
      ['ground','ground','ground','ground','ground'],
      ['ground','thorns','thorns','ground','ground'],
      ['ground','ground','ground','ground','ground'],
      ['ground','ground','ground','ground','ground']
    ],
    spirit_start: [0, 1],
    goal: [4, 1],
    available_chars: ['火'],
    overrides: []
    // Solution: deploy 火 on thorns → is_hot on is_organic+is_fibrous → CLEAR (burns)
  },
  {
    id: 'L1-P03',
    act: 'Teach',
    layer: 1,
    terrain: [
      ['ground','ground','ground','ground','ground'],
      ['ground','dark',  'dark',  'dark',  'ground'],
      ['ground','ground','ground','ground','ground'],
      ['ground','ground','ground','ground','ground']
    ],
    spirit_start: [0, 1],
    goal: [4, 1],
    available_chars: ['日', '月'],
    overrides: []
    // Solution A: deploy 日 on dark → is_luminous → CLEAR (full light)
    // Solution B: deploy 月 on dark → is_luminous_dim → PARTIAL (spirit passes slowly)
    // Both work. Moon is visually dimmer. Spirit hesitates on PARTIAL but gets through.
  }
];
```

---

## Terrain types for this slice

| type | visual | blocks spirit? | tag it carries |
|---|---|---|---|
| `ground` | neutral tile | no | none |
| `river` | animated water | yes | `is_wet`, `is_liquid` |
| `thorns` | spiky vines | yes | `is_organic`, `is_fibrous` |
| `dark` | dim/black tile | yes | `is_dark` |
| `goal` | glowing portal | no | — |

---

## Spirit behavior

- Spirit moves one cell per step toward goal (simple pathfinding — try right first, then down, then up, then left).
- If next cell is blocked terrain, spirit stops and waits.
- After any card is deployed and terrain updates, spirit re-evaluates and resumes if path is clear.
- PARTIAL resolution (月 on dark): spirit moves through dark tiles at half speed. Not blocked.
- Spirit is a simple animated sprite — glowing orb or similar. No character art needed.

---

## Card deploy flow

1. Player taps a character card in hand.
2. Card highlights (selected state).
3. Player taps a terrain cell.
4. Deploy animation: character glyph flies from hand to cell, scales up, pulses, fades to leave terrain changed.
5. Tag resolution fires. Terrain cell updates state.
6. Spirit resumes.
7. Card is consumed from hand (greyed out or removed).

**3-Second Rule:** from tap to visible world response ≤ 3 seconds. No confirmation dialogs.

---

## Visual direction (minimal — Design will refine later)

- Grid cells: rounded rectangles, terrain type sets fill color
  - ground: #C8B89A · river: #4A90D9 (animated shimmer) · thorns: #5A7A3A · dark: #1A1A2E · goal: #FFD700
- Character cards: rounded rect, character glyph large and centered, `color` from registry as border
- Spirit: white/gold glowing circle, subtle pulse animation
- Deploy animation: glyph scales from card position to cell (Phaser tween, 300ms), brief flash, terrain recolors
- No external assets. All visuals from Phaser graphics primitives + text.

---

## What NOT to build in this handoff

- ❌ Fusion bench or fusion mechanic (Layer 3)
- ❌ Part-reveal animation (Layer 2, Tier B)
- ❌ Modifier class mechanic
- ❌ Creature idle behavior
- ❌ Lore cards or gallery
- ❌ Any puzzle beyond L1-P03
- ❌ Score, timer, or fail state
- ❌ Stroke tracing, pronunciation gates, SRS

---

## Critical bugs to avoid (from prototype)

1. **Duplicate radicals:** if `available_chars` ever lists the same char twice,
   use accumulation: `hand[char] = (hand[char] || 0) + 1`. Never assignment.
2. **puzzle.notes leaking:** puzzle objects may have a `notes` field for internal use.
   Never render it in any player-visible UI element.
3. **Completion condition:** only `spirit reaches goal cell`. No other win condition.
4. **File set for Design:** when handing off to Design for playtesting,
   provide `game.html` + `data/characters.js` + `data/puzzles.js` together.
   Never game.html alone.

---

## Done when

- [ ] MetaScene renders 3 puzzle tiles; L1-P01 unlocked, others locked
- [ ] L1-P01 playable: deploy 木 on river → spirit crosses → MetaScene unlocks P02
- [ ] L1-P02 playable: deploy 火 on thorns → spirit passes → MetaScene unlocks P03
- [ ] L1-P03 playable: deploy 日 OR 月 → both work, moon is visibly dimmer
- [ ] localStorage flags persist across page refresh
- [ ] No console errors
- [ ] Works on mobile (touch) and desktop (mouse)
