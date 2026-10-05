# Fixed-tick collision and checkpoint boundary — 2026-10-05

**Published and verified:** CI, Pages deployment and live browser checks are green.

This repairs the browser/Node payout mismatch that blocked the V1 Return/Splitter candidate. Config SHA-256 stays `bd8928de31c8bcf5392b8a3861cfd193920088a6cd36ba2f73628a6020f4e589`; no prices, needs, multipliers or positions changed in this fix.

## Cause and fix

The previous scene queued collisions through a promise chain and awaited save writes inside it. Phaser may execute multiple fixed updates in one render frame, before queued microtasks run. The Node adapter instead drained collisions after each fixed update. A moved Splitter exposed different child creation ticks and final payouts: the failed six-root browser fixture ended with 101055 cash versus 118487 in Node.

`createBarePlinko` now collects collision pairs while Matter solves, then synchronously processes them at the end of the same fixed tick. Order: complete solver/watchdog, advance the tick clock, apply all collision effects, capture the post-effect checkpoint. Both scene and adapter use this same boundary. The scene's physics handlers no longer await storage. Periodic/dirty checkpoints are coalesced while a write is outstanding; final settlement is explicitly queued. Save writes remain serialized and immutable. Launch commands retain their separate serialized cash-commit flow. Leaving/restarting after final settlement still awaits the durable write.

The regression test covers two consecutive ticks on one JavaScript stack: no body mutation during collision solving, no checkpoint before effects, no duplicated pair on a later tick. Browser checks retain exact cash/RNG/clock/needs assertions; they sample the durable settlement boundary to exclude unrelated idle time. An extra max-special fixture delays requestAnimationFrame callbacks by 60 ms to exercise catch-up updates. No assertion tolerance or seed change hides a failure.

## Evidence

- 384 unit tests pass; TypeScript and Pages build pass.
- Local production-build browser smoke passes, including normal and delayed-frame max-special parity. Both now end at **118487**, with exact RNG, clock and needs matches. See `verification.json`.
- Bare browser fixtures also retain their exact final outcomes. Tiny pre-existing cross-engine floating differences on bare poses are not claimed to be bit-identical across engines or all seeds.
- Repeated [100,000 bare roots](bare-100k.md): identical payouts/contact counts, .8512025× mean gross return, .692% edges, zero unresolved.
- Repeated 30,000 Return and 12,000 Splitter roots match every row/per-root payout in the earlier adapter reports, with zero unresolved roots. Seeds 67108500 and 67108600; candidate CLI files are in the preceding special-pin report. Gzipped reruns are retained here.
- Repeated 40 full-game runs match the previous candidate traces exactly; [new artifacts](../../pacing/2026-10-05-fixed-tick/summary.json). 36/40 wins and successful medians 13–28 minutes still indicate an unfinished economy, not a passed pacing gate.
- Expanded CI passed three historical paid boards with max specials, normal/delayed-frame parity, and desktop/touch Pages scenarios. Build, deploy and verify-live all succeeded in [run 37328078720](https://github.com/DanilaH/67-millions/actions/runs/37328078720). Published executable: `5bf6c6806dd709f6d17800cd7893cecbedffb160`. Build job `111823829467`, deploy `111828294874`, live check `111828474522`. The live check asserts the expected revision and runs against https://danilah.github.io/67-millions/.

Provenance: local base `0ea5594cc7e0fcc3feb92bca6d16158572c8e8c7` has the same tree as remote `63549c42c13217f020d0c39e12a51661bb646bbf`, plus the code changes committed with these reruns. CLI metadata records the pre-commit revision; this report explicitly identifies the accompanying working-tree patch. Model: Phaser CustomMain + Phaser Resolver defaults, fixed-tick-boundary-v1. Raw config is unchanged. Full-game policy and limitations remain recorded in its summary metadata.

## Historical saves

Persisted solver state, money, RNG, purchased levels, old special positions/child values, damping and deflectors are retained. No refund, respawn/reroll or guessed payout is introduced. Known historical boards now continue under the deterministic event boundary. The old build did **not** serialize its pending asynchronous collision queue, so an exact counterfactual outcome under its render/save-dependent scheduling cannot be promised. Tests establish exact replay from checkpoints under the corrected runtime; they cannot reconstruct unrecorded old callbacks.

## Reproduce

```sh
npm test
npm run build:pages
npm run smoke:playtest
node --import tsx simulation/full-game/specialPlacementAudit.ts reports/physics/2026-10-05-specials/accepted-return-candidates.json 3000 67108500 /tmp/return.json
node --import tsx simulation/full-game/specialPlacementAudit.ts reports/physics/2026-10-05-specials/accepted-splitter-candidates.json 1000 67108600 /tmp/splitter.json
node --import tsx simulation/full-game/timingAudit.ts 10 /tmp/full-game 2
```

Next: economic progression and dominant strategies on this physically verified candidate. The limited browser fixture set is not exhaustive engine equivalence, and earlier statistical limitations on mixed Return builds still apply.
