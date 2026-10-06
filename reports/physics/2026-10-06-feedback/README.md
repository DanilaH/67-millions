# Plinko feedback comparison — 2026-10-06

Research only. Production geometry, rules and economy are unchanged. Baseline executable: `f90a1a9992c60c5763dd996c0c3e53493cf8dca2`. Its CI, Pages build/deploy and live verification all succeeded in Pages run `37437745953`.

## Decision

- Prefer moving all deflector pairs **4 logical pixels down**. This is the smallest tested displacement that fully hides the inner end behind the nearby peg. Two pixels still exposes a corner; six offers no clear screening advantage. Current body endpoints sit 6.607 px above the outer pin center (pin radius 6, plate thickness 5). Both inner-face corners fit within the peg with +4 Y. This removes the protruding tip, not every physically possible inward bounce.
- Reject replacing the Return ladder with central pins: it makes L1 stronger than L2 and L3 stronger than L4 in the tested ladder. More contacts alone do not make better progression.
- Reject returning every level exactly to center: it can replay an unproductive path. Reject applying horizontal retention 0.5 to every level: L4 becomes worse than L3.
- Best follow-up candidate: preserve pin locations, use horizontal retention **0.5 at Return L1/L2**, retain **1.0 at L3/L4**, together with +4 Y guides. This makes early returns collect fresh bonuses far more often, but is a combo-oriented tradeoff rather than a universally higher payout. No per-level runtime/config support has been implemented.
- Before publication: test intermediate upgrade combinations and the complete combined ladder, then full-game pacing, browser parity and historical paid-board restoration. This comparison does not freeze balance or establish a human win rate.

## Method and provenance

137,000 candidate/context root executions, including 16,000 exact reruns to refine the return diagnostic; all resolved before the 3600-tick limit. Common xorshift seed streams pair variants. These are repeated candidate evaluations, not 137,000 independent seeds. The adapter uses Phaser CustomMain and Phaser Resolver initialization, production createBarePlinko, and synchronous fixed-tick effects.

Each root starts in a fresh world, fixed initial cash 10,000,000, default max-bet tier and fraction 1 (500 ₽ stake). `isolated` means only the tested upgrade track is active, with baseline pockets. `combined` means all other physical tracks and pocket upgrades are maxed. Early Return + shifted-guide isolated runs have no guides because bias level is zero; combined runs exercise both changes. No six-root burst/concurrent policy or human playtime is measured here.

JSON summaries record source revision, raw baseline hash, exact mutated config hash, runner/model source hashes, candidate parameters, seeds and counts. `.json.gz` files additionally retain every per-root normalized payout. `null` would mean unresolved, not zero payout. Reported mean is gross payout/stake, including returned stake. Paired 95% intervals below use normal approximation; rare jackpots make small samples noisy.

The first five batches count a later bonus anywhere in the original paid lineage. This can include a sibling that did not return. **Only `branch-holdout` establishes the returned-ball bonus result:** it follows the actual teleported body and its split descendants and counts a newly triggered Amplifier or Splitter. Earlier lineage percentages must not be presented as exact returned-ball percentages. The refined diagnostic reproduces every original combined-holdout payout exactly. Isolated bonus percentages are necessarily zero because other special effects are absent.

Archived `runner-lineage-source.txt` and `sharedWorld-lineage-source.txt` preserve the exact earlier diagnostic versions. For exact old hash reproduction, restore these at their simulation paths in a throwaway checkout. The current runner/model reruns the same physics with one additional branch metric.

## Deflectors: independent holdout

3,000 roots per row/context, seed 67110602. Edge = launch with at least one ball in either extreme pocket. Every tested ladder remains monotonic in the sample.

| Level | Current isolated edge | +4 Y isolated edge | Current gross return | +4 Y gross return | Paired payout difference [95% interval] |
|---|---:|---:|---:|---:|---|
| 0 | 0.93% | 0.93% | 0.8782× | 0.8782× | +0.0000 [+0.0000, +0.0000] |
| 1 | 1.43% | 1.33% | 0.9115× | 0.9110× | -0.0005 [-0.0121, +0.0111] |
| 2 | 2.37% | 2.20% | 0.9988× | 0.9885× | -0.0103 [-0.0267, +0.0061] |
| 3 | 3.43% | 3.33% | 1.1050× | 1.0986× | -0.0064 [-0.0276, +0.0148] |
| 4 | 5.23% | 5.80% | 1.2738× | 1.3591× | +0.0853 [+0.0416, +0.1289] |

With other tracks maxed:

| Level | Current edge | +4 Y edge | Current gross return | +4 Y gross return | Paired difference [95% interval] |
|---|---:|---:|---:|---:|---|
| 0 | 12.67% | 12.67% | 22.3248× | 22.3248× | +0.0000 [+0.0000, +0.0000] |
| 1 | 14.07% | 14.07% | 24.4393× | 24.4463× | +0.0070 [-0.2774, +0.2913] |
| 2 | 15.27% | 15.10% | 26.2808× | 26.0289× | -0.2518 [-0.5187, +0.0150] |
| 3 | 16.47% | 16.33% | 28.1275× | 27.9246× | -0.2029 [-0.5528, +0.1470] |
| 4 | 19.50% | 19.70% | 32.8470× | 33.1481× | +0.3012 [-0.8329, +1.4352] |

## Return: independent early-level combined-candidate holdout

2,000 roots per candidate/context, seed 67110604, selected after the earlier screens. Candidate uses +4 Y guides and retention 0.5 for the tested active Return level. Percentages below are conditional on a Return proc, with all other upgrades maxed; zero means zero observed, not proof of impossibility.

| Level | Current returned branches with new bonus | Candidate returned branches with new bonus | Current gross return | Candidate gross return | Paired difference [95% interval] |
|---|---:|---:|---:|---:|---|
| 1 | 0/103 (0.0%) | 99/103 (96.1%) | 14.9680× | 13.7530× | -1.2151 [-2.4799, +0.0497] |
| 2 | 13/315 (4.1%) | 283/349 (81.1%) | 15.6250× | 18.4697× | +2.8447 [+1.6259, +4.0635] |

Without other upgrades:

| Level | Current gross return | Candidate gross return | Relative change | Paired difference [95% interval] |
|---|---:|---:|---:|---|
| 1 | 0.9905× | 0.9366× | -5.4% | -0.0539 [-0.0861, -0.0217] |
| 2 | 1.2897× | 1.2094× | -6.2% | -0.0804 [-0.1472, -0.0135] |

The L1 combined sample mean drops about 8%, but its paired interval includes zero. The isolated L1/L2 reductions and combined L2 gain have intervals excluding zero. Seeing a new bonus does not guarantee a better final pocket. The current L1 does have economic value despite rarely collecting new bonuses: in the separate paired return-ladder sample its combined mean is 13.983× versus 9.931× with Return off.

## Rejected ladder detail

1,500 roots per candidate/context, seed 67110603. Central pairs by level: r8c3/r8c5, r7c3/r7c4, r6c2/r6c4, r5c2/r5c3. Values are gross payout/stake with other tracks maxed.

| Return level | Current | Central pins, same X | Current pins, retention 0.5 |
|---|---:|---:|---:|
| 1 | 13.9830× | 29.4537× | 11.6724× |
| 2 | 14.6396× | 11.8742× | 15.5272× |
| 3 | 26.9259× | 35.8341× | 34.1921× |
| 4 | 35.8341× | 11.8294× | 19.5965× |

## Reproduce

Run from repository root using Node + tsx. The candidate files fully specify the changes against the baseline balance.v0.json. Read-only comparison; no runtime config writes.

```sh
node --import tsx simulation/full-game/feedbackPhysicsAudit.ts reports/physics/2026-10-06-feedback/screen-candidates.json 500 67110601 /tmp/screen
node --import tsx simulation/full-game/feedbackPhysicsAudit.ts reports/physics/2026-10-06-feedback/guide-candidates.json 3000 67110602 /tmp/guides
node --import tsx simulation/full-game/feedbackPhysicsAudit.ts reports/physics/2026-10-06-feedback/return-candidates.json 1500 67110603 /tmp/returns
node --import tsx simulation/full-game/feedbackPhysicsAudit.ts reports/physics/2026-10-06-feedback/reentry-candidates.json 1500 67110603 /tmp/reentry
node --import tsx simulation/full-game/feedbackPhysicsAudit.ts reports/physics/2026-10-06-feedback/combined-candidates.json 2000 67110604 /tmp/combined
```

This work advances T069/T071 diagnosis. Production balance acceptance and the targeted implementation remain open.
