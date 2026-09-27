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

Theoretical ideal-binomial EV = **0.849609375x**. Bare V0 has been physically calibrated with the Matter runner; the accepted 100k sample measured **0.870225x EV**, **52.188% combined center**, **0.613% maximum mirrored-pocket delta**, and **0 stuck/watchdog outcomes**. The ideal distribution is a target shape, not a fake probability override.

## 4. Physics seed

Exact calibrated physics values live in `balance.v0.json -> plinko.physicsSeed`. Bare V0 currently uses gravity 1.0, ball restitution 0.155, peg restitution 0.6, frictionAir 0.023 and wall restitution 0.2. These values remain TUNABLE V0 and may change only through config + measured physical reports, never Scene constants.

## 5. Bet / payout semantics

- Quick bet buttons: 25% / 50% / 100% of current max bet.
- `actualBet = min(cash, round(maxBet × selectedFraction))`.
- Selected fraction is remembered.
- Multiplier is **total return including stake**.
- Aggregate Drop is losing when total cascade payout `< original stake`.
- Losing aggregate Drop applies configured Happiness penalty.

## 6. Atomic Drop lifecycle

1. Validate: no Barry flow, no active Drop, cash >0, bet ≤ cash/maxBet.
2. Debit stake and persist committed `pendingDrop`.
3. Snapshot dropId, RNG state, board state/hash, bet and timing state.
4. Spawn initial ball.
5. Advance configured Drop action-time through scheduler.
6. If the action crosses 09:00, GameClock freezes at 09:00, cascade resolves, payout settles, Barry runs, then remaining action-time continues after payment.
7. Resolve all descendants/cascade.
8. Calculate one aggregate payout.
9. Apply Insurance to aggregate payout.
10. Credit payout.
11. Apply losing-Drop Happiness penalty when applicable.
12. Update Insurance state.
13. Clear `pendingDrop` and atomic save.
14. Resolve pending Barry/event according to scheduler priority.

## 7. Leaving Casino

After Drop commit:
- Casino presentation may be hidden;
- physics continues while app remains active;
- player may inspect map/state;
- all other state/cash-mutating actions are disabled until resolve;
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

## 10. Upgrade systems

All numeric levels/prices are read from `balance.v0.json`.

### Center / Mid / Jackpot pockets
Change pocket payout families. Derive from levels, never mutate previously mutated values.

### Amplifier
A hit multiplies current ball value. A specific Amplifier can proc a lineage at most once.

### Return
Returns a ball to the upper board preserving **100% current value**. Maximum one Return proc per lineage in V0.

### Splitter
Creates two children using configured value per child. Guards:
- max split depth 2;
- max active balls 24;
- direct child cannot immediately re-proc the same physical Splitter.

### Jackpot Bias
Automatic side geometry/bumpers that alter real physics toward outer pockets. No fake hidden edge-probability injection in production.

### Max Bet
Independent global progression; it controls allowed stake, not board EV.

## 11. Insurance exact semantics

- Losing streak is based on aggregate Drop result.
- Non-losing Drop resets streak.
- Reaching configured threshold arms Insurance for the **next Drop**.
- Insurance applies only after aggregate cascade payout is known.
- Floor = `original stake × configured floor`.
- Armed Insurance is consumed by that Drop regardless of natural result.
- After insured Drop, streak resets to 0.
- streak/armed state persists through screen changes and reload.

## 12. Performance guards

- maxActiveBalls 24;
- maxSplitDepth 2;
- object pooling;
- fixed timestep;
- x2/x4 visual speed may accelerate long cascades without changing simulation result;
- stuck-body watchdog must not truncate legitimate payouts.

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
