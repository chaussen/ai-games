/* hanzi-sandbox/fusion.js — Fusion Model (Design Bible §2)
   Standalone prototype. Not wired into game/ — separate product per design bible §0.

   Rules encoded here, straight from §2:
   - Chain fusion: recipe outputs are themselves valid inputs to later fusions.
   - Tier = number of fusion steps (base radical = 0, single fuse = 1, re-fuse = 2).
   - Max chain depth 3 for v1 → registry caps at tier 2, enforced by construction
     (no tier-3 recipe can exist; fuse() never produces one).
   - Matching is multiset: input order never matters.
   - Stamps are infinite in Teach/Choose acts; Constrain act introduces explicit
     depletion as its own mechanic (see StampPool below). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./recipes.js"));
  else root.HanziSandbox = Object.assign(root.HanziSandbox || {}, { Fusion: factory(root.HanziSandbox.Recipes) });
})(typeof self !== "undefined" ? self : this, function (Recipes) {
  "use strict";

  var MAX_TIER = 2; // chain depth 3 (tiers 0,1,2) — Design Bible §2

  function FusionEngine(recipes) {
    recipes = recipes || Recipes.RECIPES;
    this.index = Recipes.buildIndex(recipes);
    this.tierByChar = new Map();
    recipes.forEach(function (r) {
      this.tierByChar.set(r.char, r.tier);
    }, this);
  }

  // Base radicals (anything not itself a fusion output) are tier 0.
  FusionEngine.prototype.tierOf = function (char) {
    return this.tierByChar.has(char) ? this.tierByChar.get(char) : 0;
  };

  FusionEngine.prototype.lookup = function (inputs) {
    var key = Recipes.keyFor(inputs);
    return this.index.get(key) || null;
  };

  // Pure rules check, no stamp/inventory side effects: would this multiset
  // fuse into something, and does it respect the max-depth-3 cap?
  FusionEngine.prototype.tryFuse = function (inputs) {
    var recipe = this.lookup(inputs);
    if (!recipe) return { ok: false, reason: "no-recipe" };
    if (recipe.tier > MAX_TIER) return { ok: false, reason: "max-depth-exceeded" };
    return { ok: true, recipe: recipe };
  };

  // Stamp pool — Design Bible §2: infinite stamps in Teach/Choose, explicit
  // depletion only in Constrain. mode is fixed per pool; Constrain pools are
  // seeded with finite counts and refilled only by fusion outputs (chain re-use).
  function StampPool(mode, initialCounts) {
    this.mode = mode === "depletion" ? "depletion" : "infinite";
    this.counts = new Map();
    if (this.mode === "depletion" && initialCounts) {
      Object.keys(initialCounts).forEach(function (char) {
        this.counts.set(char, initialCounts[char]);
      }, this);
    }
  }

  StampPool.prototype.count = function (char) {
    if (this.mode === "infinite") return Infinity;
    return this.counts.get(char) || 0;
  };

  StampPool.prototype.has = function (char, qty) {
    qty = qty || 1;
    return this.count(char) >= qty;
  };

  StampPool.prototype.take = function (char, qty) {
    qty = qty || 1;
    if (this.mode === "infinite") return;
    if (!this.has(char, qty)) throw new Error("StampPool: insufficient stamps for " + char);
    this.counts.set(char, this.count(char) - qty);
  };

  StampPool.prototype.add = function (char, qty) {
    qty = qty || 1;
    if (this.mode === "infinite") return;
    this.counts.set(char, this.count(char) + qty);
  };

  // Fuse two stamps drawn from a pool. On success, inputs are spent and the
  // output is returned to the pool as a re-fusable ingredient (chain fusion).
  // On failure (no matching recipe), nothing is consumed — player can retry.
  FusionEngine.prototype.fuse = function (charA, charB, stampPool) {
    var inputs = [charA, charB];
    var needBoth = charA === charB ? 2 : 1;
    if (stampPool) {
      if (!stampPool.has(charA, charA === charB ? needBoth : 1)) {
        return { ok: false, reason: "insufficient-stamps", char: charA };
      }
      if (charA !== charB && !stampPool.has(charB, 1)) {
        return { ok: false, reason: "insufficient-stamps", char: charB };
      }
    }

    var result = this.tryFuse(inputs);
    if (!result.ok) return result;

    if (stampPool) {
      if (charA === charB) stampPool.take(charA, 2);
      else {
        stampPool.take(charA, 1);
        stampPool.take(charB, 1);
      }
      stampPool.add(result.recipe.char, 1);
    }

    return result;
  };

  return {
    MAX_TIER: MAX_TIER,
    FusionEngine: FusionEngine,
    StampPool: StampPool
  };
});
