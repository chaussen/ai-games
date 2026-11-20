"""Spike 3 (autotest research): ground truth for a "see" test. Freezes the real page mid-isle, saves a
screenshot, and writes what the sim says is on screen (stones with screen positions, the hero, the
GRAB label, walls) so a pixel-only observer's answer can be scored against it.
Usage: python3 see.py <port> <isle> <outprefix>
"""
import sys, json, datetime
from playwright.sync_api import sync_playwright
PORT, ISLE, OUT = int(sys.argv[1]), sys.argv[2], sys.argv[3]
T0 = datetime.datetime(2026, 1, 1)
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 844, 'height': 390}, device_scale_factor=2, has_touch=True, is_mobile=True)
    page = ctx.new_page(); page.clock.install(time=T0)
    page.goto(f'http://localhost:{PORT}/?mute=1&art=ink&isle={ISLE}')
    page.clock.pause_at(T0 + datetime.timedelta(seconds=1)); page.clock.run_for(3000)
    cdp = ctx.new_cdp_session(page)
    def touch(kind, pts): cdp.send('Input.dispatchTouchEvent', {'type': kind, 'touchPoints': [{'x': x, 'y': y, 'id': i} for i, (x, y) in enumerate(pts)]})
    touch('touchStart', [(420, 200)]); page.clock.run_for(50); touch('touchEnd', []); page.clock.run_for(300)   # tap the title card away
    touch('touchStart', [(150, 300)]); page.clock.run_for(50); touch('touchMove', [(110, 300)]); page.clock.run_for(1400); touch('touchEnd', []); page.clock.run_for(800)
    page.screenshot(path=OUT + '.png')
    truth = page.evaluate('''(() => {
      const w = WF2D.world, p = WF2D.me(), S = WF2D.scale(), cam = WF2D.cam, f = WF2D.feet(), W = innerWidth, H = innerHeight;
      const anchorY = f.y + (p.y - cam.y) * S, X = x => (x - cam.x) * S + W / 2, Y = y => anchorY - (y - cam.y) * S;
      const on = (sx, sy) => sx > -20 && sx < W + 20 && sy > -20 && sy < H + 20;
      const stones = w.stones.filter(k => k.state !== 'gone').map(k => ({ ch: k.ch, sx: Math.round(X(k.x)), sy: Math.round(Y(k.y + 0.45)), state: k.state })).filter(k => on(k.sx, k.sy));
      const walls = []; for (let cx = 0; cx < w.w; cx++) for (let cy = 0; cy < w.h; cy++) { const c = w.cell(cx, cy); if ('TFS'.includes(c) && on(X(cx + .5), Y(cy + .5))) walls.push({ kind: {T:'thorns',F:'flames',S:'shade'}[c], sx: Math.round(X(cx + .5)), sy: Math.round(Y(cy + .5)) }); }
      return { viewport: [W, H], hero: { sx: Math.round(f.x), sy: Math.round(f.y), holding: p.hold && p.hold.ch, grounded: p.grounded }, goal: w.L.want,
               grabLabel: w.launch(p).label, stones, walls, hud: WF2D.visibleHud().map(h => h.name) };
    })()''')
    json.dump(truth, open(OUT + '.truth.json', 'w'), ensure_ascii=False, indent=1)
    print(json.dumps(truth, ensure_ascii=False))
    b.close()
