# BALANCE V0 — human-readable view

> **Non-authoritative view.** Runtime numeric source of truth is `balance.v0.json`. This file should be regenerated/updated whenever the JSON changes.

Config version: `0.8-candidate-price0.5-payout1.5`. This is the T070 playtest candidate, not a frozen RC. Target successful median: ~30 real minutes.

Historical 2026-10-01 T070 changes: job salaries ×1.5; job and EV/special/Insurance upgrade prices ×0.5; max-bet prices and all game rules, needs, Barry payments and physics are unchanged. See `reports/release/2026-10-01/README.md` for exact candidate-hash evidence and measurement limits.

## Time / start
- 1 game minute = 3 real seconds.
- Game day boundary: 09:00.
- Navigation: 0 game minutes.
- One initial Plinko Drop: +15 game minutes.
- Start: 09:05, cash 500 ₽, all four stats = 100.
- Principal: 67 000 000 ₽, manual one-time payment only.

## Barry ladder
`3 000 → 3 600 → 4 300 → 5 200 → 6 200 → 8 100 → 10 500 → 13 600 → 17 700 → 23 000 → 34 500 → 51 800 → 77 700 → 116 600 → 174 900 → 314 800 → 566 600 → 1 020 000 → 1 840 000 → 3 300 000 → 5 950 000 → 10 700 000 → 19 300 000 → 34 700 000 → 62 400 000 ₽`
After listed ladder: ×2 if run continues.

## Needs / sleep
- Satiety: -4/h.
- Energy awake: -1.5/h.
- Happiness awake: -0.3/h.
- Each need <= 20: -1.5 HP/h; at zero additionally -8 HP/h.
- Full sleep: 7h; Health +20; Energy ->100.
- Missing sleep: -5% work payout/hour, floor 65%.

## Work
### dishes
- L1: 16:00-00:00; 4 500 ₽; 120m; Energy -12; Happiness -3; upgrade 0 ₽.
- L2: 13:00-03:00; 9 750 ₽; 120m; Energy -12; Happiness -3; upgrade 2 500 ₽.
- L3: 24/7; 18 000 ₽; 120m; Energy -12; Happiness -3; upgrade 20 000 ₽.
### trash
- L1: 00:00-08:00; 5 400 ₽; 150m; Energy -18; Happiness -5; upgrade 0 ₽.
- L2: 21:00-11:00; 11 400 ₽; 150m; Energy -18; Happiness -5; upgrade 3 000 ₽.
- L3: 24/7; 21 750 ₽; 150m; Energy -18; Happiness -5; upgrade 25 000 ₽.
### courier
- L1: 08:00-16:00; 6 300 ₽; 180m; Energy -15; Happiness -4; upgrade 0 ₽.
- L2: 05:00-19:00; 12 750 ₽; 180m; Energy -15; Happiness -4; upgrade 3 500 ₽.
- L3: 24/7; 25 500 ₽; 180m; Energy -15; Happiness -4; upgrade 30 000 ₽.

Failure: salary 0; fine 25% potential payout; extra Happiness -8.

## Food
| ID | Price | Satiety | Happiness | Energy | HP | Time |
|---|---:|---:|---:|---:|---:|---:|
| FOOD_01 | 150 | +30 | -2 | +0 | +0 | 45m |
| FOOD_02 | 250 | +20 | +0 | +0 | +0 | 10m |
| FOOD_03 | 350 | +40 | +1 | +0 | +0 | 25m |
| FOOD_04 | 500 | +45 | +6 | +0 | +0 | 15m |
| FOOD_05 | 700 | +60 | +8 | +0 | +0 | 20m |
| FOOD_06 | 900 | +75 | +10 | +0 | +0 | 25m |
| FOOD_07 | 1 200 | +90 | +12 | +0 | +0 | 30m |
| FOOD_08 | 1 800 | +100 | +20 | +0 | +0 | 45m |
| FOOD_09 | 350 | +5 | -2 | +25 | -3 | 5m |
| FOOD_10 | 1 100 | +60 | +25 | +0 | +0 | 60m |

## Entertainment / hygiene
- FREE_FUN: 0 ₽; Happiness +15; 60m.
- PC_CLUB: 500 ₽; Happiness +40; 90m.
- CINEMA: 900 ₽; Happiness +70; 120m.
- Shower: 300 ₽; 30m; removes SMELLY.

## Dumpster
- 45m; Energy cost 20.
- Missing Energy -> Happiness ×0.75; then missing Happiness -> HP ×0.5.
- Empty chance by consecutive search: 55% → 62% → 70% → 78% (cap).
- Loot algorithm: first roll empty chance; only on non-empty result choose category with normalized conditional weights 25:12:6:2.
- Cheap food: +30 Satiety, -2 Happiness immediately.
- Cash: uniform integer 200–800 ₽.
- Sellable object: immediately auto-sold for uniform integer 1,000–3,000 ₽.
- Rare find: immediate uniform integer 3,000–7,000 ₽.
- Every search applies SMELLY.

## Events
- Checkpoints: 13:00, 17:00, 21:00, 01:00, 05:00.
- Chance/checkpoint: 20%; max 2/game day.
- No check during sleep; one pending event maximum; rolls suppressed while one is pending.
- Pay choice disabled if unaffordable.

## Plinko geometry / physics seed

- Logical viewport: 1280×720.
- Board area: 560×540.
- 9 rows / 10 pockets; peg spacing 48×27 px; ball radius 10; peg radius 6.
- Spawn jitter: ±4 px around center.
- Fixed timestep: 60 Hz.
- Physics seed: gravityY 1.0, ball restitution 0.155, peg restitution 0.6, frictionAir 0.026, wall restitution 0.2.
- All values are tunable through JSON + physical reports.
- Historical standalone-Matter evidence is not production calibration. Current Phaser-matched 100k bare probe: EV 0.8512025x, center 54.981%, edges 0.692%, unresolved 0/100,000 (seed 67108200).
- The ideal-binomial shape remains a target/reference; production payout uses the measured Matter physics, never a hidden probability override.

## Plinko base
- Pockets: `12x | 4x | 1.5x | 1x | 0.25x | 0.25x | 1x | 1.5x | 4x | 12x`.
- Target bare EV ≈ 0.85x; ideal-binomial exact EV for these pockets = 0.849609375x.
- Quick bets: 25% / 50% / 100% current max bet; multiplier = total return.

### Max bet progression
| Level | Max bet | Upgrade price |
|---:|---:|---:|
| 0 | 500 ₽ | 0 ₽ |
| 1 | 2 500 ₽ | 500 ₽ |
| 2 | 12 500 ₽ | 1 800 ₽ |
| 3 | 30 000 ₽ | 7 000 ₽ |
| 4 | 40 000 ₽ | 250 000 ₽ |
| 5 | 65 000 ₽ | 1 500 000 ₽ |
| 6 | 100 000 ₽ | 6 000 000 ₽ |

**Price provenance:** 2026-10-05 economy candidate, SHA-256 `53c9ab00f72eecf71f379edab8938f7dc3d522fa3a28b4b05c292fd752f1afdc`. See [selection and independent comparison](reports/pacing/2026-10-05-economy/README.md). First-level board prices, center and Insurance are unchanged. Other board tracks cost ×2/×4/×8/×12 at levels 2/3/4/5 relative to the previous config; effects and physics are unchanged. Purchased levels survive; future stakes use the new caps, while already-paid stakes retain their original amounts. Human pacing and continuous-burst dominance remain open.

### Insurance
- L1: 500 ₽; after 3 losing Drop(s), next Drop floor 0.75x.
- L2: 2 500 ₽; after 2 losing Drop(s), next Drop floor 0.90x.
- L3: 12 500 ₽; after 1 losing Drop(s), next Drop floor 1.00x.

### Other Plinko upgrade prices
T070 playtest candidate: prices are listed in the numeric JSON and sampled by the retained exact-config physical/full-game reports. Broader build/event-robustness review and human pacing remain gates before RC freeze.

## Initial calibration hypotheses
- Baseline rational policy should not be near-guaranteed; initial tuning hypothesis ≈30–45% wins.
- Very cautious / mostly-work policy should usually fail Barry growth.
- Aggressive/high-variance policies should win faster when successful but fail more often.
- Initial work-count corridor 25–50 minigames is subordinate to the stronger ~30-real-minute session target; lower repetition is acceptable/preferred if required.
- These are design targets, not measured facts for this exact config.

## 2026-10-05 special-pin candidate

`BOARD_LAYOUT_V1`: Return contact targets 7% / 20% / 30% / 43%; measured bare contact rates 6.939% / 19.653% / 30.409% / 42.899%. Splitter is on row 4 (zero-indexed), with 70% / 75% / 80% / 85% / 90% value per child. Prices and all other upgrade values are unchanged. These are physical contacts, never hidden payout routing. [Evidence](reports/physics/2026-10-05-specials/README.md); [40 matched full-game runs before/after](reports/pacing/2026-10-05-specials/README.md). Full-game balance remains unaccepted: the improved effects increase the sampled win count.

**Historical V1 publication blocker (resolved by the fixed-tick repair below):** browser/Node special-cascade payout parity failed; these configured positions/values are an unaccepted main-branch candidate, not the deployed board. See reports/physics/2026-10-05-specials/README.md. Repair deterministic effect scheduling and remeasure before publication; the old live board remains in use.

2026-10-05 fixed-tick repair: collision effects now complete synchronously after each solver step and before persistence; save latency cannot postpone them into another tick. Local browser payout/RNG/clock/needs parity (including delayed render frames) and 42,000 effect reruns pass. This supersedes the V1 scheduling blocker above. CI, Pages deployment and live verification all passed in run 37328078720; published executable `5bf6c6806dd709f6d17800cd7893cecbedffb160`. See [evidence and historical-save limits](reports/physics/2026-10-05-fixed-tick/README.md). Economy acceptance remains open.

## 2026-10-06 progression playtest candidate

Pocket upgrades now redistribute income from rare edges toward earlier regular returns:
- Center I/II: 0.50× / 0.75× (previously 0.35× / 0.40×); Center II inner pockets 1.15×.
- Mid I: 2.0× and inner 1.2× (previously 1.8× / 1.1×). Mid II/III unchanged.
- Edge I/II/III: 16× / 22× / 32× (previously 25× / 50× / 100×).

Prices, max bets, physical routes, base board and special effects are unchanged. Current paid roots retain the old multiplier table; the next paid world uses the candidate. [Payback and matched progression evidence](reports/pacing/2026-10-06-payback/README.md). This candidate improves sampled purchase-gap/final-phase distribution during concurrent play but increases modeled survival and slows solo play. The ~30-minute pacing and challenge gates remain OPEN; this is not a balance freeze.

## 2026-10-07 paid capacity playtest candidate

New runs start with two simultaneous paid launches. The “Больше шаров” track unlocks 3 / 4 / 6 places for 5,000 / 25,000 / 1,000,000 ₽. Each click still buys exactly one root; Splitter descendants do not consume paid-root places. Late stake caps are 40,000 / 65,000 / 100,000 ₽; existing max-bet upgrade prices are unchanged. Old saves without the capacity field retain six places, and already-paid roots retain their original stake and payout rules.

This is a user-authorized playtest candidate, not accepted final balance. Diverse-seed simulation evidence and remaining policy/pacing risks are recorded in [the final candidate audit](reports/pacing/2026-10-07-final-check/README.md). Human pacing (T071), long gaps between upgrades and optimal purchase/launch policy remain open.
