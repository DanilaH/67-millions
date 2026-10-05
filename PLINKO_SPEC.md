# PLINKO SPEC

## 1. Role

Plinko is the primary capital-scaling engine. It starts with a house edge, becomes approximately fair through early upgrades, and can become intentionally positive/absurd late. Positive EV must never imply guaranteed victory because bankroll variance, time, Barry, events and needs remain active.

## 2. Geometry V0

Logical viewport: `1280×720`.

Runtime geometry comes from `balance.v0.json -> plinko.geometry`. Current calibrated V0 is approximately a 560×540 board, 9 rows / 10 pockets, 48 px horizontal spacing and 27 px vertical spacing. Exact runtime values must not be duplicated in Scene code.

Initial ball spawn: board center + configured seeded horizontal jitter. No manual X aim.

## 3. Bare-board statistical target

Ideal 9-row Galton approximation:

`0.195% / 1.758% / 7.031% / 16.406% / 24.609% / 24.609% / 16.406% / 7.031% / 1.758% / 0.195%`

Bare pockets:

`12x | 4x | 1.5x | 1x | 0.25x | 0.25x | 1x | 1.5x | 4x | 12x`

Theoretical ideal-binomial EV = **0.849609375x**. The ideal distribution is a target shape, not a fake probability override.

Current candidate (2026-10-05): frictionAir 0.026, measured using the production shared-world adapter with Phaser Resolver initialization. An independent 10,000-root holdout measured **0.846025x EV**, **0.68% combined edge**, **55.25% combined center**, and **0 unresolved roots**. See `reports/physics/2026-10-05-bare/README.md`. This establishes a bare-board candidate, not acceptance of upgrades or whole-game pacing.

Historical standalone-Matter measurements (including 0.865400x) used different Resolver initialization and do not validate the production runtime. The superseded runtime board measured 1.912x / 8.05% edge in `reports/pacing/2026-10-05-pockets/README.md`.

## 4. Physics seed

Exact calibrated physics values live in `balance.v0.json -> plinko.physicsSeed`. Bare V0 currently uses gravity 1.0, ball restitution 0.155, peg restitution 0.6, frictionAir 0.026 and wall restitution 0.2. These values remain TUNABLE V0 and may change only through config + measured physical reports, never Scene constants.

## 5. Bet / payout semantics

- Quick bet buttons: 25% / 50% / 100% of current max bet.
- `actualBet = min(cash, round(maxBet × selectedFraction))`.
- Selected fraction is remembered.
- Multiplier is **total return including stake**.
- Aggregate Drop is losing when total cascade payout `< original stake`.
- Losing aggregate Drop applies configured Happiness penalty.

## 6. Atomic Drop lifecycle

1. Validate: no Barry flow or terminal state, no active non-Plinko action, cash >0, and available concurrent capacity (`maxConcurrentDrops`, `maxActiveBalls`).
2. Debit one stake; snapshot dropId, RNG, upgrades, insurance and timing state.
3. Advance configured action time through the scheduler; spawn one initial ball.
4. Atomically persist debit, timing, RNG and shared solver/body checkpoint before acknowledging launch. Legacy cold committed saves still replay their original root.
5. Further clicks may launch independent paid Drops while prior balls fall. No batch/autofire.
6. At 09:00 freeze GameClock and block new launches. Let every already-paid lineage finish before Barry payment, then resume leftover action minutes.
7. Resolve each Drop's descendants; accumulate only that Drop's payout, using its own committed stake and upgrades.
8. Apply its committed Insurance, credit payout and apply configured losing-Drop Happiness penalty.
9. Update Insurance in deterministic completion order; preserve any shield already armed for a future launch.
10. Remove the completed ledger entry immediately and atomically save result with all surviving bodies. Rotate the shared checkpoint owner if needed; never keep an unbounded completed ledger.
11. Once the board is empty, unlock other activities and process Barry/events in scheduler priority.

## 7. Leaving Casino

After Drop commit:
- Casino presentation may be hidden;
- physics continues while app remains active;
- player may inspect map/state;
- all non-Plinko state/cash-mutating actions are disabled until all paid Drops resolve; returning to casino permits further launches while capacity and clock allow;
- background freezes physics and GameClock together.

## 8. Reload active Drop

Persist enough exact runtime state to continue the same outcome:
- dropId;
- original stake;
- board hash/state;
- RNG state;
- each active ball position/velocity/current value/lineage/split depth/proc flags;
- elapsed fixed ticks;
- already-settled child payout if relevant;
- remaining Drop action-time / Barry pending state.

Reload never refunds stake and never produces a fresh RNG outcome.

## 9. Board derivation

Board state is a pure derivation from base board + upgrade levels. Purchase order cannot change final output.

`deriveBoard(base, centerLevel, midLevel, jackpotLevel, amplifierLevel, splitterLevel, returnLevel, biasLevel)`

Special positions are data, never hardcoded in Scene code.

Exact production special-pin positions are intentionally **TUNABLE V0**. E07 provides the physical report machinery; E10/T034 creates `BOARD_LAYOUT_V0` from symmetric seed positions and 100k+ physical runs. The agent must not treat visual preference as balance evidence.

Current `BOARD_LAYOUT_V1` lives in `balance.v0.json -> plinko.specialPinLayout`. Peg positions are referenced by stable physical ids `r{row}c{column}`; Scene code must resolve those ids through the board derivation rather than duplicate coordinates.

The historical V0 seed was selected from a standalone-Matter 100k bare-board unique-hit probe (not production-parity evidence):
- Return levels use mirrored pairs whose measured combined bare hit rates track the configured 7% / 11% / 15% / 20% frequency targets;
- Amplifier uses symmetric 1 / 2 / 3-pin sets keyed by configured physical pin count;
- Splitter starts from a separate symmetric seed slot;
- the systems do not share a peg in the max-level seed state.

These began as **placement seeds**, not proof of final upgrade EV. T035 has now enabled the real Amplifier / Return / Splitter effects and produced 100k physical milestone reports for baseline, isolated L1/max effects and combined max. The evidence is recorded in `reports/plinko/T035_CASCADE_EFFECTS.md`. Upgrade prices remain TUNABLE until full-game simulation.

2026-10-05 V1 calibration uses the Phaser-matched shared world. Return L1–L4 use mirrored pairs `r8c1/r8c7`, `r8c2/r8c6`, `r5c1/r5c4`, `r6c2/r6c4`. A fresh 100,000-root bare-contact probe measures 6.939% / 19.653% / 30.409% / 42.899%; these are contact rates without effects, not payout probabilities. Splitter moves from `r8c4` to `r4c2`, with child value 0.70 / 0.75 / 0.80 / 0.85 / 0.90. Earlier contact alone was insufficient: the old L1 child values made the moved pin reduce isolated return. Lineage/depth/cap rules, Return value preservation, base damping and prices are unchanged. See [calibration and limitations](reports/physics/2026-10-05-specials/README.md).

Known paid V0 boards also preserve their archived special positions and child-value ladder. The layout version participates in the paid-board fingerprint; V1 applies only after the old paid world drains. Completed saves keep their purchased levels. This revision does **not** accept full-game economy: measured upgrade usefulness increases profitability, and pacing/dominant-strategy gates remain open.

## 10. Upgrade systems

All numeric levels/prices are read from `balance.v0.json`.

### Center / Mid / Jackpot pockets
Change pocket payout families. Derive from levels, never mutate previously mutated values.

V0 pocket-family mapping is explicit runtime data in `balance.v0.json -> plinko.pocketFamilies`:
- `edge = [0, 9]`;
- `outerStatic = [1, 8]`;
- `mid = [2, 7]`;
- `inner = [3, 6]`;
- `center = [4, 5]`.

The `outerStatic` 4x pair is intentionally unchanged by the current Center/Mid/Jackpot tracks. If more than one active track defines an `inner` value, the derived board uses the highest configured active `inner` value (and never below the base value). This makes the board a pure function of final upgrade levels, independent of purchase order.

### Amplifier
A hit multiplies current ball value. A specific Amplifier can proc a lineage at most once.

### Return
Returns a ball to the upper board preserving **100% current value**. Maximum one Return proc per lineage in V0. V0 re-entry preserves the current physical X coordinate, moves the ball to the configured upper-board Y, resets velocity/rotation and introduces no additional RNG.

### Splitter
Creates two children using configured value per child. Guards:
- max split depth 2;
- max active balls 24;
- direct child cannot immediately re-proc the same physical Splitter.

### Jackpot Bias
Automatic side geometry that alters real physics toward outer pockets. No fake hidden edge-probability injection in production.

V0 uses cumulative mirrored angled deflector pairs derived from `balance.v0.json`: L1 adds one pair and each later level adds one additional outer-row pair. The geometry is visible in the board presentation and is part of the committed Drop fingerprint, so reload cannot silently change an in-flight trajectory.

Historical pre-2026-10-03 100k physical evidence is recorded in `reports/plinko/T036_JACKPOT_BIAS.md`. In the accepted seed, edge-pocket probability rises monotonically from **1.102% at L0** to **1.982% / 2.627% / 4.867% / 5.589%** at L1–L4, with **0 stuck outcomes at every level**. The corresponding bare-board EV rises to **1.310413x at L4**. This validates the historical physical effect only; prices and full-game economy remain TUNABLE until E13/E21.

2026-10-03 user-authorized calibration moves the first three deflector pairs 8 logical pixels outward and the top pair 0.5 px outward. Current 100k-per-level sample (seed 67043202) measures edge probability **1.061% / 1.289% / 2.039% / 2.574% / 3.682%** for L0–L4, zero stuck at every level, and L4 bare EV **1.096945x**. Full physical upgrades also resolve 100k/100k. See `reports/physics/2026-10-03/CALIBRATION.md`. This is not a validation of full-game pacing.

Already-paid pre-calibration cascades retain their historical deflector geometry, fingerprint and solver checkpoint. The scene switches to the current geometry only after the old paid world is durably empty; unknown fingerprints still fail validation. No stake refunds or rerolls.

Special pins have the same opaque radius as the configured physical peg radius. Role glyphs fit inside that footprint.

Implementation caveat confirmed during calibration: Matter resets restitution to zero and friction to one when constructing static bodies. Existing static-body restitution config fields are historical constructor inputs, not effective coefficients. The current calibration preserves that behavior in both runtime and simulators; do not enable those coefficients without a separate physical recalibration.

### Max Bet
Independent global progression; it controls allowed stake, not board EV.

## 11. Insurance exact semantics

- The **natural aggregate payout** means the physical cascade payout before Insurance.
- Losing streak and losing-Drop Happiness are based on that natural aggregate result: `natural payout < original stake`.
- Non-losing unarmed Drop resets streak.
- Reaching the configured threshold while Insurance is owned arms Insurance for the **next Drop**.
- Arming snapshots the Insurance level and floor. Buying a higher Insurance level while already armed does not retroactively improve the earned arm.
- At the next Drop commit, the armed snapshot is atomically moved into `pendingDrop.insuranceAtCommit` and removed from the persistent armed slot. This committed Drop consumes it regardless of its eventual natural result.
- Insurance applies only after the aggregate cascade payout is known.
- Floor = `original stake × snapped floor`; credited payout is `max(natural payout, floor payout)`.
- Insurance never changes which pocket/trajectory occurred and never rerolls physics.
- After an insured Drop settles, streak resets to 0 regardless of whether the floor had to add money.
- Without an insured snapshot: a natural loss increments the owned Insurance streak and arms the next Drop once threshold is reached; a natural non-loss resets streak.
- Losses before Insurance is owned do not accumulate toward a future purchase.
- streak / armed snapshot / active-Drop Insurance snapshot persist through screen changes and reload.

## 12. Performance guards

- maxActiveBalls 24;
- maxSplitDepth 2;
- object pooling;
- fixed timestep;
- x2/x4 visual speed may accelerate long cascades without changing simulation result;
- stuck-body watchdog must not truncate legitimate payouts;
- V0 watchdog acts only after sustained near-zero velocity and applies a deterministic physical nudge; it never assigns a pocket or payout.

## 13. Required physical simulation output

For bare board and every meaningful progression milestone, minimum 100k Drops:
- pocket frequencies;
- EV/RTP;
- median payout;
- standard deviation;
- P(<1x), P(>=2x), P(>=5x), P(>=10x);
- edge/jackpot probability;
- p95/p99 payout;
- mean collisions;
- child-ball count;
- Return count;
- p95/max cascade duration;
- left/right symmetry delta;
- stuck/watchdog incidence.

No upgrade-price freeze before these reports exist.

**Historical V1 publication blocker (resolved by the fixed-tick repair below):** browser/Node special-cascade payout parity failed; these configured positions/values are an unaccepted main-branch candidate, not the deployed board. See reports/physics/2026-10-05-specials/README.md. Repair deterministic effect scheduling and remeasure before publication; the old live board remains in use.

2026-10-05 fixed-tick repair: collision effects now complete synchronously after each solver step and before persistence; save latency cannot postpone them into another tick. Local browser payout/RNG/clock/needs parity (including delayed render frames) and 42,000 effect reruns pass. This supersedes the V1 scheduling blocker above. CI, Pages deployment and live verification all passed in run 37328078720; published executable `5bf6c6806dd709f6d17800cd7893cecbedffb160`. See [evidence and historical-save limits](reports/physics/2026-10-05-fixed-tick/README.md). Economy acceptance remains open.
