# Late income and investment-policy check — 2026-10-08

## Decision

Reject both late-cap candidates as a solution to current pacing. Production balance is unchanged, SHA-256 `4864d56d75e4b319aaf5241fb9da4c325a31d589c5bdb194fc7697a0e14b6778`. The combined cap/price candidate adds about .59–.67 modeled minutes in paired fast holdout play and .90 ordinary minutes, while a route skipping Splitter V remains faster. A new independent ablation wins 16/16 without buying stake levels IV–VI, at 15.13 modeled fast minutes. T070/T071 remain OPEN; no candidate is promoted.

This narrows the next hypothesis: examine the middle stake ladder, not another small late-only nerf. The current 500→2,500→12,500→30,000 ₽ caps cost 500 / 1,800 / 7,000 ₽ for the three upgrades. The ablation demonstrates that those earlier caps can already support a fast winning route; it does not prove which replacement values are good. Preserve upgrade utility and multi-ball play, and measure purchase gaps/payback alongside completion time before changing production.

## Scope and candidates

Base main `ae090552338bdbb7d186aa01cbb7e770762f15a3`; audit additions are committed with this report. Previous rejected special-payout candidates are not used. Geometry, pin effects, pocket payouts, work, needs, Barry, insurance and paid capacity 2→3→4→6 remain intact.

| Late stake level | Current cap / price | Caps-only cap / price | Coupled cap / price |
|---|---|---|---|
| IV | 40,000 / 250,000 ₽ | 35,000 / 250,000 ₽ | 35,000 / 125,000 ₽ |
| V | 65,000 / 1,500,000 ₽ | 45,000 / 1,500,000 ₽ | 45,000 / 600,000 ₽ |
| VI | 100,000 / 6,000,000 ₽ | 60,000 / 6,000,000 ₽ | 60,000 / 2,571,429 ₽ |

Coupled also lowers six-place capacity price 1m→600k and prices of Amplifier/Return/Splitter tiers originally costing at least 1m by ×.6. Earlier prices/effects are unchanged. Stake prices scale with the change in incremental cap; the other selected late prices scale with the terminal cap ratio. This is an exploratory payback hypothesis, not proof that actual marginal income scales linearly.

Selection: eight matched full-game seeds, SHA256(`67147000:index`) first uint32, three configs × cheapest / income-path / income-path-insurance = 72 labeled runs. The coupled candidate was selected for independent checking because it addresses late purchase cost as well as income; caps-only has selection evidence only.

## Fresh full-game holdout

SHA256(`67148000:index`), 32 new seeds, five fast policies and two configs. Ordinary cheapest control uses the first 16 of those seeds. Winner medians condition on survival; matched deltas use only common winners.

| Policy / pace | Current wins | Coupled wins | Current median | Coupled median | Paired time added |
|---|---:|---:|---:|---:|---:|
| cheapest / fast | 32/32 | 32/32 | 11.11 min | 11.71 min | +.670 min |
| insurance-first / fast | 31/32 | 31/32 | 10.50 | 11.25 | +.633 |
| skip Splitter V / fast | 32/32 | 32/32 | 10.78 | 11.37 | +.643 |
| income-path / fast | 32/32 | 32/32 | 13.79 | 14.23 | +.597 |
| income-path-insurance / fast | 32/32 | 32/32 | 15.27 | 16.20 | +.591 |
| cheapest / ordinary | 16/16 | 16/16 | 16.74 | 17.79 | +.898 |

Group-median differences are not median paired differences. Median paired longest internal purchase-gap changes are zero in all six groups; first-million-to-finish additions are .51–.66 minutes. The fastest coupled income-path win is still 7.524 modeled minutes; a larger median does not mean every seed gets slower. Income-ranked policies do not beat cheapest in these samples and are not an optimal-policy claim.

## Independent late-stake ablation

After the main holdout, 16 fresh seeds SHA256(`67150000:index`) compare current-config cheapest to the same policy refusing max-bet purchases once level III is reached. This is a legal purchase policy, not altered physics or a removed upgrade track.

| Route | Wins | Median | Fastest |
|---|---:|---:|---:|
| cheapest | 16/16 | 11.057 min | 8.254 min |
| skip stake IV–VI | 16/16 | 15.128 min | 12.863 min |

Median matched slowdown +3.921 minutes. Even completely skipping the late stakes does not reach the ~30-minute target in this small bot sample. This is diagnostic evidence for an earlier income bottleneck, not acceptance of a 30,000 ₽ terminal cap.

Qualified full-game evidence: **456 labeled sessions / 56 distinct initial RNG seeds**. Configs and policies reuse seeds. Full-game paths can diverge after changed purchases and RNG consumption. No human difficulty or completion-rate claim.

## Investment estimator and its limits

`marginalIncome.ts` ranks purchases using paired isolated physical roots: sample mean net return / mean flight time × max bet × paid capacity. It measures boards on the production shared-world adapter and Phaser Matter fork. Probe roots use the level-zero 500 ₽ stake and no insurance. The multiplier-to-cap scaling ignores per-ball rounding at higher stakes.

The heuristic counts the cumulative price of every prerequisite when considering later levels in the same track, but executes only the next purchase. It rejects an investment whose estimated post-purchase finish time exceeds keeping the cash. Cap/capacity upgrades require sample mean gross return minus 1 to exceed 1.96 standard errors; this is a noisy ranking guard, not a reliable tail confidence interval. Income-path-insurance buys real insurance first, then uses the same income estimator. Analysis asserts that its winners actually bought level III insurance and that the no-insurance route did not buy it.

The proxy omits concurrent collisions/body limits, committed insurance, liquidity risk, needs, Barry, events and cross-track lookahead in ranking. The full-game runner still executes those actual rules. It is a bounded adversarial heuristic, not a global optimizer. A proxy-ranked policy losing or running slowly cannot by itself demonstrate a good balance.

128 probe seeds SHA256(`67146000:index`) are reused across boards/configs. **172,672 isolated physical executions** produced qualified ranking caches; there are 128 distinct probe seeds, not that many independent seeds. Holdout reused 443 premeasured boards after verifying physical config equivalence and exact agreement of overlapping measurements. Those copied entries are explicitly excluded from the new-execution count. Full-game holdout seeds are independent of selection; ranking probe seeds are reused, and ranking noise remains a limitation.

### Discarded diagnostic passes

The first estimator inherited the live clock. Crossing a core event checkpoint could consume RNG before physical spawn, invalidating a board-only cache. Its 120 labeled sessions are retained under `invalid-clock-probe/` in the archive and excluded from candidate evidence. The estimator now starts every probe from a fresh normalized state; a regression compares identical boards at different live times across separate caches. Aggregate measurements agree exactly across candidate configs after normalization.

Another 24 labeled sessions are retained under `invalid-insurance-label/`: the new insurance policy label initially fell through the no-insurance scoring branch and duplicated that route. The branch was fixed, those results excluded, and all three insurance selection groups rerun. Source snapshots distinguish the executed revisions. These simulation-tool errors did not change production gameplay or saves.

## Timing, verification and reproduction

Fast assumptions: .25 s decisions, courier 6 s including drawing/travel, trash 5 s, dishes 8 s. Ordinary: 2 s decisions, courier 12 s, trash 15 s, dishes 18 s. Paid launch spacing .25 s, deterministic 8% work failures. Real core time charges, needs, events, insurance, transactions and Barry interruptions execute. Render/load/save/navigation latency is omitted. Results are modeled active time, not human playtests.

430 tests / 74 files passed after probe normalization, including purchase-payback and clock-independent probe regressions. Project typecheck and strict audit-entrypoint typecheck passed. Production code/config is unchanged in this audit. The previous courier smoke repair and special-payout report were sent to main in `ae09055`; its CI and Pages build/deployment passed, with live verification tracked separately.

```sh
python simulation/full-game/incomeBatch.py 8 67147000 /tmp/income/selection control,caps-only,coupled cheapest,income-path,income-path-insurance
python simulation/full-game/incomeCacheBootstrap.py /tmp/income /tmp/income/holdout control,coupled
python simulation/full-game/incomeBatch.py 32 67148000 /tmp/income/holdout control,coupled cheapest,insurance-first,skip-splitter,income-path,income-path-insurance
python simulation/full-game/incomeBatch.py 16 67148000 /tmp/income/ordinary control,coupled cheapest ordinary
python simulation/full-game/incomeBatch.py 16 67150000 /tmp/income/ablation control cheapest,skip-late-stakes
python simulation/full-game/incomeSummary.py /tmp/income
```

For the bootstrap, place retained configs in `/tmp/income/configs/`; the batch consumes the repository config files. The archive contains all compressed traces, caches, exact source snapshots and a hash manifest. Repository retains configs, group summaries, analysis and CSV. Historical source snapshots reproduce earlier diagnostic/selection revisions; current source can produce new reruns but is not falsely claimed as the exact bytes executed by every historical group.
