// Wobble Works 3D — client. One file, three jobs:
//   1. draw the stage as a fixed-camera isometric diorama (Three.js r128, vendored)
//   2. be a controller (touch stick + two buttons, or keyboard)
//   3. be the shared board on a TV (?board=1): whole stage, QR code, roster
// The server owns the game; this file only draws snapshots and sends inputs.
(function () {
  'use strict';

  const qs = new URLSearchParams(location.search);
  const isBoard = qs.get('board') === '1';
  const cfg = window.WOBBLE_CONFIG || {};
  const LV = window.WLevels;
  const $ = id => document.getElementById(id);
  document.documentElement.classList.add(isBoard ? 'board' : 'pad');

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const C = h => new THREE.Color(h);
  // deterministic 0..1 noise so a stage looks the same on every screen
  const hash = (x, z, s) => { const n = Math.sin(x * 127.1 + z * 311.7 + (s || 0) * 74.7) * 43758.5453; return n - Math.floor(n); };

  // ---------- palettes: one mood per stage ----------
  // sky runs horizon -> zenith
  const PAL = {
    dawn: { sky: ['#fff1dc', '#ffcdb2', '#eaa0b5', '#a98bcb'], top: '#fff6e4', topLow: '#ffe6c8', sideA: '#ffc59a', sideB: '#f39a94', deep: '#8d5b93', haze: '#f6bdb6', leaf: '#62cdb0', leaf2: '#3fae97', trunk: '#b06d8e', gem: '#28d2c0', sun: '#fff7e0' },
    mint: { sky: ['#f3fceb', '#c3f0df', '#84d4d2', '#4ea9c2'], top: '#fdfff4', topLow: '#e4f7e2', sideA: '#a5e6cd', sideB: '#62bcb6', deep: '#2c6480', haze: '#aee6da', leaf: '#ffa585', leaf2: '#f47a72', trunk: '#3f8f93', gem: '#ff7b9c', sun: '#ffffff' },
    dusk: { sky: ['#ffe4e6', '#f4bcdb', '#bb9fe8', '#7277d2'], top: '#fff3f8', topLow: '#f6dff2', sideA: '#dfbaf2', sideB: '#a596e6', deep: '#40397f', haze: '#dcb8e8', leaf: '#ffd877', leaf2: '#ffb265', trunk: '#7566bd', gem: '#5ff0cc', sun: '#fff0f4' },
    citrus: { sky: ['#fff8d4', '#ffd690', '#ffa378', '#e2647e'], top: '#fffbe6', topLow: '#ffecc0', sideA: '#ffd486', sideB: '#fb9a6c', deep: '#8c3d58', haze: '#ffc496', leaf: '#48bcae', leaf2: '#2c9795', trunk: '#b95f55', gem: '#38cdea', sun: '#fffbe0' },
    night: { sky: ['#6257a8', '#3b3d8c', '#21255f', '#0e1038'], top: '#e6e9ff', topLow: '#c2c8f8', sideA: '#9a9ff0', sideB: '#6366c4', deep: '#181a4c', haze: '#40428f', leaf: '#ff9bbd', leaf2: '#e86aa2', trunk: '#5656b0', gem: '#ffe07a', sun: '#d9dcff', stars: true }
  };
  const LINK = ['#ff6b5e', '#2fb8c6', '#f5a623', '#a368e8'];   // plate <-> pillar colour pairs
  const WOB = ['#ff6b5e', '#ffb02e', '#3ccf8e', '#3aa7ff', '#b07cff', '#ff7fb6', '#22c7c7', '#ffd84d',
    '#8bd450', '#ff8a3d', '#6c7dff', '#e86fd8', '#2fd3a0', '#f25f7a', '#59b8ff', '#c9a36a'];
  const GOLD = '#ffd36e';

  // ---------- renderer, camera, lights ----------
  const stageEl = $('stage');
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isBoard ? 2 : 1.75));
  renderer.shadowMap.enabled = qs.get('lite') !== '1';
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  stageEl.appendChild(renderer.domElement);
  const scene = new THREE.Scene();

  // The camera never rotates. Screen-up is always "away", so the stick maps to the
  // world the same way for the whole game.
  const ELEV = 36 * Math.PI / 180;
  const cDir = new THREE.Vector3(Math.cos(ELEV) * Math.SQRT1_2, Math.sin(ELEV), Math.cos(ELEV) * Math.SQRT1_2);
  const cRight = new THREE.Vector3(Math.SQRT1_2, 0, -Math.SQRT1_2);
  const cUp = new THREE.Vector3(-Math.sin(ELEV) * Math.SQRT1_2, Math.cos(ELEV), -Math.sin(ELEV) * Math.SQRT1_2);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 260);
  cam.position.copy(cDir).multiplyScalar(90);
  cam.lookAt(0, 0, 0);
  const view = { W: 1, H: 1, ppu: 40, r: 0, u: 0, camR: 0, camU: 0, snap: true, b: { r0: 0, r1: 1, u0: 0, u1: 1 } };

  const hemi = new THREE.HemisphereLight(0xffffff, 0xcfc6dc, 0.7);
  scene.add(hemi);
  const SUN = new THREE.Vector3(0.45, 1, -0.35).normalize();
  const sun = new THREE.DirectionalLight(0xffffff, 0.36);
  sun.castShadow = true;
  const smap = isBoard ? 2048 : 1024;
  sun.shadow.mapSize.set(smap, smap);
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  // ---------- small procedural textures ----------
  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    return new THREE.CanvasTexture(c);
  }
  const TEX = {
    glow: canvasTex(128, 128, (g) => {
      const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,0.55)');
      r.addColorStop(0.6, 'rgba(255,255,255,0.12)'); r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, 128, 128);
    }),
    dot: canvasTex(64, 64, (g) => {
      const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.55, 'rgba(255,255,255,0.9)'); r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    }),
    square: canvasTex(8, 8, (g) => { g.fillStyle = '#fff'; g.fillRect(0, 0, 8, 8); }),
    shadow: canvasTex(64, 64, (g) => {
      const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      r.addColorStop(0, 'rgba(30,20,60,0.5)'); r.addColorStop(0.7, 'rgba(30,20,60,0.22)'); r.addColorStop(1, 'rgba(30,20,60,0)');
      g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    }),
    beam: canvasTex(4, 128, (g) => {
      const r = g.createLinearGradient(0, 0, 0, 128);
      r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.6, 'rgba(255,255,255,0.18)'); r.addColorStop(1, 'rgba(255,255,255,0.6)');
      g.fillStyle = r; g.fillRect(0, 0, 4, 128);
    }),
    cloud: canvasTex(256, 128, (g) => {
      // soft blobs from gradients (canvas blur filters are missing on iOS Safari)
      [[70, 78, 40], [112, 62, 52], [156, 70, 46], [194, 82, 32], [128, 86, 48]].forEach(b => {
        const r = g.createRadialGradient(b[0], b[1], 0, b[0], b[1], b[2]);
        r.addColorStop(0, 'rgba(255,255,255,0.9)'); r.addColorStop(0.55, 'rgba(255,255,255,0.5)'); r.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = r; g.fillRect(0, 0, 256, 128);
      });
    }),
    crate: canvasTex(128, 128, (g) => {
      g.fillStyle = '#f0b872'; g.fillRect(0, 0, 128, 128);
      g.fillStyle = '#e3a55c'; for (let i = 0; i < 4; i++) g.fillRect(14 + i * 26, 14, 22, 100);
      g.strokeStyle = '#c9843f'; g.lineWidth = 12; g.strokeRect(6, 6, 116, 116);
      g.lineWidth = 9; g.beginPath(); g.moveTo(14, 114); g.lineTo(114, 14); g.stroke();
      g.fillStyle = '#fff3d6'; [[13, 13], [115, 13], [13, 115], [115, 115]].forEach(p => { g.beginPath(); g.arc(p[0], p[1], 3.5, 0, 7); g.fill(); });
    })
  };

  function skyTexture(pal) {
    return canvasTex(512, 512, (g, w, h) => {
      const grad = g.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, pal.sky[3]); grad.addColorStop(0.38, pal.sky[2]);
      grad.addColorStop(0.72, pal.sky[1]); grad.addColorStop(1, pal.sky[0]);
      g.fillStyle = grad; g.fillRect(0, 0, w, h);
      if (pal.stars) {
        for (let i = 0; i < 150; i++) {
          const a = hash(i, 3, 1), y = hash(i, 9, 2) * h * 0.8;
          g.fillStyle = 'rgba(255,255,255,' + (0.25 + a * 0.6) * (1 - y / h) + ')';
          g.fillRect(hash(i, 5, 3) * w, y, 1 + (a > 0.85 ? 1 : 0), 1 + (a > 0.85 ? 1 : 0));
        }
      }
      // a soft sun / moon, upper left, behind the island
      const sx = w * 0.24, sy = h * 0.2;
      const halo = g.createRadialGradient(sx, sy, 0, sx, sy, w * 0.42);
      halo.addColorStop(0, 'rgba(255,255,255,' + (pal.stars ? 0.26 : 0.6) + ')');
      halo.addColorStop(0.3, 'rgba(255,255,255,' + (pal.stars ? 0.08 : 0.2) + ')');
      halo.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = halo; g.fillRect(0, 0, w, h);
    });
  }

  // ---------- geometry builder: hand-rolled quads with per-vertex colour ----------
  function Geo() { this.p = []; this.c = []; this.n = []; this.i = []; }
  Geo.prototype.quad = function (a, b, c, d, n, ca, cb, cc, cd) {
    const k = this.p.length / 3;
    this.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], d[0], d[1], d[2]);
    for (const col of [ca, cb || ca, cc || ca, cd || ca]) this.c.push(col.r, col.g, col.b);
    for (let j = 0; j < 4; j++) this.n.push(n[0], n[1], n[2]);
    this.i.push(k, k + 1, k + 2, k, k + 2, k + 3);
  };
  Geo.prototype.mesh = function (material) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setIndex(this.i);
    return new THREE.Mesh(g, material);
  };
  // A column: lit top, four sides that darken with depth and dissolve into the haze.
  Geo.prototype.column = function (x0, x1, z0, z1, y0, y1, top, pal) {
    this.quad([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [0, 1, 0], top);
    const tone = (base, y) => {
      const c = base.clone().lerp(pal._deep, clamp((y1 - y) / 8, 0, 1) * 0.85);
      const f = clamp((-0.5 - y) / 6.5, 0, 1);
      return c.lerp(pal._haze, f * f);
    };
    for (let a = y1; a > y0 + 1e-6;) {
      const b = Math.max(y0, a - 2);
      const A1 = tone(pal._a, a), A0 = tone(pal._a, b), B1 = tone(pal._b, a), B0 = tone(pal._b, b);
      this.quad([x1, b, z1], [x1, b, z0], [x1, a, z0], [x1, a, z1], [1, 0, 0], A0, A0, A1, A1);
      this.quad([x0, b, z1], [x1, b, z1], [x1, a, z1], [x0, a, z1], [0, 0, 1], B0, B0, B1, B1);
      this.quad([x0, b, z0], [x0, b, z1], [x0, a, z1], [x0, a, z0], [-1, 0, 0], B0, B0, B1, B1);
      this.quad([x1, b, z0], [x0, b, z0], [x0, a, z0], [x1, a, z0], [0, 0, -1], A0, A0, A1, A1);
      a = b;
    }
  };
  // an arched window on a +X or +Z wall
  Geo.prototype.window = function (face, cx, cy, cz, col, lit) {
    const w = 0.13, h = 0.24, e = 0.012;
    const P = face === 'x' ? (s, t) => [cx + e, cy + t, cz - s] : (s, t) => [cx + s, cy + t, cz + e];
    const n = face === 'x' ? [1, 0, 0] : [0, 0, 1];
    this.quad(P(-w, -h), P(w, -h), P(w, h), P(-w, h), n, col);
    for (let k = 0; k < 6; k++) {
      const a0 = Math.PI * k / 6, a1 = Math.PI * (k + 1) / 6;
      this.quad(P(0, h), P(Math.cos(a0) * w, h + Math.sin(a0) * w), P(Math.cos(a1) * w, h + Math.sin(a1) * w), P(0, h), n, col);
    }
    this.quad(P(-w - 0.04, -h - 0.05), P(w + 0.04, -h - 0.05), P(w + 0.04, -h), P(-w - 0.04, -h), n, lit);
  };

  function lam(color, extra) { return new THREE.MeshLambertMaterial(Object.assign({ color }, extra)); }
  function shade(mesh, cast, receive) { mesh.castShadow = cast !== false; mesh.receiveShadow = receive !== false; return mesh; }
  function sprite(tex, color, opacity, additive) {
    return new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, color, opacity: opacity == null ? 1 : opacity, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending
    }));
  }
  function disposeTree(root) {
    root.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) for (const m of [].concat(o.material)) { if (m.map && m.userData.ownMap) m.map.dispose(); m.dispose(); }
    });
  }

  // ---------- stage ----------
  let S = null;        // everything that belongs to the current stage
  let skyTex = null;

  function buildStage(i) {
    if (S) { scene.remove(S.root); disposeTree(S.root); }
    if (skyTex) skyTex.dispose();
    const L = LV.LEVELS[i], grid = LV.parse(L), pal = Object.assign({}, PAL[L.pal]);
    pal._a = C(pal.sideA); pal._b = C(pal.sideB); pal._deep = C(pal.deep); pal._haze = C(pal.haze);
    const root = new THREE.Group();
    S = { i, L, grid, pal, root, plates: [], movers: [], crates: [], gems: [], spin: [], sway: [], bornAt: performance.now() };
    scene.background = skyTex = skyTexture(pal);
    hemi.color.set(pal.stars ? '#d6d8ff' : '#ffffff');
    hemi.groundColor.set(C(pal.haze).lerp(C('#ffffff'), pal.stars ? 0.62 : 0.35));
    sun.color.set(pal.stars ? '#c9d0ff' : '#fff6e8');
    document.documentElement.style.setProperty('--gem', pal.gem);

    // --- terrain: one mesh ---
    const { w, d } = grid;
    // how far each cell is from the rim decides how deep the rock hangs below it
    const depth = [];
    for (let z = 0; z < d; z++) { depth.push([]); for (let x = 0; x < w; x++) depth[z].push(grid.at(x, z) ? 99 : 0); }
    const moverCell = (x, z) => (L.movers || []).some(m => x >= m.rect[0] && x < m.rect[0] + m.rect[2] && z >= m.rect[1] && z < m.rect[1] + m.rect[3]);
    const dAt = (x, z) => (z < 0 || z >= d || x < 0 || x >= w) ? 0 : depth[z][x];
    for (let pass = 0; pass < 8; pass++) {
      for (let z = 0; z < d; z++) for (let x = 0; x < w; x++) {
        if (depth[z][x]) depth[z][x] = Math.min(depth[z][x], 1 + Math.min(dAt(x - 1, z), dAt(x + 1, z), dAt(x, z - 1), dAt(x, z + 1)));
      }
    }
    const geo = new Geo();
    const top = C(pal.top), topLow = C(pal.topLow), win = C(pal.deep).lerp(pal._b, 0.25), sill = C(pal.top);
    const topOf = (x, z) => { const c = grid.at(x, z); return c ? (c.ramp ? c.low : c.h) : -99; };
    for (let z = 0; z < d; z++) for (let x = 0; x < w; x++) {
      const c = grid.at(x, z);
      if (!c) continue;
      const bottom = -(1.1 + depth[z][x] * 1.5 + hash(x, z, 1) * 0.9);
      const tint = topLow.clone().lerp(top, clamp((c.h - 1) / Math.max(1, grid.maxH - 1), 0, 1) * 0.75 + ((x + z) & 1 ? 0.25 : 0));
      if (!c.ramp) {
        geo.column(x, x + 1, z, z + 1, bottom, c.h, tint, pal);
        // windows where a wall is tall enough to deserve one
        if (c.h - topOf(x + 1, z) >= 2 && !moverCell(x + 1, z) && hash(x, z, 2) > 0.35) geo.window('x', x + 1, c.h - 0.95, z + 0.5, win, sill);
        if (c.h - topOf(x, z + 1) >= 2 && !moverCell(x, z + 1) && hash(x, z, 3) > 0.35) geo.window('z', x + 0.5, c.h - 0.95, z + 1, win, sill);
      } else {
        // a ramp is drawn as four steps; the physics underneath is a smooth slope
        for (let k = 0; k < 4; k++) {
          const a = k / 4, b = (k + 1) / 4, y = c.low + (k + 1) / 4 - 0.07;
          let x0 = x, x1 = x + 1, z0 = z, z1 = z + 1;
          if (c.ramp === '>') { x0 = x + a; x1 = x + b; } else if (c.ramp === '<') { x0 = x + 1 - b; x1 = x + 1 - a; }
          else if (c.ramp === 'v') { z0 = z + a; z1 = z + b; } else { z0 = z + 1 - b; z1 = z + 1 - a; }
          geo.column(x0, x1, z0, z1, bottom, y, topLow.clone().lerp(top, k % 2 ? 0.9 : 0.4), pal);
        }
      }
    }
    const terrain = shade(geo.mesh(new THREE.MeshLambertMaterial({ vertexColors: true })));
    root.add(terrain);

    // --- pressure plates ---
    for (const p of L.plates || []) {
      const y = grid.at(p.at[0], p.at[1]).h;
      const col = C(LINK[p.c | 0]);
      const g = new THREE.Group();
      g.position.set(p.at[0] + 0.5, y, p.at[1] + 0.5);
      const base = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.46, 0.05, 28), lam(col.clone().lerp(C('#2b2540'), 0.35))), false);
      base.position.y = 0.025;
      const cap = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.37, 0.1, 28), lam(col, { emissive: col.clone().multiplyScalar(0.25) })), false);
      const glow = sprite(TEX.glow, col, 0, true);
      glow.scale.set(2.2, 2.2, 1); glow.position.y = 0.3;
      g.add(base, cap, glow);
      root.add(g);
      S.plates.push({ g, cap, glow, on: 0 });
    }

    // --- rising pillars (gates, lifts, bridges) ---
    for (const m of L.movers || []) {
      const [mx, mz, mw, md] = m.rect;
      const col = C(LINK[m.c | 0]);
      const g = new THREE.Group();
      g.position.set(mx + mw / 2, m.from, mz + md / 2);
      const body = shade(new THREE.Mesh(new THREE.BoxGeometry(mw - 0.06, 9, md - 0.06), lam(pal._a.clone().lerp(col, 0.4))));
      body.position.y = -4.58;
      const cap = shade(new THREE.Mesh(new THREE.BoxGeometry(mw - 0.02, 0.08, md - 0.02), lam(col.clone().lerp(C('#ffffff'), 0.45))));
      cap.position.y = -0.04;
      const inlay = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(0.3, mw - 0.4), Math.max(0.3, md - 0.4)), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.5 }));
      inlay.rotation.x = -Math.PI / 2; inlay.position.y = 0.006;
      g.add(body, cap, inlay);
      root.add(g);
      S.movers.push({ g, y: m.from });
    }

    // --- crates ---
    for (const c of L.crates || []) {
      const mesh = shade(new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.88, 0.88), lam('#ffffff', { map: TEX.crate })));
      mesh.position.set(c[0], grid.at(Math.floor(c[0]), Math.floor(c[1])).h + 0.45, c[1]);
      root.add(mesh);
      S.crates.push({ mesh, x: c[0], y: mesh.position.y - 0.45, z: c[1] });
    }

    // --- gems ---
    const floorAt = (x, z) => { const c = grid.at(Math.floor(x), Math.floor(z)); return c ? c.h : 0; };
    for (const gm of L.gems || []) {
      const y = gm[2] != null ? gm[2] : floorAt(gm[0], gm[1]) + 0.7;
      const g = new THREE.Group();
      g.position.set(gm[0], y, gm[1]);
      const col = C(pal.gem);
      const m = shade(new THREE.Mesh(new THREE.OctahedronGeometry(0.2), lam(col, { emissive: col.clone().multiplyScalar(0.55), flatShading: true })), true, false);
      m.scale.y = 1.35;
      const halo = sprite(TEX.glow, col, 0.55, true);
      halo.scale.set(1.1, 1.1, 1);
      g.add(m, halo);
      root.add(g);
      S.gems.push({ g, m, y, got: false });
    }

    // --- the beacon: where the Core goes ---
    {
      const by = floorAt(L.beacon[0], L.beacon[1]);
      const g = new THREE.Group();
      g.position.set(L.beacon[0], by, L.beacon[1]);
      const gold = C(GOLD);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.055, 10, 40), new THREE.MeshBasicMaterial({ color: gold }));
      ring.rotation.x = Math.PI / 2; ring.position.y = 0.06;
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.6, 32), new THREE.MeshBasicMaterial({ color: gold, transparent: true, opacity: 0.32, depthWrite: false }));
      disc.rotation.x = -Math.PI / 2; disc.position.y = 0.02;
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.6, 7, 28, 1, true),
        new THREE.MeshBasicMaterial({ map: TEX.beam, color: gold, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
      beam.position.y = 3.5;
      const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.OctahedronGeometry(0.36)), new THREE.LineBasicMaterial({ color: gold }));
      frame.position.y = 1.9;
      const halo = sprite(TEX.glow, gold, 0.5, true);
      halo.scale.set(3, 3, 1); halo.position.y = 0.5;
      g.add(ring, disc, beam, frame, halo);
      root.add(g);
      S.beacon = { g, ring, beam, frame, halo, y: by };
      // and the little stand the Core starts on
      const stand = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.07, 24), lam(gold.clone().lerp(C(pal.top), 0.5))), false);
      stand.position.set(L.core[0], floorAt(L.core[0], L.core[1]) + 0.035, L.core[1]);
      root.add(stand);
    }

    // --- trees ---
    const leafMat = lam(pal.leaf, { flatShading: true }), leafMat2 = lam(pal.leaf2, { flatShading: true }), trunkMat = lam(pal.trunk);
    function tree(x, y, z, s) {
      const g = new THREE.Group();
      g.position.set(x, y, z); g.scale.setScalar(s);
      const trunk = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.5, 6), trunkMat));
      trunk.position.y = 0.25;
      g.add(trunk);
      [[0, 0.72, 0, 0.34, leafMat], [0.17, 0.98, 0.06, 0.24, leafMat2], [-0.17, 0.9, -0.08, 0.21, leafMat]].forEach(b => {
        const m = shade(new THREE.Mesh(new THREE.IcosahedronGeometry(b[3], 1), b[4]));
        m.position.set(b[0], b[1], b[2]);
        g.add(m);
      });
      S.sway.push({ g, seed: hash(x, z, 5) * 6 });
      return g;
    }
    for (const t of L.trees || []) root.add(tree(t[0], floorAt(t[0], t[1]), t[1], 0.9 + hash(t[0], t[1], 4) * 0.35));

    // --- far islets and clouds: depth without clutter ---
    const centre = new THREE.Vector3(w / 2, 1, d / 2);
    S.far = [];
    const farMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    for (let k = 0; k < 4; k++) {
      const fg = new Geo(), fpal = Object.assign({}, pal);
      // pushed toward the haze so they read as distant
      fpal._a = pal._a.clone().lerp(pal._haze, 0.55); fpal._b = pal._b.clone().lerp(pal._haze, 0.55);
      const ft = C(pal.top).lerp(pal._haze, 0.45);
      const n = 2 + Math.floor(hash(k, i, 6) * 3);
      for (let j = 0; j < n; j++) {
        const hx = Math.floor(hash(k, j, 7) * 2.4), hz = Math.floor(hash(k, j, 8) * 2.4), hh = 0.6 + Math.floor(hash(k, j, 9) * 3) * 0.7;
        fg.column(hx, hx + 1, hz, hz + 1, -(5 + hash(k, j, 10) * 3), hh, ft, fpal);
      }
      const m = fg.mesh(farMat);
      const side = k % 2 ? 1 : -1;
      const r = side * (w * 0.5 + 3 + hash(k, i, 11) * 5), u = -4 + hash(k, i, 12) * 13;
      m.position.copy(centre).addScaledVector(cRight, r).addScaledVector(cUp, u).addScaledVector(cDir, -22 - k * 4);
      m.scale.setScalar(0.45 + hash(k, i, 13) * 0.35);
      root.add(m);
      S.far.push({ m, y: m.position.y, seed: k * 1.7 });
    }
    S.clouds = [];
    for (let k = 0; k < 8; k++) {
      const sp = sprite(TEX.cloud, '#ffffff', pal.stars ? 0.16 : 0.62);
      const sc = 5 + hash(k, i, 14) * 6;
      sp.scale.set(sc, sc * 0.5, 1);
      const cl = { sp, r: -26 + hash(k, i, 15) * 52, u: -11 + hash(k, i, 16) * 20, v: 0.18 + hash(k, i, 17) * 0.3, back: -34 - k };
      root.add(sp);
      S.clouds.push(cl);
    }
    S.centre = centre;
    const orb = sprite(TEX.dot, pal.sun, pal.stars ? 0.95 : 0.9);
    orb.scale.set(3.4, 3.4, 1);
    orb.position.copy(centre).addScaledVector(cRight, -w * 0.5 - 3).addScaledVector(cUp, 8.5).addScaledVector(cDir, -60);
    root.add(orb);

    // --- fit the fixed camera and the sun's shadow box to this stage ---
    const b = { r0: 1e9, r1: -1e9, u0: 1e9, u1: -1e9 };
    for (const x of [-0.6, w + 0.6]) for (const z of [-0.6, d + 0.6]) for (const y of [-1.6, grid.maxH + 2.3]) {
      const r = x * cRight.x + z * cRight.z, u = x * cUp.x + y * cUp.y + z * cUp.z;
      b.r0 = Math.min(b.r0, r); b.r1 = Math.max(b.r1, r); b.u0 = Math.min(b.u0, u); b.u1 = Math.max(b.u1, u);
    }
    view.b = b; view.snap = true;
    sun.target.position.copy(centre);
    sun.position.copy(centre).addScaledVector(SUN, 40);
    const ext = Math.max(w, d) * 0.75 + 3;
    Object.assign(sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 5, far: 90 });
    sun.shadow.camera.updateProjectionMatrix();

    scene.add(root);

    // --- words ---
    $('st-num').textContent = (i + 1) + ' / ' + LV.LEVELS.length;
    $('st-name').textContent = L.name;
    $('st-cn').textContent = L.cn;
    $('tc-num').textContent = 'Stage ' + (i + 1);
    $('tc-name').textContent = L.name;
    $('tc-cn').textContent = L.cn;
    const tc = $('title-card');
    tc.classList.remove('show'); void tc.offsetWidth; tc.classList.add('show');
    $('hint').textContent = L.hint;
    $('hint').classList.remove('gone');
    $('gems').innerHTML = (L.gems || []).map(() => '<span class="gem"></span>').join('');
    $('result').classList.add('hidden');
    const veil = $('veil');
    veil.classList.add('on');
    setTimeout(() => veil.classList.remove('on'), 140);
  }

  // ---------- wobblers ----------
  const wobblers = new Map();
  const tagsEl = $('tags');
  let roster = new Map();

  function makeWobbler(id) {
    const info = roster.get(id) || { name: '…', ci: 0 };
    const col = C(WOB[info.ci % WOB.length]);
    const g = new THREE.Group();
    const body = new THREE.Group();
    g.add(body);
    // an egg, a little heavier at the bottom
    const geom = new THREE.SphereGeometry(0.31, 24, 18);
    const pos = geom.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      const y = pos.getY(k), f = 1 + Math.max(0, -y / 0.31) * 0.13;
      pos.setXYZ(k, pos.getX(k) * f, y * 1.34, pos.getZ(k) * f);
    }
    geom.computeVertexNormals();
    const skin = lam(col);
    const torso = shade(new THREE.Mesh(geom, skin), true, false);
    torso.position.y = 0.5;
    body.add(torso);
    const white = new THREE.MeshBasicMaterial({ color: '#ffffff' }), dark = new THREE.MeshBasicMaterial({ color: '#2b2540' });
    const eyes = [];
    for (const s of [-1, 1]) {
      const e = new THREE.Group();
      e.position.set(s * 0.115, 0.63, 0.255);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.078, 14, 10), white);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 8), dark);
      pupil.position.set(s * -0.008, 0, 0.05);
      e.add(ball, pupil);
      body.add(e);
      eyes.push(e);
      const cheek = new THREE.Mesh(new THREE.CircleGeometry(0.045, 12), new THREE.MeshBasicMaterial({ color: '#ff8fa3', transparent: true, opacity: 0.7 }));
      cheek.position.set(s * 0.2, 0.5, 0.262); cheek.rotation.y = s * 0.6;
      body.add(cheek);
    }
    const limbMat = lam(col.clone().lerp(C('#2b2540'), 0.3)), handMat = lam(col.clone().lerp(C('#ffffff'), 0.3));
    const feet = [], hands = [];
    for (const s of [-1, 1]) {
      const f = shade(new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), limbMat), true, false);
      f.scale.set(1, 0.62, 1.35); f.position.set(s * 0.13, 0.06, 0.04);
      g.add(f); feet.push(f);
      const h = shade(new THREE.Mesh(new THREE.SphereGeometry(0.078, 10, 8), handMat), true, false);
      h.position.set(s * 0.34, 0.42, 0.04);
      body.add(h); hands.push(h);
    }
    // four hats so two wobblers of similar colour still look different
    const hat = new THREE.Group();
    hat.position.y = 0.9;
    const kind = info.ci % 4;
    let spinner = null;
    if (kind === 0) {
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.2, 5), dark); stalk.position.y = 0.09;
      const bob = new THREE.Mesh(new THREE.SphereGeometry(0.058, 10, 8), new THREE.MeshBasicMaterial({ color: GOLD })); bob.position.y = 0.21;
      hat.add(stalk, bob);
    } else if (kind === 1) {
      for (const s of [-1, 1]) {
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), lam('#5fd08a'));
        leaf.scale.set(1.25, 0.28, 0.6); leaf.position.set(s * 0.085, 0.08, 0); leaf.rotation.z = s * 0.55;
        hat.add(leaf);
      }
    } else if (kind === 2) {
      const cone = shade(new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.26, 12), lam('#fffaf2')), true, false); cone.position.y = 0.1;
      const pom = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff6b5e' })); pom.position.y = 0.24;
      hat.add(cone, pom);
    } else {
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.1, 5), dark); stalk.position.y = 0.04;
      spinner = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.02, 0.07), lam('#fffaf2')); spinner.position.y = 0.1;
      hat.add(stalk, spinner);
    }
    body.add(hat);
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95), new THREE.MeshBasicMaterial({ map: TEX.shadow, transparent: true, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2;
    scene.add(g, blob);

    const tag = document.createElement('div');
    tag.className = 'tag';
    tag.innerHTML = '<i></i><span></span>';
    tag.firstChild.style.background = WOB[info.ci % WOB.length];
    tag.lastChild.textContent = info.name;
    tagsEl.appendChild(tag);

    const wob = {
      id, g, body, torso, skin, eyes, feet, hands, hat, spinner, blob, tag, col,
      x: 0, y: 0, z: 0, rot: 0, tx: 0, ty: 0, tz: 0, trot: 0, gy: 0, flags: 0, fresh: true,
      sq: 0, sqv: 0, tilt: 0, tiltv: 0, phase: hash(info.ci, 1, 1) * 6, seed: hash(info.ci, 2, 2) * 6,
      blink: 1 + Math.random() * 3, speed: 0, vy: 0, say: null, sayUntil: 0
    };
    wobblers.set(id, wob);
    return wob;
  }

  function removeWobbler(wob) {
    scene.remove(wob.g, wob.blob);
    disposeTree(wob.g);
    wob.blob.geometry.dispose(); wob.blob.material.dispose();
    wob.tag.remove();
    wobblers.delete(wob.id);
  }

  function say(id, text, ms) {
    const wob = wobblers.get(id);
    if (!wob) return;
    if (wob.say) wob.say.remove();
    const el = document.createElement('div');
    el.className = 'say';
    el.textContent = text;
    wob.tag.appendChild(el);
    wob.say = el;
    wob.sayUntil = performance.now() + (ms || 1800);
  }

  function updateWobbler(wob, dt, t) {
    const k = 1 - Math.exp(-dt * 18);
    const px = wob.x, py = wob.y, pz = wob.z;
    if (wob.fresh || Math.hypot(wob.tx - wob.x, wob.ty - wob.y, wob.tz - wob.z) > 3) {
      wob.x = wob.tx; wob.y = wob.ty; wob.z = wob.tz; wob.rot = wob.trot; wob.fresh = false;
    } else {
      wob.x += (wob.tx - wob.x) * k; wob.y += (wob.ty - wob.y) * k; wob.z += (wob.tz - wob.z) * k;
    }
    let dr = wob.trot - wob.rot;
    dr = Math.atan2(Math.sin(dr), Math.cos(dr));
    const turn = dr * (1 - Math.exp(-dt * 14));
    wob.rot += turn;
    const inst = dt > 0 ? Math.hypot(wob.x - px, wob.z - pz) / dt : 0;
    wob.speed += (inst - wob.speed) * Math.min(1, dt * 12);
    wob.vy = dt > 0 ? (wob.y - py) / dt : 0;
    const carrying = !!(wob.flags & 1), grounded = !!(wob.flags & 2), afk = !!(wob.flags & 4);
    const m = grounded ? clamp(wob.speed / 2.4, 0, 1) : 0;

    // jelly: a squash spring kicked by jumps and landings, plus a sideways tilt spring
    wob.sqv += (-wob.sq * 150 - wob.sqv * 11) * dt;
    wob.sq += wob.sqv * dt;
    wob.tiltv += (-wob.tilt * 80 - wob.tiltv * 7) * dt - turn * 2.2;
    wob.tilt += wob.tiltv * dt;
    const stretch = clamp(wob.sq + (grounded ? 0 : clamp(wob.vy * 0.022, -0.1, 0.2)), -0.4, 0.45);
    wob.phase += wob.speed * dt * 4.6;
    const sw = Math.sin(wob.phase);
    const breathe = Math.sin(t * 2.3 + wob.seed) * (afk ? 0.03 : 0.012);

    wob.g.position.set(wob.x, wob.y, wob.z);
    wob.g.rotation.y = wob.rot;
    wob.body.scale.set(1 - stretch * 0.5, 1 + stretch + breathe, 1 - stretch * 0.5);
    wob.body.position.y = Math.abs(sw) * 0.04 * m;
    wob.body.rotation.x = m * 0.16 + (carrying ? -0.06 : 0);
    wob.body.rotation.z = clamp(wob.tilt, -0.5, 0.5) + Math.sin(t * 2.7 + wob.seed) * 0.03 * (1 - m);
    wob.feet[0].position.y = 0.06 + Math.max(0, sw) * 0.13 * m + (grounded ? 0 : 0.07);
    wob.feet[1].position.y = 0.06 + Math.max(0, -sw) * 0.13 * m + (grounded ? 0 : 0.07);
    wob.feet[0].position.z = 0.04 + sw * 0.12 * m;
    wob.feet[1].position.z = 0.04 - sw * 0.12 * m;
    for (let s = 0; s < 2; s++) {
      const h = wob.hands[s], sign = s ? 1 : -1;
      const tx = carrying ? sign * 0.2 : grounded ? sign * 0.34 : sign * 0.38;
      const ty = carrying ? 1.0 : grounded ? 0.42 - sign * sw * 0.05 * m : 0.66;
      const tz = carrying ? 0.03 : grounded ? 0.04 - sign * sw * 0.14 * m : 0.04;
      h.position.x += (tx - h.position.x) * k; h.position.y += (ty - h.position.y) * k; h.position.z += (tz - h.position.z) * k;
    }
    wob.blink -= dt;
    const closed = afk || wob.blink < 0.11;
    if (wob.blink < 0) wob.blink = 1.6 + Math.random() * 3.5;
    for (const e of wob.eyes) e.scale.y = closed ? 0.12 : 1;
    if (wob.spinner) wob.spinner.rotation.y += dt * (4 + wob.speed * 5);
    wob.skin.color.copy(afk ? wob.col.clone().lerp(C('#b9b4c6'), 0.65) : wob.col);

    const gy = wob.gy > -50 ? wob.gy : wob.y;
    const high = clamp(wob.y - gy, 0, 4);
    wob.blob.visible = wob.gy > -50;
    wob.blob.position.set(wob.x, gy + 0.02, wob.z);
    wob.blob.scale.setScalar(1 - high * 0.12);
    wob.blob.material.opacity = 0.75 - high * 0.12;

    place(wob.tag, wob.x, wob.y + (carrying ? 1.95 : 1.28), wob.z);
    wob.tag.classList.toggle('me', wob.id === myId);
    wob.tag.classList.toggle('nap', afk);
    if (wob.say && performance.now() > wob.sayUntil) { wob.say.remove(); wob.say = null; }
  }

  // world point -> CSS pixels. The camera is orthographic and never turns, so this is two dot products.
  function place(el, x, y, z) {
    const sx = view.W / 2 + (x * cRight.x + z * cRight.z - view.camR) * view.ppu;
    const sy = view.H / 2 - (x * cUp.x + y * cUp.y + z * cUp.z - view.camU) * view.ppu;
    el.style.transform = 'translate(' + sx.toFixed(1) + 'px,' + sy.toFixed(1) + 'px) translate(-50%,-100%)';
  }

  // ---------- the Glow Core ----------
  const core = (() => {
    const g = new THREE.Group();
    const gold = C(GOLD);
    const inner = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), new THREE.MeshBasicMaterial({ color: '#fffbe6' }));
    const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0), new THREE.MeshLambertMaterial({ color: gold, emissive: C('#ff9d2e'), emissiveIntensity: 0.75, flatShading: true, transparent: true, opacity: 0.88 }));
    shell.castShadow = true;
    const halo = sprite(TEX.glow, gold, 0.85, true);
    const light = new THREE.PointLight(0xffc878, 0.55, 5.5, 1.6);
    g.add(inner, shell, halo, light);
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), new THREE.MeshBasicMaterial({ map: TEX.shadow, transparent: true, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2;
    scene.add(g, blob);
    return { g, shell, halo, light, blob, x: 0, y: 0, z: 0, fresh: true, trail: 0 };
  })();

  // aim marker: a ring where the Core will land and a dotted arc to it
  const aim = (() => {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.4, 32), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthTest: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.renderOrder = 10;
    const dots = [];
    const mat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, depthTest: false });
    for (let k = 0; k < 6; k++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), mat); d.renderOrder = 10; dots.push(d); scene.add(d); }
    scene.add(ring);
    return { ring, dots, mat };
  })();

  // ---------- particles ----------
  const parts = [];
  for (let k = 0; k < 150; k++) {
    const sp = sprite(TEX.dot, '#ffffff', 0);
    sp.visible = false;
    scene.add(sp);
    parts.push({ sp, life: 0, max: 1, vx: 0, vy: 0, vz: 0, g: 0, s0: 0.1, s1: 0.1, a: 1 });
  }
  let partIdx = 0;
  function puff(x, y, z, o) {
    const p = parts[partIdx = (partIdx + 1) % parts.length];
    p.sp.visible = true;
    p.sp.position.set(x, y, z);
    p.sp.material.map = o.tex || TEX.dot;
    p.sp.material.color.set(o.color || '#ffffff');
    p.sp.material.blending = o.add ? THREE.AdditiveBlending : THREE.NormalBlending;
    p.sp.material.rotation = o.rot || 0;
    p.life = p.max = o.life || 0.5; p.vx = o.vx || 0; p.vy = o.vy || 0; p.vz = o.vz || 0; p.g = o.g || 0;
    p.s0 = o.s0 || 0.15; p.s1 = o.s1 == null ? p.s0 : o.s1; p.a = o.a == null ? 1 : o.a;
  }
  function burst(x, y, z, n, color, speed, add) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * 6.283, e = Math.random() * 1.2, v = speed * (0.5 + Math.random() * 0.7);
      puff(x, y, z, { color, add, life: 0.45 + Math.random() * 0.4, vx: Math.cos(a) * Math.cos(e) * v, vy: Math.sin(e) * v + 1, vz: Math.sin(a) * Math.cos(e) * v, g: 6, s0: 0.16, s1: 0.02, tex: TEX.glow });
    }
  }
  function dust(x, y, z, n) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * 6.283;
      puff(x, y + 0.06, z, { life: 0.4 + Math.random() * 0.2, vx: Math.cos(a) * 1.1, vy: 0.5, vz: Math.sin(a) * 1.1, s0: 0.12, s1: 0.34, a: 0.6 });
    }
  }
  function confetti(x, y, z) {
    const cols = [GOLD, '#ff6b5e', '#2fb8c6', '#a368e8', '#3ccf8e', '#ffffff'];
    for (let k = 0; k < 90; k++) {
      const a = Math.random() * 6.283, v = 2 + Math.random() * 4.5;
      puff(x, y, z, { tex: TEX.square, color: cols[k % cols.length], life: 1.6 + Math.random() * 1.2, vx: Math.cos(a) * v, vy: 5 + Math.random() * 6, vz: Math.sin(a) * v, g: 9, s0: 0.14, s1: 0.1, rot: Math.random() * 3 });
    }
  }

  // ---------- sound: a few sine blips, no files ----------
  let AC = null;
  function unlockAudio() {
    if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = false; } }
    if (AC && AC.state === 'suspended') AC.resume();
  }
  function tone(f, dur, type, vol, slide, delay) {
    if (!AC || AC.state !== 'running') return;
    const t = AC.currentTime + (delay || 0), o = AC.createOscillator(), g = AC.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.1, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(AC.destination);
    o.start(t); o.stop(t + dur + 0.03);
  }
  const sfx = {
    jump: () => tone(380, 0.14, 'sine', 0.09, 760),
    land: () => tone(150, 0.09, 'triangle', 0.1, 80),
    grab: () => tone(520, 0.1, 'triangle', 0.1, 820),
    throw: () => tone(640, 0.16, 'sine', 0.08, 250),
    catch: () => { tone(660, 0.08, 'triangle', 0.1); tone(990, 0.12, 'triangle', 0.09, null, 0.07); },
    plate: on => tone(on ? 620 : 410, 0.07, 'square', 0.035),
    mover: () => tone(120, 0.2, 'triangle', 0.11, 70),
    gem: () => { tone(988, 0.1, 'sine', 0.09); tone(1480, 0.2, 'sine', 0.09, null, 0.08); },
    bonk: () => tone(190, 0.1, 'square', 0.04, 120),
    pop: () => tone(300, 0.12, 'sine', 0.09, 620),
    win: () => [523, 659, 784, 1047, 1319].forEach((f, k) => tone(f, 0.28, 'triangle', 0.1, null, k * 0.11))
  };

  // ---------- network ----------
  let snap = null, myId = null, board = null, me = null;
  let toastTimer = 0;
  function toast(text) {
    const el = $('toast');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }
  const nameOf = id => (roster.get(id) || {}).name || 'Someone';

  function Conn(asBoard, name, pidKey) {
    this.asBoard = asBoard; this.name = name; this.pidKey = pidKey; this.ws = null; this.sentX = 0; this.sentZ = 0; this.sentAt = 0;
    this.open();
  }
  Conn.prototype.open = function () {
    const ws = this.ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
    ws.onopen = () => {
      if (this.asBoard) { this.send({ type: 'join', board: true }); return; }
      let pid = null;
      try { pid = localStorage.getItem(this.pidKey); } catch (e) {}
      if (!pid) { pid = 'p-' + Math.random().toString(36).slice(2, 12); try { localStorage.setItem(this.pidKey, pid); } catch (e) {} }
      this.send({ type: 'join', name: this.name, playerId: pid });
    };
    ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } this.onMessage(m); };
    ws.onclose = () => { setTimeout(() => this.open(), 900); };
  };
  Conn.prototype.send = function (m) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); };
  Conn.prototype.onMessage = function (m) {
    if (m.type === 'joined' && m.id) { myId = m.id; return; }
    if (m.type === 'full') { toast('The workshop is full (16 wobblers).'); return; }
    // with a board and a keyboard player on one screen, only the board socket draws
    if (this !== primary) return;
    if (m.type === 's') onSnapshot(m);
    else if (m.type === 'roster') onRoster(m.players);
    else if (m.type === 'call') { say(m.id, m.text); sfx.pop(); }
  };
  Conn.prototype.input = function (x, z) {
    const now = performance.now();
    if (Math.abs(x - this.sentX) < 0.02 && Math.abs(z - this.sentZ) < 0.02 && now - this.sentAt < 250) return;
    if (now - this.sentAt < 33 && (x || z)) return;
    this.sentX = x; this.sentZ = z; this.sentAt = now;
    this.send({ type: 'input', x: +x.toFixed(3), z: +z.toFixed(3) });
  };

  let primary = null;   // the socket whose snapshots we draw
  function startPlayer(name) {
    me = new Conn(false, name, isBoard ? 'ww3d_host_pid' : 'ww3d_pid');
    if (!primary) primary = me;
  }

  function onRoster(list) {
    roster = new Map(list.map(p => [p.id, p]));
    for (const wob of [...wobblers.values()]) {
      const info = roster.get(wob.id);
      if (!info) removeWobbler(wob);
      else wob.tag.lastChild.textContent = info.name;
    }
    renderRoster();
  }
  function renderRoster() {
    if (!isBoard) return;
    const afk = new Set(snap ? snap.p.filter(p => p[5] & 4).map(p => p[0]) : []);
    $('roster').innerHTML = roster.size
      ? [...roster.values()].map(p => '<span class="chip' + (afk.has(p.id) ? ' nap' : '') + '"><i style="background:' + WOB[p.ci % WOB.length] + '"></i>' + esc(p.name) + '</span>').join('')
      : '<span class="chip empty">Waiting for wobblers…</span>';
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  let lastAfkKey = '';
  function onSnapshot(s) {
    if (!S || s.st !== S.i) buildStage(s.st);
    snap = s;
    for (const p of s.p) {
      const wob = wobblers.get(p[0]) || makeWobbler(p[0]);
      wob.tx = p[1]; wob.ty = p[2]; wob.tz = p[3]; wob.trot = p[4]; wob.flags = p[5]; wob.gy = p[6];
    }
    if (wobblers.size > s.p.length) {
      const live = new Set(s.p.map(p => p[0]));
      for (const wob of [...wobblers.values()]) if (!live.has(wob.id)) removeWobbler(wob);
    }
    const afkKey = s.p.map(p => p[5] & 4).join('');
    if (afkKey !== lastAfkKey) { lastAfkKey = afkKey; renderRoster(); }
    if (s.e) for (const e of s.e) onEvent(e);
    const gemEls = $('gems').children;
    for (let k = 0; k < gemEls.length; k++) gemEls[k].classList.toggle('got', !!s.g[k]);
    $('clock').textContent = fmtTime(s.t);
    if (s.t > 14) $('hint').classList.add('gone');
    if (s.res) showResult(s.res); else $('result').classList.add('hidden');
  }
  const fmtTime = t => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');

  function onEvent(e) {
    const wob = e.id ? wobblers.get(e.id) : null;
    switch (e.t) {
      case 'jump': if (wob) { wob.sqv = 2.6; dust(wob.x, wob.y, wob.z, 3); } if (e.id === myId || isBoard) sfx.jump(); break;
      case 'land': if (wob) { wob.sqv = -Math.min(4.5, e.v * 0.3); dust(wob.x, wob.ty, wob.z, 5); } if (e.id === myId || isBoard) sfx.land(); break;
      case 'grab': if (wob) wob.sqv = -1.8; burst(core.x, core.y + 0.3, core.z, 8, GOLD, 1.6, true); sfx.grab(); break;
      case 'catch': if (wob) wob.sqv = -2.4; burst(core.x, core.y + 0.3, core.z, 12, GOLD, 2, true); sfx.catch(); say(e.id, 'Got it!', 1100); break;
      case 'throw': if (wob) wob.sqv = 2; sfx.throw(); break;
      case 'heavy': if (wob) { wob.sqv = -1.6; say(e.id, 'Too heavy!', 1100); } if (e.id === myId) sfx.bonk(); break;
      case 'plate': sfx.plate(e.on); break;
      case 'mover': sfx.mover(); break;
      case 'thud': dust(core.x, core.y, core.z, 4); break;
      case 'gem': { const g = S && S.gems[e.i]; if (g) burst(g.g.position.x, g.g.position.y, g.g.position.z, 16, S.pal.gem, 2.6, true); sfx.gem(); break; }
      case 'respawn': if (wob) { wob.fresh = true; burst(wob.tx, wob.ty + 0.5, wob.tz, 10, '#ffffff', 2); } sfx.pop(); break;
      case 'coreReturn': core.fresh = true; toast(e.why === 'lonely' ? 'The Core floated back to you' : 'The Core fell — it floated back'); sfx.pop(); break;
      case 'crateHome': toast('A crate fell — it is back where it started'); break;
      case 'win': if (S) confetti(S.L.beacon[0], S.beacon.y + 1, S.L.beacon[1]); sfx.win(); break;
    }
  }

  const STAR = '<svg viewBox="0 0 24 24"><path d="M12 1.8l3.1 6.6 7.1.9-5.2 5 1.3 7.1L12 17.9l-6.3 3.5L7 14.3l-5.2-5 7.1-.9z"/></svg>';
  let shownRes = null;
  function showResult(r) {
    const el = $('result');
    if (shownRes !== r.time + ':' + snap.st || el.classList.contains('hidden')) {
      shownRes = r.time + ':' + snap.st;
      $('res-kicker').textContent = r.last ? 'Workshop complete · 全部通关' : 'Stage clear · 过关';
      $('res-stars').innerHTML = [0, 1, 2].map(k => STAR.replace('<svg', '<svg class="' + (k < r.stars ? 'on' : '') + '"')).join('');
      $('res-title').textContent = S.L.name;
      $('res-time').textContent = fmtTime(r.time);
      $('res-gems').textContent = r.gems + ' / ' + r.total;
      $('res-by').textContent = r.by ? nameOf(r.by) : 'the team';
      el.classList.remove('hidden');
    }
    $('res-next').textContent = (r.last ? 'Back to the first stage in ' : 'Next stage in ') + r.left + '…';
  }

  // ---------- input ----------
  const stick = { x: 0, y: 0 };
  const keys = new Set();
  function sendAct(a) {
    unlockAudio();
    if (!me && isBoard) startPlayer('Host');
    if (me) me.send({ type: 'act', a });
  }
  window.addEventListener('keydown', e => {
    if (e.target && e.target.tagName === 'INPUT') return;
    unlockAudio();
    const k = e.key.toLowerCase();
    if (e.repeat) { if (k === ' ' || k.startsWith('arrow')) e.preventDefault(); return; }
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
      keys.add(k); e.preventDefault();
      if (!me && isBoard) startPlayer('Host');
    } else if (k === ' ') { sendAct('jump'); e.preventDefault(); }
    else if (k === 'e' || k === 'f' || k === 'j' || k === 'enter') sendAct('grab');
    else if (k === 'r') sendAct('respawn');
    else if (k >= '1' && k <= '4') { const b = document.querySelectorAll('#calls button')[+k - 1]; if (b && me) me.send({ type: 'call', text: b.dataset.call }); }
    else if (isBoard && k === 'n') admin('next');
    else if (isBoard && k === 'p') admin('prev');
    else if (isBoard && k === 'backspace') admin('restart');
  });
  window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());
  function admin(cmd) { (board || me) && (board || me).send({ type: 'admin', cmd }); }

  function pumpInput() {
    if (!me) return;
    let sx = stick.x, sy = stick.y;
    if (keys.size) {
      sx = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
      sy = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0);
      const l = Math.hypot(sx, sy);
      if (l > 1) { sx /= l; sy /= l; }
    }
    // screen right is world (+x,-z), screen up is world (-x,-z)
    me.input((sx - sy) * Math.SQRT1_2, (-sx - sy) * Math.SQRT1_2);
  }

  if (!isBoard) {
    const zone = $('stick-zone'), base = $('stick-base'), nub = $('stick-nub');
    let pid = null, ox = 0, oy = 0;
    const R = 52;
    const home = () => { base.style.left = ''; base.style.top = ''; base.style.bottom = ''; nub.style.transform = ''; };
    zone.addEventListener('pointerdown', e => {
      if (pid !== null) return;
      unlockAudio();
      pid = e.pointerId; ox = e.clientX; oy = e.clientY;
      zone.setPointerCapture(pid);
      // the stick appears under the thumb, wherever it lands
      const zr = zone.getBoundingClientRect();
      base.style.left = (ox - zr.left - 62) + 'px'; base.style.top = (oy - zr.top - 62) + 'px'; base.style.bottom = 'auto';
      e.preventDefault();
    });
    zone.addEventListener('pointermove', e => {
      if (e.pointerId !== pid) return;
      let dx = e.clientX - ox, dy = e.clientY - oy;
      const l = Math.hypot(dx, dy);
      if (l > R) { dx *= R / l; dy *= R / l; }
      nub.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      const dead = l < 7;
      stick.x = dead ? 0 : dx / R; stick.y = dead ? 0 : -dy / R;
    });
    const end = e => { if (e.pointerId !== pid) return; pid = null; stick.x = stick.y = 0; home(); };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);

    const press = (el, fn) => {
      el.addEventListener('pointerdown', e => { e.preventDefault(); el.classList.add('down'); fn(); if (navigator.vibrate) navigator.vibrate(8); });
      const up = () => el.classList.remove('down');
      el.addEventListener('pointerup', up); el.addEventListener('pointerleave', up); el.addEventListener('pointercancel', up);
    };
    press($('btn-jump'), () => sendAct('jump'));
    press($('btn-grab'), () => sendAct('grab'));
    $('btn-respawn').addEventListener('click', () => sendAct('respawn'));
    // Restart is hold-to-confirm: one stray thumb must not reset everyone's stage.
    const rs = $('btn-restage');
    let rsTimer = 0;
    rs.addEventListener('pointerdown', e => {
      e.preventDefault();
      rs.classList.add('arming');
      rsTimer = setTimeout(() => { rsTimer = 0; rs.classList.remove('arming'); admin('restart'); toast('Stage restarted'); }, 900);
    });
    const rsOff = () => { if (rsTimer) { clearTimeout(rsTimer); rsTimer = 0; toast('Hold to restart the stage'); } rs.classList.remove('arming'); };
    rs.addEventListener('pointerup', rsOff); rs.addEventListener('pointerleave', rsOff); rs.addEventListener('pointercancel', rsOff);
    document.querySelectorAll('#calls button').forEach(b => b.addEventListener('click', () => { unlockAudio(); if (me) me.send({ type: 'call', text: b.dataset.call }); }));
    document.addEventListener('visibilitychange', () => { if (me) me.send({ type: 'visibility', hidden: document.hidden }); });
    document.addEventListener('contextmenu', e => e.preventDefault());

    // name gate
    let saved = '';
    try { saved = localStorage.getItem('ww3d_name') || ''; } catch (e) {}
    const auto = qs.get('name');
    if (qs.get('spectate')) {
      // phone layout, but watching someone else's wobbler (used by tools/capture.py)
      myId = qs.get('spectate');
      primary = new Conn(true);
    } else if (auto || saved) startPlayer(auto || saved);
    else {
      const NAMES = ['Pip', 'Noodle', 'Waffles', 'Bumbo', 'Mochi', 'Tumble', 'Dumpling', 'Biscuit', 'Pudding', 'Sprout'];
      const gate = $('gate'), input = $('gate-name');
      input.placeholder = NAMES[Math.floor(Math.random() * NAMES.length)];
      gate.classList.remove('hidden');
      const go = () => {
        const name = (input.value.trim() || input.placeholder).slice(0, 12);
        try { localStorage.setItem('ww3d_name', name); } catch (e) {}
        unlockAudio();
        gate.classList.add('hidden');
        startPlayer(name);
      };
      $('gate-go').addEventListener('click', go);
      input.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    }
  } else {
    // the board: QR code and stage controls
    const loop = h => h === 'localhost' || h === '127.0.0.1' || h === '::1';
    const host = qs.get('host') || (loop(location.hostname) ? ((cfg.lanIPs || [])[0] || location.hostname) : location.hostname);
    const port = cfg.port || location.port || 80;
    const url = 'http://' + host + ':' + port + '/';
    $('join-url').textContent = host + ':' + port;
    $('lan-port').textContent = port;
    try {
      const qr = window.qrcode(0, 'M');
      qr.addData(url); qr.make();
      $('qr').innerHTML = qr.createImgTag(6, 0);
    } catch (e) { $('qr').textContent = url; }
    $('copy-url').addEventListener('click', () => {
      const done = () => toast('Link copied');
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(url).then(done, () => toast(url));
      else {
        const ta = document.createElement('textarea');
        ta.value = url; document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); done(); } catch (e) { toast(url); }
        ta.remove();
      }
    });
    $('btn-next').addEventListener('click', () => admin('next'));
    $('btn-prev').addEventListener('click', () => admin('prev'));
    $('btn-restart').addEventListener('click', () => admin('restart'));
    window.addEventListener('pointerdown', unlockAudio);
    primary = board = new Conn(true);
    renderRoster();
  }

  // ---------- camera ----------
  function resize() {
    view.W = stageEl.clientWidth || window.innerWidth;
    view.H = stageEl.clientHeight || window.innerHeight;
    renderer.setSize(view.W, view.H, false);
    view.snap = true;
  }
  window.addEventListener('resize', resize);
  resize();

  function updateCamera(dt) {
    const W = view.W, H = view.H, b = view.b;
    const portrait = H > W;
    // keep the stage clear of the HUD: board has a join card on the right, phones have thumbs at the bottom
    const ins = isBoard ? { l: 24, r: 270, t: 70, b: 60 } : portrait ? { l: 8, r: 8, t: 100, b: 210 } : { l: 110, r: 150, t: 52, b: 26 };
    const aw = Math.max(80, W - ins.l - ins.r), ah = Math.max(80, H - ins.t - ins.b);
    const needR = b.r1 - b.r0, needU = b.u1 - b.u0;
    let ppu = Math.min(aw / needR, ah / needU);
    let cr = (b.r0 + b.r1) / 2, cu = (b.u0 + b.u1) / 2;
    // A phone never shows less than ~11 units across. If the stage is bigger than
    // that, the view glides after your wobbler instead. It still never turns.
    const minPpu = isBoard ? 0 : Math.min(W, H) / 11;
    if (ppu < minPpu) {
      ppu = minPpu;
      const mine = wobblers.get(myId);
      const hr = aw / ppu / 2, hu = ah / ppu / 2;
      if (mine) {
        const pr = mine.x * cRight.x + mine.z * cRight.z, pu = mine.x * cUp.x + (mine.y + 0.6) * cUp.y + mine.z * cUp.z;
        if (needR > hr * 2) cr = clamp(pr, b.r0 + hr, b.r1 - hr);
        if (needU > hu * 2) cu = clamp(pu, b.u0 + hu, b.u1 - hu);
      }
    }
    const k = view.snap ? 1 : 1 - Math.exp(-dt * 4);
    view.snap = false;
    view.r += (cr - view.r) * k; view.u += (cu - view.u) * k;
    view.ppu += (ppu - view.ppu) * (k === 1 ? 1 : 1 - Math.exp(-dt * 8));
    view.camR = view.r + (ins.r - ins.l) / 2 / view.ppu;
    view.camU = view.u + (ins.t - ins.b) / 2 / view.ppu;
    cam.left = -W / 2 / view.ppu; cam.right = W / 2 / view.ppu; cam.top = H / 2 / view.ppu; cam.bottom = -H / 2 / view.ppu;
    cam.updateProjectionMatrix();
    cam.position.set(0, 0, 0).addScaledVector(cRight, view.camR).addScaledVector(cUp, view.camU).addScaledVector(cDir, 90);
  }

  // ---------- frame ----------
  const clock = new THREE.Clock();
  let elapsed = 0;
  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;
    const t = elapsed;
    pumpInput();
    if (!S) { renderer.render(scene, cam); return; }

    const k = 1 - Math.exp(-dt * 18);
    // stage rises into place when it loads
    const born = clamp((performance.now() - S.bornAt) / 900, 0, 1);
    S.root.position.y = -(1 - born) * (1 - born) * 5;

    if (snap) {
      for (const wob of wobblers.values()) updateWobbler(wob, dt, t);

      // pillars, plates, crates, gems
      for (let j = 0; j < S.movers.length && j < snap.m.length; j++) {
        const m = S.movers[j];
        m.y += (snap.m[j] - m.y) * k;
        m.g.position.y = m.y;
      }
      for (let j = 0; j < S.plates.length && j < snap.pl.length; j++) {
        const p = S.plates[j];
        p.on += (snap.pl[j] - p.on) * Math.min(1, dt * 14);
        p.cap.position.y = 0.085 - p.on * 0.055;
        p.cap.material.emissiveIntensity = 1 + p.on * 2.2;
        p.glow.material.opacity = p.on * 0.55;
      }
      for (let j = 0; j < S.crates.length && j < snap.cr.length; j++) {
        const c = S.crates[j], s = snap.cr[j];
        if (Math.hypot(s[0] - c.x, s[1] - c.y, s[2] - c.z) > 2.5) { c.x = s[0]; c.y = s[1]; c.z = s[2]; }
        c.x += (s[0] - c.x) * k; c.y += (s[1] - c.y) * k; c.z += (s[2] - c.z) * k;
        c.mesh.position.set(c.x, c.y + 0.45, c.z);
      }
      for (let j = 0; j < S.gems.length; j++) {
        const g = S.gems[j], got = !!snap.g[j];
        g.g.visible = !got;
        g.m.rotation.y = t * 1.8 + j;
        g.g.position.y = g.y + Math.sin(t * 2 + j * 1.7) * 0.08;
      }

      // the Core
      const c = snap.c, holder = c[4] ? wobblers.get(c[4]) : null;
      let tx = c[1], ty = c[2], tz = c[3];
      if (holder) { tx = holder.x; ty = holder.y + 1.15 + holder.body.position.y; tz = holder.z; }
      if (core.fresh || holder || Math.hypot(tx - core.x, ty - core.y, tz - core.z) > 4) { core.x = tx; core.y = ty; core.z = tz; core.fresh = false; }
      else { const kc = 1 - Math.exp(-dt * 26); core.x += (tx - core.x) * kc; core.y += (ty - core.y) * kc; core.z += (tz - core.z) * kc; }
      const scored = c[0] === 's';
      const bob = scored ? 0.5 + Math.sin(t * 3) * 0.15 : 0;
      core.g.position.set(core.x, core.y + 0.3 + bob, core.z);
      core.shell.rotation.set(t * 0.7, t * (scored ? 5 : 1.1), 0);
      const pulse = 1 + Math.sin(t * 4.2) * 0.08;
      core.halo.scale.setScalar((scored ? 2.6 : 1.7) * pulse);
      core.light.intensity = 0.5 + Math.sin(t * 4.2) * 0.08;
      const cgy = c[5] > -50 ? c[5] : core.y;
      core.blob.visible = !holder && c[5] > -50;
      core.blob.position.set(core.x, cgy + 0.025, core.z);
      core.blob.material.opacity = clamp(0.8 - (core.y - cgy) * 0.15, 0.2, 0.8);
      const flying = c[0] === 'l' && core.y - cgy > 0.12;
      core.trail -= dt;
      if (flying && core.trail <= 0) {
        core.trail = 0.03;
        puff(core.x, core.y + 0.3, core.z, { tex: TEX.glow, color: GOLD, add: true, life: 0.35, s0: 0.5, s1: 0.05, a: 0.8 });
      }

      // aim marker
      const a = snap.aim;
      const showAim = !!(a && holder && snap.ph === 'play' && a[1] > -3);
      aim.ring.visible = showAim;
      for (const d of aim.dots) d.visible = showAim;
      if (showAim) {
        const colr = a[3] === 'pass' ? '#7ef0d0' : a[3] === 'dunk' ? GOLD : '#ffffff';
        aim.ring.material.color.set(colr); aim.mat.color.set(colr);
        aim.ring.position.set(a[0], a[1] + (a[3] === 'pass' ? 1.5 : 0.04), a[2]);
        aim.ring.scale.setScalar(1 + Math.sin(t * 6) * 0.07);
        const arc = a[3] === 'place' ? 0.15 : a[3] === 'toss' ? 0.3 : 1.0;
        const ey = a[3] === 'pass' ? a[1] + 1.4 : a[1] + 0.3;
        aim.dots.forEach((d, j) => {
          const f = (j + 1 + (t * 1.6 % 1)) / (aim.dots.length + 1);
          d.position.set(lerp(core.x, a[0], f), lerp(core.y + 0.3, ey, f) + Math.sin(f * Math.PI) * arc, lerp(core.z, a[2], f));
        });
      }

      // the grab button says what it will do
      if (!isBoard) {
        const btn = $('btn-grab'), mine = wobblers.get(myId);
        let label = 'GRAB', dim = true, hot = false;
        if (c[4] === myId && a) { label = a[3] === 'pass' ? 'PASS' : a[3] === 'dunk' ? 'DUNK' : a[3] === 'toss' ? 'TOSS' : 'SET DOWN'; dim = false; }
        else if (mine && c[0] === 'l' && Math.hypot(c[1] - mine.tx, c[3] - mine.tz) < 1.25 && Math.abs(c[2] - mine.ty) < 1.4) { dim = false; hot = true; }
        if ($('grab-lbl').textContent !== label) $('grab-lbl').textContent = label;
        btn.classList.toggle('dim', dim); btn.classList.toggle('hot', hot);
      }
    }

    // beacon, trees, sky
    S.beacon.frame.rotation.y = t * 1.3;
    S.beacon.frame.position.y = 1.9 + Math.sin(t * 1.8) * 0.12;
    S.beacon.beam.material.opacity = 0.75 + Math.sin(t * 2.4) * 0.15;
    S.beacon.halo.scale.setScalar(3 + Math.sin(t * 2.4) * 0.3);
    for (const s of S.sway) s.g.rotation.z = Math.sin(t * 1.3 + s.seed) * 0.05;
    for (const f of S.far) f.m.position.y = f.y + Math.sin(t * 0.5 + f.seed) * 0.35;
    for (const cl of S.clouds) {
      cl.r += cl.v * dt;
      if (cl.r > 30) cl.r = -30;
      cl.sp.position.copy(S.centre).addScaledVector(cRight, cl.r).addScaledVector(cUp, cl.u).addScaledVector(cDir, cl.back);
    }

    for (const p of parts) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { p.sp.visible = false; continue; }
      p.vy -= p.g * dt;
      p.sp.position.x += p.vx * dt; p.sp.position.y += p.vy * dt; p.sp.position.z += p.vz * dt;
      const f = 1 - p.life / p.max, sc = lerp(p.s0, p.s1, f);
      p.sp.scale.set(sc, sc, 1);
      p.sp.material.opacity = p.a * (1 - f * f);
    }

    updateCamera(dt);
    renderer.render(scene, cam);
  }
  buildStage(0);
  frame();

  // for the capture script and for poking around in the console
  window.__ww = { scene, renderer, cam, view, get stage() { return S; }, get snap() { return snap; }, get myId() { return myId; } };
})();
