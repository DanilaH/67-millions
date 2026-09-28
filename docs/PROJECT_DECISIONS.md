# Project decisions

## Product loop and state truth

- Core loop: survival/economy loop from work and recovery into progressively upgraded physical Plinko, under needs and Barry pressure.
- Durable progression: one run/save containing economy, needs, clock/day, Barry state, work/Plinko upgrades, events/statuses, RNG state and active durable transactions.
- Presentation-only state: transient UI animation/audio/tween state unless explicitly required to restore an active Plinko physical outcome.
- RNG boundary: one serializable seeded gameplay RNG; `Math.random()` is forbidden for gameplay.

## Startup and loading

- First semantic presentable frame: first correct usable game surface, initially the M0 bootstrap scene and later the real intro/map surface.
- Runtime format: AVIF capability probe with WebP fallback through mini-games-kit.
- Asset loading boundaries: to be measured before production-art scale-up; no inherited Signal 2000 byte/DPR constants.

## Layout and devices

- Supported orientation: landscape.
- Logical gameplay viewport: 1280×720 for Plinko/content design.
- Target: browser/Yandex, desktop + mobile touch.
- DPR/render-density cap: open until device measurements.

## Persistence and recovery

- Save schema: versioned project-owned SaveState implemented in M0/E02.
- Local browser persistence exists before Yandex cloud persistence.
- Active ordinary actions restore without duplicate charge.
- Active Plinko Drop must restore the exact economic/physical outcome state.
- Corrupt/incompatible saves fail safely; migration/repair is explicit.

## Monetization and lifecycle

- Interstitials only at safe logical pauses; V0 safe points are post-Game-Over and post-Victory.
- Rewarded ads are not part of core balance.
- Background/ads pause clock, physics and audio with no wall-clock catch-up.

## Onboarding

- Contextual first-day tutorial only; semantic progress follows actual gameplay events.
- No permanent metaprogression or durable tutorial reward may change the fresh-run economy.

## Intentional bootstrap deviations

None at M0 bootstrap creation.


## Plinko pocket-family derivation

- V0 pocket upgrade families are explicit data in `balance.v0.json`, not Scene constants.
- Symmetric index mapping: edge `[0,9]`, outerStatic `[1,8]`, mid `[2,7]`, inner `[3,6]`, center `[4,5]`.
- The current Center/Mid/Jackpot tracks do not alter the existing outerStatic 4x pair.
- When active Center and Mid levels both define an inner-pocket value, derivation uses the maximum active configured value (never below base), so purchase order cannot change the final board.
- A committed Drop snapshots its pocket upgrade levels and derived board fingerprint; upgrades cannot retroactively alter an in-flight payout.


## Plinko special-pin physical semantics

- `BOARD_LAYOUT_V0` special effects are implemented as physical Matter interactions; no hidden payout/probability routing is allowed.
- Amplifier proc guards are lineage-wide per physical Amplifier id.
- Return V0 preserves 100% current value and re-enters at the same X coordinate in the upper board without consuming gameplay RNG.
- Splitter descendants inherit lineage proc guards; split depth and active-ball caps are core rules, not Scene heuristics.
- Ball-ball collisions are disabled in V0 so multiball descendants interact with the same static board without introducing order-dependent child collisions.
- Technically stuck Matter equilibrium bodies use the config-driven deterministic anti-stall watchdog. The watchdog nudges physics only after sustained near-zero speed and never selects a pocket or settles payout.
- Watchdog stationary ticks are part of the durable active-Drop snapshot so reload does not reset the recovery state.


## Jackpot Bias physical progression

- Jackpot Bias V0 is implemented only through visible Matter geometry; there is no hidden edge-pocket probability or payout override.
- The V0 progression is cumulative mirrored angled deflector pairs. Each level adds one pair in an outer board row, and final geometry is a pure derivation from `balance.v0.json`.
- The fourth-pair seed uses `deflectorOffsetX=110`; nearby 109 px was rejected because the physical system crosses a sharp threshold and produced an excessive EV jump in measurement.
- A committed Drop snapshots the Bias level and a fingerprint containing the derived Bias geometry. Upgrade/reload cannot retroactively alter an active Drop.
- Final acceptance evidence is `reports/plinko/T036_JACKPOT_BIAS.md`: 100k per level, monotonic edge probability, zero stuck outcomes, plus a 100k combined special-pin interaction run.
- Bias EV and upgrade prices are not economically frozen by T036. Full-game dominance/pacing remains an E13/E21 decision.


## Insurance snapshot and settlement semantics

- Insurance is an economic post-processing system; it never alters Plinko physics, pocket routing or RNG.
- The physical cascade result before Insurance is the natural aggregate result. Natural loss controls losing streak and the losing-Drop Happiness penalty even when Insurance later tops payout up to a non-losing floor.
- Insurance only starts accumulating losses after at least L1 is owned.
- When a threshold is reached, the armed state stores the exact Insurance `level + floor`. A later upgrade does not retroactively strengthen that armed benefit.
- Buying a lower-threshold level does not arm retroactively from an existing streak; a subsequent natural Drop result drives the next streak transition.
- On Drop commit, the arm snapshot moves atomically into `pendingDrop.insuranceAtCommit` and the persistent armed slot clears. Reload therefore cannot reuse the same arm on another Drop.
- The committed insured Drop consumes that snapshot even when its natural payout already exceeds the floor.
- After insured settlement, streak resets to zero. The final credited payout is the greater of natural aggregate payout and snapped stake floor.
