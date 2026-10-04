import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import assert from 'node:assert/strict';
import { balance } from '../src/config/balance.ts';
import { createInitialGameState } from '../src/core/state/GameState.ts';
import { createSaveState } from '../src/core/save/SaveState.ts';
import { startFood } from '../src/core/actions/foodEntertainment.ts';
import { startSleep } from '../src/core/sleep/sleep.ts';
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
    page.setDefaultTimeout(30000);
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
    assert.equal(initial.version, 15);
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
      // Stop the previous game before injecting a fixture: its queued writes or
      // shutdown flush can otherwise overwrite a save installed in the live page.
      const emptyDocument = route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Save fixture</title>' });
      await page.route(url, emptyDocument);
      try {
        await page.goto(url, { waitUntil: 'load' });
        await page.evaluate(save => localStorage.setItem('67m.save', JSON.stringify(save)), save);
      } finally {
        await page.unroute(url, emptyDocument);
      }
      await page.reload({ waitUntil: 'networkidle' }); await ready();
      await page.waitForTimeout(300);
      rect = await page.locator('canvas').boundingBox(); assert.ok(rect);
    };
    const sceneReady = async label => {
      try { await page.waitForFunction(label => document.querySelector('canvas')?.getAttribute('aria-label') === label, label); }
      catch (error) {
        await page.screenshot({ path: `${output}/failed-scene.png` });
        console.error('scene transition', label, await page.locator('canvas').getAttribute('aria-label'), errors);
        throw error;
      }
    };
    const jobLabels = { dishes: 'Мойка посуды', trash: 'Вынос мусора', courier: 'Курьерский маршрут' };
    const click = async (x, y) => { await move(x, y); await down(); await up(); };
    const clickMap = async id => {
      const target = await page.locator('canvas').evaluate((canvas, id) => JSON.parse(canvas.dataset.mapTargets)[id], id);
      await click(target.x, target.y);
    };
    const fixture = createSaveState(createInitialGameState(balance, 67067000));
    // Reload must finish reserved timed actions through the same scheduler, once.
    const reservedFood = startFood(fixture.game, null, null, balance, 'FOOD_01');
    await loadSave({ ...fixture, game: reservedFood.state, activeAction: reservedFood.action });
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('67m.save')).activeAction === null, null, { timeout: 5000 });
    const foodRestored = await page.evaluate(() => JSON.parse(localStorage.getItem('67m.save')));
    assert.equal(foodRestored.game.cash, fixture.game.cash - balance.food[0].price, 'restore never charges food twice');
    assert.equal(foodRestored.game.clock.minuteOfDay, fixture.game.clock.minuteOfDay + balance.food[0].durationMinutes);
    await page.reload({ waitUntil: 'networkidle' }); await ready();
    assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('67m.save')))).game.cash, foodRestored.game.cash);
    const lateSleep = structuredClone(fixture); lateSleep.game.clock.minuteOfDay = 8 * 60 + 30;
    lateSleep.activeAction = startSleep(lateSleep.game, balance);
    await loadSave(lateSleep);
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('67m.save')).game.barryInterruptPending, null, { timeout: 5000 });
    const sleepRestored = await page.evaluate(() => JSON.parse(localStorage.getItem('67m.save')));
    assert.equal(sleepRestored.game.clock.minuteOfDay, 540);
    assert.equal(sleepRestored.activeAction, null, 'restored sleep stops at Barry');
    const resolvedWork = structuredClone(fixture); resolvedWork.game.clock.minuteOfDay = 16 * 60;
    const reservedWork = startWork(resolvedWork.game, balance, 'dishes', 1);
    await loadSave({ ...resolvedWork, game: reservedWork.state, activeAction: { ...reservedWork.action, result: 'SUCCESS' } });
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('67m.save')).activeAction === null, null, { timeout: 5000 });
    const workRestored = await page.evaluate(() => JSON.parse(localStorage.getItem('67m.save')));
    assert.equal(workRestored.game.cash, fixture.game.cash + balance.work.jobs.dishes.levels[0].payout);
    await page.reload({ waitUntil: 'networkidle' }); await ready();
    assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('67m.save')))).game.cash, workRestored.game.cash, 'resolved work pays only once after reload');
    const crossingFood = structuredClone(fixture); crossingFood.game.cash = 100000; crossingFood.game.clock.minuteOfDay = 530;
    const crossing = startFood(crossingFood.game, null, null, balance, 'FOOD_01');
    await loadSave({ ...crossingFood, game: crossing.state, activeAction: crossing.action });
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('67m.save')).game.barryInterruptPending);
    assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('67m.save')))).activeAction.remainingMinutes, 35);
    await click(640, 432);
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('67m.save')).activeAction === null);
    const afterCrossing = await page.evaluate(() => JSON.parse(localStorage.getItem('67m.save')));
    assert.equal(afterCrossing.game.cash, crossingFood.game.cash - balance.food[0].price - balance.barry.payments[0]);
    assert.equal(afterCrossing.game.clock.minuteOfDay, 575, 'restore stops for Barry then resumes exact remainder');
    // Long event labels and late-game amounts must remain legible on both inputs.
    for (const eventId of ['EVENT_01', 'EVENT_09', 'EVENT_10']) {
      const eventSave = structuredClone(fixture); eventSave.game.cash = 0; eventSave.game.pendingEventId = eventId;
      await loadSave(eventSave);
      await page.screenshot({ path: `${output}/${touch ? 'touch' : 'mouse'}-${eventId}.png` });
      await click(640, 370);
      assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('67m.save')))).game.pendingEventId, eventId, 'unaffordable event choice stays locked');
      await clickMap('work');
      assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('67m.save')))).activeAction, null, 'event shade blocks underlying map');
      await click(640, 496);
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('67m.save')).game.pendingEventId === null);
    }
    const lateBarry = structuredClone(fixture); lateBarry.game.cash = 100000000; lateBarry.game.barryPaymentIndex = 24; lateBarry.game.barryInterruptPending = true; lateBarry.game.clock.minuteOfDay = 540;
    await loadSave(lateBarry);
    await page.screenshot({ path: `${output}/${touch ? 'touch' : 'mouse'}-late-barry.png` });
    await click(640, 432);
    await page.waitForFunction(() => !JSON.parse(localStorage.getItem('67m.save')).game.barryInterruptPending);
    assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('67m.save')))).game.cash, 100000000 - balance.barry.payments[24]);
    // Work progression must be reachable in production, durable, and charged once.
    const career = structuredClone(fixture); career.game.cash = 100000;
    await loadSave(career);
    await clickMap('work'); await sceneReady('РАБОТА');
    await click(850, 153); await sceneReady('УЛУЧШЕНИЯ РАБОТ');
    assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('67m.save')))).game.cash, career.game.cash);
    await page.screenshot({ path: `${output}/${touch ? 'touch' : 'mouse'}-work-upgrades.png` });
    await click(760, 250);
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('67m.save')).game.jobLevels.dishes === 2);
    await click(760, 250);
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('67m.save')).game.jobLevels.dishes === 3);
    await click(760, 250);
    const careerSaved = await page.evaluate(() => JSON.parse(localStorage.getItem('67m.save')));
    assert.equal(careerSaved.game.cash, career.game.cash - balance.work.jobs.dishes.levels[1].upgradePrice - balance.work.jobs.dishes.levels[2].upgradePrice);
    await page.reload({ waitUntil: 'networkidle' }); await ready();
    rect = await page.locator('canvas').boundingBox();
    assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('67m.save')))).game.jobLevels.dishes, 3);
    await clickMap('work'); await sceneReady('РАБОТА');
    await page.screenshot({ path: `${output}/${touch ? 'touch' : 'mouse'}-work-level3.png` });
    await click(1190, 153); await sceneReady('Карта города');
    await clickMap('home'); await sceneReady('ДОМ / СОН');
    await page.screenshot({ path: `${output}/${touch ? 'touch' : 'mouse'}-sleep-forecast.png` });
    // Page navigation and stake selection must never spend cash.
    const rich = structuredClone(fixture); rich.game.cash = 100000;
    await loadSave(rich);
    await clickMap('food'); await sceneReady('ЕДА');
    const beforeForecast = await page.evaluate(() => JSON.parse(localStorage.getItem('67m.save')));
    await click(1140, 285);
    await page.waitForFunction(() => !!document.querySelector('canvas')?.getAttribute('data-needs-forecast'));
    const afterForecast = await page.evaluate(() => JSON.parse(localStorage.getItem('67m.save')));
    assert.equal(afterForecast.game.cash, beforeForecast.game.cash, 'forecast does not charge money');
    assert.equal(afterForecast.game.rngState, beforeForecast.game.rngState, 'forecast does not consume RNG');
    assert.equal(afterForecast.activeAction, null, 'forecast does not start an action');
    await page.screenshot({ path: `${output}/${touch ? 'touch' : 'mouse'}-food-forecast.png` });
    await click(1140, 285);
    await page.waitForFunction(() => !document.querySelector('canvas')?.getAttribute('data-needs-forecast'));
    await page.screenshot({ path: `${output}/${touch ? 'touch' : 'mouse'}-food-page1.png` });
    for (let number = 2; number <= 4; number++) {
      await click(1170, 612);
      await page.waitForFunction(number => document.querySelector('canvas')?.dataset.panelPage === String(number), number);
    }
    await page.screenshot({ path: `${output}/${touch ? 'touch' : 'mouse'}-food-page4.png` });
    assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('67m.save')))).game.cash, rich.game.cash, 'food pagination does not buy anything');
    await click(345, 612);
    await page.waitForFunction(() => document.querySelector('canvas')?.dataset.panelPage === '3');
    await page.waitForTimeout(3200);
    assert.equal(await page.locator('canvas').getAttribute('data-panel-page'), '3', 'clock updates preserve selected page');
    await click(345, 612); await click(345, 612);
    await page.waitForFunction(() => document.querySelector('canvas')?.dataset.panelPage === '1');
    await click(760, 250);
    await page.waitForFunction(() => document.querySelector('canvas')?.getAttribute('aria-description')?.includes('ХОЛОДНАЯ ЛАПША'));
    const afterFood = await page.evaluate(() => JSON.parse(localStorage.getItem('67m.save')));
    assert.equal(afterFood.game.cash, rich.game.cash - balance.food[0].price, 'food action charges advertised price once');
    await page.screenshot({ path: `${output}/${touch ? 'touch' : 'mouse'}-food-result.png` });
    await loadSave(rich);
    assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('67m.save')))).game.cash, rich.game.cash, 'casino fixture starts with the requested balance');
    await clickMap('casino'); await sceneReady('Казино Plinko');
    // Swipe through every row; releasing over a price must never buy.
    await move(1205, 590); await down(); await move(1205, 175, { steps: 12 }); await up();
    await move(1205, 590); await down(); await move(1205, 175, { steps: 12 }); await up();
    await page.waitForFunction(() => Number(document.querySelector('canvas')?.dataset.upgradeScroll) > 0);
    await page.screenshot({ path: `${output}/${touch ? 'touch' : 'mouse'}-insurance.png` });
    await move(1205, 175); await down(); await move(1205, 610, { steps: 12 }); await up();
    await move(1205, 175); await down(); await move(1205, 610, { steps: 12 }); await up();
    await page.waitForFunction(() => document.querySelector('canvas')?.dataset.upgradeScroll === '0');
    if (!touch) {
      await move(1100, 400); await page.mouse.wheel(0, 300);
      await page.waitForFunction(() => Number(document.querySelector('canvas')?.dataset.upgradeScroll) > 0);
      await page.mouse.wheel(0, -1000);
      await page.waitForFunction(() => document.querySelector('canvas')?.dataset.upgradeScroll === '0');
    }
    await click(400, 695);
    const selectedOnly = await page.evaluate(() => JSON.parse(localStorage.getItem('67m.save')));
    assert.equal(selectedOnly.game.cash, rich.game.cash, 'fraction selection and upgrade scrolling do not spend');
    assert.equal(selectedOnly.pendingDrop, null, 'fraction selection alone does not throw');
    await page.screenshot({ path: `${output}/${touch ? 'touch' : 'mouse'}-casino-controls.png` });
    await click(1000, 195);
    assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('67m.save')))).game.cash, rich.game.cash, 'upgrade title does not purchase');
    await click(1205, 250);
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('67m.save')).game.plinkoMaxBetLevel === 1);
    await page.screenshot({ path: `${output}/${touch ? 'touch' : 'mouse'}-upgrade-feedback.png` });
    const upgraded = await page.evaluate(() => JSON.parse(localStorage.getItem('67m.save')));
    assert.equal(upgraded.game.cash, rich.game.cash - balance.plinko.maxBetLevels[1].price, 'dedicated upgrade button buys once');
    await click(810, 695);
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('67m.save')).pendingDrop !== null);
    const thrown = await page.evaluate(() => JSON.parse(localStorage.getItem('67m.save')));
    assert.equal(thrown.pendingDrop.originalStake, 625, 'explicit throw uses selected fraction of new limit');
    assert.equal(thrown.game.cash, upgraded.game.cash - 625);
    await click(1205, 250);
    assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('67m.save')))).game.plinkoMaxBetLevel, 1, 'upgrade locked during throw');
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('67m.save')).pendingDrop === null, null, { timeout: 20000 });
    await page.screenshot({ path: `${output}/${touch ? 'touch' : 'mouse'}-casino-result.png` });
    // A failed action checkpoint stays pending: retry bytes, never the command.
    await loadSave(fixture);
    await clickMap('dumpster'); await sceneReady('ПОМОЙКА');
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
      await clickMap('work'); await sceneReady('РАБОТА');
      await page.screenshot({ path: `${output}/${touch ? 'touch' : 'mouse'}-work-panel.png` });
      await click(760, job === 'courier' ? 510 : job === 'trash' ? 380 : 250);
      await page.waitForFunction(job => JSON.parse(localStorage.getItem('67m.save')).activeAction?.actionId === job, job);
      await sceneReady(jobLabels[job]);
      await playJob();
      const second = await page.evaluate(() => JSON.parse(localStorage.getItem('67m.save')));
      assert.ok(second.game.cash > first.game.cash, `${job}: second shift in same scene pays out (${first.game.cash} → ${second.game.cash}; ${JSON.stringify(second.game.clock)})`);
    }
    // Real map → casino → map transitions, including the same casino instance.
    await loadSave(fixture);
    for (let cycle = 0; cycle < 3; cycle++) {
      await clickMap('casino'); await sceneReady('Казино Plinko');
      await click(1100, 660); await sceneReady('Карта города');
    }
    // A working map after exit must be able to launch a real action.
    await clickMap('work'); await sceneReady('РАБОТА'); await click(760, 510);
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('67m.save')).activeAction?.actionId === 'courier');
    await loadSave(fixture); await clickMap('casino'); await sceneReady('Казино Plinko');
    const idleMinute = (await page.evaluate(() => JSON.parse(localStorage.getItem('67m.save')))).game.clock.minuteOfDay;
    try {
      await page.waitForFunction(minute => JSON.parse(localStorage.getItem('67m.save')).game.clock.minuteOfDay > minute, idleMinute, { timeout: 6000 });
    } catch (error) {
      await page.screenshot({ path: `${output}/failed-casino-idle.png` });
      console.error('casino idle', await page.locator('canvas').getAttribute('aria-label'), await page.evaluate(() => JSON.parse(localStorage.getItem('67m.save'))), errors);
      throw error;
    }
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
    await loadSave(due); await clickMap('casino');
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('67m.save')).game.barryInterruptPending, null, { timeout: 6000 });
    await sceneReady('Карта города');
    const frozen = await page.evaluate(() => JSON.parse(localStorage.getItem('67m.save')));
    await clickMap('work'); await page.waitForTimeout(100);
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
    await page.setViewportSize({ width: 844, height: 390 });
    await loadSave(rich);
    const wide = await page.locator('canvas').boundingBox();
    assert.ok(Math.abs(wide.width - 844) <= 1 && Math.abs(wide.height - 390) <= 1, 'wide phone fills its viewport');
    await page.screenshot({ path: `${output}/${touch ? 'touch' : 'mouse'}-wide-map.png` });
    const casinoTarget = await page.locator('canvas').evaluate(canvas => JSON.parse(canvas.dataset.mapTargets).casino);
    const wideScale = wide.height / 720;
    const widePoint = (x, y) => ({ x: wide.x + wide.width / 2 + (x - 640) * wideScale, y: wide.y + y * wideScale });
    const entrance = widePoint(casinoTarget.x, casinoTarget.y);
    if (touch) await page.touchscreen.tap(entrance.x, entrance.y); else await page.mouse.click(entrance.x, entrance.y);
    await sceneReady('Казино Plinko');
    await page.screenshot({ path: `${output}/${touch ? 'touch' : 'mouse'}-wide-casino.png` });
    const launch = widePoint(810, 695);
    if (touch) await page.touchscreen.tap(launch.x, launch.y); else await page.mouse.click(launch.x, launch.y);
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('67m.save')).pendingDrop !== null);
    await context.close();
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(failures, []);
  assert.deepEqual(serviceRequests, []);
  const result = { status: 'passed', url, publishedVersion, platform: 'mock/localStorage; no SDK stubs', inputs: ['mouse 1280x720', 'CDP touch 640x360'], checks: ['reserved food/work/sleep reload; exact Barry remainder; event modal input locks and long labels; late Barry amounts', 'work upgrade L2/L3 purchase, maximum lock, persisted reload and sleep forecast', 'large food cards and persistent pagination; all upgrade rows; selection does not spend; explicit throw; single upgrade purchase and active-drop lock', 'save failure pauses; repeated retry and Escape; immutable resumed search without duplicate cost; 3-second rummage and exact 45 minutes', 'fresh startup and reload', 'subpath assets without failed requests', 'debug/perf disabled', 'three jobs twice each without reload and payouts', 'casino exit/re-entry three times and map action', 'casino idle clock and exact Barry boundary; modal blocks input; failed payment can restart', 'exit and return during pending Drop', 'courier remains unresolved while travelling', 'cold/mid-Drop exact payout and RNG restore', 'no duplicate settled payout', 'restart without ads', 'portrait blocker and logical canvas'], errors, failures, serviceRequests };
  writeFileSync(`${output}/result.json`, JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
}
