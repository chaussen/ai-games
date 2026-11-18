You design one stage ("isle") for a co-op game that teaches Chinese characters to English speakers.
Answer with ONE JSON object and nothing else. No markdown, no comments.

## The game
2-16 players arrive by boat. A pavilion on the isle wants one character (`want`). Players carry
character stones; two stones set side by side join into a new character. Bringing the wanted
character to the pavilion wins.

## What players can do
- Walk; jump 1 height up; jump across 2 cells of water (1 cell when carrying a stone).
- Leap (second jump in mid-air) across up to {{LEAP}} cells of water, with empty hands only.
- Boost a friend, stone and all, over a gap of up to 3 cells.
- Throw a wood stone into a gap between two floors: 木 bridges up to 3 cells, 林 5, 森 7.
- Carry a fire stone to a thorn wall to burn it; a water stone to a flame wall to douse it.
- Hold a plate so a lift rises with a friend on it.
- Row the boat along open water and bump it against any shore of height 1.

## Characters you may use (and nothing else)
{{GLYPHS}}

## Joining
{{RECIPES}}

## The JSON fields
- "id": lowercase-with-hyphens, new. "name": English title, 3-24 letters. "cn": 1-6 Chinese characters.
- "par": target seconds (60-200). "pal": one of dawn, mint, dusk, citrus, night.
- "want": the one character the pavilion wants. It must be MADE by joining; do not place it as a stone.
- "hint": 20-200 characters of plain English. It may show only characters that are on this isle.
- "map": array of strings, one per row, all the same length (6-26), 3-14 rows.
  "." is water. "1"-"9" is floor of that height. Keep most floor at height 1.
- "spawn": [x, z] where the crew lands. "beacon": [x, z] the pavilion. Far apart.
  A position [x, z] is in map cell column floor(x), row floor(z). Use centres: 4.5 not 4.
- "boat": {"rect": [x, z, w, d], "from": [0, 11], "to": [0, -15]}. rect is whole numbers, 3 by 3,
  entirely on "." cells, sharing an edge with the floor around the spawn.
- "stones": [["木", x, z], ...] 2-6 stones on floor cells, one per cell, not on the spawn cell.
- "movers" (optional):
  a wall: {"id": "hedge", "kind": "thorn" or "flame", "rect": [x, z, w, d], "from": 3.6, "to": 1}
  a lift: {"id": "lift", "rect": [x, z, w, d], "from": 1, "to": 3, "when": ["A"], "c": 0}
  The map must be "." under every mover.
- "plates" (optional, only with a lift): [{"id": "A", "at": [cellX, cellZ], "c": 0}]
- "gems": exactly three [x, z] on floor cells. "trees" (optional): [x, z] on floor cells, decoration.

## Rules a judge will check by playing your stage
1. Two players must be able to win.
2. There must be at least TWO different ways through (for example: bridge the gap OR boost over it;
   burn the thorns OR row round them).
3. Something must be in the way: a gap, thorns, flames or a cliff with a lift.

## Your brief
{{BRIEF}}

## Two stages that pass
{{EXAMPLES}}
