# FINAL DOCUMENTATION AUDIT

Date: 2026-09-27

## Result

The pack has been reconciled after the independent review. No known P0 documentation contradiction remains between the source-of-truth hierarchy, roadmap, backlog and the locked gameplay rules.

## Fixed in this pass

- Restored the reconciled v2 gameplay/technical rules that were accidentally regressed in v3.
- Made `DECISION_STATUS.md` the top-level status authority and `balance.v0.json` the runtime numeric source of truth.
- Removed story duplication from `ROADMAP.md`; `BACKLOG.md` is now the single canonical task list.
- Moved the basic full-game simulator into M3, before production minigame polish.
- Moved core SaveState/local persistence into M0 instead of deferring persistence to Yandex integration.
- Added early Yandex smoke, early Plinko audio, and M2/M3 performance gates.
- Defined generic timed-action transaction semantics.
- Defined exact 09:00 behavior for a Drop already in flight, including GameClock freeze and remaining Drop minutes.
- Locked all other cash mutation while `pendingDrop` exists.
- Defined event pending/eligibility/affordability/non-stacking semantics.
- Fixed dumpster loot to a two-stage roll so `nothing` is not counted twice.
- Removed inventory ambiguity by making every dumpster result resolve immediately.
- Added exact V0 geometry/physics seed to `balance.v0.json`.
- Updated the max-bet upgrade-price ladder to the latest tuned values recovered from the discussion: `500 / 1,800 / 7,000 / 26,000 / 105,000 / 420,000 ₽` after the free base level.
- Explicitly marked other Plinko upgrade prices as provisional until reproduced by canonical physical/full-game reports.
- Demoted historical win-rate numbers to calibration hypotheses because no reproducible report artifact exists for the exact current config.
- Made the ~30 real minute successful-run target an early M3/M6 pacing metric, not a late-only check.

## Intentionally still tunable/open

These are not documentation gaps:
- final special-pin positions;
- exact final Plinko physics;
- most upgrade prices/effects;
- final event/food/location copy;
- final assets/audio mix;
- rewarded-ad decision/placement;
- final Yandex rating/moderation metadata.

They are explicitly classified as TUNABLE or OPEN in `DECISION_STATUS.md` and have roadmap tasks/gates before release.
