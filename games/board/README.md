# Board launcher: start a Tongzhou game for a room of phones

This folder is not a game. It holds the **startup scripts** for the computer that acts as the **board**: the
screen everyone can see. One command does the following:

- starts a Tongzhou game's server
- opens its board page (a big QR code)
- prints the address for phones

It only starts each game's own `server.js`. It imports nothing from the games and changes none of their files. A
map of all the Tongzhou work is in [`../TONGZHOU.md`](../TONGZHOU.md).

| File | What it is |
|---|---|
| `board.sh` | the launcher: start, stop and status |
| `install.sh` | puts short commands in `~/bin` and entries in the desktop menu, all calling `board.sh` |
| `smoke-test.mjs` | the launcher's test (port 3488) |

## Quick start

```sh
cd games/board && ./install.sh     # once; again after a repo update that adds shortcuts
board-2d                           # or Games menu → "Board: Glyph Isles 2D (crew, ink scroll)"
```

This is what happens:

1. The board window opens with a QR code.
2. Each child scans it with their phone camera. The phone opens the game and joins the crew (up to four).
3. The board lists who has joined, each with a dot in their colour, and the isle they are on.

When you are done, run `board-stop` (or Games menu → "Board: stop the game server").

## The shortcuts

`./install.sh` installs these. Each one is `board.sh` with fixed words, so `board-2d-rough` is the same as
`board 2d ink standard crew push`.

**Glyph Isles 2D**: the main game (`games/tongzhou-forge-2d`).

| Command | Menu label | What you get |
|---|---|---|
| `board-2d` | Board: Glyph Isles 2D (crew, ink scroll) | **Start here.** One isle shared by up to four phones; ink scroll 水墨 look; standard rules; thrown stones pass through friends |
| `board-2d-onestroke` | … (crew, One Stroke) | the same in the other look, One Stroke 一笔 (cut paper) |
| `board-2d-relaxed` | … (crew, ink, relaxed for young children) | gentler rules: stones join from further off, longer 轻功 chains, more ink for writing, slip past a friend sooner |
| `board-2d-strict` | … (crew, ink, strict) | stricter rules: placement must be close to exact, shorter 轻功 chains, less ink, no jump help |
| `board-2d-rough` | … (crew, thrown stones knock friends back) | a thrown stone knocks a friend back (`push`) |
| `board-2d-alone` | … (every phone its own game) | no crew: each phone plays its own isle, as before 2026-11-21 |
| `board-2d-greybox` | … (crew, greybox) | the plain test look (boxes and labels); for checking rules, not for children |

**Other Tongzhou builds**: kept and runnable, but no longer developed (see `../TONGZHOU.md`).

| Command | Starts |
|---|---|
| `board-3d` | The Forge 3D (`games/tongzhou-forge`), standard forge rules |
| `board-3d-relaxed` | The Forge 3D, relaxed forge rules |
| `board-conjure` | the 3D Conjure prototype (`games/tongzhou-conjure`) |
| `board-isles` | Glyph Isles 3D V0.5 (`games/tongzhou-isles`) |

**Stopping**

| Command | Does |
|---|---|
| `board-stop` | stops the game on port 3000 |

## Any combination: `board`

`install.sh` also links `~/bin/board` to `board.sh`, so any mix works from a terminal:

```sh
board 2d                       # = board-2d
board 2d cut relaxed           # One Stroke, relaxed, crew
board 2d loose strict          # the words come in any order
board 2d alone greybox
board 3d strict
board status                   # what runs on the port, how it was started, the phone address
board list                     # the games and their words
board stop
board help                     # the usage text
```

The words for `2d` are below. Leave a word out to get its default.

| Kind | Words | Default | Meaning |
|---|---|---|---|
| Look | `ink`, `cut`, `greybox` | `ink` | ink scroll 水墨; One Stroke 一笔 (cut paper); plain boxes for testing. Ink and One Stroke are both kept because the style is not decided yet |
| Rules | `relaxed`, `standard`, `strict` | `standard` | the play profile: how forgiving the forge, 轻功, jumping, the writing pad and the bodies are (the knob tables in `tongzhou-forge-2d/sim.js`) |
| Players | `crew` (or `together`), `alone` (or `solo`) | `crew` | crew: one shared isle, up to four phones, bodies that bump. Alone: every phone its own game |
| Thrown stones | `off`, `push`, `loose` | `off` | what a thrown stone does to a friend it hits. `off`: passes through. `push`: knocks them back. `loose`: knocks them back and they drop what they hold. The crew chooses this; it never comes from the play profile |

An unknown word is refused with the list above. For `3d` the only word is a rules profile (`relaxed`, `standard`
or `strict`). `conjure` and `isles` take no words.

## On the board page and the phones (2D)

- **Chips on the board** change the look, the rules, crew or alone, and thrown stones. The QR code changes at once
  with no restart.
- **In a crew**, the rules and the thrown-stones setting are the crew's. A change on the board goes to the server
  and to every phone. Any phone can also change them in ☰.
- **The look is per phone.** It comes from the QR link. Each child can switch it in ☰ without affecting anyone
  else.
- **A fifth phone** is told "the crew is full" and plays alone on its own isle.
- **A phone that drops out** keeps its place and colour for 30 seconds. Reloading the page in that time rejoins as
  the same player.
- With no phone joined, the crew's isle stands still.

Details of the crew (bodies, knock, wire protocol): `../tongzhou-forge-2d/docs/CO-OP.md`.

## What `board.sh` does, step by step

1. **Frees the port.** Whatever listens on the port must be a `server.js` from this repo's `games/` (checked by its
   command line and working folder). If so, it is stopped (TERM, then KILL after 3 s). If anything else is there,
   `board.sh` stops with a message and leaves it alone.
2. **Starts the game.** It runs `PORT=3000 HOST=0.0.0.0 node server.js` in the game's folder, detached from the
   terminal (`setsid`), so closing the terminal does not stop it. Then it waits up to 5 s for the page to answer.
3. **Remembers the start command** in `~/.local/state/tongzhou-board/current-3000` (`board status` shows it).
   The server log is `~/.local/state/tongzhou-board/server-3000.log`.
4. **Prints the board and phone addresses**, and a QR code in the terminal when `qrencode` is installed and the
   output is a terminal.
5. **Opens the board** as a Chromium app window, maximised. Without Chromium it uses `xdg-open`.

One game runs at a time on a port. Starting another one replaces it.

| Setting | Default | Use |
|---|---|---|
| `PORT` | `3000` | `PORT=3300 board 2d` runs beside a game already on 3000. Phones only reach ports the firewall opens, and on this machine that is 3000 |
| `BOARD_OPEN` | `1` | `BOARD_OPEN=0` starts the server without opening a window (for a remote shell) |
| `BOARD_BROWSER` | (Chromium app window) | the command that opens the board, e.g. `BOARD_BROWSER=firefox` |

Addresses, for checking by hand (2D):

```
Board:  http://localhost:3000/board?art=ink&profile=standard&crew=1&knock=off
Phones: http://<this computer's Wi-Fi address>:3000/?art=ink&profile=standard&crew=1
```

## Installing and removing the shortcuts

```sh
./install.sh            # install, or refresh after a repo update
./install.sh --remove   # remove every shortcut and menu entry it made
```

- It writes the small scripts to `~/bin/board-*` and the menu entries to
  `~/.local/share/applications/tongzhou-board-*.desktop` (Games menu).
- Every file it makes carries the mark `tongzhou-board`. It overwrites or removes only marked files. If a file of
  the same name is not its own, it prints `skip` and leaves it.
- The scripts call `board.sh` in this folder, so updating the repo updates what they do. Run `./install.sh` again
  only when new shortcuts are added.
- It needs no password. If `~/bin` is not on your `PATH`, it says so; the menu entries work anyway.

To add a shortcut, add a line to `SHORTCUTS` in `install.sh` (`name|words for board.sh|menu label`), run
`./install.sh`, and add it to the tables here and in `smoke-test.mjs`.

## When something goes wrong

| What you see | Why, and what to do |
|---|---|
| `port 3000 is used by something that is not a game from this repo` | Another program has the port. `board.sh` will not stop it. Stop it yourself, or run `PORT=<other> board 2d` |
| `the server did not start` | The last lines of the server log are printed. The full log is `~/.local/state/tongzhou-board/server-3000.log` |
| A phone says "site can't be reached" | The phone is not on the same Wi-Fi, or it is on a guest network that keeps devices apart, or the computer's address changed. Run `board status` to see the current phone address, or start the board again for a new QR code |
| A phone shows "Playing alone: …" | The crew is full (four), or the phone lost the server. Reload the page to try again |
| A new shortcut is missing from the menu | Run `./install.sh` again |
| Phones dim and drop out | Plain http gets no wake lock. Keep the screens awake. A dropped phone has 30 s to come back as itself |

## Test

```sh
node smoke-test.mjs   # 31 checks on test port 3488 (never 3000)
```

It starts each game through `board.sh` and checks that:

- the pages load, and the crew answers
- the 2D words map to the right links, in any order
- a running game is switched
- `stop` and `status` work
- a non-game process on the port is refused and left running

## Home-network caveats

- Phones must be on the same Wi-Fi as the computer. A guest network that keeps devices apart (client isolation) will
  not work.
- The QR code holds the computer's Wi-Fi address at start time. If that address changes, start the board again.
- Plain http, so phones may dim the screen: keep them awake.
