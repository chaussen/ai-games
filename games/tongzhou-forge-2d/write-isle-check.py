"""Writing isles on a running build (docs/CONJURE.md 7a): in every look, upright and sideways, WRITE calls on One Tree
and Water the Tree; the character is written by real touches from its stroke medians and read first; tapping
it puts the stone in your hands and stops the call; on Water the Tree the written 水 douses the flames.
Run through write-isle-test.mjs (boots the server on 3487). Screenshots go to the out dir."""
import sys
from playwright.sync_api import sync_playwright
PORT, OUT = sys.argv[1], sys.argv[2]
import os; os.makedirs(OUT, exist_ok=True)
CASES = [("one-tree", "木"), ("water-the-tree", "水")]
fails = []

class Touch:
    def __init__(self, page):
        self.cdp = page.context.new_cdp_session(page); self.f = {}
    def _s(self, kind):
        self.cdp.send("Input.dispatchTouchEvent", {"type": kind, "touchPoints": [{"x": x, "y": y, "id": i} for i, (x, y) in self.f.items()]})
    def down(self, i, x, y): self.f[i] = (x, y); self._s("touchStart")
    def move(self, i, x, y): self.f[i] = (x, y); self._s("touchMove")
    def up(self, i):
        x, y = self.f.pop(i); self.cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": [{"x": x, "y": y, "id": i}]})

def center(page, sel):
    return page.eval_on_selector(sel, "e => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }")

def tap(page, t, sel):
    x, y = center(page, sel); t.down(9, x, y); page.wait_for_timeout(60); t.up(9)

with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path="/usr/bin/chromium", args=["--no-sandbox"])
    for art in ("ink", "cut", "greybox"):
        for isle, ch in CASES:
            for (vw, vh) in ((390, 844), (844, 390)):
                tag = f"{art}-{isle}-{vw}x{vh}"
                ctx = b.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=2, has_touch=True, is_mobile=True)
                page = ctx.new_page(); errs = []
                page.on("pageerror", lambda e: errs.append(str(e)))
                page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
                page.goto(f"http://localhost:{PORT}/?mute=1&art={art}&isle={isle}")
                page.wait_for_function("window.WF2D && WF2D.frames() > 20")
                t = Touch(page)
                if page.evaluate("WF2D.world.L.id") != isle: fails.append(f"{tag}: loaded {page.evaluate('WF2D.world.L.id')}")
                if not page.evaluate("document.querySelector('#write').classList.contains('call')"): fails.append(f"{tag}: WRITE does not call")
                page.screenshot(path=f"{OUT}/{tag}-1-call.jpg", type="jpeg", quality=70)
                tap(page, t, "#write")
                page.wait_for_function("WF2D.pad().open")
                if page.evaluate("document.querySelector('#write').classList.contains('call')"): fails.append(f"{tag}: WRITE still calls with the pad open")
                ideas = page.inner_text("#wp-ideas")
                if ch not in ideas: fails.append(f"{tag}: Ideas to try lacks {ch}: {ideas!r}")
                sq = page.eval_on_selector("#wp-canvas", "e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }")
                strokes = page.evaluate(f"fetch('vendor/strokes.json').then(r => r.json()).then(d => d.chars['{ch}'].m.map(st => st.map(([x, y]) => [x / 1024, (900 - y) / 1024])))")
                for st in strokes:
                    pts = [(sq["x"] + px * sq["w"], sq["y"] + py * sq["h"]) for px, py in st]
                    t.down(5, *pts[0])
                    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
                        for k in range(1, 7): t.move(5, ax + (bx - ax) * k / 6, ay + (by - ay) * k / 6)
                    t.up(5); page.wait_for_timeout(80)
                page.wait_for_function("WF2D.pad().guesses.length > 0 || /read that/.test(WF2D.pad().status)", timeout=3000)
                g = page.evaluate("WF2D.pad().guesses")
                if not g or g[0]["ch"] != ch:
                    fails.append(f"{tag}: {ch} read as {g}"); ctx.close(); continue
                tap(page, t, f".wp-tile[data-ch='{ch}']")
                page.wait_for_function("!WF2D.pad().open")
                page.wait_for_timeout(400)
                held = page.evaluate("WF2D.me().hold && WF2D.me().hold.ch")
                if held != ch: fails.append(f"{tag}: holding {held!r} after writing {ch}")
                if page.evaluate("document.querySelector('#write').classList.contains('call')"): fails.append(f"{tag}: WRITE still calls after a write")
                page.screenshot(path=f"{OUT}/{tag}-2-wrote.jpg", type="jpeg", quality=70)
                if isle == "water-the-tree":
                    # carry it to the flames (teleport past the gap, then walk with the stick key) and see them go out
                    page.evaluate("(() => { const p = WF2D.me(); p.x = 19.0; p.y = 2; })()")
                    page.keyboard.down("ArrowLeft"); page.wait_for_timeout(900); page.keyboard.up("ArrowLeft")
                    page.wait_for_timeout(500)
                    if not page.evaluate("WF2D.world.hedges.every(m => m.done)"): fails.append(f"{tag}: the flames did not go out")
                    page.screenshot(path=f"{OUT}/{tag}-3-doused.jpg", type="jpeg", quality=70)
                fails.extend(f"{tag}: console: {e}" for e in errs)
                ctx.close()
    b.close()
print("\n".join(fails) if fails else "WRITING ISLES: ALL PASSED")
sys.exit(1 if fails else 0)
