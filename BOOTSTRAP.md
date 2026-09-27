# 67M bootstrap baseline

67M starts from `mini-games-kit/bootstrap/yandex-phaser`, pinned to commit
`43913152e5b409cdb84515eabb69166f6caaa8bb`.

Baseline contracts retained:
- Phaser 4.2.1 + Vite + strict TypeScript;
- local mock / production Yandex runtime separation;
- semantic Game Ready after a presentable frame;
- shared activity coordinator for visibility/platform/orientation blockers;
- startup preload/failure diagnostics;
- AVIF capability detection with WebP fallback seam;
- mobile landscape viewport/orientation handling;
- CI with typecheck/tests/build/upload-root audit.

Game-specific architecture is governed by the canonical project docs. In particular, the deterministic core, scheduler, seeded RNG, save schema, economy, Plinko rules and simulations are project-owned and must remain independent of Phaser presentation.

Any future removal/replacement of a baseline mechanism must be recorded in `docs/PROJECT_DECISIONS.md`.
