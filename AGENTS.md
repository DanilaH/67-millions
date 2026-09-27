# 67M agent contract

This project uses the mandatory `DanilaH/mini-games-kit/bootstrap/yandex-phaser` baseline pinned to:
`43913152e5b409cdb84515eabb69166f6caaa8bb`.

## Read before implementation

Read in this order:
1. `README.md`
2. `DECISION_STATUS.md`
3. `GAME_DESIGN.md`
4. `TECH_SPEC.md`
5. relevant subsystem spec
6. `balance.v0.json`
7. `BOOTSTRAP.md`
8. `docs/PROJECT_DECISIONS.md`

The canonical source-of-truth hierarchy from `README.md` wins over implementation convenience.

## mini-games-kit rule

Before reimplementing infrastructure or reusable interaction code, inspect the pinned kit beginning at `docs/API.md`. Reuse suitable primitives. The bootstrap is the floor, not the whole menu.

Do not copy Signal 2000 product policy into 67M. Reuse mechanisms, not another game's economy/content/aesthetic decisions.

## Architecture invariants

- Pure gameplay core must not depend on Phaser or DOM.
- All gameplay randomness is seeded and serializable; no gameplay `Math.random()`.
- Runtime balance numbers come from parsed `balance.v0.json`; no Scene magic numbers.
- Time advances only through the authoritative scheduler.
- Durable state never depends on animation/audio completion callbacks.
- `pendingDrop` remains an atomic cash-lock transaction.
- Save/reload behavior must preserve economic outcomes, not reroll them.
- No new gameplay mechanic may be invented to solve an implementation edge case.

## Scope

Follow `BACKLOG.md` milestone order. Do not pull post-MVP systems forward. If a locked rule appears impossible, document the conflict before changing canonical docs.
