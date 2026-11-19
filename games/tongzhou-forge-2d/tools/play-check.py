"""Plays the first scripted route (routes.mjs) of every isle inside the real page, at real speed, in one look.

The bot's inputs replace the stick and buttons inside world.step, so the page's own loop, renderer,
messages and win card all run; the check fails on a route that does not win or on any console error.
It saves the win card of each isle (JPEG) to the folder given. About 8 minutes for 21 isles.
Usage: python3 tools/play-check.py <port> <ink|cut|greybox> <outdir> [isle ids, comma-separated]
(play-test.mjs boots the server on port 3484 and runs this.) Needs Python Playwright and /usr/bin/chromium.
"""
import os, re, sys, json
from playwright.sync_api import sync_playwright
PORT, ART, OUT = int(sys.argv[1]), sys.argv[2], sys.argv[3]
ONLY = sys.argv[4].split(',') if len(sys.argv) > 4 else None
os.makedirs(OUT, exist_ok=True)
G = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
bot = open(G + 'bot.mjs').read()
routes = open(G + 'routes.mjs').read()
src = re.sub(r'^export ', '', bot, flags=re.M) + '\n' + re.sub(r"^import .*$", '', re.sub(r'^export ', '', routes, flags=re.M), flags=re.M)
src += r'''
window.__play = (name) => {
  const w = WF2D.world, id = 'me';
  const steps = ROUTES[w.L.id]({ w })[name || Object.keys(ROUTES[w.L.id]({ w }))[0]];
  const all = []; let cursor = 0, i = 0, t = 0;
  const take = (tt) => { for (let j = cursor; j < all.length; j++) if (all[j].t === tt) { cursor = j + 1; return all[j]; } return null; };
  const st = window.__st = { done: false, fail: null, at: null };
  const step0 = w.step.bind(w), drain0 = w.drain.bind(w);
  w.drain = () => { const e = drain0(); all.push(...e); return e; };
  w.step = (dt) => {
    if (!st.done && !st.fail) {
      const s = steps[i];
      if (!s) st.done = true;
      else {
        let r;
        try { r = s.fn({ w, p: w.players.get(id), t, ev: all, take }); } catch (e) { st.fail = e.message; r = {}; }
        w.setInput(id, r && r.x || 0, !!(r && r.jump));
        if (r && r.press) for (const what of [].concat(r.press)) w.press(id, what);
        t += dt; st.at = s.name;
        if (r && r.done) { i++; t = 0; }
        else if (t > (s.timeout || 8)) st.fail = 'timeout at ' + s.name;
      }
    }
    step0(dt);
  };
};
'''
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 844, 'height': 390}, device_scale_factor=2, has_touch=True, is_mobile=True)
    page = ctx.new_page()
    errs = []
    page.on('pageerror', lambda e: errs.append(str(e)))
    page.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    page.goto(f'http://localhost:{PORT}/?mute=1&art={ART}')
    page.evaluate('localStorage.clear()')
    ids = page.evaluate('WIsles.ISLES.map(L => L.id)')
    results = []
    for iid in ids:
        if ONLY and iid not in ONLY: continue
        page.goto(f'http://localhost:{PORT}/?mute=1&art={ART}&isle={iid}')
        page.wait_for_function('window.WF2D && WF2D.frames() > 10')
        page.add_script_tag(content=src)
        page.evaluate('__play()')
        msgs = []
        ok = False
        for k in range(180):
            page.wait_for_timeout(500)
            st = page.evaluate('({ ...__st, phase: WF2D.world.phase, msg: document.querySelector("#msg").textContent, win: !document.querySelector("#win").hidden })')
            if st['msg'] and (not msgs or msgs[-1] != st['msg']): msgs.append(st['msg'])
            if st['fail']: break
            if st['win']: ok = True; break
        page.wait_for_timeout(300)
        page.screenshot(path=os.path.join(OUT, f'{iid}.jpg'), quality=70, type='jpeg', scale='css')
        results.append((iid, ok, st.get('fail'), msgs))
        print(('WON ' if ok else 'FAIL'), iid, st.get('fail') or '', '|', ' / '.join(msgs[-6:]), flush=True)
    print('console errors:', errs[:8])
    b.close()
    bad = [r for r in results if not r[1]]
    print(f'PLAY CHECK ({ART}): {len(results) - len(bad)} of {len(results)} isles won' + (', console errors' if errs else ''))
    sys.exit(1 if bad or errs else 0)
