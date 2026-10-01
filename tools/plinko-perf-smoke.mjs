import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { chromium } from 'playwright';

const PORT = Number(process.env.PLINKO_PERF_PORT ?? 4173);
const OUTPUT = resolve(process.env.PLINKO_PERF_OUTPUT ?? 'artifacts/perf');
const URL = `http://127.0.0.1:${PORT}/?perf=plinko${process.env.PLINKO_PERF_STRESS === '24' ? '&stress=24' : ''}${process.env.PLINKO_PERF_ART === 'off' ? '&art=off' : ''}`;
const CPU_THROTTLE = 4;
const FALLBACK_FRAME_MS = 1000 / 30;

const percentile = (values, q) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * q) - 1),
  );
  return sorted[index];
};

const median = (values) => percentile(values, 0.5);

const waitForServer = async () => {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(URL);
      if (response.ok) return;
    } catch {
      // server not listening yet
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  throw new Error('Timed out waiting for Vite preview server');
};

const metricMap = (result) =>
  Object.fromEntries(result.metrics.map((metric) => [metric.name, metric.value]));

const server = spawn(
  process.execPath,
  [
    resolve('node_modules/vite/bin/vite.js'),
    'preview',
    '--host',
    '127.0.0.1',
    '--port',
    String(PORT),
    '--strictPort',
  ],
  {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  },
);

let serverOutput = '';
server.stdout.on('data', (chunk) => {
  serverOutput += String(chunk);
});
server.stderr.on('data', (chunk) => {
  serverOutput += String(chunk);
});

let browser;
let page;

try {
  await waitForServer();

  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? {executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH} : {}),
    args: ['--disable-dev-shm-usage'],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });

  page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE });
  await cdp.send('Performance.enable');

  await page.addInitScript(() => {
    window.__PERF_FRAME_SAMPLES__ = [];
    let previous = null;

    const sample = (timestamp) => {
      if (previous !== null) {
        window.__PERF_FRAME_SAMPLES__.push({
          timestamp,
          deltaMs: timestamp - previous,
        });
      }
      previous = timestamp;
      window.requestAnimationFrame(sample);
    };

    window.requestAnimationFrame(sample);
  });

  await page.goto(URL, { waitUntil: 'networkidle' });

  await page.waitForFunction(
    () => window.__PLINKO_PERF__?.phase === 'ready',
    null,
    { timeout: 20_000 },
  );

  if (process.env.PLINKO_PERF_AUDIO !== 'off') await page.mouse.click(1250, 710);
  await cdp.send('HeapProfiler.collectGarbage');
  const before = metricMap(await cdp.send('Performance.getMetrics'));

  await page.evaluate(async () => {
    await window.__PLINKO_PERF__?.start();
  });

  await page.waitForFunction(
    () =>
      window.__PLINKO_PERF__?.phase === 'resolved' ||
      window.__PLINKO_PERF__?.phase === 'error',
    null,
    { timeout: 120_000 },
  );

  await page.waitForTimeout(250);
  await cdp.send('HeapProfiler.collectGarbage');
  const after = metricMap(await cdp.send('Performance.getMetrics'));

  const pageResult = await page.evaluate(() => ({
    probe: window.__PLINKO_PERF__,
    frames: window.__PERF_FRAME_SAMPLES__ ?? [],
  }));

  const probe = pageResult.probe;
  if (!probe || probe.startedAtMs === null || probe.resolvedAtMs === null) {
    throw new Error(
      `Performance probe did not resolve correctly: ${JSON.stringify(probe)}`,
    );
  }

  const frameDeltas = pageResult.frames
    .filter(
      (sample) =>
        sample.timestamp >= probe.startedAtMs &&
        sample.timestamp <= probe.resolvedAtMs,
    )
    .map((sample) => sample.deltaMs)
    .filter((delta) => Number.isFinite(delta) && delta > 0);

  const longFrames = frameDeltas.filter((delta) => delta > 50).length;
  const report = {
    generatedAt: new Date().toISOString(),
    profile: {
      browser: 'chromium',
      viewport: { width: 1280, height: 720 },
      mobileContext: true,
      touch: true,
      deviceScaleFactor: 1,
      cpuThrottleRate: CPU_THROTTLE,
      syntheticScreening: true,
      art: process.env.PLINKO_PERF_ART ?? 'on',
      audio: process.env.PLINKO_PERF_AUDIO ?? 'on',
      syntheticInitialBalls: process.env.PLINKO_PERF_STRESS === '24' ? 24 : 1,
      realDeviceEvidence: false,
    },
    thresholds: {
      fallbackThirtyFpsFrameMs: FALLBACK_FRAME_MS,
      medianFrameMsMax: FALLBACK_FRAME_MS,
      p95FrameMsMax: 50,
      longFrameOver50MsRatioMax: 0.1,
      activeBallsAfterResolve: 0,
    },
    measurements: {
      sampleCount: frameDeltas.length,
      durationMs: probe.resolvedAtMs - probe.startedAtMs,
      medianFrameMs: median(frameDeltas),
      p95FrameMs: percentile(frameDeltas, 0.95),
      maxFrameMs: Math.max(...frameDeltas, 0),
      longFrameOver50MsRatio:
        frameDeltas.length === 0 ? 1 : longFrames / frameDeltas.length,
      activeBallsAfterResolve: probe.activeBallCount,
      maxActiveBalls: probe.maxActiveBallCount ?? null,
      jsHeapUsedBefore: before.JSHeapUsedSize ?? null,
      jsHeapUsedAfter: after.JSHeapUsedSize ?? null,
      jsHeapUsedDelta:
        before.JSHeapUsedSize !== undefined && after.JSHeapUsedSize !== undefined
          ? after.JSHeapUsedSize - before.JSHeapUsedSize
          : null,
    },
    probe: {
      phase: probe.phase,
      error: probe.error,
    },
  };

  const failures = [];
  if (probe.phase !== 'resolved') failures.push(`probe phase is ${probe.phase}`);
  if (frameDeltas.length < 60) failures.push('too few frame samples');
  if (report.measurements.medianFrameMs > report.thresholds.medianFrameMsMax) {
    failures.push(
      `median frame ${report.measurements.medianFrameMs.toFixed(2)}ms exceeds ${report.thresholds.medianFrameMsMax.toFixed(2)}ms`,
    );
  }
  if (report.measurements.p95FrameMs > report.thresholds.p95FrameMsMax) {
    failures.push(
      `p95 frame ${report.measurements.p95FrameMs.toFixed(2)}ms exceeds ${report.thresholds.p95FrameMsMax.toFixed(2)}ms`,
    );
  }
  if (
    report.measurements.longFrameOver50MsRatio >
    report.thresholds.longFrameOver50MsRatioMax
  ) {
    failures.push(
      `long-frame ratio ${report.measurements.longFrameOver50MsRatio.toFixed(4)} exceeds ${report.thresholds.longFrameOver50MsRatioMax}`,
    );
  }
  if (
    report.measurements.activeBallsAfterResolve !==
    report.thresholds.activeBallsAfterResolve
  ) {
    failures.push(
      `active ball leak: ${report.measurements.activeBallsAfterResolve} remain after resolve`,
    );
  }

  report.failures = failures;

  mkdirSync(OUTPUT, { recursive: true });
  writeFileSync(
    resolve(OUTPUT, 'plinko.json'),
    JSON.stringify(report, null, 2) + '\n',
  );

  process.stdout.write(JSON.stringify(report, null, 2) + '\n');

  if (failures.length > 0) {
    process.exitCode = 1;
  }

  await context.close();
} catch (error) {
  mkdirSync(OUTPUT, { recursive: true });
  if (page) {
    writeFileSync(resolve(OUTPUT, 'unresolved.json'), JSON.stringify(await page.evaluate(() => ({ probe: window.__PLINKO_PERF__, diagnostics: window.__PLINKO_PERF__?.diagnostics?.(), save: JSON.parse(localStorage.getItem('67m.save') ?? 'null') })), null, 2));
    await page.screenshot({path: resolve(OUTPUT, 'unresolved.png')});
  }
  writeFileSync(
    resolve(OUTPUT, 'error.txt'),
    `${error instanceof Error ? error.stack ?? error.message : String(error)}\n\nSERVER OUTPUT\n${serverOutput}`,
  );
  throw error;
} finally {
  await browser?.close().catch(() => undefined);
  server.kill('SIGTERM');
}
