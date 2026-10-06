# Payback audit and pocket progression candidate — 2026-10-06

## Decision

Publish **flatter-pockets** as a playtest candidate, not an accepted balance freeze. The selected objective is shorter purchase droughts and a less compressed final economy phase during concurrent launches. It does **not** solve all difficulty/pacing concerns: modeled survival increases, solo play slows substantially, and concurrent successful runs remain below the ~30-minute target. Earlier rejection of severe cap candidates based only on slow solo pacing was too narrow a selection criterion for this progression experiment; the solo cost is now reported explicitly rather than hidden.

Prices, stakes/caps, base pockets, physical routes, guide geometry and special effects are unchanged. New purchased multipliers:

| Track | Previous | Candidate |
|---|---|---|
| Center I | 0.35× | 0.50× |
| Center II | 0.40×, inner 1.05× | 0.75×, inner 1.15× |
| Mid I | 1.80×, inner 1.10× | 2.00×, inner 1.20× |
| Edge I / II / III | 25× / 50× / 100× | 16× / 22× / 32× |

Runtime/config SHA-256: `bf5acb94044cff5997b7a14630642c984fa209e106fc028213e98017f7b94f79`.

## What payback showed

`paybackAudit.ts` evaluates next-level candidates with the production shared-world adapter and reuses paired root seeds. It ranks marginal expected net cash per single-board second divided by price, assuming half of the current max bet. This is an approximate one-step income model: it ignores bankroll survival, need costs, future upgrade prerequisites and concurrency throughput. It is **not an optimal strategy solver**.

- Exploratory mean-only selection: 115 cached board states × 150 roots = 17,250 executions, seed stream 67116000.
- Guarded selection: 124 states × 200 roots = 24,800 executions, same stream seed. It defers max-bet ranking until the estimated mean gross return's normal lower 95% bound exceeds 1. This heuristic is not a heavy-tail confidence guarantee.
- Independent validation of that fixed path: 27 board states × 1,500 roots = 40,500 executions, seed stream 67117000. It remeasures the fixed chosen steps and does not reselect winners.

The validation exposes large differences in payback, at the particular stages recorded in `validation/summary.json`: Amplifier II ~5.2 s; guide III ~4.8 s; Return II ~42 s and III ~30 s. Some expensive upgrades have little immediate gain: Amplifier IV ~1,198 s and Splitter V ~1,909 s on this path. These are context-dependent marginal-income ratios, not time a human must wait or universal ROI for those levels. Amplifier IV also unlocks V, so its immediate return alone is incomplete.

The conservative path keeps the starting cap too long while accumulating expensive prerequisites. In actual full-game trials it loses all 20 runs to Barry. The mean-only path wins 6/10 singles and 6/10 six-root trials, with successful medians ~34.8 and ~18.8 min. This does not identify a dominant strategy. We retain these negative results rather than claiming the greedy ranking found the fastest route.

The first exploratory selection was run while audit instrumentation was being revised: its per-stage runner hash is not reliable evidence of the executed source snapshot. Its frozen path remains an explicit reproducible input to the mean-path full-game experiment. **Do not use that exploratory selection as independently validated physical evidence.** Guarded selection and fixed-path validation pin the loaded runner hash once at startup. The separately saved validation samples are the basis for the payback figures above.

## Rejected price experiment

`targeted-prices.json` raises Amplifier II/III to 250k/900k, guide III to 1.2m and edge III to 1.5m. It retains the old payout curve. Eighty modeled sessions use seeds 67115000–67115019 and are compared to the prior turn's unchanged-config `2026-10-06-balance/holdout-baseline` (reused evidence, not falsely counted as a fresh baseline run).

Among common winners, six-root total duration changes by −0.38 min in original order and +0.08 in cheapest order; longest purchase gaps do not improve. Solo/original grows by +3.65 min while solo/cheapest barely changes. This candidate was rejected. Merely charging more for selected strong levels did not establish a better curve.

## Selected experiment: redistributed pocket returns

Selection: 10 seeds × two launch counts × two purchase orders × two configs = 80 modeled sessions, seeds 67119000–67119009. Fewer purchase droughts and a longer final phase in both six-root orders motivated an independent comparison, not raw total duration alone.

Independent full-game comparison: 20 seeds per policy, seeds 67120000–67120019; baseline/candidate each 80 burst sessions plus 40 continuous-spend sessions = 240 sessions. Config was selected before these seeds. Base policy remains BASELINE_GROWTH + liquidity-v1. Original/cheapest purchase orders and the real shared-world adapter are retained. These are bot results, not human win probabilities.

| Mode / order | Old wins | New wins | Old winning median min | New winning median min |
|---|---:|---:|---:|---:|
| holdout 1 / original | 20/20 | 19/20 | 29.60 | 39.50 |
| holdout 1 / cheapest | 20/20 | 20/20 | 25.81 | 34.76 |
| holdout 6 / original | 17/20 | 20/20 | 16.37 | 16.37 |
| holdout 6 / cheapest | 20/20 | 20/20 | 14.29 | 14.73 |
| continuous 6 / original | 11/20 | 19/20 | 14.22 | 15.31 |
| continuous 6 / cheapest | 16/20 | 19/20 | 13.48 | 14.00 |

Whole-group winner medians compare different survivors. `paired-holdout.json` instead joins mode/batch/order/seed and conditions on victories in both versions:

| Mode / order | Common wins | Δ total min | Δ million-to-end min | Δ longest internal purchase gap min |
|---|---:|---:|---:|---:|
| holdout 1 / original | 19 | +8.51 | +6.28 | -2.25 |
| holdout 1 / cheapest | 20 | +8.58 | +6.82 | -0.19 |
| holdout 6 / original | 17 | -0.25 | +1.62 | -1.73 |
| holdout 6 / cheapest | 20 | +0.94 | +1.78 | -0.54 |
| continuous 6 / original | 10 | -1.46 | +1.20 | -2.21 |
| continuous 6 / cheapest | 15 | +0.07 | +1.20 | -1.17 |

Across the four concurrent variants, longest internal purchase gaps decrease by ~0.5–2.2 min, while the final phase after first observed million grows ~1.2–1.8 min. Single-launch runs grow ~8.5 min. This is the actual tradeoff; it is not a uniform improvement. Higher survival may make the run too forgiving and must be evaluated alongside the user's concern that the game is easy. We do not claim this fixes challenge or prevents a three-day win.

Observed cash milestones are sampled at decision boundaries; rare in-cascade peaks are not included. Same seeds diverge in future RNG consumption after decisions differ. Timing assumes 2 s decisions, 30 s courier and full configured dish/trash timers; no loading/render/save latency is modeled. A successful path is not proof that all strategies have been searched.

## Physical checks

Candidate Return matrix: 4 contexts × 5 Return levels × 1,000 roots = 20,000 executions, seed stream 67110610, paired to the existing `2026-10-06-implementation/candidate-matrix` baseline. All roots resolved and each candidate Return ladder increased in sample mean. Maximum-board gross return changes from ~34.16× to ~12.67× while edge-hit trajectories remain identical. The lower payout comes from the visible pocket multipliers, not hidden routing or altered collisions. These means are sample estimates with heavy tails, not guaranteed returns.

This pass adds 102,550 physical executions across exploratory/guarded/validation/matrix work and 440 labeled full-game runs. Seed streams and configurations are reused as explicitly described; these counts are not independent initial seeds.

## Save compatibility and validation

The existing paid-board fingerprint already includes derived pocket multipliers. `plinko-pockets-2026-10-06.json` retains the prior multiplier tables. The resolver tries that immediately preceding table before historical Return/geometry/special revisions. Already-paid roots keep original payouts; a later paid world uses the new table. Unknown fingerprints still reject.

Regressions now cover old upgraded pocket tables across five historical revisions, Return I/IV and six concurrent roots. The fixed expected pocket array in the progression unit test was updated to the intentionally changed public multipliers; structural/symmetry and payout/save invariants were retained. 406 unit tests pass; Pages build and strict type-check of the audit entrypoints pass. Both full local browser suites passed: `smoke:playtest` (including exact old payouts/new-board transition and Node/browser cash/RNG/clock/needs parity) and `smoke:pages` (mouse and touch, including the real debug Barry payment).

The previous deployment `2122e7f` failed the playtest smoke at debug-panel close. The failure was reproduced, and new failure diagnostics showed the entertainment panel opening. DOM release events bubbled into Phaser's window listener when the game resumed. Commit `9006666` stops those pointer/mouse/touch events at the debug root and removes listeners on disposal. The focused reproducer and full playtest suite passed before this balance patch; no assertion or timeout was weakened.

## Reproduction

```sh
node --import tsx simulation/full-game/paybackAudit.ts reports/pacing/2026-10-06-payback/baseline-config.json /tmp/payback-selection 200 67116000
node --import tsx simulation/full-game/paybackAudit.ts reports/pacing/2026-10-06-payback/baseline-config.json /tmp/payback-validation 1500 67117000 reports/pacing/2026-10-06-payback/guarded-selection/summary.json
node --import tsx simulation/full-game/timingAudit.ts 20 /tmp/current 2 reports/pacing/2026-10-06-payback/baseline-config.json 67120000 BASELINE_GROWTH burst
node --import tsx simulation/full-game/timingAudit.ts 20 /tmp/candidate 2 reports/pacing/2026-10-06-payback/flatter-pockets.json 67120000 BASELINE_GROWTH burst
node --import tsx simulation/full-game/timingAudit.ts 20 /tmp/continuous 2 reports/pacing/2026-10-06-payback/flatter-pockets.json 67120000 BASELINE_GROWTH continuous-spend
node --import tsx simulation/full-game/feedbackImplementationAudit.ts reports/pacing/2026-10-06-payback/flatter-pockets.json /tmp/matrix 1000 67110610
```

Use the frozen path JSON with timingAudit arguments `burst 1 payback <path>` to reproduce the diagnostic path policies. The policy models bankroll reserve and work/recovery but does not dynamically replan the frozen upgrade sequence. Initial base executable `2122e7f`; local debug-fix commit `7c37759` has the same tree as published `9006666`. Simulation source additions are committed with this evidence. Manifest hashes cover exact configs, frozen outputs and current runner files. T069/T070 and human challenge/pacing acceptance remain open.
