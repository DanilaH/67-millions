# AGENTS.md — 67M operating contract

## Mission

Ship a small, fun, measurable Yandex game.

The goal is not to demonstrate engineering sophistication.
Prefer the simplest architecture that preserves the specified behavior,
determinism, persistence safety, simulation capability and performance.

If deleting code preserves the same correct behavior, prefer deleting code.

---

## Project baseline

This project uses the mandatory `DanilaH/mini-games-kit/bootstrap/yandex-phaser` baseline pinned to:

`43913152e5b409cdb84515eabb69166f6caaa8bb`

Before reimplementing infrastructure or reusable interaction code, inspect the pinned kit beginning at `docs/API.md`.

Reuse suitable primitives.

The bootstrap is the floor, not the whole menu.

Do not copy Signal 2000 product policy into 67M.
Reuse mechanisms, not another game's economy, content, progression or aesthetic decisions.

---

## Canonical documentation

Before substantial implementation work, read `README.md`.

It defines the source-of-truth hierarchy.

In particular:

- `DECISION_STATUS.md` defines LOCKED / TUNABLE / OPEN / POST-MVP.
- `GAME_DESIGN.md` defines game behavior.
- subsystem specs define detailed semantics.
- `balance.v0.json` is the numeric runtime source of truth.
- `BACKLOG.md` is the canonical implementation-task list.
- `ROADMAP.md` defines milestones and gates.
- `BOOTSTRAP.md` and `docs/PROJECT_DECISIONS.md` define repository/bootstrap implementation decisions where they do not conflict with canonical product docs.

`AGENTS.md` does not override canonical product documentation.

Do not treat implementation convenience as a reason to violate the source-of-truth hierarchy.

---

## Product discipline

Implement the specified game.

Do not silently:

- invent new mechanics;
- add player-facing systems;
- add currencies, inventory or metaprogression;
- expand POST-MVP scope;
- replace a specified mechanic with a different convenient mechanic;
- turn an implementation detail into a product feature;
- import another project's product policy into this game.

A new player-facing feature that does not materially improve the intended ~30-minute run should be treated as unnecessary until proven otherwise.

If a genuine ambiguity remains:

1. check all canonical docs;
2. choose the smallest reversible implementation that preserves LOCKED decisions;
3. document the assumption;
4. do not silently promote the assumption into canonical product behavior.

If canonical documents contradict each other, stop and report the conflict.

---

## Execution discipline

Work toward the next milestone gate.

Prefer:

> the smallest complete task that makes the next playable vertical slice more real

over:

> infrastructure or polish that may become useful later.

Do not work on POST-MVP scope while current milestone P0 tasks remain.

Do not duplicate backlog tasks or create a parallel roadmap inside code/docs.

Use `BACKLOG.md` to identify the current task and `ROADMAP.md` to understand why it exists.

---

## Change discipline

Keep changes narrow and reviewable.

Before editing:

- inspect the relevant implementation and specification;
- understand the invariant being changed;
- inspect existing kit/project utilities before adding abstractions or dependencies;
- identify whether the change belongs in core, physics, persistence, platform, UI or config.

While editing:

- preserve unrelated user changes;
- do not reset, revert or reformat unrelated files;
- do not perform opportunistic broad refactors;
- do not introduce balance magic numbers outside config;
- do not duplicate authoritative state between core and presentation;
- do not weaken an invariant in one layer to make another layer easier.

Before finishing:

- inspect the diff;
- run the relevant tests/checks;
- update documentation when behavior or a TUNABLE assumption intentionally changed.

---

## Dependencies

Prefer, in order:

1. existing project capability;
2. `mini-games-kit`;
3. a small local implementation;
4. a new dependency only when it materially reduces complexity or risk.

Do not add packages for trivial helpers.

Every new dependency must have a clear purpose and must not duplicate a stable primitive already available in the kit/project.

---

## Core architecture

Prefer:

- strict TypeScript;
- pure gameplay core;
- explicit state transitions;
- deterministic RNG;
- config-driven balance;
- small modules;
- boring architecture.

Phaser owns presentation and physical simulation.

The pure core owns game rules, economy and deterministic state transitions.

Durable gameplay state must never depend on animation/audio completion callbacks.

Avoid:

- speculative abstraction;
- unnecessary framework layers;
- gameplay rules buried in rendering code;
- duplicated economic state inside Scenes;
- generic enterprise patterns with no concrete project value.

---

## Determinism and persistence

Time, RNG and economic transactions are gameplay state.

Never:

- use `Math.random()` for gameplay;
- derive offline progression from wall-clock absence;
- bypass the authoritative scheduler;
- allow reload to reroll outcomes;
- duplicate charges or payouts on restore;
- let presentation state become the economic authority;
- let animation timing decide durable game results.

`pendingDrop` remains an atomic cash-lock transaction.

Save/reload and background/resume edge cases are correctness requirements, not polish.

---

## Balance and simulation

`balance.v0.json` is the numeric source of truth.

Production and simulators must consume the same parsed config.

Never:

- tune values directly inside Scenes;
- compensate for a physics defect with economy changes;
- present a historical simulation result as evidence for a new config;
- claim a benchmark, RTP, EV, win rate or pacing result without actually running it.

A valid balance result records enough provenance to reproduce it:

- config version/hash;
- code revision;
- policy/model version;
- seeds/run count;
- output artifact.

When measured behavior is wrong:

1. verify implementation;
2. verify physical simulation;
3. verify simulator/player policy;
4. only then tune config.

A prettier Plinko board that produces the wrong distribution is a broken board.

---

## Tests and verification

Never say a test, build, benchmark, simulation, visual check or platform check passed unless you actually ran it.

Do not weaken correctness to obtain green tests.

Never delete, skip, loosen or rewrite an acceptance/regression test merely because the current implementation fails it, unless the canonical requirement itself intentionally changed.

When fixing a bug:

1. identify the violated invariant;
2. reproduce it;
3. determine the correct owning layer;
4. fix the lowest correct layer;
5. add regression coverage where practical;
6. run the relevant checks.

Do not compensate for a bug in one layer by introducing a workaround in another.

---

## Performance

Yandex/mobile is a primary target.

Treat late-game Plinko performance as gameplay correctness.

Avoid unbounded:

- physics bodies;
- particles;
- tweens;
- listeners;
- audio voices;
- per-frame allocations.

Test the worst legal gameplay state, not only the empty/start board.

Performance regressions in legal late-game Plinko states are gameplay bugs.

---

## Debug and simulation tooling

Debug controls, forced seeds, accelerated simulation and diagnostic UI are welcome when they improve verification.

They must:

- remain clearly separated from production gameplay;
- not change production rules;
- not become an alternate source of balance values;
- not accidentally ship as player-facing cheats unless explicitly intended.

Simulation tooling should prefer reproducibility over visual fidelity.

---

## UX

Do not hide critical economy information for aesthetics.

The player must be able to distinguish:

- current cash;
- next Barry payment;
- 67,000,000 ₽ principal.

Touch targets must be forgiving.

The three work minigames should be understandable almost immediately without instruction walls.

---

## References and assets

References describe direction, not material to copy.

Do not copy third-party:

- assets;
- characters;
- logos;
- UI compositions;
- audio.

Keep the fictional setting free of unintended real-brand or political references.

---

## Reporting

A useful completion report contains:

- what changed;
- which backlog task/milestone it advances;
- what was actually verified;
- test/build/simulation results that were actually run;
- remaining uncertainty or follow-up.

Avoid narrating routine implementation steps.

Never claim work is verified when it was not verified.

---

## Stop and report

Stop instead of inventing a workaround when:

- a request contradicts a LOCKED decision;
- canonical specs contradict each other;
- implementation requires changing product semantics;
- measured physics invalidates a major balance assumption;
- a platform limitation threatens the core loop;
- completing the task would require silently expanding scope.

Do not hide these cases behind a "reasonable default".
