# BACKLOG — canonical implementation tasks

This is the **only** canonical implementation-task list. `ROADMAP.md` names milestones/epics only.

Priority:
- **P0** blocks the current/next milestone gate.
- **P1** required for MVP but not the immediate gate.
- **P2** RC polish/hardening.

Definition of Done for every task:
- implementation complete;
- numeric behavior comes from `balance.v0.json` where applicable;
- deterministic rules tested where practical;
- persistent-state behavior tested if changed;
- no silent product-rule invention;
- docs updated when implementation intentionally changes a tunable assumption.

## E00 — Project foundation

### T001 [P0] Bootstrap TypeScript + Phaser
Acceptance: strict TS; local dev; production build; placeholder scene.

### T002 [P0] Quality pipeline
Acceptance: `typecheck`, tests, build; CI runs all three.

### T003 [P0] Balance schema/loader
Acceptance: runtime validation; malformed config fails fast; no Scene magic numbers.

### T004 [P1] mini-games-kit compatibility probe
Acceptance: compatible version documented; one real integration proof.

## E01 — Deterministic core

### T005 [P0] Serializable seeded RNG
Acceptance: same seed/action sequence => same rolls; no gameplay Math.random.

### T006 [P0] Authoritative GameClock
Acceptance: active passive ticking; background zero progression; 09:00→09:00 day.

### T007 [P0] Boundary scheduler
Acceptance: action time jumps pause at 09:00; remaining time resumes correctly; soft-event pending supported.

### T008 [P0] Core player/economy state
Acceptance: money integer; needs/HP clamp; terminal state emitted once.

## E02 — Save core

### T009 [P0] Versioned SaveState + local adapter
Acceptance: serialize/restore core run; version field; atomic replacement.

### T010 [P0] ActiveAction persistence
Acceptance: timed action resumes remaining duration without duplicate charge.

### T011 [P1] Save validation/migration hook
Acceptance: incompatible/corrupt save fails safely; migration entrypoint exists.

## E03 — Barry / run lifecycle

### T012 [P0] 67m principal + manual victory
Acceptance: no partial principal; exact manual payment; no auto-win.

### T013 [P0] Daily Barry ladder
Acceptance: due 09:00; payment does not reduce principal; next index correct.

### T014 [P0] Barry hard interrupt
Acceptance: pauses work/action; sleep ends; Plinko exception delegated to E08.

### T015 [P0] Game Over + restart
Acceptance: failed payment / HP0; restart new seed and resets all progression.

## E04 — Needs / sleep / generic actions

### T016 [P0] Passive needs + HP attrition
Acceptance: config rates; stacked low/zero penalties.

### T017 [P0] Sleep + sleep debt
Acceptance: partial linear restore; 09:00 wake; next-cycle work modifier.

### T018 [P0] Generic timed paid action transaction
Acceptance: debit start/effect completion; Barry pause; no effect after terminal failure.

### T019 [P0] Placeholder work transaction
Acceptance: Energy/Happiness cost at start; payout/fine only completion; future salary cannot pay 09:00 Barry.

## E05 — Early Yandex smoke

### T020 [P1] Platform adapter + Yandex boot smoke
Acceptance: local fallback + real SDK boot path; landscape/mobile basic run.

### T021 [P1] Platform pause/resume smoke
Acceptance: background and platform interruption preserve active run without wall-clock catch-up.

## E06 — Bare Plinko physics

### T022 [P0] 9-row physical board
Acceptance: configured geometry; fixed timestep; 10 pockets; center+jitter spawn.

### T023 [P0] Bet controls + settlement
Acceptance: 25/50/100%; total-return semantics; aggregate payout; -1 Happiness losing Drop.

### T024 [P0] Hidden-Casino continuation
Acceptance: scene can hide while physics continues; UI inspection only.

## E07 — Physical Plinko simulator

### T025 [P0] Accelerated 100k runner
Acceptance: config/seed input; no presentation dependency; JSON/CSV output.

### T026 [P0] Bare-board calibration report
Acceptance: frequency, EV, symmetry, variance, cascade duration, stuck incidence.

### T027 [P1] Milestone-board report command
Acceptance: reusable report by board upgrade state + config hash.

## E08 — Plinko transaction / reload safety

### T028 [P0] Atomic pendingDrop
Acceptance: stake committed before outcome; no other cash mutation while active.

### T029 [P0] Exact active-Drop save/restore
Acceptance: positions/velocities/value/lineage/RNG restored; no reroll/refund/duplicate payout.

### T030 [P0] Drop crossing 09:00
Acceptance: clock freezes at 09:00; cascade resolves; payout may fund Barry; remaining Drop minutes continue after payment.

## E09 — Plinko early feedback / performance

### T031 [P1] Placeholder Plinko audio
Acceptance: bounce + pocket + bad/good result cues; voice limit exists.

### T032 [P1] Bare-board mobile performance smoke
Acceptance: target device/profile has no obvious sustained jank/leak.

## E10 — Plinko progression

### T033 [P0] Derived pocket/max-bet progression
Acceptance: levels drive board; purchase order independent; max bet from config.

### T034 [P0] Special-pin data layout + calibration seed
Acceptance: positions are data; BOARD_LAYOUT_V0 created from symmetric seed and physical reports, not Scene taste.

### T035 [P0] Amplifier / Return / Splitter
Acceptance: lineage guards; Return preserves 100%; split depth/ball cap enforced.

### T036 [P1] Jackpot Bias geometry
Acceptance: real physics geometry; impact measured by runner.

### T037 [P1] Insurance lifecycle
Acceptance: aggregate streak/armed/floor/consume/reset semantics exactly match spec and persist save.

## E11 — Jobs / recovery economy

### T038 [P0] Job levels/windows/Energy gate
Acceptance: start-only windows incl overnight; L3 24/7; sleep modifier.

### T039 [P0] Food + entertainment
Acceptance: all config entries; correct time/effects; free recovery path exists.

### T040 [P0] Dumpster two-stage loot
Acceptance: empty chance first; normalized non-empty weights; no double-nothing; immediate loot only.

### T041 [P0] SMELLY + shower
Acceptance: courier blocked; paid entertainment reduced; dishes/trash remain; shower clears.

## E12 — Events

### T042 [P0] Event checkpoints/pending semantics
Acceptance: fixed checkpoints; no sleep checks; max one pending; max 2/day; no repeat.

### T043 [P0] Ten V0 event definitions
Acceptance: both choices; pay choice affordability; eligibility predicates; modifiers refresh not stack.

### T044 [P1] Event save/reload determinism
Acceptance: shown/pending event cannot be rerolled by refresh.

## E13 — Full-game simulator

### T045 [P0] Pure-core complete-run runner
Acceptance: can reach victory, Barry loss, HP death with exact config hash.

### T046 [P0] Baseline policies
Acceptance: CAUTIOUS, BASELINE_GROWTH, AGGRESSIVE, WORKER at minimum; explicit work-failure probability.

### T047 [P1] High-variance/reckless policies
Acceptance: DEGENERATE + RECKLESS_NEEDS.

### T048 [P0] Balance/pacing report
Acceptance: required metrics incl real-duration proxy, work count, dumpster rescue, income source, anomaly seeds.

## E14 — Progression stress

### T049 [P1] 24-ball/Splitter stress gate
Acceptance: cap respected; no runaway bodies; performance measurement captured before M4.

### T050 [P1] Special-pin audio prototype
Acceptance: Amplifier/Splitter/Return readable without clipping at stress state.

## E15 — Production minigames

### T051 [P0] Dishes
Status: 2026-10-02: continuous eraser texture and area coverage; mouse/touch and repeat-entry regressions checked. See reports/release/2026-10-02/GAMEPLAY_AUDIT.md.
Acceptance: 20 sec; >=90% clean; forgiving touch/mouse.

### T052 [P0] Trash
Status: 2026-10-02: scene re-entry state reset; two shifts through the map without reload checked for mouse/touch.
Acceptance: 5 bags; 25 sec; all accepted in dumpster; forgiving grab/target.

### T053 [P0] Courier
Status: 2026-10-02: actual route traversal, sprite-size swept collision and arrival settlement; deterministic model and repeated mouse/touch shifts checked.
Acceptance: draw route; one redraw before start; 2–4 obstacles; deterministic pass/fail.

### T054 [P1] Barry pause/resume across all minigames
Acceptance: exact minigame state pauses in runtime; work transaction remains correct.

## E16 — Main screens / UX

### T055 [P0] Persistent HUD + Main Map
Acceptance: time, cash, next Barry, 67m, countdown, four needs, statuses; navigation costs zero time.

### T056 [P0] Work/food/sleep/entertainment/dumpster flows
Acceptance: pre-action cost/time/effect visible; lock reason readable.

### T057 [P0] Casino upgrade/bet/result UI
Status: 2026-10-02: exit shutdown crash, repeated entry, passive clock and overlapping controls fixed; detailed evidence in reports/release/2026-10-02/GAMEPLAY_AUDIT.md.
Acceptance: quick bets; upgrade state; active-Drop locks visually clear; map payout toast.

### T058 [P0] Game Over / Victory flows
Acceptance: reason/stats/restart; 67m manual confirmation.

## E17 — Tutorial / content

### T059 [P0] First-day contextual tutorial
Status: 2026-10-02: context-aware placement, hidden during actions/modals/cascade; board and action cards remain unobscured.
Acceptance: Barry → first work → Drop → cheap upgrade → needs → food/sleep → first Barry payment; no text wall.

### T060 [P1] Content copy pass
Acceptance: 10 events/foods/locations + Barry copy; fictional setting, no real marketplace/political branding.

## E18 — Art

### T061 [P1] Visual bible + key art
Status: Partial (2026-10-01): original generated runtime/key-art sources and provenance added; reviewed native >=2560×1440 master still missing.
Acceptance: hand-painted dirty cartoon; map/Barry/Casino visual language fixed.

### T062 [P1] Production location/minigame/UI art
Status: Implemented locally (2026-10-01): map, Barry, work backgrounds and interactables integrated; real-device visual review remains open.
Acceptance: mobile readability maintained.

### T063 [P1] Plinko visual progression
Acceptance: upgrades visibly transform board and remain readable late.

## E19 — Final audio / juice

### T064 [P1] Production Plinko audio system
Acceptance: special cues, pitch/voice management, jackpot/bad-result hierarchy, no clipping.

### T065 [P1] Work/world/Barry audio
Acceptance: tactile jobs, ambience, needs, Barry signature, pause/duck lifecycle.

## E20 — Yandex release integration

### T066 [P1] Yandex persistence adapter
Acceptance: same SaveState schema as local; restore tested.

### T067 [P1] Analytics
Status: Implemented and tested (2026-10-01): semantic save-observer events, stable flat schema, counter 113254061 configured; hosted receipt belongs to T068.
Acceptance: stable TECH_SPEC event schemas emitted.

### T068 [P1] Ads + metadata
Status: Partial (2026-10-01): end-run ads, metadata, cold restore and scene readiness tested in production with a local SDK stub; hosted DRAFT/cloud/ads/Metrica checks remain open.
Acceptance: safe interstitials, simulation pause, mobile/desktop lifecycle, rating/moderation metadata.

## E21 — Final balance / playtest

### T069 [P0] Re-run physical milestone boards
Status: Candidate measured (2026-10-01): exact runtime hash, 100k bare and 10k max-cascade reports retained; final frozen-candidate review follows pacing/device acceptance.
Acceptance: reports for frozen candidate geometry/config.

### T070 [P0] Large full-game batch + dominant strategy search
Status: Candidate selected (2026-10-01): 6000 physical runs on selected config plus rejected candidate batches, versioned liquidity policy and honest report provenance; final dominance/event review remains open.
Acceptance: reproducible artifact; no unacceptable dominant policy.

### T071 [P0] Real-session pacing playtests
Status: Open: no human successful-run timing dataset. Simulation clock-equivalent fields do not satisfy this gate. Pages playtest tooling is documented in docs/PLATFORM_RELEASE.md; publication alone does not accept pacing.
Acceptance: successful median around 30 real minutes; repetition reviewed; work-count target yields to pacing target.

## E22 — Reliability / performance

### T072 [P0] Low-end mobile + max-cascade performance pass
Status: Open: all 24 balls resolve, but v14 strict CPU×4 screening narrowly fails (median 33.4 ms / p95 50.1 ms); actual target-phone gate unverified.
Acceptance: worst allowed state remains playable; no sustained catastrophic frame drop.

### T073 [P0] Save/background/refresh soak
Status: Local verification passed (2026-10-01): v14 warm-solver restore, 40-Drop background/settled reload soak, production cold and mid-Drop mouse/touch restore. Legacy pose-only checkpoints stop unchanged.
Acceptance: no duplicate money, progression, listeners or physics bodies.

### T074 [P1] Memory/audio soak
Status: Local verification passed (2026-10-01): bounded body/listener/texture counts, post-GC heap and released audio voices across 40 max-upgrade Drops; real-device audio/memory review remains open.
Acceptance: repeated Drops do not grow memory/audio voices without bound.

## E23 — RC

### T075 [P0] MVP acceptance audit
Status: Audit performed, BLOCKED (2026-10-01): every MVP item has a disposition in docs/RELEASE_ACCEPTANCE.md; pending/partial/failed items block RC.
Acceptance: every applicable `MVP_ACCEPTANCE.md` item checked; failures block RC.

### T076 [P0] Freeze config/content + build submission package
Status: Partial (2026-10-01): reproducible production candidate ZIP/manifest tooling added. RC config/content freeze and submission wait for acceptance.
Acceptance: config hash recorded; production build and submission artifacts ready.
