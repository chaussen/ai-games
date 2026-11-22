# 同舟 · Glyph Isles 2D — side-view greybox

> The side-view experiment of `games/tongzhou-forge` (plan: that folder's `docs/forge/SIDE-VIEW.md`,
> decision FG-D019). The 3D game stays as it is (tag `forge-3d-2026-11-19`). Never import from it or
> any other game; this folder holds copies.

> **2026-11-22: upgrade planned, docs only.** After John's first playtest the isles, puzzle rules and cliffs are being redesigned:
> start at [`docs/upgrade/UPGRADE.md`](docs/upgrade/UPGRADE.md). **One Stroke (`?art=cut`) is obsolete**: it still loads, but it is
> frozen and no longer tested ([`docs/upgrade/OBSOLETE-ONE-STROKE.md`](docs/upgrade/OBSOLETE-ONE-STROKE.md)). The text below describes the game as it is today.

**This is the Tongzhou core** (Conjure and the crew, two looks). How it relates to the other Tongzhou folders:
[`../TONGZHOU.md`](../TONGZHOU.md). To start it for a room of phones: `board-2d` ([`../board/README.md`](../board/README.md)).

**Where a piece sits decides what it means**, now on the page: 日 set beside 月 on its left makes 明;
月 left of 日 makes nothing. 日 resting on 木 makes 杲 (sunrise); 木 on 日 makes 杳 (dusk). The isles are
seen from the side, so beside is touching left-right and on top is resting on top, and 轻功 chains
upward off walls, stones, gems and clouds.

**Status (2026-11-19):** greybox, one player, two isles, playable on a phone. It is built to answer gate
P2 (`docs/GREYBOX.md` §6). Start with **`docs/GREYBOX.md`**: every earlier finding and what this
build does about it, the knobs, the defect log and the known gaps.

**Look (2026-11-19):** the **ink scroll** (水墨江湖) is the default, built from Claude Design's boards
(`docs/design/`) to the plan in `docs/ART-DIRECTION.md` (§8 says what shipped and what is still
missing). The greybox stays for comparison: `?art=greybox`, or ☰ → Look.

**New hero (2026-11-20):** the ink scroll's player is Claude Design's redesigned 侠客 (`docs/design/Hero.dc.html`):
about four heads tall, a bun with a gilt hairpin, slim waist, robe split at the hips, wushu stances, no hat, no face,
no weapon. Eight poses (the run has two frames), and the sheet's four players (朱 single bun, 石青 twin buns, 石绿
crown, 藤紫 headband) are in `ink.js` ready for rooms; the game is still one player, so only the first shows, with the
gold rim. The pose data is generated: `node tools/hero-from-design.mjs` rereads the sheet and rewrites the
`<hero-poses>` block in `ink.js`. The figure is smaller than the old one (23 px at play size on the boards), so a held
stone is drawn lower in this look (renderer only; the sim's hold height is unchanged).

**One Stroke 一笔 (2026-11-19):** a second painted look, `?art=cut` (or ☰ → Look), built from Claude Design's
round 2 boards (`docs/design/one-stroke/`): paper, ink and vermilion, flat fills only, a hero drawn as the
strokes of 大. Same sim, same screen budget; the default stays the ink scroll until John has played both.

**Beta (2026-11-20): 21 isles**, one for every recipe in the content, in both looks. Start with
**`docs/BETA.md`**: the isle list, what each teaches, how it was checked, the defect log, known gaps and
playtest questions. New walls: **flames** (水 puts them out) and **shade** (any light melts it), next to
thorns (火 burns them). ☰ → Isle lists all 21 and marks the ones you have won (✓).

| # | Isle | Make | # | Isle | Make |
|---|---|---|---|---|---|
| 1 | Two Trees 双木成林 | 林 = 木 beside 木 | 12 | Partner 伙 | 伙 = 人 left of 火 |
| 2 | Sun and Moon 日月同明 | 明 = 日 left of 月 | 13 | Bathe 沐 | 沐 = 水 left of 木 |
| 3 | Dawn 杲 | 杲 = 日 on 木 | 14 | Leaf 叶 | 叶 = 口 left of 十 |
| 4 | Old Leaf 十口为古 | 古 = 十 on 口 | 15 | Stove 灶 | 灶 = 火 left of 土 |
| 5 | Friends 月月为朋 | 朋 = 月 beside 月 | 16 | Blaze 火火为炎 | 炎 = 火 on 火 |
| 6 | Lean on a Tree 人木为休 | 休 = 人 left of 木 | 17 | Forest 三木成森 | 森 = 木 on 林 |
| 7 | Early Light 早 | 早 = 日 on 十 | 18 | Crowd 三人成众 | 众 = 人 on 从 |
| 8 | Fruit Field 果 | 果 = 田 on 木 | 19 | Burn 焚 | 焚 = 林 on 火 |
| 9 | Red Earth 赤 | 赤 = 土 on 火 | 20 | Drench 淋 | 淋 = 水 left of 林 |
| 10 | Good 女子为好 | 好 = 女 left of 子 | 21 | Flourish 日日为昌 | 昌 = 日 on 日 |
| 11 | Apricot 杏 | 杏 = 木 on 口 | | | |

**Conjure: write a character (2026-11-21):** tap **书 shū WRITE** (laptop: **C**), write a character with your
finger, tap the guess, and its stone is in your hands. The pad reads your writing on the device against every
character in the game; an isle lets you write the characters lying on it (never its goal). Ink: 2 drops, one back
every 15 s; you keep two written stones (a third fades your oldest). One player for now; the sim gives each of four
players their own ink and colour. Plan, decisions, knobs and hand-off: **`docs/CONJURE.md`**.

**Writing isles (2026-11-21): 23 isles now.** Two isles where a piece lies nowhere, so you must write it:
**One Tree 书木成林** (isle 2, right after Two Trees: one 木, and a grove needs two) and **Water the Tree
书水为沐** (after Bathe: no 水 anywhere; the 水 you write puts out the flames, then goes left of 木 for 沐). On
them the WRITE button blinks until you write. `docs/CONJURE.md` §7a.

**The board (2026-11-21):** `/board` shows a big QR code for phones, with the look and profile in the link
(chips on the board switch them). **同舟 together** (the default) puts the phones in one crew and shows who has
joined; **each alone** gives every phone its own game. On the board machine, `board-2d` (the crew),
`board-2d-onestroke`, `board-2d-relaxed`, `board-2d-rough` (thrown stones knock friends back), `board-2d-alone`
and the rest in `../board/` start the server on port 3000 and open this page. Any mix: `board 2d cut relaxed push`.

**Co-op: the crew (2026-11-21):** on the board choose **同舟 together** (the default) and every phone that scans
the code joins **one isle**, up to four, each in their own colour with their own ink and pad (`/?crew=1`; `/` alone
is still solo). Players are bodies: walk into a friend to shove them, push back to block, jump on a friend's head
and ride along, stack three high. Lean on a friend for a second and you slip past, so nobody gets trapped. While you
write, the others play on, and everyone sees your strokes over your head. Thrown stones fly through friends, unless
the crew picks **knock a friend back** or **knock what they carry loose** (☰ or the board). Forging one character
together is a proposal for Claude Design, not built yet. Plan, decisions, knobs, wire protocol and hand-off:
**`docs/CO-OP.md`**.

**Automated play-testing (research, 2026-11-20):** `docs/AUTOTEST.md`: which technologies can see, operate and
play this game like a person, with spikes in `lab/autotest/`. Nothing in the game changed.

## Run it

```sh
cd games/tongzhou-forge-2d
node server.js                 # http://localhost:3300/
PORT=3000 node server.js       # on the machine where only port 3000 is open (phone playtests)
../board/board.sh 2d cut relaxed   # or board-2d-onestroke etc. once ../board/install.sh has run: server on 3000 + the board
```

Phones open `http://<LAN-IP>:3300/` (the server prints it), or `http://<LAN-IP>:3300/?crew=1` to join the crew (the
board's QR code does this). URL options: `?crew=1`, `?art=ink|cut|greybox`, `?isle=dawn` (an isle's id, or its number from 0),
`?profile=relaxed|standard|strict`, `?labels=all|near|card`, `?mute=1`, `?touch=1` (show the pad on
a laptop).

## Controls

☰ also holds **Look** (ink scroll, One Stroke or greybox).

Phone: the **stick** (touch anywhere in the lower left) walks; **跳 JUMP** jumps, and again in the air
is 轻功 (a leap); **拿 GRAB** picks up a stone, **书 WRITE** opens the writing pad (the isle waits while you write). Holding a stone, the GRAB button names the placement:
**旁 BESIDE** (facing a stone at your level: yours goes on your side of it), **上 ON TOP** (standing on
a stone, or in the air above one), **扔 THROW** (while walking), **放 SET DOWN** (standing still),
**落 DROP** (in the air), **献 OFFER** (at the pavilion with the character it wants). Lean on a stone to
push it. ☰: restart, isle, play profile (relaxed / standard / strict), pinyin on stones, sound, voice.

Laptop: ← → walk, Space / ↑ jump, X grab, C write (draw with the mouse; Enter takes the first guess), R restart, N / P isle, Esc menu.

轻功: one leap per charge. The ground gives a charge; touching something new in the air (a wall
face, the side of a stone, a gem, a cloud) gives another. Push into a wall to leap up it; anything
else kicks you off it. Carrying a stone you get one leap.

## Run tests

```sh
node sim-test.mjs        # rules, 轻功, forging, elements and walls, two scripted wins per isle (42; pure node)
node write-test.mjs      # the pad's recogniser on its stroke data (synthetic: not real handwriting)
node write-isle-test.mjs # real server on 3487: both writing isles in all three looks, written by real touches
node smoke-test.mjs      # real server on port 3481: what a phone may fetch, font coverage
node crew-test.mjs       # real server on 3489, WebSocket phones: join, bodies, writes, isle/knock, full crew, reconnect
node crew-check-test.mjs # real server on 3490 + crew-check.py: four headless phones in one crew, real touches, the board
node screen-test.mjs     # real server on 3482 + screen-check.py: eleven screens (phones, iPads, laptops), real touch, budget, contrast, screenshots
ART=greybox node screen-test.mjs   # the same for the greybox look
ART=cut node screen-test.mjs       # and for One Stroke
```

`screen-test.mjs` needs Python Playwright and `/usr/bin/chromium`; it writes
`screenshots/ink/*.jpg` (or `screenshots/greybox/`). No test uses port 3000. After adding a Chinese character to the page:
`~/.venv/bin/python tools/font.py <full MaShanZheng-Regular.ttf>` (see the tool's header).

## Home-network caveats

All devices on the same Wi-Fi; guest networks with client isolation will not work. Plain http, so no
wake lock: keep the phone awake. If a phone says **site can't be reached**, check the computer's
address (the server prints it) and that the firewall allows the port; where only 3000 is open, run
`PORT=3000 node server.js`. The game itself runs in the phone's browser, so once the page has loaded
a slow network does not make it lag.
