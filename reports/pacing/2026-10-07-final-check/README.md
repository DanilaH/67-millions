# Final bounded candidate check — 2026-10-07

T070 simulation-only check. Production unchanged; source base `83155d8`. Goal: choose fourth-slot price, stress purchase priorities and reserve use, check depleted-bank recovery, and inspect purchase-gap tails. This concludes the planned numeric cycle; it does not prove human difficulty or fun.

## Candidate and method

Candidate: start with two paid roots; buy 3/4/6 capacity. Third costs 5k, sixth 1m; compare fourth at 25k/50k/100k. Late stake caps 40k/65k/100k, unchanged upgrade prices/physics/payouts/needs. All exact configs are retained.

Previous adjacent integer seeds are replaced here with the first uint32 of SHA-256(`seedStart:index`), mapping zero to one. Seeds are deterministic, listed in raw runs, shared between compared scenarios, and distinct across the selection/stress/recovery phases. Labels are not independent trials.

Price selection: 20 seeds, seedStart 67130000, three prices × burst/continuous = 120 runs. Continuous now uses the reserve-preserving `continuous` mode, not the earlier `continuous-spend` mode; every refill rechecks policy. Bounded bursts still do not re-evaluate reserve between their individual clicks. These modes are different player behaviors. Do not attribute differences versus prior reports solely to the candidate price.

Freeze fourth-slot price at **25k** for new stress/recovery seeds. Rationale: earlier access to a visible reward, without selecting for fastest total completion. It is a provisional playtest price, not a statistically established optimum.

Stress: 40 seeds, seedStart 67131000, four priorities × reserve on/off = 320 runs. Priorities: cheapest legal next upgrade; prefer affordable stake upgrades; prefer affordable special-pin upgrades; stop *all* purchases after 12 total board levels and attempt to save for victory. Capacity competes on price as before; priority variants are not rigid exclusive purchase paths. The last rule is one explicit hoarding strategy, not a search of optimal stopping points.

Reserve-off removes the cash reserve and uses a full/clipped stake whenever cash exists, but retains recovery decisions and a quarter-cap purchase buffer. It is not a literal no-work/no-care player. Recovery: 40 further seeds, seedStart 67132000, start cash 500 versus 100 × reserve on/off = 160 runs. The 100 start is a controlled depleted-bank intervention; it does not include the time/need effects of an actual preceding loss.

Completed **600 labeled runs across 100 distinct initial RNG seeds**, with seeds reused for paired scenarios.

## Fourth-slot price

| Price | Burst wins; median win min | Continuous wins; median win min | Fourth-slot median unlock, burst / continuous |
|---|---|---|---|
| 25k | 20/20; 16.60 | 19/20; 18.26 | 6.82 / 9.68 min |
| 50k | 20/20; 15.50 | 19/20; 18.56 | 8.56 / 11.63 min |
| 100k | 20/20; 16.02 | 19/20; 18.42 | 9.29 / 12.43 min |

25k unlocks the fourth root roughly 2.5–2.7 minutes earlier than 100k in these groups. Paired common-winner total-time deltas are +0.26 minutes burst / +0.48 continuous. Lower price changes investment order and does not guarantee a faster win. Median paired longest-gap differences are zero. The continuous 50k group has a different losing seed; equal aggregate win counts do not mean identical risk.

## Strategy and risk

The generated `stress-analysis.json` contains exact outcomes, winner P10/P90 and purchase-gap tails. `analysis.json` retains every run and summary. Counts below are descriptive bot outcomes, not population win probabilities.

The ordinary cheapest policy with reserve wins 39/40 on the stress seeds; without reserve it wins 18/40 (21 Barry losses, one HP death). Stake-first wins 39/40 with reserve versus 9/40 without it. Specials-first wins 40/40 with reserve versus 8/40 without it. Successful medians for reserve-preserving cheapest/stake/special priorities are ~18.7/18.9/21.3 minutes. Risky winners alone cannot be compared without reporting their substantially greater failure rates.

Reserve behavior now exposes meaningful risk; the earlier 100% samples did not establish universal ease. This remains limited policy coverage: no optimal bet sizing, perfect foresight or exhaustive upgrade-order search. Absence of a tested exploit is not proof that none exists.

The stop-after-12 strategy loses all 40 runs with reserve (Barry; median duration 56.68 minutes), and all 40 without reserve (39 Barry, one HP; median 9.74 minutes). It is not a successful shortcut, but the long reserved losing path is a concrete UX concern: a weak plan can continue for nearly an hour. This synthetic stopping rule does not represent every player who starts saving early.

## Recovery

With reserve, 500-start wins 39/40 and 100-start wins 40/40 on the separate recovery seeds. Among 39 common winners, depleted start adds median ~0.51 minutes and zero additional work shifts. Different cash changes subsequent actions/RNG; 40 versus 39 is not evidence that less cash is advantageous.

Without reserve, wins are 14/40 at 500 and 15/40 at 100; both retain substantial Barry/HP losses. Recovery is possible, but reserve management matters much more than the 400 ₽ starting difference. These checks do not cover a late-game bankroll collapse, damaged needs or every unlucky opening.

## Reward cadence and limits

For the ordinary reserve policy, P90 of each run's longest internal purchase gap is ~4.18 minutes; worst observed ~5.78. Without reserve, a winning run contains a ~7.44-minute interval, ~7.21 of it attributed to Plinko. Median run times hide these tails. `long-gaps.json` attributes intervals to preceding actions, including assumed decision delay; it is not measured human waiting or proof that every purchase was meaningful.

The intentionally stopped-purchase strategy must be interpreted separately: its final no-purchase stretch is chosen by the policy, not necessarily a shop-price defect. Initial and final intervals are reported separately from internal gaps.

## Recommendation

Use **5k / 25k / 1m** for 3/4/6 capacity and **40k / 65k / 100k** late stakes as the next *playtest candidate*. Keep the game multi-ball from the start. Do not run another open-ended price sweep or declare balance final. Implementation/save/UI verification and an actual playtest are the next gates.

The remaining concrete UX risk is long purchase droughts in unlucky trajectories. Ask the playtest to distinguish engaging recovery/risk decisions from repetitive casino clicking. Fixing all such tails through discounts could remove the reserve pressure just observed. No new production mechanics, timers or difficulty rules are introduced here.

## Reproduce / verify

```sh
python simulation/full-game/finalCheckBatch.py price
python simulation/full-game/finalCheckBatch.py stress 25000
python simulation/full-game/finalCheckBatch.py recovery 25000
python simulation/full-game/finalCheckSummary.py
```

Configs, raw compressed traces, seed method, exact source hash and all assumptions are recorded. Manifest hashes the inputs, outputs and source. 24 focused runner/policy tests and strict timing-runner TypeScript checks passed. Output assertions cover paid slot prices/order, starting capacity, skip rules and the 12-level stop ceiling. All 600 outputs were verified for the exact executed runner hash, distinct seeds within each group and allowed capacity values.

Timing assumptions remain 2s decisions, 30s courier, full dish/trash timers and no render/save latency. Starting-cash interventions do not modify production. No runtime build, deployment, UI test or human acceptance is claimed.
