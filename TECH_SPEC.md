# TECH SPEC

## 1. Stack

- TypeScript, strict mode.
- Phaser.
- `mini-games-kit` where it reduces implementation burden without fighting the spec.
- Yandex Games SDK behind a platform adapter.
- Browser/Yandex-first; landscape; desktop + mobile touch.

Phaser version is chosen by compatibility/stability with the actual kit and browser target, not by novelty.

## 2. Source-of-truth / config

`balance.v0.json` contains the numeric runtime config. Production game and both simulators consume the same parsed config. No balance magic numbers in Scenes.

Recommended layers:
- `core/time`
- `core/economy`
- `core/needs`
- `core/events`
- `core/work`
- `core/plinko-rules`
- `core/rng`
- `core/save`
- `simulation/plinko`
- `simulation/full-game`
- `phaser/scenes`
- `content`
- `platform/yandex`

Pure core must run without Phaser.

## 3. Numeric precision

- Money stored as integer rubles.
- Derived monetary values use configured integer rounding; V0 default is nearest integer.
- Needs/HP may use floating-point internally; UI may round for display.
- Clamp needs and HP to configured range after each mutation.

## 4. Authoritative GameClock and scheduler

Game day = **09:00 → next 09:00**.

Never mutate time with a raw `gameMinute += duration`. Every passive tick and action jump goes through the scheduler.

Priority:
1. `HEALTH_ZERO` / terminal state.
2. Barry boundary at 09:00 — hard interrupt.
3. Pending event — soft interrupt at next safe point.
4. Action completion.

### Crossing 09:00

For ordinary actions, scheduler advances exactly to 09:00, pauses the active action, resolves Barry, then resumes remaining action time after successful payment. Sleep ends instead of resuming.

### Plinko exception

If a Drop was already committed before 09:00:
1. GameClock stops at 09:00 and stores remaining Drop action-minutes.
2. Physics cascade is allowed to resolve while GameClock is frozen.
3. Payout settles.
4. Barry flow runs; this payout may therefore save the player.
5. After successful Barry payment, remaining Drop action-minutes are advanced through scheduler.

This prevents the clock showing 09:07 while Barry is still pending.

## 5. Event scheduler

V0 checkpoints: `13:00`, `17:00`, `21:00`, `01:00`, `05:00` within each 09:00→09:00 day.

Rules:
- no event checks during sleep;
- max 2 resolved events per game day;
- no immediate repeat of the same event id;
- if a checkpoint occurs during active skill input/cascade, a successful event roll becomes one `pendingEvent`;
- while `pendingEvent` exists, further event rolls are suppressed; no catch-up queue;
- pending event is shown at the next safe point after higher-priority Barry flow;
- same temporary modifier does not stack with itself; it refreshes to `max(currentRemaining, newDuration)` or `max(currentCount, newCount)` unless a definition explicitly says otherwise;
- `nextBarry +15%` affects only the next payment and never mutates the base ladder;
- pay choice is disabled if cash is insufficient;
- an event is excluded from the eligible pool when its non-pay alternative would be a pure no-op and the spec marks that condition as ineligible.

V0 eligibility notes:
- EVENT_07 (`SMELLY`) is ineligible while already SMELLY;
- EVENT_09 chooses only a job not already event-locked; if none exists, event is ineligible;
- duration-based locks/modifiers may refresh but not stack magnitude.

## 6. Action transactions

### Instant purchase
`validate → debit → apply → atomic save`.

### Timed paid action: food / paid entertainment / shower
`validate → debit cash upfront → create activeAction → advance scheduler → apply completion effect → clear activeAction → save`.

If Game Over happens before completion, cash remains spent and completion effect is not granted.

### Work
`validate availability + Energy → apply Energy/Happiness shift cost upfront → play/restore skill minigame → store success/fail result → advance normative shift time → settle payout/fine only at completion → save`.

If Game Over occurs before shift completion, no payout is granted. Work window is checked only on start.

### Dumpster
`validate alive → apply Energy→Happiness→HP search cost upfront → advance 45m → if alive roll loot → apply immediate loot → save`.

### Sleep
No upfront cost. Restoration accrues linearly with slept game time. Barry at 09:00 terminates sleep.

### Plinko
See `PLINKO_SPEC.md`; it is stricter than generic actions.

## 7. Save architecture

Save is a core feature, not only a platform feature.

Implement early:
- versioned `SaveState` schema;
- local browser adapter for development;
- atomic write/replace semantics;
- migration hook;
- checksum/validation where practical.

Yandex persistence is a later adapter over the same schema.

Autosave at minimum:
- work completion;
- Plinko commit/resolve checkpoints;
- purchase;
- food/entertainment/shower/dumpster completion;
- sleep completion/interruption;
- event choice;
- Barry payment;
- visibilitychange;
- periodic ~15 real seconds at safe hub state.

### Active non-Plinko action reload

Same-origin tabs share one persistent run. Before platform/cloud bootstrap or
reading the save, the document must own the exclusive Web Lock `67m.save:session`.
A second tab waits without starting the platform or game; after the owner closes,
it loads the latest complete save. Ownership lasts for the document lifetime,
including background and BFCache, and is not released on visibility/pagehide.
No cash/clock/RNG/pending-root merge is attempted. If Web Locks are unavailable,
startup fails safely with a browser/HTTPS explanation instead of starting an
unprotected writer. This is a local same-origin guard, not cross-device cloud
freshness resolution. Already-open pre-fix builds must be reloaded once.

- background without reload pauses exact runtime state;
- reload during a timed action restores `activeAction` and remaining game-time;
- reload during a work skill minigame may restart that same minigame from its deterministic initial layout with already-reserved shift costs; costs are not charged again;
- Plinko must restore exact active ball state because reroll protection is economically critical.

## 8. RNG

One seeded RNG service with serializable state. Gameplay must not call `Math.random()`.

All random content uses it, including event selection, dumpster rolls, Plinko spawn jitter and deterministic generated layouts where applicable.

## 9. Plinko transaction / cash lock

While `pendingDrop` exists:
- new individually paid Drops allowed up to configured concurrent limit (user revision 2026-10-02);
- no purchases;
- no work/food/entertainment/dumpster/shower;
- no main-debt payment;
- no other cash mutation except new Drop commit, individual Drop settlement and mandatory Barry flow after all paid Drops finish.
- save v15 adds a bounded `additionalDrops` ledger to the shared `pendingDrop` solver checkpoint; removal/rotation is atomic with settlement.

This keeps cash state atomic and prevents UI races.

## 10. Inventory rule

Inventory does not exist in MVP.

Dumpster loot resolves immediately:
- cheap food → immediate stat effect;
- cash → immediate cash;
- sellable object → auto-sold to cash;
- rare result → immediate configured effect.

## 11. Visibility / ads

On browser/app background:
- pause GameClock;
- pause Phaser physics;
- pause/duck audio;
- save;
- do not catch up elapsed wall-clock time on resume.

During ads the same simulation-pause contract applies.

## 12. Performance

Required guards:
- fixed timestep for Plinko;
- ball/effect pooling;
- `maxActiveBalls = 24`;
- `maxSplitDepth = 2`;
- bounded tweens/listeners;
- audio voice limiting;
- cascade watchdog only for technically stuck bodies, never for cutting legitimate payout.

Performance is checked in M2/M3, not postponed to release.

## 13. Analytics

Minimum stable events:
- `game_start`
- `game_over`
- `victory`
- `barry_due`, `barry_paid`
- `work_started`, `work_completed`, `work_failed`
- `plinko_drop`, `plinko_resolved`
- `upgrade_bought`
- `food_used`
- `sleep_started`, `sleep_completed`
- `entertainment_used`
- `event_shown`, `event_choice`
- `dumpster_search`
- `near_bankruptcy`
- `main_debt_ready`, `main_debt_paid`

Plinko payload includes bet, payout, board hash, cash before/after, cascade stats, seed/dropId.

## 14. Ads

- Interstitial only at safe logical pauses.
- Never during active skill input, active cascade or Barry payment flow.
- V0 safe placements: after Game Over summary before restart, after Victory summary.
- Rewarded is optional and not allowed to become required for continuing a run.

## 15. Tests

Unit:
- scheduler boundaries / 09:00;
- needs + HP;
- partial sleep / sleep debt;
- work windows + Energy gate;
- Barry ladder/payment;
- dumpster overflow + loot;
- event eligibility/modifiers;
- upgrade derivation;
- Insurance streak.

Integration:
- work paused/resumed by Barry;
- failed Barry before work payout;
- Plinko crossing 09:00 with clock freeze;
- background/resume;
- reload active action;
- reload active Drop;
- no duplicate payout/debit;
- no event reroll;
- manual victory at 67m only;
- full restart resets progression.
