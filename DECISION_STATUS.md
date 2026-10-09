# DECISION STATUS

## LOCKED

- Phaser + TypeScript, Yandex-first, landscape.
- One persistent run/save; restart is a completely fresh run.
- No permanent metaprogression in MVP.
- Main debt: **67,000,000 ₽**, manual one-time full payment only.
- Daily Barry payment at **09:00**, separate from principal.
- Game Over: failed Barry payment or `HP <= 0`.
- Game day: **09:00 → next 09:00**.
- Active-only time; no offline progression/catch-up.
- Barry interrupts everything except an already-active Plinko cascade, which resolves first.
- Four needs: Satiety, Energy, Happiness, Health.
- Three jobs, each with three payout/availability levels.
- Work requires `Energy >= shift energyCost` at start.
- Work window checks the start time only.
- Casino 24/7 unless temporarily event-locked.
- Map navigation costs 0 game minutes.
- Plinko upgrades are automatic; no manual pin placement/aiming.
- Initial ball spawn = center + seeded horizontal jitter.
- Plinko multiplier = **total return including stake**, not profit on top.
- Quick bet controls = 25% / 50% / 100% current max bet.
- Losing aggregate Plinko Drop costs 1 Happiness.
- While `pendingDrop` exists, purchases, other activities and victory payment remain locked. User revision 2026-10-02: freely clicked additional paid Drops are allowed up to the configured concurrent limit; each Drop settles independently. Barry waits for every paid lineage.
- Seeded RNG; no gameplay `Math.random()`.
- Dumpster emergency recovery: Energy → Happiness → HP.
- No inventory; dumpster loot resolves immediately.
- Visual direction: hand-painted dirty cartoon / black comedy.
- Audio is a core feedback system, especially for Plinko.
- Target median successful run ≈ **30 real minutes**.
- Antidepressant/medication consumable removed from MVP.
- Rewarded ads are not part of core balance.

## TUNABLE V0

- Real-time scale (`3 real sec = 1 game min`).
- Barry payment ladder.
- Need decay/damage.
- Food/entertainment values.
- Work payouts/costs/windows.
- Event probabilities/effects.
- Dumpster loot and empty-chance curve.
- Plinko geometry/physics.
- Special-pin positions.
- Plinko upgrade prices/effects.
- Max-bet ladder.
- Insurance parameters.
- Typical work count per run.
- Session-length corridor around the ~30 min target.

Tunable values move through simulator + playtest, never ad-hoc Scene edits.

## OPEN BEFORE RELEASE, NOT BLOCKING BOOTSTRAP

- Final game title.
- Final names/descriptions for food/events/locations.
- Final Barry dialogue/copy.
- Final art assets.
- Exact rewarded-ad placement, if rewarded is used at all.
- Interstitial frequency beyond safe end-of-run placements.
- Exact Yandex age-rating/moderation metadata.

## POST-MVP / EXPLICITLY OUT OF SCOPE

- second Plinko board;
- manual pin placement;
- extra jobs;
- upgraded dumpster tree;
- ultra-rare lottery ticket;
- free-roaming city;
- businesses/apartment/car/relationships;
- permanent metaprogression;
- inventory.

## Evidence rule

No historical simulation percentage is canonical until reproduced by the repository runner against the exact `balance.v0.json` hash. Design corridors may be used as tuning targets, not as empirical claims.

## User-authorized revision — 2026-10-07

Paid launch capacity is now a purchasable Plinko track: new runs start at two places and unlock 3/4/6. One click remains one paid launch, with no automatic or free batch. Legacy saves retain their six places. Capacity prices and late stake caps are TUNABLE playtest values; final pacing remains OPEN.

## 2026-10-07 — UX first pass, user-authorized

Courier: release in finish zone commits the route; full traversal takes 3 active seconds regardless of route length (collision may fail earlier). Dishes: clean threshold applies to every plate. Casino exit waits on the visible board, can be cancelled, and blocks new launches while requested. Existing Barry receipt precedes leaving. Action cards inspect; explicit CTAs spend/start. No Plinko/economy retuning in this pass.

2026-10-09 T070 whole-ladder playtest candidate: 672 modeled sessions /32 distinct full-game seeds and 182,272 new isolated ranking probes. Promote caps 500/2.5k/5k/10k/15k/22k/30k with coupled stake/late-special/capacity prices; first capacity prices and all physical effects remain. Matched ordinary slowdown +6.14/+6.08 min, winner medians 22.46/22.86; no extra work shifts. Stopping at 32 now slows cheapest/insurance-first by .54/3.00 min. Old paid roots/saves preserved. Roughly four minutes after last purchase and doubled launches require human review; T070/T071 remain OPEN. Report: reports/pacing/2026-10-09-ladder/README.md.
