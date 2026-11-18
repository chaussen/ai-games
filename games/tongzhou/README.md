# 同舟 · Same Boat — visual toy V0.2

Fingerprint `TZ-V0.2-1`. Built from `docs/visual-toy-brief-v2.md` (governed by
`docs/charter-v1.md`). One device, one player or two sharing. No network, no split
hands, no inking, no tones: this is a toy that answers one question, not the game.

**The question:** do the river, the queue of arrivals, troubles piling onto the boat and
spending a character on them read clearly and feel tense and satisfying? And can a fresh
player work out forging in under a minute without being told?

## Run

```sh
cd games/tongzhou
python3 -m http.server 8080      # any static server; no install, no internet
```

Open `http://localhost:8080/`. On a phone on the same Wi-Fi use the PC's LAN address.

| URL option | Effect |
|---|---|
| `?seed=11` | Same river every time (the seed shows in the top-right corner) |
| `?minutes=8` | Run length; default 5 |
| `?renderer=text` | Text-only river view (the swap test) |
| `?nodemo=1` | Skip the first-load ghost hand |

## Controls

- **Forge.** Tap or drag a tile into the square. Tap a second tile, then tap where it
  goes: left, right, above, below, or on the first tile (inside). Or drag it there.
  Tap the tile in the square to take it back.
- **Spend.** Tap a character in the hold, then a trouble aboard or the nearest thing
  ahead, in the river view or in the ABOARD / AHEAD lists.
- **Overboard.** With a held character selected, `overboard` releases it for its
  radical's default effect. A full hold blocks the forge (SRS FR-309).
- **⚙** top-left: forgiving placement, hit-every-trouble, river-provides, record, replay.

## Files

| File | Role |
|---|---|
| `engine.js` | Every rule. No DOM. Tunables in `T` at the top. |
| `content.js` | Tiles, seed characters, encounters, matrix, defaults from `docs/content-seed-v1.md` |
| `wild-seed.json` | The 107 real characters the 27 tiles can make |
| `controls.js` | All DOM and input |
| `renderer-canvas.js` | River view: plain 2D canvas, chosen because it needs no library and draws at full device resolution |
| `renderer-text.js` | Second, trivial renderer for the swap test |
| `self-test.mjs` | Brief §7 checks against the real engine: `node self-test.mjs` |
| `docs/` | Charter, SRS, build plan, content seed, brief |

## Verified

- `node self-test.mjs`: 21 checks pass (相, forgiveness on and off, 呆 and 杏, consumed,
  full hold, bogged and freed, chips, all 107 characters, 3000 random actions never stall,
  record, no verdict words).
- Headless Chromium, phone and desktop sizes: no console errors, no outside requests;
  the ghost hand, tap forge, drag forge, spending from the list and from the river view,
  and the end screen were all driven for real. Captures are in `screenshots/`.
- Not done: no human has played it, and it has not run on a real phone.

## Where it departs from the brief, and open questions for John

1. **`clearGain` (new tunable, 2 气).** The brief says 气 recovers only with nothing
   aboard, and also that clearing one of several troubles makes a bogged boat move.
   Both cannot hold, so clearing a trouble aboard now gives 2 气. Set it to 0 for the
   literal rule.
2. **Four troubles never pile up on their own.** With the brief's numbers one unanswered
   trouble drains 气 to 0 in 60 s, and the boat covers under 360 m in that time, so it
   bogs with one or two aboard. The pile only grows if the crew keeps clearing some.
3. **Fire and the gate have one solving seed character each** (河, 请). The matrix has
   three solving tags for most encounters, but few seed characters carry them.
4. **Fog and night are done in the engine**: far things reach the renderer as a veiled
   disc with no label, so the renderer still holds no rule.
5. **呆's "5 s no input" backfire is not built**; it uses the standard backfire
   (double drain for 10 s). Taking control away is dead time.
6. **No style frame** was supplied (brief §8), so the look is a placeholder.
7. English outcome lines for matrix cells without bracket text are placeholders.

## Home-network caveats

Static files only. Phones need to reach the PC's port: same Wi-Fi, no guest or
client-isolated network, and the port open in the PC firewall.
