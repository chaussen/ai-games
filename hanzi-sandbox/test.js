/* hanzi-sandbox/test.js — smoke tests for §2 Fusion Model + §3 Recipe Registry.
   Run with: node hanzi-sandbox/test.js */
"use strict";
var assert = require("assert");
var Recipes = require("./recipes.js");
var Fusion = require("./fusion.js");

var engine = new Fusion.FusionEngine();

// Multiset matching: order must not matter.
assert.deepStrictEqual(engine.tryFuse(["木", "木"]).recipe.char, "林");
assert.deepStrictEqual(engine.tryFuse(["日", "月"]).recipe.char, "明");
assert.deepStrictEqual(engine.tryFuse(["月", "日"]).recipe.char, "明", "multiset: reversed order must still match");

// Unknown combos do not fuse.
assert.strictEqual(engine.tryFuse(["火", "水"]).ok, false);

// Chain fusion: 林 (tier1) + 木 -> 森 (tier2), re-fusable output.
var chained = engine.tryFuse(["林", "木"]);
assert.strictEqual(chained.ok, true);
assert.strictEqual(chained.recipe.char, "森");
assert.strictEqual(chained.recipe.tier, 2);

// Tier accounting: base = 0, single fuse = 1, re-fuse = 2.
assert.strictEqual(engine.tierOf("木"), 0);
assert.strictEqual(engine.tierOf("林"), 1);
assert.strictEqual(engine.tierOf("森"), 2);

// Max chain depth 3 (tier 2 deepest for v1): registry has no tier-3 recipe.
Recipes.RECIPES.forEach(function (r) {
  assert.ok(r.tier <= Fusion.MAX_TIER, r.char + " exceeds max tier");
});

// Infinite stamps (Teach/Choose acts): never depleted.
var infinitePool = new Fusion.StampPool("infinite");
for (var i = 0; i < 5; i++) {
  var r = engine.fuse("木", "木", infinitePool);
  assert.strictEqual(r.ok, true);
}

// Depletion (Constrain act): explicit, finite counts.
var constrainPool = new Fusion.StampPool("depletion", { 木: 2 });
var first = engine.fuse("木", "木", constrainPool);
assert.strictEqual(first.ok, true);
assert.strictEqual(constrainPool.count("木"), 0, "both 木 stamps spent");
assert.strictEqual(constrainPool.count("林"), 1, "fusion output returned to pool as re-fusable ingredient");

var second = engine.fuse("木", "木", constrainPool);
assert.strictEqual(second.ok, false);
assert.strictEqual(second.reason, "insufficient-stamps");

// Chain fusion off a depleted pool: 林 (from the fuse above) + a fresh 木.
constrainPool.add("木", 1);
var third = engine.fuse("林", "木", constrainPool);
assert.strictEqual(third.ok, true);
assert.strictEqual(third.recipe.char, "森");

console.log("All hanzi-sandbox fusion/recipe tests passed.");
