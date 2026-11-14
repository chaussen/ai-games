const { chromium } = require('playwright');
const { spawn } = require('child_process');

async function run() {
  const PORT = 3456;
  const server = spawn('node', ['../server.js', '--mode=3d'], { cwd: __dirname, env: { ...process.env, PORT: String(PORT) } });
  await new Promise(r => setTimeout(r, 1000));

  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  
  // 1. Board / Spectator View
  const pageBoard = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const boardErrors = [];
  pageBoard.on('pageerror', e => boardErrors.push(e.message));
  await pageBoard.goto('http://127.0.0.1:' + PORT + '/?board=1');
  await pageBoard.waitForTimeout(1500);
  await pageBoard.screenshot({ path: 'screenshots/board-3d-overview.png' });
  console.log('Board 3D screenshot saved. Errors:', boardErrors.length);

  // 2. Controller View (Mobile Portrait)
  const pageMobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const mobileErrors = [];
  pageMobile.on('pageerror', e => mobileErrors.push(e.message));
  await pageMobile.goto('http://127.0.0.1:' + PORT + '/');
  await pageMobile.waitForTimeout(1000);
  
  // Enter name in join gate
  await pageMobile.fill('#gate-name', '🐸 Alex');
  await pageMobile.click('#gate-go');
  await pageMobile.waitForTimeout(1500);
  await pageMobile.screenshot({ path: 'screenshots/phone-3d-controller.png' });
  console.log('Mobile 3D screenshot saved. Errors:', mobileErrors.length);

  await browser.close();
  server.kill();
  console.log('Browser test finished successfully!');
}

run().catch(err => { console.error(err); process.exit(1); });