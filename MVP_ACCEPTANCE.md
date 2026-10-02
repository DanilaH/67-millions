# MVP ACCEPTANCE

## Complete loop
Intro → Map → Work → Plinko → Needs → Sleep → Barry → multiple days → Victory/Game Over.

- main debt only full payment
- Barry payments don't reduce 67m
- victory manual only

## Loss is real
Есть воспроизводимые партии:
- Barry fail
- HP death
- bankroll ruin + comeback attempt
- bad event sequence

Игра не должна гарантировать victory после понимания правил.

## No softlock
Если hero alive и Barry не провален, существует recovery action. Dumpster доступна при 0 cash/energy/happiness.

## Time
- AFK active screen advances time
- actions jump time
- background/offline doesn't
- 09:00 interrupt correct
- sleep stops at 09:00
- active Plinko cascade resolves before pending Barry

## Save
- no event reroll
- no stake refund
- active Drop restore
- no duplicate payout
- no duplicate Barry debit

## Plinko physics
На bare board после 100k Drops:
- distribution reasonably symmetric
- combined center roughly 45–54%
- no abnormal edge rate
- actual EV reasonably near 0.85
- no stuck balls
- no infinite cascade

## Plinko progression
- all upgrades automatic
- no manual placement
- visible board evolution
- positive EV only after investment
- late cascades possible
- max bet can reach 67m path
- no obviously dominant upgrade path

## Work repetition
Initial simulation corridor: ~25–50 work minigames, but the stronger constraint is the ~30-real-minute successful-run target. If these conflict, reduce work repetition rather than extending the session.

## Minigames
- reliable touch/mouse
- clear success/fail
- no tiny hitbox punishment

## Needs
- different roles
- partial sleep works
- sleep debt cuts work payout
- reckless style can die from HP
- disciplined player isn't forced into constant micro-management

## Dumpster
- EV/hour clearly worse than regular work
- can sometimes rescue zero cash
- spam burns Energy→Happiness→HP
- SMELLY doesn't softlock
- courier blocked, dishes/trash remain

## Events
- 10 data-driven placeholder events
- max 2/day
- fixed checkpoints / pending-event rules respected
- no immediate duplicate
- conditions respected
- no event during active skill input
- no scripted instant death

## UX
Always distinguish:
- cash
- next Barry payment
- main debt

Always visible:
- time
- HP
- satiety
- energy
- happiness
- Barry countdown

## Visual
- hand-painted dirty cartoon
- Barry original
- no real marketplace logos
- Plinko growth visible
- readable mobile landscape

## Audio
- multiball doesn't clip
- special pin cues distinct
- jackpot/bad result clearly different
- work tactile audio
- Barry signature cue

## Performance
- no sustained severe jank in normal play
- 24-ball late cascade remains playable
- no memory growth across repeated Drops
- no duplicate bodies/listeners after resume

Fallback threshold: no sustained drop below ~30 FPS in worst allowed cascade on target mobile profile.

## Simulation corridor
Before RC:
- baseline not near-guaranteed
- cautious loses to Barry growth
- aggressive faster but riskier
- high-variance faster on success
- events materially affect outcome
- no dominant build

## Platform
- Yandex SDK
- pause during ads
- saves
- analytics
- mobile + desktop
- landscape
- no offline progression
- moderation checklist

## Scope gate
До выполнения acceptance не добавлять:
- second board
- more jobs
- manual pin placement
- upgraded dumpster
- lottery ending
- big city
- extra metagame


## Ambiguity checks

Перед RC должны быть тесты на:
- time jump crossing 09:00;
- active work minigame paused by Barry and resumed;
- Drop launched before 09:00 resolves before Barry;
- pocket result independent of upgrade purchase order;
- Insurance aggregate-cascade semantics;
- work cannot start below Energy cost;
- no inventory created by dumpster loot;
- restart fully resets upgrades/seed/state;
- betting quick buttons 25/50/100 behave with low cash.

## Real-session pacing

Playtest target:
- median successful run ≈ 30 real minutes;
- typical ≈25–40;
- repeated >45 minute successful runs trigger pacing review.


## Transaction / scheduler correctness
- timed paid actions debit cash at start and grant effect only at completion;
- work state cost is paid at start and salary/fine only at completion;
- a job started before 09:00 cannot use its future salary to pay Barry unless the payout has actually completed;
- Plinko launched before 09:00 freezes GameClock at 09:00, resolves cascade, pays Barry, then advances remaining Drop minutes;
- pendingDrop blocks purchases/activities/principal; independently paid launches remain available up to the cap; Barry waits for every paid lineage;
- pending event queue is max one and cannot explode after a long unsafe period.

## Save architecture
- local/core SaveState exists before Yandex persistence integration;
- active ordinary action restores without duplicate charge;
- active Drop restores exact outcome state;
- corrupted/incompatible save fails safely rather than duplicating money/progression.

## Early platform/performance gates
- Yandex smoke build is tested before content/art completion;
- bare Plinko gets a mobile performance smoke in M2;
- 24-ball/splitter stress gets a performance gate in M3;
- placeholder Plinko audio is tested before final audio pass.
