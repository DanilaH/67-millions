# Pages playtest recovery — 2026-10-01

**Current status: PUBLISHED AND LIVE-VERIFIED (2026-10-02 user timezone).** Earlier failures below are recovery history. URL: https://danilah.github.io/67-millions/ . Published source: `e0b955fd2f064616806fa2f2f9070bc44710fc78` on `main`.

Recovered source: PR #51, `feat/roadmap-completion`, `90713fbf002cea5b9807b66046934a70fcfee6a4`. PR remains open/draft; main is `545b2a1375975f5a6b1f00ace72bf3b9ea23b281`. No prior local changes were present.

## Fresh verification

- `npm run typecheck`: passed.
- `npm test`: 59 files / 337 tests passed.
- `npm run build:pages`: passed; `/67-millions/` asset base, existing mock platform, debug/perf disabled.
- `npm run release:check`: passed; Yandex build and upload audit (26 files, 2.99 MiB).
- Local browser smoke: NOT EXECUTED successfully. Chromium installation returned HTML rather than its ZIP; launch then failed because the binary was absent. GitHub Actions runs the browser verification before deployment.
- Initial published URL check: `https://danilah.github.io/67-millions/` returned 404.
- GitHub Actions run 36910058465 on `d7b98e3b3732a3dc1f693f18d4c4f352eae0fce0`: build job 110530191396 PASSED, including all 337 tests and unstubbed Pages browser smoke (mouse 1280×720 and CDP touch 640×360). No page errors, failed asset requests or Yandex service requests. Smoke/screenshots and the complete Pages artifact were uploaded.
- Deploy job 110531425726 FAILED in `actions/configure-pages@v5`: `Get Pages site failed ... Pages enabled and configured to build using GitHub Actions ... Not Found`. The deploy action did not run. No published SHA or live-browser success is claimed.
- Concrete publisher prerequisite: Settings → Pages → Build and deployment → Source = **GitHub Actions**. Then rerun the failed deploy job of run 36910058465; the existing tested artifact contains `d7b98e3` in `preview-version.json`. Verify the real URL/revision/assets/gameplay after deployment.
- The action's official v5 `action.yml` explicitly requires a token other than `GITHUB_TOKEN` for `enablement`; a GitHub App also needs `administration:write` and `pages:write`. The connected GitHub tools expose neither Pages administration nor those token credentials. Do not silently weaken permissions or assume that toggling `enablement` fixes this.

Workflow: https://github.com/DanilaH/67-millions/actions/runs/36910058465
Action contract: https://github.com/actions/configure-pages/blob/v5/action.yml

## Actual failed CI evidence

Existing performance job 110465852218, run 36890869025: build/install passed; `perf:plinko` failed at CPU×4, art/audio on, synthetic initial balls 1, max observed balls 1. 144 frames: median 50 ms, p95 66.7 ms, long-frame ratio 0.2847; all balls resolved. These are CI screening measurements, not the historical max-24 local numbers and not actual-phone evidence. Thresholds remain unchanged; T072 and RC gates remain open.

## Reproduction

See docs/PLATFORM_RELEASE.md. The Pages workflow retains smoke results/screenshots, deploys only after successful browser checks, and writes `preview-version.json` with the actual source SHA.


## Main publication continuation — 2026-10-02 (user timezone)

The user enabled Pages. Retry of run 36910667177 failed before a runner started: `Branch "feat/roadmap-completion" is not allowed to deploy to github-pages due to environment protection rules.` The user explicitly requested merging to main. PR #51 merged at fb3425727588431bf5d221964a8ab692708ba091; Pages workflow is moved to main with a post-deploy real-site smoke and expected-SHA assertion. Publication and live verification subsequently passed; see the completed evidence below.


## Completed publication and public-site evidence

Run https://github.com/DanilaH/67-millions/actions/runs/36911601798 on source `e0b955fd2f064616806fa2f2f9070bc44710fc78` passed all three jobs: build (110535325075), deploy (110536609388), verify-live (110536712752).

The real URL returned `preview-version.json` with that exact SHA and branch `main`. Unstubbed Chromium checks against https://danilah.github.io/67-millions/ passed for mouse at 1280×720 and genuine CDP touch at 640×360: fresh startup/reload, subpath assets, disabled debug/perf, all three work jobs and credited payouts, cold/mid-Drop exact payout and RNG restoration, no duplicate settled payout, restart without hosted ads, portrait blocker and 1280px logical canvas. Page errors, failed requests and Yandex service requests were all empty.

Results and four screenshots: `pages-live-smoke`, artifact 11186469195 (SHA-256 `95abbac43d8c79acc4dee9128cc1ecb1d1ec9eb48b5de98f0890af2b8caaed19`). The build reran all 337 tests. This validates the Pages playtest path, not hosted Yandex services, real-device feel, human pacing or the open RC/performance gates.

This evidence update changes documentation only; Pages continues to serve the tested source SHA above.
