# T072: remove per-frame Plinko presentation work

Baseline source: `10de21c665ed494dd35c2eee7987bffcc86c3eca`. Runtime numeric config is unchanged, raw SHA256 `5d8447e21f7a73df8ca5cbb90aec8ddf272c8484a034f1092256d3552c22d02f`. Comparison JSON records browser version, seed, source revision/diff hash and actual build-entry hash for each measured run.

The CPU profile exposed renderer/batching/allocation work. Dynamic Graphics rebuilt up to 96 trail circles and 48 collision rings per frame; static pins and guides still traversed WebGL each frame. Trails now reuse four tiny circle textures; rings use one 592×518 atlas with 50 animation frames and the existing 48-pulse bound. Static pins/guides join the existing casino CSS backdrop, refreshed on visual-role/guide changes and viewport resize. Labels, buttons, physics and all economic rules remain live and unchanged. A HUD bitmap-cache experiment did not show a useful improvement and was discarded.

## Sequential comparison

Both runtime builds were immutable separate output directories. One browser test ran at a time after the other local UI tests finished. Seed: `67072000`; Chromium, CPU ×4, touch/mobile context, 1280×720, DPR 1, art/audio on. Three repeats per scenario and build, 12 measured cases total. Earlier overlapping-browser/profiler exploratory runs are excluded from the gate comparison.

| Scenario | Baseline median / p95, ms | Fixed median / p95, ms | Strict gate |
|---|---|---|---|
| One ball | 33.3 / 33.4 in all repeats | 16.7 / 33.4 in all repeats | Both 3/3 pass |
| 24 balls, full board | 33.3–33.4 / 50.1–66.7 | 33.3 / 50.0 in all repeats | Baseline 0/3; fixed 3/3 |

The existing median ≤33.333 ms, p95 ≤50 ms and long-frame ratio ≤10% thresholds are unchanged. Fixed 24-ball long-frame ratios are 3.6–4.7%; zero active balls remain. Complete final saves match in all six paired comparisons, including cash, RNG, clock and needs. Screenshots before/after are included. The benchmark now uses a fixed initial save, records actual build provenance and final save, catches browser errors, and CI screens both bare and 24-ball states rather than bare alone.

## Other verification and limits

437 tests / 77 files pass, including fixed pool reuse and effect expiration. Typecheck, Yandex production build/upload-root audit and the general browser playtest pass. The browser playtest covers exact reload/Node payout parity, old paid shots, max-special roots and delayed frames. Pages UI verification is tracked by the deployment workflow.

This is synthetic headless/software-GPU screening, not a benchmark on a real target phone. The 24-ball fixture starts at the legal ball cap with max special levels; it is a stress workload, not a modeled human launch policy. The measured margin near 30 FPS remains small. T072's real-device acceptance and T071's human pacing remain OPEN. No balance or physics tuning accompanies this optimization.

## MSAA follow-up

The six passing comparisons above used Chromium 134.0.6998.35. On Chromium 153.0.8010.12, GitHub Actions run 38224461579 still failed: one-ball median 49.9 ms / p95 50.1 ms; 24-ball median 50.0 ms / p95 66.7 ms. Those local passes do not close the CI gate.

The follow-up disables WebGL context MSAA (`antialiasGL: false`) in the actual game configuration, retaining texture filtering, text resolution and the pre-rasterized board/effects. Two local follow-up screenings passed: one-ball median 16.7 ms / p95 16.8 ms; 24-ball median 16.7 ms / p95 33.4 ms, no remaining balls or browser errors. The probe now records the actual WebGL antialias setting. Updated Chromium 153 and Pages gates must pass before this is accepted for publication. Physical and economic code/config are unchanged.

## Final candidate — 2026-10-13

MSAA removal alone passed the one-ball CI gate but still failed the 24-ball gate (38386537915). A second HUD cache attempt also failed (38387056151) and was discarded. Profiling exposed a redundant checkpoint clone/queue in the scene: the project repository already snapshots synchronously and the pinned kit serializes the encoded writes. Reusing those existing guarantees removes the second clone without dropping checkpoints, changing their schema or relying on live mutable state during storage.

The final casino foreground backing width/height are 75% of the previous values (44% fewer foreground pixels). The static art/pins remain full resolution, and CSS size, logical coordinates and pointer mapping are unchanged. Other scenes restore the previous render density. This is a presentation-quality/performance tradeoff, not a claim of pixel-identical output.

Chromium 153.0.8010.12 CPU×4 run [38388511104](https://github.com/DanilaH/67-millions/actions/runs/38388511104) passes both original gates: one-ball median 16.7 ms / p95 33.4 ms; 24-ball median 33.3 ms / p95 50.0 ms, 4.29% long frames. All balls resolve; no browser errors. CI, physical calibration and full-game diagnostic pass. Complete paid-root reload/Node browser playtest and all four ownership-transfer cases pass after the queue simplification; the final desktop/touch Pages smoke passes locally. Mobile/wide casino screenshots were inspected for text/layout readability and input-target checks pass. These are browser viewport checks, not real-device certification.

Merged PR: [53](https://github.com/DanilaH/67-millions/pull/53). Published executable: `aaa1e6a8b4b28c35ca115797cdeaabedc1fa3e0f`, confirmed by the public preview-version marker. Pages predeployment and live verification evidence: [38388965357](https://github.com/DanilaH/67-millions/actions/runs/38388965357). Numeric config hash remains unchanged. T072 actual-phone acceptance and T071 human pacing remain open.
