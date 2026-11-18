# Stage format

One stage is one JSON file. Shipped stages are in `content/stages/`, in the order given by
`content/order.json`. New stages start in `content/candidates/`.

`node tools/judge.mjs <file>` is the authority. If this page and the judge disagree, the judge is right.

```json
{
  "id": "two-trees",
  "name": "Two Trees",
  "cn": "双木成林",
  "par": 45,
  "pal": "dawn",
  "want": "林",
  "hint": "Mist has closed the river. Bring the pavilion its character. ...",
  "map": [
    "22............",
    "1111...1111111",
    "1111...1111111",
    "1111...1111111",
    "...........11."
  ],
  "spawn": [12.5, 2.5],
  "beacon": [1.5, 2.5],
  "boat": {"rect": [14, 1, 3, 3], "from": [0, 11], "to": [0, -15]},
  "stones": [["木", 9.5, 1.5], ["木", 9.5, 3.5]],
  "gems": [[5.5, 2.5, 2.4], [12.5, 4.5], [0.5, 0.5]],
  "trees": [[1.5, 0.5], [13.5, 1.5]]
}
```

## Coordinates

`map[z][x]`: `x` counts columns from the left, `z` counts rows from the top. A position `[x, z]`
lies in cell `[floor(x), floor(z)]`; use `.5` to stand in the middle of a cell.

## Fields

| Field | Meaning |
|---|---|
| `id` | file name without `.json`. Lowercase, digits, hyphens. |
| `name`, `cn` | English title (3-24 characters); Chinese title (1-6 characters). |
| `par` | target time in seconds. The judge suggests a value. |
| `pal`, `dawn` | palette: `dawn` `mint` `dusk` `citrus` `night`. `dawn` (optional) is the palette the isle turns to when a light character wins. |
| `want` | the character the pavilion wants. |
| `hint` | 20-200 characters of English. May show only characters that can exist on this isle. |
| `map` | `.` water, `1`-`9` floor of that height, `<` `>` `^` `v` a ramp rising toward -x, +x, -z, +z. |
| `spawn`, `beacon` | where the crew lands; where the pavilion stands. Both on flat floor. |
| `boat` | `rect` `[x, z, w, d]`: the deck when moored, on water, sharing an edge with the landing. `from`, `to`: offsets it sails in from and out to. |
| `stones` | `["character", x, z]`. A used-up stone grows back where it started. |
| `movers` | a wall `{"id","kind":"thorn"|"flame","rect","from":3.6,"to":1}` or a lift `{"id","rect","from","to","when":["plateId"],"c":0-3}`. The map is `.` under a mover. |
| `plates` | `{"id","at":[cellX, cellZ],"c":0-3}`. A plate is held by a player, a crate or a stone. |
| `crates`, `gems`, `trees` | `[x, z]` each (a gem over water is `[x, z, y]`). |

## What players can do (measured by the judge in the real game)

| Move | Reach |
|---|---|
| Jump | 1 up; across 2 cells of water; across 1 cell while carrying |
| Leap (jump again in the air, empty hands, 4 s recharge) | across 5 cells of water |
| Boost a friend (stone and all) | over a gap of up to 3 cells |
| Wood stone thrown into a gap | 木 bridges 3 cells, 林 5, 森 7 |
| Fire stone near thorns, water stone near flames | the wall sinks for good |
| Plate + lift | one holds, one rides |
| Row the boat | along open water; it stops against land |

## What the judge demands

1. The file has the right shape (`unknown-field`, `missing-field`, `bad-value`).
2. Everything stands on floor, the boat floats beside the landing, walls have a matching stone,
   the wanted character can be made from the stones.
3. Two bots finish the stage **in the real simulation** (`unsolved` if they cannot).
4. There are **two different ways** through (`one-way`), and something is in the way (`no-obstacle`).

Every problem comes with a sentence saying what to change. Fix those and run the judge again.
