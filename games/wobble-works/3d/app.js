// WOBBLE WORKS 3D - Three.js Client & Multi-device Controller
(function () {
  'use strict';

  const params = new URLSearchParams(location.search);
  const isBoard = params.get('board') === '1';
  const cfg = window.WOBBLE_CONFIG || { lanIPs: [location.hostname], port: location.port || 3000 };
  const LVL = window.LVL3D;

  const $ = id => document.getElementById(id);

  // ---------- View Switching ----------
  if (isBoard) {
    $('board').classList.add('active');
  } else {
    $('controller').classList.add('active');
  }

  // ---------- Join URL & QR Code ----------
  function isLoopback(h) { return h === 'localhost' || h === '127.0.0.1' || h === '::1'; }
  const joinHost = params.get('host') || (isLoopback(location.hostname) ? (cfg.lanIPs[0] || location.hostname) : location.hostname);
  const joinPort = params.get('port') || cfg.port;
  const joinURL = 'http://' + joinHost + ':' + joinPort + '/';

  if (isBoard) {
    $('join-url').textContent = joinURL;
    $('lan-port-num').textContent = 'port ' + joinPort;
    $('lan-port-cmd').textContent = 'sudo firewall-cmd --zone=public --add-port=' + joinPort + '/tcp';

    if (window.qrcode) {
      try {
        const qr = qrcode(0, 'M');
        qr.addData(joinURL);
        qr.make();
        $('qr').innerHTML = qr.createImgTag(4, 8);
      } catch (e) {
        $('qr').textContent = joinURL;
      }
    }
    $('copy-url').onclick = () => {
      navigator.clipboard?.writeText(joinURL).then(() => showToast('Link copied! ✓'), () => showToast(joinURL));
    };
  }

  // ---------- Three.js Scene Setup ----------
  const container = isBoard ? $('stage3d') : $('mini3d');
  const scene = new THREE.Scene();
  // Gradient sky: a flat dark fill read as a black void above the hedge on phones.
  (function buildSky() {
    const c = document.createElement('canvas');
    c.width = 2; c.height = 256;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0.00, '#12172a');
    grad.addColorStop(0.42, '#2c3a63');
    grad.addColorStop(0.72, '#5a6f9e');
    grad.addColorStop(1.00, '#94a8c8');
    g.fillStyle = grad;
    g.fillRect(0, 0, 2, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.LinearFilter;
    scene.background = tex;
  })();
  scene.fog = new THREE.FogExp2(0x7c8db0, 0.0075);

  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.5, 300);
  camera.position.set(0, 25, 45);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  // Lights
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x334466, 0.8);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xfff4e0, 0.95);
  dirLight.position.set(30, 50, 25);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 1024;
  dirLight.shadow.mapSize.height = 1024;
  dirLight.shadow.camera.near = 10;
  dirLight.shadow.camera.far = 120;
  dirLight.shadow.camera.left = -50;
  dirLight.shadow.camera.right = 50;
  dirLight.shadow.camera.top = 50;
  dirLight.shadow.camera.bottom = -50;
  scene.add(dirLight);

  // Resize handler
  window.addEventListener('resize', () => {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });

  // ---------- Build World Geometry from LVL3D ----------
  const materials = {
    grass: new THREE.MeshLambertMaterial({ color: 0x3b7a57 }),
    hedge: new THREE.MeshLambertMaterial({ color: 0x224b33 }),
    stone: new THREE.MeshLambertMaterial({ color: 0x606a7c }),
    abyss: new THREE.MeshLambertMaterial({ color: 0x090c14 }),
    wood: new THREE.MeshLambertMaterial({ color: 0xa8713a }),
    tower: new THREE.MeshLambertMaterial({ color: 0x757f92 }),
    crate: new THREE.MeshLambertMaterial({ color: 0xc88b48 }),
    bounce: new THREE.MeshLambertMaterial({ color: 0xff3838, emissive: 0x660000 })
  };

  // Statics
  for (const s of LVL.statics) {
    let geom;
    if (s.type === 'box') {
      geom = new THREE.BoxGeometry(s.sx, s.sy, s.sz);
    } else if (s.type === 'cylinder') {
      geom = new THREE.CylinderGeometry(s.radiusTop, s.radiusBottom, s.height, 24);
    } else if (s.type === 'ramp') {
      geom = new THREE.BoxGeometry(s.sx, s.sy, s.sz);
    }
    if (geom) {
      const mesh = new THREE.Mesh(geom, materials[s.mat] || materials.stone);
      mesh.position.set(s.x, s.y, s.z);
      if (s.rotZ) mesh.rotation.z = s.rotZ;
      if (s.rotY) mesh.rotation.y = s.rotY;
      mesh.receiveShadow = true;
      mesh.castShadow = s.type !== 'box' || s.sy > 1.5;
      scene.add(mesh);
    }
  }

  // Trampolines / Bounce Pads
  for (const b of LVL.bouncePads) {
    const padMesh = new THREE.Mesh(new THREE.BoxGeometry(b.sx, 0.4, b.sz), materials.bounce);
    padMesh.position.set(b.x, b.y, b.z);
    scene.add(padMesh);

    // Glowing rim
    const rimGeom = new THREE.BoxGeometry(b.sx + 0.3, 0.45, b.sz + 0.3);
    const rimMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, wireframe: true });
    const rimMesh = new THREE.Mesh(rimGeom, rimMat);
    rimMesh.position.set(b.x, b.y, b.z);
    scene.add(rimMesh);
  }

  // Dynamic Crates Mesh Pool
  const crateMeshes = new Map();
  for (const c of LVL.crates) {
    const geom = new THREE.BoxGeometry(c.size, c.size, c.size);
    const mesh = new THREE.Mesh(geom, materials.crate);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.set(c.x, c.y, c.z);
    scene.add(mesh);
    crateMeshes.set(c.id, mesh);
  }

  // Dynamic See-Saws
  const seesawMeshes = new Map();
  for (const ss of LVL.seesaws) {
    const geom = new THREE.BoxGeometry(ss.length, ss.thickness, ss.width);
    const mesh = new THREE.Mesh(geom, materials.wood);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.set(ss.x, ss.y, ss.z);
    scene.add(mesh);
    seesawMeshes.set(ss.id, mesh);
  }

  // The Ball (Glow Core)
  const ballGeom = new THREE.SphereGeometry(0.85, 24, 24);
  const ballMat = new THREE.MeshStandardMaterial({
    color: 0xffd700,
    emissive: 0xff9900,
    emissiveIntensity: 0.6,
    metalness: 0.3,
    roughness: 0.2
  });
  const ballMesh = new THREE.Mesh(ballGeom, ballMat);
  ballMesh.castShadow = true;
  ballMesh.position.set(LVL.ballSpawn.x, LVL.ballSpawn.y, LVL.ballSpawn.z);
  scene.add(ballMesh);

  // Ball glow light
  const ballLight = new THREE.PointLight(0xffaa00, 1.2, 12);
  ballMesh.add(ballLight);

  // Active Goal Beacon Visualizer
  const beaconGroup = new THREE.Group();
  const beaconColGeom = new THREE.CylinderGeometry(0.3, 0.3, 30, 16);
  const beaconColMat = new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.35 });
  const beaconCol = new THREE.Mesh(beaconColGeom, beaconColMat);
  beaconCol.position.y = 15;
  beaconGroup.add(beaconCol);

  const beaconRingGeom = new THREE.TorusGeometry(3.0, 0.18, 12, 32);
  const beaconRingMat = new THREE.MeshBasicMaterial({ color: 0xffd700 });
  const beaconRing = new THREE.Mesh(beaconRingGeom, beaconRingMat);
  beaconRing.rotation.x = Math.PI / 2;
  beaconGroup.add(beaconRing);

  scene.add(beaconGroup);

  // Every goal keeps a dim marker. Before this, only the active goal existed in
  // the scene, so four zones looked like pointless empty slabs.
  const goalMarkers = new Map();
  for (const g of LVL.goals) {
    const grp = new THREE.Group();
    grp.position.set(g.x, g.y, g.z);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry((g.r || 3) * 0.72, 0.1, 10, 28),
      new THREE.MeshBasicMaterial({ color: g.color || 0xffd700, transparent: true, opacity: 0.5 })
    );
    ring.rotation.x = Math.PI / 2;
    grp.add(ring);
    const spark = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 12, 12),
      new THREE.MeshBasicMaterial({ color: g.color || 0xffd700, transparent: true, opacity: 0.6 })
    );
    grp.add(spark);
    scene.add(grp);
    goalMarkers.set(g.name, grp);
  }

  function updateBeacon(goal) {
    if (!goal) return;
    beaconGroup.position.set(goal.x, goal.y, goal.z);
    beaconColMat.color.setHex(goal.color || 0xffd700);
    beaconRingMat.color.setHex(goal.color || 0xffd700);
    for (const [name, grp] of goalMarkers) grp.visible = name !== goal.name;
  }
  updateBeacon(LVL.goals[0]);

  // ---------- Player Avatar 3D Models ----------
  const playerMeshes = new Map(); // id -> { root, body, eyes, lHand, rHand, crown, label, targetX, targetY, targetZ, targetRot }

  function createNameplateTexture(name, score) {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(20, 24, 36, 0.85)';
    ctx.roundRect ? ctx.roundRect(4, 4, 248, 56, 12) : ctx.rect(4, 4, 248, 56);
    ctx.fill();
    ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(name + ' (' + (score || 0) + ')', 128, 40);
    return new THREE.CanvasTexture(canvas);
  }

  function createAvatarMesh(p) {
    const root = new THREE.Group();

    // Capsule / Pill Body
    const bodyMat = new THREE.MeshLambertMaterial({ color: p.color || 0xff4757 });
    const pillGeom = new THREE.CylinderGeometry(0.55, 0.55, 0.9, 16);
    const bodyMesh = new THREE.Mesh(pillGeom, bodyMat);
    bodyMesh.position.y = 0.95;
    bodyMesh.castShadow = true;
    root.add(bodyMesh);

    // Top head sphere
    const topSphere = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 16), bodyMat);
    topSphere.position.y = 1.4;
    topSphere.castShadow = true;
    root.add(topSphere);

    // Bottom cap
    const btmSphere = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 16), bodyMat);
    btmSphere.position.y = 0.5;
    root.add(btmSphere);

    // Cartoon Eyes
    const eyeGeom = new THREE.SphereGeometry(0.14, 12, 12);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x111111 });

    const lEye = new THREE.Mesh(eyeGeom, eyeMat);
    lEye.position.set(0.2, 1.45, 0.48);
    const lPupil = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), pupilMat);
    lPupil.position.set(0.2, 1.45, 0.6);
    root.add(lEye); root.add(lPupil);

    const rEye = new THREE.Mesh(eyeGeom, eyeMat);
    rEye.position.set(-0.2, 1.45, 0.48);
    const rPupil = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), pupilMat);
    rPupil.position.set(-0.2, 1.45, 0.6);
    root.add(rEye); root.add(rPupil);

    // Hands
    const handGeom = new THREE.SphereGeometry(0.18, 12, 12);
    const handMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const lHand = new THREE.Mesh(handGeom, handMat);
    lHand.position.set(0.65, 0.9, 0.2);
    root.add(lHand);

    const rHand = new THREE.Mesh(handGeom, handMat);
    rHand.position.set(-0.65, 0.9, 0.2);
    root.add(rHand);

    // Golden Crown Mesh
    const crownGroup = new THREE.Group();
    const crownMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.8, roughness: 0.2 });
    const crownBase = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.2, 8), crownMat);
    crownGroup.add(crownBase);
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 4), crownMat);
      cone.position.set(Math.cos(angle) * 0.35, 0.2, Math.sin(angle) * 0.35);
      crownGroup.add(cone);
    }
    crownGroup.position.y = 2.25;
    crownGroup.visible = !!p.crown;
    root.add(crownGroup);

    // Nameplate Sprite Billboard
    const nameTex = createNameplateTexture(p.name, p.score);
    const spriteMat = new THREE.SpriteMaterial({ map: nameTex });
    const nameSprite = new THREE.Sprite(spriteMat);
    nameSprite.position.y = 2.65;
    nameSprite.scale.set(3.2, 0.8, 1);
    root.add(nameSprite);

    scene.add(root);
    return {
      root,
      bodyMesh,
      topSphere,
      btmSphere,
      lHand,
      rHand,
      crownGroup,
      nameSprite,
      targetX: p.x, targetY: p.y, targetZ: p.z, targetRot: p.rot,
      lastScore: p.score
    };
  }

  // Confetti / Fireworks Particle System
  const confettiParticles = [];
  function triggerCelebration(x, y, z) {
    for (let i = 0; i < 80; i++) {
      const geom = new THREE.PlaneGeometry(0.25, 0.25);
      const mat = new THREE.MeshBasicMaterial({
        color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
        side: THREE.DoubleSide
      });
      const p = new THREE.Mesh(geom, mat);
      p.position.set(x, y + 1, z);
      const angle = Math.random() * Math.PI * 2;
      const speed = 6 + Math.random() * 14;
      p.userData = {
        vx: Math.cos(angle) * speed,
        vy: 10 + Math.random() * 12,
        vz: Math.sin(angle) * speed,
        rotSpeed: (Math.random() - 0.5) * 8,
        life: 2.5
      };
      scene.add(p);
      confettiParticles.push(p);
    }
  }

  function updateParticles(dt) {
    for (let i = confettiParticles.length - 1; i >= 0; i--) {
      const p = confettiParticles[i];
      p.userData.life -= dt;
      if (p.userData.life <= 0) {
        scene.remove(p);
        confettiParticles.splice(i, 1);
        continue;
      }
      p.userData.vy -= 18 * dt; // gravity
      p.position.x += p.userData.vx * dt;
      p.position.y += p.userData.vy * dt;
      p.position.z += p.userData.vz * dt;
      p.rotation.x += p.userData.rotSpeed * dt;
      p.rotation.y += p.userData.rotSpeed * dt;
    }
  }

  // ---------- Networking (WebSocket) ----------
  let ws = null;
  let myId = localStorage.getItem('wobble_pid') || null;
  let myName = localStorage.getItem('wobble_name') || '';
  let myPlayer = null;
  let activeGoal = LVL.goals[0];

  function connect() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(proto + '//' + location.host + '/ws');

    ws.onopen = () => {
      if (isBoard) {
        send({ type: 'join', board: true });
      } else {
        if (!myName) {
          $('join-gate').classList.remove('hidden');
        } else {
          send({ type: 'join', playerId: myId, name: myName, board: false });
        }
      }
    };

    ws.onmessage = evt => {
      try {
        const msg = JSON.parse(evt.data);
        handleMessage(msg);
      } catch (e) {}
    };

    ws.onclose = () => {
      setTimeout(connect, 1800);
    };
  }

  function send(data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  // Join Gate submission
  $('gate-go').onclick = () => {
    const val = $('gate-name').value.trim();
    if (!val) return;
    myName = val;
    localStorage.setItem('wobble_name', myName);
    $('join-gate').classList.add('hidden');
    send({ type: 'join', playerId: myId, name: myName, board: false });
  };

  // Quick Emoji Pickers for Gate
  const emojiRow = $('gate-emojis');
  const emojis = ['🐸', '🐯', '🐼', '🦊', '🦄', '🤖', '🐙', '🦖'];
  emojis.forEach((em, idx) => {
    const b = document.createElement('button');
    b.className = 'emoji-btn' + (idx === 0 ? ' selected' : '');
    b.textContent = em;
    b.onclick = () => {
      document.querySelectorAll('.emoji-btn').forEach(x => x.classList.remove('selected'));
      b.classList.add('selected');
      $('gate-name').value = em + ' ' + ($('gate-name').value.replace(/^[\p{Emoji}\s]+/u, '') || 'Player');
    };
    emojiRow.appendChild(b);
  });
  $('gate-name').value = emojis[0] + ' Wobbler';

  // ---------- Message Handlers ----------
  function handleMessage(msg) {
    if (msg.type === 'joined') {
      if (!isBoard && msg.id) {
        myId = msg.id;
        localStorage.setItem('wobble_pid', myId);
        $('c-name').textContent = msg.name;
        $('c-avatar-badge').style.background = msg.color || '#ff4757';
      }
      if (msg.activeGoal) {
        activeGoal = msg.activeGoal;
        updateBeacon(activeGoal);
      }
      return;
    }

    if (msg.type === 'state') {
      applySnapshot(msg);
      return;
    }

    if (msg.type === 'toast') {
      showToast(msg.text);
      return;
    }

    if (msg.type === 'fx') {
      const ev = msg.event;
      if (ev.type === 'goalScored') {
        showCelebration(ev);
        triggerCelebration(ev.x, ev.y, ev.z);
      } else if (ev.type === 'tackle') {
        showToast('💥 ' + ev.tackler + ' tackled ' + ev.victim + '!');
      } else if (ev.type === 'throw') {
        showToast('🚀 ' + ev.who + ' threw the Core!');
      }
    }
  }

  function applySnapshot(snap) {
    // Sync Goal
    if (snap.goal && snap.goal.id !== activeGoal.id) {
      activeGoal = snap.goal;
      updateBeacon(activeGoal);
      if (isBoard) $('b-target').textContent = '🎯 TARGET: ' + activeGoal.name;
    }

    // Ball position
    ballMesh.position.lerp(new THREE.Vector3(snap.ball.x, snap.ball.y, snap.ball.z), 0.35);

    // Crates
    for (const c of snap.crates) {
      const m = crateMeshes.get(c.id);
      if (m) {
        m.position.set(c.x, c.y, c.z);
        m.quaternion.set(c.qx, c.qy, c.qz, c.qw);
      }
    }

    // See-saws
    for (const s of snap.seesaws) {
      const m = seesawMeshes.get(s.id);
      if (m) {
        m.position.set(s.x, s.y, s.z);
        m.quaternion.set(s.qx, s.qy, s.qz, s.qw);
      }
    }

    // Players
    const activeIds = new Set();
    let mvp = null;

    for (const p of snap.players) {
      activeIds.add(p.id);
      if (!mvp || p.score > mvp.score) mvp = p;

      let am = playerMeshes.get(p.id);
      if (!am) {
        am = createAvatarMesh(p);
        playerMeshes.set(p.id, am);
      }

      am.targetX = p.x; am.targetY = p.y; am.targetZ = p.z; am.targetRot = p.rot;
      am.crownGroup.visible = !!p.crown;

      // AFK sleeping statue appearance
      if (p.afk) {
        am.bodyMesh.material.opacity = 0.55;
        am.bodyMesh.material.transparent = true;
      } else {
        am.bodyMesh.material.opacity = 1.0;
        am.bodyMesh.material.transparent = false;
      }

      // Carrying hands animation
      if (p.carrying) {
        am.lHand.position.set(0.3, 2.1, 0.1);
        am.rHand.position.set(-0.3, 2.1, 0.1);
      } else {
        am.lHand.position.set(0.65, 0.9, 0.2);
        am.rHand.position.set(-0.65, 0.9, 0.2);
      }

      // Score update on nameplate
      if (p.score !== am.lastScore) {
        am.lastScore = p.score;
        am.nameSprite.material.map = createNameplateTexture(p.name, p.score);
      }

      if (p.id === myId) {
        myPlayer = p;
        if (!isBoard) {
          $('c-score').textContent = '⭐ ' + p.score;
          // Compass distance to goal
          const dx = activeGoal.x - p.x;
          const dz = activeGoal.z - p.z;
          const dist = Math.round(Math.hypot(dx, dz));
          $('c-target').textContent = '🎯 ' + activeGoal.name + ' · ' + dist + 'm';
        }
      }
    }

    // Clean up disconnected players
    for (const [id, am] of playerMeshes.entries()) {
      if (!activeIds.has(id)) {
        scene.remove(am.root);
        playerMeshes.delete(id);
      }
    }

    // Board HUD updates
    if (isBoard) {
      $('b-players').textContent = '👥 ' + snap.players.length + ' players';
      $('b-crown').textContent = (mvp && mvp.score > 0) ? ('👑 MVP: ' + mvp.name + ' (' + mvp.score + ')') : '👑 MVP: —';
      updateLeaderboard(snap.players);
    }
  }

  function updateLeaderboard(players) {
    const list = $('leaderboard');
    if (!list) return;
    const sorted = [...players].sort((a, b) => b.score - a.score);
    if (!sorted.length) {
      list.innerHTML = '<div class="lb-empty muted">Waiting for wobblers...</div>';
      return;
    }
    list.innerHTML = sorted.map((p, i) => `
      <div class="lb-row">
        <div class="lb-name">
          <span>${(i === 0 && p.score > 0) ? '👑' : '#' + (i + 1)}</span>
          <span class="lb-dot" style="background:${p.color}"></span>
          <span>${p.name} ${p.afk ? '💤' : ''}</span>
        </div>
        <div class="lb-score">${p.score} pts</div>
      </div>
    `).join('');
  }

  function showCelebration(ev) {
    if (isBoard) {
      $('win-title').textContent = ev.scorer;
      $('win-subtitle').textContent = 'Slam dunked into ' + ev.goalName + '! (+100 PTS)';
      $('win-assist').textContent = ev.assist ? '✦ Assist by ' + ev.assist + ' (+50 PTS)' : '';
      $('win-banner').classList.remove('hidden');
      setTimeout(() => $('win-banner').classList.add('hidden'), 3600);
    } else {
      $('c-popup-txt').textContent = ev.scorer + ' SCORED!';
      $('c-score-popup').classList.remove('hidden');
      setTimeout(() => $('c-score-popup').classList.add('hidden'), 2200);
    }
  }

  function showToast(text) {
    const t = isBoard ? $('b-toast') : $('c-toast');
    if (!t) return;
    t.textContent = text;
    t.classList.add('active');
    setTimeout(() => t.classList.remove('active'), 2500);
  }

  // ---------- Mobile Virtual Joystick & Touch Controls ----------
  const joyState = { x: 0, z: 0, active: false };
  const joyZone = $('joy-zone');
  const joyBase = $('joy-base');
  const joyStick = $('joy-stick');
  let joyTouchId = null;
  let joyOriginX = 0, joyOriginY = 0;

  if (joyZone) {
    joyZone.addEventListener('touchstart', e => {
      e.preventDefault();
      const touch = e.changedTouches[0];
      joyTouchId = touch.identifier;
      const rect = joyBase.getBoundingClientRect();
      joyOriginX = rect.left + rect.width / 2;
      joyOriginY = rect.top + rect.height / 2;
      updateJoy(touch.clientX, touch.clientY);
    }, { passive: false });

    window.addEventListener('touchmove', e => {
      if (joyTouchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === joyTouchId) {
          updateJoy(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
          break;
        }
      }
    }, { passive: false });

    const endJoy = e => {
      if (joyTouchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === joyTouchId) {
          joyTouchId = null;
          joyState.x = 0; joyState.z = 0;
          joyStick.style.transform = 'translate(0px, 0px)';
          sendInput();
          break;
        }
      }
    };
    window.addEventListener('touchend', endJoy);
    window.addEventListener('touchcancel', endJoy);

    function updateJoy(cx, cy) {
      const dx = cx - joyOriginX;
      const dy = cy - joyOriginY;
      const dist = Math.hypot(dx, dy);
      const maxR = 48;
      const angle = Math.atan2(dy, dx);
      const clampedR = Math.min(dist, maxR);

      joyStick.style.transform = 'translate(' + (Math.cos(angle) * clampedR) + 'px, ' + (Math.sin(angle) * clampedR) + 'px)';

      // Convert touch delta to camera-relative world direction
      const nx = (Math.cos(angle) * clampedR) / maxR;
      const ny = (Math.sin(angle) * clampedR) / maxR;

      // Camera facing angle
      const camYaw = camera.rotation.y || 0;
      joyState.x = nx * Math.cos(camYaw) + ny * Math.sin(camYaw);
      joyState.z = -nx * Math.sin(camYaw) + ny * Math.cos(camYaw);

      sendInput();
    }
  }

  // Action Button Binds
  const inputState = { jump: false, grabL: false, grabR: false, lift: false, throw: false };

  function bindTouchBtn(btnId, key) {
    const el = $(btnId);
    if (!el) return;
    el.addEventListener('touchstart', e => {
      e.preventDefault();
      inputState[key] = true;
      sendInput();
    }, { passive: false });
    el.addEventListener('touchend', e => {
      e.preventDefault();
      inputState[key] = false;
      sendInput();
    }, { passive: false });
  }

  bindTouchBtn('btn-jump', 'jump');
  bindTouchBtn('btn-lift', 'lift');
  bindTouchBtn('btn-throw', 'throw');

  // Grab button acts as hold/toggle
  const grabBtn = $('btn-grab');
  if (grabBtn) {
    grabBtn.addEventListener('touchstart', e => {
      e.preventDefault();
      inputState.grabL = !inputState.grabL;
      inputState.grabR = inputState.grabL;
      grabBtn.classList.toggle('active', inputState.grabL);
      sendInput();
    }, { passive: false });
  }

  // Quick Calls
  document.querySelectorAll('.call-btn').forEach(b => {
    b.onclick = () => send({ type: 'call', text: b.dataset.call });
  });

  function sendInput() {
    send({
      type: 'input',
      x: joyState.x,
      z: joyState.z,
      jump: inputState.jump,
      grabL: inputState.grabL,
      grabR: inputState.grabR,
      lift: inputState.lift,
      throw: inputState.throw
    });
  }

  // Keyboard controls for PC host testing
  const keys = {};
  window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'Space') inputState.jump = true;
    if (e.code === 'KeyE') inputState.lift = true;
    if (e.code === 'KeyF') inputState.throw = true;
    if (e.code === 'KeyG') { inputState.grabL = !inputState.grabL; inputState.grabR = inputState.grabL; }
    updateKeyboardInput();
  });
  window.addEventListener('keyup', e => {
    keys[e.code] = false;
    if (e.code === 'Space') inputState.jump = false;
    if (e.code === 'KeyE') inputState.lift = false;
    if (e.code === 'KeyF') inputState.throw = false;
    updateKeyboardInput();
  });

  function updateKeyboardInput() {
    let kx = 0, kz = 0;
    if (keys['KeyW'] || keys['ArrowUp']) kz -= 1;
    if (keys['KeyS'] || keys['ArrowDown']) kz += 1;
    if (keys['KeyA'] || keys['ArrowLeft']) kx -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) kx += 1;
    const len = Math.hypot(kx, kz);
    if (len > 0) { joyState.x = kx / len; joyState.z = kz / len; }
    else { joyState.x = 0; joyState.z = 0; }
    sendInput();
  }

  // Board Room Control Buttons
  if (isBoard) {
    $('btn-next-goal').onclick = () => send({ type: 'nextGoal' });
    $('btn-drop-ball').onclick = () => send({ type: 'dropBall' });
    $('btn-add-bot').onclick = () => send({ type: 'addBot' });
    $('btn-toggle-cam').onclick = () => {
      window.__freeCam = !window.__freeCam;
      showToast(window.__freeCam ? 'Free Overview Cam' : 'Follow Action Cam');
    };
  }

  // ---------- Screen Dimming / Visibility Handling ----------
  document.addEventListener('visibilitychange', () => {
    const isHidden = document.hidden;
    send({ type: 'visibility', hidden: isHidden });
    if (!isBoard) {
      if (isHidden) {
        $('sleep-overlay').classList.remove('hidden');
      }
    }
  });

  $('btn-wake')?.addEventListener('click', () => {
    $('sleep-overlay').classList.add('hidden');
    send({ type: 'visibility', hidden: false });
    if (!ws || ws.readyState !== WebSocket.OPEN) connect();
  });

  // ---------- Render Loop ----------
  let lastTime = performance.now();

  function animate(now) {
    requestAnimationFrame(animate);
    const dt = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;

    // Smoothly interpolate player avatars
    for (const am of playerMeshes.values()) {
      am.root.position.x += (am.targetX - am.root.position.x) * 0.35;
      am.root.position.y += (am.targetY - am.root.position.y) * 0.35;
      am.root.position.z += (am.targetZ - am.root.position.z) * 0.35;
      am.root.rotation.y += (am.targetRot - am.root.rotation.y) * 0.35;
      if (am.crownGroup.visible) {
        am.crownGroup.rotation.y += 1.5 * dt;
        am.crownGroup.position.y = 2.25 + Math.sin(now * 0.005) * 0.08;
      }
    }

    // Stagger nameplates: clustered wobblers used to stack their labels into
    // an unreadable pile (and z-fight into a black plate).
    {
      const list = [...playerMeshes.values()];
      for (const am of list) am.nameSprite.position.y = 2.65;
      for (let i = 0; i < list.length; i++) {
        for (let j = 0; j < i; j++) {
          const a = list[i].root.position, b = list[j].root.position;
          if (Math.hypot(a.x - b.x, a.z - b.z) < 3.2 && Math.abs(a.y - b.y) < 3.5) {
            list[i].nameSprite.position.y += 0.52;
          }
        }
      }
      for (const am of list) {
        const dist = camera.position.distanceTo(am.root.position);
        const s = Math.min(1.5, Math.max(0.55, 10 / Math.max(7, dist)));
        am.nameSprite.scale.set(3.2 * s, 0.8 * s, 1);
      }
    }

    // Spin beacon ring
    beaconRing.rotation.z += 1.2 * dt;

    // Update Particles
    updateParticles(dt);

    // Camera positioning
    // window.__camPose lets a host (or a test harness) park the board camera
    // on a specific zone for a photo.
    if (isBoard && window.__camPose) {
      const P = window.__camPose;
      camera.position.lerp(new THREE.Vector3(P.pos[0], P.pos[1], P.pos[2]), 0.18);
      camera.lookAt(P.look[0], P.look[1], P.look[2]);
    } else if (isBoard && window.__freeCam) {
      const a = now * 0.00009;
      camera.position.lerp(new THREE.Vector3(Math.cos(a) * 78, 56, Math.sin(a) * 78), 0.04);
      camera.lookAt(0, 5, 0);
    } else if (isBoard) {
      // Board camera: Smoothly track ball + crowd
      const targetCamX = ballMesh.position.x + 22;
      const targetCamY = Math.max(18, ballMesh.position.y + 16);
      const targetCamZ = ballMesh.position.z + 32;
      camera.position.lerp(new THREE.Vector3(targetCamX, targetCamY, targetCamZ), 0.05);
      camera.lookAt(ballMesh.position.x, ballMesh.position.y + 1, ballMesh.position.z);
    } else if (myPlayer) {
      // Controller camera: 3rd person follow behind player
      const am = playerMeshes.get(myPlayer.id);
      if (am) {
        const pPos = am.root.position;
        const camDist = 9.0;
        const camHeight = 5.2;
        const targetCamX = pPos.x - Math.sin(am.root.rotation.y) * camDist;
        const targetCamZ = pPos.z - Math.cos(am.root.rotation.y) * camDist;
        camera.position.lerp(new THREE.Vector3(targetCamX, pPos.y + camHeight, targetCamZ), 0.12);
        camera.lookAt(pPos.x, pPos.y + 1.6, pPos.z);
      }
    }

    renderer.render(scene, camera);
  }

  requestAnimationFrame(animate);
  connect();
})();