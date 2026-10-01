# Release-candidate evidence, 2026-10-01

This is a reviewable playtest candidate. It is **not an accepted RC**. The canonical task list remains BACKLOG.md; the acceptance disposition is in docs/RELEASE_ACCEPTANCE.md.

## Exact candidate

- Runtime version: `0.8-candidate-price0.5-payout1.5`.
- Raw config SHA-256: `ffd96790e8327c7319f9ad1836cd5f9b3399b1be9a923f83c2ecac99ad9a2c48`.
- Selected changes: work salaries ×1.5; job and EV/special/Insurance upgrade prices ×0.5. Max-bet tiers, timing, needs, debt, events, physics and LOCKED mechanics are unchanged.
- The sampled candidate JSON is retained byte-for-byte in `full-game/selected/config.json` and matches runtime `balance.v0.json`. Its historical meta date/evidence text was retained to preserve the sampled raw-file hash; this report supplies the current evidence status.

## Physical full-game batch

6000 physical runs, 1000 per policy, seed start 67074000. The model is `matter-cascade-direct-v1`, with actual canonical Matter cascade payout and consumed RNG per committed Drop. Original v1 policy behavior remains unchanged. The separately named liquidity-v1 variant avoids buying a max-bet tier when its smallest quick bet would become unaffordable above the policy's reserve; the aggressive variant also invests in EV pocket tracks. It is a search policy, not a runtime rule or a forecast of human play.

| Policy | Runs | Wins | Median winning elapsed game days | Average works, all outcomes |
| --- | ---: | ---: | ---: | ---: |
| CAUTIOUS | 1000 | 0.0% | — | 76.0 |
| BASELINE_GROWTH | 1000 | 49.7% | 6.611111111111111 | 51.4 |
| AGGRESSIVE | 1000 | 0.9% | 4.847222222222222 | 48.3 |
| WORKER | 1000 | 0.0% | — | 76.9 |
| DEGENERATE | 1000 | 0.1% | 3.3715277777777777 | 13.1 |
| RECKLESS_NEEDS | 1000 | 0.0% | — | 6.3 |

The initial 30–45% baseline win corridor is a hypothesis, not a locked acceptance percentage. 49.7% is a candidate for human pacing review; it is not declared final. Baseline wins are overwhelmingly giant-payout dominated (99.4% under the existing income-share rule). Broader build/event-robustness review remains open. Aggressive/high-variance wins are faster but less reliable in this sample. All-outcome average work counts do not establish successful-run repetition.

`*RealMinutes` CSV/JSON fields are legacy **game-clock equivalents**, including instantaneous action jumps. They do not measure real session duration and must not be used to claim a 30-minute playtest. Historical duration anomaly flags use that same proxy. The runner's drawdown diagnostic now excludes successful principal settlement; the quarter-price search was started before that diagnostic correction, so its drawdown should not be compared to the selected candidate.

## Sampling provenance correction

These full-game samples ran while the physical model was in the working tree at HEAD `50da7bc`. That model was subsequently committed in `2d68fe2`. The old report builder incorrectly hard-coded the evidence-derived model label even for physical runs. Retained summaries explicitly correct the model label and disclose the working-tree sampling; no statistics were changed. Current report generation derives the model ID from actual run results and labels the clock-equivalent duration limitation. A final frozen RC requires its own source/config traceability and human/device gates.

## Reproduction

```sh
npm run simulate:full-game:report -- --model physical --liquidity-policy --runs-per-policy 1000 --seed-start 67074000 --output artifacts/full-game/selected
npm run simulate:plinko -- --runs 100000 --seed 67069000 --batch-size 128 --output artifacts/plinko/candidate-bare
npm run simulate:plinko:cascade -- --runs 10000 --seed 67069001 --center-level 2 --mid-level 3 --jackpot-level 3 --amplifier-level 5 --return-level 4 --splitter-level 5 --jackpot-bias-level 4 --output artifacts/plinko/candidate-max
npm run build:perf
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium PLINKO_PERF_PORT=4184 PLINKO_PERF_STRESS=24 npm run perf:plinko
# Run a separate preview on 4183 for the diagnostic build:
# npm run preview -- --host 127.0.0.1 --port 4183
npm run soak:plinko
npm run release:check
# Run production preview on 4173, then:
npm run smoke:release
SMOKE_WIDTH=640 SMOKE_HEIGHT=360 SMOKE_TOUCH=true npm run smoke:release
npm run release:package
```

Counter 113254061 is configured in Yandex modes. Release smoke intercepts the external Metrica tag and uses a structural SDK stub, so it does not establish hosted counter receipt, Yandex cloud persistence or real ad delivery.

## Reliability and performance

SaveState v14 retains the warmed Matter solver, rotated geometry and contacts. Pure trajectory tests, actual browser mid-Drop branching and a 40-Drop max-upgrade soak passed. A further 10-Drop check of the final shared-pin renderer also passed, with 74 bodies, 65 textures, two audio and two pointer listeners remaining stable. Snapshot/restore does not refund stakes, duplicate payouts, advance offline time or consume extra RNG. Unsupported older pose-only in-flight saves stop without overwriting their data; a legacy pre-physics commit can still replay from its committed seed.

The last isolated 24-ball CPU×4 screening with v14, art and sound resolved all balls, but **failed the unchanged strict thresholds**: median 33.4 ms (limit 33.333), p95 50.1 ms (limit 50), long-frame ratio 7.91% (limit 10%). Older pre-v14 passes are retained for comparison, not used as evidence for the current candidate. The benchmark with concurrent Vitest work is excluded from gate evidence. This is headless software Chromium, not a real target phone. T072 remains open.

The corrected collision handler processes every pair in Phaser's collision batch. Previously ignored simultaneous pocket hits let balls escape below sensors. Rendering uses bounded ball sprites and small shared pin glyphs; no full-screen RenderTexture or physics simplification was introduced.

## Remaining release inputs

Real Yandex DRAFT access and hosted SDK/save/ad/Metrica receipt; actual low-end mobile performance and readability/audio checks; human successful-run pacing and final balance review; approved native ≥2560×1440 key-art master. The generated source is 1672×941 and is not represented as a higher-resolution original. Submission metadata is a RU candidate; the publisher must confirm the age classification.
