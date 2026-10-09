# Whole stake ladder / purchase payback — 2026-10-09

## Decision

Promote the coupled cap/price candidate to **provisional production playtesting**, version `0.9-ladder30k-playtest`. Ordinary simulated winner medians move from 15.75–16.59 to 22.46–22.86 minutes; matched additions are 6.14 / 6.08 minutes. Median matched work shifts decrease by one, rather than replacing casino progression with extra jobs. Skipping purchases after 32 now delays cheapest/insurance-first victory. This is a useful next playtest, **not final balance or a validated 30-minute human session**. T070/T071 remain open.

Baseline main `329d2162f132b5603fff3c0494e3543fc29f8659`; CI and Pages were both successful before publication. Baseline raw-config hash `4864d56d75e4b319aaf5241fb9da4c325a31d589c5bdb194fc7697a0e14b6778`. Promoted raw-config hash `5d8447e21f7a73df8ca5cbb90aec8ddf272c8484a034f1092256d3552c22d02f`. Experimental `coupled.json` retains historical metadata; `promoted.json` is byte-identical to the published config. The two configurations are equal excluding `meta`. Metadata differences must not be described as identical raw hashes.

## Exact change

| Stake level | Previous cap / price ₽ | Candidate cap / price ₽ |
|---|---:|---:|
| 0 | 500 / 0 | 500 / 0 |
| I | 2,500 / 500 | 2,500 / 500 |
| II | 12,500 / 1,800 | 5,000 / 3,750 |
| III | 30,000 / 7,000 | 10,000 / 25,714 |
| IV | 40,000 / 250,000 | 15,000 / 125,000 |
| V | 65,000 / 1,500,000 | 22,000 / 420,000 |
| VI | 100,000 / 6,000,000 | 30,000 / 1,371,429 |

Caps-only uses the same new caps with all old prices. Coupled stake prices scale the reference price by new/old incremental cap; reference II/III prices are the earlier experimental 15k/90k, other reference prices are previous production. This is an exploratory price rule, not proof that marginal physical income is linear. Coupled also scales late Amplifier/Return/Splitter prices originally ≥1m by .3: Amplifier IV/V 600k/2.7m, Return III/IV 360k/2.4m, Splitter IV/V 1.2m/5.4m. Six-paid-place upgrade 1m→300k; earlier capacity prices 5k/25k preserved. Starts still have two paid places, then 3/4/6. No automatic batch or free roots.

Geometry, physical solver, pockets, special effects, insurance, jobs, needs, clock, Barry and events unchanged. Existing saves keep purchased levels and cash, with no refunds/reset. Already paid roots retain their original stakes/payout inputs; subsequent roots use the new caps.

## Method and provenance

672 labeled full-game sessions on 32 distinct full-game seeds. Three configurations: control, caps-only, coupled. Selection: 8 seeds SHA256(`67156000:index`) first uint32, three configs × five fast policies = 120. Fresh holdout: 24 seeds SHA256(`67157000:index`), same matrix = 360. Ordinary: first 16 holdout seeds × three configs × cheapest/insurance-first = 96. Stopping: same first 16 × same configs/policies with casino purchase quota 32, fast = 96. Ordinary/stopping reuse holdout seeds and are not independent new cohorts.

Policies: cheapest, stake-first, insurance-first, income-path, income-path-insurance. Ranking uses 128 reused probe seeds (`67146000`), not an independent ranking holdout. Selection caches start cold with zero imported boards. After selection, validated agreeing cache projections were merged into 527 boards and used for holdout; provenance and bootstrap identity retained. 182,272 newly executed isolated ranking probes, including repeated physical execution across configurations. Those roots are not distinct full-game seeds. No imported archive seeded selection.

Full runner uses actual purchased paid capacity, root debit, insurance, needs, daily receipts, RNG and the pinned Phaser Matter shared-world adapter. Fast decision .25 s and courier/trash/dishes 6/5/8 s; ordinary decision 2 s and jobs 12/15/18 s. Launch spacing .25 s; deterministic modeled 8% job failures. Loading, navigation, render/storage latency and human hesitation omitted.

## Fresh fast holdout

Winner medians; wins /24. Differences below are group medians, not matched deltas.

| Policy | Previous | Caps only | Coupled |
|---|---:|---:|---:|
| Cheapest | 10.80 min; 24 | 17.72; 23 | 15.80; 24 |
| Stake-first | 10.72; 24 | 17.90; 24 | 16.06; 24 |
| Insurance-first | 11.33; 24 | 19.53; 23 | 15.21; 24 |
| Income-path | 15.78; 23 | 21.37; 24 | 19.32; 24 |
| Income-path-insurance | 15.95; 24 | 22.73; 24 | 20.75; 24 |

Matched coupled additions among common winners: +4.32 / +5.30 / +4.35 / +4.26 / +4.74 minutes respectively. Matched extra work −3 / −1.5 / −1.5 / −1 / −2 shifts. Median idle time zero. Caps-only losses are HP; previous income-path loss is Barry. Small samples do not establish probabilities or guarantee survival.

## Ordinary pacing and purchase gaps

| Policy (16 seeds each) | Previous | Caps only | Coupled | Matched coupled addition |
|---|---:|---:|---:|---:|
| Cheapest | 15.75 min; 16 wins | 25.47; 16 | 22.46; 16 | +6.14 min |
| Insurance-first | 16.59; 16 | 26.33; 16 | 22.86; 16 | +6.08 min |

First casino purchase remains .5 modeled minutes. Coupled longest internal purchase-gap medians 2.83/3.02 minutes, versus previous 2.06/2.38; matched additions .45/.73. Sample maximum gaps 5.75/5.90 versus previous 5.40/5.90. Final time after last purchase 4.38/3.95 minutes versus previous 1.28/1.21. First observed million to victory 6.60/6.82 versus 4.79/4.57. These are decision-boundary observations, not continuous cash-crossing timestamps.

The candidate doubles median paid launches (257.5/264→509/507.5). Repetition and the roughly four-minute final interval are explicit human-playtest risks. Lower capped income is mechanically effective but may feel tedious; do not call longer play automatically better.

## Stopping cross-check

Quota 32 counts all casino level purchases, including capacity and insurance; work purchases remain available. No gameplay quota is introduced. Compare matched common winners to unlimited on the same first 16 holdout seeds:

| Config | Cheapest delta / wins | Insurance-first delta / wins |
|---|---:|---:|
| Previous | −.38 min /16 | +.25 /16 |
| Caps only | −1.31 /15 | +.71 /15 |
| Coupled | +.54 /16 | +3.00 /16 |

All winning cutoff paths reach 32, none exceeds it; no additional cutoff-only losses. Final purchases collectively help these coupled paths. This does not prove each individual upgrade pays back, optimal purchase order, or absence of a smarter sparse build. Insurance counts consume three of the quota; the two policies do not omit the same physical upgrades.

## Verification and limits

`ladderSummary.py` extends source/config/seed validation with exact casino purchase-trace counts, quota checks, matched stopping comparisons and a SHA-256 manifest. Aggregate analysis, configs, source snapshots, group summaries and per-run CSV are committed. Full compressed traces, caches/bootstrap/merge provenance and logs are in the companion archive. Reproduce with `python3 simulation/full-game/ladderSummary.py reports/pacing/2026-10-09-ladder` after restoring raw evidence; source hashes must match the snapshots.

Stake payback proxies are context-dependent and incompletely cached: coupled ordinary cheapest stake V has no cached board measurement. Missing values are missing coverage, not evidence of negative ROI. Small ranking samples are noisy/heavy-tailed; no claim that every upgrade was empirically calibrated.

431 tests /75 files and Pages build/typecheck passed locally. Two additional promoted-config sessions reproduce complete archived coupled results, traces and physical sessions, excluding only result configHash/configVersion; these verification reruns are not counted in the 672-session experiment. Added exact old-six-100k save replay plus next 30k debit regression. Browser smoke adds the same historical paid stakes to node/Phaser exact cash, RNG, clock and needs parity. Local Chromium is absent; CI must pass both browser smoke suites before Pages deploy, then verify-live must confirm the exact published commit. Workflow results are release evidence, not human balancing evidence.

Next: play a fresh run to judge whether midgame purchases remain satisfying, six-root replenishment feels repetitive, and final accumulation lasts too long. A 30-minute target remains open; randomness is not introduced to conceal a dominant income curve.
