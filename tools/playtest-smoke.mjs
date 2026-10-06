import { createSharedWorld } from '../simulation/full-game/sharedWorld.ts';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import assert from 'node:assert/strict';
import legacySpecials from '../src/config/plinko-specials-2026-10-05.json' with { type: 'json' };
import legacyPhysics from '../src/config/plinko-physics-2026-10-03.json' with { type: 'json' };
import legacyPairs from '../src/config/plinko-deflectors-2026-10-02.json' with { type: 'json' };
import { commitBareDrop, createBoardFingerprint } from '../src/core/plinko-rules/drop.ts';
import { balance } from '../src/config/balance.ts';
import { createInitialGameState } from '../src/core/state/GameState.ts';
import { createSaveState } from '../src/core/save/SaveState.ts';

const output = 'artifacts/playtest-smoke'; mkdirSync(output, { recursive: true });
const root = resolve('dist');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.avif': 'image/avif', '.webp': 'image/webp' };
const server = createServer((req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  const file = resolve(root, path.replace(/^\/67-millions\//, '') || 'index.html');
  if (!file.startsWith(root + '/')) { res.writeHead(404).end(); return; }
  try { res.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream' }).end(readFileSync(file)); }
  catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/67-millions/`;
const browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}), args: ['--disable-dev-shm-usage'] });
const errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  // Capture the durable settlement boundary, before screenshot/polling latency can
  // legitimately advance the idle casino clock. Keep exact clock assertions.
  await context.addInitScript(() => {
    // Test-only render throttling: force several fixed updates per render frame.
    if (sessionStorage.getItem('67m.smokeSlowFrames') === '1') {
      const request = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = callback => request(time => {
        setTimeout(() => callback(time), 60);
      });
    }
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      const previous = key === '67m.save' ? this.getItem(key) : null;
      original.call(this, key, value);
      if (key === '67m.save' && previous) {
        const before = JSON.parse(previous), after = JSON.parse(value);
        if (before.pendingDrop && !after.pendingDrop) window.__smokeSettlement = after;
      }
    };
  });
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  const ready = async label => {
    await page.waitForFunction(label => document.querySelector('canvas')?.getAttribute('aria-label') === label && document.querySelector('#startup-preload')?.dataset.state === 'hidden', label);
  };
  const save = () => page.evaluate(() => JSON.parse(localStorage.getItem('67m.save')));
  const load = async value => {
    await page.evaluate(value => localStorage.setItem('67m.save', JSON.stringify(value)), value);
    await page.reload(); await ready(value.pendingDrop ? 'Казино Plinko' : 'Карта города');
  };
  const click = async (x, y) => {
    const box = await page.locator('canvas').boundingBox(); assert.ok(box);
    await page.mouse.click(box.x + box.width * x / 1280, box.y + box.height * y / 720);
  };
  const clickMap = async id => {
    const target = await page.locator('canvas').evaluate((canvas, id) => JSON.parse(canvas.dataset.mapTargets)[id], id);
    await click(target.x, target.y);
  };
  await page.goto(url); await ready('Карта города');
  const fixture = createSaveState({ ...createInitialGameState(balance, 670123), cash: 100000 });
  await load(fixture);
  assert.equal(await page.locator('canvas').evaluate(c => c.width), 1920, '1080p uses a native 1920px backing store');
  await page.screenshot({ path: `${output}/map-1080p.png` });
  await click(42, 96); await page.screenshot({ path: `${output}/stat-detail.png` });
  await clickMap('casino'); await ready('Казино Plinko');
  for (let i = 0; i < 6; i += 1) {
    await click(i % 2 ? 625 : 400, 695);
    await click(810, 695);
    await page.waitForFunction(n => {
      const p = JSON.parse(localStorage.getItem('67m.save')).pendingDrop;
      return p && 1 + (p.additionalDrops?.length ?? 0) === n;
    }, i + 1);
  }
  const six = await save();
  assert.equal(six.game.cash, fixture.game.cash - 3 * (125 + 500));
  await click(810, 695);
  assert.equal((await save()).game.cash, six.game.cash, 'seventh launch cannot charge at the cap');
  await page.screenshot({ path: `${output}/six-balls.png` });
  const checkpoint = await save();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('67m.save')).pendingDrop === null, null, { timeout: 30000 });
  const original = await save();
  await load(checkpoint);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('67m.save')).pendingDrop === null, null, { timeout: 30000 });
  const replay = await save();
  assert.equal(replay.game.cash, original.game.cash, 'six independently paid outcomes survive reload exactly');
  assert.equal(replay.game.rngState, original.game.rngState, 'shared RNG restores exactly');
  assert.deepEqual(replay.game.clock, original.game.clock, 'shared solver clock restores exactly');
  await page.reload(); await ready('Карта города');
  assert.equal((await save()).game.cash, replay.game.cash, 'settled launches never credit twice');
  // Exercise shared special pins and descendant ownership, not just bare roots.
  const upgraded = structuredClone(fixture);
  Object.assign(upgraded.game, { plinkoCenterLevel: 2, plinkoMidLevel: 3, plinkoJackpotLevel: 3,
    plinkoAmplifierLevel: 5, plinkoReturnLevel: 4, plinkoSplitterLevel: 5, plinkoJackpotBiasLevel: 4 });
  await load(upgraded); await clickMap('casino'); await ready('Казино Plinko');
  for (let i = 0; i < 6; i += 1) { await click(810, 695); }
  await page.waitForFunction(() => {
    const p = JSON.parse(localStorage.getItem('67m.save')).pendingDrop;
    return p?.physics?.balls.some(ball => ball.splitDepth > 0);
  }, null, { timeout: 15000 });
  const specialCheckpoint = await save();
  assert.ok(specialCheckpoint.pendingDrop.physics.balls.length <= balance.plinko.maxActiveBalls);
  await page.screenshot({ path: `${output}/special-cascades.png` });
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('67m.save')).pendingDrop === null, null, { timeout: 45000 });
  const specialObserved = await save();
  const specialResult = await page.evaluate(() => window.__smokeSettlement);
  assert.ok(specialResult, 'captured original durable settlement');
  await load(specialCheckpoint);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('67m.save')).pendingDrop === null, null, { timeout: 45000 });
  const specialReplayObserved = await save();
  const specialReplay = await page.evaluate(() => window.__smokeSettlement);
  assert.ok(specialReplay, 'captured replay durable settlement');
  writeFileSync(`${output}/special-clock-boundary.json`, JSON.stringify({checkpoint:specialCheckpoint,original:specialResult,replay:specialReplay,observedOriginal:specialObserved,observedReplay:specialReplayObserved},null,2));
  console.log('Special clock boundary',JSON.stringify({original:specialResult.game.clock,replay:specialReplay.game.clock,observedOriginal:specialObserved.game.clock,observedReplay:specialReplayObserved.game.clock}));
  assert.equal(specialReplay.game.cash, specialResult.game.cash, 'special cascades restore exact independently aggregated payouts');
  assert.equal(specialReplay.game.rngState, specialResult.game.rngState, 'special cascades restore RNG');
  assert.deepEqual(specialReplay.game.clock, specialResult.game.clock, 'special cascades restore clock');
  // A pre-calibration paid board must keep its old geometry through reload.
  for (const revision of ['specials', 'physics', 'deflectors']) {
  const legacyBalance = structuredClone(balance);
  legacyBalance.plinko.specialPinLayout = structuredClone(legacySpecials.layout);
  legacyBalance.plinko.splitter = structuredClone(legacySpecials.splitter);
  if (revision !== 'specials') legacyBalance.plinko.physicsSeed = structuredClone(legacyPhysics);
  if (revision === 'deflectors') legacyBalance.plinko.jackpotBias.forEach((level, index) => { level.deflectorPairs = structuredClone(legacyPairs[index]); });
  const oldCommit = commitBareDrop({ ...upgraded.game }, null, legacyBalance, 'legacy-geometry', 1);
  await load({ ...createSaveState(oldCommit.state), pendingDrop: oldCommit.pendingDrop });
  await page.waitForFunction(() => !!JSON.parse(localStorage.getItem('67m.save')).pendingDrop?.physics?.solver);
  const oldCheckpoint = await save();
  assert.equal(oldCheckpoint.pendingDrop.boardFingerprint, oldCommit.pendingDrop.boardFingerprint);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('67m.save')).pendingDrop === null, null, { timeout: 30000 });
  const oldResult = await save();
  await load(oldCheckpoint);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('67m.save')).pendingDrop === null, null, { timeout: 30000 });
  assert.equal((await save()).game.cash, oldResult.game.cash, 'legacy geometry restores exact payout');
  await ready('Казино Plinko');
  await click(810, 695);
  await page.waitForFunction(() => !!JSON.parse(localStorage.getItem('67m.save')).pendingDrop);
  const newShot = (await save()).pendingDrop;
  assert.equal(newShot.boardFingerprint, createBoardFingerprint(balance, newShot.pocketLevelsAtCommit, newShot.specialLevelsAtCommit), 'next paid launch switches to calibrated geometry');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('67m.save')).pendingDrop === null, null, { timeout: 30000 });
  }
  // High-density input is transformed back into logical map/minigame space.
  await load(fixture); await clickMap('work'); await ready('РАБОТА');
  await click(760, 510); await ready('Курьерский маршрут');
  await page.screenshot({ path: `${output}/courier-1080p.png` });
  const move = async (x, y) => {
    const box = await page.locator('canvas').boundingBox();
    await page.mouse.move(box.x + box.width * x / 1280, box.y + box.height * y / 720, { steps: 8 });
  };
  await move(180, 365); await page.mouse.down();
  for (const [x, y] of [[180, 600], [1100, 600], [1100, 365]]) await move(x, y);
  await page.mouse.up(); await click(1180, 670);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('67m.save')).activeAction === null, null, { timeout: 15000 });
  assert.ok((await save()).game.cash > fixture.game.cash, '1080p courier pointer path reaches its endpoint');
  await load(fixture);
  await page.goto(url); await ready('Карта города');
  await page.locator('#debug-root summary').click();
  const cash = (await save()).game.cash;
  await page.getByLabel('Сумма денег').fill('12345');
  await page.getByRole('button', { name: '+ Деньги', exact: true }).click();
  await page.waitForFunction(cash => JSON.parse(localStorage.getItem('67m.save')).game.cash === cash, cash + 12345);
  await page.getByRole('button', { name: '− Деньги', exact: true }).click();
  await page.waitForFunction(cash => JSON.parse(localStorage.getItem('67m.save')).game.cash === cash, cash);
  await page.getByLabel('Минуты промотки').fill('60');
  const before = (await save()).game.clock.minuteOfDay;
  await page.getByRole('button', { name: 'Промотать минуты', exact: true }).click();
  await page.waitForFunction(minute => JSON.parse(localStorage.getItem('67m.save')).game.clock.minuteOfDay === minute, before + 60);
  await page.screenshot({ path: `${output}/debug.png` });
  await page.getByRole('button', { name: 'Сбросить сейв', exact: true }).click();
  await page.getByRole('button', { name: 'Да, удалить текущий забег', exact: true }).click();
  await page.waitForFunction(cash => JSON.parse(localStorage.getItem('67m.save')).game.cash === cash, createInitialGameState(balance, 1).cash);
  await page.locator('#debug-root summary').click(); await ready('Карта города');
  await page.setViewportSize({ width: 640, height: 360 });
  await page.waitForTimeout(300);
  await clickMap('casino'); await ready('Казино Plinko');
  await click(1100, 660); await ready('Карта города');
  // Cross-check the node adapter against the actual Phaser scene from the same solver checkpoint.
  for (const { special, roots, spacing, name, slowFrames = false } of [
    { special: false, roots: 1, spacing: 0, name: 'base-first-tick' },
    { special: false, roots: 6, spacing: 15, name: 'base' },
    { special: true, roots: 6, spacing: 15, name: 'special' },
    { special: true, roots: 6, spacing: 15, name: 'special-slow-frames', slowFrames: true },
  ]) {
    const initial = { ...createInitialGameState(balance, 67105001), cash: 100000 };
    if (special) Object.assign(initial, { plinkoCenterLevel: 2, plinkoMidLevel: 3, plinkoJackpotLevel: 3, plinkoAmplifierLevel: 5, plinkoReturnLevel: 4, plinkoSplitterLevel: 5, plinkoJackpotBiasLevel: 4 });
    const world = createSharedWorld(initial, balance);
    for (let i = 0; i < roots; i++) { world.launch(i % 2 ? 1 : 0.25); for (let tick = 0; tick < spacing; tick++) world.step(); }
    const checkpoint = world.snapshot();
    const trajectory = [];
    for (let tick = 0; tick < 3600 && world.active; tick++) { world.step(); trajectory.push(world.snapshot()); }
    const expected = world.snapshot(); world.destroy();
    assert.equal(expected.pending, null);
    const saved = { ...createSaveState(checkpoint.state), pendingDrop: checkpoint.pending };
    const inert = route => route.fulfill({ contentType: 'text/html', body: '<html></html>' });
    await page.evaluate(slow => sessionStorage.setItem('67m.smokeSlowFrames', slow ? '1' : '0'), slowFrames);
    await page.route(url, inert); await page.goto(url);
    await page.evaluate(value => localStorage.setItem('67m.save', JSON.stringify(value)), saved);
    await page.addInitScript(() => {
      window.__paritySaves = [];
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) {
        if (key === '67m.save') window.__paritySaves.push(JSON.parse(value));
        return original.call(this, key, value);
      };
    });
    await page.unroute(url, inert); await page.reload(); await ready('Казино Plinko');
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('67m.save')).pendingDrop === null, null, { timeout: 45000 });
    const actual = await page.evaluate(() => window.__smokeSettlement.game);
    const browserSaves = await page.evaluate(() => window.__paritySaves);
    writeFileSync(`${output}/node-parity-${name}.json`, JSON.stringify({ checkpoint, actual, expected, trajectory, browserSaves }));
    const divergences = browserSaves.flatMap(saved => {
      const tick = saved.pendingDrop?.physics?.fixedTicksElapsed;
      if (tick === undefined) return [];
      const frame = trajectory.find(frame => frame.pending?.physics?.fixedTicksElapsed === tick);
      if (!frame) return [];
      const a = saved.pendingDrop.physics.balls, b = frame.pending.physics.balls;
      return JSON.stringify(a) === JSON.stringify(b) ? [] : [{ tick, actual: a, expected: b }];
    });
    console.log('Parity first divergence', JSON.stringify(divergences[0]));
    assert.equal(actual.cash, expected.state.cash, 'node/Phaser shared-world payout parity');
    assert.equal(actual.rngState, expected.state.rngState, 'node/Phaser shared RNG parity');
    assert.deepEqual(actual.clock, expected.state.clock, 'node/Phaser passive clock parity');
    assert.deepEqual(actual.needs, expected.state.needs, 'node/Phaser needs parity');
  }
  assert.deepEqual(errors, []);
  writeFileSync(`${output}/result.json`, JSON.stringify({ status: 'passed', checks: ['1080p backing and map input', 'six free launches, mixed stakes and cap', 'mid-world exact payout, RNG, clock replay', 'no duplicate payout', 'six max-special cascades exact replay', 'legacy paid geometry resumes then switches to current board', '1080p courier path reaches destination', 'debug add/remove/time/reset', 'collapsed debug does not cover casino exit at 640x360', 'exact node/browser cash RNG clock needs parity including delayed render frames'], errors }, null, 2));
  console.log('Playtest smoke passed');
} catch (error) { writeFileSync(`${output}/failure.json`, JSON.stringify({ error: String(error), errors }, null, 2)); throw error; }
finally { await browser.close(); server.close(); }
