# Progression from several angles — 2026-10-06

T070 research, based on production config from `dcddfec` and diagnostic source base `ef9fefc`. **No runtime changes or deployment.** Batch progression remains a design proposal. Do not promote a candidate from this audit.

## Questions and design

Check purchase cadence, survival, late acceleration, launch capacity and usefulness of adjacent late upgrades. Preserve multi-ball play: neither candidate starts with one ball.

Three capacity policies:
- baseline: six paid roots available immediately;
- early: capacities 2/3/4/6 at total board-upgrade levels 0/2/6/12;
- slow: capacities 2/3/4/6 at levels 0/4/10/18.

These are **free unlock proxies**, excluding max-bet and insurance levels. They are not a priced independent upgrade track or one-click batch UI. They isolate capacity pacing while reusing all actual payments, needs, time and physical rules. Each paid root still advances 15 game minutes; child balls do not use paid-root slots but count toward the 24-body limit. Shared-world sessions freeze capacity at the current purchased level; production already forbids purchases during active cascades.

Selection: 8 seeds (67123000–007), 3 variants × 2 launch modes × 2 orders = 96 full-game runs. Modes: bounded six-click attempt then drain, or continuous-spend replenishment. Both obey the current capacity. Early proxy selected for a fresh check, not for release: the slow proxy did not show a convincing purchase-cadence advantage.

Independent capacity check: seeds 67124000–019, baseline/early × 2 modes × 2 orders = 160 runs. Aggressive-policy stress check: seeds 67125000–009, 3 variants × 2 orders, continuous-spend = 60 runs. Total **316 labeled full-game runs**, not independent seeds. Raw traces and source/config hashes accompany every run.

## 1. Capacity progression is a reward opportunity, not a sufficient balance repair

Independent successful-run medians (minutes; winner counts):

| Mode / order | Six immediately | Early unlock proxy |
|---|---:|---:|
| Burst / original | 19.1 (20/20) | 19.8 (19/20) |
| Burst / cheapest | 15.9 (20/20) | 17.2 (20/20) |
| Continuous / original | 16.1 (20/20) | 16.7 (20/20) |
| Continuous / cheapest | 15.1 (20/20) | 16.2 (20/20) |

Group medians have different survivor sets. Among common winners, median total-time changes are +0.91/+0.60/+0.27/+0.93 minutes respectively. Final million-to-end changes are -0.33/-0.20/+0.04/+0.59 minutes. There is no reliable repair of final acceleration.

Longest internal purchase-gap changes among common winners: +0.39/+0.21/-0.46/-0.21 minutes. The proxy mildly worsens gaps in burst play and mildly improves them in continuous play. Whole-group longest gaps remain roughly 2–3 minutes. More play time is not automatically better progression.

The third root opens around 1.2 minutes; fourth around 4.3–5.2; sixth around 9.4–14.0 minutes among winning groups. A separate paid track could behave very differently. Increasing capacity does not grant free money: it increases stake processing speed, including losses on an unprofitable board.

## 2. Purchase strategy and the capacity-unlock rule interact strongly

Aggressive continuous policy, successful-run median minutes and wins out of ten:

| Capacity | Original order | Cheapest eligible order |
|---|---:|---:|
| Six immediately | 27.6; 5/10 | 13.0; 10/10 |
| Early proxy | 37.9; 8/10 | 11.1; 9/10 |
| Slow proxy | 43.3; 5/10 | 12.4; 9/10 |

All non-victories here are Barry losses. These are small stress samples, not human win probabilities or proof of an optimal strategy.

Code/trace inspection explains an important confound: original AGGRESSIVE prioritizes pocket and stake upgrades and can omit special tracks entirely; the cheapest override redirects eligible purchases into special tracks. A player buying only pockets can acquire at most eight board levels, so the early proxy never gives that route six slots. This is a flaw of coupling capacity to an arbitrary total-upgrade count, not evidence that a separately priced batch track necessarily causes 38-minute runs. Do **not** ship this proxy as a hidden unlock rule.

The stress check also shows why uniform price increases are a poor next action: purchase composition can change the entire income curve. The bots are limited and do not solve optimal investment/fractions or model a human casino-only route. Their outcomes cannot refute the user's earlier fast victory.

## 3. Adjacent late upgrade value is highly uneven

**2026-10-07 correction:** baseline policy omits the Splitter track from its explicit growth priority; the cheapest override considers it only when another purchase is already intended. Thus zero Splitter V purchases below is a policy observation, not independent evidence that the upgrade is unattractive to a player. The physical marginal-value result remains valid in its stated context. See the explicit buy/skip comparison in [follow-up](../2026-10-07-final-upgrades/README.md).

Current config, maximum board versus one track reduced by one level: 8 variants × 300 six-root sessions = **14,400 paid roots**. All resolved. This measures the final purchase in a maximum-board context, not every stage in every order. The following projected paybacks use the 240k maximum stake, full six-root bursts, 2-second inter-burst decision overhead, and linear scaling from the sampled 500 ₽ stake; ignore integer-rounding differences, bankroll, recovery and Barry costs.

| Last upgrade | Price | Marginal net income rate | Approximate payback |
|---|---:|---:|---:|
| Edge III | 500k | +37.9% | 1 s |
| Guides IV | 2.8m | +18.1% | 10 s |
| Amplifier V | 9m | +13.7% | 41 s |
| Return IV | 8m | +11.3% | 43 s |
| Splitter V | 18m | +1.5% | 663 s (~11 min) |

These are conditional diagnostic comparisons, **not promised player waiting times**. Edge III is normally purchased before the maximum board/cap exists, so its actual-at-purchase payback is longer. Every measured final level improved mean net income in this sample; the issue is value relative to price, not a demonstrated negative final level.

Splitter V changes child value from 0.85 to 0.90 without adding split contacts. In the 80 baseline holdout victories it was never purchased. All 80 did purchase Amplifier V and Return IV, at median ~1.62 and ~1.68 minutes before victory, respectively. Spending 18m on a marginal improvement with an estimated 11-minute idealized payback is difficult to justify while saving toward a 67m finish. The exact best replacement price/effect was **not** tested here.

## Decision / next smallest experiment

1. Keep multi-ball play central. A visible 2→3→4→6 track could improve anticipation; evaluate it as its own paid choice, not a hidden reward for buying unrelated tracks. Its cost must be tested; free proxies are not enough to set prices.
2. Repair extreme price/value mismatch before another blanket difficulty increase. First candidate: reconsider Splitter V's 18m cost or effect; compare buying versus deliberately skipping it. Preserve meaningful splitting and existing paid-root accounting.
3. Check how early high-value edges/guides combine with increased stakes. Do not nerf Return geometry again merely because it contributes to income. Prices, effect strength and late stake caps need stage-specific comparisons.
4. Judge by purchase cadence, viable alternatives and final purchase usefulness; not a forced duration target or single-ball slowdown. No evidence here freezes final balance or human UX acceptance.

## Reproduce and verify

```sh
AUDIT_BATCHES=6 node --import tsx simulation/full-game/timingAudit.ts 20 /tmp/baseline 2 balance.v0.json 67124000 BASELINE_GROWTH burst
AUDIT_CAPACITY_LADDER='[{"purchases":0,"capacity":2},{"purchases":2,"capacity":3},{"purchases":6,"capacity":4},{"purchases":12,"capacity":6}]' AUDIT_BATCHES=6 node --import tsx simulation/full-game/timingAudit.ts 20 /tmp/early 2 balance.v0.json 67124000 BASELINE_GROWTH burst
AUDIT_ADJACENT=1 AUDIT_BATCHES=6 node --import tsx simulation/full-game/concurrencyAudit.ts 300 /tmp/adjacent
python simulation/full-game/progressionSummary.py reports/pacing/2026-10-06-progression
```

Use retained `config.json` in place of `balance.v0.json` for timing reproduction after future tuning. Adjacent runner reads root config: run against the retained config in an isolated checkout if production has changed. Manifest records config, runners and output hashes. Strict TypeScript checks passed for both changed runners; diff whitespace check passed; all 316 traces match the config hash and monotonic expected capacities. No production tests/build/deployment were necessary because runtime was not changed.

Timing assumes 2s decisions, 30s courier and full dish/trash timers; no render/save delay. Output is simulated active time, not measured human play. Milestones are sampled at decision boundaries. Adjacent physical samples share overlapping xorshift subsequences, so their standardError fields are descriptive dispersions, not independent confidence intervals. Heavy tails limit precision. Capacity cannot establish visual fun or touch usability without implementation/playtest. Previous single-root evidence remains historical and was not relabeled as a new run.
