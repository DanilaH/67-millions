# Pacing / UX diagnostic — 2026-10-04

## Scope and provenance

Read-only audit; no gameplay/config changes. Advances E21 balance/playtest diagnostics, not release acceptance.

- Runtime/source revision: `855ed436078e60130671ed79dce9f63fdd0a3bc4`.
- Raw config SHA-256: `7fe6c5c2a3ae98cbb1c1eaf81172097d0bd7cfbd259fee499f9c593214a3cd2c`.
- 120 full-game diagnostics: 20 paired initial seeds per policy, 67104000–67104019, existing archetype v1 + liquidity-v1 policies.
- Each paid root resolves with canonical Matter cascade, direct committed seed and current geometry. New wrapper records pre-decision traces and summed physical ticks; it changes no decisions.
- 15,000 separate physical roots: 5,000 per board stage, batch size 1, seed 67105000, stake 1000, no insurance.
- Reproduce: `node --import tsx simulation/full-game/uxAudit.ts 20` and `node --import tsx simulation/full-game/uxBoardAudit.ts`.
- Full traces/results: `runs.json.gz`; compact aggregates: `summary.json`; physical stage results: `boards.json`.

## Important measurement gaps

The existing full-game runner is not a faithful wall-clock session simulator. Its report already labels legacy RealMinutes as game-clock equivalents, but those fields can easily be misread. Actions advance game time immediately. The runner does not include actual skill-game duration or the production scene's passive minutes during physical cascades. It resolves one paid root at a time, whereas production allows six independently settled paid roots in one world. It also does not enforce tutorial ordering, navigation/reading time or model human input.

Therefore neither these outcomes nor summed physics time establish human win probability, a 30-minute session, or the absence of a five-minute winning strategy. Adding a constant reading-time estimate after the run would not repair the missing needs/Barry consequences. A corrected shared-world clock model is needed before balance tuning from session duration.

## Full-game results

All values below describe these bots, not players. Medians are across all 20 outcomes per policy unless specified.

| Policy | Wins / 20 | Barry losses | HP deaths | Work shifts | Drops | Food | Sleep |
|---|---:|---:|---:|---:|---:|---:|---:|
| Cautious | 0 | 20 | 0 | 77.5 | 0 | 42 | 27.5 |
| Baseline growth | 6 | 14 | 0 | 72 | 104.5 | 33 | 21 |
| Aggressive | 0 | 20 | 0 | 50 | 77 | 49 | 16 |
| Worker | 0 | 20 | 0 | 77.5 | 0 | 42 | 27 |
| Degenerate | 0 | 5 | 15 | 10.5 | 28.5 | 5 | 4 |
| Reckless needs | 0 | 2 | 18 | 6 | 12 | 0 | 3 |

Cautious never makes a Drop in this sample: its large reserve and job-upgrade preferences are a policy failure mode, not evidence that the interface blocks casino entry. Worker is intentionally work-heavy. Their failures are also consistent with the design that work alone cannot repay principal.

The six successful baseline runs have median 34 shifts, 30.5 recovery actions (food/sleep/entertainment/shower combined), 104.5 paid roots and 33 total purchases (including job upgrades). This is a concrete repetition warning, not a measured annoyance score. Successful runs' summed physical time ranges 5.8–11.4 minutes, median 8.73, excluding every other activity and with the clock mismatch above.

Purchases are bursty: baseline runs contain up to seven consecutive Plinko purchases. Across successful baseline purchase intervals, the median number of intervening Drops is zero; the median per-run longest interval between Plinko purchases is 23.5 Drops. Intervals after the final purchase are excluded. Thus a frequent-purchase average can conceal both upgrade droughts and bulk-buying. Policy order/reserve affects this metric and must be tested with alternative orders before changing prices.

Growth bot first plays after two shifts (median); aggressive/degenerate/reckless after one. These are choices by bots. Production starts with 500 ₽ and permits an immediate Drop; they do not prove a forced delay before the first throw. No real first-five-minute usability test was performed in this audit.

## Physical board stages

Multipliers include the original stake; they are gross return, not net profit. Means are sample means without uncertainty estimates.

| Stage | Mean gross return | Median gross return | Loss share (<1x) | Median physical seconds | P95 seconds |
|---|---:|---:|---:|---:|---:|
| Base | 0.843x | 0.25x | 52.82% | 4.97 | 5.73 |
| Maximum pocket payouts, no special pins/guides | 2.038x | 0.40x | 52.82% | 4.97 | 5.73 |
| Maximum pockets + specials + guides | 10.969x | 0.742x | 64.66% | 5.03 | 6.17 |

Zero stuck roots among these 15,000. This is not a device FPS measurement. Max board is a diagnostic endpoint, not a claim that every winning bot buys every upgrade. Existing archived 100,000-root max-board evidence found mean 11.129x; the current 5,000 sample is broadly consistent, not a new high-precision calibration.

A highly profitable maximum board still produces losses on nearly two thirds of roots. Hence frequent losing feedback can coexist with rapid bankroll growth. Upgrades should not imply that every next throw becomes more reliable. Maximum pocket payouts alone already cross 2x sample mean, so focusing only on outward guides misses an economic contributor. The top 1% of roots account for 48.1% of payouts in the pocket-only stage, versus 14.6% in the all-max stage: payout concentration changes substantially along the upgrade path.

## Recommended sequence

1. Fix diagnostic fidelity before pricing: production-equivalent passive clock and shared concurrent paid world, plus explicit measured/assumed skill and decision durations. Keep game-clock time, physics time and wall-clock time separate. Verify against known browser replay traces.
2. Then compare a few purchase orders and reserve policies, recording time to each purchase, longest drought and recovery interruptions. Do not optimize toward one bot or arbitrarily force its run to 30 minutes.
3. First balance hypothesis to test: smooth the transition from early losses to highly profitable payout combinations; avoid a uniform price increase that extends the observed routine. No numeric retune is justified by this diagnostic alone.
4. First UX hypothesis: reduce repeated menu traversal for recovery while keeping costs and forecasts visible. Confirm how many interactions a real player spends on recovery before adding a new convenience system.
5. Preserve transparent payout feedback: distinguish gross payout from net result, especially on upgraded boards with frequent loss roots.

Human fun, physical Android performance, and production-equivalent session length remain unverified here. Unit typecheck passed for both audit entrypoints; no runtime behavior was edited.
