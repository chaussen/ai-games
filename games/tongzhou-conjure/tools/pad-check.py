"""Headless checks for phone pad cards D1-D5 (ROADMAP §4): real server on 3481, real browser.
Usage: python3 tools/pad-check.py   (needs playwright for Python and /usr/bin/chromium)"""
import asyncio, os, subprocess, json, sys
from playwright.async_api import async_playwright

DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 3481
BASE = f"http://127.0.0.1:{PORT}"
ARGS = ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
SPY = """
(() => {
  window.__out = []; window.__in = [];
  const S = WebSocket.prototype.send;
  WebSocket.prototype.send = function (d) {
    try { const m = JSON.parse(d); if (m.type !== 'input' && m.type !== 'ping') window.__out.push(m); } catch (e) {}
    window.__lastWs = this; if (!this.__spy) { this.__spy = 1; this.addEventListener('message', ev => {
      try { const m = JSON.parse(ev.data); if (m.type === 'conjured' || m.type === 'conjureNo') window.__in.push(m); } catch (e) {} }); }
    return S.call(this, d);
  };
})();
"""
fails = 0
def check(ok, label):
    global fails
    print(("PASS ✓ " if ok else "FAIL ✗ ") + label)
    if not ok: fails += 1

async def draw(page, pts):
    box = await page.locator('#cp-canvas').bounding_box()
    await page.mouse.move(box['x'] + pts[0][0], box['y'] + pts[0][1])
    await page.mouse.down()
    for x, y in pts[1:]:
        await page.mouse.move(box['x'] + x, box['y'] + y)
    await page.mouse.up()

async def main():
    server = subprocess.Popen(["node", "server.js"], cwd=DIR, env={**os.environ, "PORT": str(PORT)},
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    await asyncio.sleep(1.0)
    errors = []
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(executable_path="/usr/bin/chromium", args=ARGS)
            ctx = await b.new_context(viewport={"width": 390, "height": 844})
            await ctx.add_init_script(SPY)
            page = await ctx.new_page()
            page.on("pageerror", lambda e: errors.append(str(e)))
            stroke_data = []
            page.on("response", lambda r: stroke_data.append(r.status) if r.url.endswith("/vendor/strokes.json") else None)
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            await page.goto(BASE + "/?name=Tess", wait_until="domcontentloaded")
            await page.wait_for_timeout(2500)
            await page.evaluate("window.__lastWs.send(JSON.stringify({type:'admin', cmd:'goto', i:2}))")
            await page.wait_for_timeout(1500)
            await page.dispatch_event('#btn-draw', 'pointerdown')
            await page.wait_for_timeout(300)
            check(await page.is_visible('#conjure-pad'), 'pad opens')

            # D1: palette tap changes the guide, sends no conjure
            await page.evaluate("document.getElementById('cp-palette').classList.remove('hidden')")
            items = page.locator('#cp-pal-items .cp-pal-btn')
            n = await items.count()
            before = await page.text_content('#cp-guide')
            target = None
            for i in range(n):
                t = (await items.nth(i).text_content()).split()[0]
                if t != before: target = i; break
            await items.nth(target).click()
            await page.wait_for_timeout(300)
            after = await page.text_content('#cp-guide')
            out = await page.evaluate("window.__out.filter(m => m.type === 'conjure').length")
            check(after != before and out == 0, f'D1 palette tap: guide {before}->{after}, conjure msgs sent={out}')

            # D4: make the canvas non-square (390x844-like), draw a square
            await page.evaluate("""(() => { const w = document.getElementById('cp-canvas-wrap');
                w.style.width = '195px'; w.style.height = '422px'; w.style.aspectRatio = 'auto'; })()""")
            await page.dispatch_event('#btn-draw', 'pointerdown')   # close
            await page.dispatch_event('#btn-draw', 'pointerdown')   # reopen -> initPadCanvas resizes
            await page.wait_for_timeout(200)
            sq = [(40, 150), (140, 150), (140, 250), (40, 250), (40, 150)]
            await draw(page, sq)
            # D2: one long 100-point stroke ending at a known spot
            long = [(20 + i * 1.5, 120 + (i % 10) * 3) for i in range(100)]
            await draw(page, long)
            box = await page.locator('#cp-canvas').bounding_box()
            await page.click('#cp-use-btn')
            await page.wait_for_timeout(700)
            msgs = await page.evaluate("window.__out.filter(m => m.type === 'conjure')")
            check(len(msgs) == 1, f'one conjure sent via Use button (got {len(msgs)})')
            st = msgs[0]['strokes']
            xs = [p[0] for p in st[0]]; ys = [p[1] for p in st[0]]
            w, h = max(xs) - min(xs), max(ys) - min(ys)
            check(abs(w - h) <= 0.02, f'D4 square arrives square: w={w:.3f} h={h:.3f}')
            s = min(box['width'], box['height']); oy = (box['height'] - s) / 2
            ex, ey = long[-1][0] / s, (long[-1][1] - oy) / s
            last = st[1][-1]
            check(len(st[1]) <= 40 and abs(last[0] - ex) <= 0.01 and abs(last[1] - ey) <= 0.01,
                  f'D2 long stroke: {len(st[1])} pts, last {last} vs drawn ({ex:.3f},{ey:.3f})')
            ins = await page.evaluate("window.__in")
            check(any(m['type'] == 'conjured' for m in ins), 'first conjure accepted')
            check(not await page.is_visible('#conjure-pad'), 'D3 pad closes on own conjured')

            # D3: forced refusal (cooldown) keeps the pad open and the strokes
            await page.dispatch_event('#btn-draw', 'pointerdown')
            await page.wait_for_timeout(200)
            await draw(page, sq)
            await page.click('#cp-use-btn')
            await page.wait_for_timeout(700)
            ins = await page.evaluate("window.__in")
            no = [m for m in ins if m['type'] == 'conjureNo']
            status = await page.text_content('#cp-status')
            inked = await page.evaluate("""(() => { const c = document.getElementById('cp-canvas');
                const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
                let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n; })()""")
            check(bool(no) and await page.is_visible('#conjure-pad') and inked > 0 and 'Wait a moment' in status,
                  f'D3 refusal ({no[0]["why"] if no else None}): pad open, ink pixels={inked}, status="{status}"')
            check(not await page.is_disabled('#cp-use-btn'), 'Use button re-enabled after refusal')

            # Pick with an empty pad after cooldown: conjured, not silence (D5 / CJ-08)
            await page.wait_for_timeout(4200)
            await page.click('#cp-clear-btn')
            await page.click('#cp-use-btn')
            await page.wait_for_timeout(700)
            ins = await page.evaluate("window.__in")
            check(ins[-1]['type'] == 'conjured' and ins[-1]['strokes'] == [], f'empty pick answered: {ins[-1]["type"]} {ins[-1].get("why","")}')
            check(stroke_data == [200], f'B4: phone loaded vendor/strokes.json once ({stroke_data})')
            srcs = await page.evaluate("['木','人','水'].map(c => (window.WRecog.template(c) || {}).src)")
            check(srcs == ['mmah'] * 3, f'B4: recogniser uses MMAH templates for the stage set ({srcs})')
            check(not errors, 'no console errors: ' + '; '.join(errors[:3]))
            await b.close()
    finally:
        server.kill()
    print('\n--- ALL PAD CHECKS PASSED ---' if not fails else f'\n--- {fails} PAD CHECK(S) FAILED ---')
    sys.exit(1 if fails else 0)

asyncio.run(main())
