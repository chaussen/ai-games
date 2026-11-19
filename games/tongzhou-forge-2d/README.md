# 同舟 · Glyph Isles 2D — side-view greybox

> The side-view experiment of `games/tongzhou-forge` (plan: that folder's `docs/forge/SIDE-VIEW.md`,
> decision FG-D019). The 3D game stays as it is (tag `forge-3d-2026-11-19`). Never import from it or
> any other game; this folder holds copies.

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

| Isle | Make | Ways |
|---|---|---|
| Sun and Moon · 日月同明 | 明 = 日 left of 月 | 木 bridges the gap and 火 burns the thorns, or leap both; 日 waits on a tower you climb with 轻功 |
| Dawn · 杲 | 杲 = 日 on 木 | Stand on 木 holding 日, or drop 日 on it from a jump; 木 on 日 makes 杳: dusk, and a glow-gem up a cloud chain |

## Run it

```sh
cd games/tongzhou-forge-2d
node server.js                 # http://localhost:3300/
PORT=3000 node server.js       # on the machine where only port 3000 is open (phone playtests)
```

Phones open `http://<LAN-IP>:3300/` (the server prints it). URL options: `?art=ink|cut|greybox`, `?isle=dawn`,
`?profile=relaxed|standard|strict`, `?labels=all|near|card`, `?mute=1`, `?touch=1` (show the pad on
a laptop).

## Controls

☰ also holds **Look** (ink scroll or greybox).

Phone: the **stick** (touch anywhere in the lower left) walks; **跳 JUMP** jumps, and again in the air
is 轻功 (a leap); **拿 GRAB** picks up a stone. Holding a stone, the GRAB button names the placement:
**旁 BESIDE** (facing a stone at your level: yours goes on your side of it), **上 ON TOP** (standing on
a stone, or in the air above one), **扔 THROW** (while walking), **放 SET DOWN** (standing still),
**落 DROP** (in the air), **献 OFFER** (at the pavilion with the character it wants). Lean on a stone to
push it. ☰: restart, isle, play profile (relaxed / standard / strict), pinyin on stones, sound, voice.

Laptop: ← → walk, Space / ↑ jump, X grab, R restart, N / P isle, Esc menu.

轻功: one leap per charge. The ground gives a charge; touching something new in the air (a wall
face, the side of a stone, a gem, a cloud) gives another. Push into a wall to leap up it; anything
else kicks you off it. Carrying a stone you get one leap.

## Run tests

```sh
node sim-test.mjs        # rules, 轻功, forging, elements, two scripted wins per isle (pure node)
node smoke-test.mjs      # real server on port 3481: what a phone may fetch, font coverage
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
