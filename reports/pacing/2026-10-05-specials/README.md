# Matched full-game diagnostic — 2026-10-05

**Follow-up:** the scheduling defect below is repaired and rerun in [fixed-tick evidence](../../physics/2026-10-05-fixed-tick/README.md). The original failed-run record is retained as history; consult the follow-up for current verification status.


> **Blocked evidence:** the candidate failed browser/Node payout parity in [run 37323285586](https://github.com/DanilaH/67-millions/actions/runs/37323285586). These are adapter diagnostics, not established production outcomes. Candidate deployment was skipped. Resolve deterministic effect scheduling before tuning prices or claiming these win counts for the game. See the [blocking finding](../../physics/2026-10-05-specials/README.md).

40 physical bot runs before and 40 after special-pin calibration, all starting from configured 500 ₽. Same 10 seeds (67104000–67104009) in four policy variants. Policy remains liquidity-v1 BASELINE_GROWTH, with original or cheapest-affordable upgrade order, and single launches or bounded six-root bursts spaced .25s then drained. Decisions assume 2 real seconds; dishes/trash use full configured work timers; courier assumes 30 seconds. This is nominal simulated active time, not measured human pacing.

Config/code provenance: [physics report](../../physics/2026-10-05-specials/README.md). Each folder includes full traces/results in `runs.json.gz` and metadata/summary JSON. All losses were Barry losses. Same-seed outcomes may diverge after changed physics/purchases.

| Launch / purchases | Wins before → after | Successful median minutes before → after | Successful median work shifts before → after |
|---|---:|---:|---:|
| 1 / original | 6/10 → 9/10 | 20.66 → 27.71 | 23 → 29 |
| 1 / cheapest | 8/10 → 9/10 | 31.12 → 22.39 | 26 → 14 |
| 6 / original | 4/10 → 8/10 | 16.47 → 16.15 | 21 → 20.5 |
| 6 / cheapest | 8/10 → 10/10 | 16.63 → 13.03 | 18.5 → 14.5 |

The changed effects increase sampled wins 26/40 → 36/40. The burst/cheapest variant wins 10/10 with a 13.03-minute median, so this candidate clearly does **not** establish the ~30-minute goal or desired uncertainty. Ten runs per variant cannot estimate a human win rate; medians compare different survivor sets. The slow original single-launch policy still needs a median 29 work shifts among wins, suggesting an uneven progression rather than uniformly quick play.

No price, work-income, needs or max-bet changes accompany this report. Next minimal balance task: test the max-bet/upgrade price progression against this repaired physical board and compare early work repetition with late snowballing. Do not weaken working upgrade effects to hide an economic problem. Dominant-policy search, mixed builds and human pacing remain open; old larger reports do not accept this new config.

Reproduce:

```sh
node --import tsx simulation/full-game/timingAudit.ts 10 /tmp/before 2 reports/physics/2026-10-05-specials/baseline-config.json
node --import tsx simulation/full-game/timingAudit.ts 10 /tmp/after 2
```

Model limitations: no rendering/loading/save latency, no offline time, no continuous replenishment of paid roots, unified menu clock carry rather than per-scene rounding. Work durations and decision delay are explicit assumptions. Income drawdown is not sampled inside shared bursts. Retained traces allow checking which purchases and shifts led to each outcome.
