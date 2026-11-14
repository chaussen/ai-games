# ✦ Firefly Relay · 萤火接力

> **A one-button, no-install, no-internet co-op game for the living room.**
> One screen is the night sky; every phone (or laptop) is a lantern. A single spark
> travels from lantern to lantern — tap when yours lights up, and the whole family
> keeps the chain alive.

This folder is a **research-backed design pitch + working prototype**. It is
self-contained and deliberately isolated: it does **not** touch index.html,
game/*, or any other file of the 学字坊 character game in this repo.

---

## 1. The idea in 30 seconds

Think **Spaceteam's "everyone shouts together"** energy crossed with **the
one-tap simplicity of a rhythm game** — but no losers, no reading, no downloads.

| | |
|---|---|
| **Players** | 2–8, mixed ages (works with a 5-year-old and a grandparent at the same table) |
| **Devices** | One PC/TV is the shared sky; phones, tablets and other laptops are lanterns |
| **Network** | Home Wi-Fi / LAN only. No internet, no account, no app store |
| **Round** | 60 seconds, one-tap restart |
| **Input** | **One button.** Tap (or press Space) when your lantern glows |
| **Goal** | Keep the spark moving; grow the chain; draw a constellation together |

**The twist:** the spark is a *single shared object*. Only one lantern can advance
it, so nobody can win solo. Every successful pass draws a glowing line between
lanterns — the family literally builds a picture together. Every 9th pass is a
**HARMONY** event where *everyone* taps at once for double points, which is the
"count in, scream, laugh" moment. When the round ends, one new star is banked to
a persistent **family sky** that grows across evenings. That is the *"just one
more round"* hook.

**Failure is gentle.** A miss resets the chain, dims a shared glow meter and
*quietly widens that player's personal timing window*. No elimination, no
leaderboard, no miss counts shown at round end. Nobody is the reason the family
lost.

---

## 2. Why it should be easy, fun and addictive (the research)

The concept is assembled from patterns that already work, plus a few findings
from games research — not from a hunch.

| Design decision | Why (evidence) |
|---|---|
| **QR / short URL join, phones as controllers** | The proven zero-friction entry to local multiplayer: *"join the lobby room by visiting jackbox.tv using the room code on the host's screen"* ([Jackbox](https://www.jackboxgames.com/how-to-play)); AirConsole's *"one shared screen and use their smartphones as gamepads"* ([AirConsole](https://www.airconsole.com/info)). No hardware people don't already own. |
| **One shared object, split so no one can solo it** | Overcooked's design is *"a shared task under a clock, split across players so no one can solo it, escalating each level"* — it *forces* communication ([Game Developer deep dive](https://www.gamedeveloper.com/design/game-design-deep-dive-building-truly-cooperative-play-in-i-overcooked-i-), [SUPERJUMP](https://www.superjumpmagazine.com/overcooked-how-design-creates-teamwork/)). |
| **Board sees everything, phone sees only itself** | Asymmetric information *"impacts social interactions"* in co-op games ([Reis et al., Springer](https://link.springer.com/chapter/10.1007/978-3-031-81713-7_11)) and is the core of [Keep Talking and Nobody Explodes](https://www.gdcvault.com/play/1023471/Designing_Asymmetric_Gameplay_For_Keep). [Spaceteam](https://spaceteam.ca/faq/) is explicitly local-only, no matchmaking — the talking *is* the game. Here it manifests as "Dad is up — cheer them on!" prompts and simultaneous HARMONY taps. |
| **Co-op, never competitive** | Positive interdependence in a cooperative setting is *"more likely to increase shared attitude and behavior than in a competitive setting"* ([Frontiers](https://www.frontiersin.org/journals/psychiatry/articles/10.3389/fpsyt.2025.1545932/full)); co-op mechanics are studied for the social interaction they foster ([ACM, It Takes Two / Overcooked! 2](https://dl.acm.org/doi/full/10.1145/3815598.3815674)). Hence: no PvP, no MVP, no elimination, only *positive* stats at round end. |
| **Escalating tempo + hidden per-player difficulty** | Flow depends on a skill–challenge balance ([PMC flow review](https://pmc.ncbi.nlm.nih.gov/articles/PMC7751419/), [skill–challenge & urge to keep playing](https://link.springer.com/article/10.3758/s13428-023-02251-w)); dynamic difficulty adjustment protects engagement ([ACM hyper-casual study](https://dl.acm.org/doi/full/10.1145/3803291.3803306)). Windows shrink from 1150 ms → 380 ms over 8 levels, **while each player's own window silently widens ~16% after a miss** — so a child and a teen stay in the same flow channel without anyone being singled out. |
| **60 s rounds, chain multiplier, surprise HARMONY, persistent stars** | Short sessions + layered reward loops + meta-progression are the classic *"one more round"* engine ([reward loops](https://gamedesigning.org/beyond/how-reward-loops-keep-players-engaged-in-game-design/), [psychology of one more round](https://pokerogue.link/blog/psychology-one-more-round-short-games)). |
| **One local server, no cloud** | LAN mode is *"HTTP+WebSocket, serves the web-controller bundle directly to phones on the same Wi-Fi, never talks to the public internet"* ([PairKit LAN mode](https://pairkit.dev/docs/lan-mode/)); the same architecture is the standard answer for a Jackbox-style LAN game ([Godot forum](https://forum.godotengine.org/t/hosting-a-multiplayer-web-game-for-lan-only-for-a-jackbox-like-multiplayer/47497)). |

Full source list and the **research → decision** table are also in
[wireframe.html](wireframe.html) §03 and §07.

---

## 3. Quick start (real LAN play)

Requirements: Node ≥ 18, and all devices on the **same Wi-Fi**. Nothing to install.

~~~bash
cd firefly-relay
node server.js
~~~

The server prints both URLs:

~~~
  ✦  FIREFLY RELAY — family co-op over your home Wi-Fi
  Board (TV / PC) : http://localhost:3000/?board=1
  Phones (Wi-Fi)  : http://10.0.0.58:3000/
  Wireframes      : http://localhost:3000/wireframe.html
~~~

1. Open the **Board URL** on the PC/TV.
2. Everyone scans the QR (or types the phone URL). The QR is generated locally
   and points at the machine's real LAN IP — not "localhost". A small
   /config.js endpoint injects that IP, so the code is always correct for your
   network.
3. Each person types a name + picks an emoji **once**; it is saved on their device,
   so next time they auto-join with zero taps.
4. Anyone presses **Start a round**. Phones become one-button lanterns.
5. **Add a demo firefly** if you want to try it with a single device — bots fill
   the relay and tap themselves, so the whole game is playable solo.

Optional: PORT=4000 node server.js, or ROUND_MS=30000 node server.js.

> **Wi-Fi gotchas:** allow the Node process through the host firewall, and make
> sure "AP/client isolation" is off on the router (some guest networks block
> device-to-device traffic). A cheap spare router as a dedicated offline LAN,
> as the [Spaceteam FAQ](https://spaceteam.ca/faq/) suggests for bigger groups,
> works great.

---

## 4. What's in here

| File | What it is |
|---|---|
| [README.md](README.md) | This pitch, the research rationale, and how to run it |
| [wireframe.html](wireframe.html) | **Visual design spec** — 8 screen states, core loop, research→decision table, architecture diagram, roadmap, sources. Open in a browser or via the server |
| [server.js](server.js) | Zero-dependency Node HTTP + hand-rolled WebSocket server; authoritative game state |
| [index.html](index.html) | Single web app, two roles: board (?board=1) and controller (default) |
| [app.js](app.js) | Client rendering, clock sync, input, audio, starfield |
| [style.css](style.css) | Night-sky visual system |
| [qrcode.js](qrcode.js) | Vendored [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (MIT, Kazuhiko Arase) so QR works **offline** |
| [smoke-test.mjs](smoke-test.mjs) | Automated 4-client LAN round test |
| .family-sky.json | Created on first round end — persistent stars / best score |
| screenshots/ | Real browser captures of the board + phone UI (see below) |

### Architecture

~~~
📺 Host PC / TV                ⚙️ Node server (0.0.0.0:3000)         📱 Phones / laptops
  /?board=1        ◄── HTTP + WS ──►  authoritative turns,      ◄── HTTP + WS ──►   /  (one lantern,
  sky + QR + HUD                     timing, scoring, bots,                        one big button)
  (thin renderer)                    disk-persisted family sky                     (thin renderer)
~~~

* **Server-authoritative timing.** The server opens and closes every window. An
  NTP-style ping/pong handshake aligns clocks, and a tap's timestamp is
  corrected by roughly half the uplink RTT — so a busy 2.4 GHz band doesn't decide
  who "won". All timing decisions happen on the server.
* **No dependencies, no CDN.** The only third-party file is the vendored QR
  generator. Everything else is plain Node / HTML / CSS / JS. Works with the
  router's WAN cable unplugged.
* **Reconnect.** Controllers auto-reconnect and re-join with their saved name.

### Game loop (server)

~~~
lobby → countdown(3) → playing → roundEnd → (one tap) → lobby/playing
playing:  nextTurn → [pass | HARMONY] → tap/timeout → resolveTurn → nextTurn
          level = 1 + floor(passes / 8)     window = max(380, 1150 - (level-1)*105) ms
          score += (100 + level*12) * min(chain, 8) * (HARMONY ? 2 : 1)
          HARMONY every 9th pass; majority hit counts (forgiving)
          miss → chain = 0, glow -= 16, that player's personal window += 16%
~~~

---

## 5. Verify it

~~~bash
cd firefly-relay
node smoke-test.mjs
~~~

Boots the real server on a test port, connects **one board + three controllers +
a bot**, plays a full (shortened) round with simulated taps, and asserts:
countdown fired, ≥5 successful passes, a HARMONY event occurred, every controller
got a turn, and a star was persisted to the family sky.

**Verified result:** 27 successful passes, 1 miss, 2 HARMONY events, level 4,
score 22,668 in a 16-second test round — with zero browser console errors and
zero failed HTTP requests.

The [screenshots/](screenshots) folder contains real headless-Chromium captures:
board lobby, board mid-round, phone join gate, phone waiting, phone "your turn",
phone round end, and the wireframe spec.

---

## 6. Why this beats the obvious alternatives

| Common approach | Problem for a family | Firefly Relay's answer |
|---|---|---|
| Jackbox-style quiz / drawing | Reading + humour + cultural knowledge exclude young kids and grandparents; mostly competitive | One verb, zero literacy, purely co-op |
| 3D "collect crystals together" LAN game | Everyone plays *in parallel* on their own screen; co-op is optional; needs a joystick | One shared spark = genuine interdependence; one button |
| Spaceteam / Keep Talking | Brilliant, but text-heavy, high cognitive load, needs confident readers | Keeps the *asymmetry + shouting* without a single word to read |
| Rhythm game on one device | One player at a time; everyone else watches | The beat is distributed across people — everyone is essential |
| Online multiplayer | Accounts, servers, latency, moderation, data | One "node server.js"; nothing leaves the house |

> **Prior art in this workspace:** the existing `cavern-rush/` prototype is also
> a WLAN co-op game (collect crystals together in 3D). It is a good proof that
> the LAN stack works, but players each move independently in parallel and it
> needs a virtual joystick. Firefly Relay's contribution is the **single shared
> spark** (real interdependence), **one button**, and a **no-CDN, zero-install**
> build that works with the internet unplugged.

---

## 7. Roadmap (if this becomes a real product)

* **Chaos Mode** — the pass order is hidden from the board and shown only on phones
  (full Spaceteam-style asymmetry).
* **More event types** — hold-to-charge, pass-left/pass-right, golden 5× sparks,
  a "shadow round" where the constellation goes dark.
* **Family sky unlocks** — constellations, lantern skins, ambient soundscapes
  (cosmetic only).
* **mDNS / firefly.local** — so nobody has to type an IP at all.
* **Accessibility** — colour-blind-safe palette, adjustable base window,
  audio-only cue mode, bigger tap targets.

---

## 8. Notes on scope

Per this repo's CLAUDE.md, exploratory prototypes belong in their own repo.
This folder is kept **fully standalone** — it imports nothing from the character
game and modifies no product file. If you want to promote it, simply:

~~~bash
cp -r firefly-relay /path/to/new/repo       # then git init there
~~~

The prototype prioritises a *legible, testable slice* of the idea over polish:
real LAN multiplayer works, but there is no packaging, no native app, and the
"family sky" is a small JSON file on the host.
