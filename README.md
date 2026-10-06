# 67M — Canonical Preproduction Pack

**Status:** M5/M6 implementation and verification in progress; RC gates remain open
**Date:** 2026-10-01
**Working title:** `67 миллионов` / `67M`

## Concept

В стране вымышленный кризис. Игрок — селлер местной торговой площадки. Владелец склада Барри Вайлд требует единовременно выплатить **67 000 000 ₽** неустойки и каждое утро в 09:00 взыскивает отдельную растущую ежедневную выплату. Обычной работой principal не закрыть: работа даёт стартовый капитал и comeback, а масштабирование происходит через постепенно прокачиваемую Plinko-машину. Потребности, время, события и Барри создают давление. Победа — только ручная единовременная выплата 67 млн. Поражение — невозможность заплатить Барри в 09:00 либо HP = 0.

## Source-of-truth hierarchy

Документы не равноправны. При конфликте использовать этот порядок:

1. `DECISION_STATUS.md` — что **LOCKED / TUNABLE / OPEN / POST-MVP**.
2. `GAME_DESIGN.md` — канонические правила поведения игры.
3. Специализированный spec (`PLINKO_SPEC.md`, `MINIGAMES_SPEC.md`, `TECH_SPEC.md`, `SCREEN_FLOW.md`, `SIMULATION_SPEC.md`) — точная семантика своей подсистемы.
4. `balance.v0.json` — **единственный source of truth для числового V0-конфига**.
5. `BALANCE_V0.md` — человекочитаемая сводка конфига; не отдельный источник чисел.
6. `MVP_ACCEPTANCE.md` — release gate.
7. `ROADMAP.md`, `BACKLOG.md`, `DEPENDENCY_GRAPH.md` — только план исполнения; они **не имеют права вводить новые правила игры**.

Если физический Plinko не попадает в целевую статистику, сначала калибровать geometry/physics. Не маскировать физический bias экономикой.

## Recommended reading order for an implementation agent

1. `README.md`
2. `DECISION_STATUS.md`
3. `GAME_DESIGN.md`
4. `TECH_SPEC.md`
5. `PLINKO_SPEC.md`
6. `MINIGAMES_SPEC.md`
7. `SCREEN_FLOW.md`
8. `balance.v0.json`
9. `BALANCE_V0.md`
10. `SIMULATION_SPEC.md`
11. `ART_AUDIO_DIRECTION.md`
12. `docs/VISUAL_BIBLE.md`
13. `MVP_ACCEPTANCE.md`
14. `ROADMAP.md`
15. `BACKLOG.md`
16. `DEPENDENCY_GRAPH.md`

## Implementation rule

Если edge case не описан, агент не должен молча придумывать новую продуктовую механику. Он должен выбрать минимальную техническую трактовку, сохраняющую locked rules, и оформить её decision note до изменения канонических документов.

## Balance provenance

Физические и full-game отчёты текущего кандидата сохранены в [release evidence](reports/release/2026-10-01/README.md). Его raw-config SHA-256 — `ffd96790e8327c7319f9ad1836cd5f9b3399b1be9a923f83c2ecac99ad9a2c48`. В физической выборке 6000 партий (по 1000 на policy) BASELINE_GROWTH с явно обозначенной liquidity-v1 policy выиграл 49,7%; это диагностика бота, не прогноз человека. Конфиг остаётся кандидатом для плейтестов. Пороговые гипотезы `SIMULATION_SPEC.md` и 30-минутный target не объявлены выполненными. Статус acceptance: [аудит](docs/RELEASE_ACCEPTANCE.md).

The 2026-10-02 user revision adds free concurrent launches and changes the config hash. The report above remains historical single-Drop evidence, not a pacing/performance result for the new rule. Current playtest verification: [free launches](reports/release/2026-10-02/FREE_LAUNCHES.md).

## Explicitly out of MVP

- вторая Plinko-доска;
- свободно управляемый персонаж в городе;
- бизнес, квартира, машина, отношения;
- дополнительные профессии;
- ручная расстановка пинов;
- прокачиваемая помойка;
- ультраредкий лотерейный билет;
- permanent metaprogression;
- inventory;
- offline progression;
- отдельный medication/antidepressant consumable.

Current physics revision (2026-10-03): [deflector calibration and save compatibility](reports/physics/2026-10-03/CALIBRATION.md). Config SHA-256 `7fe6c5c2a3ae98cbb1c1eaf81172097d0bd7cfbd259fee499f9c593214a3cd2c`; older distribution/pacing reports remain historical.

Measurement correction: [shared-world pacing audit](reports/pacing/2026-10-05/README.md) applies Phaser’s resolver initialization, models active time and concurrent paid roots, and reruns 240 sessions. Older standalone-Matter edge/EV/pacing figures require remeasurement; matching the config hash alone does not establish production parity. No balance change accompanies this audit.

Current bare-board candidate (2026-10-05): [damping correction](reports/physics/2026-10-05-bare/README.md), config SHA-256 `7b47d04609c9bf6c07d4ea6ad6a22fda4b7ef9ec89e8d3715a8824efdf4659e6`. Independent 10,000-root holdout: 0.846025× gross return / 0.68% edge. Upgrade and full-game balance remain open.

Historical special-pin calibration (2026-10-05): [Return/Splitter calibration](reports/physics/2026-10-05-specials/README.md), config SHA-256 `bd8928de31c8bcf5392b8a3861cfd193920088a6cd36ba2f73628a6020f4e589`. [Matched full-game comparison](reports/pacing/2026-10-05-specials/README.md) shows higher win counts; economy and human pacing remain open.

**Historical blocker, now resolved below:** the special-pin candidate `febb1fd` failed browser/Node payout parity; Pages deployment was skipped. Its effect/full-game figures are adapter diagnostics, not production evidence. Resolve deterministic collision/effect scheduling before continuing calibration; see the blocking finding in the report above.

2026-10-05 fixed-tick repair: collision effects now complete synchronously after each solver step and before persistence; save latency cannot postpone them into another tick. Local browser payout/RNG/clock/needs parity (including delayed render frames) and 42,000 effect reruns pass. This supersedes the V1 scheduling blocker above. CI, Pages deployment and live verification all passed in run 37328078720; published executable `5bf6c6806dd709f6d17800cd7893cecbedffb160`. See [evidence and historical-save limits](reports/physics/2026-10-05-fixed-tick/README.md). Economy acceptance remains open.

2026-10-05 economy candidate: late max-bet caps and board prices now slow the final acceleration while preserving entry prices and upgrade effects. Independent 200-run comparison per config: successful medians 27–32 minutes for single drops and 15–17 for six-root bursts. These are modeled times, not human playtests. Exact config and limitations: [economy report](reports/pacing/2026-10-05-economy/README.md).

2026-10-05 continuous-launch follow-up: [760-run audit](reports/pacing/2026-10-05-continuous/README.md) adds replenishment and purchase-gap diagnostics. Riskier continuous play is faster among winners but loses more often; tested price discounts did not reliably fix purchase droughts, so the published economy remains unchanged.

2026-10-06 playtest access: on the city map, the ordinary Pages URL now shows the collapsed **⚙ Плейтест** panel without `?debug=1`. Open it from the map to add/remove cash, advance time, reset the save (with confirmation), or copy diagnostics. Opening the panel pauses the game.
The panel hides during jobs and casino play so it cannot intercept touch paths.
