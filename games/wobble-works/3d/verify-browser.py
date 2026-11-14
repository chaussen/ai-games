import asyncio
import subprocess
import time
from playwright.async_api import async_playwright

async def main():
    port = 3457
    server = subprocess.Popen(["node", "../server.js", "--mode=3d"], cwd="games/wobble-works/3d", env={"PORT": str(port), "PATH": "/usr/bin:/bin"})
    time.sleep(1.2)
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path="/usr/bin/chromium", args=["--no-sandbox", "--disable-setuid-sandbox", "--use-gl=angle", "--use-angle=swiftshader"])
        
        # 1. Board View
        page_board = await browser.new_page(viewport={"width": 1280, "height": 720})
        board_errors = []
        page_board.on("pageerror", lambda e: board_errors.append(str(e)))
        await page_board.goto(f"http://127.0.0.1:{port}/?board=1")
        await page_board.wait_for_timeout(2000)
        await page_board.screenshot(path="wobble-works/screenshots/board-3d-overview.png")
        print(f"Board 3D screenshot saved. Errors: {len(board_errors)}")
        if board_errors:
            print("Board errors:", board_errors)
            
        # 2. Phone View
        page_phone = await browser.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
        phone_errors = []
        page_phone.on("pageerror", lambda e: phone_errors.append(str(e)))
        await page_phone.goto(f"http://127.0.0.1:{port}/")
        await page_phone.wait_for_timeout(1000)
        
        # Click join
        await page_phone.click("#gate-go")
        await page_phone.wait_for_timeout(2000)
        await page_phone.screenshot(path="wobble-works/screenshots/phone-3d-controller.png")
        print(f"Phone 3D screenshot saved. Errors: {len(phone_errors)}")
        if phone_errors:
            print("Phone errors:", phone_errors)
            
        await browser.close()
        
    server.terminate()
    print("Browser verification completed!")

asyncio.run(main())