"""Helper for tasks/checks/t10.mjs: opens the REAL phone page (portrait, touch) in headless chromium,
joins with a name, and answers commands on stdin, one per line. Nothing is mocked.
  SHOT <file>   -> saves a screenshot, prints "OK"
  DRAW          -> taps DRAW (opens the writing pad), prints "DRAW <json>" (what the pad shows)
  IDEA <n>      -> taps the n-th idea, prints "IDEA <json>"
  ERRORS        -> prints "ERRORS <json>"
  QUIT
Usage: python3 tasks/checks/t10_phone.py <port> <name>   (needs playwright for Python, /usr/bin/chromium)"""
import asyncio, json, sys
from playwright.async_api import async_playwright

ARGS = ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
PAD = """() => {
  const vis = id => { const e = document.getElementById(id); return !!e && !e.classList.contains('hidden') && getComputedStyle(e).display !== 'none'; };
  return {
    open: vis('conjure-pad'),
    guide: vis('cp-guide') ? document.getElementById('cp-guide').textContent : null,
    modeBtn: !!document.getElementById('cp-mode-btn'),
    useBtn: vis('cp-use-btn') ? document.getElementById('cp-use-btn').textContent : null,
    status: document.getElementById('cp-status').textContent,
    head: (document.querySelector('.cp-prac-head') || {}).textContent || '',
    ideas: [...document.querySelectorAll('.cp-idea')].map(b => b.dataset.ch),
    selected: [...document.querySelectorAll('.cp-idea.selected')].map(b => b.dataset.ch)
  };
}"""

async def main():
    port, name = sys.argv[1], sys.argv[2]
    errors = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path="/usr/bin/chromium", args=ARGS)
        ctx = await browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
        page = await ctx.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        await page.goto(f"http://127.0.0.1:{port}/")
        await page.wait_for_timeout(800)
        await page.fill("#gate-name", name)
        await page.click("#gate-go")
        await page.wait_for_timeout(2000)
        print("READY", flush=True)
        loop = asyncio.get_event_loop()
        while True:
            line = (await loop.run_in_executor(None, sys.stdin.readline)).strip()
            if not line or line == "QUIT":
                break
            cmd, _, arg = line.partition(" ")
            if cmd == "SHOT":
                await page.screenshot(path=arg)
                print("OK", flush=True)
            elif cmd == "DRAW":
                await page.tap("#btn-draw")
                await page.wait_for_timeout(400)
                print("DRAW " + json.dumps(await page.evaluate(PAD), ensure_ascii=False), flush=True)
            elif cmd == "IDEA":
                await page.tap(f".cp-idea >> nth={int(arg)}")
                await page.wait_for_timeout(300)
                print("IDEA " + json.dumps(await page.evaluate(PAD), ensure_ascii=False), flush=True)
            elif cmd == "ERRORS":
                print("ERRORS " + json.dumps(errors, ensure_ascii=False), flush=True)
        await browser.close()

asyncio.run(main())
