# Middle stake ladder — 2026-10-08

## Decision

Prefer targeted opening prices over reduced middle caps as the next provisional playtest hypothesis. Do not declare balance solved or promote either config automatically. Production remains byte-identical, SHA-256 `4864d56d75e4b319aaf5241fb9da4c325a31d589c5bdb194fc7697a0e14b6778`. Source base/main `db81e1fd82641c7aabb680919993d4e9f60535ff`; its CI and Pages workflows both passed before this experiment. T070/T071 remain OPEN.

The price candidate delays high stakes while other board upgrades remain available. It adds 1.18–3.51 matched fast minutes across six policies and 1.36–2.46 ordinary minutes, without increasing matched median work shifts. It is a measurable partial improvement, not a 30-minute solution: its fastest holdout win is 9.284 modeled minutes and the final accumulation phase remains essentially unchanged. More expensive opening is not evidence of meaningful human difficulty or fun.

## Scope

Previous rejected experiments changed late caps/payouts. This experiment isolates stake levels II/III on the current paid-capacity game. First stake opening (500→2,500 for 500 ₽), paid capacity 2→3→4→6, every board effect/pocket, geometry, insurance, work, needs, events, Barry and clock are unchanged.

| Level | Current cap / price ₽ | Smooth middle | Priced middle |
|---|---:|---:|---:|
| 0 | 500 / 0 | same | same |
| I | 2,500 / 500 | same | same |
| II | 12,500 / 1,800 | 5,000 / 1,800 | 12,500 / 15,000 |
| III | 30,000 / 7,000 | 10,000 / 7,000 | 30,000 / 90,000 |
| IV–VI | 40k / 250k; 65k / 1.5m; 100k / 6m | same | same |

Control retains exact production bytes. Other files are isolated experiment inputs, not shipped balance. Their historical `meta.version` is retained; filenames, exact deltas, raw hashes and source hashes distinguish them. No claim that historical meta evidence validates these candidates.

## Fresh full-game holdout

Selection: 8 seeds SHA256(`67151000:index`) first uint32, three configs × six policies = 144 sessions. Holdout: 24 fresh seeds SHA256(`67152000:index`), same groups = 432. Both candidates were checked rather than selecting a winner from holdout and calling that selection independent confirmation.

Each cell below is winner median modeled minutes, then wins. Policies use real transactions, purchased capacity, insurance and the production Phaser shared-world adapter. Winner medians condition on survival; paired deltas are calculated separately among common winners.

| Fast policy | Current | Smooth | Priced | Priced matched addition |
|---|---:|---:|---:|---:|
| cheapest | 10.40; 24/24 | 11.41; 23/24 | 13.84; 24/24 | +3.045 min |
| stake-first | 11.02; 24/24 | 11.84; 24/24 | 14.42; 24/24 | +3.509 |
| insurance-first | 10.87; 24/24 | 13.88; 24/24 | 13.42; 24/24 | +2.971 |
| skip stake IV–VI | 14.07; 24/24 | 29.39; 23/24 | 17.43; 24/24 | +3.325 |
| income-path | 14.80; 24/24 | 16.33; 23/24 | 15.91; 24/24 | +1.179 |
| income-path-insurance | 14.93; 24/24 | 16.80; 24/24 | 18.34; 24/24 | +2.180 |

The smooth candidate only approaches 30 minutes when the policy refuses the unchanged late stakes. Routes buying those stakes bypass the limitation; this is not a good 30-minute candidate. Its three labeled holdout failures are two Barry losses and one HP death; these are policy/config observations, not a general human loss-rate claim.

## Ordinary progression, purchase gaps and payback

Ordinary uses the first 16 holdout seeds, two policies × three configs = 96 sessions. These are reused full-game seeds, not another independent cohort.

| Ordinary policy | Current | Smooth | Priced | Priced matched addition |
|---|---:|---:|---:|---:|
| cheapest | 16.14; 16/16 | 18.10; 16/16 | 20.16; 16/16 | +2.458 min |
| insurance-first | 17.65; 16/16 | 19.57; 15/16 | 20.93; 16/16 | +1.356 |

Differences of group medians are not medians of per-seed differences. In priced ordinary play, matched median extra work shifts are zero for both policies; extra work time is 0 / .025 min. Modeled idle time is zero throughout. The delay comes primarily from continued casino play, not extra mandatory work.

Cheapest ordinary opening times (winner medians): first purchase stays .50 min; stake II moves 2.30→8.12 min and III 5.28→13.87 min. Other purchases fill those intervals. Longest internal casino-purchase gap group medians 2.34→2.88 min; matched increase +.182 min. Sample maximum 4.17→4.27 min. Insurance-first matched longest-gap increase +.012 min. These modest paired gap changes do not establish that a person enjoys the added play.

Smooth increases paired ordinary longest gaps +.800 / +.601 min, while a route that buys late stakes remains fast. Priced is preferable on this comparison.

The final phase is not repaired. First observed million→finish matched change in priced ordinary play is −.032 / +.076 min; time after the last casino purchase remains about 1.25–1.33 min. Milestones sample decision-boundary cash, not transient cascade cash.

Stake payback proxies use the measured board present at the purchase, isolated mean net return / flight time × paid capacity × incremental cap. Priced cheapest ordinary winner-median estimates for II/III are 5.38 / 9.55 seconds, versus current 2.37 / 1.78. Buying happens on different, more developed boards, so this is not a pure fixed-board price contrast. Insurance, bankroll variance, concurrent throughput and core time costs are omitted. These values indicate that the higher prices did not turn II/III into obviously poor investments in this heuristic; they are not guaranteed actual payback times. The first cap is often bought on a sampled negative-EV board and has no positive proxy payback; it changes stake size, not odds.

## Recovery checks and limits

48 additional sessions use 16 fresh seeds SHA256(`67153000:index`): cheapest, three configs, initial cash 100 instead of 500. All 16/16 win per config. Medians current 10.38, smooth 11.82, priced 12.75 min. Priced matched addition +2.698 min, matched work shifts −2. This is a controlled depleted-start intervention with fresh needs/clock, not an actual preceding losing cascade.

Actual traces also identify same-day drained casino-session net cash declines of at least 10%, excluding a pending event choice and cross-day auto-Barry charges. Ordinary current cheapest: 84 episodes, all recover to pre-session cash, median .235 min / p90 .590. Priced cheapest: 52/52, .249 / .752; priced insurance-first: 45/45, .242 / .403. These are overlapping episodes on changed paths, not independent matched shocks. Work and spending on purchases can affect recovery time. Sampling after drain omits transient within-cascade losses; no severe-bankruptcy robustness claim.

## Provenance and verification

Total **720 labeled sessions / 48 distinct full-game seeds**, reused across policies/configs. **14,080 newly executed isolated ranking roots**, plus explicitly reused cache entries; ranking uses **128 distinct reused seeds**, SHA256(`67146000:index`). Cache seeding asserts parsed source identity, count/seed/model and exact config equivalence after excluding prices, meta and noninitial stake caps. Shared measurements agree exactly on overlapping boards. Bootstrap files record imported counts/hashes; imported probes are excluded from new execution totals. The archive includes the original imported cache and source snapshots.

Income-path policies use the previously tested normalized, bounded same-track lookahead heuristic; not an optimal player. Actual full-game rules handle purchases, losses, needs and insurance. Ranking remains noisy and omits risk, cross-track planning and insurance effects. All runs and configurations passed metadata/config/source/count validation in `middleSummary.py`.

Project typecheck, strict audit/seed-helper TypeScript check, the 3 marginal-income regression tests and Python syntax checks passed. Two negative cache-seeding checks reject changed probe timing and an invalid cache model before writing. Local archived historical test snapshots are excluded from Vitest discovery (`--exclude 'reports/**'`); current regression tests are unchanged. No runtime source/config was edited, so no new browser or human verification is claimed.

Fast assumptions: .25 s decisions, jobs courier/trash/dishes 6/5/8 s. Ordinary: 2 s decisions, jobs 12/15/18 s. Launch interval .25 s, 8% deterministic job failures, actual time/needs/events/Barry. Loading, navigation, rendering and saving latency omitted. Every reported duration is modeled active time.

## Reproduction

```sh
# Seed each candidate's selection cache using the archived imported cache.
node --import tsx simulation/full-game/incomeCacheSeed.ts balance.v0.json reports/pacing/2026-10-08-middle/inputs/imported-cache.json reports/pacing/2026-10-08-middle/configs/control.json /tmp/middle/selection/control/income-cache.json
# Repeat for smooth-middle and priced-middle, changing target config/cache.
python3 simulation/full-game/incomeBatch.py 8 67151000 /tmp/middle/selection control,smooth-middle,priced-middle cheapest,stake-first,insurance-first,skip-late-stakes,income-path,income-path-insurance fast 128 67146000 reports/pacing/2026-10-08-middle/configs
# Before holdout, seed each phase cache from its completed selection cache.
python3 simulation/full-game/incomeBatch.py 24 67152000 /tmp/middle/holdout control,smooth-middle,priced-middle cheapest,stake-first,insurance-first,skip-late-stakes,income-path,income-path-insurance fast 128 67146000 reports/pacing/2026-10-08-middle/configs
python3 simulation/full-game/incomeBatch.py 16 67152000 /tmp/middle/ordinary control,smooth-middle,priced-middle cheapest,insurance-first ordinary 128 67146000 reports/pacing/2026-10-08-middle/configs
python3 simulation/full-game/incomeBatch.py 16 67153000 /tmp/middle/recovery control-depleted,smooth-middle-depleted,priced-middle-depleted cheapest fast 128 67146000 reports/pacing/2026-10-08-middle/configs
```

Without caches the same runner measures missing boards itself; this costs additional physical executions and must not reuse this report's execution count. `analysis.json`, `runs.csv`, per-group summaries and full raw traces support the report. Inspect final-phase concentration and deliberate stop-investing routes separately before combining more tuning; simply raising every price or forcing one-ball play is not supported by this audit.
