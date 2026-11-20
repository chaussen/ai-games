"""Spike 1 (autotest research): can a test freeze the real page's clock, step it frame by frame,
and drive it with real touch events (CDP), so a slow observer (vision model, CV) can play a real-time game?
Usage: python3 lockstep.py <port> <outdir>   (server: PORT=<port> HOST=127.0.0.1 node ../../server.js)
"""
import sys, time, datetime
from playwright.sync_api import sync_playwright
PORT = int(sys.argv[1]); OUT = sys.argv[2]
T0 = datetime.datetime(2026, 1, 1)
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 844, 'height': 390}, device_scale_factor=2, has_touch=True, is_mobile=True)
    page = ctx.new_page()
    errs = []; page.on('pageerror', lambda e: errs.append(str(e)))
    page.clock.install(time=T0)
    page.goto(f'http://localhost:{PORT}/?mute=1&art=ink&isle=two-trees')
    page.clock.pause_at(T0 + datetime.timedelta(seconds=1))
    page.clock.run_for(3000)
    f0 = page.evaluate('WF2D.frames()'); x0 = page.evaluate('WF2D.me().x')
    time.sleep(1.0)
    f1 = page.evaluate('WF2D.frames()')
    print('paused: frames before/after 1 s of wall time:', f0, f1)
    t = time.time(); page.clock.run_for(1000); dt = time.time() - t
    f2 = page.evaluate('WF2D.frames()')
    print('run_for(1000) -> frames', f2 - f1, 'wall', round(dt, 2), 's')
    cdp = ctx.new_cdp_session(page)
    def touch(kind, pts): cdp.send('Input.dispatchTouchEvent', {'type': kind, 'touchPoints': [{'x': x, 'y': y, 'id': i} for i, (x, y) in enumerate(pts)]})
    touch('touchStart', [(150, 300)]); page.clock.run_for(50); touch('touchMove', [(200, 300)])
    xs = []
    for i in range(6):
        page.clock.run_for(167)
        xs.append(round(page.evaluate('WF2D.me().x'), 3))
    print('stick held right, x every ~10 frames:', round(x0, 3), xs)
    page.screenshot(path=OUT + '/lockstep-a.png')
    touch('touchEnd', [])
    runs = []
    for k in range(3):
        page.evaluate('WF2D.restart()'); page.clock.run_for(500)
        touch('touchStart', [(150, 300)]); page.clock.run_for(50); touch('touchMove', [(110, 300)])
        page.clock.run_for(1500); runs.append(page.evaluate('+WF2D.me().x.toFixed(4)'))
        touch('touchEnd', []); page.clock.run_for(100)
    print('three identical runs, x after 1.5 s walking left:', runs)
    print('errors:', errs)
    b.close()
