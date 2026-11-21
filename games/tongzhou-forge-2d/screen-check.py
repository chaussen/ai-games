"""Headless check of the real page on several screens (needs Python Playwright and /usr/bin/chromium).

For each device it boots the page from the running server, plays with real input (multi-touch on
phones through Chrome's touch events: the stick held while JUMP or GRAB is tapped; keys on a
laptop), and checks the screen budget of docs/GREYBOX.md:
  - nothing but goal, card, msg, menu, stick, grab, jump, write (plus the title on the boat, the win card,
    the menu drawer and the writing pad when opened) is visible; write overlaps no other pad button;
  - the writing pad (docs/CONJURE.md) opens, fits the screen, and 木 written from its stroke data with real
    touches (the mouse on a laptop) is read as 木, and tapping the guess puts 木 in your hands;
  - no top element (goal, card, msg, menu, title) overlaps the pad;
  - your feet are on screen and not under the pad;
  - no console errors.
  - (both looks) the contrast at every visible walkable top is 3:1 or more (WF2D.probe).
Screenshots go to the folder given. Usage: ART=ink|cut|greybox python3 screen-check.py <port> <outdir>
"""
import json, os, sys
from playwright.sync_api import sync_playwright

PORT, OUT = int(sys.argv[1]), sys.argv[2]
os.makedirs(OUT, exist_ok=True)
ART = os.environ.get("ART", "ink")
URL = f"http://localhost:{PORT}/?mute=1&art={ART}"
DEVICES = [
    # name, w, h, dpr, touch. Sizes are the page area left by the browser (bars and tabs taken off)
    ("phone-6in-portrait", 390, 844, 3, True),
    ("phone-small-portrait", 360, 740, 3, True),
    ("phone-6in-landscape", 844, 390, 3, True),
    ("phone-small-landscape", 740, 360, 3, True),
    ("ipad-portrait", 820, 1106, 2, True),       # 10.9" iPad, Safari with its tab bar
    ("ipad-landscape", 1180, 746, 2, True),
    ("ipad-mini-portrait", 744, 1059, 2, True),
    ("ipad-pro-landscape", 1366, 950, 2, True),  # 12.9"
    ("laptop-small", 1366, 657, 1, False),       # 1366x768 screen, Chrome bars
    ("laptop-mac", 1440, 790, 2, False),         # 13" MacBook
    ("laptop-hd", 1920, 960, 1, False),          # 1080p screen
]
TOP = {"goal", "card", "msg", "menu", "title"}
ALLOWED = TOP | {"stick", "grab", "jump", "write", "win", "drawer", "writepad"}
fails = []
ONLY = os.environ.get("DEVICES")
if ONLY:
    DEVICES = [d for d in DEVICES if d[0] in ONLY.split(",")]


def wait(page, label, js, timeout=3000):
    try:
        page.wait_for_function(js, timeout=timeout, polling="raf")
    except Exception:
        st = page.evaluate("(() => { const p = WF2D.me(); return { x: +p.x.toFixed(2), y: +p.y.toFixed(2), vy: +p.vy.toFixed(1), g: p.grounded, qi: p.qi, chain: p.chain, hold: p.hold && p.hold.ch, log: (window._trace || []).slice(-12) }; })()")
        raise RuntimeError(f"waiting for {label}: {st}")


def overlap(a, b):
    return a["x"] < b["x"] + b["w"] and b["x"] < a["x"] + a["w"] and a["y"] < b["y"] + b["h"] and b["y"] < a["y"] + a["h"]


def check(page, dev, moment):
    hud = page.evaluate("WF2D.visibleHud()")
    pads = page.evaluate("WF2D.padRects()")
    feet = page.evaluate("WF2D.feet()")
    w, h = dev[1], dev[2]
    names = [e["name"] for e in hud]
    extra = [n for n in names if n not in ALLOWED]
    if extra:
        fails.append(f"{dev[0]} / {moment}: unexpected HUD {extra}")
    for e in hud:
        if e["name"] in TOP:
            for p in pads:
                if overlap(e, p):
                    fails.append(f"{dev[0]} / {moment}: {e['name']} overlaps the pad")
            if e["x"] < -1 or e["x"] + e["w"] > w + 1:
                fails.append(f"{dev[0]} / {moment}: {e['name']} runs off the screen")
    if not (0 <= feet["x"] <= w and 0 <= feet["y"] <= h):
        fails.append(f"{dev[0]} / {moment}: your feet are off screen {feet}")
    for p in pads:
        if p["x"] - 4 <= feet["x"] <= p["x"] + p["w"] + 4 and p["y"] - 4 <= feet["y"] <= p["y"] + p["h"] + 4:
            fails.append(f"{dev[0]} / {moment}: your feet are under the pad")
    if dev[4] and dev[2] > dev[1] and pads and feet["y"] > min(p["y"] for p in pads):
        fails.append(f"{dev[0]} / {moment}: upright, your feet sit below the top of the pad")
    return names


class Touch:
    """Multi-touch through the DevTools protocol: each finger keeps its id while others come and go."""

    def __init__(self, page):
        self.cdp = page.context.new_cdp_session(page)
        self.fingers = {}

    def _send(self, kind):
        pts = [{"x": x, "y": y, "id": i} for i, (x, y) in self.fingers.items()]
        self.cdp.send("Input.dispatchTouchEvent", {"type": kind, "touchPoints": pts})

    def down(self, fid, x, y):
        self.fingers[fid] = (x, y)
        self._send("touchStart")

    def move(self, fid, x, y):
        self.fingers[fid] = (x, y)
        self._send("touchMove")

    def up(self, fid):
        # Chrome's touchEnd lists the fingers being lifted (not the ones that stay down)
        x, y = self.fingers.pop(fid)
        self.cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": [{"x": x, "y": y, "id": fid}]})


def center(page, sel):
    r = page.eval_on_selector(sel, "e => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }")
    return r[0], r[1]


def wait_frames(page, n=6):
    f = page.evaluate("WF2D.frames()")
    page.wait_for_function(f"WF2D.frames() >= {f + n}")


def run_device(pw_browser, dev):
    name, w, h, dpr, touch = dev
    ctx = pw_browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=dpr, has_touch=touch, is_mobile=touch)
    page = ctx.new_page()
    errors = []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(URL)
    page.evaluate("localStorage.clear()")
    page.goto(URL + "&isle=sun-and-moon")
    shows_pad = page.evaluate("document.documentElement.classList.contains('touch')")
    if shows_pad != touch:
        fails.append(f"{name}: the pad {'is missing' if touch else 'shows'} without ?touch=1 (pointer detection)")
    page.wait_for_function("window.WF2D && WF2D.frames() > 10")
    page.evaluate("""(() => { window._trace = []; const w = WF2D.world, o = w.press.bind(w), d = w.drain.bind(w);
      w.press = (id, what) => { _trace.push('press ' + what); o(id, what); };
      w.drain = () => { const e = d(); e.forEach(x => { if (['jump', 'leap', 'refill', 'land', 'grab', 'respawn'].includes(x.t)) _trace.push(x.t + '@' + WF2D.me().y.toFixed(1)); }); return e; }; })()""")
    page.evaluate("document.fonts.ready")
    # timing-critical taps (a leap at the top of a rise) are fired inside the page on the exact frame,
    # through the JUMP button's own pointer handlers; the Python round trip on a DPR-3 page is 0.2-0.3 s
    # on a laptop the same taps are Space key presses (a touch would switch the page to touch mode)
    page.evaluate("""window._tapJump = (ms) => { if (!document.documentElement.classList.contains('touch')) {
        dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ' }));
        setTimeout(() => dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ' })), ms || 60); return; }
      const el = document.querySelector('#jump'), r = el.getBoundingClientRect();
      const o = { pointerId: 77, pointerType: 'touch', isPrimary: false, bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
      el.dispatchEvent(new PointerEvent('pointerdown', o)); setTimeout(() => el.dispatchEvent(new PointerEvent('pointerup', o)), ms || 60); };
      window._atTop = (then) => { (function f() { const p = WF2D.me(); if (p.grounded) return then(false); if (p.vy < 0.4) return then(true); requestAnimationFrame(f); })(); };
      undefined""")
    wait_frames(page, 10)
    seen = {}
    f0 = page.evaluate("WF2D.frames()"); page.wait_for_timeout(1000)
    seen["fps"] = page.evaluate("WF2D.frames()") - f0
    seen["canvas"] = page.evaluate("[document.querySelector('canvas').width, document.querySelector('canvas').height]")
    seen["boat"] = check(page, dev, "on the boat")
    pr = page.evaluate("WF2D.probe()")
    seen["contrast"] = pr["min"]
    if pr["n"] and pr["min"] < 3:
        fails.append(f"{name}: a walkable top has contrast {pr['min']}:1 (under 3:1) at cell {pr['worst']}")
    page.screenshot(path=f"{OUT}/{name}-1-boat.jpg", type="jpeg", quality=70)

    t = Touch(page) if touch else None

    # 书 WRITE: the button is in the budget and clear of the other pad buttons
    rects = {e["name"]: e for e in page.evaluate("WF2D.visibleHud()")}
    if "write" not in rects:
        fails.append(f"{name}: no WRITE button")
    else:
        for other in ("grab", "jump", "stick"):
            if other in rects and overlap(rects["write"], rects[other]):
                fails.append(f"{name}: WRITE overlaps {other}")
        if "书" not in page.inner_text("#write") or "shū" not in page.inner_text("#write"):
            fails.append(f"{name}: WRITE lacks its character and pinyin: {page.inner_text('#write')!r}")
    # open the pad with a real tap (C on a laptop), write 木 from its stroke medians, tap the guess
    if touch:
        x, y = center(page, "#write"); t.down(4, x, y); page.wait_for_timeout(60); t.up(4)
    else:
        page.keyboard.press("c")
    wait(page, "the pad opens", "WF2D.pad().open")
    wait_frames(page, 3)
    sheet = page.evaluate("WF2D.visibleHud().find(e => e.name === 'writepad')")
    sq = page.eval_on_selector("#wp-canvas", "e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }")
    if not sheet or sheet["y"] < -1 or sheet["y"] + sheet["h"] > h + 1 or sheet["x"] < -1 or sheet["x"] + sheet["w"] > w + 1:
        fails.append(f"{name}: the writing pad does not fit the screen {sheet}")
    if sq["w"] < 180 or abs(sq["w"] - sq["h"]) > 2:
        fails.append(f"{name}: the writing square is {sq['w']:.0f} x {sq['h']:.0f}")
    c0 = page.evaluate("WF2D.world.clock")
    if page.evaluate("new Promise(r => setTimeout(() => r(WF2D.world.clock), 250))") != c0:
        fails.append(f"{name}: the isle did not wait while the pad was open")
    strokes = page.evaluate("fetch('vendor/strokes.json').then(r => r.json()).then(d => d.chars['木'].m.map(st => st.map(([x, y]) => [x / 1024, (900 - y) / 1024])))")
    for st in strokes:
        pts = [(sq["x"] + px * sq["w"], sq["y"] + py * sq["h"]) for px, py in st]
        # each median is a few points: walk between them in small steps, like a finger
        if touch:
            t.down(5, *pts[0])
        else:
            page.mouse.move(*pts[0]); page.mouse.down()
        for (ax, ay), (bx, by) in zip(pts, pts[1:]):
            for k in range(1, 7):
                px, py = ax + (bx - ax) * k / 6, ay + (by - ay) * k / 6
                if touch:
                    t.move(5, px, py)
                else:
                    page.mouse.move(px, py)
        if touch:
            t.up(5)
        else:
            page.mouse.up()
        page.wait_for_timeout(80)
    wait(page, "the pad reads the drawing", "WF2D.pad().guesses.length > 0 || /read that/.test(WF2D.pad().status)", 3000)
    pd = page.evaluate("WF2D.pad()")
    seen["write"] = [(g["ch"], g["score"]) for g in pd["guesses"]]
    page.screenshot(path=f"{OUT}/{name}-0-write.jpg", type="jpeg", quality=70)
    if not pd["guesses"] or pd["guesses"][0]["ch"] != "木":
        fails.append(f"{name}: 木 written on the pad was read as {pd['guesses']} ({pd['status']!r}, {pd['strokes']} strokes)")
    else:
        if touch:
            x, y = center(page, ".wp-tile[data-ch='木']"); t.down(6, x, y); page.wait_for_timeout(60); t.up(6)
        else:
            page.click(".wp-tile[data-ch='木']")
        wait(page, "the pad closes", "!WF2D.pad().open")
        wait_frames(page, 20)
        if page.evaluate("WF2D.me().hold && WF2D.me().hold.ch") != "木" or "木" not in page.inner_text("#msg"):
            fails.append(f"{name}: after writing 木 you hold {page.evaluate('WF2D.me().hold && WF2D.me().hold.ch')!r}, message {page.inner_text('#msg')!r}")
        page.screenshot(path=f"{OUT}/{name}-0b-wrote.jpg", type="jpeg", quality=70)
        seen["wrote"] = check(page, dev, "after writing 木")
    # put it away again so the rest of the check plays the isle as it lies
    page.evaluate("(() => { const p = WF2D.me(); if (p.hold) WF2D.world.consume(p.hold); })()")

    def walk(dx_sign, secs):
        if touch:
            sx, sy = center(page, "#stick")
            t.down(1, sx, sy)
            t.move(1, sx + 36 * dx_sign, sy)
            page.wait_for_timeout(int(secs * 1000))
            t.up(1)
        else:
            key = "ArrowLeft" if dx_sign < 0 else "ArrowRight"
            page.keyboard.down(key)
            page.wait_for_timeout(int(secs * 1000))
            page.keyboard.up(key)

    def tap(sel, key, ms=60):
        # ms: how long the finger stays down (a full jump is pressed, not flicked)
        if touch:
            x, y = center(page, sel)
            t.down(2, x, y)
            page.wait_for_timeout(ms)
            t.up(2)
        else:
            page.keyboard.down(key)
            page.wait_for_timeout(ms)
            page.keyboard.up(key)

    # walk off the boat toward 木 and take it
    walk(-1, 0.75)
    wait_frames(page)
    page.evaluate("(() => { const p = WF2D.me(); const k = WF2D.world.stones.find(s => s.ch === '木'); p.x = k.x + 0.82; p.face = -1; })()")
    wait_frames(page)
    mode = page.get_attribute("#grab", "data-mode")
    if mode != "grab" or "木" not in page.inner_text("#card"):
        fails.append(f"{name}: next to 木 the GRAB button is {mode!r}, card {page.inner_text('#card')!r}")
    if "拿" not in page.inner_text("#grab") or "跳" not in page.inner_text("#jump"):
        fails.append(f"{name}: buttons lack their characters: {page.inner_text('#grab')!r} {page.inner_text('#jump')!r}")
    tap("#grab", "x")
    wait_frames(page, 10)
    seen["carry"] = check(page, dev, "carrying 木")
    page.screenshot(path=f"{OUT}/{name}-2-carry.jpg", type="jpeg", quality=70)
    if page.evaluate("WF2D.me().hold && WF2D.me().hold.ch") != "木":
        fails.append(f"{name}: GRAB did not pick up 木")

    # jump, then 轻功 in mid-air, carrying 木 (one leap allowed): a full press, then a tap at the top
    page.evaluate("(() => { const p = WF2D.me(); p.x = 35.6; p.vx = 0; })()")
    wait_frames(page, 10)
    y0 = page.evaluate("WF2D.me().y")
    page.evaluate("window._best = 0; (function f() { window._best = Math.max(window._best, WF2D.me().y); requestAnimationFrame(f); })()")
    tap("#jump", "Space", 250)   # real touch: the jump
    page.evaluate("new Promise(r => setTimeout(() => _atTop(ok => { if (ok) _tapJump(); r(); }), 50))")
    wait(page, "the leap's top", "WF2D.me().leapt && WF2D.me().vy < 0.3")
    page.screenshot(path=f"{OUT}/{name}-3-leap.jpg", type="jpeg", quality=70)
    seen["leap"] = check(page, dev, "at the top of a leap")
    wait(page, "landing after the leap", "WF2D.me().grounded", 4000)
    top = page.evaluate("window._best") - y0
    if top < 3.0:
        fails.append(f"{name}: jump + leap with a stone only rose {top:.2f} {page.evaluate('window._trace.slice(-8)')}")
    seen["leapHeight"] = round(top, 2)

    # set 日 down on the wrong side of 月: the dud frame and the long message line
    page.evaluate("""(() => { const w = WF2D.world, p = WF2D.me(); if (p.hold) { w.dropHeld(p); }
      const r = w.stones.find(s => s.ch === '日'), m = w.stones.find(s => s.ch === '月');
      p.x = m.x + 0.9; p.y = m.y; p.vx = p.vy = 0; p.face = -1; w.holdStone(p, r); })()""")
    wait_frames(page, 30)
    if page.get_attribute("#grab", "data-mode") != "beside" or "旁" not in page.inner_text("#grab"):
        fails.append(f"{name}: facing 月 with 日 the GRAB button says {page.inner_text('#grab')!r}")
    tap("#grab", "x")
    wait_frames(page, 20)
    msg = page.inner_text("#msg")
    if "another way" not in msg:
        fails.append(f"{name}: dud message was {msg!r}")
    seen["dud"] = check(page, dev, "after a dud")
    page.screenshot(path=f"{OUT}/{name}-4-dud.jpg", type="jpeg", quality=70)

    # take 日 again, go round to the left of 月 and set it down: 明
    page.evaluate("""(() => { const w = WF2D.world, p = WF2D.me(); const r = w.stones.find(s => s.ch === '日'), m = w.stones.find(s => s.ch === '月');
      w.holdStone(p, r); p.x = m.x - 0.9; p.face = 1; })()""")
    wait_frames(page, 6)
    tap("#grab", "x")
    wait_frames(page, 40)
    seen["forge"] = check(page, dev, "after forging")
    card = page.inner_text("#card")
    if "明" not in card or "míng" not in card or "bright" not in card:
        fails.append(f"{name}: after forging the card shows {card!r}")
    page.screenshot(path=f"{OUT}/{name}-5-forge.jpg", type="jpeg", quality=70)

    # offer 明 at the pavilion
    page.evaluate("""(() => { const w = WF2D.world, p = WF2D.me(); const k = w.stones.find(s => s.ch === '明');
      w.holdStone(p, k); p.x = w.pav.x + 1.2; p.y = w.pav.y; p.face = -1; })()""")
    wait_frames(page, 30)
    if page.get_attribute("#grab", "data-mode") != "offer":
        fails.append(f"{name}: at the pavilion with 明 the GRAB button says {page.inner_text('#grab')!r}")
    tap("#grab", "x")
    page.wait_for_function("!document.querySelector('#win').hidden", timeout=6000)
    seen["win"] = check(page, dev, "won")
    page.screenshot(path=f"{OUT}/{name}-6-win.jpg", type="jpeg", quality=70)

    # dawn: the cloud chain, high up (the camera climbs with you)
    page.evaluate("WF2D.goIsle(WIsles.ISLES.findIndex(L => L.id === 'sun-and-moon'))")
    wait_frames(page, 10)
    page.evaluate("(() => { const p = WF2D.me(); p.x = 22.3; p.y = 2; WF2D.world.setDusk(20); })()")
    wait_frames(page, 30)
    # the cloud chain: a thumb steering under the next cloud every frame (in-page, like a thumb on
    # the stick), JUMP tapped for real at the top of each rise
    page.evaluate("""(() => { window._best = 0; window._steer = true; (function f() { const w = WF2D.world, p = WF2D.me();
      window._best = Math.max(window._best, p.y);
      if (window._steer) { const c = w.clouds.filter(c => !p.src.has(c.id) && c.y > p.y + 0.3).sort((a, b) => a.y - b.y)[0];
        const g = w.glow.find(g => !g.got); const tx = c ? c.x : g ? g.x : p.x; WF2D.setStick(Math.max(-1, Math.min(1, (tx - p.x) * 2))); }
      requestAnimationFrame(f); })(); })()""")
    # (JUMP by real touch is checked above; here the whole chain is tapped in-page so no tap is late)
    page.evaluate("""new Promise(r => { _tapJump(250); let n = 0; const go = () => setTimeout(() => _atTop(ok => {
        if (!ok || n++ >= 6) return r(); _tapJump(); go(); }), 120); go(); })""")
    wait(page, "the chain's last top", "(() => { const p = WF2D.me(); return p.grounded || p.vy < 0.4; })()")
    page.screenshot(path=f"{OUT}/{name}-7-dawn-high.jpg", type="jpeg", quality=70)
    seen["high"] = check(page, dev, "high in the air")
    page.evaluate("window._steer = false; WF2D.setStick(null)")
    best = page.evaluate("window._best")
    if best < 9:
        fails.append(f"{name}: the cloud chain only reached {best:.2f} (real input) {page.evaluate('window._trace.slice(-16)')}")
    seen["height"] = round(best, 2)

    # the drawer
    if touch:
        tap("#menu", "Escape")
    else:
        page.keyboard.press("Escape")
    wait_frames(page, 2)
    page.screenshot(path=f"{OUT}/{name}-8-menu.jpg", type="jpeg", quality=70)
    drawer = page.evaluate("WF2D.visibleHud().find(e => e.name === 'drawer')")
    if not drawer:
        fails.append(f"{name}: the menu did not open")
    elif drawer["y"] + drawer["h"] > h + 1:
        fails.append(f"{name}: the menu runs off the bottom ({drawer['y'] + drawer['h']:.0f} > {h})")

    if not touch and page.evaluate("document.documentElement.classList.contains('touch')"):
        fails.append(f"{name}: the pad appeared on a laptop played with keys")
    if errors:
        fails.append(f"{name}: console errors {errors[:3]}")
    ctx.close()
    return seen


with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path="/usr/bin/chromium", args=["--no-sandbox"])
    report = {}
    for dev in DEVICES:
        try:
            report[dev[0]] = run_device(browser, dev)
        except Exception as e:  # a device that crashes the script is a failure, not a stop
            fails.append(f"{dev[0]}: {type(e).__name__}: {e}")
    browser.close()

print(json.dumps(report, ensure_ascii=False))
for f in fails:
    print("FAIL", f)
print("SCREEN CHECK: " + ("ALL PASSED" if not fails else f"{len(fails)} FAILED"))
sys.exit(1 if fails else 0)
