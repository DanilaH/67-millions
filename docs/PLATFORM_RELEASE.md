# T068 platform release integration

The summary's NEW RUN button requests one interstitial before creating the new run. It is never requested while the run is live, during skill input, Barry payment, or a pending cascade. No automatic ad is requested when a summary is rendered. EndRunAds prevents concurrent restart requests. The summary save is flushed before the request; failed/offline/no-fill ads still allow restart. The pinned YandexAdsAdapter owns fullscreen blocking, callback handling and watchdog release. Global activity blockers continue to govern GameClock, physics and shared audio; closing an ad cannot release a separate visibility/orientation/platform blocker.

Rewarded ads and sticky banners are unused. No reward, resurrection, stake refund or extra currency is introduced.

release/metadata.json is the reviewable RU submission candidate, with fictional gambling disclosed. 18+ is a suggestion, not a platform-assigned rating. Final classification and submission belong to the publisher. English is not declared: runtime language detection does not establish translated game content.

Required hosted checks: Yandex DRAFT desktop/mobile startup, actual save/restore on a fresh device, counter 113254061 goal receipt, ad open/close/error/offline and background overlap, landscape rotation, cold startup, mute/audio resume. Local/mock SDK tests validate mechanics but cannot replace these checks.


## GitHub Pages playtest (PR #51)

Pages is a browser playtest of the existing candidate, not Yandex hosted evidence or RC acceptance. `.env.pages` selects the existing mock platform runtime, local browser storage and no SDK/ads/Metrica; the existing playtest panel is visible on the city map, initially collapsed, without a query parameter (user request 2026-10-06); performance controls remain disabled. The panel pauses the game while open, and its existing cash/time/reset commands remain restricted to an idle map. The Yandex release profile remains separate. SaveState and gameplay/balance are unchanged. Saves belong to the Pages origin and do not transfer to Yandex cloud.

`npm run build:pages` runs typecheck and builds with `/67-millions/` as the base. Art requests are already relative. `npm run smoke:pages` serves that exact subpath and checks fresh startup/reload, assets, mouse/touch jobs, cold and mid-Drop restore, duplicate-payout protection, restart without hosted ads and the orientation blocker. `SMOKE_URL=https://danilah.github.io/67-millions/ npm run smoke:pages` targets the published site without SDK/network stubs. Test fixtures are injected only by the external smoke, never by the shipped application.

`.github/workflows/pages-playtest.yml` publishes only `main`, on non-documentation pushes or manual dispatch. After deployment, a separate `verify-live` job reruns the unstubbed mouse/touch smoke against the real site and verifies its published SHA. It runs tests/build/browser smoke before uploading and deploying the Pages artifact. PR #51 was merged by explicit user instruction for this playtest; the strict performance/release gates remain unchanged. `preview-version.json` records the deployed source SHA; compare it with PR #51 before reviewing a new iteration.

Repository Settings → Pages must use **GitHub Actions**. The `github-pages` environment must allow deployments from `main`. The initial PR-branch deployment was refused by environment protection; the user explicitly requested merging to `main` rather than changing that policy. Publication status and fresh verification belong to reports/release/2026-10-01/PAGES_PLAYTEST.md.
