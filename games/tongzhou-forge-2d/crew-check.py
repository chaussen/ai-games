"""The crew on a running build (docs/CO-OP.md): four headless phones join one isle, each in its own look and
orientation (ink upright, One Stroke sideways, greybox upright, ink sideways). Checked with real touches:
  - everyone sees everyone (four players, four colours), no page errors
  - the stick walks phone A into phone B's player: B is shoved, on every phone
  - A jumps onto B's head and rides when B walks
  - B writes 木 on its pad by real touches while the isle plays on (it never waits in a crew); A sees the stone in
    B's hands and B's strokes replayed over B's head
  - the knock setting in ☰ reaches every phone; a stone thrown at a friend knocks them back
Run through crew-check-test.mjs (boots the server on 3490). Screenshots go to the out dir."""
import sys, os
from playwright.sync_api import sync_playwright
PORT, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
fails = []
PHONES = [("A", "ink", 390, 844), ("B", "cut", 844, 390), ("C", "greybox", 390, 844), ("D", "ink", 844, 390)]


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


def tap(page, t, sel, i=9):
    x, y = center(page, sel); t.down(i, x, y); page.wait_for_timeout(60); t.up(i)


def stick(page, t, dx):
    """thumb down in the lower left and pushed sideways: the stick floats to where the thumb lands"""
    vw, vh = page.viewport_size["width"], page.viewport_size["height"]
    x, y = vw * 0.16, vh * 0.86
    t.down(1, x, y); t.move(1, x + dx * 0.4, y); t.move(1, x + dx, y)


def shot(page, name):
    page.screenshot(path=f"{OUT}/{name}.jpg", type="jpeg", quality=70)


P = "WF2D.world.players"
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path="/usr/bin/chromium", args=["--no-sandbox"])
    ph = {}
    for name, art, vw, vh in PHONES:
        ctx = b.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=2, has_touch=True, is_mobile=True)
        page = ctx.new_page(); errs = []
        page.on("pageerror", lambda e, errs=errs: errs.append(str(e)))
        page.on("console", lambda m, errs=errs: errs.append(m.text) if m.type == "error" else None)
        page.goto(f"http://localhost:{PORT}/?mute=1&crew=1&art={art}")
        page.wait_for_function("window.WF2D && WF2D.crew().live && WF2D.frames() > 10", timeout=8000)
        ph[name] = {"page": page, "t": Touch(page), "errs": errs, "art": art, "tag": f"{name}-{art}-{vw}x{vh}"}
    A, B, C, D = (ph[k] for k in "ABCD")
    pa, pb = A["page"], B["page"]
    for k, v in ph.items():
        v["id"] = v["page"].evaluate("WF2D.crew().id")
    for k, v in ph.items():
        n = v["page"].wait_for_function(f"{P}.size === 4", timeout=4000) and v["page"].evaluate(f"{P}.size")
        if n != 4: fails.append(f"{v['tag']}: sees {n} players, not 4")
    slots = sorted(v["page"].evaluate("WF2D.crew().slot") for v in ph.values())
    if slots != [1, 2, 3, 4]: fails.append(f"four colours: {slots}")
    for v in ph.values(): shot(v["page"], v["tag"] + "-1-crew")

    # park C and D out of the way (far left of the spawn) so A and B have room
    for v in (C, D):
        stick(v["page"], v["t"], -70); v["page"].wait_for_timeout(1300); v["t"].up(1)
    pa.wait_for_timeout(500)

    # ---- A walks into B: B is shoved
    ida, idb = A["id"], B["id"]
    pos = lambda page, i: page.evaluate(f"(() => {{ const p = {P}.get('{i}'); return [p.x, p.y, p.support && p.support.id || null]; }})()")
    ax, _, _ = pos(pa, ida); bx, _, _ = pos(pa, idb)
    d = 1 if bx > ax else -1
    stick(pa, A["t"], 70 * d); pa.wait_for_timeout(1400); A["t"].up(1); pa.wait_for_timeout(300)
    ax2, _, _ = pos(pa, ida); bx2, _, _ = pos(pa, idb)
    if (bx2 - bx) * d < 0.3: fails.append(f"A walking into B did not shove B (B moved {bx2 - bx:+.2f})")
    if abs(ax2 - bx2) < 0.59: fails.append(f"A and B overlap ({ax2:.2f} vs {bx2:.2f})")
    bx_on_b, _, _ = pos(pb, idb)
    if abs(bx_on_b - bx2) > 0.3: fails.append(f"B's own phone has B at {bx_on_b:.2f}, A's at {bx2:.2f}")
    shot(pa, A["tag"] + "-2-shove"); shot(pb, B["tag"] + "-2-shove")

    # ---- A jumps onto B's head: back off a step, then walk in and tap JUMP
    stick(pa, A["t"], -70 * d); pa.wait_for_timeout(250); A["t"].up(1); pa.wait_for_timeout(300)
    on = False
    for attempt in range(6):
        # walk in, and hold JUMP as a person climbing onto a friend does
        stick(pa, A["t"], 60 * d)
        pa.wait_for_timeout(60)
        jx, jy = center(pa, "#jump"); A["t"].down(8, jx, jy)
        pa.wait_for_timeout(260)
        A["t"].up(1); A["t"].up(8)
        pa.wait_for_timeout(700)
        on = pos(pa, ida)[2] == idb
        if on: break
        # missed: come back to B's side for another try
        ax, _, _ = pos(pa, ida); bx, _, _ = pos(pa, idb)
        d = 1 if bx > ax else -1
        if abs(ax - bx) < 0.9: stick(pa, A["t"], -70 * d); pa.wait_for_timeout(300); A["t"].up(1); pa.wait_for_timeout(300)
    if not on: fails.append("A never landed on B's head in six tries")
    else:
        shot(pa, A["tag"] + "-3-on-head"); shot(pb, B["tag"] + "-3-on-head")
        ax, _, _ = pos(pa, ida); bx, _, _ = pos(pa, idb)
        stick(pb, B["t"], 70); pb.wait_for_timeout(700); B["t"].up(1); pb.wait_for_timeout(400)
        ax2, _, s2 = pos(pa, ida); bx2, _, _ = pos(pa, idb)
        if s2 != idb or abs((ax2 - bx2) - (ax - bx)) > 0.15 or abs(bx2 - bx) < 0.3:
            fails.append(f"A did not ride B: B moved {bx2 - bx:+.2f}, A moved {ax2 - ax:+.2f}, A on {s2}")
        shot(pa, A["tag"] + "-4-ride")
        # A hops off
        stick(pa, A["t"], -70); tap(pa, A["t"], "#jump", 8); pa.wait_for_timeout(500); A["t"].up(1); pa.wait_for_timeout(600)

    # ---- B writes 木 by real touches; the isle plays on while the pad is open
    tb = B["t"]
    tap(pb, tb, "#write")
    pb.wait_for_function("WF2D.pad().open")
    c0 = pb.evaluate("WF2D.world.clock")
    sq = pb.eval_on_selector("#wp-canvas", "e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }")
    strokes = pb.evaluate("fetch('vendor/strokes.json').then(r => r.json()).then(d => d.chars['木'].m.map(st => st.map(([x, y]) => [x / 1024, (900 - y) / 1024])))")
    for st in strokes:
        pts = [(sq["x"] + px * sq["w"], sq["y"] + py * sq["h"]) for px, py in st]
        tb.down(5, *pts[0])
        for (ax_, ay_), (bx_, by_) in zip(pts, pts[1:]):
            for k in range(1, 7): tb.move(5, ax_ + (bx_ - ax_) * k / 6, ay_ + (by_ - ay_) * k / 6)
        tb.up(5); pb.wait_for_timeout(80)
    pb.wait_for_function("WF2D.pad().guesses.length > 0 || /read that/.test(WF2D.pad().status)", timeout=3000)
    if pb.evaluate("WF2D.world.clock") - c0 < 0.5: fails.append("the isle waited while B wrote (it must not in a crew)")
    g = pb.evaluate("WF2D.pad().guesses")
    if not g or g[0]["ch"] != "木":
        fails.append(f"B's 木 read as {g}")
    else:
        shot(pb, B["tag"] + "-5-pad")
        tap(pb, tb, ".wp-tile[data-ch='木']")
        pb.wait_for_function("!WF2D.pad().open", timeout=3000)
        try:
            pa.wait_for_function(f"(() => {{ const p = {P}.get('{idb}'); return p && p.hold && p.hold.ch === '木'; }})()", timeout=3000)
        except Exception:
            fails.append("A never saw 木 in B's hands")
        if not pa.evaluate("WF2D.fx.some(f => f.kind === 'strokes')"): fails.append("A does not see B's strokes over B's head")
        pa.wait_for_timeout(150)
        shot(pa, A["tag"] + "-6-friend-wrote"); shot(pb, B["tag"] + "-6-wrote")
        msg = pa.inner_text("#msg")
        if "wrote" not in msg: fails.append(f"A's message line does not say B wrote: {msg!r}")

    # ---- knock: chosen in ☰ on C's phone, every phone follows; B throws 木 at A
    pc = C["page"]
    tap(pc, C["t"], "#menu")
    pc.wait_for_function("!document.querySelector('#drawer').hidden")
    if pc.evaluate("document.querySelector('[data-k=knock]').closest('label').hidden"): fails.append("the knock choice is not in ☰ in a crew")
    pc.select_option("[data-k=knock]", "push")
    tap(pc, C["t"], "[data-act=close]")
    try:
        pa.wait_for_function("WF2D.world.bd.knock === 'push'", timeout=2000)
    except Exception:
        fails.append("the knock setting did not reach A")
    # put A 2.7 in front of B (the checks may place players: a throw's reach is not what is tested here)
    ax, ay, _ = pos(pb, ida); bx, by, _ = pos(pb, idb)
    face = 1 if ax > bx else -1
    # B walks a little toward A and throws while walking
    for attempt in range(4):
        ax, _, _ = pos(pb, ida); bx, _, _ = pos(pb, idb)
        face = 1 if ax > bx else -1
        gap = abs(ax - bx)
        if gap > 3.2: stick(pb, tb, 70 * face); pb.wait_for_timeout(int((gap - 2.8) / 4.6 * 1000)); tb.up(1); pb.wait_for_timeout(200)
        elif gap < 2.3: stick(pb, tb, -70 * face); pb.wait_for_timeout(250); tb.up(1); pb.wait_for_timeout(200); stick(pb, tb, 25 * face); pb.wait_for_timeout(120); tb.up(1)
        else: break
    stick(pb, tb, 70 * face); pb.wait_for_timeout(80)
    label = pb.inner_text("#grab")
    tap(pb, tb, "#grab", 8); pb.wait_for_timeout(100); tb.up(1)
    try:
        pa.wait_for_function("WF2D.fx.some(f => f.kind === 'ink') && /knocked you/.test(document.querySelector('#msg').textContent)", timeout=2500)
        shot(pa, A["tag"] + "-7-knocked")
    except Exception:
        fails.append(f"B's throw (GRAB said {label!r}, gap {abs(ax - bx):.2f}) did not knock A back")

    # the board on a laptop: the crew's four colours, together chosen, the knock row
    bctx = b.new_context(viewport={"width": 1366, "height": 657})
    bp = bctx.new_page(); berr = []
    bp.on("pageerror", lambda e: berr.append(str(e)))
    bp.goto(f"http://localhost:{PORT}/board?art=ink&profile=standard&knock=push")
    try:
        bp.wait_for_function("document.querySelectorAll('#roster .pd').length === 4", timeout=4000)
    except Exception:
        fails.append(f"the board does not show four in the crew: {bp.inner_text('#roster')!r}")
    if "crew=1" not in bp.inner_text("#url"): fails.append("the board's phone link does not join the crew")
    bp.screenshot(path=f"{OUT}/board-1366x657.jpg", type="jpeg", quality=70)
    fails.extend(f"board: {e}" for e in berr)
    for v in ph.values():
        shot(v["page"], v["tag"] + "-8-end")
        fails.extend(f"{v['tag']}: console: {e}" for e in v["errs"])
    b.close()
print("\n".join(fails) if fails else "CREW CHECK: ALL PASSED")
sys.exit(1 if fails else 0)
