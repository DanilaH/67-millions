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
