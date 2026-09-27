# DEPENDENCY GRAPH

`BACKLOG.md` owns tasks. This file only shows epic-level dependencies and safe parallelization.

```text
M0
E00 Project Foundation
   ↓
E01 Deterministic Core ─────→ E02 Save Core
   │                           │
   └──────────────┬────────────┘
                  ↓
M1               E03 Barry / Run Lifecycle
                  ↓
                 E04 Needs / Sleep / Action Lifecycle
                  ├────────────→ E05 Early Yandex Smoke
                  ↓
M2               E06 Bare Plinko Physics
                  ↓
                 E07 Physical Plinko Simulator
                  ↓
                 E08 Plinko Transaction Safety
                  ├────────────→ E09 Early Plinko Audio/Perf
                  ↓
M3        ┌────── E10 Plinko Progression ──────┐
          ├────── E11 Jobs / Recovery Economy ─┤
          └────── E12 Events ──────────────────┤
                                               ↓
                                      E13 Full-game Simulator
                                               ↓
                                      E14 Progression Stress
                                               ↓
M4                   E15 Production Minigames
                       ↓
                      E16 Main UX / Screens
                       ↓
                      E17 Tutorial / Content
                       ↓
M5         ┌────────── E18 Art
           ├────────── E19 Final Audio
           └────────── E20 Yandex Release Integration
                       ↓
M6                   E21 Final Balance / Playtest
                       ↓
                      E22 Reliability / Performance
                       ↓
                      E23 RC
```

## Parallelization

After E01/E02 foundation:
- parts of E03 and E04 may run in parallel;
- E05 smoke can begin as soon as a minimal build exists.

After M2 bare Plinko is stable:
- E10, E11 and E12 can progress in parallel;
- E13 starts as soon as enough pure-core systems exist; it must not wait for production minigames.

After M3 gate:
- E15 implementation can run alongside early E18/E19 asset preparation;
- E16 shell can begin while final minigame visuals are still placeholder.

Do not move later:
- core SaveState (E02) cannot be deferred to Yandex integration;
- physical simulator (E07) cannot be deferred until final balance;
- full-game simulator (E13) cannot be deferred to M6;
- performance checks start in E09/E14, not only E22.

Do not move earlier:
- final Plinko prices before physical + full-game evidence;
- final tutorial polish before main flow is stable;
- final balance freeze before real-session pacing tests.
