"""Helper for tasks/checks/t04.mjs: opens the REAL board page in headless chromium and answers
commands on stdin, one per line. Nothing is mocked: the page talks to the real server.
  STATE         -> prints "STATE <json>"  (window.WForgeUI.state(), or {"missing": true})
  LABELS        -> prints "LABELS <json>" (window.WForgeUI.AIM_LABEL)
  FORM ch op n  -> prints "FORM <json>"   (window.WForgeUI.glyphFor(ch, [op, n, 0]))
  SHOT <file>   -> saves a screenshot of the board, prints "OK"
  FEED          -> prints "FEED <json>"   (the text of the message feed)
  FRAMES        -> prints "FRAMES <json>" (visible placement frames: class and label)
  ERRORS        -> prints "ERRORS <json>" (page errors and console errors so far)
  QUIT
Usage: python3 tasks/checks/t04_board.py <port> <query>   (needs playwright for Python, /usr/bin/chromium)"""
import asyncio, json, sys
from playwright.async_api import async_playwright

ARGS = ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]

async def main():
    port, query = sys.argv[1], sys.argv[2]
    errors = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path="/usr/bin/chromium", args=ARGS)
        page = await browser.new_page(viewport={"width": 1600, "height": 900})
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        await page.goto(f"http://127.0.0.1:{port}/?board=1&{query}")
        await page.wait_for_timeout(1500)
        print("READY", flush=True)
        loop = asyncio.get_event_loop()
        while True:
            line = (await loop.run_in_executor(None, sys.stdin.readline)).strip()
            if not line or line == "QUIT":
                break
            cmd, _, arg = line.partition(" ")
            if cmd == "STATE":
                s = await page.evaluate("() => window.WForgeUI && typeof window.WForgeUI.state === 'function' ? window.WForgeUI.state() : { missing: true }")
                print("STATE " + json.dumps(s, ensure_ascii=False), flush=True)
            elif cmd == "LABELS":
                s = await page.evaluate("() => (window.WForgeUI && window.WForgeUI.AIM_LABEL) || null")
                print("LABELS " + json.dumps(s, ensure_ascii=False), flush=True)
            elif cmd == "FORM":
                ch, op, slot = arg.split(" ")
                s = await page.evaluate("([ch, op, slot]) => window.WForgeUI && typeof window.WForgeUI.glyphFor === 'function' ? window.WForgeUI.glyphFor(ch, [op, slot, 0]) : null", [ch, op, int(slot)])
                print("FORM " + json.dumps(s, ensure_ascii=False), flush=True)
            elif cmd == "SHOT":
                await page.screenshot(path=arg)
                print("OK", flush=True)
            elif cmd == "FEED":
                s = await page.evaluate("() => document.getElementById('feed').innerText")
                print("FEED " + json.dumps(s, ensure_ascii=False), flush=True)
            elif cmd == "FRAMES":
                s = await page.evaluate("() => [...document.querySelectorAll('.pframe')].filter(e => e.style.display !== 'none').map(e => ({ cls: e.className, label: e.lastChild.textContent }))")
                print("FRAMES " + json.dumps(s, ensure_ascii=False), flush=True)
            elif cmd == "ERRORS":
                print("ERRORS " + json.dumps(errors, ensure_ascii=False), flush=True)
        await browser.close()

asyncio.run(main())
