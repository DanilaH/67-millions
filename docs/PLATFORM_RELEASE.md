# T068 platform release integration

The summary's NEW RUN button requests one interstitial before creating the new run. It is never requested while the run is live, during skill input, Barry payment, or a pending cascade. No automatic ad is requested when a summary is rendered. EndRunAds prevents concurrent restart requests. The summary save is flushed before the request; failed/offline/no-fill ads still allow restart. The pinned YandexAdsAdapter owns fullscreen blocking, callback handling and watchdog release. Global activity blockers continue to govern GameClock, physics and shared audio; closing an ad cannot release a separate visibility/orientation/platform blocker.

Rewarded ads and sticky banners are unused. No reward, resurrection, stake refund or extra currency is introduced.

release/metadata.json is the reviewable RU submission candidate, with fictional gambling disclosed. 18+ is a suggestion, not a platform-assigned rating. Final classification and submission belong to the publisher. English is not declared: runtime language detection does not establish translated game content.

Required hosted checks: Yandex DRAFT desktop/mobile startup, actual save/restore on a fresh device, counter 113254061 goal receipt, ad open/close/error/offline and background overlap, landscape rotation, cold startup, mute/audio resume. Local/mock SDK tests validate mechanics but cannot replace these checks.
