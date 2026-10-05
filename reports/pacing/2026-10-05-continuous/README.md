# T070: continuous paid launches and purchase gaps, 2026-10-05

**Decision: retain the published economy.** Neither price candidate reliably improves the longest purchase gaps. No production config, physics, controls or saves change in this follow-up. This adds diagnostic policies, purchase-gap analysis and regression coverage; it does not add player autofire.

Unchanged runtime raw-config SHA-256: `53c9ab00f72eecf71f379edab8938f7dc3d522fa3a28b4b05c292fd752f1afdc`. Published economy executable at audit start: `a225fc3295dc5c4801b9b85ddb624d5945121d20`; main documentation HEAD `b25d12dfc666085adf43b32b403008052b3b2fc5`, local identical-tree HEAD `2b9df8ed71c31b2c8439455373043229511e942b`. Runs use this base plus the diagnostic source changes committed with this report.

## What was missing

The previous model launched up to six roots and waited for the entire board to empty. Real players may use a freed slot while other paid roots remain. The new session driver uses the same Phaser shared-world adapter, six-root/24-ball limits, individual stake debit and settlement, deterministic clock and Barry interruption. Every 15 ticks (0.25 s) it attempts another legal click. It stops adding roots when the policy wants recovery, an event choice, a purchase or victory, then drains ALL paid roots before returning control to the full-game runner.

Two diagnostic behaviors:
- `continuous`: preserve the policy's cash reserve; also drain when the policy would work/wait.
- `continuous-spend`: keep the originally selected fraction and spend incoming cash within the session, ignoring work/wait intentions. Recovery/purchase/event/victory still stop new roots. Zero cash/capacity refusals are retried while paid roots remain. This tests a riskier clicking style, not an AGGRESSIVE archetype.

Baseline `burst` stays unchanged: one or six roots then drain, without rechecking reserve within the six-root burst. Thus comparisons include decision/reserve behavior, not only throughput. Both orders use BASELINE_GROWTH + liquidity-v1; original upgrade order excludes Splitter, cheapest includes it. The policy's 0.25-second intention checks are assumed, not measured human reaction. This is not a proof of optimal play or worst-case exploits.

## Experiments / provenance

760 new full-game runs:
1. 160 selection runs, seeds 67111000–67111009: current config burst (40), reserve-aware continuous (20), spend continuous (20), mid-only price candidate burst (40), broader middle-price candidate burst (40).
2. 480 independent candidate comparisons, seeds 67112000–67112029: current vs mid-only candidate, each 120 burst + 60 continuous + 60 continuous-spend. Candidate chosen before these seeds; rejected after comparison.
3. 120 subsequent policy-sensitivity runs on those same 30 seeds: unchanged runtime config, defer raising the cap until cash after purchase covers the reserve plus four minimum bets instead of one. This is an exploratory policy comparison, NOT an independent holdout for that policy or a player rule.

Exact configs retained:
- `baseline-config.json`: current runtime.
- `mid-bridge-config.json`: mid pockets III 300,000 → 150,000 only.
- `middle-bridge-config.json`: additionally Return II 150,000 → 100,000; Amplifier III 300,000 → 200,000; Splitter III 700,000 → 450,000. Rejected at selection; not promoted to holdout.

Every run directory retains summary.json, compressed full traces and stages.json. `initial` is the reserve-aware continuous selection run; its early policy label is timing-v2 and diagnostics name sampled peaks maxRoots/maxBalls. Later labels are timing-v3 and sampledMaxRoots/sampledMaxBalls. These naming changes did not alter trajectories. Absence of maxBetReserveBets in early metadata means default 1. Diagnostic peaks are sampled every 15 ticks, not guaranteed all-tick maxima.

## Current-config independent results

All counts out of 30. Times are winner medians in simulated active-time equivalents.

| Launch behavior | Order | Wins | Minutes | Longest internal purchase gap, minutes |
|---|---|---:|---:|---:|
| Single | Original | 29 | 34.07 | 7.54 |
| Single | Cheapest | 29 | 28.67 | 4.53 |
| Six then drain | Original | 27 | 17.67 | 4.92 |
| Six then drain | Cheapest | 30 | 16.26 | 3.38 |
| Continuous, reserve | Original | 25 | 21.23 | 4.58 |
| Continuous, reserve | Cheapest | 28 | 21.98 | 4.95 |
| Continuous, spend | Original | 17 | 15.87 | 3.09 |
| Continuous, spend | Cheapest | 22 | 14.48 | 2.70 |

Continuous replenishment really occurred: reserve variants launched 1,500 roots beyond the first six in each session in total; spend variants 7,825. A spend session reached 43 paid roots over its lifetime, never 43 concurrent roots. Capacity remains six. Repeated replenishment can delay access to purchases/recovery; the measured policies stop to drain when those intentions appear.

Spend behavior is faster among winners but loses more often. It is not a universally better strategy on this sample. Fastest observed winner was 9.08 minutes (spend/cheapest); reserve/cheapest had one 9.31-minute win. Each had one winner below ten minutes. No winner below five minutes was observed here, but this is neither a guaranteed minimum nor a search of all strategies. About-30-minute human pacing remains unaccepted.

## Why the price change was rejected

For mid-only candidate vs current, median paired change in the longest internal purchase gap is **zero in all eight variants**, restricting to seeds winning in both versions. Individual paths change, but no general improvement is established. Single/original overall winner median appears to fall 34.07 → 32.33 minutes, while wins fall 29 → 27; among common winners the paired median actually increases 0.99 minutes. Do not select a candidate from the first number alone. All paired metrics are in paired-holdout.json.

Some large gaps end at mid III, but that does not establish its price as their sole cause. A large payout may already buy several upgrades at once; lowering one price can leave the longest gap unchanged or move it elsewhere. Broader discounts were no clear improvement on selection either. Both candidate configs remain report artifacts only.

## Policy sensitivity / work loops

Requiring a four-minimum-bet bankroll before buying a higher cap reduced common-winner work medians by 4–6.5 shifts. Its timing effect varies:
- single/original: paired +3.70 minutes, longest gap −0.26;
- single/cheapest: +8.07 minutes, longest gap +1.85;
- six/original: −1.60 minutes, longest gap −1.53;
- six/cheapest: −0.92 minutes, longest gap −0.14.

Winner counts old→buffer4: 29→27 / 29→30 / 27→27 / 30→26. Fewer work shifts alone is not better pacing. This confirms policy sensitivity and supports rejecting a blanket price/cap intervention based only on work counts. Default liquidity-v1 is preserved; buffer4 is an explicit diagnostic argument.

## Limits and next decision

Same initial seeds are paired, but downstream RNG consumption diverges when decisions change. Winner medians condition on survival. Purchase milestones observe decision-boundary cash; internal gaps exclude waiting before the first and after the final purchase. actionSeconds attributes time until the next decision (including that decision's assumed delay) to the preceding action. The next-purchase level is reconstructed from the fresh-run trace.

Physics follows the previously verified fixed-tick adapter. This turn does not independently establish browser parity for every continuous trajectory. Decision delay (2 s), courier duration (30 s), full configured dishes/trash timers, unified menu clock carry, no rendering/loading/save latency and no offline progress remain model assumptions. No human sessions were recorded. Gameplay still allows clicking, not automatic launching.

T070 now covers two continuous policies. Optimal launch spacing, mixed fractions and better purchase order remain unexplored. The next product decision should distinguish an acceptable fast/risky route from the desired ordinary-play pace; blindly stretching every strategy toward 30 minutes risks making singles tedious. Do not weaken purchased effects, add artificial cooldowns or invent new mechanics from these results. Long purchase droughts remain a real pacing concern, with no validated numeric fix from this batch.

## Reproduction and validation

```sh
node --import tsx simulation/full-game/timingAudit.ts 30 reports/pacing/recheck 2 reports/pacing/2026-10-05-continuous/baseline-config.json 67112000 BASELINE_GROWTH continuous-spend
node --import tsx simulation/full-game/economyStages.ts reports/pacing/recheck/runs.json.gz reports/pacing/recheck/stages.json
```

Replace mode with burst / continuous, or config with mid-bridge-config.json. Selection uses 10 and seed 67111000. Buffer sensitivity uses burst and final argument 4. Paired analysis joins (batch, order, seed), keeps common victories, and takes median(candidate field − baseline field), not difference of group medians.

Local: 388 tests pass; strict TypeScript audit-entrypoint check and Pages build pass. Added tests require twelve paid roots to reuse six slots, drain before purchase without buying, preserve exact cash accounting, and stop at recovery; a policy test checks default behavior and explicit bankroll deferral. Production balance.v0.json remains byte-identical to baseline-config.json.
