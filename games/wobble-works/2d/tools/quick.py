import subprocess, time, os, json, sys
PORT=3461
env=dict(os.environ); env['PORT']=str(PORT)
proc=subprocess.Popen(['node','server.js'],cwd=os.getcwd(),env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
time.sleep(0.9)
from playwright.sync_api import sync_playwright
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
    pg=b.new_context(viewport={'width':1440,'height':900}).new_page()
    pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
    pg.goto('http://127.0.0.1:'+str(PORT)+'/?board=1',wait_until='networkidle')
    for _ in range(3): pg.click('#btn-bot')
    pg.click('#btn-start'); pg.wait_for_timeout(2400)
    pg.screenshot(path='screenshots/02-board-midround.png')
    print('players',pg.locator('#b-players').inner_text(),'push',pg.locator('#b-push').inner_text())
    b.close()
print('ERRORS',json.dumps(errs))
proc.terminate()
