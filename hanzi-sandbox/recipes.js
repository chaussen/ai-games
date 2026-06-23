/* hanzi-sandbox/recipes.js — Recipe Registry (Design Bible §3)
   Standalone prototype. Not wired into game/ — separate product per design bible §0.
   Contract: { inputs:[], char, pinyin, gloss, class, tier, effect, color }
   Source of truth for entries is the Design Bible §3 tables (base + tier-2 chain targets). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.HanziSandbox = Object.assign(root.HanziSandbox || {}, { Recipes: factory() });
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Tier-1 base recipes — Design Bible §3, "Recipe Registry [LOCKED · growing]"
  var BASE_RECIPES = [
    { inputs: ["木", "木"], char: "林", pinyin: "lín", gloss: "woods", class: "Tool", tier: 1, effect: "woods", color: "#4A7C59" },
    { inputs: ["日", "月"], char: "明", pinyin: "míng", gloss: "bright", class: "Force", tier: 1, effect: "bright", color: "#E0A82E" },
    { inputs: ["火", "火"], char: "炎", pinyin: "yán", gloss: "flame", class: "Force", tier: 1, effect: "flame", color: "#D8472B" },
    { inputs: ["冫", "水"], char: "冰", pinyin: "bīng", gloss: "ice", class: "Force", tier: 1, effect: "ice", color: "#5FB6CE" },
    { inputs: ["氵", "目"], char: "泪", pinyin: "lèi", gloss: "tear", class: "Force", tier: 1, effect: "tear", color: "#4A78C2" },
    { inputs: ["人", "木"], char: "休", pinyin: "xiū", gloss: "rest", class: "State", tier: 1, effect: "rest", color: "#7BA05B" },
    { inputs: ["女", "子"], char: "好", pinyin: "hǎo", gloss: "good", class: "State", tier: 1, effect: "good", color: "#D98AA8" },
    { inputs: ["日", "生"], char: "星", pinyin: "xīng", gloss: "star", class: "Force", tier: 1, effect: "star", color: "#E8C04B" },
    { inputs: ["山", "石"], char: "岩", pinyin: "yán", gloss: "rock", class: "Tool", tier: 1, effect: "rock", color: "#7A736B" },
    { inputs: ["木", "子"], char: "李", pinyin: "lǐ", gloss: "plum", class: null, tier: 1, effect: "lore", color: "#B5455E" },
    { inputs: ["宀", "女"], char: "安", pinyin: "ān", gloss: "peace", class: "State", tier: 1, effect: "peace", color: "#9E8FC0" },
    { inputs: ["月", "月"], char: "朋", pinyin: "péng", gloss: "friend", class: "Creature", tier: 1, effect: "friend", color: "#4FA89B" },
    { inputs: ["口", "鸟"], char: "鸣", pinyin: "míng", gloss: "chirp", class: "Creature", tier: 1, effect: "chirp", color: "#6FB0D8" },
    { inputs: ["小", "大"], char: "尖", pinyin: "jiān", gloss: "sharp", class: "Tool", tier: 1, effect: "sharp", color: "#8A8F98" },
    { inputs: ["氵", "木"], char: "沐", pinyin: "mù", gloss: "wash", class: "Force", tier: 1, effect: "wash", color: "#6CC2C9" }
  ];

  // Tier-2 chain targets — Design Bible §3, "LEAN — to be playtested"
  // 朋+朋 -> 朋朋 added per D048 (LOCKED): coined ligature glyph, marked ✦coined in UI.
  var TIER2_RECIPES = [
    { inputs: ["林", "木"], char: "森", pinyin: "sēn", gloss: "forest", class: "Tool", tier: 2, effect: "forest", color: "#4A7C59" },
    { inputs: ["炎", "火"], char: "焱", pinyin: "yàn", gloss: "blaze", class: "Force", tier: 2, effect: "blaze", color: "#D8472B" },
    { inputs: ["冰", "水"], char: "凌", pinyin: "líng", gloss: "surge", class: "Force", tier: 2, effect: "surge", color: "#5FB6CE" },
    { inputs: ["明", "星"], char: "晶", pinyin: "jīng", gloss: "crystal", class: "Force", tier: 2, effect: "crystal", color: "#E0A82E" },
    { inputs: ["朋", "朋"], char: "朋朋", pinyin: "péng-péng", gloss: "two-friends", class: "Creature", tier: 2, effect: "link", color: "#2A8A7E", coined: true }
  ];

  var RECIPES = BASE_RECIPES.concat(TIER2_RECIPES);

  // Multiset key: order-independent (Design Bible §2 "Matching is multiset").
  function keyFor(inputs) {
    return inputs.slice().sort().join("+");
  }

  function buildIndex(recipes) {
    var index = new Map();
    recipes.forEach(function (r) {
      var key = keyFor(r.inputs);
      if (index.has(key)) {
        throw new Error("Duplicate recipe key in registry: " + key);
      }
      index.set(key, r);
    });
    return index;
  }

  return {
    BASE_RECIPES: BASE_RECIPES,
    TIER2_RECIPES: TIER2_RECIPES,
    RECIPES: RECIPES,
    keyFor: keyFor,
    buildIndex: buildIndex
  };
});
