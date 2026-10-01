# MVP acceptance audit — 2026-10-01

**Disposition: BLOCKED. This candidate is not an RC.** Every requirement below has a recorded disposition; pending/partial/failed rows do not count as accepted. BACKLOG.md remains the task authority.

Automated rows refer to the executed 59-file / 337-test suite, exact-config physical reports and local browser evidence. Local SDK tests use a structural stub and an intercepted Metrica tag. They cannot establish actual Yandex service receipt, device capability or human pacing. Evidence: [release reports](../reports/release/2026-10-01/README.md), [art provenance](ART_PROVENANCE.md), [platform integration](PLATFORM_RELEASE.md).

## RC blockers

- T061: generated key-art source is 1672×941; Visual Bible explicitly requires a reviewed native 2560×1440-or-larger master. Runtime art/provenance and store thumbnail are present.
- T068: no DRAFT link/access supplied; real SDK lifecycle, cloud restore, ads and counter 113254061 receipt remain unverified. Publisher age classification remains a submission input.
- T070/T071: candidate has physical bot evidence, but final build/event robustness and successful human pacing/repetition are not accepted. No 30-minute claim is made from game-clock proxies.
- T072: the unchanged strict headless CPU×4 test narrowly fails with v14; actual low-end mobile performance/readability/audio evidence is missing.
- T075/T076: acceptance and final freeze wait for those gates. A production upload candidate is packaged with its exact hash; it is not labelled release-ready.

## Item dispositions

| MVP source line / section | Requirement | Result | Evidence / limit |
| --- | --- | --- | --- |
| 4 · Complete loop | Intro → Map → Work → Plinko → Needs → Sleep → Barry → multiple days → Victory/Game Over. | PARTIAL | Individual loop rules pass automated checks; the complete multi-day human loop remains pending |
| 6 · Complete loop | main debt only full payment | AUTO PASS | tests/main-debt, barry, run-end-flow; full human loop remains pending |
| 7 · Complete loop | Barry payments don't reduce 67m | AUTO PASS | tests/main-debt, barry, run-end-flow; full human loop remains pending |
| 8 · Complete loop | victory manual only | AUTO PASS | tests/main-debt, barry, run-end-flow; full human loop remains pending |
| 12 · Loss is real | Barry fail | PARTIAL | Physical bot outcomes and anomaly seeds exist; a human replay/comeback/bad-event session has not been recorded |
| 13 · Loss is real | HP death | PARTIAL | Physical bot outcomes and anomaly seeds exist; a human replay/comeback/bad-event session has not been recorded |
| 14 · Loss is real | bankroll ruin + comeback attempt | PARTIAL | Physical bot outcomes and anomaly seeds exist; a human replay/comeback/bad-event session has not been recorded |
| 15 · Loss is real | bad event sequence | PARTIAL | Physical bot outcomes and anomaly seeds exist; a human replay/comeback/bad-event session has not been recorded |
| 17 · Loss is real | Игра не должна гарантировать victory после понимания правил. | PARTIAL | Physical bot outcomes and anomaly seeds exist; a human replay/comeback/bad-event session has not been recorded |
| 20 · No softlock | Если hero alive и Barry не провален, существует recovery action. Dumpster доступна при 0 cash/energy/happiness. | AUTO PASS | tests/dumpster, work, run-time; production cold Drop routing regression |
| 23 · Time | AFK active screen advances time | AUTO PASS | tests/time, plinko-drop-timing, needs-sleep, work-minigame-barry; browser background/SDK pause soak |
| 24 · Time | actions jump time | AUTO PASS | tests/time, plinko-drop-timing, needs-sleep, work-minigame-barry; browser background/SDK pause soak |
| 25 · Time | background/offline doesn't | AUTO PASS | tests/time, plinko-drop-timing, needs-sleep, work-minigame-barry; browser background/SDK pause soak |
| 26 · Time | 09:00 interrupt correct | AUTO PASS | tests/time, plinko-drop-timing, needs-sleep, work-minigame-barry; browser background/SDK pause soak |
| 27 · Time | sleep stops at 09:00 | AUTO PASS | tests/time, plinko-drop-timing, needs-sleep, work-minigame-barry; browser background/SDK pause soak |
| 28 · Time | active Plinko cascade resolves before pending Barry | AUTO PASS | tests/time, plinko-drop-timing, needs-sleep, work-minigame-barry; browser background/SDK pause soak |
| 31 · Save | no event reroll | AUTO PASS | tests/save, plinko-solver-checkpoint; 40-Drop v14 soak and production mouse/touch restore |
| 32 · Save | no stake refund | AUTO PASS | tests/save, plinko-solver-checkpoint; 40-Drop v14 soak and production mouse/touch restore |
| 33 · Save | active Drop restore | AUTO PASS | tests/save, plinko-solver-checkpoint; 40-Drop v14 soak and production mouse/touch restore |
| 34 · Save | no duplicate payout | AUTO PASS | tests/save, plinko-solver-checkpoint; 40-Drop v14 soak and production mouse/touch restore |
| 35 · Save | no duplicate Barry debit | AUTO PASS | tests/save, plinko-solver-checkpoint; 40-Drop v14 soak and production mouse/touch restore |
| 39 · Plinko physics | distribution reasonably symmetric | AUTO PASS | Exact-config physical/bare: 100000 Drops, EV 0.86841, center 51.92%, symmetry delta 0.546%, zero stuck |
| 40 · Plinko physics | combined center roughly 45–54% | AUTO PASS | Exact-config physical/bare: 100000 Drops, EV 0.86841, center 51.92%, symmetry delta 0.546%, zero stuck |
| 41 · Plinko physics | no abnormal edge rate | AUTO PASS | Exact-config physical/bare: 100000 Drops, EV 0.86841, center 51.92%, symmetry delta 0.546%, zero stuck |
| 42 · Plinko physics | actual EV reasonably near 0.85 | AUTO PASS | Exact-config physical/bare: 100000 Drops, EV 0.86841, center 51.92%, symmetry delta 0.546%, zero stuck |
| 43 · Plinko physics | no stuck balls | AUTO PASS | Exact-config physical/bare: 100000 Drops, EV 0.86841, center 51.92%, symmetry delta 0.546%, zero stuck |
| 44 · Plinko physics | no infinite cascade | AUTO PASS | Exact-config physical/bare: 100000 Drops, EV 0.86841, center 51.92%, symmetry delta 0.546%, zero stuck |
| 47 · Plinko progression | all upgrades automatic | AUTO PASS | tests/plinko-progression, visual-progression, insurance, cascade; physical/max 10000 resolved |
| 48 · Plinko progression | no manual placement | AUTO PASS | tests/plinko-progression, visual-progression, insurance, cascade; physical/max 10000 resolved |
| 49 · Plinko progression | visible board evolution | AUTO PASS | tests/plinko-progression, visual-progression, insurance, cascade; physical/max 10000 resolved |
| 50 · Plinko progression | positive EV only after investment | AUTO PASS | tests/plinko-progression, visual-progression, insurance, cascade; physical/max 10000 resolved |
| 51 · Plinko progression | late cascades possible | AUTO PASS | tests/plinko-progression, visual-progression, insurance, cascade; physical/max 10000 resolved |
| 52 · Plinko progression | max bet can reach 67m path | AUTO PASS | tests/plinko-progression, visual-progression, insurance, cascade; physical/max 10000 resolved |
| 53 · Plinko progression | no obviously dominant upgrade path | PENDING | Six archetypes and three economy candidates do not exhaust upgrade-path dominance/event robustness. |
| 56 · Work repetition | Initial simulation corridor: ~25–50 work minigames, but the stronger constraint is the ~30-real-minute successful-run target. If these conflict, reduce work repetition rather than extending the session. | PENDING | All-outcome bot work averages do not establish successful human repetition or 30-minute pacing |
| 59 · Minigames | reliable touch/mouse | LOCAL PASS | Production mouse at 1280×720 and real CDP touch at 640×360 complete all three jobs and credit exactly once; human comprehension/device feel remains pending |
| 60 · Minigames | clear success/fail | LOCAL PASS | Production mouse at 1280×720 and real CDP touch at 640×360 complete all three jobs and credit exactly once; human comprehension/device feel remains pending |
| 61 · Minigames | no tiny hitbox punishment | PARTIAL | Production mouse at 1280×720 and real CDP touch at 640×360 complete all three jobs and credit exactly once; human comprehension/device feel remains pending |
| 64 · Needs | different roles | AUTO PASS | tests/needs-sleep, work, full-game policies; physical batch includes reckless HP death |
| 65 · Needs | partial sleep works | AUTO PASS | tests/needs-sleep, work, full-game policies; physical batch includes reckless HP death |
| 66 · Needs | sleep debt cuts work payout | AUTO PASS | tests/needs-sleep, work, full-game policies; physical batch includes reckless HP death |
| 67 · Needs | reckless style can die from HP | AUTO PASS | tests/needs-sleep, work, full-game policies; physical batch includes reckless HP death |
| 68 · Needs | disciplined player isn't forced into constant micro-management | PENDING | Requires a disciplined human session; bot choices are diagnostic. |
| 71 · Dumpster | EV/hour clearly worse than regular work | AUTO PASS | tests/dumpster, smelly-shower; physical batch records come backs and dumpster HP deaths |
| 72 · Dumpster | can sometimes rescue zero cash | AUTO PASS | tests/dumpster, smelly-shower; physical batch records come backs and dumpster HP deaths |
| 73 · Dumpster | spam burns Energy→Happiness→HP | AUTO PASS | tests/dumpster, smelly-shower; physical batch records come backs and dumpster HP deaths |
| 74 · Dumpster | SMELLY doesn't softlock | AUTO PASS | tests/dumpster, smelly-shower; physical batch records come backs and dumpster HP deaths |
| 75 · Dumpster | courier blocked, dishes/trash remain | AUTO PASS | tests/dumpster, smelly-shower; physical batch records come backs and dumpster HP deaths |
| 78 · Events | 10 data-driven placeholder events | AUTO PASS | tests/events-scheduler, events-effects, events-reload; exact scheduler checks preserved |
| 79 · Events | max 2/day | AUTO PASS | tests/events-scheduler, events-effects, events-reload; exact scheduler checks preserved |
| 80 · Events | fixed checkpoints / pending-event rules respected | AUTO PASS | tests/events-scheduler, events-effects, events-reload; exact scheduler checks preserved |
| 81 · Events | no immediate duplicate | AUTO PASS | tests/events-scheduler, events-effects, events-reload; exact scheduler checks preserved |
| 82 · Events | conditions respected | AUTO PASS | tests/events-scheduler, events-effects, events-reload; exact scheduler checks preserved |
| 83 · Events | no event during active skill input | AUTO PASS | tests/events-scheduler, events-effects, events-reload; exact scheduler checks preserved |
| 84 · Events | no scripted instant death | AUTO PASS | tests/events-scheduler, events-effects, events-reload; exact scheduler checks preserved |
| 88 · UX | cash | LOCAL PASS | Actual desktop/mobile screenshots and main-map-HUD tests; target-device readability review pending |
| 89 · UX | next Barry payment | LOCAL PASS | Actual desktop/mobile screenshots and main-map-HUD tests; target-device readability review pending |
| 90 · UX | main debt | LOCAL PASS | Actual desktop/mobile screenshots and main-map-HUD tests; target-device readability review pending |
| 93 · UX | time | LOCAL PASS | Actual desktop/mobile screenshots and main-map-HUD tests; target-device readability review pending |
| 94 · UX | HP | LOCAL PASS | Actual desktop/mobile screenshots and main-map-HUD tests; target-device readability review pending |
| 95 · UX | satiety | LOCAL PASS | Actual desktop/mobile screenshots and main-map-HUD tests; target-device readability review pending |
| 96 · UX | energy | LOCAL PASS | Actual desktop/mobile screenshots and main-map-HUD tests; target-device readability review pending |
| 97 · UX | happiness | LOCAL PASS | Actual desktop/mobile screenshots and main-map-HUD tests; target-device readability review pending |
| 98 · UX | Barry countdown | LOCAL PASS | Actual desktop/mobile screenshots and main-map-HUD tests; target-device readability review pending |
| 101 · Visual | hand-painted dirty cartoon | PARTIAL | Original generated dirty-cartoon runtime assets inspected; native >=2560×1440 key-art master and human visual review missing |
| 102 · Visual | Barry original | PARTIAL | Original generated dirty-cartoon runtime assets inspected; native >=2560×1440 key-art master and human visual review missing |
| 103 · Visual | no real marketplace logos | PARTIAL | Original generated dirty-cartoon runtime assets inspected; native >=2560×1440 key-art master and human visual review missing |
| 104 · Visual | Plinko growth visible | PARTIAL | Original generated dirty-cartoon runtime assets inspected; native >=2560×1440 key-art master and human visual review missing |
| 105 · Visual | readable mobile landscape | PARTIAL | Original generated dirty-cartoon runtime assets inspected; native >=2560×1440 key-art master and human visual review missing |
| 108 · Audio | multiball doesn't clip | PARTIAL | Voice limits/maximum gain and distinct cue models tested; actual audio contexts run in soak; listening/device review missing |
| 109 · Audio | special pin cues distinct | PARTIAL | Voice limits/maximum gain and distinct cue models tested; actual audio contexts run in soak; listening/device review missing |
| 110 · Audio | jackpot/bad result clearly different | PARTIAL | Voice limits/maximum gain and distinct cue models tested; actual audio contexts run in soak; listening/device review missing |
| 111 · Audio | work tactile audio | PARTIAL | Voice limits/maximum gain and distinct cue models tested; actual audio contexts run in soak; listening/device review missing |
| 112 · Audio | Barry signature cue | PARTIAL | Voice limits/maximum gain and distinct cue models tested; actual audio contexts run in soak; listening/device review missing |
| 115 · Performance | no sustained severe jank in normal play | FAILED SCREENING | Isolated current v14 CPU×4: median 33.4 ms >33.333, p95 50.1 ms >50; all balls resolved. Real target-device gate unverified. |
| 116 · Performance | 24-ball late cascade remains playable | FAILED SCREENING | Isolated current v14 CPU×4: median 33.4 ms >33.333, p95 50.1 ms >50; all balls resolved. Real target-device gate unverified. |
| 117 · Performance | no memory growth across repeated Drops | PARTIAL | 40-Drop v14 heap/body/listener/audio soak passes; 24-ball strict synthetic frame thresholds fail narrowly; real low-end device test missing |
| 118 · Performance | no duplicate bodies/listeners after resume | PARTIAL | 40-Drop v14 heap/body/listener/audio soak passes; 24-ball strict synthetic frame thresholds fail narrowly; real low-end device test missing |
| 120 · Performance | Fallback threshold: no sustained drop below ~30 FPS in worst allowed cascade on target mobile profile. | PARTIAL | 40-Drop v14 heap/body/listener/audio soak passes; 24-ball strict synthetic frame thresholds fail narrowly; real low-end device test missing |
| 124 · Simulation corridor | baseline not near-guaranteed | PARTIAL | 6000 physical candidate runs with versioned liquidity policies; broader build/event robustness and real-session pacing remain open |
| 125 · Simulation corridor | cautious loses to Barry growth | PARTIAL | 6000 physical candidate runs with versioned liquidity policies; broader build/event robustness and real-session pacing remain open |
| 126 · Simulation corridor | aggressive faster but riskier | PARTIAL | 6000 physical candidate runs with versioned liquidity policies; broader build/event robustness and real-session pacing remain open |
| 127 · Simulation corridor | high-variance faster on success | PARTIAL | 6000 physical candidate runs with versioned liquidity policies; broader build/event robustness and real-session pacing remain open |
| 128 · Simulation corridor | events materially affect outcome | PARTIAL | 6000 physical candidate runs with versioned liquidity policies; broader build/event robustness and real-session pacing remain open |
| 129 · Simulation corridor | no dominant build | PARTIAL | 6000 physical candidate runs with versioned liquidity policies; broader build/event robustness and real-session pacing remain open |
| 132 · Platform | Yandex SDK | PARTIAL | Production local SDK stub, cloud adapter unit tests, Metrica configuration and blocker overlap pass; actual hosted Yandex checks missing |
| 133 · Platform | pause during ads | PARTIAL | Production local SDK stub, cloud adapter unit tests, Metrica configuration and blocker overlap pass; actual hosted Yandex checks missing |
| 134 · Platform | saves | PARTIAL | Production local SDK stub, cloud adapter unit tests, Metrica configuration and blocker overlap pass; actual hosted Yandex checks missing |
| 135 · Platform | analytics | PARTIAL | Production local SDK stub, cloud adapter unit tests, Metrica configuration and blocker overlap pass; actual hosted Yandex checks missing |
| 136 · Platform | mobile + desktop | PARTIAL | Production local SDK stub, cloud adapter unit tests, Metrica configuration and blocker overlap pass; actual hosted Yandex checks missing |
| 137 · Platform | landscape | PARTIAL | Production local SDK stub, cloud adapter unit tests, Metrica configuration and blocker overlap pass; actual hosted Yandex checks missing |
| 138 · Platform | no offline progression | PARTIAL | Production local SDK stub, cloud adapter unit tests, Metrica configuration and blocker overlap pass; actual hosted Yandex checks missing |
| 139 · Platform | moderation checklist | PARTIAL | Production local SDK stub, cloud adapter unit tests, Metrica configuration and blocker overlap pass; actual hosted Yandex checks missing |
| 143 · Scope gate | second board | AUTO PASS | Diff adds no listed post-MVP gameplay system; key-art/native gates still block RC |
| 144 · Scope gate | more jobs | AUTO PASS | Diff adds no listed post-MVP gameplay system; key-art/native gates still block RC |
| 145 · Scope gate | manual pin placement | AUTO PASS | Diff adds no listed post-MVP gameplay system; key-art/native gates still block RC |
| 146 · Scope gate | upgraded dumpster | AUTO PASS | Diff adds no listed post-MVP gameplay system; key-art/native gates still block RC |
| 147 · Scope gate | lottery ending | AUTO PASS | Diff adds no listed post-MVP gameplay system; key-art/native gates still block RC |
| 148 · Scope gate | big city | AUTO PASS | Diff adds no listed post-MVP gameplay system; key-art/native gates still block RC |
| 149 · Scope gate | extra metagame | AUTO PASS | Diff adds no listed post-MVP gameplay system; key-art/native gates still block RC |
| 155 · Ambiguity checks | time jump crossing 09:00; | AUTO PASS | tests/plinko-drop-timing, work-minigame-barry, progression, insurance, work, dumpster, run-end-flow, casino-ui |
| 156 · Ambiguity checks | active work minigame paused by Barry and resumed; | AUTO PASS | tests/plinko-drop-timing, work-minigame-barry, progression, insurance, work, dumpster, run-end-flow, casino-ui |
| 157 · Ambiguity checks | Drop launched before 09:00 resolves before Barry; | AUTO PASS | tests/plinko-drop-timing, work-minigame-barry, progression, insurance, work, dumpster, run-end-flow, casino-ui |
| 158 · Ambiguity checks | pocket result independent of upgrade purchase order; | AUTO PASS | tests/plinko-drop-timing, work-minigame-barry, progression, insurance, work, dumpster, run-end-flow, casino-ui |
| 159 · Ambiguity checks | Insurance aggregate-cascade semantics; | AUTO PASS | tests/plinko-drop-timing, work-minigame-barry, progression, insurance, work, dumpster, run-end-flow, casino-ui |
| 160 · Ambiguity checks | work cannot start below Energy cost; | AUTO PASS | tests/plinko-drop-timing, work-minigame-barry, progression, insurance, work, dumpster, run-end-flow, casino-ui |
| 161 · Ambiguity checks | no inventory created by dumpster loot; | AUTO PASS | tests/plinko-drop-timing, work-minigame-barry, progression, insurance, work, dumpster, run-end-flow, casino-ui |
| 162 · Ambiguity checks | restart fully resets upgrades/seed/state; | AUTO PASS | tests/plinko-drop-timing, work-minigame-barry, progression, insurance, work, dumpster, run-end-flow, casino-ui |
| 163 · Ambiguity checks | betting quick buttons 25/50/100 behave with low cash. | AUTO PASS | tests/plinko-drop-timing, work-minigame-barry, progression, insurance, work, dumpster, run-end-flow, casino-ui |
| 168 · Real-session pacing | median successful run ≈ 30 real minutes; | PENDING | No successful human wall-clock session dataset; legacy simulation RealMinutes includes action jumps and is not a playtest |
| 169 · Real-session pacing | typical ≈25–40; | PENDING | No successful human wall-clock session dataset; legacy simulation RealMinutes includes action jumps and is not a playtest |
| 170 · Real-session pacing | repeated >45 minute successful runs trigger pacing review. | PENDING | No successful human wall-clock session dataset; legacy simulation RealMinutes includes action jumps and is not a playtest |
| 174 · Transaction / scheduler correctness | timed paid actions debit cash at start and grant effect only at completion; | AUTO PASS | tests/timed-paid-action, work integration, work-minigame-barry, plinko-drop-timing, events-scheduler |
| 175 · Transaction / scheduler correctness | work state cost is paid at start and salary/fine only at completion; | AUTO PASS | tests/timed-paid-action, work integration, work-minigame-barry, plinko-drop-timing, events-scheduler |
| 176 · Transaction / scheduler correctness | a job started before 09:00 cannot use its future salary to pay Barry unless the payout has actually completed; | AUTO PASS | tests/timed-paid-action, work integration, work-minigame-barry, plinko-drop-timing, events-scheduler |
| 177 · Transaction / scheduler correctness | Plinko launched before 09:00 freezes GameClock at 09:00, resolves cascade, pays Barry, then advances remaining Drop minutes; | AUTO PASS | tests/timed-paid-action, work integration, work-minigame-barry, plinko-drop-timing, events-scheduler |
| 178 · Transaction / scheduler correctness | pendingDrop blocks every other cash mutation; | AUTO PASS | tests/timed-paid-action, work integration, work-minigame-barry, plinko-drop-timing, events-scheduler |
| 179 · Transaction / scheduler correctness | pending event queue is max one and cannot explode after a long unsafe period. | AUTO PASS | tests/timed-paid-action, work integration, work-minigame-barry, plinko-drop-timing, events-scheduler |
| 182 · Save architecture | local/core SaveState exists before Yandex persistence integration; | AUTO PASS | Local/shared v14 schema, ordinary action tests, finite solver checkpoint regression; incompatible old pose-only Drop preserved without mutation |
| 183 · Save architecture | active ordinary action restores without duplicate charge; | AUTO PASS | Local/shared v14 schema, ordinary action tests, finite solver checkpoint regression; incompatible old pose-only Drop preserved without mutation |
| 184 · Save architecture | active Drop restores exact outcome state; | AUTO PASS | Local/shared v14 schema, ordinary action tests, finite solver checkpoint regression; incompatible old pose-only Drop preserved without mutation |
| 185 · Save architecture | corrupted/incompatible save fails safely rather than duplicating money/progression. | AUTO PASS | Local/shared v14 schema, ordinary action tests, finite solver checkpoint regression; incompatible old pose-only Drop preserved without mutation |
| 188 · Early platform/performance gates | Yandex smoke build is tested before content/art completion; | PARTIAL | Historical reports retained for their own source/config; current hosted/device and strict 24-ball screening gates remain open |
| 189 · Early platform/performance gates | bare Plinko gets a mobile performance smoke in M2; | PARTIAL | Historical reports retained for their own source/config; current hosted/device and strict 24-ball screening gates remain open |
| 190 · Early platform/performance gates | 24-ball/splitter stress gets a performance gate in M3; | PARTIAL | Historical reports retained for their own source/config; current hosted/device and strict 24-ball screening gates remain open |
| 191 · Early platform/performance gates | placeholder Plinko audio is tested before final audio pass. | PARTIAL | Historical reports retained for their own source/config; current hosted/device and strict 24-ball screening gates remain open |
