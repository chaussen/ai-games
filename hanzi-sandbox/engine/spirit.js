/* hanzi-sandbox/engine/spirit.js — spirit entity, state buffs, recovery (Design Bible §4a state
   effects, D034 recovery, D037 buff spec). Standalone prototype, not wired into game/. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.HanziSandbox = Object.assign(root.HanziSandbox || {}, { Spirit: factory() });
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Placeholder per CLAUDE.md: 好 damage magnitude is unspecced (D037 locks type, not amount).
  var BACKFIRE_DAMAGE = 1; // OPEN: D037 — exact damage value still unspecced; placeholder.

  function createSpirit(startTile) {
    return {
      position: { tile: startTile || 0 },
      state: "moving",
      activeBuff: null,
      lastSafeTile: startTile || 0,
      hp: 3
    };
  }

  function markSafe(spirit) {
    spirit.lastSafeTile = spirit.position.tile;
  }

  // D034: on fall, return to last safe tile (1-2 tile setback), no full restart.
  function fall(spirit) {
    if (spirit.activeBuff && spirit.activeBuff.type === "fall_immunity" && !spirit.activeBuff.consumed) {
      spirit.activeBuff.consumed = true;
      return { fell: false, reason: "fall_immunity_consumed" };
    }
    spirit.position.tile = spirit.lastSafeTile;
    spirit.state = "moving";
    return { fell: true };
  }

  // §4b backfire damage hit (e.g. fire burns raft you're standing on).
  function takeBackfireDamage(spirit) {
    if (spirit.activeBuff && spirit.activeBuff.type === "damage_immunity" && !spirit.activeBuff.consumed) {
      spirit.activeBuff.consumed = true;
      return { damaged: false, reason: "damage_immunity_consumed" };
    }
    spirit.hp -= BACKFIRE_DAMAGE;
    return { damaged: true, hp: spirit.hp };
  }

  // 休 (rest): pause the spirit for a timer duration.
  function applyRest(spirit, durationMs) {
    spirit.state = "paused";
    return { state: spirit.state, durationMs: durationMs };
  }

  function clearPause(spirit) {
    if (spirit.state === "paused") spirit.state = "moving";
  }

  // 好 / 安 (D037): set the spirit's single active buff. A new buff overwrites the old one.
  function applyBuff(spirit, charKey, type) {
    spirit.activeBuff = { char: charKey, type: type, consumed: false };
    spirit.state = "buffed";
  }

  return {
    BACKFIRE_DAMAGE: BACKFIRE_DAMAGE,
    createSpirit: createSpirit,
    markSafe: markSafe,
    fall: fall,
    takeBackfireDamage: takeBackfireDamage,
    applyRest: applyRest,
    clearPause: clearPause,
    applyBuff: applyBuff
  };
});
