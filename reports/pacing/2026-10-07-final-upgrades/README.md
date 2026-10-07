# Final-upgrade buy/skip check — 2026-10-07

T070 diagnostic. Production remains unchanged. Base source: `b2ea80e`, production config: retained `baseline.json`. No price candidate is promoted.

## Correction to the previous interpretation

`chooseGrowthEvUpgrade` in `policies.ts` does not explicitly choose Splitter. The old cheapest override can select it only when another purchase is already intended. Thus the previous observation that Splitter V was absent from 80 victories was partly policy-driven; it was not an independent test of buying versus skipping. The prior maximum-board marginal-value measurement remains valid within its stated assumptions. Its 11-minute projected payback did not predict an 11-minute effect on the full run.

## Controlled policy and variants

Added opt-in `AUDIT_PURCHASE_POLICY=all` to the existing timing runner. It considers every legal next pocket/special/max-bet upgrade, selects the cheapest affordable option, and retains a Barry reserve plus one quarter of the current/next stake cap. It excludes insurance. When unable to buy, it chooses an affordable 100/50/25% bet, then work/recovery as before. Terminal, payment, need and event decisions keep priority. This is one explicit heuristic, not an optimal solver or a human player model.

`AUDIT_SKIP_FINAL` excludes only the final level of Splitter, Return or Amplifier. Shared production rules perform actual purchases, charges, physics and settlement. Continuous play drains for purchase decisions. No fake purchased levels or free money are used.

Selection: 12 seeds 67126000–67126011, two modes (six-root bursts/continuous-spend), seven variants: buy all, skip each of the three final levels, Splitter V price 4m/6m/9m instead of 18m. 168 runs.

Fresh validation: 20 seeds 67127000–67127019, two modes, five variants: buy, three skips, 4m price. 200 runs. The 4m price is checked as the strongest tested discount, not selected for release. **368 total labeled runs, all victories in this limited policy/seed sample.** These are 32 initial seeds reused across variants, not 368 independent seeds and not a claim of guaranteed human victory.

## Results

Independent baseline successful-run medians: 11.55 minutes for bursts and 9.99 for continuous launches. Baseline and every intervention won all 20 in each mode.

Paired median change versus buying every upgrade; negative means earlier victory:

| Intervention | Burst | Continuous |
|---|---:|---:|
| Skip Splitter V | -10.4 s | -12.5 s |
| Skip Return IV | -2.3 s | -8.4 s |
| Skip Amplifier V | -2.0 s | -2.4 s |
| Splitter V price 18m→4m | -4.9 s | -2.7 s |

Median work-count changes and longest internal purchase-gap changes are zero for every intervention. Differences begin late; they do not repair earlier pacing. The tiny Amplifier differences are approximately the assumed decision time and do not establish meaningful dominance. No confidence/significance claim is made for these sample medians.

All 40 baseline validation runs purchased the three target final levels. Median remaining time after the purchase:
- Splitter V: 39.7 s burst / 36.3 s continuous;
- Return IV: 63.4 s / 57.6 s;
- Amplifier V: 53.1 s / 53.3 s.

The late purchases have little time left to affect progression. Saving their cost can offset their improved income. The largest discounts only shave seconds because high late income already makes those amounts recoverable quickly. The previous static-board payback analysis describes marginal return, not total-game pacing impact.

This all-upgrades heuristic produces fast victories, but comparison to older policies' times uses different samples and is not a controlled proof that it is universally better. A stronger purchase policy remains a useful counterexample to claiming balance solved. Changing Splitter V price alone would improve a narrow price/value mismatch while leaving the fast progression almost intact.

## Decision and next useful scope

Do not publish a standalone 18m→4m discount as a balance solution. Do not nerf every final upgrade because skipping it was marginally faster; the late-game opportunity window is short.

The next meaningful experiment should examine when the high stake caps and profitable combinations become available, and whether late purchases can occur early enough to matter without removing multi-ball play. A separately priced 2→3→4→6 launch track remains unimplemented and unpriced; these runs do not validate it. Stop repeating final-price-only sweeps.

## Reproduction and validation

```sh
AUDIT_PURCHASE_POLICY=all AUDIT_BATCHES=6 node --import tsx simulation/full-game/timingAudit.ts 20 /tmp/buy 2 reports/pacing/2026-10-07-final-upgrades/baseline.json 67127000 BASELINE_GROWTH burst
AUDIT_PURCHASE_POLICY=all AUDIT_SKIP_FINAL=splitter AUDIT_BATCHES=6 node --import tsx simulation/full-game/timingAudit.ts 20 /tmp/skip 2 reports/pacing/2026-10-07-final-upgrades/baseline.json 67127000 BASELINE_GROWTH burst
python simulation/full-game/finalUpgradeSummary.py reports/pacing/2026-10-07-final-upgrades
```

Repeat with `continuous-spend` and retained price configs for other variants. `analysis.json` contains session rows, purchases and paired deltas; compressed raw traces and summaries retain exact config and runner hashes. Manifest records sources and evidence. The prior report receives an explicit interpretation correction.

Strict TypeScript check and whitespace check passed. Assertions verified all 368 outputs and exclusion of skipped target purchases. For all 192 buy/skip pairs across selection and validation, decision traces match exactly until the baseline purchases the intended final level; that is the first divergence. This validates the intervention rather than merely comparing unrelated playthroughs. No runtime code/config changed, so no production build, deployment or new live-version claim.

Timing assumptions remain 2s decisions, 30s courier, full dish/trash timers, no rendering/loading/save latency. Changed decisions diverge subsequent RNG use. Samples condition on this heuristic and limited seed ranges; paired comparisons are not human win probabilities. Prices affect purchase order as well as cash, and this is intentionally included in whole-run results.
