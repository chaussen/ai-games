/* hanzi-sandbox/engine/puzzleLoader.js — loads a puzzle definition into terrain + spirit + hand.
   Standalone prototype, not wired into game/. Content (data/puzzles.js) never touches engine
   internals directly; this is the only seam between the two. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("../data/terrain.js"), require("./spirit.js"));
  } else {
    root.HanziSandbox = Object.assign(root.HanziSandbox || {}, {
      PuzzleLoader: factory(root.HanziSandbox.Terrain, root.HanziSandbox.Spirit)
    });
  }
})(typeof self !== "undefined" ? self : this, function (Terrain, Spirit) {
  "use strict";

  // Depletion (Constrain act only, D005). Per-radical counts aren't specced
  // anywhere beyond "single-use" — defaults to 1 each. OPEN, see data/puzzles.js header.
  var DEFAULT_CONSTRAIN_COUNT = 1;

  function loadPuzzle(puzzle) {
    var terrain = puzzle.terrain.map(function (cellSpec) {
      return Terrain.makeCell(cellSpec.type);
    });

    (puzzle.prePlaced || []).forEach(function (placement) {
      var cell = terrain[placement.tile];
      cell.state = "modified";
      cell.modifiedBy = placement.char;
    });

    var spirit = Spirit.createSpirit(0);

    var isConstrain = puzzle.act === "Constrain";
    var hand = {};
    puzzle.availableRadicals.forEach(function (radical) {
      hand[radical] = isConstrain ? DEFAULT_CONSTRAIN_COUNT : Infinity;
    });

    return {
      puzzle: puzzle,
      terrain: terrain,
      spirit: spirit,
      hand: hand,
      levelHasTimer: !!puzzle.levelHasTimer
    };
  }

  return { loadPuzzle: loadPuzzle, DEFAULT_CONSTRAIN_COUNT: DEFAULT_CONSTRAIN_COUNT };
});
