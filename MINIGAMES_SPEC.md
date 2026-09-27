# MINIGAMES SPEC

## Общий принцип

Обычная смена может стартовать только если текущая `Energy >= energyCost`. Окно работы проверяется только в момент старта.

Мини-игры короткие и мгновенно понятные. Одна мини-игра = одна экономическая рабочая смена.

Target real duration: примерно `15–30 секунд`; courier может доходить до ~40 секунд.

Глобальные часы продолжают тикать во время управления. После результата дополнительно применяется нормативная длительность смены.

### Transaction timing

Work Energy/Happiness cost is applied at shift start. Skill result is stored, then normative shift time passes. Salary/fine settles only at shift completion. Barry may pause the minigame/action; failure to pay Barry ends the run before salary.

## 1. Посуда

**Input:** удерживать pointer/touch и водить по грязной поверхности.

V0:
- очистить ≥90%;
- timer 20 sec;
- forgiving hit area;
- visible clean percentage;
- tactile scrub/clean feedback.

Failure: cleanPercent ниже threshold.

## 2. Мусор

**Input:** drag/throw мешков в контейнер.

V0:
- 5 мешков;
- timer 25 sec;
- все мешки должны оказаться в target zone;
- крупные grab/target areas на touch.

Failure: хотя бы один обязательный мешок не принят к окончанию таймера.

## 3. Курьер

Hypercasual `draw a path`.

1. Игрок рисует путь от персонажа к финишу.
2. После подтверждения персонаж идёт по линии.
3. На сцене 2–4 препятствия.
4. До старта движения разрешён один redraw.
5. После старта редактирование запрещено.

Failure:
- путь невозможно пройти;
- персонаж попал в hazard;
- путь закончился до цели.

## 4. Failure economy

Для всех работ:
- payout = 0;
- fine = 25% normal payout, cash clamp >=0;
- Happiness -8;
- обычные Energy/Happiness costs применяются;
- нормативная длительность смены применяется полностью.

## 5. Work upgrades

L2/L3 НЕ создают отдельные мини-игры. Они меняют payout и availability, но не умножают production scope.

## 6. Dumpster

Не skill minigame.

Flow:
1. «Порыться».
2. 2–4 sec tactile rummage animation.
3. +45 game minutes.
4. списание state cost.
5. loot roll.
6. result + `SMELLY`.

## 7. Shower

Не мини-игра.

- 300 ₽;
- +30 game minutes;
- снимает `SMELLY`.
