# Stopping investment before a full board — 2026-10-09

## Finding

No large early-stop bypass was found in this bounded search. Stopping after 24 or 28 casino purchases was generally slower than continuing; the selected cutoff 32 saves about 20–50 seconds for cheapest/stake-first, but usually slows insurance-first. This does not prove optimal stopping or rule out a smarter subset/order.

The existing middle-price candidate remains a partial pacing hypothesis, not validated final balance. No production config/runtime change accompanies this audit. Base main `58e5d9c89fb0961d3c982364b9752db1db522e85`; its CI and Pages were both confirmed successful before the audit. Production raw-config SHA-256 `4864d56d75e4b319aaf5241fb9da4c325a31d589c5bdb194fc7697a0e14b6778` is unchanged. T070/T071 remain OPEN.

## Method

Compare current production against the unchanged middle-price candidate: stake II opening 1,800→15,000 ₽ and III 7,000→90,000 ₽. Caps, effects, geometry, work, events, needs, Barry, insurance and capacity remain intact. Exact configs are retained.

Opt-in `AUDIT_STOP_AFTER_PURCHASES=N` disables further **casino** purchases once the sum of purchased board/stake/capacity/insurance levels reaches N. Work upgrades, recovery, events, real insurance settlement, reserve-preserving bets and victory remain available. Capacity starts at two; each purchase is one level, not the number of extra slots. No free upgrades or artificial payout changes. Default behavior remains unlimited. This is a purchase-policy experiment, not a proposed gameplay limit.

Selection: 8 seeds SHA256(`67154000:index`) first uint32, 2 configs × 3 policies × cutoffs unlimited/24/28/32 = 192 sessions. Policies are cheapest, stake-first and insurance-first. Among bounded cutoffs, prefer no fewer wins than unlimited in every config/policy group, then smallest unweighted mean of the six winner medians. Cutoff 32 selected before holdout; decision retained in `selection-decision.json`. This small selection is not an optimal-policy claim.

At cutoff 24 selection winner medians range 18.08–26.33 modeled fast minutes, versus 11.68–14.98 unlimited. Cutoff 28 ranges 12.37–19.17. Very early stopping is not the faster route in those groups. No conclusion about a carefully chosen sparse build or a different purchase order.

## Fresh holdout

24 fresh seeds SHA256(`67155000:index`), 2 configs × 3 policies × unlimited/32 = 288 sessions. Table gives winner medians and win counts. Matched additions compare common winners, not differences of group medians.

| Config / fast policy | Unlimited | Stop at 32 | Matched change |
|---|---:|---:|---:|
| Current / cheapest | 10.80 min; 24/24 | 10.24; 24/24 | −.384 min |
| Current / stake-first | 11.19; 24/24 | 10.60; 24/24 | −.549 |
| Current / insurance-first | 11.61; 24/24 | 12.56; 24/24 | +.340 |
| Priced middle / cheapest | 12.88; 24/24 | 12.78; 24/24 | −.369 |
| Priced middle / stake-first | 13.20; 23/24 | 12.46; 23/24 | −.543 |
| Priced middle / insurance-first | 13.62; 24/24 | 14.05; 24/24 | +.429 |

For cheapest, all 24 unlimited winners per config buy 35 casino levels. Stop 32 omits exactly Return IV (8m), Amplifier V (9m), Splitter V (18m): total 35m in purchases. Avoiding them can finish sooner despite lower income. Optional late purchases need not always be optimal near victory; this modest saving is not evidence that they cause the whole pacing defect.

Insurance-first spends three of its 32 purchases on insurance, so the same numerical cutoff stops at a less-developed physical/stake/capacity build. It is not equivalent to skipping the same final three tracks. Its slower result demonstrates order sensitivity; do not impose a universal 32-purchase gameplay ceiling.

## Ordinary timing control

First 16 holdout seeds, 2 configs × cheapest/insurance-first × unlimited/32 = 128 sessions. Reused seeds, not a separate independent cohort.

| Config / ordinary policy | Unlimited | Stop at 32 | Matched change |
|---|---:|---:|---:|
| Current / cheapest | 15.55; 16/16 | 14.96; 16/16 | −.533 min |
| Current / insurance-first | 17.42; 16/16 | 18.36; 16/16 | +.151 |
| Priced middle / cheapest | 20.33; 15/16 | 19.23; 15/16 | −.793 |
| Priced middle / insurance-first | 21.24; 16/16 | 21.35; 16/16 | −.035 |

No matched median additional work shifts or longest internal purchase gaps. Time from the first observed million to finish changes by the same amount as total time: these tested paths are identical through purchase 32, after the million milestone. Time after the final purchase grows when purchasing stops, even though cheapest total duration decreases; do not confuse that interval with a pacing repair. Milestones observe decision-boundary cash.

## Verification and limits

**608 labeled sessions / 32 distinct full-game seeds**, reused across configs/policies/cutoffs/pace. **199,307 actual paid physical roots**, including continuous replenishment; root seeds are not independent full-game seeds. No isolated ranking probes used. Full runner, production shared-world board resolver, Phaser Matter fork, true capacity debit and insurance execute.

Every run validates config/source hashes, unique seed count and exact casino purchase-count correspondence. Every cutoff run stays at or below its quota; traces reject purchases after cutoff. 256 cutoff-32 comparisons have identical traces through the 32nd purchase (or identical complete runs if they never reach it). An unlimited run on archived seed `67151000:0` matches the previous audit exactly: result, trace and physical sessions. Strict audit-entrypoint TypeScript, project typecheck and Python syntax checks passed. New option is simulation-only; no browser/human playtest or new production deployment is claimed.

Fast decisions .25 s, courier/trash/dishes 6/5/8 s; ordinary 2 s and 12/15/18 s. Launch spacing .25 s; deterministic 8% job failures; actual core time, needs and events. Loading/render/save/navigation latency omitted. Winner medians condition on survival. Three heuristics and four cutoffs are not an exhaustive search, dynamic stopping optimizer or human difficulty measure.

## Next decision

Do not try to repair pacing solely by forcing final purchases or random money penalties. The tested shortcut is small; the productive build reaches high income before those purchases. Inspect the middle transition into profitable combinations and the joint scaling of stakes, paid capacity and upgraded payout. Keep early improvements and multiple balls useful. Existing events should then be measured as a separate controlled contribution, not assumed to compensate for excess machine income. The ~30-minute successful human median remains unverified; stretching every fast bot toward 30 risks dull ordinary play.

```sh
python3 simulation/full-game/stoppingBatch.py 8 67154000 /tmp/stopping/selection none,24,28,32
python3 simulation/full-game/stoppingBatch.py 24 67155000 /tmp/stopping/holdout none,32
python3 simulation/full-game/stoppingBatch.py 16 67155000 /tmp/stopping/ordinary none,32 ordinary cheapest,insurance-first
# Extract archive to a root containing configs/sources and the three phases:
python3 simulation/full-game/stoppingSummary.py /tmp/stopping
```

Per-group summaries, per-session CSV, exact configs, source snapshots, validation and full compressed traces are retained in the evidence archive. Production game numbers are unchanged.
