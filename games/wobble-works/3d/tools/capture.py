"""Screenshots of a running build: real server, real browser, wobblers driven over
the real protocol by tools/puppets.mjs. Nothing is mocked or drawn by hand.
Usage: python3 tools/capture.py      (needs playwright for Python and /usr/bin/chromium)"""
import asyncio, os, subprocess
from playwright.async_api import async_playwright

PORT = 3472
BASE = f"http://127.0.0.1:{PORT}"
DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.path.join(DIR, "screenshots")
ARGS = ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]

async def main():
    os.makedirs(SHOTS, exist_ok=True)
    server = subprocess.Popen(["node", "../server.js", "--mode=3d"], cwd=DIR, env={**os.environ, "PORT": str(PORT)},
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    await asyncio.sleep(1.0)
    errors = []
    puppets = None
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(executable_path="/usr/bin/chromium", args=ARGS)
            def watch(page, who):
                page.on("pageerror", lambda e: errors.append(f"{who}: {e}"))
                page.on("console", lambda m: errors.append(f"{who} console: {m.text}") if m.type == "error" else None)
                return page
            board = watch(await browser.new_page(viewport={"width": 1600, "height": 900}), "board")
            await board.goto(BASE + "/?board=1")
            phone = dict(device_scale_factor=2, has_touch=True, is_mobile=True)
            land = watch(await (await browser.new_context(viewport={"width": 844, "height": 390}, **phone)).new_page(), "landscape")
            port = watch(await (await browser.new_context(viewport={"width": 390, "height": 844}, **phone)).new_page(), "portrait")
            gate = watch(await (await browser.new_context(viewport={"width": 390, "height": 844}, **phone)).new_page(), "gate")
            await gate.goto(BASE + "/")
            await gate.wait_for_timeout(1500)
            await gate.screenshot(path=os.path.join(SHOTS, "00-join.png"))
            print("00-join")
            await gate.close()
            await land.goto(BASE + "/?spectate=p-shot-mia")
            await port.goto(BASE + "/?spectate=p-shot-mia")
            await board.wait_for_timeout(800)

            puppets = await asyncio.create_subprocess_exec("node", "tools/puppets.mjs", str(PORT), cwd=DIR,
                                                           stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT)
            while True:
                line = (await puppets.stdout.readline()).decode().strip()
                if not line:
                    break
                if line.startswith("SHOT "):
                    parts = line.split()
                    name = parts[1]
                    await board.wait_for_timeout(350)
                    await board.screenshot(path=os.path.join(SHOTS, name + ".png"))
                    if "L" in parts[2:]:
                        await land.screenshot(path=os.path.join(SHOTS, name + "-phone.png"))
                    if "P" in parts[2:]:
                        await port.screenshot(path=os.path.join(SHOTS, name + "-phone.png"))
                    print(name)
                    puppets.stdin.write(b"ok\n")
                    await puppets.stdin.drain()
                elif line != "DONE":
                    print("puppets:", line)
            await browser.close()
    finally:
        if puppets and puppets.returncode is None:
            puppets.kill()
        server.kill()
    print("page errors:", errors if errors else "none")

asyncio.run(main())
