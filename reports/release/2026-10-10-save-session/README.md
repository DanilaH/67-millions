# T073: exclusive same-origin save session

Baseline: `5ab2579570bde7b59faceed1536d608dd22ecfd2`. Config remains byte-identical, SHA256 `5d8447e21f7a73df8ca5cbb90aec8ddf272c8484a034f1092256d3552c22d02f`.

The reproduced defect was a stale tab overwriting another tab's cash and complete run snapshot. A document now acquires exclusive Web Lock `67m.save:session` **before** platform/cloud initialization, any save read, and Phaser startup. A competing document shows a waiting dialog and boots only after the owner closes, loading the latest complete save. Escape and reload do not bypass ownership. The callback retains the lock for the document lifetime, including background/frozen/BFCache states; it is deliberately not released on blur/pagehide, while state or queued writes could still exist.

The pinned kit's `docs/API.md`, `platform/JSON_REPOSITORY.md`, `platform/STORAGE.md`, and `yandex/RUNTIME.md` were inspected. The repository guarantees instance-local ordered writes and explicitly does not own cross-tab locking. No kit replacement, save schema change, RNG change, numeric tuning, snapshot merge or new dependency is needed.

Validation actually run:

- 435 tests / 76 files pass, including exclusive owner lifetime, queued followers, fresh state read and complete paid-root ledger, unavailable API, and lock rejection.
- `npm run release:check` passes (typecheck, Yandex production build and upload-root audit).
- Pages build passes.
- Full `smoke:playtest` and `smoke:pages` pass locally. The general smoke checks jobs, Barry, map/casino transitions and exact interrupted paid-root restoration; the Pages smoke checks desktop and touch UI. A first Pages run was invalidated by another build overwriting the shared `dist`; the clean rerun passed with a stable build.
- `smoke:save-session` passes four real-browser cases: desktop/touch viewport × cash/active paid root. Checks no Phaser and zero save writes in waiting document, unbypassable Escape, waiting reload, frozen owner, automatic transfer on close, fresh 13,125 ₽ cash, and exact paid-root settlement state against the production shared physics resolver (cash, RNG, clock and needs). Screenshots and result are included. Local Chromium executable: existing `/tmp/squishy-browser/chrome-linux/headless_shell`; the package-version download was unavailable. The smoke is added to the Pages gate with its standard Chromium install.

Limits: this protects updated documents on the same origin/storage partition; already-open pre-fix builds must be closed/reloaded once. It does not resolve cross-device cloud freshness. Browser Web Locks require a supported secure context; unsupported environments stop safely with an explanation instead of starting an unprotected writer. Frozen-document testing is not a real phone performance certification. Waiting does not accrue offline progression.

Earlier audit traces were lost to workspace cleanup; these are newly produced correctness checks, not a rerun of balance experiments. T070/T071 remain open. Fix evidence is kept in GitHub so it survives scratch cleanup.

Performance remains open under T072. PR #52's separate CPU ×4 performance workflow failed twice (first attempt: median 50.0 ms, p95 66.7 ms, long-frame ratio 0.1899). An isolated worktree of the unchanged baseline also failed the local screening (median 50.1 ms, p95 100 ms, long-frame ratio 0.5655); the fix worktree failed too. These local runs overlapped other browser work and are not a controlled before/after comparison. They establish that the threshold failure also occurs on the baseline, not that this change has no performance cost. No threshold was relaxed, and no frame-rate or balance fix is claimed.
