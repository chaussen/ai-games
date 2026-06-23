/* hanzi-sandbox/data/terrain.js — Terrain cell types + Design Bible §4a/§4b interaction data.
   Standalone prototype. Not wired into game/ — separate product per design bible §0.

   This file holds DATA only (constants + lookup tables). resolveInteraction() in
   engine/resolver.js is the only code that reads these tables. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.HanziSandbox = Object.assign(root.HanziSandbox || {}, { Terrain: factory() });
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var TERRAIN = Object.freeze({
    RIVER: "RIVER",
    ICE_WALL: "ICE_WALL",
    THORNS: "THORNS",
    DARKNESS: "DARKNESS",
    CHASM_SMALL: "CHASM_SMALL",
    CHASM_LARGE: "CHASM_LARGE",
    MUD: "MUD",
    SHADOW_WEB: "SHADOW_WEB"
  });

  function makeCell(type) {
    return { type: type, state: "default", modifiedBy: null };
  }

  // §4a Character x Terrain. Corrections from CLAUDE.md "Key rules from locked
  // decisions" (D013-D033) are applied here, not the raw Bible table, since the
  // CLAUDE.md rules are the implementation-authoritative versions.
  //
  // Entries keyed by char -> terrain -> { symbol, outcome, sideEffect? }
  // A `timed` entry (object instead of a single result) is resolved by
  // levelHasTimer in the resolver (D032: 朋 x RIVER).
  var CHAR_TERRAIN = {
    "火": {
      RIVER: { symbol: "~", outcome: "steam_obscure", sideEffect: { duration_ms: 4000, effect: "obscure" } },
      ICE_WALL: { symbol: "~", outcome: "melt_insufficient" }, // D013
      THORNS: { symbol: "✓", outcome: "burn" },
      DARKNESS: { symbol: "~", outcome: "light_insufficient" }, // D014
      CHASM_SMALL: { symbol: "—", outcome: "none" },
      CHASM_LARGE: { symbol: "—", outcome: "none" },
      MUD: { symbol: "~", outcome: "dry_slow" },
      SHADOW_WEB: { symbol: "✓", outcome: "burn_web" }
    },
    "炎": {
      RIVER: { symbol: "✗", outcome: "steam_blocks_vision" }, // D016
      ICE_WALL: { symbol: "✓", outcome: "melt_fast" },
      THORNS: { symbol: "✓", outcome: "burn_wide" },
      DARKNESS: { symbol: "✓", outcome: "light_wide" },
      CHASM_SMALL: { symbol: "—", outcome: "none" },
      CHASM_LARGE: { symbol: "—", outcome: "none" },
      MUD: { symbol: "✓", outcome: "dry_full" },
      SHADOW_WEB: { symbol: "✓", outcome: "burn_web_wide" }
    },
    "冰": {
      RIVER: { symbol: "✓", outcome: "freeze_bridge" },
      ICE_WALL: { symbol: "—", outcome: "none" },
      THORNS: { symbol: "~", outcome: "freeze_brittle" },
      DARKNESS: { symbol: "—", outcome: "none" },
      CHASM_SMALL: { symbol: "—", outcome: "none" },
      CHASM_LARGE: { symbol: "—", outcome: "none" },
      MUD: { symbol: "✓", outcome: "freeze_solid" },
      SHADOW_WEB: { symbol: "—", outcome: "none" }
    },
    "凌": {
      RIVER: { symbol: "✓", outcome: "flood_then_freeze_wide" },
      ICE_WALL: { symbol: "✗", outcome: "thicken_wall" },
      THORNS: { symbol: "~", outcome: "flash_freeze_wide" },
      DARKNESS: { symbol: "—", outcome: "none" },
      CHASM_SMALL: { symbol: "—", outcome: "none" },
      CHASM_LARGE: { symbol: "—", outcome: "none" },
      MUD: { symbol: "✓", outcome: "clear_and_freeze" },
      SHADOW_WEB: { symbol: "—", outcome: "none" }
    },
    "明": {
      RIVER: { symbol: "—", outcome: "none" },
      ICE_WALL: { symbol: "—", outcome: "none" },
      THORNS: { symbol: "—", outcome: "none" },
      DARKNESS: { symbol: "✓", outcome: "reveal_path" },
      CHASM_SMALL: { symbol: "—", outcome: "none" },
      CHASM_LARGE: { symbol: "—", outcome: "none" },
      MUD: { symbol: "—", outcome: "none" },
      SHADOW_WEB: { symbol: "✓", outcome: "dissolve_web" }
    },
    "晶": {
      RIVER: { symbol: "—", outcome: "none" },
      ICE_WALL: { symbol: "—", outcome: "none" },
      THORNS: { symbol: "—", outcome: "none" },
      DARKNESS: { symbol: "✓", outcome: "reveal_and_solidify" },
      CHASM_SMALL: { symbol: "—", outcome: "none" },
      CHASM_LARGE: { symbol: "—", outcome: "none" },
      MUD: { symbol: "—", outcome: "none" },
      SHADOW_WEB: { symbol: "✓", outcome: "dissolve_and_crystallize" }
    },
    "星": {
      RIVER: { symbol: "—", outcome: "none" },
      ICE_WALL: { symbol: "—", outcome: "none" },
      THORNS: { symbol: "—", outcome: "none" },
      DARKNESS: { symbol: "✓", outcome: "illuminate_dim_wide" },
      CHASM_SMALL: { symbol: "—", outcome: "none" },
      CHASM_LARGE: { symbol: "—", outcome: "none" },
      MUD: { symbol: "—", outcome: "none" },
      SHADOW_WEB: { symbol: "~", outcome: "dim_web" }
    },
    "水": {
      RIVER: { symbol: "✗", outcome: "deepen_river" }, // D015
      ICE_WALL: { symbol: "~", outcome: "soften_insufficient" },
      THORNS: { symbol: "—", outcome: "none" },
      DARKNESS: { symbol: "—", outcome: "none" },
      CHASM_SMALL: { symbol: "—", outcome: "none" },
      CHASM_LARGE: { symbol: "—", outcome: "none" },
      MUD: { symbol: "✓", outcome: "wash_clear" },
      SHADOW_WEB: { symbol: "—", outcome: "none" }
    },
    "沐": {
      RIVER: { symbol: "✗", outcome: "deepen_river" },
      ICE_WALL: { symbol: "~", outcome: "soften_insufficient" },
      THORNS: { symbol: "—", outcome: "none" },
      DARKNESS: { symbol: "—", outcome: "none" },
      CHASM_SMALL: { symbol: "—", outcome: "none" },
      CHASM_LARGE: { symbol: "—", outcome: "none" },
      MUD: { symbol: "✓", outcome: "wash_clear" },
      SHADOW_WEB: { symbol: "—", outcome: "none" }
    },
    "泪": {
      RIVER: { symbol: "✗", outcome: "deepen_river_slightly" }, // D015
      ICE_WALL: { symbol: "—", outcome: "none" },
      THORNS: { symbol: "—", outcome: "none" },
      DARKNESS: { symbol: "—", outcome: "none" },
      CHASM_SMALL: { symbol: "—", outcome: "none" },
      CHASM_LARGE: { symbol: "—", outcome: "none" },
      MUD: { symbol: "✗", outcome: "add_moisture_worsens" }, // D015
      SHADOW_WEB: { symbol: "—", outcome: "none" }
    },
    "林": {
      RIVER: { symbol: "✓", outcome: "raft" },
      ICE_WALL: { symbol: "—", outcome: "none" },
      THORNS: { symbol: "✗", outcome: "absorbed_by_thorns" },
      DARKNESS: { symbol: "—", outcome: "none" },
      CHASM_SMALL: { symbol: "✓", outcome: "log_bridge" }, // D031
      CHASM_LARGE: { symbol: "✗", outcome: "too_short" }, // D031
      MUD: { symbol: "✗", outcome: "sinks_in_mud" },
      SHADOW_WEB: { symbol: "—", outcome: "none" }
    },
    "森": {
      RIVER: { symbol: "✓", outcome: "wide_raft" },
      ICE_WALL: { symbol: "—", outcome: "none" },
      THORNS: { symbol: "✗", outcome: "absorbed_by_thorns" },
      DARKNESS: { symbol: "—", outcome: "none" },
      CHASM_SMALL: { symbol: "✓", outcome: "stone_bridge" }, // D031
      CHASM_LARGE: { symbol: "✓", outcome: "long_bridge" }, // D031
      MUD: { symbol: "~", outcome: "float_then_sink", sideEffect: { duration_ms: 6000, effect: "sink" } }, // D033
      SHADOW_WEB: { symbol: "—", outcome: "none" }
    },
    "岩": {
      RIVER: { symbol: "—", outcome: "none" },
      ICE_WALL: { symbol: "—", outcome: "none" },
      THORNS: { symbol: "—", outcome: "none" },
      DARKNESS: { symbol: "—", outcome: "none" },
      CHASM_SMALL: { symbol: "✓", outcome: "fills_solid_path" }, // D031
      CHASM_LARGE: { symbol: "~", outcome: "partial_fill_needs_second_tool" }, // D031
      MUD: { symbol: "✓", outcome: "hardens_path" },
      SHADOW_WEB: { symbol: "—", outcome: "none" }
    },
    "尖": {
      RIVER: { symbol: "—", outcome: "none" },
      ICE_WALL: { symbol: "✓", outcome: "crack_wall" },
      THORNS: { symbol: "✓", outcome: "cut_single" },
      DARKNESS: { symbol: "—", outcome: "none" },
      CHASM_SMALL: { symbol: "—", outcome: "none" },
      CHASM_LARGE: { symbol: "—", outcome: "none" },
      MUD: { symbol: "—", outcome: "none" },
      SHADOW_WEB: { symbol: "✓", outcome: "cut_web" }
    },
    "朋": {
      RIVER: { timedBy: "levelHasTimer", untimed: { symbol: "✓", outcome: "swim" }, timed: { symbol: "~", outcome: "swim_slow" } }, // D032
      ICE_WALL: { symbol: "—", outcome: "none" },
      THORNS: { symbol: "✗", outcome: "tangled" },
      DARKNESS: { symbol: "—", outcome: "none" },
      CHASM_SMALL: { symbol: "—", outcome: "none" },
      CHASM_LARGE: { symbol: "—", outcome: "none" },
      MUD: { symbol: "✗", outcome: "stuck" },
      SHADOW_WEB: { symbol: "—", outcome: "none" }
    },
    // D048: 朋+朋 -> 朋朋, fills the Creature x chasm-large gap.
    "朋朋": {
      RIVER: { symbol: "✓", outcome: "link_across" },
      ICE_WALL: { symbol: "—", outcome: "none" },
      THORNS: { symbol: "✗", outcome: "tangled_double" },
      DARKNESS: { symbol: "—", outcome: "none" },
      CHASM_SMALL: { symbol: "✓", outcome: "creature_bridge" },
      CHASM_LARGE: { symbol: "✓", outcome: "creature_bridge" },
      MUD: { symbol: "✗", outcome: "stuck_double" },
      SHADOW_WEB: { symbol: "—", outcome: "none" }
    },
    "鸟": {
      RIVER: { symbol: "✓", outcome: "carry_over" },
      ICE_WALL: { symbol: "—", outcome: "none" },
      THORNS: { symbol: "✓", outcome: "fly_over" },
      DARKNESS: { symbol: "—", outcome: "none" },
      CHASM_SMALL: { symbol: "✓", outcome: "carry_over" },
      CHASM_LARGE: { symbol: "✓", outcome: "carry_over" },
      MUD: { symbol: "✓", outcome: "fly_over" },
      SHADOW_WEB: { symbol: "✓", outcome: "fly_through" }
    },
    "鸣": {
      RIVER: { symbol: "✓", outcome: "carry_over" },
      ICE_WALL: { symbol: "—", outcome: "none" },
      THORNS: { symbol: "✓", outcome: "fly_over" },
      DARKNESS: { symbol: "—", outcome: "none" },
      CHASM_SMALL: { symbol: "✓", outcome: "carry_over" },
      CHASM_LARGE: { symbol: "✓", outcome: "carry_over" },
      MUD: { symbol: "✓", outcome: "fly_over" },
      SHADOW_WEB: { symbol: "✓", outcome: "fly_through" }
    },
    // State class: never touches terrain (Design Bible §1, §4a state effects table).
    "休": {},
    "好": {},
    "安": {}
  };

  // §4b Character x Character — read when terrainCell.modifiedBy is set.
  // Keyed by [existing modifiedBy char] -> [incoming deployed char] -> result.
  var CHAR_CHAR = {
    "冰": {
      "火": { symbol: "✗", outcome: "fire_melts_bridge_fall" },
      "炎": { symbol: "✗", outcome: "fire_melts_bridge_fall" }
    },
    "凌": {
      "火": { symbol: "✗", outcome: "fire_melts_bridge_fall" },
      "炎": { symbol: "✗", outcome: "fire_melts_bridge_fall" }
    },
    "林": {
      "火": { symbol: "✗", outcome: "fire_burns_raft_fall" },
      "炎": { symbol: "✗", outcome: "fire_burns_raft_fall" },
      "冰": { symbol: "✓", outcome: "ice_preserves_raft" },
      "凌": { symbol: "✓", outcome: "ice_preserves_raft" }
    },
    "森": {
      "火": { symbol: "✗", outcome: "fire_burns_raft_fall" },
      "炎": { symbol: "✗", outcome: "fire_burns_raft_fall" },
      "冰": { symbol: "✓", outcome: "ice_preserves_raft" },
      "凌": { symbol: "✓", outcome: "ice_preserves_raft" }
    },
    "火": {
      "冰": { symbol: "✗", outcome: "ice_extinguishes_fire" },
      "凌": { symbol: "✗", outcome: "ice_extinguishes_fire" },
      "林": { symbol: "✗", outcome: "fire_burns_wood" },
      "森": { symbol: "✗", outcome: "fire_burns_wood" }
    },
    "炎": {
      "冰": { symbol: "✗", outcome: "ice_extinguishes_fire" },
      "凌": { symbol: "✗", outcome: "ice_extinguishes_fire" },
      "林": { symbol: "✗", outcome: "fire_burns_wood" },
      "森": { symbol: "✗", outcome: "fire_burns_wood" }
    }
  };

  return {
    TERRAIN: TERRAIN,
    makeCell: makeCell,
    CHAR_TERRAIN: CHAR_TERRAIN,
    CHAR_CHAR: CHAR_CHAR
  };
});
