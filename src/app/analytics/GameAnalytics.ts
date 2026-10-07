import type { AnalyticsAdapter, AnalyticsParams } from '@danilah/mini-games-kit/platform';
import type { BalanceConfig } from '../../config/balance.schema';
import type { SaveState } from '../../core/save/SaveState';
import { canPayMainDebt } from '../../core/economy/mainDebt';
import type { GameState } from '../../core/state/GameState';

export const GAME_ANALYTICS_KEY = '67m:analytics';
export type GameEvent =
  | 'game_start' | 'game_over' | 'victory' | 'barry_due' | 'barry_paid'
  | 'work_started' | 'work_completed' | 'work_failed' | 'plinko_drop' | 'plinko_resolved'
  | 'upgrade_bought' | 'food_used' | 'sleep_started' | 'sleep_completed'
  | 'entertainment_used' | 'event_shown' | 'event_choice' | 'dumpster_search'
  | 'near_bankruptcy' | 'main_debt_ready' | 'main_debt_paid';

const upgrades = {
  capacity: 'plinkoCapacityLevel', maxBet: 'plinkoMaxBetLevel', center: 'plinkoCenterLevel', mid: 'plinkoMidLevel',
  jackpot: 'plinkoJackpotLevel', amplifier: 'plinkoAmplifierLevel', return: 'plinkoReturnLevel',
  splitter: 'plinkoSplitterLevel', jackpotBias: 'plinkoJackpotBiasLevel', insurance: 'plinkoInsuranceLevel',
} as const;

/** Presentation telemetry observes successful save writes; it never changes saves or RNG. */
export class GameAnalytics {
  private previous: { game: GameState; activeAction: SaveState['activeAction']; pendingDrop: boolean } | null = null;
  private shownEvent: string | null = null;
  private runSequence = 0;
  constructor(private readonly adapter: AnalyticsAdapter, private readonly config: BalanceConfig) {}

  track(event: GameEvent, state: GameState, params: AnalyticsParams = {}): void {
    try {
      this.adapter.track(event, {
        schema_version: 1, config_version: this.config.meta.version,
        run_sequence: this.runSequence, game_day: state.clock.gameDayIndex,
        game_minute: state.clock.minuteOfDay, cash: state.cash, ...params,
      });
    } catch { /* Telemetry must not break gameplay, persistence or boot. */ }
  }

  loaded(save: SaveState): void {
    if (this.previous !== null) return; // Scene changes reuse one observer.
    this.previous = this.snapshot(save);
    this.runSequence += 1;
    this.track('game_start', save.game, { entry: 'load_or_new', rng_state: save.game.rngState });
  }

  eventShown(eventId: string | null, state: GameState): void {
    if (eventId !== null && this.shownEvent !== eventId) {
      this.track('event_shown', state, { event_id: eventId });
    }
    if (eventId !== null) this.shownEvent = eventId;
  }

  committed(save: SaveState): void {
    const before = this.previous;
    if (before === null) { this.loaded(save); return; }
    this.previous = this.snapshot(save);
    const a = before.game, b = save.game;
    if (a.pendingEventId !== null && b.pendingEventId === null) this.shownEvent = null;
    // A restart leaves a terminal state and creates a fresh initial state.
    if ((a.victory || a.terminalReason !== null) && !b.victory && b.terminalReason === null) {
      this.runSequence += 1;
      this.shownEvent = null;
      this.track('game_start', b, { restored: false, rng_state: b.rngState });
      return;
    }
    if (!a.barryInterruptPending && (b.barryInterruptPending || b.totalBarryPaid > a.totalBarryPaid)) this.track('barry_due', b, { payment_index: b.barryPaymentIndex });
    if (b.totalBarryPaid > a.totalBarryPaid) this.track('barry_paid', b, { amount: b.totalBarryPaid - a.totalBarryPaid, payment_index: a.barryPaymentIndex });
    if (a.terminalReason === null && b.terminalReason !== null) this.track('game_over', b, { reason: b.terminalReason });
    if (!a.victory && b.victory) {
      this.track('main_debt_paid', b, { amount: a.mainDebt });
      this.track('victory', b);
    }
    if (!(canPayMainDebt(a) && !before.pendingDrop && before.activeAction === null) && canPayMainDebt(b) && save.pendingDrop === null && save.activeAction === null) this.track('main_debt_ready', b, { amount: b.mainDebt });
    // Near bankruptcy = downward crossing of the first daily payment, once per crossing.
    const threshold = this.config.barry.payments[0]!;
    if (a.cash >= threshold && b.cash < threshold && !b.victory && b.terminalReason === null) this.track('near_bankruptcy', b, { threshold });
    for (const [id, field] of Object.entries(upgrades)) {
      const key = field as typeof upgrades[keyof typeof upgrades];
      if (b[key] > a[key]) this.track('upgrade_bought', b, { upgrade_id: id, level: b[key], cost: a.cash - b.cash });
    }
    for (const job of ['dishes', 'trash', 'courier'] as const) {
      if (b.jobLevels[job] > a.jobLevels[job]) this.track('upgrade_bought', b, { upgrade_id: `job:${job}`, level: b.jobLevels[job], cost: a.cash - b.cash });
    }
    const oldAction = before.activeAction, action = save.activeAction;
    if (action && !oldAction) {
      if (action.kind === 'WORK') this.track('work_started', b, { job_id: action.actionId, level: action.level });
      if (action.kind === 'SLEEP') this.track('sleep_started', b);
    }
    if (oldAction && !action && b.terminalReason === null) {
      const moneyDelta = b.cash - a.cash + b.totalBarryPaid - a.totalBarryPaid;
      if (oldAction.kind === 'WORK') this.track(oldAction.result === 'SUCCESS' ? 'work_completed' : 'work_failed', b, { job_id: oldAction.actionId, level: oldAction.level, cash_delta: moneyDelta });
      if (oldAction.kind === 'SLEEP') this.track('sleep_completed', b, { slept_minutes: (b.clock.gameDayIndex - oldAction.startedAtGameDayIndex) * 1440 + ((b.clock.minuteOfDay + 900) % 1440) - ((oldAction.startedAtMinuteOfDay + 900) % 1440) });
      if (oldAction.kind === 'DUMPSTER') this.track('dumpster_search', b, { cash_delta: moneyDelta, smelly: b.statuses.SMELLY });
      if (oldAction.kind === 'TIMED_PAID') {
        if (this.config.food.some(food => food.id === oldAction.actionId)) this.track('food_used', b, { food_id: oldAction.actionId });
        if (this.config.entertainment.some(item => item.id === oldAction.actionId)) this.track('entertainment_used', b, { entertainment_id: oldAction.actionId });
      }
    }
    if (!before.pendingDrop && save.pendingDrop) {
      const drop = save.pendingDrop;
      this.track('plinko_drop', b, { bet: drop.originalStake, payout: 0, board_hash: drop.boardFingerprint, cash_before: a.cash, cash_after: b.cash, seed: drop.rngStateAtCommit, drop_id: drop.dropId, cascade_fixed_ticks: 0, cascade_active_balls: 0 });
    }
  }

  private snapshot(save: SaveState): NonNullable<GameAnalytics['previous']> {
    // Physics checkpoints can contain 24 balls; telemetry only needs the transaction edge.
    return { game: structuredClone(save.game), activeAction: structuredClone(save.activeAction), pendingDrop: save.pendingDrop !== null };
  }
}
