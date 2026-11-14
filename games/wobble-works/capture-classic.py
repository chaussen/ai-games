#!/usr/bin/env python3
"""Capture the CLASSIC 2D build running on a live server."""
import asyncio, os, sys, subprocess, time, json
from playwright.async_api import async_playwright

PORT = int(os.environ.get("PORT", "3470"))
BASE = "http://127.0.0.1:%d" % PORT
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "screenshots", "2d")

async def main():
    os.makedirs(OUT, exist_ok=True)
    srv = subprocess.Popen([sys.executable and "node", "server.js"],
                           cwd=os.path.dirname(os.path.abspath(__file__)),
                           env={**os.environ, "PORT": str(PORT)},
                           stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    await asyncio.sleep(1.2)
    errors = []
    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(executable_path="/usr/bin/chromium",
                                               args=["--use-gl=angle", "--use-angle=swiftshader", "--no-sandbox"])

            board = await browser.new_page(viewport={"width": 1600, "height": 900})
            board.on("console", lambda m: errors.append("board:" + m.text) if m.type == "error" else None)
            await board.goto(BASE + "/classic/?board=1")
            await asyncio.sleep(1.5)

            phones = []
            for name in ["Mum", "Sam"]:
                ctx = await browser.new_context(viewport={"width": 390, "height": 844},
                                                is_mobile=True, has_touch=True, device_scale_factor=2)
                pg = await ctx.new_page()
                pg.on("console", lambda m: errors.append("phone:" + m.text) if m.type == "error" else None)
                await pg.goto(BASE + "/classic/")
                await pg.fill("#name-input", name)
                await pg.click("#join-go")
                await asyncio.sleep(0.8)
                phones.append(pg)

            p1, p2 = phones
            await p1.keyboard.down("d")
            await asyncio.sleep(0.9)
            await p1.keyboard.press("Space")
            await asyncio.sleep(0.35)
            await p1.screenshot(path=os.path.join(OUT, "2d-02-phone-jump.png"))
            await board.screenshot(path=os.path.join(OUT, "2d-01-board-door.png"))
            await p1.keyboard.up("d")

            # chapter 2 - see-saw
            await board.locator(".tab").nth(1).click()
            await asyncio.sleep(1.6)
            await board.screenshot(path=os.path.join(OUT, "2d-03-seesaw.png"))

            # chapter 3 - gap / water / rope
            await board.locator(".tab").nth(2).click()
            await asyncio.sleep(1.6)
            await board.screenshot(path=os.path.join(OUT, "2d-04-gap.png"))

            # chapter 4
            await board.locator(".tab").nth(3).click()
            await asyncio.sleep(1.6)
            await board.screenshot(path=os.path.join(OUT, "2d-05-bell.png"))

            # sandbox with props
            await board.locator(".tab").nth(4).click()
            await asyncio.sleep(1.0)
            for tool in ["crate", "plank", "barrel"]:
                await board.click('[data-tool="%s"]' % tool)
                await asyncio.sleep(0.5)
            await asyncio.sleep(1.0)
            await board.screenshot(path=os.path.join(OUT, "2d-06-sandbox.png"))

            await p2.screenshot(path=os.path.join(OUT, "2d-07-phone-hud.png"))
            await browser.close()
    finally:
        srv.terminate()
        try:
            srv.wait(timeout=3)
        except Exception:
            srv.kill()

    print("console errors:", len(errors))
    for e in errors[:10]:
        print("  ", e)
    print("saved to", OUT)

asyncio.run(main())
