import { describe, expect, it } from 'vitest';

import type { BalanceConfig } from '../src/config/balance.schema';
import { balance } from '../src/config/balance';
import { resolveBarryPayment } from '../src/core/barry/barry';
import { commitBareDrop } from '../src/core/plinko-rules/drop';
import {
  advancePendingDropTime,
  settlePendingDropAndResumeTime,
} from '../src/core/plinko-rules/dropTiming';
import {
  advanceEventCheckpoints,
  getPresentablePendingEventId,
  resolvePendingEvent,
} from '../src/core/events/eventScheduler';
import { startSleep } from '../src/core/sleep/sleep';
import { createInitialGameState } from '../src/core/state/GameState';
import { createGameClock } from '../src/core/time/GameClock';
import { advanceRunTime } from '../src/core/time/runTime';
import { startWork } from '../src/core/work/work';

const withEventChance = (chancePerCheckpoint: number): BalanceConfig => ({
  ...balance,
  events: {
    ...balance.events,
    chancePerCheckpoint,
  },
});

describe('event scheduler', () => {
  it('checks the fixed configured checkpoint when normal time crosses it', () => {
    const config = withEventChance(1);
    const state = {
      ...createInitialGameState(config, 123),
      clock: createGameClock('12:50'),
    };

    const advanced = advanceRunTime(state, null, 20, config);

    expect(advanced.softCheckpointsCrossed).toEqual(['13:00']);
    expect(advanced.state.pendingEventId).not.toBeNull();
    expect(
      config.events.definitions.some(
        (definition) => definition.id === advanced.state.pendingEventId,
      ),
    ).toBe(true);
    expect(advanced.state.rngState).not.toBe(state.rngState);
  });

  it('does not perform event checks while sleeping', () => {
    const config = withEventChance(1);
    const state = {
      ...createInitialGameState(config, 321),
      clock: createGameClock('12:50'),
    };
    const sleep = startSleep(state, config);

    const advanced = advanceRunTime(state, sleep, 20, config);

    expect(advanced.softCheckpointsCrossed).toEqual(['13:00']);
    expect(advanced.state.pendingEventId).toBeNull();
    expect(advanced.state.rngState).toBe(state.rngState);
  });

  it('creates at most one pending event and suppresses later checkpoint rolls', () => {
    const config = withEventChance(1);
    const state = createInitialGameState(config, 456);

    const first = advanceEventCheckpoints(
      state,
      ['13:00', '17:00', '21:00'],
      config,
      { isSleeping: false },
    );

    expect(first.pendingCreated).not.toBeNull();
    expect(first.attemptedCheckpoints).toBe(1);

    const rngAfterPending = first.state.rngState;
    const suppressed = advanceEventCheckpoints(
      first.state,
      ['01:00', '05:00'],
      config,
      { isSleeping: false },
    );

    expect(suppressed.attemptedCheckpoints).toBe(0);
    expect(suppressed.state.pendingEventId).toBe(first.state.pendingEventId);
    expect(suppressed.state.rngState).toBe(rngAfterPending);
  });

  it('allows at most two resolved events in one game day', () => {
    const config = withEventChance(1);
    const initial = createInitialGameState(config, 789);

    const first = advanceEventCheckpoints(
      initial,
      ['13:00'],
      config,
      { isSleeping: false },
    );
    const firstId = first.state.pendingEventId!;
    const afterFirst = resolvePendingEvent(first.state, firstId, config);

    const second = advanceEventCheckpoints(
      afterFirst,
      ['17:00'],
      config,
      { isSleeping: false },
    );
    const secondId = second.state.pendingEventId!;
    const afterSecond = resolvePendingEvent(second.state, secondId, config);

    expect(afterSecond.eventsResolvedThisGameDay).toBe(2);

    const rngBeforeSuppressed = afterSecond.rngState;
    const third = advanceEventCheckpoints(
      afterSecond,
      ['21:00'],
      config,
      { isSleeping: false },
    );

    expect(third.attemptedCheckpoints).toBe(0);
    expect(third.state.pendingEventId).toBeNull();
    expect(third.state.rngState).toBe(rngBeforeSuppressed);
  });

  it('excludes the immediately previous resolved event from selection', () => {
    const config = withEventChance(1);
    const state = {
      ...createInitialGameState(config, 999),
      lastResolvedEventId: 'EVENT_03',
    };

    const result = advanceEventCheckpoints(
      state,
      ['13:00'],
      config,
      {
        isSleeping: false,
        eligibleEventIds: ['EVENT_03', 'EVENT_04'],
      },
    );

    expect(result.state.pendingEventId).toBe('EVENT_04');

    const resolved = resolvePendingEvent(
      result.state,
      'EVENT_04',
      config,
    );
    expect(resolved.lastResolvedEventId).toBe('EVENT_04');
  });

  it('keeps a successful work-checkpoint roll pending until a safe point', () => {
    const config = withEventChance(1);
    const state = {
      ...createInitialGameState(config, 2468),
      clock: createGameClock('12:50'),
    };
    const started = startWork(state, config, 'courier', 1);

    const advanced = advanceRunTime(
      started.state,
      started.action,
      20,
      config,
    );

    expect(advanced.state.pendingEventId).not.toBeNull();
    expect(advanced.activeAction).not.toBeNull();
    expect(
      getPresentablePendingEventId(advanced.state, {
        skillInputActive: true,
        pendingDropActive: false,
      }),
    ).toBeNull();

    expect(
      getPresentablePendingEventId(advanced.state, {
        skillInputActive: false,
        pendingDropActive: false,
      }),
    ).toBe(advanced.state.pendingEventId);
  });

  it('keeps a Drop checkpoint event pending until the cascade is settled', () => {
    const config = withEventChance(1);
    const state = {
      ...createInitialGameState(config, 8642),
      cash: 1_000,
      clock: createGameClock('12:50'),
    };
    const committed = commitBareDrop(
      state,
      null,
      config,
      'event-drop',
      1,
    );

    const timed = advancePendingDropTime(
      committed.state,
      committed.pendingDrop,
      config,
    );

    expect(timed.softCheckpointsCrossed).toEqual(['13:00']);
    expect(timed.state.pendingEventId).not.toBeNull();
    expect(
      getPresentablePendingEventId(timed.state, {
        skillInputActive: false,
        pendingDropActive: true,
      }),
    ).toBeNull();

    const settled = settlePendingDropAndResumeTime(
      timed.state,
      timed.pendingDrop,
      3,
      config,
    );

    expect(
      getPresentablePendingEventId(settled.state, {
        skillInputActive: false,
        pendingDropActive: false,
      }),
    ).toBe(settled.state.pendingEventId);
  });

  it('keeps pending event behind Barry and resets only the daily resolved counter', () => {
    const config = withEventChance(1);
    const state = {
      ...createInitialGameState(config, 1357),
      cash: 5_000,
      clock: createGameClock('08:50'),
      pendingEventId: 'EVENT_02',
      eventsResolvedThisGameDay: 2,
      lastResolvedEventId: 'EVENT_01',
    };

    const advanced = advanceRunTime(state, null, 20, config);

    expect(advanced.state.barryInterruptPending).toBe(true);
    expect(advanced.state.pendingEventId).toBe('EVENT_02');
    expect(advanced.state.eventsResolvedThisGameDay).toBe(0);
    expect(advanced.state.lastResolvedEventId).toBe('EVENT_01');
    expect(
      getPresentablePendingEventId(advanced.state, {
        skillInputActive: false,
        pendingDropActive: false,
      }),
    ).toBeNull();

    const paid = resolveBarryPayment(advanced.state, config);
    expect(
      getPresentablePendingEventId(paid, {
        skillInputActive: false,
        pendingDropActive: false,
      }),
    ).toBe('EVENT_02');
  });

  it('is deterministic for the same serialized state and checkpoint sequence', () => {
    const config = withEventChance(1);
    const state = createInitialGameState(config, 424242);

    const a = advanceEventCheckpoints(
      state,
      ['13:00'],
      config,
      { isSleeping: false },
    );
    const b = advanceEventCheckpoints(
      state,
      ['13:00'],
      config,
      { isSleeping: false },
    );

    expect(a).toEqual(b);
  });
});
