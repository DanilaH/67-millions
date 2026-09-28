# T035 — Amplifier / Return / Splitter physical evidence

Status: **accepted for M3/T035 implementation semantics**

This report records the physical evidence for the first production implementation of Amplifier, Return and Splitter on `BOARD_LAYOUT_V0`.

## Provenance

- final code head measured: `a55d23cc0be43f6229b0f9d76ea6a00ca35c7722`
- cascade milestone workflow run: **36406182805**
- bare calibration workflow run: **36406182630**
- cascade runs per scenario: **100,000 Drops**
- cascade seed: **67035000**
- bare runs: **100,000 Drops**
- bare seed: **67000000**
- ball-ball collisions: disabled by V0 config
- Return re-entry: same physical X, upper-board Y, no additional RNG
- stuck watchdog: deterministic near-zero-speed recovery, never assigns a pocket or payout

## Bare-board regression with watchdog enabled

- resolved: **100,000 / 100,000**
- stuck: **0**
- EV: **0.865400x**
- combined center: **52.188%**
- maximum mirrored-pocket delta: **0.614%**
- mean cascade duration: **4.959s**
- p95 cascade duration: **5.700s**
- max cascade duration: **7.533s**

The watchdog removed the rare Matter equilibrium state without materially changing the accepted board shape.

## 100k cascade milestones

| Scenario | EV | Stuck | Mean children | Mean Returns | Mean Amp procs | Max active balls | p95 duration | Max duration |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Baseline | **0.856828x** | 0 | 0.00000 | 0.00000 | 0.00000 | 1 | 5.717s | 7.283s |
| Amplifier L1 | **0.879656x** | 0 | 0.00000 | 0.00000 | 0.28315 | 1 | 5.717s | 7.283s |
| Amplifier max | **1.176129x** | 0 | 0.00000 | 0.00000 | 0.59173 | 1 | 5.717s | 7.283s |
| Return L1 | **0.941598x** | 0 | 0.00000 | 0.07234 | 0.00000 | 1 | 5.767s | 7.517s |
| Return max | **1.196845x** | 0 | 0.00000 | 0.17901 | 0.00000 | 1 | 6.183s | 8.183s |
| Splitter L1 | **0.854030x** | 0 | 0.55946 | 0.00000 | 0.00000 | 2 | 5.667s | 7.283s |
| Splitter max | **0.868017x** | 0 | 0.55946 | 0.00000 | 0.00000 | 2 | 5.667s | 7.283s |
| Combined max | **1.688758x** | 0 | 0.72078 | 0.17901 | 0.59470 | 2 | 6.200s | 8.183s |

## Semantics validated

### Amplifier

- current ball value is multiplied only on a physical Amplifier hit;
- each physical Amplifier can proc a lineage at most once;
- the proc guard propagates to active descendants of that lineage;
- no probability override is used.

### Return

- preserves 100% current value;
- max one Return proc per lineage;
- re-entry is physical: same X, upper-board Y, velocity/rotation reset;
- no extra gameplay RNG is introduced by Return;
- paired physical sweep selected same-X re-entry before the final 100k milestone.

### Splitter

- replaces one parent with two physical children;
- configured child value is applied to the parent current value;
- children inherit lineage guards;
- direct children cannot immediately re-proc the same Splitter;
- max split depth and max active-ball guard are enforced;
- observed max active balls in the current V0 layout is 2, below the configured cap of 24.

### Aggregate settlement

- descendant payouts accumulate into one Drop payout;
- cash is credited once after the final descendant settles;
- losing-Drop Happiness is applied once from the aggregate result;
- Barry resume happens only after aggregate payout settlement.

### Reload / watchdog

- active physical balls persist position, velocity, value, lineage, split/proc flags and watchdog stationary ticks;
- the deterministic watchdog only acts after sustained near-zero velocity;
- watchdog recovery applies a physical velocity nudge and never picks a pocket or fabricates payout;
- final bare and cascade 100k reports have **0 stuck**.

## Interpretation

T035 acceptance is satisfied: lineage guards, Return value preservation, Splitter depth/ball caps and exact durable cascade state are implemented and physically measured.

These reports validate implementation semantics and provide the first milestone economics. They do **not** freeze upgrade prices or prove full-game pacing. Dominant-strategy and purchase-efficiency conclusions belong to E13 full-game simulation and M6 balance/playtest.
