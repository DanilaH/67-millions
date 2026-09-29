# T048 — Full-game balance / pacing report

Status: **diagnostic complete; current calibration does not satisfy the stated V0 balance hypotheses.**

## Gate interpretation

- Exact diagnostic workflow run: **36540607910**.
- Artifact: `t048-full-game-balance` (id `11020601148`, sha256:e4b4e05e2d89e986ee8eac63fb13a74d315dd140cb57eb2f33a14bbbdde99083).
- Sample: **600 deterministic runs** — 100 per policy.
- Victories: **0 / 600**.
- `BASELINE_GROWTH` observed **0% wins / 99% Barry loss / 1% HP death**, versus the SIMULATION_SPEC starting hypothesis of roughly **30–45% wins**.
- `CAUTIOUS` and `WORKER` now lose **100% to Barry and 0% to HP** after fixing survival-first recovery ordering, so the earlier mass HP deaths were a policy defect rather than a stable balance conclusion.
- `AGGRESSIVE` observed **98% Barry loss / 2% HP death**. `DEGENERATE` and `RECKLESS_NEEDS` remain mostly HP-death strategies at **95%** and **90%**, respectively.
- Plinko is materially exercised: `BASELINE_GROWTH` averages **17.2 Drops** with **28.4%** of modeled credited income from Plinko; `AGGRESSIVE` averages **14.4 Drops** with **37.0%** from Plinko. The 0-win result is therefore not explained by bots simply never gambling.
- The reported `real-session proxy` is a **natural-clock upper-bound proxy**: it converts all advanced game minutes using 3 real seconds/game minute, even though several actions advance game time faster than literal wall-clock waiting. It is not a direct measurement against the ~30-minute product target.
- T048 satisfies the **diagnostic/reporting** requirement, but the current economy is **not ready for balance freeze**. No `balance.v0.json` values are changed by this task.

## Provenance

- config version: `0.7-canonical-preproduction`
- config SHA-256: `d8ab0e3cfd7edb9cc4a76c1165bc7cfbe7d5140ec632d598f94771de46676aaf`
- code revision: `c4c3c1f25072c67a609ba1c150e57fa8e5307c55`
- runs per policy: **100**
- seed start: **67100000**
- Plinko economy model: `physical-evidence-derived-rtp-v1`
- near-zero cash threshold: **1000 ₽**
- giant-payout-dominated win threshold: **50.0% of credited modeled income**

## Measurement caveat

This is an **economy/pacing diagnostic**, not final physical Plinko balance evidence. The full-game runner is pure core and the Plinko model is evidence-derived:

- Base pocket probabilities are the accepted BARE_BOARD_V0 100k physical frequencies.
- Pocket-upgrade payouts use the production pocket multipliers with the accepted bare physical frequencies.
- Amplifier/Return/Splitter intermediate levels interpolate RTP factors between accepted T035 L1 and max 100k milestones.
- Jackpot Bias uses accepted T036 per-level RTP factors.
- Multiple special effects are approximated by multiplying evidence-derived RTP factors; combined-max is anchored to the accepted T036 combined-max RTP.
- This economy model does not reproduce special-effect payout tails or Bias pocket redistribution and must not be treated as final physical balance evidence.

Upgrade prices and final economy remain tunable until later large-batch + playtest gates.

## Strategy summary

| Policy | Win | Barry loss | HP death | Median win real min | Avg work | Avg Drops | Avg dumpster | Work income | Plinko income | Dumpster income |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| CAUTIOUS | 0.0% | 100.0% | 0.0% | n/a | 67.9 | 0.0 | 0.0 | 100.0% | 0.0% | 0.0% |
| BASELINE_GROWTH | 0.0% | 99.0% | 1.0% | n/a | 66.9 | 17.2 | 0.1 | 71.6% | 28.4% | 0.0% |
| AGGRESSIVE | 0.0% | 98.0% | 2.0% | n/a | 53.0 | 14.4 | 0.1 | 63.0% | 37.0% | 0.0% |
| WORKER | 0.0% | 100.0% | 0.0% | n/a | 70.8 | 0.0 | 0.0 | 100.0% | 0.0% | 0.0% |
| DEGENERATE | 0.0% | 5.0% | 95.0% | n/a | 14.8 | 10.2 | 1.3 | 58.0% | 41.7% | 0.4% |
| RECKLESS_NEEDS | 0.0% | 10.0% | 90.0% | n/a | 6.4 | 6.2 | 4.9 | 50.3% | 46.9% | 2.7% |

## Per-policy details

### CAUTIOUS

- median victory elapsed days: **n/a**
- p10 / p90 victory elapsed days: **n/a / n/a**
- median loss elapsed days: **16.00**
- median real-session proxy: **1151.8 min**
- median / p10 / p90 victory real minutes: **n/a / n/a / n/a**
- average food / sleep / entertainment / events: **36.3 / 23.8 / 19.0 / 8.7**
- dumpster comebacks / HP deaths: **0 / 0**
- near-zero cash recoveries: **100**
- average / p95 max bankroll drawdown: **197356 / 267310 ₽**
- wins dominated by one giant payout: **0.0%**
- top upgrade sequences: `job:courier:L2 > job:dishes:L2 > job:trash:L2 > job:dishes:L3 > job:trash:L3 > job:courier:L3` (51); `job:courier:L2 > job:trash:L2 > job:dishes:L2 > job:dishes:L3 > job:trash:L3 > job:courier:L3` (26); `job:dishes:L2 > job:trash:L2 > job:courier:L2 > job:dishes:L3 > job:trash:L3 > job:courier:L3` (9); `job:trash:L2 > job:dishes:L2 > job:courier:L2 > job:dishes:L3 > job:trash:L3 > job:courier:L3` (4); `job:courier:L2 > job:dishes:L2 > job:trash:L2 > job:dishes:L3 > job:courier:L3 > job:trash:L3` (2); `job:courier:L2 > job:trash:L2 > job:dishes:L2 > job:dishes:L3 > job:trash:L3` (2); `job:dishes:L2 > job:courier:L2 > job:trash:L2 > job:dishes:L3 > job:trash:L3 > job:courier:L3` (2); `job:trash:L2 > job:courier:L2 > job:dishes:L2 > job:dishes:L3 > job:trash:L3 > job:courier:L3` (2); `job:courier:L2 > job:dishes:L2 > job:trash:L2 > job:dishes:L3 > job:trash:L3` (1); `job:dishes:L2 > job:trash:L2 > job:courier:L2 > job:dishes:L3 > job:courier:L3 > job:trash:L3` (1)

### BASELINE_GROWTH

- median victory elapsed days: **n/a**
- p10 / p90 victory elapsed days: **n/a / n/a**
- median loss elapsed days: **13.00**
- median real-session proxy: **935.8 min**
- median / p10 / p90 victory real minutes: **n/a / n/a / n/a**
- average food / sleep / entertainment / events: **26.9 / 20.3 / 4.7 / 7.4**
- dumpster comebacks / HP deaths: **0 / 1**
- near-zero cash recoveries: **103**
- average / p95 max bankroll drawdown: **89892 / 435778 ₽**
- wins dominated by one giant payout: **0.0%**
- top upgrade sequences: `plinko:center:L1 > plinko:center:L2 > plinko:maxBet:L1 > plinko:maxBet:L2 > plinko:mid:L1 > job:dishes:L2 > job:courier:L2 > plinko:jackpotBias:L1 > job:trash:L2 > plinko:maxBet:L3 > plinko:amplifier:L1 > plinko:jackpot:L1 > plinko:mid:L2 > plinko:maxBet:L4 > plinko:return:L1` (2); `plinko:center:L1 > plinko:center:L2 > plinko:maxBet:L1 > plinko:maxBet:L2 > plinko:mid:L1 > job:dishes:L2 > job:trash:L2 > job:courier:L2 > plinko:jackpotBias:L1 > plinko:amplifier:L1 > plinko:maxBet:L3 > plinko:jackpot:L1 > plinko:maxBet:L4 > plinko:mid:L2 > plinko:return:L1 > job:dishes:L3` (2); `plinko:center:L1 > plinko:center:L2 > plinko:maxBet:L1 > plinko:maxBet:L2 > plinko:mid:L1 > job:dishes:L2 > job:trash:L2 > job:courier:L2 > plinko:jackpotBias:L1 > plinko:amplifier:L1 > plinko:maxBet:L3 > plinko:jackpot:L1 > plinko:mid:L2 > plinko:maxBet:L4 > plinko:return:L1 > job:dishes:L3` (2); `plinko:center:L1 > plinko:center:L2 > plinko:maxBet:L1 > plinko:maxBet:L2 > plinko:mid:L1 > job:dishes:L2 > job:trash:L2 > job:courier:L2 > plinko:jackpotBias:L1 > plinko:maxBet:L3 > plinko:amplifier:L1 > plinko:jackpot:L1 > plinko:maxBet:L4 > plinko:mid:L2` (2); `plinko:center:L1 > plinko:center:L2 > plinko:maxBet:L1 > plinko:maxBet:L2 > plinko:mid:L1 > job:dishes:L2 > job:trash:L2 > job:courier:L2 > plinko:jackpotBias:L1 > plinko:maxBet:L3 > plinko:amplifier:L1 > plinko:jackpot:L1 > plinko:mid:L2 > plinko:maxBet:L4` (2); `plinko:center:L1 > plinko:center:L2 > plinko:maxBet:L1 > plinko:maxBet:L2 > plinko:mid:L1 > job:courier:L2 > plinko:jackpotBias:L1 > job:trash:L2 > job:dishes:L2 > plinko:amplifier:L1 > plinko:jackpot:L1 > plinko:maxBet:L3 > plinko:mid:L2 > plinko:return:L1 > plinko:maxBet:L4` (1); `plinko:center:L1 > plinko:center:L2 > plinko:maxBet:L1 > plinko:maxBet:L2 > plinko:mid:L1 > job:courier:L2 > plinko:jackpotBias:L1 > job:trash:L2 > job:dishes:L2 > plinko:maxBet:L3 > plinko:amplifier:L1 > plinko:jackpot:L1 > plinko:maxBet:L4 > plinko:mid:L2 > plinko:return:L1 > job:dishes:L3` (1); `plinko:center:L1 > plinko:center:L2 > plinko:maxBet:L1 > plinko:maxBet:L2 > plinko:mid:L1 > job:courier:L2 > plinko:jackpotBias:L1 > job:trash:L2 > plinko:amplifier:L1 > job:dishes:L2 > plinko:jackpot:L1 > plinko:maxBet:L3 > plinko:mid:L2 > plinko:maxBet:L4 > plinko:return:L1` (1); `plinko:center:L1 > plinko:center:L2 > plinko:maxBet:L1 > plinko:maxBet:L2 > plinko:mid:L1 > job:dishes:L2 > job:courier:L2 > job:trash:L2 > plinko:jackpotBias:L1 > plinko:amplifier:L1 > plinko:maxBet:L3 > plinko:jackpot:L1 > plinko:mid:L2 > plinko:return:L1 > plinko:maxBet:L4 > job:dishes:L3` (1); `plinko:center:L1 > plinko:center:L2 > plinko:maxBet:L1 > plinko:maxBet:L2 > plinko:mid:L1 > job:dishes:L2 > job:courier:L2 > job:trash:L2 > plinko:jackpotBias:L1 > plinko:maxBet:L3 > plinko:amplifier:L1 > plinko:jackpot:L1 > plinko:mid:L2 > plinko:maxBet:L4 > plinko:return:L1 > job:dishes:L3` (1)

### AGGRESSIVE

- median victory elapsed days: **n/a**
- p10 / p90 victory elapsed days: **n/a / n/a**
- median loss elapsed days: **11.00**
- median real-session proxy: **791.8 min**
- median / p10 / p90 victory real minutes: **n/a / n/a / n/a**
- average food / sleep / entertainment / events: **46.7 / 16.7 / 16.2 / 6.5**
- dumpster comebacks / HP deaths: **1 / 1**
- near-zero cash recoveries: **109**
- average / p95 max bankroll drawdown: **49708 / 176348 ₽**
- wins dominated by one giant payout: **0.0%**
- top upgrade sequences: `plinko:maxBet:L1 > plinko:maxBet:L2 > plinko:maxBet:L3` (47); `plinko:maxBet:L1 > plinko:maxBet:L2 > plinko:maxBet:L3 > plinko:maxBet:L4` (36); `plinko:maxBet:L1 > plinko:maxBet:L2 > plinko:maxBet:L3 > plinko:maxBet:L4 > plinko:maxBet:L5` (9); `plinko:maxBet:L1 > plinko:maxBet:L2` (8)

### WORKER

- median victory elapsed days: **n/a**
- p10 / p90 victory elapsed days: **n/a / n/a**
- median loss elapsed days: **16.00**
- median real-session proxy: **1151.8 min**
- median / p10 / p90 victory real minutes: **n/a / n/a / n/a**
- average food / sleep / entertainment / events: **36.4 / 24.0 / 20.3 / 9.5**
- dumpster comebacks / HP deaths: **0 / 0**
- near-zero cash recoveries: **100**
- average / p95 max bankroll drawdown: **222184 / 286252 ₽**
- wins dominated by one giant payout: **0.0%**
- top upgrade sequences: `job:trash:L2 > job:courier:L2 > job:dishes:L2 > job:dishes:L3 > job:trash:L3 > job:courier:L3` (76); `job:dishes:L2 > job:courier:L2 > job:trash:L2 > job:dishes:L3 > job:trash:L3 > job:courier:L3` (14); `job:courier:L2 > job:trash:L2 > job:dishes:L2 > job:dishes:L3 > job:trash:L3 > job:courier:L3` (3); `job:trash:L2 > job:courier:L2 > job:dishes:L2 > job:dishes:L3 > job:courier:L3 > job:trash:L3` (2); `job:courier:L2 > job:dishes:L2 > job:trash:L2 > job:dishes:L3 > job:trash:L3` (1); `job:dishes:L2 > job:courier:L2 > job:trash:L2 > job:dishes:L3 > job:trash:L3` (1); `job:dishes:L2 > job:trash:L2 > job:courier:L2 > job:dishes:L3 > job:trash:L3 > job:courier:L3` (1); `job:trash:L2 > job:courier:L2 > job:dishes:L2 > job:dishes:L3 > job:trash:L3` (1); `job:trash:L2 > job:dishes:L2 > job:courier:L2 > job:dishes:L3 > job:trash:L3 > job:courier:L3` (1)

### DEGENERATE

- median victory elapsed days: **n/a**
- p10 / p90 victory elapsed days: **n/a / n/a**
- median loss elapsed days: **3.04**
- median real-session proxy: **218.6 min**
- median / p10 / p90 victory real minutes: **n/a / n/a / n/a**
- average food / sleep / entertainment / events: **7.1 / 4.3 / 0.8 / 1.7**
- dumpster comebacks / HP deaths: **6 / 0**
- near-zero cash recoveries: **121**
- average / p95 max bankroll drawdown: **16477 / 41750 ₽**
- wins dominated by one giant payout: **0.0%**
- top upgrade sequences: `plinko:maxBet:L1 > plinko:maxBet:L2` (20); `plinko:maxBet:L1 > plinko:maxBet:L2 > plinko:maxBet:L3 > plinko:jackpotBias:L1 > plinko:jackpot:L1` (16); `plinko:maxBet:L1 > plinko:maxBet:L2 > plinko:maxBet:L3 > plinko:jackpotBias:L1 > plinko:jackpot:L1 > plinko:splitter:L1` (13); `plinko:maxBet:L1 > plinko:maxBet:L2 > plinko:maxBet:L3` (9); `plinko:maxBet:L1 > plinko:maxBet:L2 > plinko:maxBet:L3 > plinko:jackpotBias:L1` (9); `plinko:maxBet:L1 > plinko:maxBet:L2 > plinko:jackpotBias:L1` (7); `plinko:maxBet:L1 > plinko:maxBet:L2 > plinko:jackpotBias:L1 > plinko:splitter:L1 > plinko:jackpot:L1 > plinko:maxBet:L3` (7); `plinko:maxBet:L1 > plinko:maxBet:L2 > plinko:jackpotBias:L1 > plinko:maxBet:L3 > plinko:jackpot:L1` (4); `plinko:maxBet:L1 > plinko:maxBet:L2 > plinko:jackpotBias:L1 > plinko:maxBet:L3` (3); `plinko:maxBet:L1 > plinko:maxBet:L2 > plinko:jackpotBias:L1 > plinko:maxBet:L3 > plinko:jackpot:L1 > plinko:splitter:L1` (3)

### RECKLESS_NEEDS

- median victory elapsed days: **n/a**
- p10 / p90 victory elapsed days: **n/a / n/a**
- median loss elapsed days: **1.70**
- median real-session proxy: **122.2 min**
- median / p10 / p90 victory real minutes: **n/a / n/a / n/a**
- average food / sleep / entertainment / events: **0.0 / 3.0 / 0.0 / 0.9**
- dumpster comebacks / HP deaths: **4 / 0**
- near-zero cash recoveries: **129**
- average / p95 max bankroll drawdown: **9514 / 33050 ₽**
- wins dominated by one giant payout: **0.0%**
- top upgrade sequences: `plinko:maxBet:L1 > plinko:maxBet:L2` (64); `plinko:maxBet:L1 > plinko:maxBet:L2 > plinko:maxBet:L3` (18); `plinko:maxBet:L1 > plinko:maxBet:L2 > plinko:maxBet:L3 > plinko:amplifier:L1` (9); `plinko:maxBet:L1 > plinko:maxBet:L2 > plinko:maxBet:L3 > plinko:maxBet:L4 > plinko:amplifier:L1` (5); `plinko:maxBet:L1 > plinko:maxBet:L2 > plinko:maxBet:L3 > plinko:maxBet:L4` (4)


## Anomaly seeds

- BASELINE_GROWTH seed `67100122`: dumpster-hp-death
- AGGRESSIVE seed `67100283`: dumpster-hp-death
