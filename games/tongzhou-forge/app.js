// 同舟 · Glyph Isles — client (forked from Wobble Works 3D). One file, three jobs:
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
  // Ink and wash. sky runs horizon -> zenith (paper), `ink` paints the far mountains,
  // `water` and `mist` the river the isles stand in, `sunc` the sun or moon disc.
  const PAL = {
    dawn: { sky: ['#f6efde', '#f3e9d4', '#eee1c8', '#e7d8bb'], ink: '#4d6a70', water: '#b9d2cf', mist: '#eef0e2', lite: '#ffffff', sunc: '#d9442b',
      top: '#f7f1e0', topLow: '#e9e0c8', sideA: '#a9b9a6', sideB: '#7f9891', deep: '#3c5258', haze: '#b9d2cf', leaf: '#3f9478', leaf2: '#2a6f5f', trunk: '#4a3b34', gem: '#1fb5a0', sun: '#fff7e0' },
    mint: { sky: ['#eef3e4', '#e4eedd', '#d6e6d6', '#c5dccf'], ink: '#2f6f78', water: '#9fcfd0', mist: '#e6f1e6', lite: '#ffffff', sunc: '#e0563a',
      top: '#f4f3df', topLow: '#dfe8cf', sideA: '#63b3a0', sideB: '#3d8fa0', deep: '#1f4a66', haze: '#9fcfd0', leaf: '#d9573f', leaf2: '#b8402f', trunk: '#3b3a3c', gem: '#e8a33a', sun: '#ffffff' },
    dusk: { sky: ['#f4e6dc', '#edd6cf', '#dcc0c8', '#c4a9c0'], ink: '#5a4a72', water: '#c3b9d2', mist: '#efe4e2', lite: '#ffffff', sunc: '#d9442b',
      top: '#f6eee4', topLow: '#e8dad6', sideA: '#b7a3c0', sideB: '#8b7ba6', deep: '#3e3560', haze: '#c3b9d2', leaf: '#3f9478', leaf2: '#2a6f5f', trunk: '#43364a', gem: '#1fb5a0', sun: '#fff0f4' },
    citrus: { sky: ['#fbf0d2', '#f8e2b0', '#f3cf94', '#eebb7e'], ink: '#8a5a4a', water: '#e6cfa6', mist: '#f8ecd0', lite: '#ffffff', sunc: '#e8402a',
      top: '#fbf4dc', topLow: '#f1e2bc', sideA: '#d9b98a', sideB: '#b98f6e', deep: '#5e3d3a', haze: '#e6cfa6', leaf: '#3f9478', leaf2: '#2a6f5f', trunk: '#4a3b34', gem: '#1fb5a0', sun: '#fffbe0' },
    night: { sky: ['#3b4270', '#2c325e', '#20254c', '#14183a'], ink: '#0c1030', water: '#2b3566', mist: '#414a7e', lite: '#aab4ee', sunc: '#f3f0dc',
      top: '#dfe3f6', topLow: '#bfc6ea', sideA: '#8088c8', sideB: '#565ea6', deep: '#161a44', haze: '#2b3566', leaf: '#4fa89a', leaf2: '#357f86', trunk: '#2a2a4a', gem: '#ffe07a', sun: '#d9dcff', stars: true }
  };
  const LINK = ['#ff6b5e', '#2fb8c6', '#f5a623', '#a368e8'];   // plate <-> pillar colour pairs
  const WOB = ['#ff6b5e', '#ffb02e', '#3ccf8e', '#3aa7ff', '#b07cff', '#ff7fb6', '#22c7c7', '#ffd84d',
    '#8bd450', '#ff8a3d', '#6c7dff', '#e86fd8', '#2fd3a0', '#f25f7a', '#59b8ff', '#c9a36a'];
  const GOLD = '#ffd36e';
  // what a character's stone looks like, by what it does
  const EL = {
    // b is the ink the character is written in (mineral pigments: 石绿, 朱砂, 石青, 藤黄, 墨)
    wood: { a: '#4fb592', b: '#1c6b50', glow: '#8dffd0' },
    fire: { a: '#f0714f', b: '#c22f1c', glow: '#ffb066' },
    water: { a: '#5aa3e0', b: '#1b5aa6', glow: '#a8e0ff' },
    light: { a: '#f2c14e', b: '#b06f06', glow: '#fff2b0' },
    folk: { a: '#8f7bb0', b: '#3a2c52', glow: '#e6d0ff' },
    dusk: { a: '#5b4a8a', b: '#2a1f4a', glow: '#b9a6ff' },
    earth: { a: '#c08a4e', b: '#7a4a22', glow: '#ffd29a' }
  };
  // ---------- the positional forge (ROADMAP F3.2) ----------
  // Labels name the placement, never the result (P9).
  const AIM_LABEL = { join: 'BESIDE', stack: 'ON TOP', forge: 'FORGE', pass: 'PASS', dunk: 'OFFER', toss: 'THROW', place: 'SET DOWN' };
  let fz = { profile: 'standard', assist: 0, forms: true };   // the latest forge knobs from the server
  // what a piece looks like where it sits: 水 in the left slot of ⿰ is drawn 氵 (display only)
  function glyphFor(ch, rel) {
    if (fz.forms === false || !Array.isArray(rel)) return ch;
    return LV.form(ch, rel[0], rel[1]);
  }
  const forgeUI = { dusk: false, duskF: 0, ticks: 0, bursts: 0 };
  const KAI = '"Tongzhou Brush","Kaiti SC","STKaiti","KaiTi","LXGW WenKai","AR PL UKai CN","Noto Serif CJK SC","Songti SC","PingFang SC","Microsoft YaHei",serif';
  const glyph = ch => LV.GLYPHS[ch] || { py: '', en: '', el: 'folk' };
  const elOf = ch => EL[glyph(ch).el] || EL.folk;

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

  // A character is written with a brush, in the mineral ink of what it does, with a
  // rim of bare paper so it reads on dark water and pale rock alike.
  const brushCache = {}, inkCache = {};
  function brushTex(ch, base) {
    const key = ch + (base && base !== ch ? '|' + base : '');
    if (brushCache[key]) return brushCache[key];
    const el = elOf(base || ch);   // a variant form (氵) is written in its base piece's ink (水)
    return brushCache[key] = canvasTex(256, 256, (g) => {
      g.font = '208px ' + KAI; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineJoin = 'round'; g.lineCap = 'round';
      g.shadowColor = 'rgba(20,16,30,0.35)'; g.shadowBlur = 10; g.shadowOffsetY = 4;
      g.strokeStyle = '#fdf8ea'; g.lineWidth = 20; g.strokeText(ch, 128, 132);
      g.shadowColor = 'transparent';
      g.strokeStyle = '#fdf8ea'; g.lineWidth = 14; g.strokeText(ch, 128, 132);
      const grad = g.createLinearGradient(0, 30, 0, 230);
      grad.addColorStop(0, el.b); grad.addColorStop(0.55, el.b); grad.addColorStop(1, el.a);
      g.fillStyle = grad; g.fillText(ch, 128, 132);
      // a dry-brush sheen: a few streaks of thinner ink
      g.globalCompositeOperation = 'source-atop'; g.globalAlpha = 0.13; g.fillStyle = '#ffffff';
      for (let k = 0; k < 9; k++) g.fillRect(30, 44 + k * 21 + hash(k, ch.charCodeAt(0), 51) * 9, 196, 2.2);
    });
  }
  // the bare character in white, to be tinted: ink in daylight, glow at night
  function inkTex(ch) {
    if (inkCache[ch]) return inkCache[ch];
    return inkCache[ch] = canvasTex(256, 256, (g) => {
      g.font = '214px ' + KAI; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = 'rgba(255,255,255,0.8)'; g.shadowBlur = 14;
      g.fillStyle = '#ffffff'; g.fillText(ch, 128, 132);
      g.shadowBlur = 0; g.fillText(ch, 128, 132);
    });
  }

  // The backdrop is one painting: paper, a red sun, ranges of ink mountains losing
  // their feet in mist, and below them the mist the river fades into.
  function skyTexture(pal, seed) {
    seed = seed || 0;
    return canvasTex(1024, 1024, (g, w, h) => {
      const grad = g.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, pal.sky[3]); grad.addColorStop(0.1, pal.sky[2]);
      grad.addColorStop(0.22, pal.sky[0]); grad.addColorStop(0.36, pal.mist); grad.addColorStop(1, pal.mist);
      g.fillStyle = grad; g.fillRect(0, 0, w, h);
      if (pal.stars) {
        for (let i = 0; i < 170; i++) {
          const a = hash(i, 3, 1), y = hash(i, 9, 2) * h * 0.24;
          g.fillStyle = 'rgba(255,255,255,' + (0.2 + a * 0.6) * (1 - y / (h * 0.27)) + ')';
          g.fillRect(hash(i, 5, 3) * w, y, 2 + (a > 0.85 ? 1 : 0), 2 + (a > 0.85 ? 1 : 0));
        }
      }
      // sun or moon: a flat disc, as on a scroll
      const sx = w * 0.2, sy = h * 0.115, sr = w * 0.04;
      const halo = g.createRadialGradient(sx, sy, sr * 0.8, sx, sy, sr * 4.5);
      halo.addColorStop(0, pal.stars ? 'rgba(243,240,220,0.28)' : 'rgba(217,68,43,0.2)'); halo.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = halo; g.fillRect(0, 0, w, h);
      g.fillStyle = pal.sunc; g.beginPath(); g.arc(sx, sy, sr, 0, 7); g.fill();
      // mountain ranges, far to near
      const ink = C(pal.ink), r = Math.round(ink.r * 255), gg = Math.round(ink.g * 255), b = Math.round(ink.b * 255);
      for (let L = 0; L < 4; L++) {
        const base = h * (0.2 + L * 0.04), amp = h * (0.15 - L * 0.022), alpha = 0.2 + L * 0.15;
        const ys = [];
        for (let x = 0; x <= w; x += 4) {
          const u = x / w * (2.2 + L * 0.9) + L * 7.3 + seed * 3.1;
          // sharp karst peaks: ridged noise from a few sines
          let n = 0, f = 1, a = 1, tot = 0;
          for (let o = 0; o < 4; o++) { n += (1 - Math.abs(Math.sin(u * f * 2.4 + o * 1.7 + L))) * a; tot += a; f *= 2.1; a *= 0.5; }
          n /= tot;
          ys.push(base - amp * Math.pow(n, 2.2) * (0.55 + 0.45 * Math.sin(u * 0.9 + L * 2) ** 2));
        }
        const fade = g.createLinearGradient(0, base - amp, 0, base + h * 0.07);
        fade.addColorStop(0, 'rgba(' + r + ',' + gg + ',' + b + ',' + alpha + ')');
        fade.addColorStop(0.55, 'rgba(' + r + ',' + gg + ',' + b + ',' + alpha * 0.55 + ')');
        fade.addColorStop(1, 'rgba(' + r + ',' + gg + ',' + b + ',0)');
        g.fillStyle = fade;
        g.beginPath(); g.moveTo(0, base + h * 0.08);
        ys.forEach((y, k) => g.lineTo(k * 4, y));
        g.lineTo(w, base + h * 0.08); g.closePath(); g.fill();
      }
      // a few birds
      g.strokeStyle = 'rgba(' + r + ',' + gg + ',' + b + ',0.55)'; g.lineWidth = 2.2; g.lineCap = 'round';
      for (let k = 0; k < 5; k++) {
        const bx = w * (0.5 + hash(k, seed, 61) * 0.3), by = h * (0.04 + hash(k, seed, 62) * 0.07), s = 7 + hash(k, seed, 63) * 6;
        g.beginPath(); g.moveTo(bx - s, by - s * 0.3); g.quadraticCurveTo(bx - s * 0.4, by - s * 0.7, bx, by);
        g.quadraticCurveTo(bx + s * 0.4, by - s * 0.7, bx + s, by - s * 0.3); g.stroke();
      }
      // paper grain
      for (let k = 0; k < 2600; k++) {
        g.fillStyle = hash(k, 1, 64) > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(60,40,20,0.035)';
        g.fillRect(hash(k, 2, 65) * w, hash(k, 3, 66) * h, 1 + hash(k, 4, 67) * 3, 1);
      }
    });
  }

  // The river: flat wash, brush ripples, and it thins into the paper with distance.
  const water = (() => {
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uColor: { value: C('#b9d2cf') }, uLite: { value: C('#ffffff') }, uCentre: { value: new THREE.Vector2() }, uR: { value: new THREE.Vector2(10, 30) }, uBack: { value: new THREE.Vector2(8, 16) }, uK: { value: 0.55 }, uT: { value: 0 } },
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: [
        'uniform vec3 uColor; uniform vec3 uLite; uniform vec2 uCentre; uniform vec2 uR; uniform vec2 uBack; uniform float uK; uniform float uT; varying vec3 vW;',
        'void main(){',
        '  vec2 p = vW.xz; float d = distance(p, uCentre);',
        '  float a = 1.0 - smoothstep(uR.x, uR.y, d);',
        // behind the isles (up the screen) the river thins into mist, so the mountains stand clear
        '  float back = dot(p - uCentre, vec2(-0.7071, -0.7071));',
        '  a *= 1.0 - smoothstep(uBack.x, uBack.y, back);',
        // ripples run across the view diagonal, broken into short brush dashes
        '  float u = (p.x + p.y) * 0.7071, v = (p.x - p.y) * 0.7071;',
        '  float line = sin(u * 5.2 + sin(v * 0.55 + uT * 0.5) * 1.6 + uT * 0.35);',
        '  float dash = sin(v * 0.9 + floor(u * 0.83) * 2.4 + uT * 0.2);',
        '  float s = smoothstep(0.93, 1.0, line) * smoothstep(0.1, 0.7, dash);',
        '  float line2 = sin(u * 2.3 - uT * 0.25 + sin(v * 0.31) * 2.0);',
        '  s += smoothstep(0.97, 1.0, line2) * 0.6 * smoothstep(-0.2, 0.6, sin(v * 0.4 + floor(u * 0.37) * 1.9));',
        '  vec3 col = mix(uColor, uLite, clamp(s, 0.0, 1.0) * uK);',
        '  gl_FragColor = vec4(col, a * 0.9);',
        '}'].join('\n')
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = -5;
    scene.add(mesh);
    return { mesh, mat, u: mat.uniforms };
  })();

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
    S = { i, L, grid, pal, root, plates: [], movers: [], crates: [], gems: [], spin: [], sway: [], bridges: [], grow: [], day: null, napAll: false, bornAt: performance.now() };
    hemi.intensity = 0.7; sun.intensity = 0.36;
    for (const st of [...stones.values()]) removeStone(st);
    scene.background = skyTex = skyTexture(pal, i);
    water.u.uColor.value.set(pal.water); water.u.uLite.value.set(pal.lite);
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
      const g = new THREE.Group();
      if (m.kind) {
        // a wall that stands until the right character comes near, then sinks into the floor
        const H = m.from - m.to;
        g.position.set(mx + mw / 2, m.to, mz + md / 2);
        const body = shade(new THREE.Mesh(new THREE.BoxGeometry(mw - 0.02, 9, md - 0.02), lam(pal._a.clone().lerp(pal._b, 0.5))));
        body.position.y = -4.5;
        const scorch = new THREE.Mesh(new THREE.PlaneGeometry(mw - 0.1, md - 0.1), new THREE.MeshBasicMaterial({ color: m.kind === 'thorn' ? '#5d4a66' : m.kind === 'shade' ? '#3a3350' : '#6a7fa0', transparent: true, opacity: 0.35 }));
        scorch.rotation.x = -Math.PI / 2; scorch.position.y = 0.008;
        const deco = new THREE.Group();
        const flames = [];
        const rnd = (k, q) => hash(mx * 7 + k, mz * 3 + q, 21);
        if (m.kind === 'thorn') {
          const coreBox = shade(new THREE.Mesh(new THREE.BoxGeometry(mw - 0.24, H * 0.86, md - 0.24), lam('#4a2f5c')));
          coreBox.position.y = H * 0.43;
          deco.add(coreBox);
          const spikeA = lam('#7b4a86', { flatShading: true }), spikeB = lam('#a7689c', { flatShading: true }), leaf = lam('#2f7a66', { flatShading: true });
          const berry = new THREE.MeshBasicMaterial({ color: '#ff5d7a' });
          const n = Math.round(26 * mw * md);
          for (let k = 0; k < n; k++) {
            const sp = shade(new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.42, 5), k % 3 ? spikeA : spikeB), true, false);
            const u = rnd(k, 1), v = rnd(k, 2), face = k % 3;
            let px, py, pz, dx = 0, dy = 0, dz = 0;
            if (face === 0) { px = mw / 2 - 0.12; pz = (v - 0.5) * (md - 0.3); py = 0.15 + u * (H - 0.3); dx = 1; }
            else if (face === 1) { pz = md / 2 - 0.12; px = (v - 0.5) * (mw - 0.3); py = 0.15 + u * (H - 0.3); dz = 1; }
            else { px = (u - 0.5) * (mw - 0.3); pz = (v - 0.5) * (md - 0.3); py = H * 0.86; dy = 1; }
            const dir = new THREE.Vector3(dx + (rnd(k, 3) - 0.5) * 0.9, dy + (rnd(k, 4) - 0.2) * 0.9, dz + (rnd(k, 5) - 0.5) * 0.9).normalize();
            sp.position.set(px + dir.x * 0.15, py + dir.y * 0.15, pz + dir.z * 0.15);
            sp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
            deco.add(sp);
            if (k % 4 === 0) {
              const lf = shade(new THREE.Mesh(new THREE.IcosahedronGeometry(0.13 + rnd(k, 6) * 0.08, 0), leaf), true, false);
              lf.position.set(px * 0.92, py, pz * 0.92); deco.add(lf);
            }
            if (k % 7 === 0) { const br = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), berry); br.position.copy(sp.position).addScaledVector(dir, 0.1); deco.add(br); }
          }
        } else if (m.kind === 'shade') {
          // shade: a wall of ink cloud that light breaks up
          const ink = new THREE.MeshLambertMaterial({ color: '#2a2440', transparent: true, opacity: 0.86, flatShading: true });
          const ink2 = new THREE.MeshLambertMaterial({ color: '#433a66', transparent: true, opacity: 0.7, flatShading: true });
          const n = Math.round(10 * mw * md + 6);
          for (let k = 0; k < n; k++) {
            const r = 0.32 + rnd(k, 1) * 0.3;
            const puffM = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), k % 3 ? ink : ink2);
            puffM.position.set((rnd(k, 3) - 0.5) * (mw - 0.35), r + rnd(k, 2) * (H - r * 1.6), (rnd(k, 4) - 0.5) * (md - 0.35));
            deco.add(puffM);
            flames.push({ m: puffM, h: 0, seed: rnd(k, 5) * 9, cloud: true, y0: puffM.position.y });
          }
          const gl = sprite(TEX.glow, '#6a5aa0', 0.35, false);
          gl.scale.set(Math.max(mw, md) * 2.4, H * 2.4, 1); gl.position.y = H * 0.5;
          deco.add(gl);
        } else {
          const cols = ['#ff5a2a', '#ff8a2e', '#ffc94a', '#fff0a0'];
          const n = Math.round(9 * mw * md);
          for (let k = 0; k < n; k++) {
            const r = 0.2 + rnd(k, 1) * 0.16, h = H * (0.55 + rnd(k, 2) * 0.55);
            const fm = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7, 1, true),
              new THREE.MeshBasicMaterial({ color: cols[k % 4], transparent: true, opacity: 0.78, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
            fm.position.set((rnd(k, 3) - 0.5) * (mw - 0.3), h / 2, (rnd(k, 4) - 0.5) * (md - 0.3));
            deco.add(fm);
            flames.push({ m: fm, h, seed: rnd(k, 5) * 9 });
          }
          const gl = sprite(TEX.glow, '#ff8a2e', 0.6, true);
          gl.scale.set(Math.max(mw, md) * 2.2, H * 2.6, 1); gl.position.y = H * 0.5;
          const light = new THREE.PointLight(0xff8a3a, 0.9, 7, 1.6);
          light.position.y = H * 0.6;
          deco.add(gl, light);
        }
        g.add(body, scorch, deco);
        root.add(g);
        S.movers.push({ g, y: m.from, wall: { kind: m.kind, deco, flames, from: m.from, to: m.to, x: mx + mw / 2, z: mz + md / 2, w: mw, d: md } });
        continue;
      }
      const col = C(LINK[m.c | 0]);
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
    // glow-gems: only there while the isle is dim (dusk); the sim keeps them after the gems in s.g
    for (const gm of L.glow || []) {
      const y = gm[2] != null ? gm[2] : floorAt(gm[0], gm[1]) + 0.7;
      const g = new THREE.Group();
      g.position.set(gm[0], y, gm[1]);
      const col = C(EL.dusk.glow);
      const m = shade(new THREE.Mesh(new THREE.OctahedronGeometry(0.22), lam(col, { emissive: col.clone().multiplyScalar(0.9), flatShading: true })), true, false);
      m.scale.y = 1.35;
      const halo = sprite(TEX.glow, col, 0.9, true);
      halo.scale.set(1.6, 1.6, 1);
      g.add(m, halo);
      g.visible = false;
      root.add(g);
      S.gems.push({ g, m, y, got: false, glow: true });
    }

    // --- the shrine: a small pavilion that shows the character it is waiting for ---
    {
      const by = floorAt(L.beacon[0], L.beacon[1]);
      const g = new THREE.Group();
      g.position.set(L.beacon[0], by, L.beacon[1]);
      const gold = C(GOLD);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 10, 40), new THREE.MeshBasicMaterial({ color: gold }));
      ring.rotation.x = Math.PI / 2; ring.position.y = 0.06;
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.6, 32), new THREE.MeshBasicMaterial({ color: gold, transparent: true, opacity: 0.32, depthWrite: false }));
      disc.rotation.x = -Math.PI / 2; disc.position.y = 0.02;
      const red = lam('#c8402c'), tile = lam('#3f5560', { flatShading: true }), eave = lam('#2c3d46', { flatShading: true });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const post = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 2.5, 8), red));
        post.position.set(sx * 0.78, 1.25, sz * 0.78);
        g.add(post);
      }
      const beamBox = shade(new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 1.8), red));
      beamBox.position.y = 2.5;
      const roofLow = shade(new THREE.Mesh(new THREE.ConeGeometry(1.75, 0.42, 4), eave));
      roofLow.rotation.y = Math.PI / 4; roofLow.position.y = 2.76;
      const roof = shade(new THREE.Mesh(new THREE.ConeGeometry(1.25, 0.8, 4), tile));
      roof.rotation.y = Math.PI / 4; roof.position.y = 3.15;
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), new THREE.MeshBasicMaterial({ color: gold }));
      knob.position.y = 3.62;
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.55, 2.4, 28, 1, true),
        new THREE.MeshBasicMaterial({ map: TEX.beam, color: gold, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
      beam.position.y = 1.2;
      // the character it wants hangs above the roof, in gold
      const frame = sprite(inkTex(L.want), pal.stars ? '#ffd36e' : '#b46a00', 0.95, false);
      frame.material.depthTest = false; frame.renderOrder = 12;
      frame.scale.set(2.2, 2.2, 1); frame.position.y = 4.9;
      const halo = sprite(TEX.glow, gold, 0.5, true);
      halo.scale.set(3, 3, 1); halo.position.y = 0.5;
      g.add(ring, disc, beamBox, roofLow, roof, knob, beam, frame, halo);
      root.add(g);
      S.beacon = { g, ring, beam, frame, halo, y: by };
      // and a little spring pad under every stone: used-up stones grow back here
      for (const d of L.stones || []) {
        const stand = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.07, 24), lam(C(elOf(d[0]).a).lerp(C(pal.top), 0.45))), false);
        stand.position.set(d[1], floorAt(d[1], d[2]) + 0.035, d[2]);
        root.add(stand);
      }
    }

    // --- trees ---
    const leafMat = lam(pal.leaf, { flatShading: true }), leafMat2 = lam(pal.leaf2, { flatShading: true }), trunkMat = lam(pal.trunk);
    function tree(x, y, z, s) {
      const g = new THREE.Group();
      g.position.set(x, y, z); g.scale.setScalar(s);
      const trunk = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.075, 0.62, 6), trunkMat));
      trunk.position.y = 0.31; trunk.rotation.z = (hash(x, z, 71) - 0.5) * 0.25;
      g.add(trunk);
      // a pine in three flat tiers, the way it is dabbed onto a scroll
      [[0.44, 0.5, leafMat2], [0.35, 0.74, leafMat], [0.24, 0.96, leafMat2]].forEach((b, k) => {
        const m = shade(new THREE.Mesh(new THREE.ConeGeometry(b[0], 0.3, 7), b[2]));
        m.position.set((hash(x + k, z, 72) - 0.5) * 0.12, b[1], (hash(x, z + k, 73) - 0.5) * 0.12);
        g.add(m);
      });
      S.sway.push({ g, seed: hash(x, z, 5) * 6 });
      return g;
    }
    for (const t of L.trees || []) root.add(tree(t[0], floorAt(t[0], t[1]), t[1], 0.9 + hash(t[0], t[1], 4) * 0.35));
    S.tree = tree; S.floorAt = floorAt;

    // --- far karst pillars standing in the river, and drifting mist ---
    const centre = new THREE.Vector3(w / 2, 1, d / 2);
    S.far = [];
    const farMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    for (let k = 0; k < 7; k++) {
      const fg = new Geo(), fpal = Object.assign({}, pal);
      const dim = 0.35 + hash(k, i, 13) * 0.4;
      fpal._a = pal._a.clone().lerp(pal._haze, dim); fpal._b = pal._b.clone().lerp(pal._haze, dim);
      const ft = C(pal.top).lerp(pal._haze, dim);
      const n = 2 + Math.floor(hash(k, i, 6) * 3);
      for (let j = 0; j < n; j++) {
        const hx = Math.floor(hash(k, j, 7) * 2.2), hz = Math.floor(hash(k, j, 8) * 2.2), hh = 1.2 + hash(k, j, 9) * 4.2;
        fg.column(hx, hx + 1, hz, hz + 1, -2, hh, ft, fpal);
      }
      const m = fg.mesh(farMat);
      const side = k % 2 ? 1 : -1;
      const r = side * (w * 0.5 + 2 + hash(k, i, 11) * 9), back = 2 + hash(k, i, 12) * 9;
      m.position.set(centre.x + cRight.x * r - back * Math.SQRT1_2, 0, centre.z + cRight.z * r - back * Math.SQRT1_2);
      root.add(m);
      const pine = tree(m.position.x + 0.5, 0, m.position.z + 0.5, 1.1);
      pine.position.y = 1.2 + hash(k, 0, 9) * 4.2;
      root.add(pine);
      S.far.push({ m, y: 0, seed: k * 1.7 });
    }
    S.clouds = [];
    for (let k = 0; k < 9; k++) {
      const sp = sprite(TEX.cloud, pal.mist, pal.stars ? 0.3 : 0.75);
      const sc = 7 + hash(k, i, 14) * 8;
      sp.scale.set(sc, sc * 0.42, 1);
      const cl = { sp, r: -26 + hash(k, i, 15) * 52, u: -9 + hash(k, i, 16) * 13, v: 0.12 + hash(k, i, 17) * 0.22, back: -20 - k * 3 };
      root.add(sp);
      S.clouds.push(cl);
    }
    S.centre = centre;
    water.u.uCentre.value.set(centre.x, centre.z);
    water.u.uR.value.set(Math.max(w, d) * 0.5 + 6, Math.max(w, d) * 0.5 + 26);
    { const far = (w + d) * 0.5 * Math.SQRT1_2; water.u.uBack.value.set(far + 1.5, far + 8.5); }
    water.u.uK.value = pal.stars ? 0.22 : 0.55;

    // --- 同舟: the boat everyone sails in on, and out on. Its deck is real floor. ---
    S.boat = null;
    if (L.boat) {
      const r = L.boat.rect, dh = grid.at(Math.floor(L.spawn[0]), Math.floor(L.spawn[1])).h;
      const to = L.boat.to || [0, -1], alongX = Math.abs(to[0]) > Math.abs(to[1]);
      const W = alongX ? r[3] : r[2], Lz = alongX ? r[2] : r[3];   // beam and length; the bow points down local -Z
      const bg = new THREE.Group();
      const hullMat = lam('#6b4630'), deckMat = lam('#b98a5a'), trimMat = lam('#8a2f22');
      const plan = (w, l, nose) => {
        const sh = new THREE.Shape();
        sh.moveTo(-w / 2, -l / 2); sh.lineTo(0, -l / 2 - nose); sh.lineTo(w / 2, -l / 2);
        sh.lineTo(w / 2, l / 2); sh.lineTo(w * 0.3, l / 2 + nose * 0.55); sh.lineTo(-w * 0.3, l / 2 + nose * 0.55); sh.closePath();
        return sh;
      };
      const slab = (shape, y0, y1, mat) => {
        const m = shade(new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: y1 - y0, bevelEnabled: false }), mat));
        m.rotation.x = Math.PI / 2; m.position.y = y1;   // shape y becomes world z, extruded downward
        return m;
      };
      bg.add(slab(plan(W + 0.3, Lz + 0.2, 1.5), -0.4, dh - 0.07, hullMat));
      const deck = shade(new THREE.Mesh(new THREE.BoxGeometry(W, 0.07, Lz), deckMat));
      deck.position.y = dh - 0.035; bg.add(deck);
      for (let k = 1; k < Lz / 0.5; k++) {   // plank seams
        const seam = new THREE.Mesh(new THREE.BoxGeometry(W, 0.012, 0.03), lam('#8f6a44'));
        seam.position.set(0, dh + 0.004, -Lz / 2 + k * 0.5); bg.add(seam);
      }
      // raised bow and stern: not deck, so nobody expects to stand there
      const tip = new THREE.Shape(); tip.moveTo(-W / 2 - 0.15, -Lz / 2 - 0.1); tip.lineTo(0, -Lz / 2 - 1.6); tip.lineTo(W / 2 + 0.15, -Lz / 2 - 0.1); tip.closePath();
      bg.add(slab(tip, dh - 0.07, dh + 0.3, hullMat));
      const aft = new THREE.Shape(); aft.moveTo(-W / 2 - 0.15, Lz / 2 + 0.1); aft.lineTo(W / 2 + 0.15, Lz / 2 + 0.1); aft.lineTo(W * 0.3, Lz / 2 + 0.92); aft.lineTo(-W * 0.3, Lz / 2 + 0.92); aft.closePath();
      bg.add(slab(aft, dh - 0.07, dh + 0.22, hullMat));
      const band = shade(new THREE.Mesh(new THREE.BoxGeometry(W + 0.34, 0.1, Lz + 0.2), trimMat)); band.position.y = dh - 0.2; bg.add(band);
      // a battened junk sail on the bow, behind where people stand
      const mast = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 3.6, 6), lam('#4a3a2a')));
      mast.position.set(0, dh + 1.9, -Lz / 2 - 0.55); bg.add(mast);
      const sc = document.createElement('canvas'); sc.width = 128; sc.height = 160;
      { const x = sc.getContext('2d'); x.fillStyle = '#c9a66b'; x.fillRect(0, 0, 128, 160);
        const gr = x.createLinearGradient(0, 0, 128, 0); gr.addColorStop(0, 'rgba(90,50,20,0.28)'); gr.addColorStop(0.5, 'rgba(255,240,200,0.12)'); gr.addColorStop(1, 'rgba(90,50,20,0.22)');
        x.fillStyle = gr; x.fillRect(0, 0, 128, 160);
        x.strokeStyle = 'rgba(70,45,25,0.75)'; x.lineWidth = 3; for (let k = 1; k < 7; k++) { x.beginPath(); x.moveTo(0, k * 23); x.lineTo(128, k * 23 - 5); x.stroke(); }
        x.fillStyle = '#b02a1c'; x.font = '64px ' + KAI; x.textAlign = 'center'; x.textBaseline = 'middle'; x.globalAlpha = 0.85; x.fillText('舟', 64, 84); }
      const sail = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.86, 2.3), new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(sc), side: THREE.DoubleSide }));
      sail.position.set(0, dh + 2.2, -Lz / 2 - 0.5); sail.rotation.y = 0.22; bg.add(sail);
      const post = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 5), lam('#4a3a2a'))); post.position.set(W * 0.22, dh + 0.7, Lz / 2 + 0.6); bg.add(post);
      const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ color: '#e8402a' }));
      lantern.position.set(W * 0.22, dh + 1.3, Lz / 2 + 0.6);
      const lglow = sprite(TEX.glow, '#ff8a4a', pal.stars ? 0.7 : 0.25, true); lglow.scale.set(1.5, 1.5, 1); lglow.position.copy(lantern.position);
      bg.add(lantern, lglow);
      // "all aboard": 舟 hangs over the deck once the shrine has answered
      const mc = document.createElement('canvas'); mc.width = 384; mc.height = 160;
      { const x = mc.getContext('2d'); x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '900 58px system-ui, sans-serif';
        x.lineWidth = 12; x.lineJoin = 'round'; x.strokeStyle = '#fdf6e6'; x.strokeText('ALL ABOARD', 192, 52); x.fillStyle = '#b02a1c'; x.fillText('ALL ABOARD', 192, 52);
        x.beginPath(); x.moveTo(152, 100); x.lineTo(232, 100); x.lineTo(192, 150); x.closePath(); x.stroke(); x.fill(); }
      const mark = sprite(new THREE.CanvasTexture(mc), '#ffffff', 1, false);
      mark.material.depthTest = false; mark.renderOrder = 12; mark.scale.set(3.6, 1.5, 1); mark.position.y = dh + 3.2; mark.visible = false;
      bg.add(mark);
      bg.rotation.y = alongX ? (to[0] < 0 ? Math.PI / 2 : -Math.PI / 2) : (to[1] < 0 ? 0 : Math.PI);
      const cx = r[0] + r[2] / 2 + (L.boat.from ? L.boat.from[0] : 0), cz = r[1] + r[3] / 2 + (L.boat.from ? L.boat.from[1] : 0);
      bg.position.set(cx, 0, cz);
      root.add(bg);
      S.boat = { g: bg, mark, x: cx, z: cz, fresh: true, wake: 0 };
    }

    // --- fit the fixed camera and the sun's shadow box to this stage ---
    const b = { r0: 1e9, r1: -1e9, u0: 1e9, u1: -1e9 };
    for (const x of [-0.6, w + 0.6]) for (const z of [-0.6, d + 0.6]) for (const y of [-0.4, grid.maxH + 3.4]) {
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
    // English first: the players are learners, the Chinese name is the extra
    $('tc-num').textContent = 'Isle ' + (i + 1) + ' of ' + LV.LEVELS.length;
    $('tc-name').textContent = L.name;
    $('tc-cn').textContent = L.cn;
    const tc = $('title-card');
    tc.classList.remove('show'); void tc.offsetWidth; tc.classList.add('show');
    clearGoal(); note('goal', L.hint);
    $('want').textContent = L.want;
    $('gems').innerHTML = (L.gems || []).map(() => '<span class="gem"></span>').join('') + (L.glow || []).map(() => '<span class="gem glow"></span>').join('');
    $('result').classList.add('hidden');
    const veil = $('veil');
    veil.classList.remove('mist');
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
    // everyone wears a bamboo rain hat (斗笠), with a knot in their own colour
    const hat = new THREE.Group();
    hat.position.y = 0.86;
    let spinner = null;
    const straw = shade(new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.2, 14), lam('#dcbd78', { flatShading: true })), true, false);
    straw.position.y = 0.1;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.39, 0.016, 5, 20), lam('#a8843f'));
    rim.rotation.x = Math.PI / 2; rim.position.y = 0.012;
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: col }));
    knot.position.y = 0.21;
    hat.add(straw, rim, knot);
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

    if (wob.y < 0 && !wob.wet) splash(wob.x, wob.z);
    wob.wet = wob.y < 0;
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
    const closed = afk || (S && S.napAll) || wob.blink < 0.11;
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

    place(wob.tag, wob.x, wob.y + (carrying ? 2.25 : 1.28), wob.z);
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

  // ---------- character stones ----------
  const stones = new Map();
  const VIEW_YAW = Math.PI / 4;   // the fixed camera sits on the +X/+Z diagonal, so tiles face it
  function makeStone(id, ch) {
    const el = elOf(ch), info = glyph(ch);
    const g = new THREE.Group();
    const sp = sprite(brushTex(ch), '#ffffff', 1, false);
    sp.scale.set(1.35, 1.35, 1);
    sp.renderOrder = 3;
    const halo = sprite(TEX.glow, el.glow, S && S.pal.stars ? 0.5 : 0.22, true);
    halo.scale.set(2.3, 2.3, 1);
    g.add(halo, sp);
    // a wet ink blot under it instead of a shadow
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95), new THREE.MeshBasicMaterial({ map: TEX.shadow, color: el.b, transparent: true, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2;
    scene.add(g, blob);
    const tag = document.createElement('div');
    tag.className = 'stag';
    tag.innerHTML = '<b></b><span></span>';
    tag.firstChild.textContent = info.py;
    tag.lastChild.textContent = info.en;
    tag.style.setProperty('--el', el.b);
    tagsEl.appendChild(tag);
    const st = { id, ch, g, sp, halo, blob, tag, x: 0, y: 0, z: 0, fresh: true, trail: 0, wet: false, born: performance.now(), seed: (id * 1.7) % 6 };
    stones.set(id, st);
    return st;
  }
  function removeStone(st) {
    scene.remove(st.g, st.blob);
    st.sp.material.dispose();
    st.halo.material.dispose();
    st.blob.geometry.dispose(); st.blob.material.dispose();
    st.tag.remove();
    stones.delete(st.id);
  }

  // rings on the water where something went in
  function splash(x, z) {
    for (let k = 0; k < 14; k++) {
      const a = Math.random() * 6.283, v = 1 + Math.random() * 2.2;
      puff(x, 0.05, z, { color: '#ffffff', life: 0.5 + Math.random() * 0.4, vx: Math.cos(a) * v * 0.5, vy: 2.5 + Math.random() * 3, vz: Math.sin(a) * v * 0.5, g: 12, s0: 0.12, s1: 0.04, a: 0.9 });
    }
    for (let k = 0; k < 3; k++) rings.push({ x, z, t: -k * 0.22 });
    sfx.douse();
  }
  const rings = [];
  const ringPool = [];
  for (let k = 0; k < 12; k++) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 40), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.03; m.visible = false; m.renderOrder = -4;
    scene.add(m);
    ringPool.push(m);
  }

  // a huge glowing character that swells and fades: "this is what just happened"
  const glyphFx = [];
  function glyphBurst(ch, x, y, z, color, big, ink) {
    ink = ink || elOf(ch).b;
    // at night it glows; by day it is ink blooming in water
    const night = !!(S && S.pal.stars && !S.day);
    const sp = sprite(inkTex(ch), night ? (color || '#ffffff') : (ink || '#2b2540'), 1, night);
    sp.material.depthTest = false; sp.renderOrder = 20;
    scene.add(sp);
    glyphFx.push({ sp, life: 0, max: big ? 2.6 : 1.5, x, y, z, s0: big ? 1.4 : 0.8, s1: big ? 11 : 4.5 });
  }

  // ---------- forge: placement frames and the slide-together burst (F3.2, FG-D017) ----------
  // While two stones rest in a placement, a frame is drawn round them: two columns for BESIDE (⿰),
  // two rows for ON TOP (⿱), each stone in its own cell. It looks the same whether or not the pair
  // makes anything (P9: no preview). After a dud the frame says so; after a near miss a dashed frame
  // says the stones are close but not in a placement, so a forge that never started is not silent.
  const frameLayer = document.createElement('div');
  frameLayer.className = 'pframes';
  tagsEl.appendChild(frameLayer);
  const framePool = [];
  const frameFlags = new Map();   // "idA,idB" -> { kind: 'no' | 'near', op, until }
  const pairKey = (i, j) => Math.min(i, j) + ',' + Math.max(i, j);
  function flagFrame(ia, ib, kind, op, secs) {
    if (!ia || !ib) return;
    frameFlags.set(pairKey(ia, ib), { kind, op, ia, ib, until: performance.now() + secs * 1000 });
  }
  function screenOf(v) {
    return [view.W / 2 + (v.x * cRight.x + v.z * cRight.z - view.camR) * view.ppu,
            view.H / 2 - (v.x * cUp.x + v.y * cUp.y + v.z * cUp.z - view.camU) * view.ppu];
  }
  function drawMarks() {
    const now = performance.now(), want = new Map();
    for (const st of stones.values()) {
      const r = st.rel;
      if (!r || r[1] !== 1 || !st.g.visible) continue;
      const o = stones.get(r[2]);
      if (!o || !o.g.visible) continue;
      want.set(pairKey(st.id, o.id), { op: r[0], a: st, b: o });
    }
    for (const [k, f] of frameFlags) {
      if (now > f.until) { frameFlags.delete(k); continue; }
      if (want.has(k)) continue;
      const a = stones.get(f.ia), b = stones.get(f.ib);
      if (a && b && a.g.visible && b.g.visible) want.set(k, { op: f.op, a, b });
    }
    let n = 0, ticks = 0;
    for (const [k, w] of want) {
      let el = framePool[n];
      if (!el) {
        el = document.createElement('div');
        el.innerHTML = '<i></i><em></em>';
        frameLayer.appendChild(el); framePool.push(el);
      }
      const side = w.op === '⿰', f = frameFlags.get(k);
      const kind = f ? f.kind : '';
      if (!f || f.kind !== 'near') ticks++;   // a near miss is not a placement
      const [ax, ay] = screenOf(w.a.g.position), [bx, by] = screenOf(w.b.g.position);
      const cell = 1.3 * view.ppu;   // a stone's glyph is ~1.35 units across
      const wpx = Math.abs(ax - bx) + cell, hpx = Math.abs(ay - by) + cell;
      el.className = 'pframe ' + (side ? 'side' : 'top') + (kind ? ' ' + kind : '');
      el.style.width = wpx.toFixed(0) + 'px'; el.style.height = hpx.toFixed(0) + 'px';
      el.style.transform = 'translate(' + ((ax + bx) / 2).toFixed(1) + 'px,' + ((ay + by) / 2).toFixed(1) + 'px) translate(-50%,-50%)';
      el.lastChild.textContent = kind === 'no' ? '✕ ' + (side ? 'BESIDE' : 'ON TOP') : kind === 'near' ? 'NOT QUITE' : side ? 'BESIDE' : 'ON TOP';
      el.style.display = '';
      n++;
    }
    for (let j = n; j < framePool.length; j++) framePool[j].style.display = 'none';
    forgeUI.ticks = ticks;
  }
  // How a pair was arranged, in words: first piece is the left (⿰) or the top (⿱) one.
  const arrangement = (op, a, b) => op === '⿱' ? a + ' on top of ' + b : a + ' on the left, ' + b + ' on the right';
  // a forge: the two pieces slide together (side by side for ⿰, one above the other for ⿱)
  // into the new stone, then it bursts. A rescued forge starts them the other way round.
  const forgeSlides = [];
  const SLIDE_MS = 320;
  function forgeSlide(e) {
    const now = performance.now();
    const side = e.op === '⿰', sw = e.rescued ? -1 : 1;
    const y0 = e.y + 0.7;
    const mk = (ch, k) => {
      const sp = sprite(brushTex(glyphFor(ch, [e.op, k]), ch), '#ffffff', 1, false);
      sp.scale.set(1.1, 1.1, 1); sp.renderOrder = 6;
      scene.add(sp);
      // first piece: left (⿰) or top (⿱)
      const sgn = (k === 1 ? -1 : 1) * sw;
      const from = side ? new THREE.Vector3(e.x, y0, e.z).addScaledVector(cRight, sgn * 0.7)
                        : new THREE.Vector3(e.x, y0, e.z).addScaledVector(cUp, -sgn * 0.7);
      return { sp, from };
    };
    forgeSlides.push({ s: e.s, at: now, until: now + SLIDE_MS, to: new THREE.Vector3(e.x, y0, e.z), pieces: [mk(e.a, 1), mk(e.b, 2)], ch: e.ch, done: false });
    forgeUI.bursts++;
  }
  function stepForgeSlides() {
    const now = performance.now();
    for (let j = forgeSlides.length - 1; j >= 0; j--) {
      const f = forgeSlides[j], u = clamp((now - f.at) / SLIDE_MS, 0, 1), e2 = u * u * (3 - 2 * u);
      for (const p of f.pieces) {
        p.sp.position.lerpVectors(p.from, f.to, e2);
        p.sp.scale.setScalar(1.1 * (1 - e2 * 0.35));
        p.sp.material.opacity = 1 - Math.max(0, (u - 0.75) * 4);
      }
      if (u >= 1 && !f.done) {
        f.done = true;
        burst(f.to.x, f.to.y, f.to.z, 26, elOf(f.ch).glow, 3.4, true);
        for (const p of f.pieces) { scene.remove(p.sp); p.sp.material.dispose(); }
      }
      if (now - f.at > SLIDE_MS + 2000) forgeSlides.splice(j, 1);
    }
  }
  // dusk: a violet veil over the stage while the snapshot says dk > 0
  const duskVeil = document.createElement('div');
  duskVeil.className = 'dusk-veil';
  stageEl.appendChild(duskVeil);

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

  // a log bridge that grew out of a 木 stone
  function makeBridge(b) {
    if (glyph(b[5]).el === 'earth') return makeMound(b);
    const x0 = b[0], z0 = b[1], w = b[2], d = b[3];
    const g = new THREE.Group();
    g.position.set(x0 + w / 2, b[4], z0 + d / 2);
    const alongX = w >= d, len = alongX ? w : d;
    const woods = [lam('#c98f5a'), lam('#b67c48'), lam('#d9a56c')], dark = lam('#7d5133');
    const n = Math.round(len / 0.26);
    for (let k = 0; k < n; k++) {
      const log = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.9 + hash(k, x0, 41) * 0.12, 8), woods[k % 3]));
      const o = -len / 2 + (k + 0.5) * len / n;
      log.rotation.x = Math.PI / 2;
      if (!alongX) log.rotation.z = Math.PI / 2;
      log.position.set(alongX ? o : 0, -0.13, alongX ? 0 : o);
      g.add(log);
    }
    for (const s of [-0.3, 0.3]) {
      const beam = shade(new THREE.Mesh(new THREE.BoxGeometry(alongX ? len + 0.3 : 0.12, 0.14, alongX ? 0.12 : len + 0.3), dark));
      beam.position.set(alongX ? 0 : s, -0.32, alongX ? s : 0);
      g.add(beam);
    }
    // it is still a tree: leaves sprout at both ends
    const leafA = lam(S.pal.leaf, { flatShading: true }), leafB = lam(S.pal.leaf2, { flatShading: true });
    const tufts = b[5] === '木' ? 2 : b[5] === '林' ? 4 : 6;
    for (let k = 0; k < tufts * 2; k++) {
      const end = k % 2 ? 1 : -1, o = end * (len / 2 - 0.1 - Math.floor(k / 4) * 0.9), side = (k % 4 < 2 ? 1 : -1) * 0.5;
      const lf = shade(new THREE.Mesh(new THREE.IcosahedronGeometry(0.17 + hash(k, z0, 42) * 0.1, 1), k % 3 ? leafA : leafB));
      lf.position.set(alongX ? o : side, 0.12, alongX ? side : o);
      g.add(lf);
    }
    S.root.add(g);
    return { g, y: b[4] };
  }
  // a mound of earth that rose out of the water where 土 or 田 fell in; 田 comes up ploughed
  function makeMound(b) {
    const x0 = b[0], z0 = b[1], w = b[2], d = b[3];
    const g = new THREE.Group();
    g.position.set(x0 + w / 2, b[4], z0 + d / 2);
    const body = shade(new THREE.Mesh(new THREE.BoxGeometry(w - 0.04, 3.2, d - 0.04), lam('#a8743e', { flatShading: true })));
    body.position.y = -1.6;
    const top = shade(new THREE.Mesh(new THREE.BoxGeometry(w - 0.02, 0.08, d - 0.02), lam(b[5] === '田' ? '#8a5a2e' : '#c99a5c')));
    top.position.y = -0.04;
    g.add(body, top);
    if (b[5] === '田') {
      // furrows and green shoots: a field
      const alongX = w >= d, len = alongX ? w : d, shoot = lam(S.pal.leaf, { flatShading: true });
      for (const s of [-0.25, 0, 0.25]) {
        const row = new THREE.Mesh(new THREE.BoxGeometry(alongX ? len - 0.2 : 0.07, 0.05, alongX ? 0.07 : len - 0.2), lam('#5e3a1c'));
        row.position.set(alongX ? 0 : s, 0.02, alongX ? s : 0);
        g.add(row);
        for (let k = 0; k < len * 3; k++) {
          const sh = shade(new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 4), shoot), true, false);
          const o = -len / 2 + 0.2 + k * (len - 0.4) / Math.max(1, len * 3 - 1);
          sh.position.set(alongX ? o : s + 0.08, 0.11, alongX ? s + 0.08 : o);
          g.add(sh);
        }
      }
    } else {
      for (let k = 0; k < 5; k++) {
        const pb = shade(new THREE.Mesh(new THREE.DodecahedronGeometry(0.07 + hash(k, x0, 44) * 0.06, 0), lam('#8b6a4a', { flatShading: true })), true, false);
        pb.position.set((hash(k, z0, 45) - 0.5) * (w - 0.3), 0.04, (hash(k, x0, 46) - 0.5) * (d - 0.3));
        g.add(pb);
      }
    }
    S.root.add(g);
    return { g, y: b[4] };
  }

  // ---------- particles ----------
  const parts = [];
  for (let k = 0; k < 280; k++) {
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
    win: () => [523, 659, 784, 1047, 1319].forEach((f, k) => tone(f, 0.28, 'triangle', 0.1, null, k * 0.11)),
    dawn: () => [392, 523, 659, 784].forEach((f, k) => tone(f, 0.35, 'sine', 0.07, null, k * 0.06)),
    dusk: () => { tone(330, 0.9, 'sine', 0.07, 196); tone(247, 1.1, 'triangle', 0.05, 147, 0.2); },
    fuse: () => { tone(392, 0.5, 'sine', 0.09); tone(587, 0.5, 'sine', 0.08, null, 0.06); tone(880, 0.7, 'triangle', 0.08, null, 0.14); },
    grow: () => [262, 330, 392, 523].forEach((f, k) => tone(f, 0.22, 'triangle', 0.08, f * 1.5, k * 0.07)),
    burn: () => { tone(220, 0.7, 'sawtooth', 0.05, 60); tone(900, 0.5, 'square', 0.02, 200, 0.05); },
    douse: () => { tone(1200, 0.6, 'sine', 0.06, 180); tone(300, 0.5, 'triangle', 0.05, 90, 0.1); }
  };

  // every character says its own name (zh-CN voice, built into the browser)
  function speak(ch) {
    try {
      if (!('speechSynthesis' in window) || qs.get('mute') === '1') return;
      const u = new SpeechSynthesisUtterance(ch);
      u.lang = 'zh-CN'; u.rate = 0.75;
      window.speechSynthesis.speak(u);
    } catch (e) {}
  }

  // the card that introduces a character: big glyph, pinyin, meaning, and what it was made of
  // How each root character was first drawn, three thousand years ago.
  const PICTO = {
    '木': 'M50 12V90M22 30Q40 44 50 46Q60 44 78 30M24 88Q40 68 50 62Q60 68 76 88',
    '火': 'M14 86Q18 54 30 38Q36 60 43 66Q46 36 52 12Q58 38 59 66Q68 58 73 38Q84 58 88 86Q50 96 14 86',
    '水': 'M52 10Q36 30 52 49Q68 68 50 90M29 20Q22 31 29 42M25 58Q18 69 25 80M75 20Q82 31 75 42M78 58Q85 69 78 80',
    '日': 'M50 18A32 32 0 1 0 50.1 18M43 50H57',
    '月': 'M64 10Q20 28 25 60Q29 84 60 90Q44 70 46 50Q48 28 64 10M40 46Q46 50 44 60',
    '人': 'M58 10Q52 50 62 90M56 30Q38 44 26 68'
  };
  let cardTimer = 0;
  function showCard(ch, parts) {
    const info = glyph(ch), el = elOf(ch), card = $('card');
    $('card-eq').innerHTML = parts ? '<span>' + parts[0] + '</span><i>+</i><span>' + parts[1] + '</span>'
      : PICTO[ch] ? '<svg viewBox="0 0 100 100"><path d="' + PICTO[ch] + '"/></svg><em>long ago</em>' : '';
    $('card-ch').textContent = ch;
    $('card-py').textContent = info.py;
    $('card-en').textContent = info.en;
    card.style.setProperty('--el', el.b);
    card.classList.toggle('made', !!parts);
    card.classList.remove('show'); void card.offsetWidth; card.classList.add('show');
    clearTimeout(cardTimer);
    cardTimer = setTimeout(() => card.classList.remove('show'), parts ? 3400 : 2200);
  }
  const codex = new Set();
  function addCodex(ch) {
    if (codex.has(ch)) return false;
    codex.add(ch);
    const c = document.createElement('span');
    c.textContent = ch; c.title = glyph(ch).py + ' · ' + glyph(ch).en;
    c.style.setProperty('--el', elOf(ch).b);
    $('codex').appendChild(c);
    return true;
  }

  // ---------- network ----------
  let snap = null, myId = null, board = null, me = null;
  // mixed text: Chinese in the brush face, the rest in the plain one
  const kai = text => esc(text).replace(/[\u4e00-\u9fff]+/g, m => '<b class="k">' + m + '</b>');
  // ---------- the feed: notes slide in on the left, low, where eyes already are ----------
  // kinds: goal (the stage's hint), move (a new trick), char (a character did something), warn, info
  const FEED = { goal: ['Goal', 16], move: ['New move', 8], char: ['', 6.5], warn: ['Oops', 4.5], info: ['', 4] };
  const feedLive = new Map();
  function note(kind, text, o) {
    o = o || {};
    const box = $('feed'), key = kind + '|' + text;
    let it = feedLive.get(key);
    if (it) { it.el.classList.remove('bump'); void it.el.offsetWidth; it.el.classList.add('bump'); clearTimeout(it.t); }
    else {
      const el = document.createElement('div');
      el.className = 'note ' + kind;
      const g = o.ch ? glyph(o.ch) : null, label = o.label || FEED[kind][0];
      el.innerHTML = (o.ch ? '<b class="g" style="--el:' + elOf(o.ch).glow + '">' + esc(o.ch) + '</b>' : o.key ? '<b class="key">' + esc(o.key) + '</b>' : '')
        + '<div>' + (g ? '<em>' + esc(g.py) + ' · ' + esc(g.en) + '</em>' : label ? '<em>' + esc(label) + '</em>' : '')
        + '<span>' + kai(text) + '</span></div>';
      box.appendChild(el);
      it = { el };
      feedLive.set(key, it);
      const max = isBoard ? 5 : 3;
      while (box.children.length > max) drop([...feedLive].find(([, v]) => v.el === box.firstElementChild)[0], true);
    }
    it.t = setTimeout(() => drop(key), (o.secs || FEED[kind][1]) * 1000);
  }
  function drop(key, now) {
    const it = feedLive.get(key);
    if (!it) return;
    clearTimeout(it.t); feedLive.delete(key);
    if (now) it.el.remove(); else { it.el.classList.add('out'); setTimeout(() => it.el.remove(), 320); }
  }
  const toast = text => note('info', text);
  const clearGoal = () => { for (const k of [...feedLive.keys()]) if (k.startsWith('goal|')) drop(k, true); };
  const nameOf = id => (roster.get(id) || {}).name || 'Someone';

  function Conn(asBoard, name, pidKey) {
    this.asBoard = asBoard; this.name = name; this.pidKey = pidKey; this.ws = null; this.sentX = 0; this.sentZ = 0; this.sentAt = 0;
    this.open();
  }
  Conn.prototype.open = function () {
    const ws = this.ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
    ws.onopen = () => {
      if (this.asBoard) { this.send({ type: 'join', board: true, strict: new URLSearchParams(location.search).get('strict') || undefined }); return; }
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
    if (m.type === 'joined' && m.fz) fz = m.fz;
    if (m.type === 'joined' && m.id) {
      myId = m.id;
      if (m.conjure) onConjureSet(m.conjure);
      if (m.ink != null) updateInkDisplay(m.ink, m.inkMax);
      return;
    }
    if (m.type === 'conjured') { onConjuredBroadcast(m); return; }
    if (m.type === 'conjureNo') { onConjureRefusal(m.why); return; }
    if (m.type === 'conjureSet') { onConjureSet(m.conjure); return; }
    if (m.type === 'full') { toast('The isles are full (16 wobblers).'); return; }
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
    me = new Conn(false, name, isBoard ? 'tzi_host_pid' : 'tzi_pid');
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
    if (!ready) return;
    if (!S || s.st !== S.i) buildStage(s.st);
    snap = s;
    if (s.fz) fz = s.fz;
    forgeUI.dusk = s.dk > 0;
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
    if (s.conjure) onConjureSet(s.conjure);
    if (s.ink != null) updateInkDisplay(s.ink, s.inkMax);
    const gemEls = $('gems').children;
    for (let k = 0; k < gemEls.length; k++) gemEls[k].classList.toggle('got', !!s.g[k]);
    $('clock').textContent = fmtTime(s.t);
    // the world answers first; the score card waits four seconds
    if (s.res && (s.res.t >= 4 || s.ph === 'sail')) showResult(s.res); else $('result').classList.add('hidden');
    $('veil').classList.toggle('mist', s.ph === 'sail');
  }
  const fmtTime = t => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');

  let leapTold = false, rowTold = false, boostTold = false, spentTold = false;
  function onEvent(e) {
    const wob = e.id ? wobblers.get(e.id) : null;
    const st = e.s ? stones.get(e.s) : null;
    switch (e.t) {
      case 'jump': if (wob) { wob.sqv = 2.6; dust(wob.x, wob.y, wob.z, 3); } if (e.id === myId || isBoard) sfx.jump(); break;
      case 'land': if (wob) { wob.sqv = -Math.min(4.5, e.v * 0.3); dust(wob.x, wob.ty, wob.z, 5); } if (e.id === myId || isBoard) sfx.land(); break;
      case 'grab': if (wob) wob.sqv = -1.8; if (st) burst(st.x, st.y + 0.3, st.z, 8, elOf(e.ch).glow, 1.6, true); sfx.grab(); break;
      case 'catch': if (wob) wob.sqv = -2.4; if (st) burst(st.x, st.y + 0.3, st.z, 12, elOf(e.ch).glow, 2, true); sfx.catch(); say(e.id, 'Got it!', 1100); break;
      case 'throw': if (wob) wob.sqv = 2; sfx.throw(); break;
      case 'leap':
        // 轻功: a ring of ink underfoot and the word itself
        if (wob) {
          wob.sqv = 3.4; dust(wob.x, wob.y, wob.z, 10);
        }
        if (e.id === myId || isBoard) { tone(520, 0.3, 'sine', 0.08, 1250); tone(900, 0.22, 'triangle', 0.04, 1700, 0.05); }
        if (e.id === myId) {
          const jb = $('btn-jump'); jb.classList.remove('cool'); void jb.offsetWidth; jb.classList.add('cool');
          if (!leapTold) { leapTold = true; note('move', 'Leap: jump again in mid-air. Recharges in 4 seconds. Not while holding a stone. (轻功 qīnggōng, “light-foot”)', { key: 'JUMP ×2' }); }
        }
        break;
      case 'moor': sfx.land(); if (S) note('goal', S.L.hint); break;   // said again once the crew has landed and can act on it
      case 'row':
        tone(180, 0.22, 'sine', 0.05, 120);
        if (!rowTold && (isBoard || (S && S.boat && wobblers.get(myId) && Math.hypot(wobblers.get(myId).x - S.boat.x, wobblers.get(myId).z - S.boat.z) < 3))) { rowTold = true; note('move', 'Row the boat: stand on deck and walk into its side. It goes anywhere there is water.', { key: 'WALK' }); }
        break;
      case 'bump': tone(110, 0.12, 'triangle', 0.08, 70); break;
      case 'boost': {
        const to = wobblers.get(e.to);
        if (wob) wob.sqv = 2.4;
        if (to) { to.sqv = 3.2; dust(to.x, to.y, to.z, 8); }
        tone(300, 0.25, 'square', 0.05, 900);
        if (e.to === myId) say(e.to, 'Wheee!', 900);
        if (!boostTold && (e.id === myId || e.to === myId || isBoard)) { boostTold = true; note('move', 'Boost: with empty hands, face a friend and throw them, stone and all.', { key: 'GRAB' }); }
        break;
      }
      case 'spring': if (wob) { wob.sqv = 3.4; dust(wob.x, wob.y, wob.z, 6); } tone(420, 0.2, 'sine', 0.06, 1000); break;
      case 'ouch': if (wob) { wob.sqv = 3; burst(wob.x, wob.y, wob.z, 8, e.wall === 'flame' ? '#ff8a2e' : '#a7689c', 2, false); say(e.id, 'Ouch!', 800); } tone(700, 0.1, 'sawtooth', 0.05, 300); break;
      case 'board': toast('All aboard! The boat leaves when everyone is on.'); break;
      case 'sail': toast('Sailing on, all in the same boat (同舟 tóng zhōu)'); sfx.mover(); break;
      case 'plate': sfx.plate(e.on); break;
      case 'mover': sfx.mover(); break;
      case 'thud': if (st) dust(st.x, st.y, st.z, 4); break;
      case 'gem': { const g = S && S.gems[e.i]; if (g) burst(g.g.position.x, g.g.position.y, g.g.position.z, 16, S.pal.gem, 2.6, true); sfx.gem(); break; }
      case 'respawn': if (wob) { wob.fresh = true; burst(wob.tx, wob.ty + 0.5, wob.tz, 10, '#ffffff', 2); } sfx.pop(); break;
      case 'stoneReturn': if (st) st.fresh = true; note('warn', e.ch + ' fell in the water and floated back to where it started.', { ch: e.ch }); sfx.pop(); break;
      case 'crateHome': note('warn', 'A crate fell in. It is back where it started.'); break;
      case 'regrow': sfx.pop(); break;
      case 'spent':
        // Stones are used up (sim.js STONES). Say so once per game, the first time a stone is gone for good.
        if (!e.back && !spentTold) { spentTold = true; note('warn', e.ch + ' is used up and will not grow back. Tap Draw and write it to bring one back.', { ch: e.ch, secs: 8 }); }
        break;
      case 'dud':
        for (let k = 0; k < 8; k++) puff(e.x, e.y + 0.5, e.z, { color: '#b9b4c6', life: 0.5, vx: (Math.random() - 0.5) * 2, vy: 1.2, vz: (Math.random() - 0.5) * 2, s0: 0.14, s1: 0.3, a: 0.6 });
        flagFrame(e.ia, e.ib, 'no', e.op, 2.5);
        // FG-D017: name the arrangement, and be honest when the same two pieces work another way
        note('warn', arrangement(e.op, e.a, e.b) + ': makes nothing. '
          + (e.other ? 'But ' + e.a + ' and ' + e.b + ' do go together, another way. Try again!' : e.a + ' and ' + e.b + ' never go together. Try another pair.'), { secs: 9 });
        sfx.bonk();
        break;
      case 'found':
        // a base character met for the first time (made characters get the bigger card from 'fuse')
        if (addCodex(e.ch) && !e.made) { showCard(e.ch); note('char', 'found', { ch: e.ch }); if (isBoard || e.id === myId) speak(e.ch); }
        break;
      case 'forge': forgeSlide(e); break;
      case 'near':
        flagFrame(e.ia, e.ib, 'near', e.op, 2.5);
        if (isBoard || e.by === myId) note('warn', e.a + ' and ' + e.b + ' are close, but not quite ' + (e.op === '⿱' ? 'one on top of the other' : 'side by side') + '. Nudge one.', { secs: 6 });
        break;
      case 'dusk': if (e.on) { sfx.dusk(); note('char', 'Dusk: the isle grows dim', { ch: '杳', secs: 6 }); } break;
      case 'fuse': {
        const el = elOf(e.ch);
        addCodex(e.ch);
        burst(e.x, e.y + 0.5, e.z, 40, el.glow, 4.2, true);
        burst(e.x, e.y + 0.5, e.z, 16, '#ffffff', 2.4, true);
        glyphBurst(e.ch, e.x, e.y + 1.2, e.z, el.glow);
        showCard(e.ch, [e.a, e.b]);
        note('char', e.a + ' + ' + e.b + ' = ' + e.ch, { ch: e.ch, secs: 9 });
        sfx.fuse();
        speak(e.ch);
        break;
      }
      case 'bridge': {
        const leaf = glyph(e.ch).el === 'earth' ? '#a8743e' : S ? S.pal.leaf : '#62cdb0';
        burst(e.x, e.y + 0.3, e.z, 44, leaf, 4.5, false);
        burst(e.x, e.y + 0.3, e.z, 18, '#8dffd0', 3, true);
        glyphBurst(e.ch, e.x, e.y + 1.4, e.z, '#8dffd0');
        note('char', glyph(e.ch).el === 'earth' ? 'raises a mound of earth in the water' : 'grows a bridge across the gap', { ch: e.ch });
        sfx.grow();
        if (isBoard || e.by === myId) speak(e.ch);
        break;
      }
      case 'burn': case 'douse': case 'dispel': {
        const lite = e.t === 'dispel';
        const mv = S && S.movers.find((m, j) => m.wall && (S.L.movers[j] || {}).id === e.id);
        if (mv) {
          const w = mv.wall, fire = e.t === 'burn';
          for (let k = 0; k < 60; k++) {
            const x = w.x + (Math.random() - 0.5) * w.w, z = w.z + (Math.random() - 0.5) * w.d, y = w.to + Math.random() * (w.from - w.to);
            if (lite) puff(x, y, z, { tex: k % 3 ? TEX.cloud : TEX.glow, color: k % 3 ? '#4a4070' : '#fff2b0', add: !(k % 3), life: 0.8 + Math.random() * 0.9, vx: (x - w.x) * 2.2, vy: 0.6 + Math.random() * 1.5, vz: (z - w.z) * 2.2, s0: 0.6, s1: 1.8, a: 0.75 });
            else if (fire) puff(x, y, z, { tex: TEX.glow, color: k % 2 ? '#ff8a2e' : '#ffd36e', add: true, life: 0.7 + Math.random() * 0.9, vx: (Math.random() - 0.5) * 1.5, vy: 1.5 + Math.random() * 3, vz: (Math.random() - 0.5) * 1.5, s0: 0.3, s1: 0.03 });
            else puff(x, y, z, { tex: TEX.cloud, color: '#ffffff', life: 0.9 + Math.random() * 0.9, vx: (Math.random() - 0.5) * 1.2, vy: 1 + Math.random() * 2, vz: (Math.random() - 0.5) * 1.2, s0: 0.5, s1: 1.6, a: 0.7 });
          }
          glyphBurst(e.ch, w.x, w.from + 0.6, w.z, fire ? '#ffb066' : lite ? '#fff2b0' : '#a8e0ff');
          if (lite) burst(w.x, w.to + 1.2, w.z, 40, '#fff2b0', 4.5, true);
        }
        note('char', e.t === 'burn' ? 'burns the thorns away' : lite ? 'lights up the shade, and it is gone' : 'puts the flames out', { ch: e.ch });
        (e.t === 'burn' ? sfx.burn : lite ? sfx.dawn : sfx.douse)();
        if (isBoard || e.by === myId) speak(e.ch);
        break;
      }
      case 'win': if (S) winShow(e); sfx.win(); setTimeout(() => { if (snap && snap.ph === 'won') toast('The mist lifts and the river is open. Back to the boat!'); }, 3600); break;
    }
  }

  // The world answers the character. Each shrine does what its character means.
  function winShow(e) {
    const L = S.L, bx = L.beacon[0], bz = L.beacon[1], by = S.beacon.y;
    confetti(bx, by + 1, bz);
    glyphBurst(e.ch, bx, by + 2.2, bz, GOLD, true);
    setTimeout(() => speak(e.ch), 500);
    const el = glyph(e.ch).el;
    if (el === 'wood') {
      // a forest springs up over the whole island
      const cells = [];
      for (let z = 0; z < S.grid.d; z++) for (let x = 0; x < S.grid.w; x++) {
        const c = S.grid.at(x, z);
        if (c && !c.ramp && Math.hypot(x + 0.5 - bx, z + 0.5 - bz) > 1.2 && hash(x, z, 31) > 0.45) cells.push([x, z, c.h]);
      }
      cells.sort((a, b) => Math.hypot(a[0] - bx, a[1] - bz) - Math.hypot(b[0] - bx, b[1] - bz));
      cells.slice(0, 26).forEach((c, k) => {
        const x = c[0] + 0.25 + hash(c[0], c[1], 32) * 0.5, z = c[1] + 0.2 + hash(c[0], c[1], 33) * 0.4;
        const g = S.tree(x, c[2], z, 1);
        g.scale.setScalar(0.001);
        S.root.add(g);
        S.grow.push({ g, at: fxClock + 0.3 + k * 0.09, s: 0.8 + hash(c[0], c[1], 34) * 0.7, x, y: c[2], z });
      });
    } else if (el === 'light' && L.dawn) {
      // the night turns into day
      const pal = PAL[L.dawn];
      const sp = sprite(skyTexture(pal, S.i), '#ffffff', 0);
      // the dawn painting hangs far behind everything and fades in; rock in front still hides it, the river washes over it
      sp.material.userData.ownMap = true; sp.material.depthTest = true; sp.renderOrder = -10;
      S.root.add(sp);
      S.day = { sp, at: fxClock, pal };
    } else if (e.ch === '休') {
      S.napAll = true;
      for (const wob of wobblers.values()) say(wob.id, 'Zzz…', 9000);
    }
  }

  const STAR = '<svg viewBox="0 0 24 24"><path d="M12 1.8l3.1 6.6 7.1.9-5.2 5 1.3 7.1L12 17.9l-6.3 3.5L7 14.3l-5.2-5 7.1-.9z"/></svg>';
  let shownRes = null;
  function showResult(r) {
    const el = $('result');
    if (shownRes !== r.time + ':' + snap.st || el.classList.contains('hidden')) {
      shownRes = r.time + ':' + snap.st;
      $('res-kicker').textContent = r.last ? 'All isles lit · 全部通关' : 'Shrine lit · 过关';
      $('res-ch').textContent = r.ch; $('res-py').textContent = glyph(r.ch).py + ' · ' + glyph(r.ch).en;
      $('res-stars').innerHTML = [0, 1, 2].map(k => STAR.replace('<svg', '<svg class="' + (k < r.stars ? 'on' : '') + '"')).join('');
      $('res-title').textContent = S.L.name;
      $('res-time').textContent = fmtTime(r.time);
      $('res-gems').textContent = r.gems + ' / ' + r.total;
      $('res-by').textContent = r.by ? nameOf(r.by) : 'the team';
      el.classList.remove('hidden');
    }
    // the full card for a few seconds, then a strip at the top so everyone can see the way to the boat
    el.classList.toggle('mini', r.t >= 9 || snap.ph === 'sail');
    const next = snap.ph === 'sail' ? 'Sailing on…'
      : !r.on ? 'The river is open. All aboard!'
      : r.on + ' / ' + Math.max(r.need, r.on) + ' aboard' + (r.on < r.need && r.go != null ? ' · the boat leaves in ' + r.go : '');
    if ($('res-next').dataset.t !== next) { $('res-next').dataset.t = next; $('res-next').innerHTML = kai(next); }
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
    const btnDraw = $('btn-draw');
    if (btnDraw) press(btnDraw, () => toggleConjurePad());
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
    try { saved = localStorage.getItem('tzi_name') || ''; } catch (e) {}
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
        try { localStorage.setItem('tzi_name', name); } catch (e) {}
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

  const PORTRAIT_SPAN = 7;   // (tune) world units across a portrait phone
  let rotateTold = false;
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
    // G1: in portrait the whole isle came out tiny, so a portrait phone shows PORTRAIT_SPAN units
    // across and follows its own wobbler; the TV (or landscape) shows the whole isle.
    const minPpu = isBoard ? 0 : portrait ? W / PORTRAIT_SPAN : Math.min(W, H) / 11;
    if (portrait && !isBoard && !rotateTold && S) { rotateTold = true; note('info', 'Turn your phone sideways to see more of the isle.', { secs: 7 }); }
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
  let elapsed = 0, fxClock = 0;
  function frame() {
    requestAnimationFrame(frame);
    // Movement smoothing is clamped hard; effects run on real time so a slow laptop
    // sees them at the right speed, just with fewer frames.
    const raw = clock.getDelta();
    const dt = Math.min(raw, 0.05), fdt = Math.min(raw, 0.3);
    elapsed += dt; fxClock += fdt;
    const ft = fxClock;
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
        g.g.visible = !got && (!g.glow || forgeUI.dusk);
        g.m.rotation.y = t * 1.8 + j;
        g.g.position.y = g.y + Math.sin(t * 2 + j * 1.7) * 0.08;
      }

      // walls: thorns shrink as they burn, flames flicker
      for (let j = 0; j < S.movers.length; j++) {
        const w = S.movers[j].wall;
        if (!w) continue;
        const f = clamp((S.movers[j].y - w.to) / (w.from - w.to), 0, 1);
        S.movers[j].g.position.y = w.to;
        w.deco.visible = f > 0.02;
        w.deco.scale.set(0.6 + f * 0.4, Math.max(0.01, f), 0.6 + f * 0.4);
        for (const fl of w.flames) {
          if (fl.cloud) {
            // shade churns slowly
            const b = 1 + Math.sin(t * 1.7 + fl.seed) * 0.08;
            fl.m.scale.setScalar(b);
            fl.m.position.y = fl.y0 + Math.sin(t * 1.1 + fl.seed) * 0.08;
            fl.m.rotation.y = t * 0.3 + fl.seed;
            continue;
          }
          const a = 0.8 + Math.sin(t * 9 + fl.seed) * 0.16 + Math.sin(t * 15.3 + fl.seed * 2) * 0.1;
          fl.m.scale.set(1.05 - (a - 0.8) * 0.5, a, 1.05 - (a - 0.8) * 0.5);
          fl.m.position.y = fl.h * a / 2;
          fl.m.rotation.y = t * 1.5 + fl.seed;
        }
        if (w.kind === 'flame' && f > 0.5 && Math.random() < dt * 14) {
          puff(w.x + (Math.random() - 0.5) * w.w, w.to + 0.6 + Math.random() * 1.2, w.z + (Math.random() - 0.5) * w.d,
            { tex: TEX.glow, color: '#ffc94a', add: true, life: 0.8, vy: 2 + Math.random() * 2, vx: (Math.random() - 0.5), vz: (Math.random() - 0.5), s0: 0.2, s1: 0.02 });
        }
      }

      // bridges grown from 木
      for (let j = 0; j < snap.br.length; j++) {
        const b = snap.br[j];
        if (!S.bridges[j]) S.bridges[j] = makeBridge(b);
        const br = S.bridges[j];
        br.y += (b[4] - br.y) * k;
        br.g.position.y = br.y;
      }

      // character stones
      const live = new Set();
      for (const c of snap.k) {
        live.add(c[0]);
        let st = stones.get(c[0]);
        if (!st) {
          st = makeStone(c[0], c[1]);
          const slide = forgeSlides.find(f => f.s === c[0]);
          if (slide) st.born = slide.until;   // the forged stone pops once its two pieces have slid together
          else burst(c[3], c[4] + 0.4, c[5], 10, elOf(c[1]).glow, 1.8, true);
        }
        const gl = glyphFor(c[1], c[8]);
        if (st.gl !== gl) { st.gl = gl; st.sp.material.map = brushTex(gl, c[1]); st.sp.material.needsUpdate = true; }
        st.rel = Array.isArray(c[8]) ? c[8] : null;
        st.g.visible = performance.now() >= st.born;
        const holder = c[6] ? wobblers.get(c[6]) : null;
        let tx = c[3], ty = c[4], tz = c[5];
        if (holder) {
          // arm hold (F4.1): a friend stands on this head, so the stone sits in front of the chest
          const low = c[9] === 1;
          tx = holder.x + (low ? Math.sin(holder.rot || 0) * 0.32 : 0); ty = holder.y + (low ? 0.55 : 1.15) + holder.body.position.y; tz = holder.z + (low ? Math.cos(holder.rot || 0) * 0.32 : 0);
        }
        if (st.fresh || holder || Math.hypot(tx - st.x, ty - st.y, tz - st.z) > 4) { st.x = tx; st.y = ty; st.z = tz; st.fresh = false; }
        else { const kc = 1 - Math.exp(-dt * 26); st.x += (tx - st.x) * kc; st.y += (ty - st.y) * kc; st.z += (tz - st.z) * kc; }
        const scored = c[2] === 's';
        const gy = c[7] > -50 ? c[7] : st.y;
        const resting = c[2] === 'l' && st.y - gy < 0.12;
        const bob = scored ? 0.6 + Math.sin(t * 3) * 0.15 : resting ? 0.1 + Math.sin(t * 2.2 + st.seed) * 0.05 : 0;
        const age = clamp((performance.now() - st.born) / 450, 0, 1);
        const pop = age < 1 ? 1 + Math.sin(age * Math.PI) * 0.5 : 1;
        st.g.position.set(st.x, st.y + 0.6 + bob, st.z);
        st.g.scale.setScalar(pop * (scored ? 1.5 + Math.sin(t * 5) * 0.12 : 1));
        st.sp.material.rotation = scored ? 0 : resting ? Math.sin(t * 1.3 + st.seed) * 0.07 : holder ? Math.sin(t * 7) * 0.04 * clamp(holder.speed, 0, 1) : 0;
        if (st.y < 0 && !st.wet && c[2] === 'l') splash(st.x, st.z);
        st.wet = st.y < 0;
        st.halo.scale.setScalar((scored ? 3.4 : 2.3) * (1 + Math.sin(t * 4.2 + st.seed) * 0.08));
        st.blob.visible = !holder && c[7] > -50;
        st.blob.position.set(st.x, gy + 0.025, st.z);
        st.blob.material.opacity = clamp(0.8 - (st.y - gy) * 0.15, 0.2, 0.8);
        st.trail -= dt;
        if (c[2] === 'l' && !resting && st.trail <= 0) {
          st.trail = 0.03;
          puff(st.x, st.y + 0.3, st.z, { tex: TEX.glow, color: elOf(st.ch).glow, add: true, life: 0.35, s0: 0.5, s1: 0.05, a: 0.8 });
        }
        st.tag.style.display = holder || scored ? 'none' : '';
        if (!holder && !scored) place(st.tag, st.x, st.y + 1.5 + bob, st.z);
      }
      for (const st of [...stones.values()]) if (!live.has(st.id)) removeStone(st);
      drawMarks();

      // aim marker: mine on a phone, the first carrier's on the board
      const aims = snap.aim || {};
      const aimId = aims[myId] ? myId : isBoard ? Object.keys(aims)[0] : null;
      const a = aimId ? aims[aimId] : null, thrower = aimId ? wobblers.get(aimId) : null;
      const showAim = !!(a && thrower && snap.ph === 'play' && a[1] > -3);
      aim.ring.visible = showAim;
      for (const d of aim.dots) d.visible = showAim;
      if (showAim) {
        const colr = a[3] === 'pass' ? '#7ef0d0' : a[3] === 'dunk' ? GOLD : a[3] === 'join' || a[3] === 'stack' ? '#ff9ad5' : a[3] === 'forge' ? '#ffe08a' : '#ffffff';
        aim.ring.material.color.set(colr); aim.mat.color.set(colr);
        aim.ring.position.set(a[0], a[1] + (a[3] === 'pass' ? 1.5 : 0.04), a[2]);
        aim.ring.scale.setScalar(1 + Math.sin(t * 6) * 0.07);
        const arc = a[3] === 'place' ? 0.15 : a[3] === 'toss' ? 0.3 : a[3] === 'join' || a[3] === 'stack' ? 0.4 : 1.0;
        const ey = a[3] === 'pass' ? a[1] + 1.4 : a[1] + 0.3;
        const ox = thrower.x, oy = thrower.y + 1.45, oz = thrower.z;
        aim.dots.forEach((d, j) => {
          const f = (j + 1 + (t * 1.6 % 1)) / (aim.dots.length + 1);
          d.position.set(lerp(ox, a[0], f), lerp(oy, ey, f) + Math.sin(f * Math.PI) * arc, lerp(oz, a[2], f));
        });
      }

      // the grab button says what it will do
      if (!isBoard) {
        const btn = $('btn-grab'), mine = wobblers.get(myId);
        let label = 'GRAB', dim = true, hot = false;
        const am = aims[myId];
        if (am) { label = AIM_LABEL[am[3]] || 'SET DOWN'; dim = false; }
        else if (mine) {
          let bd = 1.25, near = null;
          for (const c of snap.k) {
            const d = Math.hypot(c[3] - mine.tx, c[5] - mine.tz);
            if (c[2] === 'l' && d < bd && Math.abs(c[4] - mine.ty) < 1.4) { bd = d; near = c; }
          }
          if (near) { dim = false; hot = true; label = 'GRAB ' + near[1]; }
          else if (mine.flags & 16) { dim = false; label = 'BOOST'; }
        }
        if ($('grab-lbl').textContent !== label) $('grab-lbl').textContent = label;
        // the jump button: JUMP on the ground, LEAP in the air while it is charged (never with a stone)
        if (mine) {
          const carrying = !!(mine.flags & 1), air = !(mine.flags & 2), qi = !!(mine.flags & 8);
          const jl = air && qi && !carrying ? 'LEAP' : 'JUMP';
          const jb = $('btn-jump'), lbl = $('jump-lbl');
          if (lbl.dataset.t !== jl) { lbl.dataset.t = jl; lbl.innerHTML = kai(jl); }
          jb.classList.toggle('qi', jl === 'LEAP'); jb.classList.toggle('spent', !qi && !carrying);
        }
        btn.classList.toggle('dim', dim); btn.classList.toggle('hot', hot);
      }
    }

    // spectacles
    for (const gr of S.grow) {
      const f = clamp((ft - gr.at) / 0.6, 0, 1);
      if (f > 0 && !gr.done) { gr.done = true; burst(gr.x, gr.y + 0.4, gr.z, 6, S.pal.leaf, 2, false); }
      gr.g.scale.setScalar(Math.max(0.001, gr.s * (f < 1 ? f * (1 + Math.sin(f * Math.PI) * 0.45) : 1)));
    }
    if (S.day) {
      const f = clamp((ft - S.day.at) / 3.2, 0, 1), e2 = f * f * (3 - 2 * f);
      S.day.sp.material.opacity = e2;
      S.day.sp.position.set(0, 0, 0).addScaledVector(cRight, view.camR).addScaledVector(cUp, view.camU).addScaledVector(cDir, -150);
      S.day.sp.position.y -= S.root.position.y;
      S.day.sp.scale.set(view.W / view.ppu, view.H / view.ppu, 1);
      hemi.color.set(C('#d6d8ff').lerp(C('#fff4dc'), e2));
      hemi.intensity = 0.7 + e2 * 0.35; sun.intensity = 0.36 + e2 * 0.3;
      sun.color.set(C('#c9d0ff').lerp(C('#fff0c8'), e2));
      for (const cl of S.clouds) { cl.sp.material.opacity = lerp(0.3, 0.75, e2); cl.sp.material.color.set(C(S.pal.mist).lerp(C(S.day.pal.mist), e2)); }
      water.u.uColor.value.set(C(S.pal.water).lerp(C(S.day.pal.water), e2));
      water.u.uLite.value.set(C(S.pal.lite).lerp(C(S.day.pal.lite), e2));
    }
    stepForgeSlides();
    // dusk dims every light to about a third and lays a violet veil over the isle
    forgeUI.duskF += ((forgeUI.dusk ? 1 : 0) - forgeUI.duskF) * Math.min(1, fdt * 2.5);
    if (forgeUI.duskF > 0.002) {
      const dimK = 1 - forgeUI.duskF * 0.67;
      if (!S.day) { hemi.intensity = 0.7; sun.intensity = 0.36; }
      hemi.intensity *= dimK; sun.intensity *= dimK;
    } else if (!S.day) { hemi.intensity = 0.7; sun.intensity = 0.36; }
    duskVeil.style.opacity = (forgeUI.duskF * 0.5).toFixed(3);
    for (const m of ringPool) m.visible = false;
    for (let j = rings.length - 1, used = 0; j >= 0; j--) {
      const r = rings[j];
      r.t += fdt;
      if (r.t > 1.4) { rings.splice(j, 1); continue; }
      if (r.t < 0 || used >= ringPool.length) continue;
      const m = ringPool[used++], f = r.t / 1.4;
      m.visible = true; m.position.set(r.x, 0.03, r.z);
      m.scale.setScalar(0.3 + f * 1.9); m.material.opacity = (1 - f) * 0.7;
    }
    for (let j = glyphFx.length - 1; j >= 0; j--) {
      const fx = glyphFx[j];
      fx.life += fdt;
      const f = fx.life / fx.max;
      if (f >= 1) { scene.remove(fx.sp); fx.sp.material.dispose(); glyphFx.splice(j, 1); continue; }
      const sc = lerp(fx.s0, fx.s1, 1 - Math.pow(1 - f, 3));
      fx.sp.scale.set(sc, sc, 1);
      fx.sp.position.set(fx.x, fx.y + f * 1.5, fx.z);
      fx.sp.material.opacity = Math.pow(1 - f, 1.4) * (fx.sp.material.blending === THREE.AdditiveBlending ? 0.95 : 0.6);
    }

    // beacon, trees, sky
    S.beacon.frame.material.opacity = 0.7 + Math.sin(t * 2.4) * 0.2;
    S.beacon.frame.position.y = 4.9 + Math.sin(t * 1.8) * 0.12;
    S.beacon.frame.visible = !(snap && snap.ph === 'won');
    S.beacon.beam.material.opacity = 0.45 + Math.sin(t * 2.4) * 0.12;
    S.beacon.halo.scale.setScalar(3 + Math.sin(t * 2.4) * 0.3);
    for (const s of S.sway) s.g.rotation.z = Math.sin(t * 1.3 + s.seed) * 0.05;
    water.u.uT.value = ft;
    if (S.boat) {
      const B = S.boat;
      if (snap && snap.b) {
        // follow the simulation: the deck is floor, so the hull must be exactly where the sim says
        const k = B.fresh ? 1 : 1 - Math.exp(-dt * 18);
        const ox = B.x, oz = B.z;
        B.x += (snap.b[0] - B.x) * k; B.z += (snap.b[1] - B.z) * k; B.fresh = false;
        const v = dt > 0 ? Math.hypot(B.x - ox, B.z - oz) / dt : 0;
        B.wake -= fdt;
        if (v > 0.8 && B.wake <= 0) { B.wake = 0.22; splash(B.x + (Math.random() - 0.5) * 1.6, B.z + (Math.random() - 0.5) * 1.6); }
      }
      B.g.position.set(B.x, Math.sin(ft * 1.3) * 0.012, B.z);
      B.mark.visible = !!(snap && snap.ph === 'won' && snap.res && snap.res.t > 3);
      B.mark.position.y = (B.mark.userData.y0 || (B.mark.userData.y0 = B.mark.position.y)) + Math.sin(t * 2.2) * 0.14;
    }
    for (const cl of S.clouds) {
      cl.r += cl.v * dt;
      if (cl.r > 30) cl.r = -30;
      cl.sp.position.copy(S.centre).addScaledVector(cRight, cl.r).addScaledVector(cUp, cl.u).addScaledVector(cDir, cl.back);
    }

    for (const p of parts) {
      if (p.life <= 0) continue;
      p.life -= fdt;
      if (p.life <= 0) { p.sp.visible = false; continue; }
      p.vy -= p.g * fdt;
      p.sp.position.x += p.vx * fdt; p.sp.position.y += p.vy * fdt; p.sp.position.z += p.vz * fdt;
      const f = 1 - p.life / p.max, sc = lerp(p.s0, p.s1, f);
      p.sp.scale.set(sc, sc, 1);
      p.sp.material.opacity = p.a * (1 - f * f);
    }

    updateCamera(dt);
    renderer.render(scene, cam);
  }
  // =========================================================================
  // Conjure: Phone Pad UI, Recogniser Integration, Refusal Messages, Replay
  // =========================================================================
  let conjureAllowed = [];
  let currentInk = 3;
  // G1 (2026-11-18): the pad opens blank. Nothing is pre-chosen and there is no Trace mode: a
  // stronger writer just writes anything they know; a learner taps an idea below to copy it.
  // copyChar is the character whose model is shown (null: writing from memory).
  let copyChar = null;
  let padStrokes = [];
  let currentStroke = null;
  let padPauseTimer = null;
  let padCanvas, padCtx;

  // D3: the pad stays open until the isle answers (conjured / conjureNo), so we hold what
  // the request was for: a refusal can then be explained and the drawing kept, and a
  // success can be credited to this phone's practice memory (D8).
  let conjurePending = null;       // { ch, from, rank, free, strokes }
  let conjurePendingTimer = null;
  let lastMatches = [];            // best-first match list from the last recogniser run

  function onConjureSet(list) {
    if (!Array.isArray(list)) return;
    conjureAllowed = list;
    if (copyChar && !list.some(item => item.ch === copyChar)) copyChar = null;
    renderPalette();
    updateGuide();
    renderPractice();
    if (window.WRecog) {
      window.WRecog.load(conjureAllowed.map(item => item.ch));
    }
  }

  // The crew shares one ink pool; its cap grows with the crew (sim.js CONJURE).
  let lastInkKey = '';
  function updateInkDisplay(inkVal, inkMax) {
    currentInk = inkVal;
    const maxDrops = inkMax || 3;
    const key = Math.round(inkVal * 20) + '/' + maxDrops;
    if (key === lastInkKey) return;   // snapshots arrive ~20 times a second; redraw only on change
    lastInkKey = key;
    const dropsEl = $('cp-drops');
    if (!dropsEl) return;
    dropsEl.innerHTML = '';
    for (let i = 0; i < maxDrops; i++) {
      const drop = document.createElement('div');
      drop.className = 'cp-drop';
      if (inkVal >= i + 1) {
        drop.classList.add('full');
      } else if (inkVal > i) {
        drop.classList.add('partial');
        drop.style.setProperty('--fill', Math.round((inkVal - i) * 100) + '%');
      }
      dropsEl.appendChild(drop);
    }
  }

  const REFUSAL_TEXTS = {
    phase: 'The shrine is not open right now.',
    unknown: 'The isle does not know that character.',
    ink: 'Out of ink. Wait for drops to gather.',
    cooldown: 'Wait a moment before drawing again.',
    cap: 'Too many conjured stones already on the isle.',
    away: 'You cannot conjure while resting.',
    strokes: 'That drawing could not be read. Clear and try again.'
  };

  function setPadStatus(text) {
    const statusEl = $('cp-status');
    if (statusEl) statusEl.textContent = text;
  }

  function updateUseBtn() {
    const btn = $('cp-use-btn');
    if (!btn) return;
    btn.disabled = !!conjurePending;
    btn.classList.toggle('sending', !!conjurePending);
  }

  function onConjureRefusal(why) {
    conjurePending = null;
    clearTimeout(conjurePendingTimer);
    updateUseBtn();
    const msg = REFUSAL_TEXTS[why] || 'Could not conjure that character.';
    toast(msg);
    // D3: a refusal never costs the drawing. The pad stays open with its strokes; the
    // reason replaces the status line so the crew can see why nothing appeared.
    setPadStatus(msg);
  }

  function toggleConjurePad() {
    const pad = $('conjure-pad');
    if (!pad) return;
    const isHidden = pad.classList.contains('hidden');
    if (isHidden) {
      pad.classList.remove('hidden');
      copyChar = null;          // always opens blank: no character is pre-chosen (G1)
      updateGuide();
      markTargets();
      initPadCanvas();
      clearPad();
      renderPractice();
      updateUseBtn();
    } else {
      pad.classList.add('hidden');
    }
  }

  function initPadCanvas() {
    padCanvas = $('cp-canvas');
    if (!padCanvas) return;
    padCtx = padCanvas.getContext('2d');
    const wrap = $('cp-canvas-wrap');
    const w = wrap.clientWidth || 300, h = wrap.clientHeight || 300;
    padCanvas.width = w;
    padCanvas.height = h;

    padCtx.lineWidth = 7;
    padCtx.lineCap = 'round';
    padCtx.lineJoin = 'round';
    padCtx.strokeStyle = '#2b2118';

    if (!padCanvas._bound) {
      padCanvas._bound = true;
      padCanvas.addEventListener('pointerdown', onPadDown);
      padCanvas.addEventListener('pointermove', onPadMove);
      padCanvas.addEventListener('pointerup', onPadUp);
      padCanvas.addEventListener('pointercancel', onPadUp);

      const btnClose = $('cp-close-btn');
      if (btnClose) btnClose.addEventListener('click', toggleConjurePad);

      const btnClear = $('cp-clear-btn');
      if (btnClear) btnClear.addEventListener('click', clearPad);

      // D1: picking a character only sets the Trace target. Conjuring one without a
      // drawing is this separate, explicit action (1 drop for now, ladder price later).
      const btnUse = $('cp-use-btn');
      if (btnUse) {
        btnUse.addEventListener('click', () => { if (copyChar) sendConjure(copyChar, { from: 'pick' }); });
      }
    }
  }

  function updateGuide() {
    const guide = $('cp-guide');
    if (guide) {
      guide.textContent = copyChar || '';
      guide.classList.toggle('hidden', !copyChar);
    }
    const btnUse = $('cp-use-btn');
    if (btnUse) {
      btnUse.textContent = copyChar ? 'Use ' + copyChar + ' without drawing' : '';
      btnUse.classList.toggle('hidden', !copyChar);
    }
  }

  // D4: one scale for both axes — the pad's shorter side — and centred, so a square drawn
  // on a tall phone arrives square (x and y used to be scaled separately).
  function padNorm(e) {
    const r = padCanvas.getBoundingClientRect();
    const s = Math.min(r.width, r.height) || 1;
    const ox = (r.width - s) / 2, oy = (r.height - s) / 2;
    // clamp: keep the stroke inside the server's accepted 0..1 box (SPEC §4)
    return [
      clamp((e.clientX - r.left - ox) / s, 0, 1),
      clamp((e.clientY - r.top - oy) / s, 0, 1)
    ];
  }

  // Same single scale, in canvas pixels, for drawing what was collected.
  function padToPx(x, y) {
    const s = Math.min(padCanvas.width, padCanvas.height);
    const ox = (padCanvas.width - s) / 2, oy = (padCanvas.height - s) / 2;
    return [ox + x * s, oy + y * s];
  }

  const PAD_MAX_POINTS = 40;   // server limit per stroke (SPEC §4)
  const roundPt = p => [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100];

  // Resample a polyline to at most maxPts points, evenly spaced along its length.
  // First and last points are always kept exactly, so the end of a long stroke survives.
  function resampleStroke(pts, maxPts) {
    if (!Array.isArray(pts) || pts.length <= maxPts) return pts.slice();
    const n = pts.length;
    const cum = [0];
    for (let i = 1; i < n; i++) {
      cum[i] = cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    }
    const total = cum[n - 1];
    if (!(total > 0)) return [pts[0], pts[n - 1]];
    const out = [pts[0]];
    let seg = 1;
    for (let k = 1; k < maxPts - 1; k++) {
      const d = (total * k) / (maxPts - 1);
      while (seg < n - 1 && cum[seg] < d) seg++;
      const a = pts[seg - 1], b = pts[seg];
      const span = cum[seg] - cum[seg - 1];
      const t = span > 0 ? (d - cum[seg - 1]) / span : 0;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
    out.push(pts[n - 1]);
    return out;
  }

  // The server caps a conjure at 12 strokes and 300 points in total (SPEC §4). Thin the
  // strokes to fit rather than let one long drawing be dropped whole.
  function padPayload() {
    const n = Math.min(12, padStrokes.length);
    if (n === 0) return [];
    const per = Math.max(2, Math.min(PAD_MAX_POINTS, Math.floor(300 / n)));
    const out = [];
    for (let i = 0; i < n; i++) out.push(resampleStroke(padStrokes[i], per).map(roundPt));
    return out;
  }

  function redrawPad() {
    if (!padCtx || !padCanvas) return;
    padCtx.clearRect(0, 0, padCanvas.width, padCanvas.height);
    padCtx.beginPath();
    for (const st of padStrokes) {
      if (st.length < 1) continue;
      const p0 = padToPx(st[0][0], st[0][1]);
      padCtx.moveTo(p0[0], p0[1]);
      for (let i = 1; i < st.length; i++) {
        const p = padToPx(st[i][0], st[i][1]);
        padCtx.lineTo(p[0], p[1]);
      }
    }
    padCtx.stroke();
  }

  function onPadDown(e) {
    clearTimeout(padPauseTimer);
    const pt = padNorm(e);
    currentStroke = [pt];
    padStrokes.push(currentStroke);
    redrawPad();
    padCanvas.setPointerCapture(e.pointerId);
  }

  function onPadMove(e) {
    if (!currentStroke) return;
    const [x, y] = padNorm(e);
    const prev = currentStroke[currentStroke.length - 1];
    // Thinning while the finger moves keeps the stored stroke small; the real limit is
    // applied once on pointer-up (D2), so a long stroke is resampled, never cut short.
    if (Math.hypot(x - prev[0], y - prev[1]) >= 0.015 && currentStroke.length < 400) {
      currentStroke.push([x, y]);
      redrawPad();
    }
  }

  function onPadUp(e) {
    if (currentStroke) {
      // D2: a long stroke is thinned to the server's 40 points, keeping both ends.
      currentStroke = resampleStroke(currentStroke, PAD_MAX_POINTS).map(roundPt);
      padStrokes[padStrokes.length - 1] = currentStroke;
      currentStroke = null;
      redrawPad();
      clearTimeout(padPauseTimer);
      padPauseTimer = setTimeout(runPadRecogniser, 600);
    }
  }

  function clearPad() {
    padStrokes = [];
    currentStroke = null;
    lastMatches = [];
    clearTimeout(padPauseTimer);
    redrawPad();
    const tilesEl = $('cp-tiles');
    if (tilesEl) tilesEl.innerHTML = '';
    const palEl = $('cp-palette');
    if (palEl) palEl.classList.add('hidden');
    setPadStatus(copyChar ? 'Copy ' + copyChar + ' stroke by stroke.' : 'Write any character you know. Need an idea? Tap one below.');
  }

  function runPadRecogniser() {
    if (!window.WRecog || padStrokes.length === 0) return;
    const matches = window.WRecog.match(padStrokes);
    renderResultTiles(matches);
  }

  function renderResultTiles(matches) {
    const tilesEl = $('cp-tiles');
    const palEl = $('cp-palette');
    const statusEl = $('cp-status');
    if (!tilesEl) return;
    lastMatches = matches;
    tilesEl.innerHTML = '';

    const top = matches.slice(0, 3).filter(m => m.score >= 0.15);
    if (top.length === 0) {
      if (statusEl) statusEl.textContent = 'Not sure what that was. Write it again, or pick it here:';
      if (palEl) palEl.classList.remove('hidden');
      return;
    }

    if (palEl) palEl.classList.add('hidden');
    if (statusEl) statusEl.textContent = 'Tap to conjure:';

    for (const m of top) {
      const g = (LV.GLYPHS && LV.GLYPHS[m.ch]) || {};
      const tile = document.createElement('div');
      tile.className = 'cp-tile';
      tile.innerHTML = `
        <div class="ch">${m.ch}</div>
        <div class="sub">${g.py || ''}</div>
        <div class="en">${g.en || ''}</div>
      `;
      tile.addEventListener('click', () => sendConjure(m.ch, { from: 'match', rank: matches.indexOf(m) }));
      tilesEl.appendChild(tile);
    }
  }

  function renderPalette() {
    const itemsEl = $('cp-pal-items');
    if (!itemsEl) return;
    itemsEl.innerHTML = '';
    for (const item of conjureAllowed) {
      const btn = document.createElement('button');
      btn.className = 'cp-pal-btn' + (item.ch === copyChar ? ' selected' : '');
      btn.dataset.ch = item.ch;
      btn.textContent = `${item.ch} ${item.py || ''}`;
      btn.title = item.en || '';
      // D1: choosing from the palette never spends ink. It only chooses what to trace;
      // "Use … without drawing" is the explicit way to conjure it.
      btn.addEventListener('click', () => setCopyChar(item.ch));
      itemsEl.appendChild(btn);
    }
  }

  function markTargets() {
    for (const b of document.querySelectorAll('#cp-pal-items .cp-pal-btn, .cp-idea')) {
      b.classList.toggle('selected', b.dataset.ch === copyChar);
    }
  }

  // Tap an idea: its model appears in the square to copy. Tap it again: the model goes away and
  // the square is for writing from memory.
  function setCopyChar(ch) {
    copyChar = ch && ch !== copyChar ? ch : null;
    updateGuide();
    markTargets();
    if (!copyChar) { setPadStatus('Write any character you know. Need an idea? Tap one below.'); return; }
    const g = (LV.GLYPHS && LV.GLYPHS[copyChar]) || {};
    const label = copyChar + (g.py ? ' ' + g.py : '') + (g.en ? ' (' + g.en + ')' : '');
    setPadStatus('Copy ' + label + ' stroke by stroke. Tap it again to hide the model.');
  }

  // ---------- D8: practice memory, on this phone only (localStorage, never sent) ----------
  const PRACTICE_KEY = 'tjc-practice-v1';
  const PRACTICE_MASTER = 3;                     // clean free writes before "mastered"

  function loadPractice() {
    try {
      const raw = window.localStorage.getItem(PRACTICE_KEY);
      if (!raw) return {};
      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
      const out = {};
      for (const ch of Object.keys(data)) {
        const rec = data[ch];
        if (!rec || typeof rec !== 'object') continue;
        const clean = Math.max(0, Math.min(999, Math.floor(Number(rec.clean) || 0)));
        const last = Math.max(0, Number(rec.last) || 0);
        out[ch] = { clean, last };
      }
      return out;
    } catch (e) { return {}; }
  }

  let practice = loadPractice();

  function savePractice() {
    try { window.localStorage.setItem(PRACTICE_KEY, JSON.stringify(practice)); } catch (e) {}
  }

  function notePractice(ch) {
    if (!ch) return;
    let rec = practice[ch];
    if (!rec) rec = practice[ch] = { clean: 0, last: 0 };
    rec.clean = Math.min(999, rec.clean + 1);
    rec.last = Date.now();
    savePractice();
    renderPractice();
  }

  // Ideas to try: every character this isle lets the crew write, in the isle's order. Each shows
  // its meaning, so a player can pick one by what it does; a tick marks one this phone has
  // written from memory PRACTICE_MASTER times (D8 memory, local only).
  function renderPractice() {
    const box = $('cp-practice');
    const itemsEl = $('cp-prac-items');
    if (!box || !itemsEl) return;
    itemsEl.innerHTML = '';
    if (conjureAllowed.length === 0) { box.classList.add('hidden'); return; }
    for (const item of conjureAllowed) {
      const ch = item.ch;
      const g = (LV.GLYPHS && LV.GLYPHS[ch]) || {};
      const py = g.py || item.py || '';
      const en = g.en || item.en || '';
      const clean = practice[ch] ? practice[ch].clean : 0;
      const btn = document.createElement('button');
      btn.className = 'cp-idea' + (ch === copyChar ? ' selected' : '') + (clean >= PRACTICE_MASTER ? ' known' : '');
      btn.dataset.ch = ch;
      btn.innerHTML = '<b>' + esc(ch) + '</b><span>' + esc(py) + '</span><i>' + esc(en) + '</i>';
      btn.title = 'Tap to copy ' + ch + ' · written from memory ' + clean + ' time(s) on this phone';
      btn.addEventListener('click', () => setCopyChar(ch));
      itemsEl.appendChild(btn);
    }
    box.classList.remove('hidden');
  }

  function sendConjure(ch, opts) {
    if (!me || conjurePending) return;
    const o = opts || {};
    const strokes = padPayload();
    // A pending recogniser run would overwrite the isle's answer (e.g. a refusal reason).
    clearTimeout(padPauseTimer);
    // D3: do not close the pad here. It closes only when the isle says yes.
    conjurePending = {
      ch,
      from: o.from || 'pick',
      rank: o.rank || 0,
      free: !copyChar,
      strokes: strokes.length
    };
    me.send({ type: 'conjure', ch, strokes });
    setPadStatus('Sending…');
    updateUseBtn();
    clearTimeout(conjurePendingTimer);
    conjurePendingTimer = setTimeout(() => {
      conjurePending = null;
      updateUseBtn();
      // Network fallback only: the server answers every conjure (D5). Keep the pad open
      // and the drawing rather than pretend it worked.
      setPadStatus('No answer from the isle. Try again.');
    }, 4000);
  }

  // Board replay of ink strokes above player
  function onConjuredBroadcast(msg) {
    // msg: { type: 'conjured', id, ch, strokes, s }
    // Announce who conjured what
    const caller = roster.get(msg.id);
    const name = caller ? caller.name : 'Someone';
    say(msg.id, `${name} conjured ${msg.ch}!`, 2500);
    sfx.pop();

    if (msg.id === myId) {
      const done = conjurePending;
      conjurePending = null;
      clearTimeout(conjurePendingTimer);
      updateUseBtn();
      // D8: a clean free write is one the player wrote from memory (Free mode), that the
      // recogniser put first, and that the isle accepted.
      if (done && done.free && done.from === 'match' && done.rank === 0 && done.strokes > 0) {
        notePractice(msg.ch);
      }
      // D3: the isle said yes — only now does the pad close.
      const pad = $('conjure-pad');
      if (pad) pad.classList.add('hidden');
      clearPad();
    }

    // A pick (no drawing, CJ-08) has nothing to replay.
    if (!isBoard || !Array.isArray(msg.strokes) || msg.strokes.length === 0) return;
    const overlay = $('board-replay');
    const rcv = $('replay-canvas');
    if (!overlay || !rcv) return;

    overlay.classList.remove('hidden');
    rcv.width = window.innerWidth;
    rcv.height = window.innerHeight;
    const rctx = rcv.getContext('2d');
    rctx.clearRect(0, 0, rcv.width, rcv.height);

    // Find the wobbler screen position
    const wob = wobblers.get(msg.id);
    let cx = rcv.width / 2, cy = rcv.height * 0.4;
    if (wob) {
      const v = new THREE.Vector3(wob.x, wob.y + 1.8, wob.z);
      v.project(cam);
      cx = (v.x * 0.5 + 0.5) * rcv.width;
      cy = (-v.y * 0.5 + 0.5) * rcv.height;
    }

    const size = Math.min(180, rcv.width * 0.25);
    const ox = cx - size / 2, oy = cy - size / 2;

    rctx.lineWidth = 6;
    rctx.lineCap = 'round';
    rctx.lineJoin = 'round';
    rctx.strokeStyle = '#2b2118';

    // Animate strokes over 0.6s
    const startTime = performance.now();
    const duration = 600;

    function drawFrame(now) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      rctx.clearRect(0, 0, rcv.width, rcv.height);

      // Draw partial strokes
      const totalStrokes = msg.strokes.length;
      const curStrokeIdx = Math.floor(progress * totalStrokes);

      rctx.beginPath();
      for (let i = 0; i <= curStrokeIdx && i < totalStrokes; i++) {
        const st = msg.strokes[i];
        if (!st || st.length === 0) continue;
        rctx.moveTo(ox + st[0][0] * size, oy + st[0][1] * size);
        const ptProgress = (i === curStrokeIdx)
          ? (progress * totalStrokes - i)
          : 1;
        const ptsToDraw = Math.max(1, Math.floor(ptProgress * st.length));
        for (let j = 1; j < ptsToDraw; j++) {
          rctx.lineTo(ox + st[j][0] * size, oy + st[j][1] * size);
        }
      }
      rctx.stroke();

      if (progress < 1) {
        requestAnimationFrame(drawFrame);
      } else {
        // Fade out overlay
        setTimeout(() => {
          overlay.classList.add('hidden');
          rctx.clearRect(0, 0, rcv.width, rcv.height);
        }, 300);
      }
    }

    requestAnimationFrame(drawFrame);
  }

  // Characters are drawn with the bundled brush face, so wait for it (briefly) before the first stroke.
  let ready = false;
  window.WForgeUI = {
    AIM_LABEL,
    glyphFor,
    state: () => ({
      profile: fz.profile,
      dusk: forgeUI.dusk,
      glowShown: S ? S.gems.filter(g => g.glow && g.g.visible).length : 0,
      gemSlots: $('gems').children.length,
      ticks: forgeUI.ticks,
      bursts: forgeUI.bursts
    })
  };
  const start = () => { if (ready) return; ready = true; buildStage(0); frame(); };
  try { document.fonts.load('64px "Tongzhou Brush"', '同舟木').then(start, start); } catch (e) { start(); }
  setTimeout(start, 2500);

  // for the capture script and for poking around in the console
  window.__ww = { stones,  scene, renderer, cam, view, get stage() { return S; }, get snap() { return snap; }, get myId() { return myId; } };
})();
