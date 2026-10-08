# Special-payout calibration — 2026-10-08

## Decision

Reject the tested payout candidates. Production `balance.v0.json` is unchanged, SHA-256 `4864d56d75e4b319aaf5241fb9da4c325a31d589c5bdb194fc7697a0e14b6778`. T070 remains open. The reduction adds less than half a minute in paired successful continuous play and worsens the payback of expensive final upgrades. These experiments do not establish a 30-minute or challenging human run.

The executable change repairs the outdated courier route in `tools/playtest-smoke.mjs`. Actions run [37783889340](https://github.com/DanilaH/67-millions/actions/runs/37783889340) passed tests/build but timed out at courier line 192, blocking Pages. Its hardcoded bottom route crosses the buildings added in `8ca5148`. The test now uses the existing street-route fixture helper and current saved session seed, retaining cancellation, release-before-start and successful payment assertions. No minigame rule or assertion threshold changes.

## Candidates and selection

All candidates preserve prices, stake ladder, paid capacity 2→3→4→6, geometry, Return routing, pockets, insurance, needs and work rules. The first special upgrade is unchanged. Control equals the parsed production config, with JSON reserialization only; its raw hash differs from production.

| Track | Current ladder | Candidate ladder |
|---|---|---|
| Amplifier multiplier | 1.25 / 1.25 / 1.40 / 1.40 / 1.60 | 1.25 / 1.25 / 1.32 / 1.32 / 1.42 |
| Splitter value per child | .70 / .75 / .80 / .85 / .90 | .70 / .725 / .75 / .775 / .80 |

`amplifier` changes only Amplifier; `splitter` only Splitter; `combined` both. Amplifier pin counts stay 1/2/2/3/3, so levels with equal multipliers still add a pin.

Selection: eight matched initial seeds per candidate/policy, SHA256(`67143000:index`) first uint32, cheapest and insurance-first policies. 4×2×8 = 64 labeled runs, eight distinct seeds. Cheapest successful medians: control 10.98, Amplifier 11.37, Splitter 10.95, combined 11.55 modeled minutes. Insurance-first: 13.39, 13.20, 13.15, 13.18. Combined was selected before running independent holdout seeds; individual candidates have selection evidence only.

## Fresh holdout

32 new seeds per configuration/policy, SHA256(`67144000:index`), four purchase policies. Ordinary control uses the first 16 of those seeds. Successful modeled medians:

| Policy / pace | Current | Combined | Common wins | Median paired time added |
|---|---:|---:|---:|---:|
| cheapest / fast | 11.15 min | 11.38 min | 32/32 | +0.421 min |
| insurance-first / fast | 11.18 | 11.54 | 32/32 | +0.254 |
| skip Splitter V / fast | 10.72 | 10.92 | 32/32 | +0.366 |
| specials-first / fast | 11.73 | 11.91 | 32/32 | +0.390 |
| cheapest / ordinary | 17.81 | 18.47 | 16/16 | +0.393 |

Difference of group medians is not the median of matched differences. Every holdout/ordinary run wins; the fastest combined skip-Splitter win still takes 7.193 modeled minutes. First-million-to-finish paired additions are .29–.38 minutes. Median paired changes in longest internal purchase gap are zero in each group. Expensive final Splitter remains dispensable in the tested policies.

Total full-game work: **352 labeled sessions / 40 distinct initial seeds**. Seeds are reused between candidates and policies. Full-game paths diverge after changed purchases and RNG consumption.

## Physical check

2,000 matched independent root seeds per board/config, SHA256(`67145000:index`); six board states × two configs = **24,000 physical executions / 2,000 distinct seeds**. All roots settle before 3,600 ticks. Production shared-world adapter uses Phaser's Matter fork and actual core settlement, without insurance, at the actual level-zero 500 ₽ stake. Gross return includes the stake. Sample means have heavy tails; standard errors and individual samples are retained.

| Board | Current mean gross | Combined mean gross |
|---|---:|---:|
| bare | .869125× | .869125× |
| all first upgrades | 1.562879× | 1.562879× |
| middle (C2/M2/E2/A3/R2/S3/G2) | 3.741994× | 3.505706× |
| maximum | 13.161943× | 11.468065× |
| maximum, Amplifier IV | 11.704733× | 10.754917× |
| maximum, Splitter IV | 12.956062× | 11.374038× |

Every paired root retains identical pocket counts and resolution tick. Bare/first-level payouts match exactly. Maximum income falls about 12.9%, but final Amplifier's sampled marginal gross benefit shrinks from 1.45721× to .713148×, and Splitter's from .205881× to .094027×, while prices stay 9m / 18m. Shipping a weak tempo gain would make those purchases harder to justify. Adjacent maximum levels still improve sampled payouts; this is not a complete all-level payback gate.

## Model and reproduction

Base revision `7e55b4a7029dc1253e4329abf59c8e994eaa61fa`, plus audit entrypoints committed with this report. Exact config/source hashes are in summaries and `manifest.json`. Audit runner adds an optional config-path argument; default still consumes production config. Real core purchases, capacity limits and committed insurance are reused.

Fast timing: .25 s decisions, courier 6 s including drawing/travel, trash 5 s, dishes 8 s. Ordinary: 2 s decisions, courier 12 s, trash 15 s, dishes 18 s. Launch spacing .25 s, deterministic 8% work failures. Actual game-minute charges, Barry interruptions, needs and events remain active. These are bots with assumed input times; loading, rendering, navigation and save latency are not modeled. No claim about human completion rates.

```sh
python simulation/full-game/specialPayoutBatch.py 8 67143000 /tmp/special-payouts/selection control,amplifier,splitter,combined cheapest,insurance-first
python simulation/full-game/specialPayoutBatch.py 32 67144000 /tmp/special-payouts/holdout control,combined cheapest,insurance-first,skip-splitter,specials-first
python simulation/full-game/specialPayoutBatch.py 16 67144000 /tmp/special-payouts/ordinary control,combined cheapest ordinary
node --import tsx simulation/full-game/specialPayoutPhysical.ts 2000 /tmp/special-payouts/physical
python simulation/full-game/specialPayoutSummary.py /tmp/special-payouts
```

Repository retains configs, group summaries, analysis, CSV and manifest. Complete compressed traces and physical samples are in the accompanying evidence archive, with the same relative paths; extracting it restores summary inputs.

## Next minimal experiment

Do not repeat this mild special-payout nerf or raise all prices. Evaluate late stake/paid-capacity income together with marginal upgrade payback, including a policy that ranks estimated incremental income per purchase price. Earlier blanket cap sweeps and fixed/cheapest policies are historical evidence, not validation of that combination. Preserve early rewards and multi-ball play; accept a candidate only if it slows alternate fast routes without making final upgrades traps or creating ordinary-play purchase droughts.

## Local verification

427 tests pass across 73 files. Pages build and strict TypeScript checks for both audit entrypoints pass. Full `smoke:playtest` passes, including the repaired high-density courier route, exact saved payouts and Node/browser cash/RNG/clock/needs parity. Browser checks use local headless Chromium 134 (Playwright executable override); hosted CI uses its installed current Chromium and remains a separate check.

Full `smoke:pages` also passes for mouse and touch, including all three jobs, pending actions, casino exit and Barry payment. No assertions were weakened.
