# ROADMAP — milestones and epics only

`BACKLOG.md` is the single source of implementation tasks. This file intentionally does **not** duplicate stories.

## M0 — Foundation

Goal: deterministic project skeleton that can build, test, save locally and run core logic without Phaser UI.

Epics:
- **E00 Project foundation** — TypeScript/Phaser, quality commands, CI, config schema.
- **E01 Deterministic core** — RNG, GameClock, scheduler, state transactions.
- **E02 Save core** — versioned SaveState, local adapter, restore/migration.

Gate:
- CI green;
- same seed/actions => same core state;
- local save/restore works;
- config validates on boot.

## M1 — Survival / debt vertical slice

Goal: ugly but complete one-day survival loop with debug actions.

Epics:
- **E03 Barry / run lifecycle** — 67m principal, daily payment, victory/game over/restart.
- **E04 Needs / sleep / generic action lifecycle**.
- **E05 Early Yandex smoke** — real platform boot/lifecycle/mobile landscape smoke, not full release integration.

Gate:
- start → debug work/food/sleep → 09:00 Barry → survive/fail/restart;
- Barry correctly pauses an active action;
- HP death works;
- browser background/offline time is zero.

## M2 — Plinko vertical slice

Goal: real physical gambling loop is measurable, deterministic, save-safe and already feels minimally satisfying.

Epics:
- **E06 Bare Plinko physics**.
- **E07 Physical Plinko simulator**.
- **E08 Plinko transaction / reload safety**.
- **E09 Plinko feedback + early performance** — placeholder bounce/pocket audio, mobile bare-board smoke.

Gate:
- 100k bare-board report;
- EV/distribution/symmetry acceptable;
- Drop can leave Casino and reload without reroll;
- 09:00 crossing behavior correct;
- no obvious mobile performance problem.

## M3 — Full economy + early balance

Goal: every major economy system exists with placeholder presentation and can be simulated end-to-end before polishing minigames.

Epics:
- **E10 Plinko progression** — automatic upgrades, board derivation, Insurance, max bet.
- **E11 Jobs / progression / recovery economy** — job levels, food, entertainment, dumpster, SMELLY.
- **E12 Events**.
- **E13 Full-game simulator** — basic bots, full-run reports, pacing proxy.
- **E14 Plinko progression stress** — 24-ball/splitter performance + special-pin audio prototype.

Gate:
- bot can produce victory, Barry loss and HP death;
- no obvious economic softlock;
- first balance report exists for exact config hash;
- session-duration/repetition risk is measured before production minigame polish;
- 24-ball stress is technically viable.

## M4 — Production gameplay / UX

Goal: replace placeholders with actual player-facing gameplay and teach the loop.

Epics:
- **E15 Three production minigames** — dishes, trash, courier.
- **E16 Main screens / HUD / flows**.
- **E17 Tutorial + first-session content**.

Gate:
- complete run playable manually without debug controls;
- first-day tutorial reaches work → Plinko → needs → Barry without external explanation;
- touch/mouse flows are reliable.

## M5 — Presentation + platform completion

Goal: game looks/sounds like the intended black-comedy product and is fully wired to Yandex services.

Epics:
- **E18 Art / visual production**.
- **E19 Final audio / juice**.
- **E20 Yandex release integration** — cloud save adapter, analytics, ads, metadata.

Gate:
- hand-painted dirty-cartoon identity is coherent;
- Plinko feedback remains readable at max legal cascade;
- platform lifecycle/save/ads/analytics work on target devices.

## M6 — Balance / reliability / release candidate

Goal: tune exact config against real physics, real sessions and stress tests; freeze an RC.

Epics:
- **E21 Final balance / playtest**.
- **E22 Performance / save / lifecycle soak**.
- **E23 Acceptance / release candidate**.

Gate:
- exact config has reproducible reports;
- successful run pacing is around the ~30-minute target;
- no unacceptable dominant strategy/repetition;
- `MVP_ACCEPTANCE.md` passes;
- RC package is ready.
