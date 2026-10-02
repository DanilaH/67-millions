import { buildWorkPreviews } from '../src/game/actions/actionPreviews';
import { startWork, settleWork } from '../src/core/work/work';
import { describe, expect, it } from 'vitest';
import { balance } from '../src/config/balance';
import { createInitialGameState } from '../src/core/state/GameState';
import { startSleep } from '../src/core/sleep/sleep';
import { formatActionFeedback, publishWorkFeedback, consumeWorkFeedback } from '../src/game/actions/actionFeedback';
import { formatCasinoResult } from '../src/game/casino/casinoPayoutToast';
import { buildCasinoUpgradePreviews } from '../src/game/casino/casinoUiModel';

describe('readable action outcomes', () => {
  it('previews work money using the same staged rounding and penalty basis as settlement', () => {
    const state = createInitialGameState(balance, 3);
    state.clock.minuteOfDay = 960;
    state.workPayoutMultiplier = 0.3333;
    state.eventModifiers.nextWorksPayoutMultiplier = { multiplier: 0.5, remainingCount: 1 };
    const started = startWork(state, balance, 'dishes', 1);
    const paid = settleWork(started.state, { ...started.action, result: 'SUCCESS' }, balance);
    const preview = buildWorkPreviews(state, null, null, balance).find(entry => entry.id === 'work:dishes')!;
    expect(preview.summary[0]).toContain(`Успех +${(paid.cash - state.cash).toLocaleString('ru-RU')} ₽`);
    expect(preview.summary[0]).toContain('штраф до');
  });
  it('subtracts stake from total return and does not count insurance twice', () => {
    const base = { stake: 500, payout: 375, multiplier: 0.75, losing: true, insuranceApplied: true, insuranceTopUp: 125 };
    expect(formatCasinoResult(base)).toContain('итог −125 ₽');
    expect(formatCasinoResult(base)).toContain('уже включена');
    expect(formatCasinoResult({ ...base, payout: 1000, multiplier: 2, insuranceApplied: false })).toContain('итог +500 ₽');
  });
  it('reports actual capped need changes and interruption instead of promised full restoration', () => {
    const before = createInitialGameState(balance, 1);
    before.needs.energy = 90;
    const after = structuredClone(before); after.needs.energy = 100; after.barryInterruptPending = true;
    const message = formatActionFeedback(startSleep(before, balance), before, after, 20);
    expect(message).toContain('прервано Барри');
    expect(message).toContain('20 мин');
    expect(message).toContain('энергия +10');
    expect(formatActionFeedback(startSleep(before, balance), before, after, 480, true)).toContain('готово, Барри ждёт');
  });
  it('uses the 09:00 game-day boundary when reporting overnight work', () => {
    const before = createInitialGameState(balance, 1);
    const state = structuredClone(before); state.clock = { gameDayIndex: 0, minuteOfDay: 60 }; state.cash += 100;
    publishWorkFeedback({ kind: 'WORK', actionId: 'trash', level: 1, upfrontApplied: true, result: 'SUCCESS', remainingMinutes: 120, startedAtGameDayIndex: 0, startedAtMinuteOfDay: 1380 }, before,
      { state, activeAction: null, shiftCompleted: true, advancedMinutes: 120 });
    expect(consumeWorkFeedback()).toContain('прошло 120 мин');
    expect(consumeWorkFeedback()).toBeNull();
  });
  it('derives next upgrade effects from the same config as purchases', () => {
    const config = structuredClone(balance); config.plinko.maxBetLevels[1]!.maxBet = 4321;
    const state = createInitialGameState(config, 2);
    const previews = buildCasinoUpgradePreviews(state, null, config);
    expect(previews.find(entry => entry.id === 'maxBet')!.nextEffect).toContain((4321).toLocaleString('ru-RU'));
    expect(previews.find(entry => entry.id === 'center')!.nextEffect).toContain(`×${config.plinko.centerUpgrades[0]!.center}`);
  });
});
