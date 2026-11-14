import asyncio, subprocess, time, os
from playwright.async_api import async_playwright

PORT = 3470
BASE = f"http://127.0.0.1:{PORT}"
DIR = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(DIR, "screenshots")
HIDE_TRUE = "() => { Object.defineProperty(document, 'hidden', { configurable: true, get() { return true; } }); document.dispatchEvent(new Event('visibilitychange')); }"
HIDE_FALSE = "() => { Object.defineProperty(document, 'hidden', { configurable: true, get() { return false; } }); document.dispatchEvent(new Event('visibilitychange')); }"

POSES = {
  "plaza":   {"pos": [11, 10, 15],   "look": [0, 2, 0]},
  "tower":   {"pos": [12, 15, -11],  "look": [26, 7, -26]},
  "bounce":  {"pos": [-11, 8, -9],   "look": [-25, 2.5, -25]},
  "fortress":{"pos": [-7, 13, 11],   "look": [-25, 7.5, 25]},
  "meadow":  {"pos": [7, 7, 24],     "look": [0, 2.6, 36]},
  "chasm":   {"pos": [25, 15, 9],    "look": [25, -1, 25]},
}

async def pose(page, name):
    await page.evaluate("(P) => { window.__camPose = P; }", POSES[name])
    await page.wait_for_timeout(1400)

async def main():
    os.makedirs(SHOTS, exist_ok=True)
    server = subprocess.Popen(["node", "server.js"], cwd=DIR, env={**os.environ, "PORT": str(PORT)},
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    await asyncio.sleep(1.1)
    driver = subprocess.Popen(["node", "puppet-driver.mjs", str(PORT)], cwd=DIR,
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    await asyncio.sleep(1.2)
    errors = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path="/usr/bin/chromium",
            args=["--no-sandbox", "--disable-setuid-sandbox", "--use-gl=angle", "--use-angle=swiftshader"])
        board = await browser.new_page(viewport={"width": 1600, "height": 900})
        board.on("pageerror", lambda e: errors.append("board: " + str(e)))
        board.on("console", lambda m: errors.append("console: " + m.text) if m.type == "error" else None)
        await board.goto(BASE + "/?board=1")
        await board.wait_for_timeout(2500)

        # let the 6 wobblers walk to their zones
        await board.wait_for_timeout(9000)
        joined = await board.evaluate("() => document.getElementById('b-players').textContent")
        print("players:", joined.strip())

        # 01 - whole world overview
        await board.click("#btn-toggle-cam")
        await board.wait_for_timeout(2600)
        await board.screenshot(path=os.path.join(SHOTS, "01-world-overview.png"))
        print("01 world-overview")
        await board.click("#btn-toggle-cam")

        # 02..06 - zone tour
        await pose(board, "plaza")
        await board.screenshot(path=os.path.join(SHOTS, "02-plaza.png")); print("02 plaza")
        await pose(board, "tower")
        await board.screenshot(path=os.path.join(SHOTS, "03-tower.png")); print("03 tower")
        await pose(board, "bounce")
        await board.screenshot(path=os.path.join(SHOTS, "04-bounce-canyon.png")); print("04 bounce-canyon")
        await pose(board, "fortress")
        await board.screenshot(path=os.path.join(SHOTS, "05-fortress.png")); print("05 fortress")
        await pose(board, "chasm")
        await board.screenshot(path=os.path.join(SHOTS, "06-seesaw-chasm.png")); print("06 seesaw-chasm")

        # 07 - goal action at the meadow, then the celebration
        await board.evaluate("() => { window.__camPose = null; }")
        await board.click("#btn-add-bot")
        for _ in range(4):
            await board.click("#btn-next-goal"); await board.wait_for_timeout(140)
        await pose(board, "meadow")
        await board.wait_for_timeout(3200)
        await board.screenshot(path=os.path.join(SHOTS, "07-goal-action.png")); print("07 goal-action")
        try:
            await board.wait_for_selector("#win-banner:not(.hidden)", state="visible", timeout=60000)
            await board.wait_for_timeout(350)
            await board.screenshot(path=os.path.join(SHOTS, "08-goal-celebration.png"))
            crown = await board.evaluate("() => document.getElementById('b-crown').textContent")
            print("08 goal-celebration |", crown.strip())
        except Exception as e:
            print("celebration missed:", str(e)[:90])

        # 09/10 - phone
        phone = await browser.new_page(viewport={"width": 390, "height": 844},
                                       device_scale_factor=2, is_mobile=True, has_touch=True)
        phone.on("pageerror", lambda e: errors.append("phone: " + str(e)))
        await phone.goto(BASE + "/")
        await phone.wait_for_timeout(900)
        await phone.fill("#gate-name", "Mia")
        await phone.click("#gate-go")
        await phone.wait_for_timeout(1400)
        await phone.keyboard.down("KeyW"); await phone.wait_for_timeout(1200); await phone.keyboard.up("KeyW")
        await phone.wait_for_timeout(400)
        await phone.screenshot(path=os.path.join(SHOTS, "09-phone-follow-cam.png")); print("09 phone-follow-cam")
        await phone.evaluate(HIDE_TRUE)
        await phone.wait_for_timeout(700)
        await phone.screenshot(path=os.path.join(SHOTS, "10-phone-afk.png")); print("10 phone-afk")
        await phone.evaluate(HIDE_FALSE)
        await phone.click("#btn-wake")
        await phone.wait_for_timeout(400)
        print("wake:", await phone.evaluate("() => document.getElementById('sleep-overlay').classList.contains('hidden')"))

        await browser.close()

    driver.terminate(); server.terminate()
    print("errors:", errors if errors else "NONE")
    print("DONE")

asyncio.run(main())