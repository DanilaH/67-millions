import { describe, expect, it } from 'vitest';

import type { BalanceConfig } from '../src/config/balance.schema';
import { balance } from '../src/config/balance';
import {
  getBarryPaymentDue,
  resolveBarryPayment,
} from '../src/core/barry/barry';
import {
  getEventChoiceAvailability,
  getEventChoiceCashCost,
  resolveEventChoice,
} from '../src/core/events/eventEffects';
import {
  advanceEventCheckpoints,
} from '../src/core/events/eventScheduler';
import { isEventEligible } from '../src/core/events/eligibility';
import { startFood } from '../src/core/actions/foodEntertainment';
import { commitBareDrop } from '../src/core/plinko-rules/drop';
import { purchaseMaxBetUpgrade } from '../src/core/plinko-rules/progression';
import { createInitialGameState } from '../src/core/state/GameState';
import { createGameClock } from '../src/core/time/GameClock';
import { advanceRunTime } from '../src/core/time/runTime';
import {
  setWorkResult,
  settleWork,
  startWork,
} from '../src/core/work/work';

const pending = (
  eventId: string,
  overrides: Partial<ReturnType<typeof createInitialGameState>> = {},
) => ({
  ...createInitialGameState(balance, 12345),
  ...overrides,
  pendingEventId: eventId,
});

const withoutEventRolls = (): BalanceConfig => ({
  ...balance,
  events: {
    ...balance.events,
    chancePerCheckpoint: 0,
  },
});

describe('V0 event definitions', () => {
  it.each([
    ['EVENT_01', 0.25],
    ['EVENT_02', 0.20],
    ['EVENT_03', 0.35],
    ['EVENT_05', 0.15],
    ['EVENT_06', 0.20],
    ['EVENT_08', 0.25],
    ['EVENT_09', 0.15],
    ['EVENT_10', 0.10],
  ] as const)(
    '%s choice A pays the configured fraction of current Barry due',
    (eventId, fraction) => {
      const state = pending(eventId, { cash: 10_000 });
      expect(getEventChoiceCashCost(state, balance, eventId, 'a')).toBe(
        Math.round(getBarryPaymentDue(state, balance) * fraction),
      );

      const resolved = resolveEventChoice(
        state,
        balance,
        eventId,
        'a',
      );
      expect(resolved.cashCost).toBe(
        Math.round(getBarryPaymentDue(state, balance) * fraction),
      );
      expect(resolved.state.cash).toBe(10_000 - resolved.cashCost);
      expect(resolved.state.pendingEventId).toBeNull();
    },
  );

  it('EVENT_07 choice A pays max(300, 5% of current Barry due)', () => {
    const state = pending('EVENT_07', { cash: 10_000 });
    expect(getEventChoiceCashCost(state, balance, 'EVENT_07', 'a')).toBe(300);

    const resolved = resolveEventChoice(
      state,
      balance,
      'EVENT_07',
      'a',
    );
    expect(resolved.cashCost).toBe(300);
    expect(resolved.state.cash).toBe(9_700);
  });

  it('disables pay choices when cash is insufficient', () => {
    const state = pending('EVENT_03', { cash: 100 });

    expect(
      getEventChoiceAvailability(state, balance, 'EVENT_03', 'a'),
    ).toEqual({
      available: false,
      cashCost: 1_050,
    });
    expect(() =>
      resolveEventChoice(state, balance, 'EVENT_03', 'a'),
    ).toThrow('unaffordable');
  });

  it('EVENT_01 B applies Happiness loss and creates a durable 120m time-loss action', () => {
    const state = pending('EVENT_01', {
      needs: {
        health: 100,
        satiety: 100,
        energy: 100,
        happiness: 50,
      },
    });

    const resolved = resolveEventChoice(
      state,
      balance,
      'EVENT_01',
      'b',
    );

    expect(resolved.state.needs.happiness).toBe(30);
    expect(resolved.activeAction).toMatchObject({
      kind: 'EVENT_TIME',
      actionId: 'EVENT_TIME:EVENT_01',
      remainingMinutes: 120,
    });
  });

  it('EVENT_02 B reduces the next two completed work payouts and then expires', () => {
    const state = pending('EVENT_02', {
      cash: 10_000,
      clock: createGameClock('16:00'),
    });
    const event = resolveEventChoice(state, balance, 'EVENT_02', 'b');

    expect(event.state.eventModifiers.nextWorksPayoutMultiplier).toEqual({
      multiplier: 0.7,
      remainingCount: 2,
    });

    const firstStarted = startWork(event.state, balance, 'dishes', 1);
    const first = settleWork(
      firstStarted.state,
      setWorkResult(firstStarted.action, 'SUCCESS'),
      balance,
    );
    expect(first.cash).toBe(
      10_000 + Math.round(balance.work.jobs.dishes.levels[0]!.payout * 0.7),
    );
    expect(first.eventModifiers.nextWorksPayoutMultiplier?.remainingCount).toBe(1);

    const secondStarted = startWork(first, balance, 'dishes', 1);
    const second = settleWork(
      secondStarted.state,
      setWorkResult(secondStarted.action, 'SUCCESS'),
      balance,
    );
    expect(second.eventModifiers.nextWorksPayoutMultiplier).toBeNull();

    const thirdStarted = startWork(second, balance, 'dishes', 1);
    const third = settleWork(
      thirdStarted.state,
      setWorkResult(thirdStarted.action, 'SUCCESS'),
      balance,
    );
    expect(third.cash - second.cash).toBe(
      balance.work.jobs.dishes.levels[0]!.payout,
    );
  });

  it('EVENT_02 refreshes remaining count instead of stacking it', () => {
    const state = pending('EVENT_02', {
      eventModifiers: {
        ...createInitialGameState(balance, 1).eventModifiers,
        nextWorksPayoutMultiplier: {
          multiplier: 0.7,
          remainingCount: 1,
        },
      },
    });

    const resolved = resolveEventChoice(
      state,
      balance,
      'EVENT_02',
      'b',
    );

    expect(resolved.state.eventModifiers.nextWorksPayoutMultiplier).toEqual({
      multiplier: 0.7,
      remainingCount: 2,
    });
  });

  it('EVENT_03 B modifies only the next Barry payment and is consumed after payment', () => {
    const state = pending('EVENT_03', { cash: 10_000 });
    const event = resolveEventChoice(state, balance, 'EVENT_03', 'b');

    expect(getBarryPaymentDue(event.state, balance)).toBe(3_450);

    const paid = resolveBarryPayment(
      { ...event.state, barryInterruptPending: true },
      balance,
    );

    expect(paid.cash).toBe(6_550);
    expect(paid.eventModifiers.nextBarryMultiplier).toBeNull();
    expect(getBarryPaymentDue(paid, balance)).toBe(
      balance.barry.payments[1]!,
    );
  });

  it('EVENT_04 applies Energy or HP damage directly', () => {
    const base = {
      needs: {
        health: 50,
        satiety: 100,
        energy: 50,
        happiness: 100,
      },
    };

    const a = resolveEventChoice(
      pending('EVENT_04', base),
      balance,
      'EVENT_04',
      'a',
    );
    expect(a.state.needs.energy).toBe(25);
    expect(a.state.needs.health).toBe(50);

    const b = resolveEventChoice(
      pending('EVENT_04', base),
      balance,
      'EVENT_04',
      'b',
    );
    expect(b.state.needs.health).toBe(40);
    expect(b.state.needs.energy).toBe(50);
  });

  it('EVENT_05 B is a pure 180m time loss and resumes after Barry', () => {
    const config = withoutEventRolls();
    const state = {
      ...createInitialGameState(config, 2),
      cash: 5_000,
      clock: createGameClock('08:30'),
      pendingEventId: 'EVENT_05',
    };
    const event = resolveEventChoice(state, config, 'EVENT_05', 'b');

    expect(event.activeAction?.remainingMinutes).toBe(180);

    const interrupted = advanceRunTime(
      event.state,
      event.activeAction,
      180,
      config,
    );
    expect(interrupted.advancedMinutes).toBe(30);
    expect(interrupted.state.barryInterruptPending).toBe(true);
    expect(interrupted.activeAction?.remainingMinutes).toBe(150);

    const paid = resolveBarryPayment(interrupted.state, config);
    const resumed = advanceRunTime(
      paid,
      interrupted.activeAction,
      interrupted.activeAction!.remainingMinutes,
      config,
    );

    expect(resumed.actionCompleted).toBe(true);
    expect(resumed.activeAction).toBeNull();
  });

  it('EVENT_06 B deals 15 HP damage', () => {
    const state = pending('EVENT_06', {
      needs: {
        health: 50,
        satiety: 100,
        energy: 100,
        happiness: 100,
      },
    });

    const resolved = resolveEventChoice(
      state,
      balance,
      'EVENT_06',
      'b',
    );
    expect(resolved.state.needs.health).toBe(35);
  });

  it('EVENT_07 is ineligible while SMELLY and B applies SMELLY', () => {
    expect(
      isEventEligible(
        {
          ...createInitialGameState(balance, 3),
          statuses: { SMELLY: true },
        },
        balance,
        'EVENT_07',
      ),
    ).toBe(false);

    const resolved = resolveEventChoice(
      pending('EVENT_07'),
      balance,
      'EVENT_07',
      'b',
    );
    expect(resolved.state.statuses.SMELLY).toBe(true);
  });

  it('scheduler excludes EVENT_07 when SMELLY before selection', () => {
    const config: BalanceConfig = {
      ...balance,
      events: {
        ...balance.events,
        chancePerCheckpoint: 1,
      },
    };
    const state = {
      ...createInitialGameState(config, 4),
      statuses: { SMELLY: true },
    };

    const rolled = advanceEventCheckpoints(
      state,
      ['13:00'],
      config,
      {
        isSleeping: false,
        eligibleEventIds: ['EVENT_07', 'EVENT_04'],
      },
    );

    expect(rolled.state.pendingEventId).toBe('EVENT_04');
  });

  it('EVENT_08 B locks Plinko for 180m, blocks play/upgrades, then expires', () => {
    const config = withoutEventRolls();
    const state = pending('EVENT_08', { cash: 10_000 });
    const event = resolveEventChoice(state, config, 'EVENT_08', 'b');

    expect(event.state.eventModifiers.plinkoLockRemainingMinutes).toBe(180);
    expect(() =>
      commitBareDrop(event.state, null, config, 'locked-drop', 1),
    ).toThrow('event-locked');
    expect(() =>
      purchaseMaxBetUpgrade(event.state, null, config),
    ).toThrow('event-locked');

    const advanced = advanceRunTime(event.state, null, 180, config);
    expect(advanced.state.eventModifiers.plinkoLockRemainingMinutes).toBe(0);
    expect(() =>
      commitBareDrop(advanced.state, null, config, 'unlocked-drop', 1),
    ).not.toThrow();
  });

  it('EVENT_09 B locks one deterministic currently-unlocked job for 360m', () => {
    const state = pending('EVENT_09');
    const resolved = resolveEventChoice(
      state,
      balance,
      'EVENT_09',
      'b',
    );

    expect(resolved.lockedJobId).not.toBeNull();
    expect(
      resolved.state.eventModifiers.jobLockRemainingMinutes[
        resolved.lockedJobId!
      ],
    ).toBe(360);
  });

  it('EVENT_09 becomes ineligible when every job is already event-locked', () => {
    const state = {
      ...createInitialGameState(balance, 5),
      eventModifiers: {
        ...createInitialGameState(balance, 5).eventModifiers,
        jobLockRemainingMinutes: {
          dishes: 10,
          trash: 20,
          courier: 30,
        },
      },
    };

    expect(isEventEligible(state, balance, 'EVENT_09')).toBe(false);
  });

  it('EVENT_10 B increases food prices by 30% for 720m and refreshes, not stacks', () => {
    const config = withoutEventRolls();
    const food = config.food.find((entry) => entry.price > 0)!;
    const state = pending('EVENT_10', { cash: 10_000 });
    const event = resolveEventChoice(state, config, 'EVENT_10', 'b');

    expect(event.state.eventModifiers.foodPriceMultiplier).toEqual({
      multiplier: 1.3,
      remainingMinutes: 720,
    });

    const started = startFood(
      event.state,
      null,
      null,
      config,
      food.id,
    );
    expect(started.state.cash).toBe(
      10_000 - Math.round(food.price * 1.3),
    );

    const partlyExpired = advanceRunTime(event.state, null, 300, config).state;
    expect(partlyExpired.eventModifiers.foodPriceMultiplier?.remainingMinutes).toBe(
      420,
    );

    const refreshed = resolveEventChoice(
      {
        ...partlyExpired,
        pendingEventId: 'EVENT_10',
      },
      config,
      'EVENT_10',
      'b',
    );
    expect(refreshed.state.eventModifiers.foodPriceMultiplier).toEqual({
      multiplier: 1.3,
      remainingMinutes: 720,
    });
  });

  it('event job lock blocks only the selected job until its timer expires', () => {
    const config = withoutEventRolls();
    const base = {
      ...createInitialGameState(config, 6),
      clock: createGameClock('00:00'),
      eventModifiers: {
        ...createInitialGameState(config, 6).eventModifiers,
        jobLockRemainingMinutes: {
          dishes: 0,
          trash: 60,
          courier: 0,
        },
      },
    };

    expect(() => startWork(base, config, 'trash', 1)).toThrow(
      'event-locked',
    );

    const advanced = advanceRunTime(base, null, 60, config);
    expect(
      advanced.state.eventModifiers.jobLockRemainingMinutes.trash,
    ).toBe(0);
    expect(() =>
      startWork(advanced.state, config, 'trash', 1),
    ).not.toThrow();
  });
});
