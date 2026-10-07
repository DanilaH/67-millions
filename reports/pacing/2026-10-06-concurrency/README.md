# Concurrent launch diagnosis — 2026-10-06

T070 diagnostic only. Runtime, prices, physics and production are unchanged.

## Findings

Production balls collide only with static bodies (`createBarePlinko.ts`, BALL_CATEGORY mask STATIC_CATEGORY); they do not push each other. The six-root ceiling is a concurrency limit, not a one-click batch. Each click pays its own stake and advances 15 game minutes, plus active board time. The global 24-body ceiling can restrict splitting, but the maximum observed here was 13 bodies, so this sample did not reach it.

200 sessions per context and launch count; 7 contexts × counts 1/2/3/6 = 5,600 sessions, 16,800 paid roots. Every session resolved within the 60-second cap. Stakes use the unchanged starting cap (500 ₽) with a generous diagnostic bankroll. Results describe isolated fixed boards, not affordability or whole-game victory.

| Board | Gross return, 1 root | Gross return, 6 roots | Mean seconds, 1 / 6 | Net ₽/sec including assumed 2s decision, 1 / 6 |
|---|---:|---:|---:|---:|
| Bare | 0.818 | 0.822 | 5.03 / 6.48 | -13 / -63 |
| Early | 1.158 | 1.158 | 5.18 / 6.72 | 11 / 54 |
| Maximum | 13.392 | 13.562 | 5.18 / 7.10 | 863 / 4141 |
| Max without Return | 5.781 | 5.860 | 4.95 / 6.48 | 344 / 1719 |
| Max without Amplifier | 8.885 | 8.994 | 5.18 / 7.10 | 549 / 2635 |
| Max without Splitter | 12.100 | 12.279 | 5.14 / 7.07 | 777 / 3730 |
| Max without guides | 9.607 | 9.699 | 5.30 / 7.13 | 589 / 2858 |

Concurrency primarily increases stakes processed per real second: maximum-board income is ~4.8 times faster with six launches in this sample, without a comparable increase in payout per ruble. The unprofitable bare board also loses money faster. Return, Amplifier and guides all materially contribute on the maximum board; removing tracks is diagnostic, not a proposed removal. Effects interact and ablation differences must not be added. Splitter is not the dominant contributor here.

## Interpretation of the user's batch-upgrade idea

A visible 1→2→3→4→6 progression could turn throughput into an understandable reward. A long forced one-ball phase conflicts with the user's stated preference; start with two or make the second ball a very early unlock. These are proposals, not implemented rules or validated prices.

Do not confuse a cosmetic one-click batch with a meaningful throughput upgrade: if the player can still immediately click six independent roots, a smaller batch only reduces clicking convenience. A real progression would need a defined concurrency limit and save/UI support. Every ball should remain a paid stake with total batch cost displayed; free full-value balls would multiply return directly. Child balls from Splitter should remain distinct from paid-root capacity.

The new progression alone would delay access to the same late-game income. It does not solve a maximum board returning ~13 times its stake on average. The next experiment should prioritize multi-ball play and examine adjacent Return/Amplifier/guide levels plus late stake caps, preserving meaningful upgrades. If batch progression is adopted, model the existing per-root 15-minute cost explicitly; silently switching to one time charge per batch would also change Barry/need pressure.

## Reproduction and limitations

`node --import tsx simulation/full-game/concurrencyAudit.ts 200 reports/pacing/2026-10-06-concurrency`

Exact config is in `config.json`; source revision, runner hash, context levels and seed stream are in `summary.json`. Raw session results are compressed in `samples.json.gz`. Runner strict typecheck passed. No new production tests or deployment are warranted for this diagnostic-only change.

Seeds are consecutive xorshift stream states, shared between contexts. Multi-root sessions therefore reuse overlapping initial RNG subsequences; these are **not 16,800 statistically independent root samples**. The reported standardError field is a descriptive session dispersion calculation and must not be used as an independent-sample confidence interval. Different batch sizes can diverge RNG ordering. Heavy payout tails and only 200 session seeds limit numerical precision. Findings are supported by code inspection and are consistent with the previously published 1,000-root maximum-board estimate (~12.67×); this audit does not replace a larger independent balance validation. No new whole-game runs or human playtest were performed.
