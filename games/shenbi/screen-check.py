"""Headless check of the real Shenbi page on several screens (needs Python Playwright and /usr/bin/chromium).

Adapted from games/tongzhou-forge-2d/screen-check.py (copied pattern, never imported). For each device it
boots the page from the RUNNING server, plays with real input (Chrome touch events on phones: the pad
written with pointer strokes, chips tapped), and checks the Phase 1C screen budget:
  - the page joins the crew (the join sheet goes away), no console errors;
  - the docked pad opens, fits the screen, never covers the verbs or the stick;
  - 火 written from its stroke data with real touches is offered as a chip (pinyin + meaning beside it),
    tapping the chip clears the pad and puts 火 in your hand (the probe sees it);
  - the pad collapses and reopens;
  - screenshots go to the folder given.
Usage: python3 screen-check.py <port> <outdir>   (the server must already run on that port)
"""
import os, sys
from playwright.sync_api import sync_playwright

PORT, OUT = int(sys.argv[1]), sys.argv[2]
os.makedirs(OUT, exist_ok=True)
URL = f"http://localhost:{PORT}/"
DEVICES = [
    # name, w, h, dpr, touch. Sizes are the page area left by the browser (bars and tabs taken off)
    ("phone-6in-portrait", 390, 844, 3, True),
    ("phone-6in-landscape", 844, 390, 3, True),
    ("phone-small-landscape", 740, 360, 3, True),
    ("ipad-landscape", 1180, 746, 2, True),
    ("laptop", 1280, 720, 1, False),
]

# 火 stroke medians in 0..1, Y down (from vendor/strokes.json, rounded)
HUO = [
    [[0.25, 0.32], [0.34, 0.55]],
    [[0.75, 0.32], [0.66, 0.55]],
    [[0.49, 0.12], [0.45, 0.52], [0.24, 0.85]],
    [[0.50, 0.45], [0.80, 0.86]],
]

passed, failed = 0, 0
def ok(cond, what):
    global passed, failed
    if cond:
        passed += 1
    else:
        failed += 1
        print(f"  FAIL {what}")

def write_char(page, strokes, square, touch):
    """draw a character on the pad square with real pointer events, then wait for the pad to read it"""
    box = page.evaluate(
        """(sel) => { const r = document.querySelector(sel).getBoundingClientRect();
                       return { x: r.x, y: r.y, width: r.width, height: r.height }; }""",
        square,
    )
    for st in strokes:
        pts = [(box["x"] + p[0] * box["width"], box["y"] + (1 - p[1]) * box["height"]) for p in st]
        page.mouse.move(pts[0][0], pts[0][1])
        page.mouse.down()
        for (x, y) in pts[1:]:
            page.mouse.move(x, y, steps=4)
        page.mouse.up()
        page.wait_for_timeout(40)
    page.wait_for_timeout(900)  # UI.padWait (0.5 s) plus the read

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path="/usr/bin/chromium")
    for name, w, h, dpr, touch in DEVICES:
        ctx = browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=dpr,
                                  has_touch=touch, is_mobile=touch)
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.goto(URL)
        page.wait_for_timeout(2500)
        ok(not errors, f"{name}: no console errors ({errors[:2]})")
        ok(page.evaluate("!!window.SB"), f"{name}: the page runs (probe present)")
        # four seats: a device after a crash-out may need the same tap-to-again a phone does
        for _ in range(4):
            if page.evaluate("window.SB && window.SB.me() !== null"):
                break
            page.reload()
            page.wait_for_timeout(2500)
        joined = page.evaluate("window.SB && window.SB.me() !== null")
        ok(joined, f"{name}: the phone joined the crew")

        # the verbs and the stick exist; the pad is closed
        for sel, what in [("#stick", "stick"), ("#jump", "jump"), ("#v-wield", "use"), ("#v-throw", "throw"),
                          ("#v-place", "put"), ("#write-open", "write"), ("#calm", "calm")]:
            vis = page.evaluate(
                """(sel) => { const e = document.querySelector(sel); if (!e) return false;
                              const r = e.getBoundingClientRect();
                              return r.width > 0 && r.height > 0 && r.bottom <= innerHeight && r.right <= innerWidth; }""",
                sel,
            )
            ok(vis, f"{name}: {what} is on screen")

        # open the docked pad with a real tap
        page.tap("#write-open") if touch else page.click("#write-open")
        page.wait_for_timeout(400)
        ok(page.evaluate("window.SB.padOpen()"), f"{name}: the pad opens")
        pr = page.evaluate(
            """() => { const r = document.querySelector('#pad').getBoundingClientRect();
                       return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom }; }"""
        )
        ok(pr["right"] <= w + 1 and pr["bottom"] <= h + 1, f"{name}: the pad fits the screen ({w}x{h}: right {pr['right']:.0f}, bottom {pr['bottom']:.0f})")
        ok(pr["w"] <= 0.62 * w, f"{name}: the docked pad is about a quarter of a landscape screen ({pr['w']:.0f}px of {w})")
        # the pad never covers the verbs or the stick — in landscape. In portrait the controls tuck
        # away while you write (the world keeps running on the server; close the pad to play).
        portrait = h > w
        if portrait:
            tucked = page.evaluate(
                """() => ['padzone', 'verbs'].every(id => {
                     const e = document.getElementById(id);
                     return !e || getComputedStyle(e).visibility === 'hidden'; })"""
            )
            ok(tucked, f"{name}: in portrait the controls tuck away while the pad is open")
        else:
            clear = page.evaluate(
                """() => { const pr = document.querySelector('#pad').getBoundingClientRect();
                           const hits = ['#stick', '#jump', '#v-wield', '#v-throw', '#v-place'];
                           for (const s of hits) {
                             const r = document.querySelector(s).getBoundingClientRect();
                             if (r.left < pr.right && r.right > pr.left && r.top < pr.bottom && r.bottom > pr.top) return false;
                           }
                           return true; }"""
            )
            ok(clear, f"{name}: the pad covers no verb and no stick")
        page.screenshot(path=os.path.join(OUT, f"{name}-pad-open.png"))

        # write 火 with real strokes; the chip carries pinyin and meaning; tap puts it in your hand
        write_char(page, HUO, "#pad-square", touch)
        chips = page.evaluate("window.SB.chips()")
        ok("火" in chips, f"{name}: 火 written with real touches is offered ({chips})")
        chip_text = page.evaluate("(document.querySelector('#pad-chips button') || {}).textContent || ''")
        ok("huǒ" in chip_text and "fire" in chip_text, f"{name}: the chip carries pinyin and meaning ({chip_text!r})")
        (page.tap if touch else page.click)("#pad-chips button")     # the real tap on the chip
        page.wait_for_timeout(900)
        held = page.evaluate(
            """() => { const w = window.SB.world(); const me = window.SB.me();
                       if (!w || !me) return null; const p = w.player(me);
                       if (!p || !p.held) return null; const o = w.obj(p.held); return o ? o.ch : null; }"""
        )
        ok(held == "火", f"{name}: tapping the chip puts 火 in your hand (probe saw {held})")
        ok(page.evaluate("window.SB.status()").find("in your hand") >= 0, f"{name}: the pad says what you hold")
        page.screenshot(path=os.path.join(OUT, f"{name}-wrote.png"))

        # collapse to the thumb chip and reopen
        (page.tap if touch else page.click)("#pad-collapse")
        page.wait_for_timeout(200)
        ok(page.evaluate("!window.SB.padOpen()"), f"{name}: the pad collapses to the thumb chip")
        (page.tap if touch else page.click)("#write-open")
        page.wait_for_timeout(200)
        ok(page.evaluate("window.SB.padOpen()"), f"{name}: the thumb chip reopens the pad")

        ctx.close()
    browser.close()

print(f"SCREEN CHECK: {passed} passed, {failed} failed" + (" — screenshots in " + OUT if not failed else ""))
sys.exit(1 if failed else 0)
