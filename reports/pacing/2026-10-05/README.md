# Shared-world / active-time follow-up — 2026-10-05

## What changed

Added an opt-in execution model to the existing full-game runner. Legacy diagnostics retain their original behavior. The new model:

- uses `createBarePlinko`, the production board constructor, and Phaser's pinned Matter fork;
- shares RNG, the world-wide active-ball cap and descendant ownership across independently paid roots;
- advances passive casino time once per shared solver clock, plus each launch's configured action-time cost;
- settles each root independently, deferring Barry until the last paid root resolves;
- uses `WorkMinigameClock` to add active skill time before the existing shift action cost;
- records physics, work, decision and idle seconds separately from game-clock minutes.

Runtime physics/config/economy are unchanged. The only runtime-source edit is making an existing Phaser type-only import explicit. All other edits are diagnostics and tests. This advances E21 measurement fidelity, not release acceptance.

## Provenance and reproduction

Config SHA-256: `7fe6c5c2a3ae98cbb1c1eaf81172097d0bd7cfbd259fee499f9c593214a3cd2c`.
Implementation revision for all 240 corrected runs: `91cb46eb369e12ec8b2b5ef35ca4acde85488758`.

The initial cross-runtime fixture failed: Node predicted cash 99,875 while Chromium produced 100,406 from the same checkpoint. Phaser 4.2.1's `MatterPhysics` constructor overrides raw Matter resolver defaults: resting threshold 2 → 4 and tangent threshold √6 → 6. Importing the bundled Matter fork alone did not apply those overrides. Applying them to the failing Node continuation reproduced 100,406 exactly. The adapter now mirrors all five Phaser resolver initialization values. An earlier snapshot-cloning hypothesis did not fix the mismatch; no claim is made that it caused it.

All provisional runs made before this correction were discarded and rerun. Earlier reports using `cascadeRunner`/standalone Matter also lack these Phaser overrides; their numerical distributions and pacing must not be used as production estimates. Their historical outputs remain intact. This does not undo the implemented geometry or invalidate the separate browser save/reload checks.
240 simulated runs: 20 seeds (67104000–67104019) for each combination of two launch modes, two purchase orders and three decision delays.

Commands:

```
node --import tsx simulation/full-game/timingAudit.ts 20 reports/pacing/2026-10-05 2
node --import tsx simulation/full-game/timingAudit.ts 20 reports/pacing/2026-10-05/delay-0 0
node --import tsx simulation/full-game/timingAudit.ts 20 reports/pacing/2026-10-05/delay-5 5
```

Each directory contains summary.json and full traces/results in runs.json.gz. Paired initial seeds do not guarantee matched later random events: policies consume RNG and advance game time differently.

## Explicit behavioral assumptions

- Start from the existing baseline-growth + liquidity-v1 bot.
- Mode 1 launches one root and waits. Mode 6 attempts a burst of up to six, 0.25 seconds apart, then drains the world. It does not continuously refill slots. Additional burst clicks repeat the first fraction and can spend the reserve that the first policy decision protected; this is a different risk policy, not a pure throughput experiment.
- Original order retains the existing policy. Cheapest substitutes the cheapest unlocked non-limit Plinko purchase costing no more than the originally selected non-limit purchase. Max-bet and job-upgrade decisions remain unchanged.
- Dishes/trash consume their full configured 20/25-second timers; real players may finish earlier. Courier duration is assumed 30 seconds, not measured. Skill success still follows policy probabilities.
- Decision delays are scenarios (0, 2, 5 seconds), not measured player behavior. Idle WAIT is counted at the configured clock scale. Event modal reading, load/save/render latency, recovery animation time and navigation are not measured. Fractional menu-time carry is unified rather than maintained per scene.
- Nominal solver 60 Hz; this is not phone FPS or wall-clock performance.
- Intra-burst bankroll drawdown / near-zero metrics are not sampled by the old aggregate diagnostics and must not be interpreted from these files.

## Results with 2-second decision delay

Victory duration includes all four modeled active-time components. Medians describe winners only; work/recovery columns also describe winners only. Sample win counts are not human win-probability estimates.

| Launch mode | Purchase order | Wins / 20 | Median victory minutes | Work shifts | Recovery actions |
|---|---|---:|---:|---:|---:|
| One root | Original | 18 | 13.0 | 13.5 | 10 |
| One root | Cheapest | 20 | 11.0 | 10 | 8 |
| Up to six | Original | 19 | 8.1 | 8 | 6 |
| Up to six | Cheapest | 20 | 7.7 | 6.5 | 6 |

The three losses in these variants were Barry losses, lasting 48.9–53.0 modeled minutes. Most paths win quickly, but long failing paths still exist. This is not measured retention or human restart behavior.

Fastest observed winner at 2-second decisions took 4.64 minutes. The longest took 37.63 minutes. A roughly five-minute strategy remains possible under the model; there is no optimal-policy search here.

For original/single winners, the median work-time component is 6.29 minutes, versus 3.47 minutes of physical Plinko. For cheapest/burst winners, work is 3.08 minutes, versus 1.81 minutes of physics. Component medians need not add up to median total duration.

## Decision-time sensitivity

Each cell is wins out of 20 / median winning minutes.

| Variant | 0 seconds | 2 seconds | 5 seconds |
|---|---:|---:|---:|
| One/original | 19 / 11.6 | 18 / 13.0 | 17 / 18.2 |
| One/cheapest | 20 / 9.2 | 20 / 11.0 | 20 / 16.2 |
| Burst/original | 20 / 6.4 | 19 / 8.1 | 20 / 12.6 |
| Burst/cheapest | 20 / 5.0 | 20 / 7.7 | 20 / 11.6 |

Decision time changes both clock pressure and later random sequences; it is not just added to the end of a fixed trajectory. Across these scenarios the corrected model supports substantially faster progression than the provisional model. Twenty seeds per cell remain a diagnostic sample, not a precision balance estimate.

## Purchase pacing and early play

At 2-second decisions, median time to the first Drop among winners is 1.2–1.23 modeled minutes. These bots choose to work first; the game itself permits an immediate Drop with starting cash.

Median per-run longest interval between Plinko purchases among winners:

- one/original: 2.77 minutes;
- one/cheapest: 2.73 minutes;
- burst/original: 1.63 minutes;
- burst/cheapest: 1.45 minutes.

Meanwhile the median pooled purchase interval is 2 seconds. Bulk buying and long droughts coexist. These figures exclude the interval after the final purchase and depend on policy ordering.

## Conclusions and next minimum step

1. The previous 19–27-minute provisional medians were misleading. Correct Phaser initialization gives 7.7–13.0 minutes at 2-second decisions. Do not tune prices from the earlier simulator.
2. Fast progression and rare long losing paths coexist. Uniformly stretching every action or raising all prices could worsen the latter without addressing the profitable route.
3. Next minimum balance investigation: measure stage-by-stage returns with this browser-checked adapter, then isolate the earliest upgrade that produces the profitable acceleration. Recheck the old deflector edge-rate estimates with the corrected resolver before treating them as production facts.
4. Separate concurrency from risk: additional burst clicks currently spend reserves; add a reserve-preserving comparison before attributing the whole difference to parallel launches.
5. No economy, geometry or runtime physics changes were made. Human testing remains necessary for readable feedback, fun and actual decision durations. The measured discrepancy blocks balance acceptance; this report is diagnostic evidence, not acceptance.

## Validation

Unit suite plus new shared-world tests cover six-launch cap, independent charges/payouts, one shared passive clock, Barry deferral and additive skill time. The new CLI was explicitly typechecked (the standard project tsconfig does not include every simulation entrypoint).

Browser parity fixtures were added to the existing playtest suite: six staggered mixed-stake roots, on both base and maximum boards. Node captures the production solver checkpoint; the real Phaser scene resumes it. Assertions compare final cash, RNG, game clock and needs exactly. Both parity fixtures and all preceding playtest checks passed on implementation revision `91cb46e` in [Pages playtest run 37229951546](https://github.com/DanilaH/67-millions/actions/runs/37229951546). The CI workflow for that revision also passed. This validates those fixtures, not every seed, device, frame cadence or policy. The report commit changes no executable source.
