# Balance diagnosis and rejected candidates — 2026-10-06

## Decision

**Do not promote a numeric balance candidate from this batch.** Six alternatives were actually tested. The independent check of the mild late-limit candidate failed its purpose: it added roughly 1.5–2 minutes to single-play winners but only 0.2–0.3 minutes to burst-play winners. More severe variants stretched single play toward 38–39 minutes. None establishes a better progression curve across the tested purchase orders. Runtime `balance.v0.json` remains unchanged.

The executable change is limited to a real Barry-payment debug trigger and immediate live scene refresh after debug commands. This is diagnostic support, not a claim that the balance task is complete. T070 remains open.

## Baseline and hypothesis

Base executable/main: `3e0df3631f47ec6c8e0607a9fcb9857bd8a1925c`. All candidates preserve current physics, Return routing, root limits, clock scale, need decay and Barry ladder. Six-root play can finish the final economy phase very quickly while the earlier purchase curve contains long gaps. Changing all prices uniformly would target both parts indiscriminately.

Existing 2026-10-06 implementation traces were inspected first; they were not rerun or misrepresented as new evidence. In those 10-seed burst groups, winning median time from first observed million to finish is 1.99–2.37 minutes. The new baseline selection reproduces 2.16–2.47 minutes, versus 7.29–8.52 for singles. Milestones observe cash at decision boundaries, not transient within-cascade winnings.

Canonical intent matters: GAME_DESIGN explicitly makes ordinary work a source of starting capital and comeback, and the upgraded machine the source of large-scale money. Late work becoming uncompetitive is not by itself a bug. The questionable feature is the compressed progression and loss of consequential decisions after the machine accelerates.

## Physical ablation

35 variants × 1,000 independent paid roots = 35,000 executions. Paired xorshift-stream root seeds, stream seed 67113000, exact production shared-world adapter. No unresolved root reached the 3,600-tick limit. Gross return includes stake; these are sample means with potentially heavy tails. Full standard errors, loss shares and individual samples are retained in `ablation/`.

| Board | Mean gross return |
|---|---:|
| maximum | 32.457× |
| maximum-without-center | 32.325× |
| maximum-without-mid | 31.763× |
| maximum-without-jackpot | 5.762× |
| maximum-without-amplifier | 20.837× |
| maximum-without-return | 9.668× |
| maximum-without-splitter | 28.300× |
| maximum-without-jackpotBias | 21.820× |

Removing a track changes interactions too: these differences must not be added as independent contributions. The high-value edge payouts, Return, guides and Amplifier act together; Splitter alone is not the only driver. The sample does not substantiate the claim that Return almost always sends a ball to an edge. The maximum board's edge-root share is 19.3%, and any-edge occurrence is not identical to edge occurrence conditional on a Return.

## Candidate selection

Six seeds per launch/order, seeds 67114000–67114005. All values are modeled successful-run median minutes, with winning count in parentheses. These runs select/reject hypotheses; no confidence claim from six seeds.

| Candidate | Single/original | Single/cheapest | Six/original | Six/cheapest |
|---|---:|---:|---:|---:|
| baseline | 34.4 (6/6) | 33.9 (6/6) | 16.0 (6/6) | 16.8 (6/6) |
| jackpot | 36.6 (5/6) | 36.5 (6/6) | 17.6 (6/6) | 16.5 (6/6) |
| limits | 35.0 (6/6) | 34.3 (6/6) | 17.2 (6/6) | 16.2 (6/6) |
| late-jackpot | 32.2 (6/6) | 32.4 (6/6) | 17.1 (6/6) | 15.1 (6/6) |
| strong-limits | 39.1 (6/6) | 38.2 (6/6) | 17.7 (6/6) | 17.6 (6/6) |
| combined | 38.0 (6/6) | 38.9 (6/6) | 18.1 (6/6) | 17.1 (6/6) |
| redistributed | 34.6 (6/6) | 37.8 (6/6) | 20.5 (6/6) | 15.2 (6/6) |

Exact JSON configs are retained:
- `lower-jackpot`: edge upgrade II/III payouts 50/100 → 35/50. Other values unchanged.
- `smoother-limits`: late caps 60k/120k/240k → 45k/75k/120k; prices 250k/1.5m/6m → 100k/500k/2m.
- `late-jackpot`: edge II/III prices 50k/500k → 150k/3m; payouts unchanged.
- `strong-limits`: late caps 40k/50k/75k at the same 100k/500k/2m candidate prices.
- `combined`: late-jackpot plus strong-limits.
- `redistributed`: combined plus halved 30k–700k prices in mid pockets, Amplifier, Return, Splitter and guides. This exploratory family was created after rejecting the earlier screens. It does not justify a general discount rule.

The reduced payouts did not reliably improve burst pacing. Delayed jackpot purchases rearranged policy decisions and could even shorten successful runs. Stronger limit reductions lengthened slow play; middle discounts remained purchase-order-sensitive. No candidate is accepted solely because its total duration got larger.

## Independent mild-limit comparison

20 seeds per launch/order, seeds 67115000–67115019: 80 runs each for baseline and smoother-limits. Candidate chosen before these seeds. Winner medians in the summaries condition on survival; `paired-holdout.json` instead joins seed/launch/order and reports differences among common winners:

| Launch/order | Common wins | Added total minutes | Added million-to-finish minutes | Change in longest internal purchase gap |
|---|---:|---:|---:|---:|
| 1/original | 20 | +2.09 | +1.62 | +0.00 |
| 1/cheapest | 20 | +1.47 | +1.25 | +0.00 |
| 6/original | 17 | +0.21 | +0.04 | +0.00 |
| 6/cheapest | 20 | +0.34 | +0.19 | +0.00 |

This is a negative result. It does not establish that all numerical balance changes are impossible, or that concurrency must be removed.

## Casino-first diagnostics and limits

Two new opt-in policies use real continuous sessions, with the same 20 seeds and two order labels:
- `casino-first` replaces work/wait with a full bet whenever cash exists, but retains reserve-based purchase decisions. Baseline and smoother-limits both lose all 40 labeled runs to Barry. This intentionally aggressive policy is not a realistic best strategy and retains an investment reserve inconsistent with its spending behavior.
- `casino-invest` additionally buys the cheapest legal upgrade when 125 ₽ remains, without a Barry reserve. Both configs produce 34 Barry losses and 6 HP deaths across the 40 labeled runs. The two order labels repeat the same trajectories under this override: **20 distinct seeds/paths per config**, not 40 independent observations. This policy uses full bets, and cheap limit purchases may still strand its bankroll.

These diagnostics do not reproduce the user's successful casino-first run and cannot refute it. Better investment/fraction choices, rare favorable starts and the actual playtest save remain unmodeled. The fresh initial state is used throughout; no claim about the user's exact starting save is made. Do not use these loss rates to conclude that casino-first play is balanced.

Across the new full-game folders there are 488 labeled modeled sessions (including duplicate casino-invest order paths), plus the 35,000 physical roots. Timing assumes 2 s decisions, 30 s courier, full dish/trash timers and no render/save/loading latency. Candidate pacing is not measured human play. Seeds are reused between configurations for paired comparison; these are not 488 independent initial seeds. Changed decisions diverge subsequent RNG consumption.

## Barry and debug verification

The core checks `cash < due` after all paid roots settle. A pending payout can legitimately rescue a player who was below the payment before settlement. Casino `showPaid` is a receipt after a successful debit; its button continues rather than charging again. Ordinary due overlays still resolve the real payment on click.

Added regressions settle six paid roots, round-trip the remaining root through save parsing, then test final funds 2,999 / 3,000 / 3,001 ₽ against a 3,000 ₽ payment. The first loses; the others pay exactly once, leave 0 / 1 ₽, and do not reduce principal. The debug Barry command neither grants cash nor advances time, and uses the same payment rule. Existing tests cover payout-funded rescue, insufficient final payout and boundary ordering.

The debug panel adds “Вызвать платёж Барри” on the map. It marks the current payment due through the real core; this is deliberately a test-only trigger, not a simulated next day. It rejects finished runs and overlapping events. Debug edits now render the active scene instead of queuing a restart while the game loop is paused.

403 unit tests and the Pages build passed. The expanded browser test adds 2,499 ₽ to the fresh 500 ₽ save, triggers Barry, closes the debug panel and pays without any page reload; it must end in BARRY_PAYMENT_FAILED. The full local Pages browser suite passed for both mouse and touch, including this new scenario.

## Reproduction / provenance

```sh
node --import tsx simulation/full-game/upgradeAudit.ts 1000 reports/pacing/recheck-ablation 67113000
node --import tsx simulation/full-game/timingAudit.ts 6 /tmp/selection 2 reports/pacing/2026-10-06-balance/combined.json 67114000 BASELINE_GROWTH burst
node --import tsx simulation/full-game/timingAudit.ts 20 /tmp/holdout 2 reports/pacing/2026-10-06-balance/smoother-limits.json 67115000 BASELINE_GROWTH burst
node --import tsx simulation/full-game/timingAudit.ts 20 /tmp/invest 2 reports/pacing/2026-10-06-balance/baseline.json 67115000 BASELINE_GROWTH continuous-spend 1 casino-invest
node --import tsx simulation/full-game/economyStages.ts /tmp/holdout/runs.json.gz /tmp/holdout/stages.json
```

For ablation reproduction use the unchanged baseline runtime config. Timing reports contain full compressed traces, config hashes, source base revision, launch policy and assumptions. The base revision predates the opt-in policy extensions committed alongside this report. Selection baseline/jackpot/mild-limits ran before `approach` metadata existed and use the unchanged reserve policy; missing approach means reserve. Source and artifact hashes are recorded in `manifest.json`.

## Next balance decision

Do not repeat a blanket price/cap sweep. A useful next experiment must target progression quality: early/middle purchase gaps, concentration of total rewards in upgraded edges, and the payback of each next upgrade under concurrent play. It needs a policy that deliberately seeks high payback, not just the fixed and cheapest orders tested here. Preserve purchased effects and test adjacent upgrade usefulness before touching the Return route again. The user's actual purchase sequence/save would discriminate the successful three-day route from the losing casino-first diagnostic policies. Final balance acceptance remains OPEN.
