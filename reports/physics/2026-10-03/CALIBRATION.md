# Deflector calibration and visual collider correction

> Measurement correction — 2026-10-05: The later cross-runtime audit found missing Phaser resolver overrides in the standalone Matter simulator. The numerical edge rates and EV below require remeasurement with the corrected adapter; they are not validated production distributions. Geometry changes and browser save/reload verification remain separate facts. See [follow-up](../../pacing/2026-10-05/README.md).

User requested implementation after the edge-flight audit. Economic prices, payouts, free launches, Return and the bare board are unchanged.

## Calibrated candidate

- First three cumulative pairs: X offset 174/150/126 → 182/158/134 (8 px outward).
- Fourth pair: 110 → 110.5 px. Angles, lengths and solver unchanged.
- Opaque special pin radius now equals physical radius 6; glyphs fit inside it.
- Old paid cascades resolve on the archived old deflectors. Their fingerprint, stake and exact solver are preserved. Scene switches to the current board after final durable settlement. Other fingerprint mismatches remain rejected.

## Selection evidence

Exploration: seed 67043101, 5,000 roots per tested level, raw candidate files in this directory. Changing constructor restitution 0.75→0.155 produced identical outcomes: Matter resets static-body restitution to zero. Shorter bars or different angles either inverted upgrade progression or caused stuck outcomes. Position candidate +8/+0.5 preserved progression and reduced edge access.

Reproduction: `node --import tsx tools/plinko-deflector-calibration.ts MODE`, where MODE is restitution, length, angle, offset or position. It reconstructs historical geometry from the archived data rather than assuming the current geometry is the old baseline. Older exploration JSON uses the original output field names.

Independent validation seed **67043202**:

| Bias level | Roots | Edge probability | Stuck |
|---|---:|---:|---:|
| 0 | 100,000 | 1.061% | 0 |
| 1 | 100,000 | 1.289% | 0 |
| 2 | 100,000 | 2.039% | 0 |
| 3 | 100,000 | 2.574% | 0 |
| 4 | 100,000 | 3.682% | 0 |

L4 bare EV 1.096945x. Another 100,000 roots with all physical/payout upgrades max: 100,000 resolved, zero stuck, p95 6.2 seconds, max 8.233 seconds. Terminal edge share 6,981 / 137,646 = 5.072%. This is a ball-level statistic; do not confuse it with probability of any edge within one root's cascade.

Max upgraded EV remains 11.129152x, median 0.7424x. This is deliberately reported: reducing physical edge assistance does NOT establish that five-minute completion or economic snowballing is solved. No full-game pacing claim is made.

Config SHA-256: `7fe6c5c2a3ae98cbb1c1eaf81172097d0bd7cfbd259fee499f9c593214a3cd2c`. Runner source revision `9cee0e8fdde82230204030ab906697000fa6c79e` plus the explicit config diff above; the runner itself was unchanged. See `calibrated/summary.json` and `calibrated-max/summary.json` for measurements. Runs are headless physical samples, not human playtests or device performance measurements.

## Verification

- 362 unit tests across 63 files passed, including paid old-board selection and strict rejection of unknown fingerprints.
- Typecheck, Pages build and production release audit passed.
- Local Chromium playtest suite passed: six mixed-stake launches and cap, exact multi-ball payout/RNG/clock restore, max-special cascades, old paid-board checkpoint restore followed by a current-board launch, 1080p courier input, debug controls and small-screen exit. No page errors. Hosted rollout is pending.

## Recovery verification — 2026-10-04

Recovered the uncommitted implementation on main at `9cee0e8`. Re-ran all 362 tests and the Pages build successfully. The config hash still matches the measurements above; the 600,000 physical samples were not rerun. Local browser revalidation was unavailable because the Chromium executable was missing and its download failed. The Pages workflow must run both browser suites before deployment and verify the live revision afterward.
