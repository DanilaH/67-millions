# Adversarial balance audit — 2026-10-08

Production config and gameplay unchanged. T070 diagnosis of the shipped candidate, not a new price sweep or a final difficulty claim.

## Evidence

- Production base: `8ca5148f594cf3008888efb53819a6af613e7f0e`.
- Exact raw-config SHA-256: `4864d56d75e4b319aaf5241fb9da4c325a31d589c5bdb194fc7697a0e14b6778`.
- 404 labeled runs on 76 distinct starting RNG seeds. Selection: 12 SHA256-derived seeds from stream label 67141000, reused across 15 groups (180 runs). Holdout: 64 fresh SHA256-derived seeds from label 67142000, three fast policies (192 runs); ordinary timing uses the first 32 of those seeds (32 runs).
- Shared production board resolver, pinned Phaser Matter fork, real core settlement/insurance, and actual `purchaseCapacityUpgrade`. Starting capacity 2; durable paid 3/4/6 upgrades at 5k/25k/1m. Current 40k/65k/100k late caps.
- The previous timing audit did not expose production capacity purchase and excluded insurance from the all-upgrades policy. This audit adds a production capacity decision to the simulator and preserves the older diagnostic hook for historical reproducibility. No runtime UI or balance changes.
- Exact executed source snapshots are `audit-v1.source.txt` and `audit-v2.source.txt`; their hashes are recorded per group. The current runner differs only by explicit TypeScript result typing from v2. The runner purchase fix is included in this commit.

## Results

These are bot outcomes with modeled timing, not human win probabilities. Selection was used to choose holdout comparisons. “Fast” assumes 0.25s per decision and 6/5/8s courier/trash/dishes; “ordinary” assumes 2s and 12/15/18s. Both allow a paid launch every 0.25s, retain all real game-minute costs, events, needs, Barry and explicit principal payment. Work failure is 8% for the override policies; Worker retains its original 7%. Draw/navigation/load/save delays are not measured. Food/sleep time jumps match the core and map action handlers. A winning run never implies every policy or every seed wins.

| Group | Victories | Median winning minutes | Fastest winning minutes |
|---|---:|---:|---:|
| holdout/cheapest-continuous-fast | 64/64 | 11.02 | 7.44 |
| holdout/cheapest-continuous-ordinary | 32/32 | 16.73 | 11.11 |
| holdout/insurance-first-continuous-fast | 63/64 | 11.56 | 6.51 |
| holdout/skip-splitter-continuous-fast | 64/64 | 10.70 | 7.32 |
| selection/casino-only-continuous-fast | 0/12 | — | — |
| selection/cheapest-burst-fast | 12/12 | 10.83 | 7.71 |
| selection/cheapest-continuous-fast | 12/12 | 10.36 | 7.50 |
| selection/cheapest-continuous-ordinary | 12/12 | 16.57 | 11.11 |
| selection/hoard-12-continuous-fast | 0/12 | — | — |
| selection/ignore-needs-continuous-fast | 0/12 | — | — |
| selection/insurance-cycle-continuous-fast | 12/12 | 18.55 | 16.15 |
| selection/insurance-cycle-continuous-ordinary | 12/12 | 25.27 | 21.85 |
| selection/insurance-first-continuous-fast | 12/12 | 10.74 | 7.70 |
| selection/skip-finals-continuous-fast | 12/12 | 10.41 | 7.14 |
| selection/skip-splitter-continuous-fast | 12/12 | 9.89 | 7.27 |
| selection/specials-first-continuous-fast | 12/12 | 11.37 | 9.17 |
| selection/stake-first-continuous-fast | 12/12 | 11.62 | 8.37 |
| selection/thin-reserve-continuous-fast | 12/12 | 11.39 | 8.34 |
| selection/worker-continuous-fast | 0/12 | — | — |

## Findings

1. **Reliable reserve-preserving growth is substantially faster than the 30-minute hypothesis.** Fresh holdout cheapest policy wins 64/64, median 11.02 minutes, P10/P90 9.15/14.44. Ordinary timing wins 32/32, median 16.73 minutes, P10/P90 13.94/20.35. This demonstrates a strong bot strategy on tested seeds; it does not establish population certainty or optimal play.
2. **Late income growth is the primary candidate for another calibration.** Cheapest fast holdout reaches its first observed 1m at median 7.27 minutes; the paired remaining interval is median 3.48 minutes. Its max Splitter/Return/Amplifier purchases leave only 1.11/1.75/1.48 minutes before victory. The representative fastest insurance-first seed 3673683627 pays principal at 6.5086 minutes with full health. After buying Splitter V it grows from 16.56m to 67.16m in 38.05 modeled seconds. That is a concrete trace, not an average revenue rate.
3. **Skipping Splitter V is a small shortcut.** All 64 holdout runs still win. Paired median change is −0.3243 minutes (about 19s). Median victory 10.70 minutes. This suggests weak practical incentive for the 18m final purchase at the end of this particular run; it is not proof that every seed or purchase order makes it useless. Skipping all last special tiers did not materially improve the small selection.
4. **Insurance is not a dominant exploit in tested comparisons.** Insurance-first wins 63/64 versus cheapest 64/64; among 63 common winners its paired median delay is +0.1331 minutes. Small unarmed bets followed by larger armed bets are slower: selection median 18.55 fast / 25.27 ordinary minutes. The floor protects an armed drop, not every launch. Retain the losing seed 3995471384: a failed courier shift empties cash, a free recovery action brings the clock near Barry, and the next shift is interrupted before payment. The core correctly ends the run.
5. **Needs and comeback work still matter.** Worker-only, casino-only without earning starting capital, and no-needs-care each lose all 12 selection runs. No-care loses five to HP and seven to Barry. Cheapest holdout winners take median ten work shifts. The strongest policy actively eats/sleeps and keeps Barry reserves; its reliability should not be attributed to ignoring pressure.
6. **Do not inflate all shop prices as the immediate response.** The problem is a profitable middle/late build with bounded stakes and multiple simultaneous roots. A minimal next numerical comparison should reduce late compound payout growth while keeping early board improvements useful, and assess both timing and loss rates on the same independent seed cohort. Do not replace the multi-ball game with a one-ball restriction. No candidate was promoted here.

## Reproduction

```sh
python3 simulation/full-game/adversarialBatch.py 12 67141000 reports/pacing/2026-10-08-adversarial/selection
python3 simulation/full-game/adversarialBatch.py 12 67141000 reports/pacing/2026-10-08-adversarial/selection skip-finals skip-splitter thin-reserve
python3 simulation/full-game/adversarialBatch.py 64 67142000 reports/pacing/2026-10-08-adversarial/holdout cheapest skip-splitter insurance-first
node --import tsx simulation/full-game/adversarialAudit.ts cheapest 32 67142000 reports/pacing/2026-10-08-adversarial/holdout/cheapest-continuous-ordinary continuous ordinary
python3 simulation/full-game/adversarialSummary.py
```

`runs.csv` records every labeled result; `analysis.json` includes cohort summaries and paired deltas. Group `summary.json` files contain executed source hashes and assumptions. Full compressed traces/logs are retained in the downloadable evidence pack; `fastest-replay.json` and `insurance-loss-replay.json` are included directly here. The first four pilot runs are exploratory and excluded from all counts above.

427 tests pass, including new simulator tests for the real capacity debit/level and unaffordable purchase. Project and audit strict TypeScript checks pass. No new production config, physics or prices were edited; no new human playtest was possible. No exhaustive search of upgrade orders, fractional stake choices or event policies is claimed.
