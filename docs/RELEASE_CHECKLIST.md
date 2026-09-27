# Yandex release checklist

Use the pinned mini-games-kit Yandex DRAFT playbook plus `MVP_ACCEPTANCE.md`.

Minimum hosted gate:
- production build uses real Yandex runtime;
- upload root contains `index.html` and `npm run release:check` passes;
- semantic Game Ready fires only after the first correct usable frame;
- activity blockers cannot prematurely resume game clock/physics/audio;
- local/Yandex persistence preserves pending durable work;
- active Plinko reload cannot reroll/refund/duplicate payout;
- ads never interrupt active skill input, active cascade or Barry payment;
- RU/EN paths are verified where shipped;
- portrait/landscape transitions are tested on a real mobile browser/WebView;
- cold startup is measured on Yandex DRAFT;
- production submission has no debug panel;
- submitted artifact is traceable to commit/config hash;
- all applicable `MVP_ACCEPTANCE.md` gates pass.
