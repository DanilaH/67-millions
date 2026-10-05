# Return and Splitter calibration — 2026-10-05

**Follow-up:** the scheduling defect below is repaired and rerun in [fixed-tick evidence](../../physics/2026-10-05-fixed-tick/README.md). The original failed-run record is retained as history; consult the follow-up for current verification status.


T069/T070 candidate, **blocked and not deployed**.

> **BLOCKED — browser parity failed. Do not accept these numbers as production balance evidence.** Candidate commit `febb1fdd702f48007bf0504fc44d37c3e1b0a8ac` passed 383 unit tests/build but failed [Pages browser run 37323285586](https://github.com/DanilaH/67-millions/actions/runs/37323285586), build job `111807512448`. Deploy and verify-live were skipped. The tables below describe the Node adapter only. Do not tune prices from them or treat this candidate as published.

## Blocking finding

The six-root max-special parity fixture (seed 67105001, 15 ticks between launches, mixed 25%/100% stakes, checkpoint at tick 90) gave browser cash **101055** versus Node **118487**. First recorded special divergence was tick **143**: the browser still had `audit:2:root` while Node had already created its children; another lineage's children were also one step apart. Bare parity fixtures completed before this assertion failed. Logs/artifacts are retained by the linked workflow (`pages-smoke`, artifact 11350824235).

Code inspection identifies a likely scheduling cause, not yet a verified fix: `PlinkoDebugScene.enqueueCascadeMutation` serializes collisions through promises; `resolvePeg` awaits `persistPendingPhysics(true)`. Phaser's `World.update` can execute several fixed updates before JavaScript microtasks run, and a save wait can postpone later effects further. The Node adapter drains its collision mutations synchronously after **every** Engine.update. Thus matching Matter settings is insufficient to establish effect parity. Moving Splitter earlier exposed a substantial payout difference; the previously passing fixture did not prove general parity.

Per AGENTS.md's stop-and-report rule for invalidated balance assumptions, no test assertion was weakened and no runtime scheduling workaround was added. Main contains the blocked candidate; Pages retains its preceding deployment because the deploy gate did not run. Next minimal task: make the collision/effect/solver-save boundary deterministic across fixed ticks and render/save latency, verify exact browser replay and adapter parity, then rerun all effect and full-game calibration before accepting/publishing V1. Historical paid-save behavior must be considered explicitly in that change.



## Provenance

- Baseline raw config SHA-256: `7b47d04609c9bf6c07d4ea6ad6a22fda4b7ef9ec89e8d3715a8824efdf4659e6` (`baseline-config.json`).
- Candidate raw config SHA-256: `bd8928de31c8bcf5392b8a3861cfd193920088a6cd36ba2f73628a6020f4e589` (`balance.v0.json` in this commit).
- Code base: local `60f934479898f7c763ee1752f156107c10691e40`, same tree `1589c6596cb3b0478116071bf3282008c07f6dfd` as remote `40908057bfd942101284e76d871f06c208d08a0c`, plus the diagnostic changes committed with this report. Raw artifacts record base revision, not a claim that uncommitted diagnostics were already in that revision.
- Physics model: `simulation/full-game/sharedWorld.ts`, Phaser pinned CustomMain with Phaser Resolver initialization. Independent paid roots, fixed 60 Hz, max 3600 ticks; xorshift seed stream, same root seeds paired between variants. Payout is gross payout/stake, not profit.
- Bare contact probe: 100,000 roots, stream seed 67108200, effects off. Artifact hash `9c9402e...` is SHA-256 of compact `JSON.stringify` baseline, not raw-file hash. Contact diagnostic is read-only and records each mirrored pair once per root.
- Screening artifacts preserve candidate JSON and full per-root payout arrays as gzip. Initial `screen`: 400 roots/context, seed 67108000; `fine`: 2000, seed 67108100; `extra`: 1500, same seed. Return refinement files use 5000/context, seed 67108300. They informed selection, so are **not** an untouched final holdout. Splitter endpoint holdout uses 3000/context, seed 67108400, on baseline Return layout.
- Final accepted-config checks use independent seeds: Return 3000 per level/context, seed 67108500 (30,000 roots); Splitter 1000 per level/context, seed 67108600 (12,000 roots). Context `combined` means all other physical upgrade tracks at max. No unresolved roots in these checks or the 100k contact probe.

## Change

Return pairs by level are now `r8c1/r8c7`, `r8c2/r8c6`, `r5c1/r5c4`, `r6c2/r6c4`. Measured bare contact rates: 6.939%, 19.653%, 30.409%, 42.899%. These replace historical standalone-Matter metadata; actual contact frequency is not an injected probability.

Splitter moves from the last row (`r8c4`) to the fifth (`r4c2`). Child value becomes .70/.75/.80/.85/.90 instead of .48/.50/.52/.55/.58. Moving the pin with .48 alone was rejected: paired isolated payout change −.022925× (SE .005037; 2000 roots). A top-row splitter was also rejected as overly explosive; other placements often hurt isolated or combined outcomes.

A candidate Return ladder ending at `r8c3/r8c5` was rejected because the last level reduced combined payout. `r7c2`→`r6c2` had too little isolated evidence of improvement; the selected L3 `r5c1/r5c4` gives a clearer isolated step to L4. This is a measured physical placement revision, not a change to Return semantics.

Base damping .026, deflectors, prices, max-bet ladder, needs and pocket multipliers are unchanged. Return still preserves 100% value, same X, one proc/lineage. Split depth 2, 24-body cap and six paid-root cap are unchanged.

## Candidate adapter measurements (browser parity unconfirmed)

Return mean gross payout/stake:

| Level | Isolated | Other tracks max |
|---|---:|---:|
| 0 | 0.863167 | 9.905144 |
| 1 | 1.020833 | 14.933944 |
| 2 | 1.392333 | 15.643559 |
| 3 | 1.831917 | 29.588469 |
| 4 | 2.088083 | 31.665037 |

All adjacent sample means rise. Paired isolated gains exceed three standard errors. Combined L1→L2 is +.709615× (SE .609463) and L3→L4 +2.076568× (SE 1.318722): this small final holdout does **not** independently establish those two gains at 95% confidence. The 5000-root selection sample also had positive combined gains, but must not be presented as independent confirmation after selection. Arbitrary mixed builds and purchase-price efficiency remain unaccepted.

Splitter mean gross payout/stake:

| Level | Isolated | Other tracks max |
|---|---:|---:|
| 0 | 0.802500 | 28.031688 |
| 1 | 0.856328 | 30.995884 |
| 2 | 0.871030 | 31.399668 |
| 3 | 0.885650 | 31.804484 |
| 4 | 0.900352 | 32.210522 |
| 5 | 0.916428 | 32.617974 |

L1 paired gain +.053828× isolated (SE .007525), +2.964196× combined (SE .656435). Each later level increases the sampled mean in both contexts. This does not make an unupgraded casino profitable: 100k bare EV remains .8512025×, edges .692%, center 54.981%.

## Persistence and verification

`BOARD_LAYOUT_V1` is a new fingerprint component. Known paid V0 boards restore archived special positions **and child values**, alongside already-supported historical damping/deflectors. Old paid worlds finish before current geometry is used; completed saves keep purchased levels. Unknown fingerprints are still rejected.

Local verification: 383 tests pass; Pages build and explicit TypeScript check of the three audit entrypoints pass. The existing committed-special-level test now asserts the intentionally changed V1 positions/child value; lineage and payout assertions were not weakened. Restore coverage includes six concurrent max-special roots for all three historical board revisions. Browser CI/Pages status is recorded below after publication; local Chromium was unavailable.

## Reproduce

```sh
node --import tsx simulation/full-game/bareCalibration.ts reports/physics/2026-10-05-specials/bare-contact-candidate.json 100000 67108200 /tmp/contacts.json reports/physics/2026-10-05-specials/baseline-config.json
node --import tsx simulation/full-game/specialPlacementAudit.ts reports/physics/2026-10-05-specials/accepted-return-candidates.json 3000 67108500 /tmp/return.json
node --import tsx simulation/full-game/specialPlacementAudit.ts reports/physics/2026-10-05-specials/accepted-splitter-candidates.json 1000 67108600 /tmp/splitter.json
```

For selection experiments pass `baseline-config.json` as the final CLI argument. In placement probes only Return L4 is active; inactive pairs are unique placeholders to keep every experimental config schema-valid. `proc` counts either Return or Splitter, so a combined `proc` is not Return-only frequency.

[Full-game comparison](../../pacing/2026-10-05-specials/README.md) demonstrates the remaining economy problem, not its resolution.
