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
