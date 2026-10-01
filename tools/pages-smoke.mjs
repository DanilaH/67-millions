import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import assert from 'node:assert/strict';
import { balance } from '../src/config/balance.ts';
import { createInitialGameState } from '../src/core/state/GameState.ts';
import { createSaveState } from '../src/core/save/SaveState.ts';
import { startWork } from '../src/core/work/work.ts';
import { createDishesSession } from '../src/minigames/dishes/dishesModel.ts';
import { createTrashSession } from '../src/minigames/trash/trashModel.ts';
import { commitBareDrop } from '../src/core/plinko-rules/drop.ts';

// The same smoke can target the real Pages URL. No SDK or network stubs.
const output = process.env.SMOKE_OUTPUT ?? 'artifacts/pages-smoke';
mkdirSync(output, { recursive: true });
const root = resolve('dist');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.avif': 'image/avif', '.png': 'image/png' };
let server;
let url = process.env.SMOKE_URL;
if (!url) {
  server = createServer((request, response) => {
    const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (!path.startsWith('/67-millions/')) { response.writeHead(404).end(); return; }
    const file = resolve(root, path.slice('/67-millions/'.length) || 'index.html');
    if (!file.startsWith(`${root}/`)) { response.writeHead(404).end(); return; }
    try { response.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream' }).end(readFileSync(file)); }
    catch { response.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${server.address().port}/67-millions/`;
}
let browser;
const errors = [];
const failures = [];
const serviceRequests = [];
try {
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}), args: ['--disable-dev-shm-usage'] });
  for (const touch of [false, true]) {
    const context = await browser.newContext({ viewport: touch ? { width: 640, height: 360 } : { width: 1280, height: 720 }, hasTouch: touch });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`); });
    page.on('requestfailed', request => failures.push(`${request.url()} ${request.failure()?.errorText}`));
    page.on('request', request => { if (/yandex|yagames|mc\.yandex/.test(new URL(request.url()).hostname)) serviceRequests.push(request.url()); });
    const ready = async () => {
      await page.waitForFunction(() => document.querySelector('#startup-preload')?.dataset.state === 'hidden', null, { timeout: 30000 });
      assert.equal(await page.locator('canvas').count(), 1);
      assert.equal(await page.locator('#debug-root').getAttribute('hidden'), '');
      assert.equal(await page.evaluate(() => typeof window.__PLINKO_PERF__), 'undefined');
    };
    await page.goto(url, { waitUntil: 'networkidle' });
    await ready();
    await page.waitForFunction(() => localStorage.getItem('67m.save') !== null);
    const initial = await page.evaluate(() => JSON.parse(localStorage.getItem('67m.save')));
    assert.equal(initial.version, 14);
    await page.screenshot({ path: `${output}/${touch ? 'touch' : 'mouse'}-fresh.png` });
    await page.reload({ waitUntil: 'networkidle' });
    await ready();
    assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('67m.save')))).game.rngState, initial.game.rngState);
    const cdp = await context.newCDPSession(page);
    let rect, point, touching = false;
    const move = async (x, y, options) => {
      point = { x: rect.x + x * rect.width / 1280, y: rect.y + y * rect.height / 720 };
      if (touch) { if (touching) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point] }); }
      else await page.mouse.move(point.x, point.y, options);
    };
    const down = async () => { if (touch) { touching = true; await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] }); } else await page.mouse.down(); };
    const up = async () => { if (touch) { touching = false; await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); } else await page.mouse.up(); };
    const loadSave = async save => {
      await page.evaluate(save => localStorage.setItem('67m.save', JSON.stringify(save)), save);
      await page.reload({ waitUntil: 'networkidle' }); await ready();
      await page.waitForTimeout(300);
      rect = await page.locator('canvas').boundingBox(); assert.ok(rect);
    };
    const fixture = createSaveState(createInitialGameState(balance, 67067000));
    for (const [job, minute] of [['dishes', 1080], ['trash', 60], ['courier', 600]]) {
      const work = structuredClone(fixture); work.game.clock.minuteOfDay = minute;
      const reserved = startWork(work.game, balance, job, 1); work.game = reserved.state; work.activeAction = reserved.action;
      await loadSave(work);
      if (job === 'dishes') {
        const spots = createDishesSession(balance).spots;
        await move(spots[0].x, spots[0].y); await down();
        for (const spot of spots) { await move(spot.x, spot.y); await page.waitForTimeout(17); }
        await up();
      } else if (job === 'trash') {
        const session = createTrashSession(balance);
        for (const bag of session.bags) { await move(bag.x, bag.y); await down(); await move(session.target.x + 150, session.target.y + 150, { steps: 6 }); await up(); await page.waitForTimeout(30); }
      } else {
        await move(180, 365); await down();
        for (const point of [[180, 600], [1100, 600], [1100, 365]]) { await move(...point, { steps: 8 }); await page.waitForTimeout(25); }
        await up(); await move(1180, 670); await down(); await up();
      }
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('67m.save')).activeAction === null, null, { timeout: 12000 });
      assert.ok((await page.evaluate(() => JSON.parse(localStorage.getItem('67m.save')))).game.cash > work.game.cash, `${job}: real input credits payout`);
    }
    const committed = commitBareDrop(fixture.game, null, balance, 'pages-restore', 1);
    await loadSave({ ...fixture, game: committed.state, pendingDrop: committed.pendingDrop });
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('67m.save')).pendingDrop?.physics?.fixedTicksElapsed >= 15, null, { timeout: 12000 });
    const checkpoint = await page.evaluate(() => JSON.parse(localStorage.getItem('67m.save')));
    assert.ok(checkpoint.pendingDrop.physics.solver);
    await page.screenshot({ path: `${output}/${touch ? 'touch' : 'mouse'}-plinko.png` });
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('67m.save')).pendingDrop === null, null, { timeout: 20000 });
    const uninterrupted = await page.evaluate(() => JSON.parse(localStorage.getItem('67m.save')));
    await loadSave(checkpoint);
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('67m.save')).pendingDrop === null, null, { timeout: 20000 });
    const restored = await page.evaluate(() => JSON.parse(localStorage.getItem('67m.save')));
    assert.equal(restored.game.cash, uninterrupted.game.cash);
    assert.equal(restored.game.rngState, uninterrupted.game.rngState);
    await page.reload({ waitUntil: 'networkidle' }); await ready();
    assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('67m.save')))).game.cash, restored.game.cash);
    const terminal = structuredClone(fixture); terminal.game.terminalReason = 'HEALTH_ZERO'; terminal.game.needs.health = 0;
    await loadSave(terminal); await move(640, 606); await down(); await up();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('67m.save')).game.terminalReason === null);
    const viewport = page.viewportSize();
    await page.setViewportSize({ width: 360, height: 640 });
    await page.waitForFunction(() => document.querySelector('#rotate-gate').getAttribute('aria-hidden') === 'false');
    await page.setViewportSize(viewport);
    await page.waitForFunction(() => document.querySelector('#rotate-gate').getAttribute('aria-hidden') === 'true');
    assert.equal(await page.locator('canvas').evaluate(canvas => canvas.width), 1280);
    await context.close();
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(failures, []);
  assert.deepEqual(serviceRequests, []);
  const result = { status: 'passed', url, platform: 'mock/localStorage; no SDK stubs', inputs: ['mouse 1280x720', 'CDP touch 640x360'], checks: ['fresh startup and reload', 'subpath assets without failed requests', 'debug/perf disabled', 'three jobs and payouts', 'cold/mid-Drop exact payout and RNG restore', 'no duplicate settled payout', 'restart without ads', 'portrait blocker and logical canvas'], errors, failures, serviceRequests };
  writeFileSync(`${output}/result.json`, JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
}
