# Bare Plinko V0 — 100k physical calibration

Status: **accepted bare-board V0 evidence for T025/T026**.

## Provenance

- Config version: `0.7-canonical-preproduction`
- Config SHA-256: `d229ee9caf6a7f7dbead380b06264a6d1d6ed989dfbbb6c4102ff59a68245fa1`
- Calibration seed: `67000000`
- Runs: `100000`
- Physics engine: `matter-js@0.20.0` (same Matter baseline used by Phaser)
- GitHub Actions run: `36345403293`
- Generated: 2026-09-27

## Accepted runtime physics

- Horizontal peg spacing: `48 px`
- Vertical peg spacing: `27 px`
- Ball radius: `10 px`
- Peg radius: `6 px`
- Spawn jitter: `±4 px`
- Fixed timestep: `60 Hz`
- gravityY: `1.0`
- ball restitution: `0.155`
- peg restitution: `0.6`
- friction: `0`
- frictionAir: `0.023`
- wall restitution: `0.2`

## 100k result

| Metric | Result |
|---|---:|
| Resolved | 100,000 / 100,000 |
| Stuck/watchdog | 0 |
| EV / RTP | 0.870225x |
| Target EV | 0.85x |
| EV delta | +0.020225x |
| Median payout | 0.25x |
| Stddev | 1.402378 |
| P(<1x) | 52.188% |
| P(>=2x) | 4.070% |
| P(>=5x) | 1.161% |
| P(>=10x) | 1.161% |
| Combined center pockets | 52.188% |
| Edge pockets | 1.161% |
| Max mirrored-pocket delta | 0.613% |
| Galton-shape L1 error | 0.106763 |
| Mean collisions | 22.393 |
| Mean cascade duration | 4.961 s |
| p95 cascade duration | 5.700 s |
| Max cascade duration | 9.467 s |
| p95 payout | 1.5x |
| p99 payout | 12x |

## Pocket frequencies

| Pocket | Multiplier | Count | Frequency |
|---:|---:|---:|---:|
| 0 | 12x | 585 | 0.585% |
| 1 | 4x | 1,488 | 1.488% |
| 2 | 1.5x | 4,778 | 4.778% |
| 3 | 1x | 17,512 | 17.512% |
| 4 | 0.25x | 26,211 | 26.211% |
| 5 | 0.25x | 25,977 | 25.977% |
| 6 | 1x | 16,899 | 16.899% |
| 7 | 1.5x | 4,553 | 4.553% |
| 8 | 4x | 1,421 | 1.421% |
| 9 | 12x | 576 | 0.576% |

## Interpretation

The board is not forced to the theoretical binomial distribution. It is accepted as a measured physical Matter board:

- combined center is inside the MVP 45–54% corridor;
- left/right asymmetry is small;
- no ball hit the watchdog in 100,000 Drops;
- EV is reasonably near the configured ~0.85 target;
- no hidden pocket routing or probability override is used.

Any gameplay-affecting change to geometry, spawn, restitution, damping, collision shapes, timestep, or pocket sensors invalidates this report and requires a new physical calibration run.
