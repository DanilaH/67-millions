# Paid capacity playtest candidate

User-authorized implementation of the [bounded final audit recommendation](../../pacing/2026-10-07-final-check/README.md). This advances T070 and prepares T071; it does not accept human pacing or final balance.

- Fresh/reset runs: two concurrent paid roots; purchase 3/4/6 capacity for 5k/25k/1m.
- Each click still purchases one root. Capacity does not grant free or automatic balls; Splitter descendants retain existing ownership and body limits.
- Late max-bet levels: 40k/65k/100k; their purchase prices and all physics/pocket effects remain unchanged.
- Shop uses the existing scrolling panel; available places are shown on the board.
- Missing capacity field in legacy saves defaults to maximum capacity. Explicit zero survives new-save round trips. Already-paid roots retain original stakes and board snapshots.
- Historical simulation configs without the new track preserve their original concurrency. Diagnostic custom-capacity policies remain explicitly separated from the runtime track.

Local verification: 416 unit/regression tests passed, TypeScript passed, Pages build passed. Six-root regression fixtures explicitly use maximum capacity; separate tests enforce all four capacities, exact charges, purchase locks and migration. Browser smoke now exercises the actual purchase button, reload and blocked third launch, in addition to existing six-root/special-pin historical restore checks.

Local Chromium launch was blocked by the execution environment's socket restriction. Browser verification must pass in the existing Pages build job before deployment, followed by its verify-live job. See Actions for the published revision's authoritative result; this note does not preclaim browser success.

For human testing, start a new run: migrated saves intentionally keep six places. Remaining risks include long purchase droughts, strategy dependence and the absence of a measured human successful-run duration. No new numeric simulation sweep was run for this implementation.
