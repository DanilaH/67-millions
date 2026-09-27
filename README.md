# 67M — Canonical Preproduction Pack

**Status:** implementation-ready preproduction / tunable Balance V0  
**Date:** 2026-09-27  
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
12. `MVP_ACCEPTANCE.md`
13. `ROADMAP.md`
14. `BACKLOG.md`
15. `DEPENDENCY_GRAPH.md`

## Implementation rule

Если edge case не описан, агент не должен молча придумывать новую продуктовую механику. Он должен выбрать минимальную техническую трактовку, сохраняющую locked rules, и оформить её decision note до изменения канонических документов.

## Balance provenance

Исторические heuristic/Monte-Carlo прогоны использовались для поиска направления, но для текущего пакета **нет сохранённого воспроизводимого full-game report, который доказывает конкретный win rate**. Поэтому проценты win rate в `SIMULATION_SPEC.md` — initial calibration hypotheses, а не подтверждённые результаты. После появления canonical runner любой balance claim должен сопровождаться config hash + seed/report artifact.

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
