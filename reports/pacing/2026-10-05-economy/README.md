# T070: late economy calibration, 2026-10-05

Selected `balanced-investment`, a tunable playtest candidate, not RC acceptance.
Runtime config SHA-256: `53c9ab00f72eecf71f379edab8938f7dc3d522fa3a28b4b05c292fd752f1afdc`.
Baseline SHA-256: `bd8928de31c8bcf5392b8a3861cfd193920088a6cd36ba2f73628a6020f4e589`.
Both exact configs are retained. The legacy `meta.version` and historical `balanceEvidence` text are unchanged; use the raw file hash, not that label, to identify this candidate.

## Change

Max bets become 500 / 2,500 / 12,500 / 30,000 / 60,000 / 120,000 / 240,000.
Upgrade prices become 0 / 500 / 1,800 / 7,000 / 250,000 / 1,500,000 / 6,000,000.
The old final cap was 7,812,500: this is a substantial late-stake reduction.
Mid, jackpot, amplifier, return, splitter and guide prices at levels 2/3/4/5 multiply by 2/4/8/12 relative to baseline. Level-one prices, center, Insurance, work, needs, events, physics and all upgrade effects stay identical. The price schedule is an empirical candidate, not a claim that each upgrade has identical marginal value.
Existing purchased levels survive. A paid pending drop retains its original stake and exact settlement; the next paid launch uses the new cap. There is no cash reset or refund migration.

## Method and selection

Fixed-tick shared-world Phaser adapter; production config parser, liquidity-v1 policy, nominal 60 Hz. Source base local `4a212de8bc898358c32599a3c59af96d88b07e2e` / remote `f1d2852c3d4f9d576bb6bbb429350518749fc1ea` (identical trees), plus `timingAudit.ts` seed/archetype arguments and `economyStages.ts` committed with this report. No production rule changes in the harness.

Seven candidates × four policies × ten seeds = 280 selection runs, seeds 67104000–67104009. Each has an exact `*-config.json`, summary, compressed full traces and stage analysis. Comparisons used the prior baseline 40 traces in `../2026-10-05-fixed-tick/runs.json.gz`.

- `late-prices`: higher late cap prices alone; final tiers still bought almost together.
- `smooth-cap`: smoother caps alone; cheapest burst policy became faster.
- `late-both`: moderate caps plus late prices; final tiers still bought almost together.
- `paced-caps`: lower late caps alone; cheapest burst endgame remained about a minute.
- `investment`: higher late board prices alone; large cap jump remained.
- `paced-investment`: board prices plus lower caps; better, but late limit prices remained cheap.
- `balanced-investment`: adds investment-sized late limit prices; chosen before new-seed runs.

Independent holdout: seeds 67109000–67109049, 50 per policy × four policies × two configs = 400 growth-policy runs. Stress comparison: seeds 67109000–67109019, 20 per policy × four policies × two configs = 160 AGGRESSIVE runs. No retuning after holdout. Total new full games: 840.

The four policies cross single-root / six-root bursts with original / cheapest affordable board purchase order. Bursts launch every 0.25 seconds, then drain; they do NOT continuously refill. Original order never purchases Splitter; cheapest order also considers Splitter and Insurance. These are limited scripted policies, not an exhaustive optimal strategy search.

## Independent growth-policy results

Medians condition on victory; minutes are simulated active-time equivalents.

| Policy | Wins old → new (of 50) | Total minutes old → new | First million → victory old → new | Work shifts old → new |
|---|---:|---:|---:|---:|
| Single, original | 45 → 46 | 24.75 → 31.58 | 1.38 → 7.47 | 25 → 23 |
| Single, cheapest | 48 → 48 | 21.05 → 27.33 | 1.21 → 6.40 | 17 → 17 |
| Six, original | 45 → 45 | 15.82 → 17.30 | 0.78 → 2.44 | 19 → 19 |
| Six, cheapest | 48 → 48 | 14.19 → 14.78 | 0.76 → 2.25 | 15.5 → 14.5 |

First board purchase stays 1.10 minutes in all four growth variants. Last two cap purchases, among winners buying both, were separated by 2 seconds in baseline medians; candidate medians are 91 / 91 / 33 / 36 seconds. Denominators are retained in stages.json (baseline not every winner needed the final tier).

Survivor sets differ: see `paired-holdout.json`. For common winners, median paired duration changes are +6.01 / +5.89 / +1.90 / +1.25 minutes; work changes −2 / −1 / 0 / 0 shifts. Median paired time-to-100k difference is zero in all four variants. This is a same-initial-seed comparison, not identical downstream RNG consumption after decisions diverge.

Longest gap without a board purchase remains a weakness: candidate winner medians 6.51 / 4.95 / 4.02 / 3.26 minutes. This metric includes the final gap after the last purchase. Common-winner median gap increases are 0.65 / 0.55 / 0.09 / 0.04 minutes. The candidate improves late staging, but does not prove satisfying moment-to-moment pacing.

AGGRESSIVE stress: original order wins 0→0 (single) and 0→1 (six) of 20; cheapest wins 8→10 and 8→11. This is mostly a poor policy, not evidence about human win probability. Cheapest successful medians are 23.28→22.00 and 15.17→18.82 minutes; do not infer causal timing from those different survivor groups. Full outcomes and traces are retained.

## Limits and next gate

Decision delay is assumed 2 seconds; courier duration 30 seconds; dishes/trash use their full configured timers. No loading/render/save latency or offline progression is modeled. Menu clock carry is unified rather than per scene. Cash milestones are observed at decision boundaries, not transient within-burst balances. These results are not human playtest times or an accepted win-rate target.

Six-root play remains roughly 15–17 minutes and continuous replenishment is untested. Do not claim the ~30-minute product gate is closed. Next smallest balance investigation: continuous paid-launch policy and the long early purchase gaps, before another blanket price increase or new mechanics. Actual human pacing remains T071.

## Reproduction

```sh
node --import tsx simulation/full-game/timingAudit.ts 50 reports/pacing/recheck-old 2 reports/pacing/2026-10-05-economy/baseline-config.json 67109000 BASELINE_GROWTH
node --import tsx simulation/full-game/timingAudit.ts 50 reports/pacing/recheck-new 2 reports/pacing/2026-10-05-economy/balanced-investment-config.json 67109000 BASELINE_GROWTH
node --import tsx simulation/full-game/economyStages.ts reports/pacing/recheck-new/runs.json.gz reports/pacing/recheck-new/stages.json
```

Use count 20 and archetype AGGRESSIVE for stress. Selection uses count 10 and seed 67104000 with each archived config. Tests include a previous-cap paid-drop reload that compares complete state and settlement then checks the next stake against the new cap. The reserve-safe policy unit expectation intentionally changes from 25% of 62,500 to 50% of 30,000: its invariant is still choosing the largest safe quick bet.

Local validation: all 385 tests pass; Pages build and strict audit-entrypoint typecheck pass. Deployment status is recorded after the workflow completes.
