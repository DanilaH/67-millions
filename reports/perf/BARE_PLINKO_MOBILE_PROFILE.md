# Bare Plinko mobile-profile performance smoke

Status: **PASS — synthetic screening**

This report records the early M2 browser performance gate for the calibrated bare Plinko board. It is reproducible CI evidence, not a substitute for later real-device / Yandex DRAFT validation.

## Provenance

- GitHub Actions run: `36346975848`
- workflow: `Plinko performance smoke`
- branch revision under test: `69c0870c63c65a28f0b7fa9ca2eab255f3b01d23`
- browser: Chromium via Playwright 1.63.0
- build: production-optimized Vite performance mode with mock platform runtime
- viewport: 1280×720
- mobile browser context: yes
- touch: yes
- device scale factor: 1
- CPU throttle: 4×
- bare-board physics: accepted Balance V0 configuration

## Screening thresholds

The project fallback performance requirement is approximately 30 FPS in the worst allowed cascade. For this early bare-board smoke the automated screening gate uses:

- median frame interval <= 33.33 ms;
- p95 frame interval <= 50 ms;
- frames >50 ms <= 10%;
- zero active Plinko balls after settlement.

These are CI screening thresholds, not a claim that a GitHub-hosted Chromium runner models a specific physical phone.

## Measured result

- active-cascade duration: **4604.3 ms**
- frame samples: **229**
- median frame interval: **16.7 ms**
- p95 frame interval: **33.4 ms**
- max frame interval: **50.0 ms**
- frames >50 ms: **0%**
- active balls after resolve: **0**
- JS heap before forced GC/sample: **7,264,328 bytes**
- JS heap after resolve + forced GC/sample: **8,642,808 bytes**
- observed heap delta: **+1,378,480 bytes**

The heap delta is recorded as diagnostic evidence only. A single cold Drop is not a leak test; repeated-Drop / long-session memory soak remains a later reliability task.

## Interpretation

The calibrated one-ball board shows no sustained severe jank under this synthetic 4× CPU-throttled profile and cleans up the active ball after settlement. That is enough for the M2 automated bare-board performance smoke.

Later gates still required by the roadmap:

- real mobile/browser hands-on validation;
- Yandex DRAFT-host validation;
- 24-ball / Splitter stress in M3;
- repeated-Drop memory/audio soak before RC.
