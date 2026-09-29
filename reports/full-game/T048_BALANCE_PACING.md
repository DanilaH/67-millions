# T048 — Full-game balance / pacing report

Status: **diagnostic complete; current calibration does not satisfy the stated V0 balance/pacing hypotheses.**

## Key finding

Across **600 deterministic runs** (100 per policy), the current diagnostic produced **0 victories**.

This is a rejection signal for the current economy/pacing state, not evidence that the game is balanced:

- `BASELINE_GROWTH` target hypothesis was roughly 30–45% wins; measured here: **0%**.
- even the fastest losing policies have a median real-session proxy around **71.8 min**, above the ~30 min successful-run target;
- `BASELINE_GROWTH` median loss proxy is **149.1 min**;
- `CAUTIOUS` / `WORKER` median loss proxies are **982.4 / 1058.4 min**.
- the result is systemic across all tested policies, so there is no single anomaly seed explaining the failure.

This report is still an economy diagnostic rather than final physical truth: the full-game Plinko model is evidence-derived and uses documented interpolation/approximation for some special-upgrade states. Therefore the correct conclusion is **“current calibration is not defensible yet”**, not “the exact true win rate is zero”.

GitHub Actions evidence run: **36538612754**.

## Provenance

- config version: `0.7-canonical-preproduction`
- config SHA-256: `d8ab0e3cfd7edb9cc4a76c1165bc7cfbe7d5140ec632d598f94771de46676aaf`
- measured code revision: `57819a2dcd082a3b34dae8086afb4c08fd314605`
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
| CAUTIOUS | 0.0% | 18.0% | 82.0% | n/a | 42.2 | 0.0 | 8.0 | 99.5% | 0.0% | 0.5% |
| BASELINE_GROWTH | 0.0% | 48.0% | 52.0% | n/a | 8.4 | 9.9 | 6.0 | 39.8% | 58.7% | 1.5% |
| AGGRESSIVE | 0.0% | 74.0% | 26.0% | n/a | 6.3 | 9.4 | 2.2 | 22.3% | 77.2% | 0.5% |
| WORKER | 0.0% | 19.0% | 81.0% | n/a | 50.0 | 0.0 | 7.0 | 99.7% | 0.0% | 0.3% |
| DEGENERATE | 0.0% | 91.0% | 9.0% | n/a | 6.3 | 9.9 | 1.2 | 27.1% | 72.5% | 0.4% |
| RECKLESS_NEEDS | 0.0% | 90.0% | 10.0% | n/a | 5.7 | 8.7 | 1.0 | 31.8% | 67.8% | 0.4% |

## Per-policy details

### CAUTIOUS

- median victory elapsed days: **n/a**
- p10 / p90 victory elapsed days: **n/a / n/a**
- median loss elapsed days: **13.64**
- median real-session proxy: **982.4 min**
- average food / sleep / entertainment / events: **21.1 / 18.8 / 10.6 / 5.6**
- dumpster comebacks / HP deaths: **0 / 0**
- near-zero cash recoveries: **100**
- average / p95 max bankroll drawdown: **116372 / 205341 ₽**
- wins dominated by one giant payout: **0.0%**
- most common upgrade order (41/100): `job:courier:L2 > job:dishes:L2 > job:trash:L2 > job:dishes:L3 > job:trash:L3 > job:courier:L3`

### BASELINE_GROWTH

- median victory elapsed days: **n/a**
- p10 / p90 victory elapsed days: **n/a / n/a**
- median loss elapsed days: **2.07**
- median real-session proxy: **149.1 min**
- average food / sleep / entertainment / events: **1.7 / 4.8 / 0.1 / 0.9**
- dumpster comebacks / HP deaths: **5 / 0**
- near-zero cash recoveries: **346**
- average / p95 max bankroll drawdown: **20585 / 78652 ₽**
- wins dominated by one giant payout: **0.0%**
- most common upgrade order (56/100): `plinko:maxBet:L1 > plinko:maxBet:L2`

### AGGRESSIVE

- median victory elapsed days: **n/a**
- p10 / p90 victory elapsed days: **n/a / n/a**
- median loss elapsed days: **1.00**
- median real-session proxy: **71.8 min**
- average food / sleep / entertainment / events: **0.9 / 1.9 / 0.0 / 0.7**
- dumpster comebacks / HP deaths: **8 / 0**
- near-zero cash recoveries: **916**
- average / p95 max bankroll drawdown: **19691 / 71755 ₽**
- wins dominated by one giant payout: **0.0%**
- most common upgrade order (61/100): `plinko:maxBet:L1 > plinko:maxBet:L2`

### WORKER

- median victory elapsed days: **n/a**
- p10 / p90 victory elapsed days: **n/a / n/a**
- median loss elapsed days: **14.70**
- median real-session proxy: **1058.4 min**
- average food / sleep / entertainment / events: **24.5 / 20.9 / 13.1 / 6.7**
- dumpster comebacks / HP deaths: **0 / 0**
- near-zero cash recoveries: **100**
- average / p95 max bankroll drawdown: **162958 / 315981 ₽**
- wins dominated by one giant payout: **0.0%**
- most common upgrade order (64/100): `job:trash:L2 > job:courier:L2 > job:dishes:L2 > job:dishes:L3 > job:trash:L3 > job:courier:L3`

### DEGENERATE

- median victory elapsed days: **n/a**
- p10 / p90 victory elapsed days: **n/a / n/a**
- median loss elapsed days: **1.00**
- median real-session proxy: **71.8 min**
- average food / sleep / entertainment / events: **1.1 / 1.4 / 0.0 / 0.8**
- dumpster comebacks / HP deaths: **6 / 0**
- near-zero cash recoveries: **866**
- average / p95 max bankroll drawdown: **15295 / 32500 ₽**
- wins dominated by one giant payout: **0.0%**
- most common upgrade order (49/100): `plinko:maxBet:L1 > plinko:jackpotBias:L1 > plinko:maxBet:L2`

### RECKLESS_NEEDS

- median victory elapsed days: **n/a**
- p10 / p90 victory elapsed days: **n/a / n/a**
- median loss elapsed days: **1.00**
- median real-session proxy: **71.8 min**
- average food / sleep / entertainment / events: **0.0 / 1.3 / 0.0 / 0.7**
- dumpster comebacks / HP deaths: **5 / 0**
- near-zero cash recoveries: **864**
- average / p95 max bankroll drawdown: **12551 / 44052 ₽**
- wins dominated by one giant payout: **0.0%**
- most common upgrade order (72/100): `plinko:maxBet:L1 > plinko:maxBet:L2`

## Anomaly seeds

No individual anomaly seeds were emitted under the configured per-run rules. The primary finding is **systemic**: all six strategies had 0% wins in this batch.

## Interpretation / next action

T048 satisfies the diagnostic requirement, but its result should block any claim that the economy is calibrated.

Before a final balance freeze, investigate at least:

1. whether current policy logic reaches positive-EV Plinko progression quickly enough;
2. whether upgrade prices / max-bet progression prevent reaching compounding states before Barry growth;
3. whether current needs/sleep pressure is too slow for the intended real-session target yet still lethal over long runs;
4. whether the evidence-derived special-upgrade approximation materially understates reachable tails;
5. whether a targeted balance/policy sweep can produce the intended BASELINE_GROWTH win corridor without creating a dominant strategy.

Do **not** tune a single number from this report in isolation. Any candidate change should be rerun through the same six-policy batch.
