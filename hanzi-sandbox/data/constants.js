/* hanzi-sandbox/data/constants.js — tunables for Design to adjust without touching engine code. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.HanziSandbox = Object.assign(root.HanziSandbox || {}, { Constants: factory() });
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  return {
    // D036: hint sparkle on radicals that complete an unlearned recipe. Design to tune.
    HINT_PULSE_MS: 1400,
    HINT_OPACITY: 0.35,
    // D042: sparkle must not fire until the player has been inactive (no deploy/fuse
    // action) for this long. Prevents the hint from preempting the semantic aha moment.
    HINT_DELAY_MS: 8000
  };
});
