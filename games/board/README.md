# Board launcher (not a game)

Shortcuts for the computer that acts as the **board**: one command starts a Tongzhou game's server and opens
its board (a big QR code that phones scan). It only starts the games' own `server.js`; it imports nothing from
them and changes none of their files.

One game runs at a time, on **port 3000**, because that is the only port this machine's firewall opens.
Starting another game stops the one on 3000 first, but only if it is one of this repo's game servers. Anything
else on the port is left alone, and the script says so.

## Install the shortcuts (once)

```sh
cd games/board && ./install.sh          # ./install.sh --remove takes them away
```

This puts commands in `~/bin` and entries in the desktop menu (Games → "Board: ..."). They call `board.sh` in
this folder, so updating the repo updates them. It never needs a password.

| Command | Starts | Board |
|---|---|---|
| `board-2d` | Glyph Isles 2D **crew** (one isle, up to four phones), ink scroll 水墨 shuǐ mò, standard | `/board?art=ink&profile=standard&crew=1&knock=off` |
| `board-2d-onestroke` | the crew, One Stroke 一笔 yī bǐ | `/board?art=cut&profile=standard&crew=1&knock=off` |
| `board-2d-greybox` | the crew, greybox | `/board?art=greybox&profile=standard&crew=1&knock=off` |
| `board-2d-relaxed` | the crew, ink, relaxed (young children) | `/board?art=ink&profile=relaxed&crew=1&knock=off` |
| `board-2d-strict` | the crew, ink, strict | `/board?art=ink&profile=strict&crew=1&knock=off` |
| `board-2d-rough` | the crew, ink, thrown stones knock a friend back | `/board?art=ink&profile=standard&crew=1&knock=push` |
| `board-2d-alone` | Glyph Isles 2D, every phone its own game (as before the crew) | `/board?art=ink&profile=standard&crew=0` |
| `board-3d` | The Forge 3D (`games/tongzhou-forge`) | `/?board=1` |
| `board-3d-relaxed` | The Forge 3D, relaxed forge profile | `/?board=1&strict=relaxed` |
| `board-conjure` | Conjure (`games/tongzhou-conjure`) | `/?board=1` |
| `board-isles` | Glyph Isles 3D (`games/tongzhou-isles`) | `/?board=1` |
| `board-stop` | stops the game on port 3000 | |

Any other combination: `board 2d cut strict`, `board 2d greybox relaxed loose`, `board 2d alone`, `board 3d strict`,
`board status`, `board list`. The 2D words come in any order: a look (`ink`, `cut`, `greybox`), a profile
(`relaxed`, `standard`, `strict`), `crew` (the default) or `alone`, and what a thrown stone does to a friend
(`off`, the default, `push` or `loose`; see `../tongzhou-forge-2d/docs/CO-OP.md`).

In the 2D board you can also switch these with the chips on the page. The QR code changes straight away, with no
restart. In a crew the board shows who has joined (a dot in each player's colour) and which isle they are on. The
crew's profile and thrown-stone setting follow the board, and any phone can change them in ☰. The 3D games are
multiplayer too: their board also shows who has joined.

Since 2026-11-21, `board-2d` and its variants start a **crew**, so run `./install.sh` again to get `board-2d-rough`
and `board-2d-alone`.

## What it does

1. Stops the game server already on the port (only one from `games/`).
2. Starts the chosen game with `PORT=3000 HOST=0.0.0.0` in the background. The log goes to
   `~/.local/state/tongzhou-board/server-3000.log`.
3. Prints the board and phone addresses, with a QR code in the terminal (`qrencode`, if run from a terminal).
4. Opens the board in a Chromium app window (`BOARD_BROWSER` to use something else, `BOARD_OPEN=0` for none).

`PORT=3300 board 2d` runs on another port, for example beside a game already on 3000. Phones on the Wi-Fi only
reach the ports the firewall opens.

## Test

```sh
node smoke-test.mjs   # starts each game on test port 3488 (never 3000), checks the pages, switching, stop, refusals
```

## Home-network caveats

Phones must be on the same Wi-Fi as this computer (no guest network with client isolation). The QR code holds
the computer's current Wi-Fi address. If the address changes, start the board again. Plain http, so phones
may dim: keep them awake.
