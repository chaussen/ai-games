# 💎 Crystal Cavern Rush

A casual **3D co-op WLAN game** built with Three.js and Node.js WebSockets. Up to 8 players on the same Wi-Fi network collect glowing crystals together in a race against the clock.

---

## 🎮 Gameplay

| Feature | Detail |
|---|---|
| Players | 2–8 on the same WLAN |
| Goal | Collect as many crystals as possible in **90 seconds** |
| Crystals | Common (cyan, 1 pt), Rare (magenta, 3 pts), Epic (yellow, 7 pts) |
| Synergy | Standing close to teammates gives a **×1.5 / ×2.0 / ×2.5 point multiplier** |
| Respawn | Crystals respawn 4 seconds after collection |
| Score | Individual + shared Team Score displayed live |

---

## 🕹 Controls

| Device | Control |
|---|---|
| Desktop | WASD or Arrow Keys to move |
| Mobile / Tablet | Touch anywhere on screen → virtual joystick appears |

---

## 🚀 Quick Start

### 1. Install dependencies

```bash
cd cavern-rush
npm install
```

### 2. Start the server

```bash
npm start
```

You'll see output like:
```
╔══════════════════════════════════════════════╗
║       Crystal Cavern Rush — Server Ready     ║
╠══════════════════════════════════════════════╣
║  Local:   http://localhost:3000              ║
║  Network: http://192.168.1.42:3000           ║
╚══════════════════════════════════════════════╝
```

### 3. Join from any device

Open the **Network URL** (`http://192.168.1.xx:3000`) on any phone, tablet or computer connected to the same Wi-Fi.

- Enter your name and press **Join Game**
- Any player can press **▶ Start Round**
- Play together — synergy multiplies your points!

---

## 🏗 Architecture

```
cavern-rush/
├── server.js      Node.js HTTP + WebSocket server (game authority)
├── index.html     Three.js client (UI + 3D rendering)
├── package.json
└── README.md
```

**Server responsibilities:**
- Authoritative crystal positions & respawn
- Collision detection (player ↔ crystal)
- Synergy calculation
- Score tracking
- Broadcast game state at 20 Hz

**Client responsibilities:**
- 3D rendering (Three.js)
- Client-side movement prediction
- Smooth interpolation of remote players
- Touch joystick UI for mobile
- WebSocket reconnection

---

## 🛠 Requirements

- Node.js ≥ 18
- All devices on the **same Wi-Fi / WLAN**
- No internet required for gameplay (Three.js loads from CDN on first join)

> **Tip:** For fully offline play, download `three.module.js` and serve it locally by updating the import map in `index.html`.
