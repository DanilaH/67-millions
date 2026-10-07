# Paid launch capacity and late stake caps — 2026-10-07

T070 diagnostic; no production change or deployment. Base source `63bf0f8`; exact configs/scenarios and hashes retained. New paid capacity is **simulation-only**, not a shipped feature or save schema. No candidate is accepted as final balance.

## Hypotheses and model

Start with two concurrent paid roots, then buy 3/4/6 slots. Each ball remains individually paid with the existing 15-game-minute cost; splitting creates child balls under the unchanged 24-body cap. This models capacity, not a one-click batch UI or autofire feature.

Added a narrowly scoped `AUDIT_BUY_CAPACITY` action to the simulation runner. It uses core `debitCash`, rejects insufficient funds and requires an explicit audit callback; successful payment advances the local simulator capacity level exactly once. Purchases occur only after cascades drain. Production state and config schema remain unchanged; save migration/restore/UI are not implemented by this audit.

All-upgrades policy from the preceding audit considers capacity alongside next board/stake purchases by price, retains its Barry reserve plus quarter-cap bankroll buffer, and preserves event/recovery/victory priority. Two additional policies always prioritize an affordable next capacity upgrade, or skip the entire capacity track. These are heuristics, not optimal human strategies.

| Scenario | Capacity prices (3 / 4 / 6) | Last three stake caps |
|---|---|---|
| Baseline | Six available immediately | 60k / 120k / 240k |
| Cheap | 1.5k / 25k / 250k | unchanged |
| Medium | 5k / 100k / 1m | unchanged |
| Caps | Six available immediately | 40k / 65k / 100k |
| Combined | 5k / 100k / 1m | 40k / 65k / 100k |
| Skip | Remain at two, no purchases | unchanged |
| First | Medium prices, capacity priority | unchanged |

Entry stake caps (500 / 2,500 / 12,500 / 30,000), all stake-upgrade prices, physical geometry, special effects, payouts and needs remain unchanged in every scenario. Config files are experiment inputs only.

Selection: 8 seeds 67128000–67128007 × 7 scenarios × 2 modes = 112 runs. Validation: fresh 20 seeds 67129000–67129019 × baseline/medium/caps/combined × 2 modes = 160 runs. Total **272 labeled runs**, 28 initial seeds shared between scenarios. Every run won under this policy and these seeds; no human win-probability or difficulty claim.

## Independent results

Whole-group successful median active minutes; every cell is 20/20 victories:

| Scenario | Burst then drain | Continuous spending |
|---|---:|---:|
| Baseline | 11.80 | 10.61 |
| Paid capacity only | 13.83 | 12.74 |
| Late caps only | 13.54 | 11.92 |
| Combined | 15.74 | 13.91 |

The two interventions have different purposes. Capacity introduces three paid throughput choices; the smaller late caps extend the profitable final phase. From first observed 1m to victory, baseline medians are 2.46/2.40 minutes versus combined 4.57/4.50. Paired combined-minus-baseline medians are +3.74/+4.52 total minutes and +2.26/+1.93 final-phase minutes. Paired deltas differ from differences of group medians.

Combined late purchases have more time left before victory:
- Return IV: ~2.31/2.10 minutes (baseline ~1.01/0.91);
- Amplifier V: ~2.11/1.75 (baseline ~0.84/0.70);
- Splitter V: ~1.55/1.37 (baseline ~0.66/0.50).

This gives effects a longer opportunity window but does not prove Splitter V is now cost-effective. It also does not prove the added time is enjoyable.

## Costs and progression tradeoffs

All medium/combined validation runs bought all three slots, spending 1.105m. Combined median unlock times: third at 3.44/3.35 minutes, fourth at 9.59/8.67, sixth at 11.36/10.72. The long interval between third and fourth is a concern for this track's reward cadence, even though other upgrades occur in between. Prices are not ready to freeze.

Paired combined changes in longest internal purchase gap: +0.04 minutes in bursts and +0.41 in continuous play. Paired work-count changes: +0.5/+1.5 shifts. Whole-group maximum-gap medians grow from 1.91/1.78 to 2.20/2.15 minutes. The result is a pacing tradeoff, not uniform improvement.

In the eight-seed selection, never buying capacity finishes ~1.46/1.74 minutes later than medium-price buying among matched seeds, so capacity had positive practical value under these policies. This small selection does not prove optimal pricing or that every individual level is worth purchasing. Prioritizing capacity ahead of cheaper board improvements can delay total progress; it is not a universally dominant first purchase.

The cheap ladder opens slots earlier (roughly 1.2 / 4.6–5.1 / 8.5–9.1 minutes in selection), but its longest-gap behavior was worse in continuous selection. It was not independently validated or combined with late caps in this batch. Do not present its prices as a validated alternative.

## Decision

A concrete playtest candidate now exists: start at two, paid 3/4/6 progression and 40k/65k/100k late stake caps. It preserves multi-ball play and leaves time after late upgrades. **It is not promoted here:** paid progression adds early/middle delay, the fourth slot is late, and modeled survival remains 100% on this limited sample.

If implementation is authorized, present slot prices and total stake exposure clearly, preserve paid-root saves, and test how the added purchases feel. Numeric simulation cannot establish visual reward or usability. A smaller next numeric comparison would address the third-to-fourth-slot interval and targeted alternative purchase priorities; no need for another blanket final-upgrade-price sweep. The late-cap-only control remains a simpler option with less added early-game friction.

## Reproduction / verification

```sh
python simulation/full-game/paidCapacityBatch.py 8 67128000 selection- baseline cheap medium caps combined skip first
python simulation/full-game/paidCapacityBatch.py 20 67129000 holdout- baseline medium caps combined
python simulation/full-game/paidCapacitySummary.py reports/pacing/2026-10-07-paid-capacity
```

`scenarios.json` defines the exact configurations. Compressed runs retain cash, purchases, levels, capacities and full results; analysis retains paired deltas. In timing metadata, legacy `capacitySemantics` describes the free-unlock option; when `paidCapacity` is present it takes precedence over that label. Manifest records executed source hashes, configs and evidence.

24 focused tests passed across the runner/policy and new audit tests: exact cash debit, one callback, insufficient-funds rejection before granting capacity, and rejection outside explicit audit execution. Strict TypeScript checks and whitespace checks passed. Output assertions verify all 272 runs, correct initial capacity, ordered slot purchases, exact configured prices and no purchases/capacity increases in skip mode. No production build/deploy was run because runtime was unchanged.

Model assumptions: 2s decisions, 30s courier, full dish/trash timers, no render/save latency; shared production physics, bounded bursts or continuous replenishment. Adjacent seeds are reused for matched scenarios, not independent per-label trials. All-upgrades policy is limited and ignores insurance. Paid-slot saves and one-click batch UX are outside this diagnostic. No 30-minute acceptance, human difficulty or fun claim.
