# Beta: 21 isles, both looks

Built 2026-11-20 for John to playtest. It follows `GREYBOX.md` (gate P2) and the art work in `ART-DIRECTION.md`;
the sim, the controls and the screen budget have not changed. What is new: **19 more isles** (21 in all, up
from 2), **flames and shade** next to thorns, a hint when a stone cannot grow back, and the isle number and ✓
marks in ☰. Every isle plays in both looks: the ink scroll (default) and One Stroke (`?art=cut`, or ☰ → Look).

## 1. Design intent

- **Every recipe in the game has an isle.** The content has 24 recipes; 21 are an isle's goal, and the other
  three appear on the way (从 inside 众, 杳 the dusk on Dawn, 呆 the wrong order on Apricot).
- **Teach one thing at a time, in order:** beside, then on top, then order matters, then each element's
  effect, then characters made in two steps.
- **The stone's meaning does the work** (`forge-priority-visible-characters`): 木 bridges, 田 and 土 raise
  mounds, 火 burns thorns, 水 puts out flames, light melts shade, and the stronger characters (炎 焚 淋 昌,
  reach 2.6) work from across two cells of water where the plain ones (reach 1.3) cannot.
- **More than one way.** Every isle has two scripted winning routes (`routes.mjs`), and usually a decoy: the
  wrong order (十 left of 口), the mirror character (灶 for 赤, 叶 for 古, 呆 for 杏), or a throw instead of a
  carry.
- **Isles carry no numbers of their own** (FG-D003): the play profiles in ☰ apply to all 21.

## 2. The isles

| # | Isle | Goal | Recipe | New idea | Two ways (routes.mjs) |
|---|---|---|---|---|---|
| 1 | Two Trees 双木成林 | 林 grove | 木 beside 木 | BESIDE; a 3-gap 木 can bridge | carry 林 over with a leap / bridge first |
| 2 | Sun and Moon 日月同明 | 明 bright | 日 left of 月 | order beside; thorns, bridge, tower | (unchanged) |
| 3 | Dawn 杲 | 杲 sunrise | 日 on 木 | ON TOP; 木 on 日 is 杳, dusk | (unchanged) |
| 4 | Old Leaf 十口为古 | 古 old | 十 on 口 | climb a tower; 十 beside 口 is a dud or 叶 | stand on 口 / dud, then drop from a jump |
| 5 | Friends 月月为朋 | 朋 friend | 月 beside 月 | a cloud chain up a pillar | carry it down / throw it down |
| 6 | Lean on a Tree 人木为休 | 休 rest | 人 left of 木 | **flames**: 水 puts them out | carry 水 to them / throw 水 |
| 7 | Early Light 早 | 早 early | 日 on 十 | **shade**: light melts it | melt it with 日 first / make 早 and carry it through |
| 8 | Fruit Field 果 | 果 fruit | 田 on 木 | 田 raises a mound in a gap | leap the gap / mound first |
| 9 | Red Earth 赤 | 赤 red | 土 on 火 | 火 beside 土 is a stove 灶, which also burns | 火 burns, then 赤 / 灶 first, then 赤 |
| 10 | Good 女子为好 | 好 good | 女 left of 子 | the goal itself is light: it melts the shade | right side / wrong side first |
| 11 | Apricot 杏 | 杏 apricot | 木 on 口 | order on top: 口 on 木 is 呆 | 杏 / 呆 first, clear its spot, then 杏 |
| 12 | Partner 伙 | 伙 partner | 人 left of 火 | a low hedge you can burn or leap | burn first / leap with 伙 |
| 13 | Bathe 沐 | 沐 bathe | 水 left of 木 | the goal is water: it puts out the flames | carry 沐 through / bridge, douse, then 沐 |
| 14 | Leaf 叶 | 叶 leaf | 口 left of 十 | cloud chain; 十 on 口 would be 古 | right side / wrong side first |
| 15 | Stove 灶 | 灶 stove | 火 left of 土 | the goal is fire: it burns the hedge | carry 灶 through / mound first |
| 16 | Blaze 火火为炎 | 炎 blaze | 火 on 火 | **reach**: thorns across water; one 火 is too short | make 炎 / throw a 火 at them |
| 17 | Forest 三木成森 | 森 forest | 木 on 林 | two steps; a 5-gap only 林 bridges | grove bridge first / 森 first |
| 18 | Crowd 三人成众 | 众 crowd | 人 on 从 (人 beside 人) | two steps, three 人 | stand on 从 / drop from a jump |
| 19 | Burn 焚 | 焚 burn | 林 on 火 | two steps; 焚 reaches across water | 林 to 火 / burn the low hedge first |
| 20 | Drench 淋 | 淋 drench | 水 left of 林 | two steps; 淋 reaches across water | make 淋 / throw 水 at the flames |
| 21 | Flourish 日日为昌 | 昌 flourishing | 日 on 日 | 昌 melts shade across water | stand on 日 / drop from a jump |

Night and dusk skies alternate. Maps are 36 to 46 cells wide and 10 to 15 high, like the first two.

## 3. What changed in the code

- `sim.js`: `F` (flames, doused by water) and `S` (shade, dispelled by light) are walls like `T`: solid,
  found as vertical runs, removed when a stone of the right element comes within its reach, carried, lying or
  thrown. Flames throw you back like thorns; shade only blocks. Neither refills 轻功. `burnt` records which
  kind went. A spring whose spot is covered for 8 s says so once (3 s fired during ordinary play, when 林 was made on a 木 spot and about to be picked up) (`springBlocked`).
- `ink.js`, `cut.js`, `app.js` (greybox): flames and shade in each look. Ink: vermilion tongues with gamboge
  hearts, flickering; a curtain of violet-black wash. One Stroke: flat vermilion teeth that step, not fade; a
  flat ink-45% block with paper slits. Renderer only.
- `app.js`: messages and effects for `douse`, `dispel`, `springBlocked`; the ouch line names thorns or
  flames; the title card says "Isle n of 21"; ☰'s isle list marks isles won on this device with ✓.
- `bot.mjs`: `S.go(x, { land })` walks like a person (jumps a step, a stone, a gap; leaps at tall walls and
  over water; presses into walls to climb them); `S.take(ch, near)` walks there first.
- `routes.mjs`: every isle's routes, moved out of `sim-test.mjs` so the play check can share them.
- `play-test.mjs` + `tools/play-check.py` (new): the first route of every isle played inside the real page
  at real speed, in one look; fails on a lost isle or a console error; saves each win card to
  `screenshots/play/<look>/`.
- `sim-test.mjs`: walls (flames hurt and go out, shade blocks without hurting, reach across water), the
  blocked-spring hint, two winning routes per isle (checked), the goal makeable in one step or several.

## 4. How it was checked

- `node sim-test.mjs`: 293 checks, including **42 scripted wins** (two per isle) pressing only what a person
  could press. About 1 s.
- `node smoke-test.mjs`: the real server on port 3481; font covers every character shown.
- `node screen-test.mjs` (ink), `ART=cut`, `ART=greybox`: eleven screens each, real touch, the screen budget.
- Screenshots of every isle in both looks on a phone held sideways (three points along each isle), from the
  running build, looked at one by one.
- In-page playthrough (the play check's script): **21 of 21 isles won in the ink look and 21 of 21 in One
  Stroke**, at real speed, no console errors. The One Stroke run, made after the 8 s change, shows no "waiting
  to grow back" line on any isle.

## 5. Defect log (found while building)

| Found by | Defect | Fix |
|---|---|---|
| route bot | Standing on the stone you came for counted as "not arrived" (you were 0.9 higher than the ground) | `land` means "at least this high" |
| route bot | Carrying a stone, a jump started 0.6 from a two-high hedge hit the thorns before it rose | take off 1.9 away from a tall wall, leap as soon as it is in reach |
| route bot | A thrown 水 or 火 burned the far wall and flew on to the far bank, not into the channel | throwing is a real way across: the routes go and fetch it |
| route bot (Forest) | A 林 thrown at the gap landed on the 森 left beside it: 林 on 森, a dud | the route leaves 森 out of the way; for players, the frame and dud line already explain it |
| route bot (Apricot, Red Earth) | A character forged on a stone's spot (呆 on 木's, 灶 on 火's) kept that stone from ever growing back, silently: a likely stuck moment for a child | after 8 s: "木 is waiting to grow back: clear its spot" (`springBlocked`; 3 s fired in ordinary play, found by the play check) |
| route bot (Lean on a Tree) | GRAB beside a stone is BESIDE, so a throw from next to 木 is impossible there | routes throw from a step further away (the sim is right) |

## 6. Known gaps

- **Nobody has played these isles yet.** The routes prove each isle can be won, not that it is fun, fair or
  in the right order. The order in §2 is a first guess.
- Isles 4 to 21 are built from the same parts (ground, gaps, walls, towers, clouds); none has the hand-shaped
  terrain of a finished level.
- Many isles are long walks back and forth; there is no shortcut, timer, star or score beyond time and gems.
- Gems are optional; they are placed along the way, not tested for reachability (the clouds' are).
- One player only, as before. The ✓ marks live in this browser only.
- The ink look's flames and shade are not from Claude Design's boards; they follow the ink and One Stroke
  rules (flat fills in One Stroke, no gradients) but are my drawings. Worth a Design pass if they stay.
- Characters other than 木 火 日 月 水 土 still have no "thing" when thrown or carried (`things.js`).
- **A flaky screen check (test, not game):** "jump + leap with a stone" wants a rise of 3.0. The sim gives
  3.3 to 3.5 for any press length, but in the page a synthetic touch on a slow frame (about 40 fps) can cut
  the first jump short, giving 3.00 to 3.26. It failed once on two iPads in the greybox look, then passed
  twice on rerun. It predates this beta (jump physics unchanged). Fix later: press the first jump inside the
  page, like the leap, or test the leap's added height rather than the total.

## 7. Playtest questions for John

1. Which isles were fun, which were chores? Are 21 too many for one sitting?
2. Is the order right: does each isle teach what the next one needs?
3. Do flames and shade read at a glance, in both looks? Do the reach isles (16, 19, 20, 21) make sense
   without being told?
4. The decoys (灶, 呆, 叶, 古): fun surprises or frustrating?
5. Ink scroll or One Stroke, now that both have 21 isles?
