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
