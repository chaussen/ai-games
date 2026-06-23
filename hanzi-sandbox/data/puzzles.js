/* hanzi-sandbox/data/puzzles.js — Design Bible §5 puzzle vocabulary, all 15 puzzles verbatim
   per CLAUDE.md "Puzzle loader" section. Standalone prototype, not wired into game/.

   Contract: { id, act, obstacle, terrain, availableRadicals, validSolutions,
               redHerrings, levelHasTimer, notes }

   Two additive fields not in the original contract, used only by puzzleLoader.js:
   - prePlaced: terrain tiles that start already modified by a given char (needed
     for P12, "river with placed 林" — the contract didn't specify how a puzzle
     pre-seeds terrain state, so this was added; see Bible Decision Log entry
     for this build).
   - orderedSolution: true when a validSolutions entry must be applied in the
     listed order (P14 — "in that order" per CLAUDE.md).

   OPEN: per-radical depletion counts for Constrain-act puzzles (P12-P15) are not
   specified anywhere in the Bible or CLAUDE.md beyond "each radical stamp is
   single-use." puzzleLoader.js defaults every Constrain-act radical to a count
   of 1. Flag for Design before puzzles ship — see Bible Decision Log. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./terrain.js"));
  else root.HanziSandbox = Object.assign(root.HanziSandbox || {}, { Puzzles: factory(root.HanziSandbox.Terrain) });
})(typeof self !== "undefined" ? self : this, function (Terrain) {
  "use strict";

  var T = Terrain.TERRAIN;

  var PUZZLES = [
    {
      id: "P01", act: "Teach", obstacle: "spirit can't cross", terrain: [{ type: T.RIVER }],
      availableRadicals: ["冫", "水", "火", "木"], validSolutions: [["冰"]], redHerrings: [],
      levelHasTimer: false, notes: "one answer, teach freeze"
    },
    {
      id: "P02", act: "Choose", obstacle: "spirit can't cross", terrain: [{ type: T.RIVER }],
      availableRadicals: ["冫", "水", "火", "木"], validSolutions: [["冰"], ["林"]], redHerrings: ["火"],
      levelHasTimer: false, notes: "fire makes steam (obscures, ~)"
    },
    {
      id: "P03", act: "Teach", obstacle: "path blocked", terrain: [{ type: T.THORNS }],
      availableRadicals: ["火", "冰", "水", "木"], validSolutions: [["火"]], redHerrings: [],
      levelHasTimer: false, notes: "one answer, teach burn"
    },
    {
      id: "P04", act: "Choose", obstacle: "path blocked", terrain: [{ type: T.THORNS }],
      availableRadicals: ["火", "冰", "水", "木", "小", "大"], validSolutions: [["火"], ["尖"]], redHerrings: ["冰"],
      levelHasTimer: false, notes: "freeze makes brittle but not clear"
    },
    {
      id: "P05", act: "Teach", obstacle: "spirit lost", terrain: [{ type: T.DARKNESS }],
      availableRadicals: ["日", "月", "火", "星"], validSolutions: [["明"]], redHerrings: [],
      levelHasTimer: false, notes: "one answer, teach light"
    },
    {
      id: "P06", act: "Choose", obstacle: "spirit lost", terrain: [{ type: T.DARKNESS }],
      availableRadicals: ["日", "月", "火", "星", "生"], validSolutions: [["明"], ["星"]], redHerrings: ["火"],
      levelHasTimer: false, notes: "fire lights insufficiently (~, not ✓)"
    },
    {
      // D051: two-chasm forced fork. Inserted between P06 and P07 as P06b (kept
      // unnumbered-in-sequence per D051 to avoid an P07-P15 renumber cascade).
      id: "P06b", act: "Choose", obstacle: "two gaps in sequence",
      terrain: [{ type: T.CHASM_SMALL }, { type: T.CHASM_LARGE }],
      availableRadicals: ["木", "木", "木", "林"], validSolutions: [["林", "木"]], redHerrings: ["林"],
      levelHasTimer: false,
      notes: "tile 0 (small): 林 ✓ or chain to 森 ✓ for a bonus orb; tile 1 (large): 森 only, 林 ✗ too short. " +
        "Player must assess gap size before committing. OPEN: bonus-orb mechanic is out of scope for Phase 3 " +
        "(no scoring system); this puzzle is solvable without it."
    },
    {
      id: "P07", act: "Compound", obstacle: "wide chasm", terrain: [{ type: T.CHASM_LARGE }],
      availableRadicals: ["木", "林"], validSolutions: [["林", "木"]], redHerrings: ["林"],
      levelHasTimer: false, hintSparkle: true,
      notes: "林 alone too short (✗ chasm-large); teaches tier-2 chain (林+木=森); hint sparkle on 林+木 when both in hand"
    },
    {
      id: "P08", act: "Compound", obstacle: "ice-wall blocking", terrain: [{ type: T.ICE_WALL }],
      availableRadicals: ["火", "炎", "小", "大"], validSolutions: [["炎", "尖"]], redHerrings: ["火"],
      levelHasTimer: false, notes: "fire melts insufficiently (~); two-tool puzzle"
    },
    {
      id: "P09", act: "Compound", obstacle: "river tile + thorns tile",
      terrain: [{ type: T.RIVER }, { type: T.THORNS }],
      availableRadicals: ["冫", "水", "小", "大", "火"], validSolutions: [["冰", "尖"]], redHerrings: ["火"],
      levelHasTimer: false,
      notes: "spatially separated; 冰 targets tile 0 (river), 尖 targets tile 1 (thorns); fire burns thorns but steam hides river"
    },
    {
      id: "P10", act: "Compound", obstacle: "darkness + web", terrain: [{ type: T.DARKNESS }, { type: T.SHADOW_WEB }],
      availableRadicals: ["日", "月", "星", "小", "大", "火"], validSolutions: [["明", "尖"], ["晶"]], redHerrings: ["火"],
      levelHasTimer: false, notes: "teaches chaining + tier-2 shortcut (明+星=晶)"
    },
    {
      id: "P11", act: "Compound", obstacle: "mud + chasm-small", terrain: [{ type: T.MUD }, { type: T.CHASM_SMALL }],
      availableRadicals: ["山", "石", "木", "氵", "水"], validSolutions: [["岩", "林"], ["沐", "岩"]], redHerrings: ["水"],
      levelHasTimer: false, notes: "water worsens mud (✗); 沐 clears mud first is the alt path"
    },
    {
      id: "P12", act: "Constrain", obstacle: "river with placed 林", terrain: [{ type: T.RIVER }],
      prePlaced: [{ tile: 0, char: "林" }],
      availableRadicals: ["冫", "水", "火"], validSolutions: [["冰"]], redHerrings: ["火"],
      levelHasTimer: false, notes: "fire burns your own raft (§4b); spirit falls -> setback (D034)"
    },
    {
      id: "P13", act: "Constrain", obstacle: "timed darkness", terrain: [{ type: T.DARKNESS }],
      availableRadicals: ["人", "木", "日", "月", "宀", "女"], validSolutions: [["休", "明"]], redHerrings: ["安"],
      levelHasTimer: true, notes: "休 buys timer time; 明 solves dark; 安 (fall-immunity) doesn't help here"
    },
    {
      id: "P14", act: "Constrain", obstacle: "thorns + ice-wall", terrain: [{ type: T.THORNS }, { type: T.ICE_WALL }],
      availableRadicals: ["小", "大", "火", "冫", "水"], validSolutions: [["尖", "炎"]], orderedSolution: true,
      redHerrings: ["凌"], levelHasTimer: false, notes: "凌 thickens wall (✗); sequence matters — cut thorns before melting wall"
    },
    {
      id: "P15", act: "Constrain", obstacle: "all terrain types",
      terrain: [{ type: T.RIVER }, { type: T.THORNS }, { type: T.DARKNESS }, { type: T.ICE_WALL },
        { type: T.CHASM_SMALL }, { type: T.CHASM_LARGE }, { type: T.MUD }, { type: T.SHADOW_WEB }],
      availableRadicals: ["冫", "水", "火", "木", "日", "月", "山", "石", "小", "大", "氵"],
      validSolutions: [], redHerrings: [], levelHasTimer: false,
      notes: "mastery level; no single path; player-authored"
    }
  ];

  return { PUZZLES: PUZZLES };
});
