#!/usr/bin/env bash
# The board launcher: start one of the Tongzhou games on this computer and open its board (a QR code for
# phones). See README.md here. One game at a time, on port 3000 (the only port this machine's firewall opens).
#
#   board.sh 2d [ink|cut|greybox] [relaxed|standard|strict] [crew|alone] [off|push|loose]
#                                                              Glyph Isles 2D (games/tongzhou-forge-2d), any order;
#                                                              crew (default): one isle for up to four phones;
#                                                              off|push|loose: what a thrown stone does to a friend
#   board.sh 3d [relaxed|standard|strict]                      The Forge 3D (games/tongzhou-forge)
#   board.sh conjure                                           Conjure (games/tongzhou-conjure)
#   board.sh isles                                             Glyph Isles 3D (games/tongzhou-isles)
#   board.sh stop | status | list
#
# Environment: PORT (default 3000), BOARD_OPEN=0 (do not open a window), BOARD_BROWSER (a command to open
# the board with; default: chromium as an app window, else xdg-open).
set -euo pipefail

HERE=$(cd "$(dirname "$(readlink -f "$0")")" && pwd)
GAMES=$(dirname "$HERE")
PORT=${PORT:-3000}
OPEN=${BOARD_OPEN:-1}
STATE=${XDG_STATE_HOME:-$HOME/.local/state}/tongzhou-board
mkdir -p "$STATE"
LOG="$STATE/server-$PORT.log"

say() { printf '%s\n' "$*"; }
die() { printf 'board: %s\n' "$*" >&2; exit 1; }

usage() { sed -n '5,14p' "$(readlink -f "$0")" | sed 's/^# \{0,1\}//'; }

# the process listening on PORT, if any
listener() { ss -ltnpH "sport = :$PORT" 2>/dev/null | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2 || true; }

# stop what serves PORT, but only if it is one of this repo's game servers; anything else is left alone
stop_port() {
  local pid cmd cwd
  pid=$(listener)
  [ -z "$pid" ] && return 0
  cmd=$(tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null || true)
  cwd=$(readlink "/proc/$pid/cwd" 2>/dev/null || true)
  if [[ "$cmd" == *server.js* && ( "$cmd" == *"$GAMES/"* || "$cwd" == "$GAMES/"* ) ]]; then
    say "Stopping the game already on port $PORT (pid $pid): ${cmd% }"
    kill "$pid"
    for _ in $(seq 1 30); do [ -z "$(listener)" ] && return 0; sleep 0.1; done
    kill -9 "$pid" 2>/dev/null || true
  else
    die "port $PORT is used by something that is not a game from this repo (pid $pid: ${cmd:-unknown}). Stop it yourself, or run with PORT=<another port>."
  fi
}

lan_ip() {
  local ip
  ip=$(ip -4 route get 1.1.1.1 2>/dev/null | grep -o 'src [0-9.]*' | cut -d' ' -f2 || true)
  [ -z "$ip" ] && ip=$(hostname -I 2>/dev/null | awk '{print $1}')
  printf '%s' "${ip:-localhost}"
}

open_board() {
  local url=$1
  [ "$OPEN" = "0" ] && return 0
  if [ -n "${BOARD_BROWSER:-}" ]; then
    setsid $BOARD_BROWSER "$url" >/dev/null 2>&1 < /dev/null &
  elif command -v chromium >/dev/null 2>&1; then
    setsid chromium --new-window --app="$url" --start-maximized >/dev/null 2>&1 < /dev/null &
  elif command -v xdg-open >/dev/null 2>&1; then
    setsid xdg-open "$url" >/dev/null 2>&1 < /dev/null &
  else
    say "Open this on the board screen: $url"
  fi
}

oneof() { local v=$1; shift; for o in "$@"; do [ "$v" = "$o" ] && return 0; done; return 1; }

start() {
  local game=$1 dir name board phone
  shift || true
  local ip; ip=$(lan_ip)
  case "$game" in
    2d)
      # words in any order: a look, a profile, crew or alone, and a knock (docs/CO-OP.md in that game)
      local art=ink profile=standard crew=1 knock=off w
      for w in "$@"; do
        if oneof "$w" ink cut greybox; then art=$w
        elif oneof "$w" relaxed standard strict; then profile=$w
        elif oneof "$w" crew together; then crew=1
        elif oneof "$w" alone solo; then crew=0
        elif oneof "$w" off push loose; then knock=$w
        else die "2d takes a look (ink, cut, greybox), a profile (relaxed, standard, strict), crew or alone, and a knock (off, push, loose); got '$w'"
        fi
      done
      dir=$GAMES/tongzhou-forge-2d
      if [ "$crew" = 1 ]; then
        name="Glyph Isles 2D, crew of up to four, $art, $profile, thrown stones: $knock"
        board="http://localhost:$PORT/board?art=$art&profile=$profile&crew=1&knock=$knock"
        phone="http://$ip:$PORT/?art=$art&profile=$profile&crew=1"
      else
        name="Glyph Isles 2D, each phone alone, $art, $profile"
        board="http://localhost:$PORT/board?art=$art&profile=$profile&crew=0"
        phone="http://$ip:$PORT/?art=$art&profile=$profile"
      fi ;;
    3d)
      local profile=${1:-}
      [ -z "$profile" ] || oneof "$profile" relaxed standard strict || die "profile must be relaxed, standard or strict (got '$profile')"
      dir=$GAMES/tongzhou-forge; name="The Forge 3D${profile:+, $profile}"
      board="http://localhost:$PORT/?board=1${profile:+&strict=$profile}"
      phone="http://$ip:$PORT/" ;;
    conjure)
      dir=$GAMES/tongzhou-conjure; name="Conjure"
      board="http://localhost:$PORT/?board=1"; phone="http://$ip:$PORT/" ;;
    isles)
      dir=$GAMES/tongzhou-isles; name="Glyph Isles 3D"
      board="http://localhost:$PORT/?board=1"; phone="http://$ip:$PORT/" ;;
    *) usage; exit 2 ;;
  esac
  [ -f "$dir/server.js" ] || die "no server at $dir"
  command -v node >/dev/null 2>&1 || die "node is not installed"

  stop_port
  say "Starting $name on port $PORT (log: $LOG)"
  # exec: the server replaces the subshell, so nothing is left holding this terminal
  (cd "$dir" && PORT=$PORT HOST=0.0.0.0 exec setsid node server.js > "$LOG" 2>&1 < /dev/null) &
  disown
  for _ in $(seq 1 50); do
    curl -fs -o /dev/null "http://localhost:$PORT/" 2>/dev/null && break
    sleep 0.1
  done
  curl -fs -o /dev/null "http://localhost:$PORT/" || { tail -5 "$LOG" >&2; die "the server did not start"; }
  printf '%s\n' "$game ${*:-}" > "$STATE/current-$PORT"

  say ""
  say "  $name"
  say "  Board:  $board"
  say "  Phones: $phone"
  if command -v qrencode >/dev/null 2>&1 && [ -t 1 ]; then qrencode -t ANSIUTF8 -m 1 "$phone"; fi
  say "  Stop with: board.sh stop"
  open_board "$board"
}

cmd=${1:-}
case "$cmd" in
  ""|-h|--help|help) usage ;;
  list) say "2d [ink|cut|greybox] [relaxed|standard|strict] [crew|alone] [off|push|loose], 3d [profile], conjure, isles" ;;
  stop) [ -z "$(listener)" ] && say "Nothing is running on port $PORT." || { stop_port; say "Stopped."; }; rm -f "$STATE/current-$PORT" ;;
  status)
    pid=$(listener)
    if [ -z "$pid" ]; then say "Nothing is running on port $PORT."
    else say "Port $PORT: pid $pid, $(tr '\0' ' ' < /proc/$pid/cmdline 2>/dev/null)"; [ -f "$STATE/current-$PORT" ] && say "Started as: board.sh $(cat "$STATE/current-$PORT")"; say "Phones: http://$(lan_ip):$PORT/"; fi ;;
  *) start "$@" ;;
esac
