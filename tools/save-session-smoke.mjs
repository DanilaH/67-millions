import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import assert from 'node:assert/strict';
import { balance } from '../src/config/balance.ts';
import { createInitialGameState } from '../src/core/state/GameState.ts';
import { createSaveState } from '../src/core/save/SaveState.ts';
import { createSharedWorld } from '../simulation/full-game/sharedWorld.ts';

const output = 'artifacts/save-session-smoke'; mkdirSync(output, { recursive: true });
const root = resolve('dist');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.avif': 'image/avif', '.webp': 'image/webp' };
const server = createServer((req, res) => {
  const file = resolve(root, new URL(req.url, 'http://localhost').pathname.replace(/^\/67-millions\//, '') || 'index.html');
  if (!file.startsWith(root + '/')) { res.writeHead(404).end(); return; }
  try { res.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream' }).end(readFileSync(file)); }
  catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/67-millions/`;
const browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}), args: ['--disable-dev-shm-usage'] });
const errors = [], checks = [];
try {
  for (const touch of [false, true]) for (const paid of [false, true]) {
    const context = await browser.newContext({ viewport: touch ? { width: 640, height: 360 } : { width: 1280, height: 720 }, hasTouch: touch });
    const label = `${touch ? 'touch' : 'desktop'}-${paid ? 'paid' : 'cash'}`;
    const state = { ...createInitialGameState(balance, 67165001), cash: 13125 };
    let fixture = createSaveState(state);
    if (paid) {
      const world = createSharedWorld(state, balance); assert.equal(world.launch(1), true); world.step();
      const checkpoint = world.snapshot(); world.destroy();
      fixture = { ...createSaveState(checkpoint.state), pendingDrop: checkpoint.pending };
    }
    await context.addInitScript(value => {
      if (!localStorage.getItem('67m.save')) localStorage.setItem('67m.save', JSON.stringify(value));
      const original = Storage.prototype.setItem;
      window.__sessionWrites = 0;
      Storage.prototype.setItem = function(key, value) {
        if (key === '67m.save') window.__sessionWrites++;
        if (key === '67m.save' && JSON.parse(this.getItem(key) ?? '{}').pendingDrop && !JSON.parse(value).pendingDrop) window.__sessionSettlement = JSON.parse(value).game;
        return original.call(this, key, value);
      };
    }, fixture);
    const owner = await context.newPage(); owner.on('pageerror', error => errors.push(error.message));
    await owner.goto(url);
    await owner.waitForFunction(() => document.querySelector('#startup-preload')?.dataset.state === 'hidden');
    const waiting = await context.newPage(); waiting.on('pageerror', error => errors.push(error.message));
    await waiting.goto(url); await waiting.locator('#save-session-wait').waitFor({ state: 'visible' });
    // Headless tabs can both remain visible. Freeze the real owner document to
    // model background suspension and establish a stable durable checkpoint.
    const ownerLifecycle = await context.newCDPSession(owner);
    await ownerLifecycle.send('Page.setWebLifecycleState', { state: 'frozen' });
    assert.equal(await waiting.locator('canvas').count(), 0, 'waiting tab never starts Phaser');
    await waiting.keyboard.press('Escape');
    assert.equal(await waiting.locator('#save-session-wait').isVisible(), true, 'Escape cannot bypass ownership');
    await waiting.screenshot({ path: `${output}/${label}-waiting.png` });
    const beforeReload = await waiting.evaluate(() => localStorage.getItem('67m.save'));
    assert.equal(await waiting.evaluate(() => window.__sessionWrites), 0, 'waiting tab performs no writes');
    await waiting.reload(); await waiting.locator('#save-session-wait').waitFor({ state: 'visible' });
    assert.equal(await waiting.evaluate(() => window.__sessionWrites), 0, 'waiting reload performs no writes');
    // The owner may finish a queued visibility checkpoint. Attribute writes to
    // their document, rather than mistaking that valid owner write for a race.
    const checkpoint = await waiting.evaluate(() => JSON.parse(localStorage.getItem('67m.save')));
    assert.equal(checkpoint.game.cash, JSON.parse(beforeReload).game.cash);
    let expected = checkpoint.game;
    if (paid) {
      assert.ok(checkpoint.pendingDrop, 'an actually live paid root transfers');
      const world = createSharedWorld(checkpoint.game, balance, checkpoint.pendingDrop);
      for (let i = 0; i < 3600 && world.active; i++) world.step();
      assert.equal(world.active, false); expected = world.snapshot().state; world.destroy();
    }
    await owner.close();
    await waiting.waitForFunction(() => document.querySelector('#startup-preload')?.dataset.state === 'hidden');
    assert.equal(await waiting.locator('#save-session-wait').count(), 0);
    if (paid) {
      await waiting.waitForFunction(() => window.__sessionSettlement, null, { timeout: 30000 });
      assert.deepEqual(await waiting.evaluate(() => window.__sessionSettlement), expected, 'exact paid-root payout/RNG/clock/needs after transfer');
    } else assert.equal(await waiting.evaluate(() => JSON.parse(localStorage.getItem('67m.save')).game.cash), 13125);
    await waiting.screenshot({ path: `${output}/${label}-restored.png` }); checks.push(label);
    await context.close();
  }
  assert.deepEqual(errors, []);
  writeFileSync(`${output}/result.json`, JSON.stringify({ status: 'passed', checks, errors }, null, 2));
  console.log('Save session smoke passed:', checks.join(', '));
} catch (error) {
  const pages = browser.contexts().flatMap(context => context.pages());
  const page = pages.at(-1);
  if (page) {
    await page.screenshot({ path: `${output}/failure.png` });
    console.error(await page.evaluate(() => ({ text: document.body.innerText, preload: document.querySelector('#startup-preload')?.dataset.state, canvas: document.querySelector('canvas')?.getAttribute('aria-label') })));
  }
  throw error;
} finally { await browser.close(); server.close(); }
