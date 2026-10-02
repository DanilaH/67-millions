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
let publishedVersion = null;
try {
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}), args: ['--disable-dev-shm-usage'] });
  if (process.env.SMOKE_URL) {
    const request = await browser.newContext();
    try {
      const response = await request.request.get(new URL('preview-version.json', url).href);
      assert.equal(response.status(), 200, 'published revision manifest available');
      publishedVersion = await response.json();
      if (process.env.SMOKE_EXPECTED_SHA) assert.equal(publishedVersion.sha, process.env.SMOKE_EXPECTED_SHA, 'live site matches deployed revision');
    } finally { await request.close(); }
  }
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
    const sceneReady = async label => page.waitForFunction(label => document.querySelector('canvas')?.getAttribute('aria-label') === label, label);
    const jobLabels = { dishes: 'Мойка посуды', trash: 'Вынос мусора', courier: 'Курьерский маршрут' };
    const click = async (x, y) => { await move(x, y); await down(); await up(); };
    const fixture = createSaveState(createInitialGameState(balance, 67067000));
    // A failed action checkpoint stays pending: retry bytes, never the command.
    await loadSave(fixture);
    await click(675, 470); await sceneReady('ПОМОЙКА');
    await page.evaluate(() => {
      const original = Storage.prototype.setItem;
      let remainingFailures = 2;
      Storage.prototype.setItem = function(key, value) {
        if (key === '67m.save' && JSON.parse(value).activeAction?.kind === 'DUMPSTER' && remainingFailures-- > 0) {
          throw new DOMException('Injected write failure', 'QuotaExceededError');
        }
        return original.call(this, key, value);
      };
    });
    await click(515, 225);
    const recovery = page.locator('#save-recovery');
    await recovery.waitFor({ state: 'visible' });
    const beforeRetry = await page.evaluate(() => localStorage.getItem('67m.save'));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1200);
    assert.equal(await recovery.isVisible(), true, 'Escape cannot dismiss save failure');
    assert.equal(await page.evaluate(() => localStorage.getItem('67m.save')), beforeRetry, 'failed write pauses game and keeps durable save');
    await page.screenshot({ path: `${output}/${touch ? 'touch' : 'mouse'}-save-recovery.png` });
    await recovery.getByRole('button').click();
    await page.waitForFunction(() => document.querySelector('#save-recovery button')?.textContent === 'Повторить сохранение');
    assert.equal(await recovery.isVisible(), true, 'second failure remains recoverable');
    await recovery.getByRole('button').click();
    await recovery.waitFor({ state: 'hidden' });
    const reservedSearch = await page.evaluate(() => JSON.parse(localStorage.getItem('67m.save')));
    assert.equal(reservedSearch.activeAction.kind, 'DUMPSTER');
    assert.equal(reservedSearch.game.needs.energy, fixture.game.needs.energy - balance.dumpster.energyCost, 'retry charges search once');
    await page.reload({ waitUntil: 'networkidle' }); await ready();
    await sceneReady('Поиск в помойке');
    const resumedSearch = await page.evaluate(() => JSON.parse(localStorage.getItem('67m.save')));
    assert.deepEqual(resumedSearch, reservedSearch, 'reload resumes reserved search without charge or reroll');
    await page.screenshot({ path: `${output}/${touch ? 'touch' : 'mouse'}-rummage.png` });
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('67m.save')).activeAction === null, null, { timeout: 10000 });
    const searched = await page.evaluate(() => JSON.parse(localStorage.getItem('67m.save')));
    assert.equal(searched.game.clock.minuteOfDay, reservedSearch.game.clock.minuteOfDay + balance.dumpster.durationMinutes, 'rummage adds only normative 45 minutes');
    assert.equal(searched.game.dumpsterSearchStreak, 1, 'search settled once');
    for (const [job, minute] of [['dishes', 960], ['trash', 60], ['courier', 545]]) {
      const work = structuredClone(fixture); work.game.clock.minuteOfDay = minute;
      const reserved = startWork(work.game, balance, job, 1); work.game = reserved.state; work.activeAction = reserved.action;
      await loadSave(work);
      await sceneReady(jobLabels[job]);
      const playJob = async () => {
      // Screenshot readback on a software GPU can consume seconds of a 20s
      // skill timer. Keep timed input uninterrupted; capture untimed scenes.
      if (job === 'courier') await page.screenshot({ path: `${output}/${touch ? 'touch' : 'mouse'}-${job}-start.png` });
      if (job === 'dishes') {
        for (const plate of createDishesSession(balance).plates) {
          await move(plate.x - 65, plate.y - 45); await down();
          for (const [row, offset] of [-45, 0, 45].entries()) {
            await move(plate.x + (row % 2 === 0 ? 65 : -65), plate.y + offset, { steps: 6 });
            await page.waitForTimeout(25);
          }
          await up();
        }
      } else if (job === 'trash') {
        const session = createTrashSession(balance);
        for (const bag of session.bags) { await move(bag.x, bag.y); await down(); await move(session.target.x + 150, session.target.y + 150, { steps: 6 }); await up(); await page.waitForTimeout(30); }
      } else {
        await move(180, 365); await down();
        for (const point of [[180, 600], [1100, 600], [1100, 365]]) { await move(...point, { steps: 8 }); await page.waitForTimeout(25); }
        await up(); await move(1180, 670); await down(); await up();
        await page.waitForTimeout(600);
        assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('67m.save')))).activeAction?.result, null, 'courier still travelling, no instant result');
        await page.screenshot({ path: `${output}/${touch ? 'touch' : 'mouse'}-courier-moving.png` });
      }
      try { await page.waitForFunction(() => JSON.parse(localStorage.getItem('67m.save')).activeAction === null, null, { timeout: 12000 }); } catch (error) {
        await page.screenshot({ path: `${output}/failed-${job}.png` });
        console.error(job, await page.evaluate(() => JSON.parse(localStorage.getItem('67m.save'))), errors); throw error;
      }
      };
      await playJob();
      const first = await page.evaluate(() => JSON.parse(localStorage.getItem('67m.save')));
      assert.ok(first.game.cash > work.game.cash, `${job}: real input credits payout`);
      assert.equal(first.game.pendingEventId, null, `${job}: fixture leaves a safe point for repeat-entry test`);
      await sceneReady('Карта города');
      // Re-enter the same Scene instance through the map, without a page reload.
      await click(430, 220); await sceneReady('РАБОТА');
      await page.screenshot({ path: `${output}/${touch ? 'touch' : 'mouse'}-work-panel.png` });
      await click(job === 'trash' ? 985 : 515, job === 'courier' ? 307 : 225);
      await page.waitForFunction(job => JSON.parse(localStorage.getItem('67m.save')).activeAction?.actionId === job, job);
      await sceneReady(jobLabels[job]);
      await playJob();
      const second = await page.evaluate(() => JSON.parse(localStorage.getItem('67m.save')));
      assert.ok(second.game.cash > first.game.cash, `${job}: second shift in same scene pays out (${first.game.cash} → ${second.game.cash}; ${JSON.stringify(second.game.clock)})`);
    }
    // Real map → casino → map transitions, including the same casino instance.
    await loadSave(fixture);
    for (let cycle = 0; cycle < 3; cycle++) {
      await click(1080, 325); await sceneReady('Казино Plinko');
      await click(1100, 660); await sceneReady('Карта города');
    }
    // A working map after exit must be able to launch a real action.
    await click(430, 220); await sceneReady('РАБОТА'); await click(515, 307);
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('67m.save')).activeAction?.actionId === 'courier');
    await loadSave(fixture); await click(1080, 325);
    const idleMinute = (await page.evaluate(() => JSON.parse(localStorage.getItem('67m.save')))).game.clock.minuteOfDay;
    await page.waitForFunction(minute => JSON.parse(localStorage.getItem('67m.save')).game.clock.minuteOfDay > minute, idleMinute, { timeout: 6000 });
    await page.screenshot({ path: `${output}/${touch ? 'touch' : 'mouse'}-casino-idle.png` });
    const committed = commitBareDrop(fixture.game, null, balance, 'pages-restore', 1);
    await loadSave({ ...fixture, game: committed.state, pendingDrop: committed.pendingDrop });
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('67m.save')).pendingDrop?.physics?.fixedTicksElapsed >= 15, null, { timeout: 12000 });
    await click(1100, 660); await page.waitForTimeout(100);
    await page.screenshot({ path: `${output}/${touch ? 'touch' : 'mouse'}-pending-map.png` });
    await click(150, 637); await page.waitForTimeout(100);
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
    assert.deepEqual(restored.game.clock, uninterrupted.game.clock, 'passive cascade clock restores without charging an extra minute');
    await page.reload({ waitUntil: 'networkidle' }); await ready();
    assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('67m.save')))).game.cash, restored.game.cash);
    const due = structuredClone(fixture); due.game.clock.minuteOfDay = 539;
    await loadSave(due); await click(1080, 325);
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('67m.save')).game.barryInterruptPending, null, { timeout: 6000 });
    await sceneReady('Карта города');
    const frozen = await page.evaluate(() => JSON.parse(localStorage.getItem('67m.save')));
    await click(430, 220); await page.waitForTimeout(100);
    assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('67m.save')))).activeAction, null, 'Barry modal blocks map actions');
    assert.equal(frozen.game.clock.minuteOfDay, 540, 'casino clock stops exactly at Barry');
    await page.screenshot({ path: `${output}/${touch ? 'touch' : 'mouse'}-barry.png` });
    await click(640, 432);
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('67m.save')).game.terminalReason === 'BARRY_PAYMENT_FAILED');
    await page.waitForTimeout(100); await click(640, 606);
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('67m.save')).game.terminalReason === null);
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
  const result = { status: 'passed', url, publishedVersion, platform: 'mock/localStorage; no SDK stubs', inputs: ['mouse 1280x720', 'CDP touch 640x360'], checks: ['save failure pauses; repeated retry and Escape; immutable resumed search without duplicate cost; 3-second rummage and exact 45 minutes', 'fresh startup and reload', 'subpath assets without failed requests', 'debug/perf disabled', 'three jobs twice each without reload and payouts', 'casino exit/re-entry three times and map action', 'casino idle clock and exact Barry boundary; modal blocks input; failed payment can restart', 'exit and return during pending Drop', 'courier remains unresolved while travelling', 'cold/mid-Drop exact payout and RNG restore', 'no duplicate settled payout', 'restart without ads', 'portrait blocker and logical canvas'], errors, failures, serviceRequests };
  writeFileSync(`${output}/result.json`, JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
}
