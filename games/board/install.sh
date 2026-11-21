#!/usr/bin/env bash
# Install the board shortcuts for this user: small commands in ~/bin and entries in the desktop menu
# (Games → "Board: ..."). They all call board.sh in this folder, so a git pull updates them.
#   ./install.sh            install (again: it overwrites only files it made, marked "tongzhou-board")
#   ./install.sh --remove   take them away
set -euo pipefail
HERE=$(cd "$(dirname "$(readlink -f "$0")")" && pwd)
BIN=$HOME/bin
APPS=${XDG_DATA_HOME:-$HOME/.local/share}/applications
MARK="tongzhou-board"

# name | arguments to board.sh | menu label
SHORTCUTS=(
  "board-2d|2d ink standard|Board: Glyph Isles 2D (ink scroll)"
  "board-2d-onestroke|2d cut standard|Board: Glyph Isles 2D (One Stroke)"
  "board-2d-greybox|2d greybox standard|Board: Glyph Isles 2D (greybox)"
  "board-2d-relaxed|2d ink relaxed|Board: Glyph Isles 2D (ink, relaxed for young children)"
  "board-2d-strict|2d ink strict|Board: Glyph Isles 2D (ink, strict)"
  "board-3d|3d|Board: The Forge 3D"
  "board-3d-relaxed|3d relaxed|Board: The Forge 3D (relaxed)"
  "board-conjure|conjure|Board: Conjure"
  "board-isles|isles|Board: Glyph Isles 3D"
  "board-stop|stop|Board: stop the game server"
)

ours() { [ ! -e "$1" ] || grep -q "$MARK" "$1" 2>/dev/null; }

if [ "${1:-}" = "--remove" ]; then
  for s in "${SHORTCUTS[@]}"; do
    n=${s%%|*}
    for f in "$BIN/$n" "$APPS/$MARK-$n.desktop"; do ours "$f" && rm -f "$f" && echo "removed $f"; done
  done
  [ -L "$BIN/board" ] && [ "$(readlink "$BIN/board")" = "$HERE/board.sh" ] && rm -f "$BIN/board" && echo "removed $BIN/board"
  exit 0
fi

mkdir -p "$BIN" "$APPS"
chmod +x "$HERE/board.sh"
if [ -e "$BIN/board" ] && [ "$(readlink "$BIN/board" 2>/dev/null)" != "$HERE/board.sh" ]; then
  echo "skip $BIN/board: something else is there"
else
  ln -sfn "$HERE/board.sh" "$BIN/board"; echo "board        -> board.sh (any combination: board 2d cut relaxed)"
fi
for s in "${SHORTCUTS[@]}"; do
  IFS='|' read -r n args label <<< "$s"
  f=$BIN/$n
  if ! ours "$f"; then echo "skip $f: not made by this installer"; continue; fi
  printf '#!/usr/bin/env bash\n# %s: made by %s/install.sh\nexec "%s/board.sh" %s "$@"\n' "$MARK" "$HERE" "$HERE" "$args" > "$f"
  chmod +x "$f"
  d=$APPS/$MARK-$n.desktop
  if ours "$d"; then
    printf '[Desktop Entry]\n# %s\nType=Application\nName=%s\nExec=%s\nTerminal=false\nCategories=Game;\nIcon=applications-games\n' \
      "$MARK" "$label" "$f" > "$d"
  fi
  printf '%-19s -> board.sh %s\n' "$n" "$args"
done
case ":$PATH:" in *":$BIN:"*) ;; *) echo "Note: $BIN is not on your PATH; the menu entries still work." ;; esac
