/* hanzi-sandbox/engine/resolver.js — resolveInteraction() (Design Bible §4a/§4b, CLAUDE.md Phase 3).
   Standalone prototype. Not wired into game/ — separate product per design bible §0. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("../data/terrain.js"));
  else root.HanziSandbox = Object.assign(root.HanziSandbox || {}, { Resolver: factory(root.HanziSandbox.Terrain) });
})(typeof self !== "undefined" ? self : this, function (Terrain) {
  "use strict";

  var NO_OP = { symbol: "—", outcome: "none" };

  // resolveInteraction(charKey, terrainCell, levelHasTimer) -> { symbol, outcome, sideEffect }
  //
  // §4b char x char is checked first: if the cell was already modified by a
  // char that has a defined reaction to the incoming char, that consequence
  // wins over the plain §4a char x terrain result (CLAUDE.md "Interaction
  // resolver" rule).
  function resolveInteraction(charKey, terrainCell, levelHasTimer) {
    if (terrainCell.modifiedBy) {
      var charCharRow = Terrain.CHAR_CHAR[terrainCell.modifiedBy];
      var charCharResult = charCharRow && charCharRow[charKey];
      if (charCharResult) {
        return clone(charCharResult);
      }
    }

    var row = Terrain.CHAR_TERRAIN[charKey];
    if (!row) return clone(NO_OP);

    var entry = row[terrainCell.type];
    if (!entry) return clone(NO_OP);

    if (entry.timedBy) {
      return clone(levelHasTimer ? entry.timed : entry.untimed);
    }

    return clone(entry);
  }

  function clone(entry) {
    return {
      symbol: entry.symbol,
      outcome: entry.outcome,
      sideEffect: entry.sideEffect || null
    };
  }

  return { resolveInteraction: resolveInteraction };
});
