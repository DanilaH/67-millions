# ART & AUDIO DIRECTION

> Production visual details are locked in `docs/VISUAL_BIBLE.md`. This file remains the high-level art/audio direction.

## Visual direction

**Hand-painted dirty cartoon + black comedy.**

Не pixel art.

Мир:
- потрёпанный;
- дешёвый;
- немного мерзкий;
- живой;
- смешной;
- читаемый на мобильном landscape.

Барри — оригинальный персонаж: комичный и неприятный одновременно.

## Reference roles

### CloverPit
Системный reference: долг, pressure, gambling as survival, постепенный слом машины.

### Ballionaire
Plinko cascades, читаемость спецэлементов, эскалация машины.

### Thank Goodness You're Here!
Главный визуальный reference на hand-drawn grotesque, кривых персонажей и грязный смешной город.

### Scritchy Scratchy
Reference на бедность → азарт → incremental growth и короткий reward loop. Не копировать pixel-art rendering.

### Slots & Daggers
Компактность, payout juice, audio feedback.

### Buckshot Roulette
Tactile tension, грязная азартная атмосфера, вес действия.

### Among Us
Только reference на мгновенную читаемость и короткую длительность бытовых tasks.

## UI

Интерфейс — часть мира:
- потёртые карточки;
- дешёвые вывески;
- бумажные/пластиковые панели;
- крупные деньги/countdown;
- хорошая читаемость.

Игрок должен мгновенно различать:
1. cash;
2. next Barry payment;
3. main debt 67m.

## Plinko visual progression

Upgrade должен физически быть виден:
- regular pin → Amplifier/Splitter/Return;
- новые направляющие;
- новые multiplier labels;
- поздняя доска заметно насыщеннее стартовой.

Никакого placement mode.

## Audio: critical system

### Plinko
Отдельные cues:
- normal bounce
- Amplifier
- Splitter
- Return
- jackpot edge
- bad pocket
- payout counting
- big jackpot stinger
- Insurance activation

При multiball:
- pitch variation
- voice limits
- dynamic layering
- никакого клиппинга из 24 одинаковых `ding`

### Work
- scrub/clean reveal
- bag grab/impact/bin
- courier draw/path/success/fail

### World
- dirty city ambience
- cheap casino ambience
- Barry notification signature
- low-needs warnings
- sleep/wake
- dumpster rummage
- cash/payment sounds

## Audio performance
- bounce voice limit
- repeated impact grouping
- mobile compressed assets
- duck/pause during ads/platform interruptions


## Production timing

Audio is not postponed entirely to polish. M2 must already have placeholder bounce/pocket feedback and voice limiting so Plinko feel/performance can be evaluated. M3 adds special-pin prototype cues. M5 replaces/professionally mixes assets without changing gameplay semantics.
