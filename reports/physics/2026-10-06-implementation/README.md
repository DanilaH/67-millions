# Plinko feedback implementation — 2026-10-06

User approved the comparison candidate. Guide centers move +4 logical Y; Return L1/L2 horizontal retention is 0.5, L3/L4 is 1.0. Pin locations, effect caps, value preservation, prices, stakes and pocket payouts remain unchanged.

## Compatibility

`horizontalRetentionByLevel` is optional so historical configs retain their exact original serialized fingerprint. The current map is part of the paid-board fingerprint. Scene and both runners pass the committed Return level to the same target calculation. The resolver recognizes the immediately preceding board before trying the older special/physics/deflector revisions. Unknown fingerprints remain rejected. Old paid worlds keep original guides and same-X return until they are durably empty, then the next launch uses the new board.

The high-stake economy restore test now compares the resolved historical physical fingerprint instead of asserting config object identity: there is intentionally a newer geometry now. Its exact paid stake, payout and state restoration checks remain, as does the new price-cap check. Historical six-root cases cover Return L1 and L4 across all four known revisions. A geometric test checks both inner-face corners against a conservative inner radius of the physical peg polygon.

## Physical matrix

40,000 independent-world candidate executions: two configs × four contexts × Return levels 0–4 × 1,000 paired root seeds. No unresolved roots in 3600 ticks. All new Return ladders increase in sample mean. This screens selected combinations; it is not proof that every possible upgrade combination improves.

Context definitions and source hashes are in the JSON metadata. Other tracks: `bare` none; `early` Amplifier/Splitter/Bias L1; `middle` Amplifier/Splitter L3, Bias L2 and intermediate pockets; `max` everything else maxed. Gross return below includes the stake. The same seed stream is reused between configs and levels for paired comparison; not 40,000 independent seeds.

| Context | Return | Old gross return | New gross return | New edge | New bonus after Return |
|---|---:|---:|---:|---:|---:|
| bare | 0 | 0.9010× | 0.9010× | 0.7% | — |
| bare | 1 | 1.1350× | 1.0617× | 3.6% | — |
| bare | 2 | 1.4138× | 1.3045× | 4.2% | — |
| bare | 3 | 1.8515× | 1.8515× | 10.4% | — |
| bare | 4 | 2.0680× | 2.0680× | 9.1% | — |
| early | 0 | 1.0033× | 1.0058× | 1.2% | — |
| early | 1 | 1.2619× | 1.1864× | 4.3% | 39.7% |
| early | 2 | 1.7265× | 1.6733× | 7.6% | 46.2% |
| early | 3 | 2.0534× | 2.0559× | 11.6% | 59.7% |
| early | 4 | 2.6011× | 2.6029× | 13.7% | 57.1% |
| middle | 0 | 1.9006× | 1.9378× | 2.1% | — |
| middle | 1 | 2.5474× | 2.5628× | 4.4% | 65.8% |
| middle | 2 | 3.9558× | 4.2571× | 9.2% | 72.1% |
| middle | 3 | 5.2590× | 5.2963× | 12.5% | 47.1% |
| middle | 4 | 6.5877× | 6.6249× | 15.0% | 78.0% |
| max | 0 | 10.3342× | 11.8330× | 6.5% | — |
| max | 1 | 16.3228× | 16.3156× | 9.4% | 86.4% |
| max | 2 | 16.4315× | 19.7601× | 11.6% | 81.3% |
| max | 3 | 29.1599× | 29.4753× | 17.6% | 72.9% |
| max | 4 | 35.7366× | 34.1603× | 20.4% | 77.9% |

Bonus percentages follow the actual returned body and split descendants, conditional on Return triggering. They mean a newly triggered Amplifier/Splitter, not touching an already-consumed pin. Root payout arrays are retained in `.json.gz`.

## Full-game pacing screen

160 modeled sessions: 80 per config. Burst modes use 10 seeds per launch/order policy; continuous-spend uses 20. Continuous-spend replenishes every 15 ticks and drains for recovery/purchases/events/victory. Decision time (2 s), courier duration (30 s) and human skill are assumptions. The model does not measure real player behavior, rendering or save latency. Winning medians compare different surviving subsets, so they are not a causal estimate of speedup. Prices were not retuned from this small screen.

| Mode | Order | Old wins | New wins | Old winning median, min | New winning median, min |
|---|---|---:|---:|---:|---:|
| burst 1 | original | 10/10 | 9/10 | 30.21 | 28.84 |
| burst 1 | cheapest | 10/10 | 10/10 | 27.40 | 28.65 |
| burst 6 | original | 8/10 | 8/10 | 17.34 | 14.30 |
| burst 6 | cheapest | 10/10 | 9/10 | 16.26 | 14.73 |
| continuous-spend | original | 10/20 | 12/20 | 18.05 | 18.77 |
| continuous-spend | cheapest | 17/20 | 18/20 | 15.12 | 16.78 |

The new candidate's fastest modeled win was 10.79 minutes; no candidate win under 5 minutes was observed. This does not prove absence of faster strategies. Single-launch winner medians are 28.7–28.8 minutes; six-root bursts 14.3–14.7; continuous-spend 16.8–18.8. Burst play remains faster than the 30-minute target and the final human pacing gate is still open.

## Verification

- 399 unit tests passed; Pages build passed.
- Local full Pages browser suite (`npm run smoke:pages`) and extended playtest suite (`npm run smoke:playtest`) both passed, including the L1/L2 fixtures with actual Return procs. They cover actual mouse/touch input, payouts, mid-flight and settled reload, historical paid boards, transition to current config and Node/Phaser payout/RNG/clock/needs parity.
- The new L1 parity fixture uses seed 67105003, which actually triggers Return. L2 uses 67105001; the test asserts a Return proc before comparing browser output. Existing max-special and delayed-frame fixtures remain.
- Exact raw floating-point pose JSON can differ in final bits between Node and browser; diagnostic logs retain that observation. Economic/RNG/clock/needs parity assertions are not relaxed.
- Production acceptance still needs the user's mobile playtest and broader balance review. No claim of complete balance freeze or low-end-device performance certification.

## Reproduction and provenance

`baseline-config.json` is the production config before this change. The new runtime config is repository-root `balance.v0.json`. Matrix summaries and pacing metadata record exact config hashes, seed ranges, base revision and relevant working source hashes. The code being tested includes the implementation changes committed alongside this report; the pre-commit base revision alone is not a claim that it already contained the patch.

```sh
node --import tsx simulation/full-game/feedbackImplementationAudit.ts reports/physics/2026-10-06-implementation/baseline-config.json /tmp/old-matrix 1000 67110610
node --import tsx simulation/full-game/feedbackImplementationAudit.ts balance.v0.json /tmp/new-matrix 1000 67110610
node --import tsx simulation/full-game/timingAudit.ts 10 /tmp/old-burst 2 reports/physics/2026-10-06-implementation/baseline-config.json 67110650 BASELINE_GROWTH burst
node --import tsx simulation/full-game/timingAudit.ts 10 /tmp/new-burst 2 balance.v0.json 67110650 BASELINE_GROWTH burst
node --import tsx simulation/full-game/timingAudit.ts 20 /tmp/old-continuous 2 reports/physics/2026-10-06-implementation/baseline-config.json 67110670 BASELINE_GROWTH continuous-spend
node --import tsx simulation/full-game/timingAudit.ts 20 /tmp/new-continuous 2 balance.v0.json 67110670 BASELINE_GROWTH continuous-spend
```

Advances T069/T071 and save-compatibility coverage; broader release gates remain open.
