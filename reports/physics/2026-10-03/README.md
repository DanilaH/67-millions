# Physics audit: edge flights, 2026-10-03

Scope: investigate the user's observation that fast balls bypass lower pegs and reach edge pockets. No runtime physics, balance, saves or presentation changed.

Source revision: `4063c4f0ad2334b06be85e9bec41505682fdd684`.
Config SHA-256: `efc0e32a1e328ee2f453022ea344475531f16d1acbd343c8c229aa21d880b994`.
Policy: existing cascade runner, seed 67043000, 10,000 paid roots per configuration; batch size 64. These are physics samples, not full-game or six-concurrent-launch pacing simulations. Ball-ball collisions are disabled in production.

| Configuration | Drops with at least one edge payout | Edge share of terminal balls | Deep swept peg misses | Stuck |
|---|---:|---:|---:|---:|
| Bare | 1.14% | 1.14% | 0 | 0 |
| Bias L4 only | 5.85% | 5.85% | 0 | 0 |
| Max amplifier/return/splitter, bias off | 5.51% | 4.03% | 0 | 0 |
| All physical upgrades max | 9.71% | 7.03% | 0 | 0 |

Max displacement per solver tick within the peg region: 5.66 / 6.29 / 6.84 / 6.70 logical pixels respectively. Ball diameter is 20 and peg diameter 12. These maxima are displacement observations, not a mathematical guarantee against every grazing collision miss.

## What explains the observation

- Jackpot Bias adds four pairs of real angled deflectors at maximum level; restitution 0.75. This intentionally promotes outward trajectories. It is not hidden pocket reassignment.
- Peg restitution is 0.6. Matter uses the larger restitution of a colliding pair, so the ball's 0.155 does not make a peg impact use 0.155. A ball retains tangential motion; it is not supposed to stop on every peg.
- Return preserves lateral X while moving the ball to the upper spawn Y and zeroing velocity. A returned ball can fall down the side of the triangular peg layout before its next contact. Amplifier changes value, not velocity. Splitter introduces a configured horizontal velocity delta of 0.8.
- Special pin art has opaque radius 9 (return/splitter) or 10 (amplifier), but every physical peg has radius 6. This is a confirmed visual/contact mismatch and can look like penetration of the painted outer part. It does not establish the user's exact observed trajectory.
- Multiple paid balls do not collide with or accelerate one another.

## Validation and limits

`tools/plinko-physics-audit.ts` wraps the unchanged runner's engine update. It looks for a segment crossing deeply inside the combined ball/peg radius, with both endpoints outside and no active solver contact. The 0.9 inner-radius margin accounts conservatively for polygon approximations. Zero detections rules out the tested deep through-crossings; it does not prove all grazing contacts correct and is not continuous collision detection.

A separate 2,000-root/configuration run substituted Phaser's actual bundled Engine, Bodies, Body, Composite and Events. Pocket arrays matched an independent 2,000-root/configuration stock Matter run exactly in all four cases. This checks the physical engine and geometry, not browser frame scheduling, asynchronous scene callbacks, or the user's absent save/recording.

Raw measurements: `audit-matter.json`, `audit-phaser.json`. Base pocket payouts are used because this audit measures trajectories, not monetary progression. Historical 100k calibration reports are not replaced by this smaller diagnostic sample.

## Conclusion / next change

The physical upgrade combination substantially increases edge access. No deep tunnelling defect was reproduced. Do not add a blanket velocity cap or change prices based on an unconfirmed tunnelling hypothesis. First align the drawn solid pin with its collision footprint (keep any extra halo visibly non-solid). If less ballistic side traversal is desired, compare deflector geometry/restitution candidates with full physical calibration before changing production; changing Return's X retention would also change documented gameplay semantics. Economic pacing remains a separate unresolved task.

Reproduce from repo root:

```sh
AUDIT_REVISION=$(git rev-parse HEAD) node --import tsx tools/plinko-physics-audit.ts
AUDIT_REVISION=$(git rev-parse HEAD) AUDIT_ENGINE=phaser AUDIT_RUNS=2000 node --import tsx tools/plinko-physics-audit.ts
```
