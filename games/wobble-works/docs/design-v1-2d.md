# Design v1 (2D / Matter.js) — SUPERSEDED

> **Historical document.** This is the original design and research write-up for the
> Matter.js campaign version of Wobble Works. It was never fully built: the project
> pivoted to a 3D Cannon.js arena (see ../RETROSPECTIVE.md §2.3). The research table,
> the chapter plan and the reasoning are preserved verbatim below because the
> retrospective refers back to them.
>
> Two edits were made: markdown links were rewritten to point one directory up,
> and the scope note in section 9 ("not committed to this repo") is obsolete —
> the project now lives at games/wobble-works/ and is tracked.

---

# WOBBLE WORKS · 搭把手

~~~
A family co-op physics workshop for a home WLAN / LAN.
One PC or TV is the workshop. Every phone is a wobbler.
One over-heavy Glow Core. One beacon. No marked answer.
~~~

**The pitch.** A team of small, wobbly characters with **two independently controlled hands** share one job: get a single, absurdly heavy glowing Core to a beacon. You push it, lift it, hang from ropes, lever it with a see-saw, bridge a chasm with planks, ride a wind zone, or link hands and use each other as equipment. The level never tells you which of those was the right answer. Failure is a poof and a laugh, not a game over.

This is the **higher-challenge sibling** of the one-button rhythm relay (Firefly Relay): same room, same zero-install LAN host, but difficulty now lives in the world and the physics instead of a timing window. Reference game: **Human: Fall Flat**.

---

## 1. Why this is more complex — but still easy to pick up

Complexity rises by **removing constraints**, not by adding buttons. There are only four verbs: left, right, jump, and two hold-to-grab hands. Everything else is emergent.

| Stage | Space | Structure | Valid routes |
|---|---|---|---|
| SCRIPTED | CH.1 THE DOOR · 第一课 · 门 | one flat room, plate, latching gate, beacon | 1 intended, several accidental |
| SEMI-SCRIPTED | CH.2 THE SEE-SAW · 第二课 · 跷跷板 | high deck, non-latching plate, see-saw, rope, planks | 3–4 |
| SEMI-OPEN | CH.3 THE GAP · 第三课 · 深沟 | chasm, water, rope, wind, see-saw, two planks, barrel | 4+ |
| OPEN | CH.4 BELL ISLAND · 第四课 · 灯塔岛 | one connected island, summit bell, shared tool budget | effectively open |
| SANDBOX | FREE PLAY · 随便玩 · 沙盒 | no goal, no clock, unlimited parts | — |

That is Nintendo's four-beat kishōtenketsu applied to a campaign (introduce → develop → twist → conclude), followed by a pure toy box. See [wireframe.html](../wireframe.html) §02–03 for level schematics with the alternative solution paths drawn in.

**Physics-enforced interdependence.** The Core is heavy. A tuned weight-transfer model means one wobbler leaning into it moves it about **16 px/s**, three move it about **56 px/s**, and four demo bots about **80 px/s**. Nobody can solo it. Chapter 2's plate is deliberately *not* latched: someone has to stand on it or park a crate there while everyone else lifts. That is cooperation becoming interdependence, not just shared presence.

---

## 2. Research → decisions

Full table with retrieved links in [wireframe.html](../wireframe.html) §06. The load-bearing ones:

| Finding | Source | Decision |
|---|---|---|
| HFF began as a controls prototype; playtesting with the creator's son showed he ignored the puzzles and just played with the physics engine | [Wikipedia](https://en.wikipedia.org/wiki/Human:_Fall_Flat) | Physics is the content. Ship a small consistent rule-set (grab anything, everything has weight), author terrain. |
| "Countless" solutions; the only goal is the exit; co-op is "an entirely shared experience" | [GamingBolt interview](https://gamingbolt.com/human-fall-flat-interview-what-dreams-may-come) | No level marks a correct route. Route Medals celebrate *which* mechanic you used. |
| Simple puzzles with many solutions, "some even requiring a second player" | [Xbox Wire, GDC 2016](https://news.xbox.com/en-us/2016/03/17/gdc-2016-human-fall-flat-xbox-one/) | Weighted Core + a plate that needs holding. |
| Independent control of each arm was the original prototype goal | [Fanatical interview](https://www.fanatical.com/en/blog/human-fall-flat-stumbling-upon-a-physics-based-gem), [TheGamer](https://www.thegamer.com/human-fall-flat-interview-tomas-sakalauskas/) | Two hold-to-grab buttons instead of one "interact" key. |
| BOTW/TOTK "chemistry engine": few consistent rules applied everywhere → many solutions | [GDC 2017 Change and Constant](https://gdcvault.com/play/1024562/Change-and-Constant-Breaking-Conventions), [The Verge on GDC 2024](https://www.theverge.com/24115898/tears-of-the-kingdom-physics-gameplay-design-gdc-2024), [chemistry-engine write-up](https://saschb2b.github.io/game-mechanics/games/zelda-botw/chemistry-engine) | Grab works identically on crates, planks, ropes, ledges, the Core and other players. Tool dispenser supplies parts. |
| Low floor / high ceiling / **wide walls** | [Resnick, Designing for Wide Walls](https://mres.medium.com/designing-for-wide-walls-323bdb4e7277), [MIT IDC 2005](https://web.media.mit.edu/~mres/papers/IDC-2005.pdf) | Four verbs never change; the ladder removes constraints; open island + sandbox are the wide walls. |
| Four-beat kishōtenketsu teaching structure | [MCV/DEVELOP](https://mcvuk.com/business-news/publishing/video-nintendos-level-design-secrets-in-four-steps/), [Eurogamer](https://www.eurogamer.net/how-nintendos-best-mario-levels-were-structured-using-chinese-poetry) | CH.1 → CH.4 is literally that progression. |
| Cooperation ≠ interdependence; creative modes increased verbal communication in an intergenerational study; knowledge asymmetry drives conversation | [Depping & Mandryk, CHI PLAY 2017](https://dl.acm.org/doi/10.1145/3116595.3116639), [CHI PLAY 2017 patterns](https://dl.acm.org/doi/10.1145/3116595.3116606), [PMC8892273](https://pmc.ncbi.nlm.nih.gov/articles/PMC8892273/), [Frontiers](https://doi.org/10.3389/fpsyg.2022.1039431) | One shared Core, split screens (board sees all / phone sees its own camera), quick-call pings, a creative open chapter, no leaderboard. |
| Authoritative server + dumb clients "would also work in a LAN setting, where communications are, for all practical purposes, instantaneous"; interpolate remote entities; avoid extrapolation for rigid bodies | [Gambetta I](https://gabrielgambetta.com/client-server-game-architecture.html), [Gambetta III](https://www.gabrielgambetta.com/entity-interpolation.html), [Gaffer, Snapshot Interpolation](https://gafferongames.com/post/snapshot_interpolation/) | PC runs the only physics sim at 60 Hz; phones send four booleans; 20 Hz snapshots with client-side smoothing. No prediction or rollback. |
| Slapstick makes repeated unfair failure fun; respawn consequences measurably shape experience | [IGN review](https://www.ign.com/articles/2016/07/28/human-fall-flat-review), [Die-r Consequences, IEEE CoG 2021](https://doi.org/10.1109/cog52621.2021.9618894) | Poof-respawn under a second, no lives, no score loss, soft checkpoints, a joke "poofs" counter. **This "keeps groups playing" is a design hypothesis, not a proven finding.** |
| Phone-as-controller via browser + room link, but Jackbox/AirConsole need cloud servers; AP isolation blocks device-to-device traffic; plain http LAN is not a secure context; browser mDNS is IP privacy, not discovery | [UWO on Jackbox](https://pma.uwo.ca/jackbox-games/), [AirConsole](https://forum.playcanvas.com/t/introducing-airconsole-use-smartphones-as-controllers-for-your-html5-games/1428), [TP-Link AP isolation](https://www.tp-link.com/us/blog/2586/what-is-ap-isolation-and-when-to-enable-it-/), [MDN Secure Contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts), [mDNS in WebRTC](https://bloggeek.me/webrtcglossary/mdns/) | Self-hosted HTTP + WS hub, QR with the real LAN IP from dynamic /config.js, clipboard fallback, AP-isolation warning, no mDNS promise. |

Research corrections we applied: the Zelda "Change and Constant" talk is **GDC 2017**, not 2024 (2024 is "Tunes of the Kingdom"); we found no GDC talk by Sakalauskas and no "Level Design in a Day" kishōtenketsu session; "guided emergence" had no citable source; and no source confirmed Jackbox/AirConsole work fully offline. All are flagged in the wireframe rather than asserted.

---

## 3. Quick start

~~~
cd wobble-works
node server.js
~~~

Open **http://localhost:3000/?board=1** on the TV/PC. Everyone else scans the QR or opens the short LAN link on their phone (same Wi-Fi). Enter a name + emoji once; it is saved on that device. Press **START**, then use **+ Demo wobbler** if you want bots in the room.

- **Phones / tablets:** ◀ ▶ to move, JUMP, and two L / R GRAB buttons. Hold a grab to attach to anything; hold both to carry.
- **PC keyboard:** A / D or arrows, SPACE / W / ↑ to jump, J and K for the two hands, 1–4 for quick calls, H for a hint, B to add a bot, 1–5 on the board to switch level.
- **Board controls:** level tabs, START, reset, demo wobblers, hints, tool dispenser (crate / plank / barrel), wide/follow view toggle, scrapbook.

Optional environment variables:

~~~
PORT=3000            HTTP + WebSocket port
CORE_DENSITY=0.0026  Core weight; lower = easier to push
~~~

**No npm install. No CDN. No account. No internet.** Matter.js and the QR generator are vendored in [vendor/](../vendor/). Works with the WAN cable unplugged.

---

## 4. Files

| File | What it is |
|---|---|
| [server.js](../server.js) | Zero-dep HTTP host + hand-rolled RFC 6455 WebSocket + **authoritative Matter.js** simulation, 60 Hz fixed tick, 20 Hz snapshots, bots, medals, persistence |
| [levels.js](../levels.js) | Pure geometry for all 5 spaces: statics, dynamics, plates, gates, see-saws, ropes, water, wind, checkpoints, hints |
| [index.html](../index.html) | Board view (?board=1) and phone controller view in one document |
| [app.js](../app.js) | Canvas renderer (wide board camera + per-phone follow camera), input, QR, HUD, pings, scrapbook, FX |
| [style.css](../style.css) | Warm "cardboard workshop" visual system; responsive board + portrait phone |
| [wireframe.html](../wireframe.html) | **Design spec & wireframes**: 6 screen mockups, 4 level schematics with multiple-solution paths, complexity ladder, research table, architecture, roadmap, sources |
| [vendor/matter.min.js](../vendor/matter.min.js) | Matter.js 0.20.0, MIT, vendored for offline use |
| [vendor/qrcode.js](../vendor/qrcode.js) | qrcode-generator 1.4.4, MIT, vendored for offline use |
| [smoke-test.mjs](../smoke-test.mjs) | Automated full-round test: board + 3 controllers + 2 bots complete CH.1 |
| [lan-doctor.sh](../lan-doctor.sh) | Read-only LAN diagnostics: interfaces, listeners, firewall verdict, self-test |
| [screenshots/](../screenshots/) | Real headless-Chromium captures of the running prototype |
| .wobble-save.json | Created on the first win: Family Scrapbook stamps (not shipped) |

---

## 5. Architecture

~~~
   📺 PC / TV HOST  (node server.js)
   ├─ static HTTP  +  /config.js (real LAN IPs)  +  /ws (hand-rolled RFC6455)
   ├─ ONE Matter.js world, authoritative, 60 Hz fixed step
   ├─ 20 Hz compact snapshots: positions, angles, flags, FX, medal
   └─ .wobble-save.json  (stamps, best times — local only)
            ▲  4 booleans @ 30 Hz        │  20 Hz state
            │                            ▼
   📱 phone A (follow cam)   📱 phone B (follow cam)   💻 PC player   🤖 demo bots
~~~

Clients are thin: they send left / right / jump / grabL / grabR, then render authoritative snapshots with exponential smoothing. Because LAN RTT is 1–3 ms, we skip client-side prediction, server reconciliation and lag compensation — [Gambetta's Part I](https://gabrielgambetta.com/client-server-game-architecture.html) explicitly notes the dumb-client scheme works in a LAN. Deterministic lockstep was rejected (bit-level determinism + stalls on a phone Wi-Fi spike). [Gaffer](https://gafferongames.com/post/snapshot_interpolation/) notes extrapolation fails for non-linear rigid-body motion, so we interpolate/smooth rather than predict.

**Physics details.** Players are upright capsule-ish bodies with springy arm constraints and two sensor hands. A grab creates a constraint between that hand and the nearest grabbable body — crates, planks, barrels, rope nodes, static ledges, the Core, or another wobbler. Two hands on one object = carry; grabbing a friend = human chain. See-saws are pivot constraints, ropes are constraint chains, plates/gates/water/wind are sensors and regions. A tuned weight-transfer force is applied to the Core **only while grounded**, so catapult flights, ramps, wind and falls keep full physics.

---

## 6. Rules that make it a family game

- **One shared object.** Nobody owns a piece of the puzzle; the Core belongs to the room.
- **Four verbs, endless combinations.** Complexity is in the world, not the control scheme.
- **No game over.** Fall in water → poof, respawn at the last soft checkpoint in under a second. The Core is indestructible and returns to the checkpoint it last passed, never to the start.
- **No leaderboard.** A Route Medal (HUMAN CHAIN / CATAPULT CREW / BRIDGE BUILDERS / THE ACROBATS / TWO-HAND CARRY / CHAOS GREMLINS) is derived from the mechanics you actually used, and a stamp joins a persistent Family Scrapbook.
- **Reasons to talk.** Quick-call pings appear above the sender on every screen; the board sees the whole workshop while each phone sees its own wobbler.
- **Shared tool budget.** The dispenser forces "who gets the last plank?" conversations.

---

## 7. Verification

Run **node smoke-test.mjs**. It boots the real server on a test port and drives it with a board, three phone-style WebSocket controllers and two demo bots. **All 21 assertions pass**: static files, offline QR library, dynamic LAN config, joins, LAN ping (1 ms), bots, physics, the plate, the gate, the win, the Route Medal, persistence, chapter switching, sandbox, tool dispenser, pings, snapshot streaming and zero client errors.

Final smoke-test result:

~~~
core travelled 761px · peak team push 4 · round won in 11s · 243 snapshots
medal CHAOS GREMLINS · 1 scrapbook stamp · NEXT CHAPTER → CH.2 · sandbox OK
~~~

Headless Chromium (Python Playwright, /usr/bin/chromium) captured 12 board / phone / wireframe views with **zero console errors and zero failed HTTP responses**.

Measured during physics tuning:

~~~
1 bot pushing the Core     ~17 px/s
1 controller, 8 s         127 px total
3 controllers, 8 s        445 px total   (~56 px/s)
4 bots, 11 s              CH.1 completed, medal CHAOS GREMLINS, 1 stamp
~~~

Bot data is a physics sanity check, **not** human playtest data. Balance needs a real family.

---

## 8. Home-network caveats / troubleshooting

**Symptom: Chrome on Android says "This site can not be reached".** Work down this list in order.

1. **Firewall — the most common cause on Arch / EndeavourOS / Fedora.** firewalld's default
   public zone allows only ssh and dhcpv6-client, so port 3000 is silently dropped. On the host PC:

   ~~~sh
   firewall-cmd --query-port=3000/tcp                    # "no" means BLOCKED
   sudo firewall-cmd --zone=public --add-port=3000/tcp   # immediate, until reboot
   sudo firewall-cmd --permanent --zone=public --add-port=3000/tcp
   sudo firewall-cmd --reload                           # keep it after reboot
   ~~~

   On ufw systems: sudo ufw allow from 192.168.0.0/16 to any port 3000 proto tcp.
   The server now prints a warning at startup when firewalld is blocking the port.

2. **Same subnet.** The phone must be on the same router/network as the PC. Compare the
   phone Wi-Fi IP (Android: Settings → Wi-Fi → network details) with the QR address: for
   192.168.0.196/24 the phone should be 192.168.0.x. A 10.x, 172.x or 192.168.1.x address
   means a different router or a guest network.

3. **AP / client isolation** (guest Wi-Fi, some mesh systems) blocks phone↔PC traffic
   entirely. Use the main SSID, or disable "Wireless Isolation" in the router settings.

4. **Wrong NIC in the QR.** The QR is generated from the host's real LAN IPs injected by
   /config.js, so it never encodes "localhost" when the board is opened on the PC. Virtual
   adapters (Docker, libvirt, VPN, Tailscale) are now filtered out and home-LAN addresses are
   ranked first. If the guess is still wrong: open the board at
   http://YOUR-LAN-IP:3000/?board=1 (the QR then uses that same address), append
   ?host=YOUR-LAN-IP to the board URL, or start the server with
   LAN_IP=192.168.0.196 node server.js.

5. **Prove the port.** From a laptop on the same Wi-Fi,
   curl -m 3 http://192.168.0.196:3000/config.js should print the WOBBLE_CONFIG line.
   A timeout means firewall or isolation; "connection refused" means wrong port or a stopped
   server. Run bash lan-doctor.sh on the host for a read-only dump of interfaces, listeners
   and firewall rules.

- A plain http://192.168.x.x origin is **not a secure context** ([MDN](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts)), so navigator.clipboard may be unavailable — the Copy button has a fallback. Plain ws:// is fine because the page itself is http (no mixed content).
- Browser mDNS is a WebRTC IP-privacy mechanism, **not** LAN service discovery; a wobble.local-style hostname is a roadmap item, not a promise.
- The host binds to 0.0.0.0 (all IPv4 interfaces). Override with HOST=, PORT= or LAN_IP= if needed.

---

## 9. Scope note

This repository hosts **学字坊 · The Character Game**, whose CLAUDE.md says exploratory prototypes belong in their own repo and that no unrelated side projects should be added here. Wobble Works is therefore a **standalone, self-contained folder**: it imports nothing from the character game, modifies no tracked product file, and is not committed. To promote it to a real project:

~~~
cp -r wobble-works /path/to/new/repo
cd /path/to/new/repo
git init
~~~

The existing firefly-relay/ and cavern-rush/ folders in this workspace are separate earlier explorations and were left untouched.

### How this differs from the earlier WLAN prototypes

- **vs Firefly Relay** (one-button rhythm relay): that is a low-challenge, single-verb timing game with hidden difficulty adjustment. Wobble Works is embodied, spatial, and open-ended — the difficulty is visible in the terrain and in other players.
- **vs Crystal Cavern Rush** (cavern-rush/): that uses a Three.js CDN and npm install, and players move independently collecting crystals. Here there is **one** shared object that forces interdependence, two-hand grabbing, no CDN, no install, and a campaign that ends in an unstructured sandbox.

---

## 10. Roadmap (not implemented)

Client-side prediction + reconciliation for internet play; 3D/ragdoll rendering; a persisted level editor; auto "best blooper" replay; local TLS for secure-context APIs; mDNS hostname; colour-blind palette, audio-only cues and a one-hand control scheme; and a balance pass with an actual family.

---

## Licences

Matter.js 0.20.0 — MIT. qrcode-generator 1.4.4 — MIT, Copyright (c) 2009 Kazuhiko Arase. Both vendored, unmodified, for offline LAN use.
