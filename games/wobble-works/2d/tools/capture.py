import subprocess, time, os, sys, json
os.makedirs('screenshots', exist_ok=True)
PORT = 3460
env = dict(os.environ); env['PORT'] = str(PORT)
proc = subprocess.Popen(['node', 'server.js'], cwd=os.getcwd(), env=env,
                        stdout=subprocess.PIPE, stderr=subprocess.PIPE)
time.sleep(1.0)
from playwright.sync_api import sync_playwright
errors, failed = [], []
def watch(page, tag):
    page.on('console', lambda m: errors.append(tag+' CONSOLE '+m.text) if m.type=='error' else None)
    page.on('pageerror', lambda e: errors.append(tag+' PAGEERROR '+str(e)))
    page.on('response', lambda r: failed.append(tag+' '+str(r.status)+' '+r.url) if r.status>=400 else None)
BASE='http://127.0.0.1:'+str(PORT)
with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox','--disable-dev-shm-usage'])
    ctx = br.new_context(viewport={'width':1440,'height':900}, device_scale_factor=1)
    pg = ctx.new_page(); watch(pg, 'BOARD')
    pg.goto(BASE+'/?board=1', wait_until='networkidle'); pg.wait_for_timeout(900)
    pg.screenshot(path='screenshots/01-board-lobby.png')

    # mid-round: 3 demo wobblers + start
    for _ in range(3): pg.click('#btn-bot')
    pg.click('#btn-start'); pg.wait_for_timeout(2600)
    print('MID players:', pg.locator('#b-players').inner_text(), 'push:', pg.locator('#b-push').inner_text())
    pg.screenshot(path='screenshots/02-board-midround.png')

    # phone joins the same room and pings
    mctx = br.new_context(viewport={'width':390,'height':844}, device_scale_factor=1, is_mobile=True, has_touch=True)
    mctx.add_init_script("localStorage.setItem('ww-name','Mia'); localStorage.setItem('ww-emoji','🦊');")
    mp = mctx.new_page(); watch(mp, 'PHONE')
    mp.goto(BASE+'/', wait_until='networkidle'); mp.wait_for_timeout(900)
    mp.screenshot(path='screenshots/03-phone-controller.png')
    mp.locator('.call[data-call="💪 PUSH"]').click()
    mp.wait_for_timeout(350)
    pg.screenshot(path='screenshots/04-board-with-ping.png')
    mp.click('#btn-cwide'); mp.wait_for_timeout(700)
    mp.screenshot(path='screenshots/05-phone-wide.png')

    # join gate on a fresh device
    gctx = br.new_context(viewport={'width':390,'height':844}, device_scale_factor=1, is_mobile=True, has_touch=True)
    gp = gctx.new_page(); watch(gp, 'GATE')
    gp.goto(BASE+'/', wait_until='networkidle'); gp.wait_for_timeout(500)
    gp.screenshot(path='screenshots/06-phone-join.png')

    # chapter 3: the semi-open level with many routes
    pg.locator('.tab[data-id="3"]').click(); pg.wait_for_timeout(1100)
    pg.screenshot(path='screenshots/07-board-the-gap.png')
    print('CH3 objective:', pg.locator('#b-objective').inner_text()[:90])

    # chapter 4: open island
    pg.locator('.tab[data-id="4"]').click(); pg.wait_for_timeout(1000)
    pg.screenshot(path='screenshots/08-board-bell-island.png')

    # win: chapter 1 with 4 bots
    pg.locator('.tab[data-id="1"]').click(); pg.wait_for_timeout(400)
    for _ in range(1): pg.click('#btn-bot')
    pg.click('#btn-start')
    try:
        pg.wait_for_selector('#win-overlay:not(.hidden)', timeout=26000)
        print('WIN title:', pg.locator('#win-title').inner_text())
        pg.screenshot(path='screenshots/09-board-win-medal.png')
        pg.click('#btn-scrap'); pg.wait_for_timeout(400)
        pg.screenshot(path='screenshots/10-family-scrapbook.png')
    except Exception as e:
        print('WIN NOT REACHED:', str(e)[:120])

    # wireframe spec
    wpg = br.new_context(viewport={'width':1440,'height':1000}, device_scale_factor=1).new_page()
    watch(wpg, 'WIREFRAME')
    wpg.goto(BASE+'/wireframe.html', wait_until='networkidle'); wpg.wait_for_timeout(500)
    wpg.screenshot(path='screenshots/11-wireframe-top.png')
    wpg.screenshot(path='screenshots/12-wireframe-full.png', full_page=True)
    print('WIREFRAME sections:', wpg.locator('section').count(), 'svg maps:', wpg.locator('.map svg').count())
    br.close()
print('ERRORS:', json.dumps(errors, ensure_ascii=False))
print('FAILED:', json.dumps(failed, ensure_ascii=False))
proc.terminate()
try: proc.wait(timeout=3)
except: proc.kill()
print('SERVER STDERR:', proc.stderr.read().decode()[:400])
