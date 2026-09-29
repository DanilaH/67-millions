import type {
  AnalyticsAdapter,
  AnalyticsParams,
} from '@danilah/mini-games-kit/platform';

import type { BalanceConfig } from '../config/balance.schema';
import { getBarryPaymentDue } from '../core/barry/barry';
import { canPayMainDebt } from '../core/economy/mainDebt';
import type {
  GameState,
  TerminalReason,
} from '../core/state/GameState';

type Primitive = boolean | number | string;
type Payload<T extends Record<string, Primitive>> =
  Readonly<T>;

export interface GameAnalyticsEvents {
  game_start: Payload<{
    game_day: number;
    minute_of_day: number;
    cash: number;
    main_debt: number;
  }>;
  game_over: Payload<{
    reason: TerminalReason;
    game_day: number;
    minute_of_day: number;
    cash: number;
    barry_payment_index: number;
  }>;
  victory: Payload<{
    game_day: number;
    minute_of_day: number;
    cash: number;
    total_barry_paid: number;
  }>;
  barry_due: Payload<{
    payment_index: number;
    due: number;
    cash: number;
    game_day: number;
  }>;
  barry_paid: Payload<{
    payment_index: number;
    amount: number;
    cash_after: number;
  }>;
  work_started: Payload<{
    job: string;
    level: number;
    game_day: number;
    minute_of_day: number;
  }>;
  work_completed: Payload<{
    job: string;
    level: number;
    payout: number;
    cash_after: number;
    duration_minutes: number;
  }>;
  work_failed: Payload<{
    job: string;
    level: number;
    fine: number;
    cash_after: number;
    duration_minutes: number;
  }>;
  plinko_drop: Payload<{
    drop_id: string;
    bet: number;
    board_hash: string;
    cash_before: number;
    cash_after: number;
    rng_state_at_commit: number;
    max_bet_level: number;
  }>;
  plinko_resolved: Payload<{
    drop_id: string;
    bet: number;
    payout: number;
    multiplier: number;
    board_hash: string;
    cash_before: number;
    cash_after: number;
    rng_state_at_commit: number;
    physics_ticks: number;
    resumed: boolean;
    session_split_events: number;
    session_amplifier_events: number;
    session_return_events: number;
    session_peak_active_balls: number;
    insurance_applied: boolean;
  }>;
  upgrade_bought: Payload<{
    upgrade: string;
    from_level: number;
    to_level: number;
    price: number;
    cash_after: number;
  }>;
  food_used: Payload<{
    food_id: string;
    price: number;
    duration_minutes: number;
    cash_after: number;
  }>;
  sleep_started: Payload<{
    duration_minutes: number;
    game_day: number;
    minute_of_day: number;
  }>;
  sleep_completed: Payload<{
    duration_minutes: number;
    game_day: number;
    minute_of_day: number;
  }>;
  entertainment_used: Payload<{
    entertainment_id: string;
    price: number;
    duration_minutes: number;
    cash_after: number;
  }>;
  event_shown: Payload<{
    event_id: string;
    game_day: number;
    minute_of_day: number;
    cash: number;
  }>;
  event_choice: Payload<{
    event_id: string;
    choice: string;
    cash_cost: number;
    cash_after: number;
    time_cost_minutes: number;
  }>;
  dumpster_search: Payload<{
    loot: string;
    cash_award: number;
    streak_after: number;
  }>;
  near_bankruptcy: Payload<{
    cash: number;
    next_barry_due: number;
    payment_index: number;
  }>;
  main_debt_ready: Payload<{
    cash: number;
    main_debt: number;
  }>;
  main_debt_paid: Payload<{
    amount: number;
    cash_after: number;
    total_barry_paid: number;
  }>;
}

export type GameAnalyticsEventName =
  keyof GameAnalyticsEvents;

export const GAME_ANALYTICS_EVENT_NAMES =
  [
    'game_start',
    'game_over',
    'victory',
    'barry_due',
    'barry_paid',
    'work_started',
    'work_completed',
    'work_failed',
    'plinko_drop',
    'plinko_resolved',
    'upgrade_bought',
    'food_used',
    'sleep_started',
    'sleep_completed',
    'entertainment_used',
    'event_shown',
    'event_choice',
    'dumpster_search',
    'near_bankruptcy',
    'main_debt_ready',
    'main_debt_paid',
  ] as const satisfies readonly GameAnalyticsEventName[];

interface ObservedState {
  barryPending: boolean;
  terminalReason: TerminalReason | null;
  victory: boolean;
  nearBankruptcy: boolean;
  mainDebtReady: boolean;
}

export const isNearBankruptcyState = (
  state: GameState,
  config: BalanceConfig,
): boolean =>
  state.terminalReason === null &&
  !state.victory &&
  !state.barryInterruptPending &&
  state.cash <
    getBarryPaymentDue(state, config);

const observe = (
  state: GameState,
  config: BalanceConfig,
): ObservedState => ({
  barryPending: state.barryInterruptPending,
  terminalReason: state.terminalReason,
  victory: state.victory,
  nearBankruptcy:
    isNearBankruptcyState(state, config),
  mainDebtReady: canPayMainDebt(state),
});

export class GameAnalytics {
  private runStarted = false;
  private lastObserved: ObservedState | null =
    null;
  private lastShownEventToken: string | null =
    null;

  public constructor(
    private readonly adapter: AnalyticsAdapter,
    private readonly config: BalanceConfig,
  ) {}

  public beginRun(
    state: GameState,
    force = false,
  ): void {
    if (this.runStarted && !force) return;

    this.runStarted = true;
    this.lastShownEventToken = null;
    this.lastObserved = observe(
      state,
      this.config,
    );

    this.track('game_start', {
      game_day: state.clock.gameDayIndex + 1,
      minute_of_day: state.clock.minuteOfDay,
      cash: state.cash,
      main_debt: state.mainDebt,
    });
  }

  public observeState(state: GameState): void {
    if (!this.runStarted) {
      this.beginRun(state);
      return;
    }

    const previous =
      this.lastObserved ??
      observe(state, this.config);
    const next = observe(
      state,
      this.config,
    );

    if (
      !previous.barryPending &&
      next.barryPending
    ) {
      this.track('barry_due', {
        payment_index:
          state.barryPaymentIndex,
        due: getBarryPaymentDue(
          state,
          this.config,
        ),
        cash: state.cash,
        game_day:
          state.clock.gameDayIndex + 1,
      });
    }

    if (
      previous.terminalReason === null &&
      next.terminalReason !== null
    ) {
      this.track('game_over', {
        reason: next.terminalReason,
        game_day:
          state.clock.gameDayIndex + 1,
        minute_of_day:
          state.clock.minuteOfDay,
        cash: state.cash,
        barry_payment_index:
          state.barryPaymentIndex,
      });
    }

    if (
      !previous.victory &&
      next.victory
    ) {
      this.track('victory', {
        game_day:
          state.clock.gameDayIndex + 1,
        minute_of_day:
          state.clock.minuteOfDay,
        cash: state.cash,
        total_barry_paid:
          state.totalBarryPaid,
      });
    }

    if (
      !previous.nearBankruptcy &&
      next.nearBankruptcy
    ) {
      this.track('near_bankruptcy', {
        cash: state.cash,
        next_barry_due:
          getBarryPaymentDue(
            state,
            this.config,
          ),
        payment_index:
          state.barryPaymentIndex,
      });
    }

    if (
      !previous.mainDebtReady &&
      next.mainDebtReady
    ) {
      this.track('main_debt_ready', {
        cash: state.cash,
        main_debt: state.mainDebt,
      });
    }

    this.lastObserved = next;
  }

  public eventShown(
    state: GameState,
    eventId: string,
  ): void {
    const token = [
      state.clock.gameDayIndex,
      state.eventsResolvedThisGameDay,
      eventId,
    ].join(':');

    if (
      token === this.lastShownEventToken
    ) {
      return;
    }

    this.lastShownEventToken = token;
    this.track('event_shown', {
      event_id: eventId,
      game_day:
        state.clock.gameDayIndex + 1,
      minute_of_day:
        state.clock.minuteOfDay,
      cash: state.cash,
    });
  }

  public clearShownEvent(): void {
    this.lastShownEventToken = null;
  }

  public track<
    Name extends GameAnalyticsEventName,
  >(
    event: Name,
    payload: GameAnalyticsEvents[Name],
  ): void {
    this.adapter.track(
      event,
      payload as AnalyticsParams,
    );
  }
}
