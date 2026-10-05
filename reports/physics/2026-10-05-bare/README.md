# Bare-board damping correction — 2026-10-05

## Change

Only production numeric change: `plinko.physicsSeed.frictionAir` **0.023 → 0.026**. Pockets, payouts, prices, needs, geometry and special-pin placement are unchanged. Runtime config SHA-256: `7b47d04609c9bf6c07d4ea6ad6a22fda4b7ef9ec89e8d3715a8824efdf4659e6`. Base revision before this patch: `409ef54` (includes the prior pocket audit). Calibration uses production createBarePlinko with Phaser Resolver defaults in sharedWorld.ts.

The old board returned 1.912× with 8.05% edge hits on the prior independent 2000-root sample. The new holdout returns **0.846025×**, SE **0.012338**, with **0.68% combined edges**, **55.25% combined center**, **0/10,000 unresolved roots**, mean flight **4.984 seconds**. Approximate mean 95% interval: 0.822–0.870. The result meets the approximate 0.85 bare-board target on this sample; it is not a completed full-game balance gate.

## Selection and validation

1. Screen 15 candidates × 500 roots, stream seed 67107100. More vertical spacing worsened outward travel; high drag collapsed the distribution into the center. Changing restitution alone did not establish the target.
2. Screen drag 0.024–0.032 × 1000 roots, stream seed 67107200. Selected 0.026 (0.838×) before holdout.
3. Independent holdout 10,000 roots, stream seed 67107300: 0.846025×. No further tuning after holdout.
4. New-config upgrade screen: 35 variants × 1000 roots, seed 67107400. All resolved. Full board remains strongly positive (13.948×), Return L2 regression and weak Splitter remain follow-up work.

All samples use independent fresh worlds and roots drawn from successive xorshift32 states, not adjacent integer seeds. Equal root seeds are paired within each comparison. Cap 3600 ticks. This does not measure human session lengths, continuous clicking policy, or chance of finishing from 500. Rare-tail upgrade averages on 1000 roots are screening results, not final calibration.

Files `screen.json`, `fine.json`, `holdout.json` record counts and histograms; candidate files reconstruct each variant. Their config hashes use compact JSON serialization, whereas the production hash above hashes the exact file bytes. Config in the base revision plus candidate overrides reproduces these variants. `upgrade-screen/summary.json` and `samples.csv.gz` contain current-config results and per-root payouts.

Commands from the base revision plus this diagnostic script:

```sh
node --import tsx simulation/full-game/bareCalibration.ts reports/physics/2026-10-05-bare/screen-candidates.json 500 67107100 /tmp/screen.json
node --import tsx simulation/full-game/bareCalibration.ts reports/physics/2026-10-05-bare/fine-candidates.json 1000 67107200 /tmp/fine.json
node --import tsx simulation/full-game/bareCalibration.ts reports/physics/2026-10-05-bare/holdout-candidate.json 10000 67107300 /tmp/holdout.json
```

On the new config:

```sh
node --import tsx simulation/full-game/upgradeAudit.ts 1000 /tmp/upgrade-screen 67107400
```

## Upgrade screen

| Variant | Mean gross return | Roots with an edge descendant |
|---|---:|---:|
| base | 0.811× | 0.30% |
| only-center-1 | 0.865× | 0.30% |
| only-center-2 | 0.906× | 0.30% |
| only-mid-1 | 0.877× | 0.30% |
| only-mid-2 | 0.971× | 0.30% |
| only-mid-3 | 1.090× | 0.30% |
| only-jackpot-1 | 0.850× | 0.30% |
| only-jackpot-2 | 0.925× | 0.30% |
| only-jackpot-3 | 1.075× | 0.30% |
| only-amplifier-1 | 0.838× | 0.30% |
| only-amplifier-2 | 0.879× | 0.30% |
| only-amplifier-3 | 0.921× | 0.30% |
| only-amplifier-4 | 0.964× | 0.30% |
| only-amplifier-5 | 1.041× | 0.30% |
| only-return-1 | 0.893× | 2.80% |
| only-return-2 | 0.704× | 0.60% |
| only-return-3 | 0.938× | 3.70% |
| only-return-4 | 1.394× | 6.90% |
| only-splitter-1 | 0.808× | 0.30% |
| only-splitter-2 | 0.811× | 0.30% |
| only-splitter-3 | 0.814× | 0.30% |
| only-splitter-4 | 0.819× | 0.30% |
| only-splitter-5 | 0.824× | 0.30% |
| only-jackpotBias-1 | 0.853× | 0.80% |
| only-jackpotBias-2 | 0.922× | 1.60% |
| only-jackpotBias-3 | 1.042× | 2.80% |
| only-jackpotBias-4 | 1.240× | 4.80% |
| maximum | 13.948× | 9.70% |
| maximum-without-center | 13.794× | 9.70% |
| maximum-without-mid | 13.846× | 9.70% |
| maximum-without-jackpot | 2.455× | 9.70% |
| maximum-without-amplifier | 10.403× | 9.70% |
| maximum-without-return | 8.904× | 4.80% |
| maximum-without-splitter | 13.906× | 9.70% |
| maximum-without-jackpotBias | 9.915× | 6.90% |

## Persistence and validation

Resolver accepts exact fingerprints of the current board, the previous physics with current deflectors, and previous physics with pre-2026-10-03 deflectors. Unknown boards remain rejected. Save fingerprints and solver checkpoints are never rewritten. Existing scene logic restarts on the current board after the old paid world drains. Concurrent additional paid roots while that old world remains active continue to use its physics.

381 unit tests passed. Two historical boards each replay six max-special paid cascades exactly in the Node adapter. Existing time fixture remains checked for both old (92 minutes) and new (91 minutes) flight duration; the clock formula is unchanged. Local Pages build passed. Browser smoke now covers both historical physics/deflector versions and transition to the current board; CI/browser/deployment confirmation is pending at this commit.

## Remaining work

Return L2 still reduces expected payout versus L1; Splitter remains economically weak. Recalibrate these on the corrected bare board, then evaluate prices/max bets and complete-run pacing. Do not claim that this one parameter fixes five-minute progression or proves the 30-minute target.

## Published verification follow-up

Runtime change and the preceding audit were published together as `e845d31aff650f2dc4eea8e6abe4885d7791d7fe`. Its first Pages build stopped before deployment because a screenshot/poll-time comparison of special-cascade clocks differed by one minute (cash and RNG matched). This is not a demonstrated payout error. The exact cause of that first timing difference was not captured.

`3a764fa4b6206acb20024d4dcf5fafb02f2de1eb` adds a browser-only observer of the durable pending→settled save transition. It retains exact cash, RNG and clock assertions at that boundary, avoiding comparisons with later idle time. The subsequent run recorded original/replay minute 637 at both the durable boundary and the later observation; it therefore verifies the chosen boundary but does not reproduce the first mismatch's cause.

Pages run `37309060790`, build job `111759713622`: 381 tests, build, playtest smoke and mouse/touch UI smoke all passed. Node/Phaser final money, RNG, clock and needs matched in all three fixtures. Intermediate floats first differ at approximately 1e-14 at tick 135; this is not bit-identical cross-engine trajectory evidence. Both historical paid-board variants replayed and switched to the current board. UI smoke reported no page errors, failed requests or unwanted service requests. Deploy job `111763125625` succeeded; live verification is recorded below when complete.

Reproduction note: `409ef54` in diagnostic metadata is the local audit revision subsequently included in `e845d31`; the old runtime/config is available at `b5aebb9`. To repeat the initial coarse screen using the published diagnostic code, temporarily use `balance.v0.json` from `b5aebb9` (only damping differs from the current candidate). Fine and holdout candidates explicitly override damping. The raw result files preserve both old and candidate parameters.

Live verification job `111763409805` passed at 2026-10-05 12:39 UTC: served manifest SHA `3a764fa4b6206acb20024d4dcf5fafb02f2de1eb`, mouse 1280×720 and CDP touch 640×360, no page errors, failed requests or unwanted service requests. Pages run `37309060790` and CI for that revision are successful.
