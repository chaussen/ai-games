"""Spike 1b (session 2): is a real-page run bit-exact when the page runs with ?lockstep=1?
Same script as lockstep.py's repeatability part, run in both modes: walk left 1.5 s by real CDP touch, then
jump, three restarts each; print the hero's x,y after each run. Lockstep should give identical numbers.
Usage: python3 lockstep-repeat.py <port>
"""
import sys, datetime
from playwright.sync_api import sync_playwright
PORT = int(sys.argv[1]); T0 = datetime.datetime(2026, 1, 1)

def runs(pw, lock):
    b = pw.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 844, 'height': 390}, device_scale_factor=2, has_touch=True, is_mobile=True)
    page = ctx.new_page(); errs = []; page.on('pageerror', lambda e: errs.append(str(e)))
    page.clock.install(time=T0)
    page.goto(f'http://localhost:{PORT}/?mute=1&art=ink&isle=two-trees' + ('&lockstep=1' if lock else ''))
    page.clock.pause_at(T0 + datetime.timedelta(seconds=1)); page.clock.run_for(3000)
    cdp = ctx.new_cdp_session(page)
    def touch(kind, pts): cdp.send('Input.dispatchTouchEvent', {'type': kind, 'touchPoints': [{'x': x, 'y': y, 'id': i} for i, (x, y) in enumerate(pts)]})
    jb = page.evaluate('WF2D.padRects()')  # jump button: the right-most pad
    jb = max(jb, key=lambda r: r['x']); jx, jy = jb['x'] + jb['w'] / 2, jb['y'] + jb['h'] / 2
    out = []
    for k in range(3):
        page.evaluate('WF2D.restart()'); page.clock.run_for(500)
        f0 = page.evaluate('WF2D.frames()')
        touch('touchStart', [(150, 300)]); page.clock.run_for(48); touch('touchMove', [(110, 300)])
        page.clock.run_for(1200)
        touch('touchStart', [(110, 300), (jx, jy)]); page.clock.run_for(160); touch('touchEnd', [(110, 300)])
        page.clock.run_for(400); touch('touchEnd', [])
        page.clock.run_for(400)
        out.append((page.evaluate('[+WF2D.me().x.toFixed(5), +WF2D.me().y.toFixed(5)]'), page.evaluate('WF2D.frames()') - f0))
    b.close()
    return out, errs

with sync_playwright() as pw:
    for lock in (False, True):
        r, errs = runs(pw, lock)
        same = len({tuple(p) for p, _ in r}) == 1
        print(('lockstep ' if lock else 'free     ') + ' runs (x,y), frames:', r, '-> identical' if same else '-> DIFFER', 'errors:', errs)
