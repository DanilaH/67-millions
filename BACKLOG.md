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
Audit 2026-10-02: map restores reserved timed actions through their remaining scheduler jump; food/work/sleep/Barry-boundary browser regressions added.
Status: 2026-10-02 follow-up: storage write recovery pauses gameplay and retries identical serialized bytes inside the existing ordered repository queue. Repeated/ambiguous failures covered; hosted Yandex cloud receipt remains T068.
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
2026-10-06 playtest correction: casino post-cascade automatic payment now shows a blocking receipt; idle clock and casino actions wait for acknowledgement, without a second charge.
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
UI audit 2026-10-02: event consequence text and lock/CTA use separate rows; long-label and blocked-input mouse/touch checks.
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
2026-10-06 user revision: reaching the finish commits and starts the route immediately; releasing early discards the entire line without penalty. No separate Start/redraw buttons.
Status: 2026-10-02: actual route traversal, sprite-size swept collision and arrival settlement; deterministic model and repeated mouse/touch shifts checked.
Acceptance: draw one continuous route; start only on release inside finish; three-second travel; cancel incomplete gestures; 2–4 obstacles; deterministic pass/fail.

### T054 [P1] Barry pause/resume across all minigames
Acceptance: exact minigame state pauses in runtime; work transaction remains correct.

## E16 — Main screens / UX

### T055 [P0] Persistent HUD + Main Map
Acceptance: time, cash, next Barry, 67m, countdown, four needs, statuses; navigation costs zero time.

### T056 [P0] Work/food/sleep/entertainment/dumpster flows
Audit follow-up 2026-10-02: restored production access to configured L2/L3 job purchases; separate shift/upgrade views; sleep previews capped at Barry with actual needs forecast and lethal-sleep warning.
UI follow-up 2026-10-02: three large action cards/page; all ten foods reachable; stable page on clock refresh; separate lock reason; actual post-action money/need/time summary.
Status: 2026-10-02 follow-up: three-second active-time dumpster rummage with progress; reload resumes reserved search without duplicate cost; completion still uses the authoritative 45-minute scheduler.
Acceptance: pre-action cost/time/effect visible; lock reason readable.

### T057 [P0] Casino upgrade/bet/result UI
2026-10-05 follow-up: distinguish stake size from odds, clarify total return, separate expanded visit totals from the latest result. Event choices retain touch targets across passive-clock redraws.
UI follow-up 2026-10-02: fraction selection + explicit throw, next-effect upgrade cards with pagination, Barry countdown, payout versus net result including insurance exactly once.
Status: 2026-10-02: exit shutdown crash, repeated entry, passive clock and overlapping controls fixed; detailed evidence in reports/release/2026-10-02/GAMEPLAY_AUDIT.md.
Acceptance: quick bets; upgrade state; active-Drop locks visually clear; map payout toast.

### T058 [P0] Game Over / Victory flows
Acceptance: reason/stats/restart; 67m manual confirmation.

## E17 — Tutorial / content

### T059 [P0] First-day contextual tutorial
UI follow-up 2026-10-02: tutorial explains the explicit throw and uses actual upgrade prices from balance; action-result banner temporarily replaces the tutorial.
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
2026-10-06 human feedback (subsequently implemented; verification in reports/physics/2026-10-06-implementation/README.md): same-X Return can send an outer ball above empty space and downgrade an apparently promising trajectory; probe lower-central Return placement/re-entry through special pins. Deflector inner tips sit 6.607 px above the nearest outer peg center (peg radius 6, plate thickness 5), exposing a corner above the peg; screen a lower attachment and verify level progression, combined effects, stuck rates and saved-board compatibility before changing production geometry. No balance change accompanies the courier/Barry UI fix.
Historical blocker, resolved by fixed-tick repair (2026-10-05): V1 candidate failed browser/Node six-root payout parity (101055 vs 118487); Pages deployment skipped. Suspected async cascade/save queue versus fixed-tick scheduling. Establish deterministic effect application and snapshot boundaries before accepting calibration or changing economy. Evidence: reports/physics/2026-10-05-specials/README.md.
2026-10-05 bare-board candidate: frictionAir 0.026 yields 0.846025× and 0.68% edge on 10,000 independent roots; known historical paid boards retain old physics. See reports/physics/2026-10-05-bare/README.md. Upgrade calibration and pacing remain open.
2026-10-05 playtest follow-up: 70,000 independent roots confirm base 1.912× / 8.05% edge, a Return L1→L2 regression and frequent but economically weak Splitter contacts. See reports/pacing/2026-10-05-pockets/README.md. No runtime/config change.
2026-10-05 correction: the Phaser-matched adapter finds a profitable bare board and strongly unequal upgrade effects in 35,000 roots. Historical standalone-Matter calibration is not an accepted runtime result; see reports/pacing/2026-10-05-upgrades/README.md. Recalibration remains open; do not compensate through prices.
Status: Partial (2026-10-05): corrected bare-board candidate measured and browser-tested. V1 Return/Splitter calibration and matched full-game comparison are recorded in reports/physics/2026-10-05-specials/README.md; final milestone freeze and broader upgrade combinations remain open. Historical 2026-10-01 standalone-Matter samples are retained but do not accept the current runtime.
Acceptance: reports for frozen candidate geometry/config.

### T070 [P0] Large full-game batch + dominant strategy search

2026-10-07: [final bounded candidate check](reports/pacing/2026-10-07-final-check/README.md), 600 labeled runs across diverse seeds. Provisional slot prices 5k/25k/1m with late caps 40k/65k/100k. Reserve-sensitive losses and depleted-start recovery measured. Long purchase gaps and a ~57-minute losing hoarding policy remain UX risks. Numeric cycle concluded; no runtime implementation/deployment.

2026-10-07: [paid capacity × late stake caps](reports/pacing/2026-10-07-paid-capacity/README.md), 272 modeled runs. Simulation-only paid 2→3→4→6 progression; combined candidate extends final phase but adds purchase/work friction and does not establish difficulty. No production change.

2026-10-07: [explicit buy/skip check](reports/pacing/2026-10-07-final-upgrades/README.md), 368 modeled runs. Corrects policy-driven interpretation of missing Splitter purchases; final-price discounts change completion by seconds and are not promoted. Paid launch-capacity progression remains unimplemented.

2026-10-06: [multi-angle progression audit](reports/pacing/2026-10-06-progression/README.md): 316 modeled runs and adjacent late-level comparisons. Free capacity-unlock proxies do not repair final acceleration; Splitter V price/value and purchase-order sensitivity need targeted follow-up. No runtime change or accepted paid batch progression.

2026-10-06 follow-up: [payback audit and pocket progression candidate](reports/pacing/2026-10-06-payback/README.md). Uses independent matched full-game comparisons and preserves historical payouts. No optimal-policy or final balance claim; solo duration and increased survival remain OPEN.

2026-10-06: [balance diagnosis](reports/pacing/2026-10-06-balance/README.md) tests six rejected numeric candidates, 35,000 physical roots and 488 labeled modeled sessions. No candidate accepted; progression quality and a stronger investment policy remain OPEN. Barry boundary and debug-trigger regressions pass.
2026-10-05 continuous follow-up: 760 runs cover slot replenishment, two rejected price candidates and bankroll-policy sensitivity. Two continuous launch policies are measured; optimal spacing/fractions/purchase order and human pacing remain open. No production balance change; see reports/pacing/2026-10-05-continuous/README.md.
2026-10-05 economy follow-up: seven price/cap candidates screened (280 runs), selected candidate compared independently against baseline (400 growth-policy runs plus 160 aggressive-policy runs). Late acceleration reduced without increasing common-winner median work counts. Continuous replenishment dominance and human pacing remain open; see reports/pacing/2026-10-05-economy/README.md.
2026-10-05 follow-up: 40 matched runs per config find 26→36 wins after special-pin repair, with candidate successful medians 13–28 minutes. This is diagnostic, not an accepted win rate or pacing target. Next: price/max-bet progression and dominant burst policy, without undoing measured upgrade usefulness; see reports/pacing/2026-10-05-specials/README.md.
Status: Candidate selected (2026-10-01): 6000 physical runs on selected config plus rejected candidate batches, versioned liquidity policy and honest report provenance; final dominance/event review remains open.
Acceptance: reproducible artifact; no unacceptable dominant policy.

2026-10-07: user authorized the paid 2→3→4→6 capacity candidate (5k/25k/1m) and late 40k/65k/100k caps for production playtesting. Legacy saves preserve six places; fresh runs exercise the new progression. T071 and final policy robustness remain open.

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


## User playtest revision — 2026-10-02

Extends T057 casino UI, map/HUD presentation and persistence verification: free concurrent launches, independent settlements, capped effects, full-screen map, vector stat icons, denser rendering and opt-in preview debug controls. Implemented; browser/deployment evidence is recorded in `reports/release/2026-10-02/FREE_LAUNCHES.md`. Real-device performance and new pacing/balance remain open.

2026-10-05 fixed-tick repair: collision effects now complete synchronously after each solver step and before persistence; save latency cannot postpone them into another tick. Local browser payout/RNG/clock/needs parity (including delayed render frames) and 42,000 effect reruns pass. This supersedes the V1 scheduling blocker above. CI, Pages deployment and live verification all passed in run 37328078720; published executable `5bf6c6806dd709f6d17800cd7893cecbedffb160`. See [evidence and historical-save limits](reports/physics/2026-10-05-fixed-tick/README.md). Economy acceptance remains open.

2026-10-07 UX follow-up (T051/T053/T056/T057): every dish must reach clean state; courier starts on release, follows route heading and travels for three seconds. Dedicated action CTAs; work locks show hours; two readable cards per page; prominent casino exit with cancellable wait on the visible board. Compact-screen bet controls and expandable upgrade panel use larger targets. Economy and Plinko physics unchanged.

2026-10-07 second UX pass (T056/T057): continuous action-list scrolling with drag-safe purchase buttons, three compact desktop rows / larger touch rows, preserved scroll on clock refresh. Timed actions show expected finish or Barry interruption before spending. Casino upgrade rows compare current/next effects from config; tapping their descriptions previews the affected board elements without buying (phone panel closes to expose the board). HUD consistently shows the Barry countdown; clock and principal remain visible. Result feedback already existed; corrected loss-colour matching. Physics and economy unchanged.
