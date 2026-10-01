# Pages playtest recovery — 2026-10-01

Recovered source: PR #51, `feat/roadmap-completion`, `90713fbf002cea5b9807b66046934a70fcfee6a4`. PR remains open/draft; main is `545b2a1375975f5a6b1f00ace72bf3b9ea23b281`. No prior local changes were present.

## Fresh verification

- `npm run typecheck`: passed.
- `npm test`: 59 files / 337 tests passed.
- `npm run build:pages`: passed; `/67-millions/` asset base, existing mock platform, debug/perf disabled.
- `npm run release:check`: passed; Yandex build and upload audit (26 files, 2.99 MiB).
- Local browser smoke: NOT EXECUTED successfully. Chromium installation returned HTML rather than its ZIP; launch then failed because the binary was absent. GitHub Actions runs the browser verification before deployment.
- Initial published URL check: `https://danilah.github.io/67-millions/` returned 404.
- Deployment / published SHA / live browser validation: pending; do not claim success from a compiled build.

## Actual failed CI evidence

Existing performance job 110465852218, run 36890869025: build/install passed; `perf:plinko` failed at CPU×4, art/audio on, synthetic initial balls 1, max observed balls 1. 144 frames: median 50 ms, p95 66.7 ms, long-frame ratio 0.2847; all balls resolved. These are CI screening measurements, not the historical max-24 local numbers and not actual-phone evidence. Thresholds remain unchanged; T072 and RC gates remain open.

## Reproduction

See docs/PLATFORM_RELEASE.md. The Pages workflow retains smoke results/screenshots, deploys only after successful browser checks, and writes `preview-version.json` with the actual source SHA.
