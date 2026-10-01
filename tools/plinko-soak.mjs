import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { balance } from '../src/config/balance.ts';
import { createInitialGameState } from '../src/core/state/GameState.ts';
import { createSaveState } from '../src/core/save/SaveState.ts';
import { resolveEventChoice, getEventChoiceAvailability } from '../src/core/events/eventEffects.ts';

// A diagnostic performance build, never a production gameplay override.
const url = process.env.SOAK_URL ?? 'http://127.0.0.1:4183/?perf=plinko';
const output = process.env.SOAK_OUTPUT ?? '/workspace/67m-evidence/soak';
const count = Number(process.env.SOAK_DROPS ?? 40);
const initial = createSaveState({ ...createInitialGameState(balance, 67074000), cash: 50_000_000,
  plinkoCenterLevel: 2, plinkoMidLevel: 3, plinkoJackpotLevel: 3,
  plinkoAmplifierLevel: 5, plinkoReturnLevel: 4, plinkoSplitterLevel: 5, plinkoJackpotBiasLevel: 4 });
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/usr/bin/chromium', args: ['--disable-dev-shm-usage'] });
mkdirSync(output, { recursive: true });
const errors = [], samples = [], restores = [];
let page;
const readSave = page => page.evaluate(() => JSON.parse(localStorage.getItem('67m.save')));
const setHidden = (page, hidden) => page.evaluate(hidden => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => hidden ? 'hidden' : 'visible' });
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event('visibilitychange'));
}, hidden);
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, hasTouch: true });
  await context.addInitScript(save => { if (!localStorage.getItem('67m.save')) localStorage.setItem('67m.save', JSON.stringify(save)); }, initial);
  page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  const ready = () => page.waitForFunction(() => window.__PLINKO_PERF__?.phase === 'ready', null, { timeout: 20000 });
  await page.goto(url, { waitUntil: 'networkidle' }); await ready();
  await page.mouse.click(1250, 710);
  const cdp = await context.newCDPSession(page); await cdp.send('Performance.enable');
  const measure = async () => {
    await page.waitForTimeout(600); await cdp.send('HeapProfiler.collectGarbage');
    const metrics = await cdp.send('Performance.getMetrics');
    return { ...(await page.evaluate(() => window.__PLINKO_PERF__.diagnostics())), heap: metrics.metrics.find(m => m.name === 'JSHeapUsedSize').value };
  };
  samples.push(await measure());
  assert.equal(samples[0].plinko_context, 'running', 'actual gesture must enable sound');
  for (let index = 0; index < count; index++) {
    const current = await readSave(page);
    if (current.game.pendingEventId !== null) {
      const eventId = current.game.pendingEventId;
      const choice = getEventChoiceAvailability(current.game, balance, eventId, 'a').available ? 'a' : 'b';
      const result = resolveEventChoice(current.game, balance, eventId, choice);
      await setHidden(page, true); await page.waitForTimeout(100);
      await page.evaluate(save => localStorage.setItem('67m.save', JSON.stringify(save)), { ...current, game: result.state, activeAction: result.activeAction });
      await page.reload({ waitUntil: 'networkidle' }); await ready(); await page.mouse.click(1250, 710);
    }
    await page.evaluate(() => window.__PLINKO_PERF__.start());
    if (index % 8 === 0) {
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('67m.save')).pendingDrop?.physics?.fixedTicksElapsed >= 15);
      await setHidden(page, true); await page.waitForTimeout(150);
      const paused = await readSave(page);
      await page.waitForTimeout(800);
      assert.deepEqual(await readSave(page), paused, 'background freezes physics, game time and cash');
      await setHidden(page, false);
    }
    await page.waitForFunction(() => window.__PLINKO_PERF__.phase === 'resolved' || window.__PLINKO_PERF__.phase === 'error', null, { timeout: 30000 });
    assert.equal(await page.evaluate(() => window.__PLINKO_PERF__.phase), 'resolved');
    const settled = await readSave(page); assert.equal(settled.pendingDrop, null);
    if (index % 8 === 0) {
      await setHidden(page, true); await page.waitForTimeout(100);
      const durable = await readSave(page);
      await page.reload({ waitUntil: 'networkidle' }); await ready();
      assert.equal((await readSave(page)).game.cash, durable.game.cash, 'settled reload never repays a Drop');
      restores.push({ index, cash: durable.game.cash });
      await page.mouse.click(1250, 710);
    }
    if ((index + 1) % 5 === 0) { const sample = await measure(); samples.push(sample); console.log(JSON.stringify({ drops: index + 1, ...sample })); }
  }
  // Branch from the same frozen mid-Drop save: uninterrupted vs restored outcome.
  await page.evaluate(() => window.__PLINKO_PERF__.start());
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('67m.save')).pendingDrop?.physics?.fixedTicksElapsed >= 15);
  await setHidden(page, true); await page.waitForTimeout(150); const checkpoint = await readSave(page);
  await setHidden(page, false); await page.waitForFunction(() => JSON.parse(localStorage.getItem('67m.save')).pendingDrop === null, null, { timeout: 30000 });
  const uninterrupted = await readSave(page);
  await setHidden(page, true); await page.waitForTimeout(100);
  await page.evaluate(save => localStorage.setItem('67m.save', JSON.stringify(save)), checkpoint);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('67m.save')).pendingDrop === null, null, { timeout: 30000 });
  const restored = await readSave(page);
  assert.equal(restored.game.cash, uninterrupted.game.cash, 'mid-Drop restore retains exact payout');
  assert.equal(restored.game.rngState, uninterrupted.game.rngState, 'mid-Drop restore retains exact RNG');
  for (const sample of samples) {
    for (const key of ['bodies', 'audioListeners', 'pointerListeners', 'textures']) assert.equal(sample[key], samples[0][key], `stable ${key}`);
    for (const key of ['plinko_bounceVoices', 'plinko_accentVoices', 'plinko_specialVoices', 'plinko_transferVoices', 'world_transientVoices']) assert.equal(sample[key], 0, `settled ${key} released`);
  }
  const tail = samples.slice(Math.ceil(samples.length / 2)).map(s => s.heap);
  assert.ok(Math.max(...tail) - Math.min(...tail) < 2_000_000, 'post-warmup GC heap must remain bounded within 2 MB');
  assert.deepEqual(errors, []);
  const report = { status: 'passed', drops: count, profile: 'desktop Chromium, max upgrades, sound on; synthetic visibility events; no real-device claim', samples, settledReloads: restores, exactMidDropRestore: true, pageErrors: errors };
  writeFileSync(`${output}/result.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, drops: count, exactMidDropRestore: true }));
  await context.close();
} catch (error) {
  writeFileSync(`${output}/failure.json`, JSON.stringify({ error: String(error), samples, restores, errors, save: page ? await readSave(page) : null, probe: page ? await page.evaluate(() => window.__PLINKO_PERF__) : null }, null, 2));
  if (page) await page.screenshot({path: `${output}/failure.png`});
  throw error;
} finally { await browser.close(); }
