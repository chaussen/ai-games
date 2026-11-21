// A small Chrome DevTools Protocol client (session 4 of docs/AUTOTEST.md), zero-install: Node's own
// WebSocket and fetch. The same calls drive headless Chromium on the laptop and Chrome on an Android phone
// over adb, so the page test (page-mind.mjs) is one piece of code for both.
//
//   const b = await headless({ width: 844, height: 390, dpr: 2 });   // laptop: /usr/bin/chromium
//   const b = await android(3491);                                    // phone: adb reverse + forward
//   const page = await b.open(url, initScript);  await page.eval('1 + 1');  await b.close();
import { spawn, execFileSync } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

export class Session {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.wait = new Map(); this.handlers = new Map();
    ws.addEventListener('message', (m) => {
      const d = JSON.parse(typeof m.data === 'string' ? m.data : Buffer.from(m.data).toString());
      if (d.id && this.wait.has(d.id)) {
        const { ok, no } = this.wait.get(d.id); this.wait.delete(d.id);
        d.error ? no(new Error(d.error.message + ' ' + (d.error.data || ''))) : ok(d.result);
      } else if (d.method) for (const f of this.handlers.get(d.method) || []) f(d.params);
    });
  }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((ok, no) => { ws.addEventListener('open', ok, { once: true }); ws.addEventListener('error', no, { once: true }); });
    return new Session(ws);
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((ok, no) => { this.wait.set(id, { ok, no }); this.ws.send(JSON.stringify({ id, method, params })); });
  }
  on(method, f) { if (!this.handlers.has(method)) this.handlers.set(method, []); this.handlers.get(method).push(f); }
  // evaluate an expression in the page; awaits promises; returns the value (JSON) or throws the page's error
  async eval(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('page: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    return r.result.value;
  }
  // touch points: [{ id, x, y }] in CSS px, the full set of fingers on the glass after this event
  touch(type, points) {
    return this.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p) => ({ x: p.x, y: p.y, id: p.id, radiusX: 6, radiusY: 6, force: 1 })) });
  }
  async shot(path) {
    const { data } = await this.send('Page.captureScreenshot', { format: 'png' });
    const fs = await import('fs'); fs.writeFileSync(path, Buffer.from(data, 'base64'));
  }
  close() { try { this.ws.close(); } catch (_) {} }
}

// Chrome on Android answers "Could not create new page" to /json/new; the browser target's
// Target.createTarget still works there, so fall back to it and find the tab in /json/list
async function newTab(base) {
  const r = await fetch(base + '/json/new?about:blank', { method: 'PUT' });
  const text = await r.text();
  try { return JSON.parse(text); } catch (_) {}
  const v = await (await fetch(base + '/json/version')).json();
  const b = await Session.connect(v.webSocketDebuggerUrl.replace(/ws:\/\/[^/]+/, base.replace('http', 'ws')));
  const { targetId } = await b.send('Target.createTarget', { url: 'about:blank' });
  b.close();
  for (let i = 0; i < 50; i++) {
    const t = (await (await fetch(base + '/json/list')).json()).find((x) => x.id === targetId);
    if (t) return t;
    await new Promise((ok) => setTimeout(ok, 100));
  }
  throw new Error('new tab ' + targetId + ' not listed');
}

async function openTarget(base, url, init, setup) {
  // a blank tab first, so the init script is in place before the game's first line runs
  const t = await newTab(base);
  const s = await Session.connect(t.webSocketDebuggerUrl);
  s.targetId = t.id;
  await s.send('Page.enable'); await s.send('Runtime.enable');
  if (setup) await setup(s);
  if (init) await s.send('Page.addScriptToEvaluateOnNewDocument', { source: init });
  const loaded = new Promise((ok) => s.on('Page.loadEventFired', ok));
  await s.send('Page.navigate', { url });
  await loaded;
  return s;
}

export async function headless({ width = 844, height = 390, dpr = 2, bin = '/usr/bin/chromium' } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'tzf2d-cdp-'));
  const proc = spawn(bin, ['--headless=new', '--no-sandbox', '--remote-debugging-port=0', '--user-data-dir=' + dir,
    '--no-first-run', '--mute-audio', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', 'about:blank'],
  { stdio: ['ignore', 'ignore', 'pipe'] });
  const port = await new Promise((ok, no) => {
    let buf = '';
    proc.stderr.on('data', (d) => { buf += d; const m = buf.match(/DevTools listening on ws:\/\/[^:]+:(\d+)\//); if (m) ok(+m[1]); });
    proc.on('exit', () => no(new Error('chromium exited: ' + buf.slice(-400))));
  });
  const base = 'http://127.0.0.1:' + port;
  return {
    kind: 'headless', base,
    open: (url, init) => openTarget(base, url, init, async (s) => {
      await s.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile: true });
      await s.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    }),
    async close() { proc.kill('SIGKILL'); await new Promise((r) => setTimeout(r, 200)); try { rmSync(dir, { recursive: true, force: true }); } catch (_) {} },
  };
}

// Chrome on an Android phone (USB debugging on, Chrome running): the phone reaches the laptop's server at
// its own localhost:<port> (adb reverse), and the test reaches Chrome's DevTools at localhost:<cdpPort>.
export const adb = (...a) => execFileSync('adb', a, { encoding: 'utf8' }).trim();
export async function android(port, { cdpPort = 9222 } = {}) {
  adb('reverse', 'tcp:' + port, 'tcp:' + port);
  adb('forward', 'tcp:' + cdpPort, 'localabstract:chrome_devtools_remote');
  const base = 'http://127.0.0.1:' + cdpPort;
  const ver = await (await fetch(base + '/json/version')).json();
  const opened = [];
  return {
    kind: 'android', base, version: ver,
    model: adb('shell', 'getprop', 'ro.product.model'),
    // A fresh tab for every page, opened in front by an Android intent (like a person tapping a link), then
    // reloaded with the init script in place, and closed afterwards. Reusing one tab across isles went wrong
    // at random: the page showed, but no touch reached its document, not even a real tap on the glass (S4,
    // finding T9). A tab made with Target.createTarget opens in the background, where Chrome neither draws nor
    // delivers touches, and /json/new is refused on Android.
    async open(url, init) {
      const ids = new Set((await (await fetch(base + '/json/list')).json()).map((t) => t.id));
      const mark = url + (url.includes('?') ? '&' : '?') + 'tab=' + Date.now();
      adb('shell', `am start -a android.intent.action.VIEW -d '${mark}' com.android.chrome`);   // quoted: the phone's shell reads &
      let mine = null;
      for (let i = 0; i < 40 && !mine; i++) {
        await new Promise((ok) => setTimeout(ok, 250));
        mine = (await (await fetch(base + '/json/list')).json()).find((t) => t.type === 'page' && !ids.has(t.id) && t.url === mark);
      }
      if (!mine) throw new Error('the new tab did not show up in Chrome on the phone');
      const s = await Session.connect(mine.webSocketDebuggerUrl);
      s.targetId = mine.id; opened.push(s);
      await s.send('Page.enable'); await s.send('Runtime.enable');
      if (init) await s.send('Page.addScriptToEvaluateOnNewDocument', { source: init });
      const loaded = new Promise((ok) => s.on('Page.loadEventFired', ok));
      await s.send('Page.reload', { ignoreCache: false });
      await loaded;
      s.close = ((c) => () => { c(); fetch(base + '/json/close/' + mine.id).catch(() => {}); })(s.close.bind(s));
      return s;
    },
    async close() {
      for (const s of opened) { try { await fetch(base + '/json/close/' + s.targetId); } catch (_) {} s.close(); }
      try { adb('forward', '--remove', 'tcp:' + cdpPort); } catch (_) {}
      try { adb('reverse', '--remove', 'tcp:' + port); } catch (_) {}
    },
  };
}
