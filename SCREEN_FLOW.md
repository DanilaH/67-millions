# SCREEN FLOW

## Intro

1. Establishing shot / карта.
2. Барри сообщает о 67 млн.
3. Объясняет ежедневный перевод в 09:00.
4. Игра начинается в 09:05.

Коротко, смешно, угрожающе.

## Main Map

Всегда видно:
- time;
- cash;
- main debt 67m;
- next Barry payment;
- countdown до 09:00;
- HP / Satiety / Energy / Happiness;
- statuses.

Кликабельные локации:
- Дом;
- Работа;
- Казино;
- Еда;
- Развлечения;
- Помойка;
- Душ/баня.

Карта — один hand-painted экран без свободного перемещения героя.

## Work select

Показывает:
- availability;
- level;
- payout после sleep debuff;
- duration;
- Energy/Happiness costs;
- lock reason;
- Upgrade CTA.

## Work result

Success: payout + state + time.  
Failure: 0 payout + fine + Happiness loss.

Event после работы показывается после result.

## Casino

Показывает:
- board;
- bet;
- max bet;
- cash;
- Barry countdown;
- Insurance state;
- upgrades;
- Quick Bet: 25% / 50% / 100% max bet;
- Drop CTA.

После Drop можно остаться смотреть или уйти на Map. Пока Drop активен, все state/cash-mutating actions заблокированы: upgrades, покупки, работа, новый Drop и выплата 67m. Разрешён только просмотр интерфейса до resolve.

## Plinko result

На Casino — payout animation.  
На Map — toast/banner с итогом.  
Большой jackpot получает отдельную presentation.

## Food

10 карточек: price, satiety, happiness, energy/HP, duration. Stats видны до покупки.

## Home / Sleep

Показывает:
- current time;
- time to 09:00;
- sleep duration;
- projected restore;
- projected Satiety loss;
- предупреждение о пробуждении Барри.

## Entertainment

Минимум:
- free;
- PC club;
- cinema.

Price / Happiness / duration. `SMELLY` явно снижает эффект.

## Dumpster

Перед поиском показать:
- 45m;
- Energy cost;
- overflow в Happiness/HP;
- SMELLY consequence.

## Barry interrupt

В 09:00:
- requested amount;
- current cash;
- PAY.

Достаточно денег → списание + next payment.  
Недостаточно → Game Over.

Активный Plinko cascade сначала resolve.

## Game Over

Barry failure copy direction: короткое издевательское сообщение в духе «ты думал, я тебя отпущу? Давай работай»; финальный текст можно полировать позже.

Причины:
- BARRY_PAYMENT_FAILED;
- HEALTH_ZERO.

Stats:
- days;
- max cash;
- total Barry paid;
- largest Plinko payout;
- distance to 67m;
- primary failure reason;
- Restart.

## Victory

При cash >=67m появляется большая кнопка `ПОГАСИТЬ 67 000 000 ₽`.

Не auto-trigger.

Confirmation → списание → финальная сцена → stats.

## Tutorial первого дня

В первые ~10 real minutes игрок должен:
- увидеть Барри;
- пройти работу;
- сделать Drop;
- увидеть win/loss;
- купить дешёвый upgrade;
- увидеть потребности;
- поесть;
- поспать/дожить до 09:00;
- провести первую выплату.

Только contextual hints, без длинной текстовой стены.

## Interrupt model

- Barry pause work/food/entertainment.
- Sleep заканчивается в 09:00.
- Event не появляется посреди skill input.
- Background pause всё.


## Restart

Restart = полностью новая партия без permanent upgrades/metaprogression.

## Pacing target

Медианная успешная партия: около **30 реальных минут**. Tutorial первого дня должен занимать только небольшую часть этого времени и быстро доводить до первого Plinko loop.

### Playtest correction — 2026-10-06

After the last paid casino ball resolves, a successful automatic daily Barry payment opens a blocking receipt showing the amount charged and remaining cash. The receipt pauses idle time and blocks launches, upgrades and exit until acknowledged. Closing it does not perform a second economic transaction; the payment is already saved. A failed payment continues to the existing game-over flow.

### UX follow-up — 2026-10-07

Action locations use a continuous scroll list (touch drag, wheel, or up/down controls), not pages. Descriptions inspect; only dedicated CTAs spend/start. Dragging over a CTA never commits it. Timed action previews state finish time or whether the Barry boundary occurs before completion. The countdown is the primary timing cue; current clock and principal remain available in the HUD. Casino upgrade descriptions compare installed/next values and can highlight the affected board positions without purchasing. On compact screens inspection closes the upgrade panel so the highlight is visible. Existing action/work result feedback is reused.

Mobile HUD: cash and next Barry payment are primary; day/time and principal remain secondary but visible. Tapping a need gives its value and recovery advice. On the map a separate CTA opens food/home/entertainment without buying or starting the action. Work lists initially put available shifts first and preserve that order until the panel is reopened.

2026-10-08 panel overflow correction: action lists use the former footer space for cards, with up/down controls in a narrow side rail. No dedicated “scroll the list” banner. Card text and price labels are measured against their allocated slots; titles stay clear of CTAs/levels and wrapped lock reasons stay within their row.
