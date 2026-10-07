import { debitCash } from '../../src/core/economy/money';
import { WorkMinigameClock } from '../../src/core/work/WorkMinigameClock';
import { ActiveTimeAccumulator } from '../../src/core/time/ActiveTimeAccumulator';
import type { BalanceConfig } from '../../src/config/balance.schema';
import {
  type ActiveAction,
  type TimedPaidActiveAction,
  type WorkActiveAction,
} from '../../src/core/actions/ActiveAction';
import {
  settleRecoveryAction,
  startEntertainment,
  startFood,
} from '../../src/core/actions/foodEntertainment';
import {
  settleShower,
  startShower,
} from '../../src/core/actions/shower';
import {
  settleDumpsterSearch,
  startDumpsterSearch,
} from '../../src/core/actions/dumpster';
import { resolveBarryPayment } from '../../src/core/barry/barry';
import { payMainDebt } from '../../src/core/economy/mainDebt';
import {
  resolveEventChoice,
  type EventChoiceId,
} from '../../src/core/events/eventEffects';
import {
  commitBareDrop,
  type BetFraction,
  type PendingDrop,
} from '../../src/core/plinko-rules/drop';
import {
  advancePendingDropTime,
  settleAggregatePendingDropAndResumeTime,
} from '../../src/core/plinko-rules/dropTiming';
import {
  purchaseInsuranceUpgrade,
  purchaseMaxBetUpgrade,
  purchasePocketUpgrade,
  purchaseSpecialUpgrade,
  type PocketUpgradeTrack,
  type SpecialUpgradeTrack,
} from '../../src/core/plinko-rules/progression';
import { startSleep } from '../../src/core/sleep/sleep';
import {
  createInitialGameState,
  type GameState,
} from '../../src/core/state/GameState';
import { minutesUntilClockTime } from '../../src/core/time/GameClock';
import { advanceRunTime } from '../../src/core/time/runTime';
import {
  purchaseJobUpgrade,
  setWorkResult,
  settleWork,
  startWork,
  type JobId,
} from '../../src/core/work/work';

export type FullGameOutcome =
  | 'VICTORY'
  | 'BARRY_LOSS'
  | 'HP_DEATH'
  | 'STOPPED'
  | 'STEP_LIMIT';

export type FullGameDecision =
  | { type: 'WAIT'; minutes: number }
  | { type: 'PAY_MAIN_DEBT' }
  | {
      type: 'WORK';
      jobId: JobId;
      level: number;
      result: 'SUCCESS' | 'FAILURE';
    }
  | { type: 'FOOD'; id: string }
  | { type: 'ENTERTAINMENT'; id: string }
  | { type: 'DUMPSTER' }
  | { type: 'SHOWER' }
  | { type: 'SLEEP' }
  | { type: 'PLINKO'; fraction?: BetFraction }
  | { type: 'EVENT_CHOICE'; choice: EventChoiceId }
  | { type: 'BUY_JOB_UPGRADE'; jobId: JobId }
  | { type: 'AUDIT_BUY_CAPACITY'; price:number; capacity:number }
  | { type: 'BUY_PLINKO_MAX_BET' }
  | { type: 'BUY_PLINKO_POCKET'; track: PocketUpgradeTrack }
  | { type: 'BUY_PLINKO_SPECIAL'; track: SpecialUpgradeTrack }
  | { type: 'BUY_PLINKO_INSURANCE' }
  | { type: 'STOP' };

export interface FullGameCounters {
  decisions: number;
  gameMinutesAdvanced: number;
  workShifts: number;
  plinkoDrops: number;
  foodActions: number;
  entertainmentActions: number;
  dumpsterSearches: number;
  showers: number;
  sleeps: number;
  eventsResolved: number;
  purchases: number;
}

export interface FullGameIncomeDiagnostics {
  work: number;
  plinko: number;
  dumpster: number;
}

export interface FullGameDiagnostics {
  nearZeroCashThreshold: number;
  peakCash: number;
  minCash: number;
  maxBankrollDrawdown: number;
  income: FullGameIncomeDiagnostics;
  largestPlinkoPayout: number;
  dumpsterComebacks: number;
  dumpsterHpDeaths: number;
  nearZeroCashRecoveries: number;
  upgradeOrder: string[];
  activeSeconds?: { physics: number; work: number; decisions: number; idle: number };
}

export interface FullGamePolicyContext {
  state: GameState;
  activeAction: ActiveAction | null;
  counters: Readonly<FullGameCounters>;
  decisionIndex: number;
  activeSeconds?: number;
}

export interface FullGamePolicy {
  id: string;
  decide(context: FullGamePolicyContext): FullGameDecision;
}

export interface PlinkoOutcomeContext {
  state: GameState;
  pendingDrop: PendingDrop;
  config: BalanceConfig;
  dropIndex: number;
}

export interface PlinkoOutcome {
  aggregatePayout: number;
  nextRngState: number;
}

export interface PlinkoOutcomeModel {
  id: string;
  resolve(context: PlinkoOutcomeContext): PlinkoOutcome;
}

export interface FullGameRunnerOptions {
  seed: number;
  configHash: string;
  maxDecisions?: number;
  maxGameMinutes?: number;
  execution?: {
    onAuditCapacityPurchase?: (capacity:number) => void;
    decisionSeconds: number;
    workSeconds: (jobId: JobId) => number;
    plinko: (state: GameState, fraction: BetFraction) => {
      state: GameState; advancedMinutes: number; launches: number; seconds: number;
      settlements: { stake: number; payout: number }[];
    };
  };
}

export interface FullGameRunResult {
  configHash: string;
  configVersion: string;
  seed: number;
  policyId: string;
  plinkoOutcomeModelId: string;
  outcome: FullGameOutcome;
  state: GameState;
  counters: FullGameCounters;
  diagnostics: FullGameDiagnostics;
}

interface RunnerState {
  game: GameState;
  activeAction: ActiveAction | null;
  stopped: boolean;
}

const createCounters = (): FullGameCounters => ({
  decisions: 0,
  gameMinutesAdvanced: 0,
  workShifts: 0,
  plinkoDrops: 0,
  foodActions: 0,
  entertainmentActions: 0,
  dumpsterSearches: 0,
  showers: 0,
  sleeps: 0,
  eventsResolved: 0,
  purchases: 0,
});

const createDiagnostics = (
  initialCash: number,
): FullGameDiagnostics => ({
  nearZeroCashThreshold: initialCash * 2,
  peakCash: initialCash,
  minCash: initialCash,
  maxBankrollDrawdown: 0,
  income: {
    work: 0,
    plinko: 0,
    dumpster: 0,
  },
  largestPlinkoPayout: 0,
  dumpsterComebacks: 0,
  dumpsterHpDeaths: 0,
  nearZeroCashRecoveries: 0,
  upgradeOrder: [],
});

const observeCash = (
  diagnostics: FullGameDiagnostics,
  cash: number,
): void => {
  diagnostics.peakCash = Math.max(diagnostics.peakCash, cash);
  diagnostics.minCash = Math.min(diagnostics.minCash, cash);
  diagnostics.maxBankrollDrawdown = Math.max(
    diagnostics.maxBankrollDrawdown,
    diagnostics.peakCash - cash,
  );
};

const recordIncome = (
  diagnostics: FullGameDiagnostics,
  source: keyof FullGameIncomeDiagnostics,
  amount: number,
  cashBeforeCredit: number,
): void => {
  if (!Number.isFinite(amount) || amount <= 0) return;
  diagnostics.income[source] += amount;

  if (
    cashBeforeCredit <= diagnostics.nearZeroCashThreshold &&
    cashBeforeCredit + amount > diagnostics.nearZeroCashThreshold
  ) {
    diagnostics.nearZeroCashRecoveries += 1;
    if (source === 'dumpster') {
      diagnostics.dumpsterComebacks += 1;
    }
  }
};

const getOutcome = (
  state: GameState,
  stopped: boolean,
  reachedLimit: boolean,
): FullGameOutcome | null => {
  if (state.victory) return 'VICTORY';
  if (state.terminalReason === 'BARRY_PAYMENT_FAILED') return 'BARRY_LOSS';
  if (state.terminalReason === 'HEALTH_ZERO') return 'HP_DEATH';
  if (stopped) return 'STOPPED';
  if (reachedLimit) return 'STEP_LIMIT';
  return null;
};

const settleCompletedAction = (
  state: GameState,
  action: ActiveAction,
  config: BalanceConfig,
  diagnostics: FullGameDiagnostics,
): GameState => {
  if (state.terminalReason !== null || state.victory) return state;

  if (action.kind === 'WORK') {
    const beforeCash = state.cash;
    const settled = settleWork(state, action, config);
    recordIncome(
      diagnostics,
      'work',
      Math.max(0, settled.cash - beforeCash),
      beforeCash,
    );
    return settled;
  }

  if (action.kind === 'DUMPSTER') {
    const beforeCash = state.cash;
    const settled = settleDumpsterSearch(state, config);
    recordIncome(
      diagnostics,
      'dumpster',
      settled.cashAward,
      beforeCash,
    );
    return settled.state;
  }

  if (action.kind === 'TIMED_PAID') {
    if (action.actionId === 'SHOWER') {
      return settleShower(state, action, config);
    }
    return settleRecoveryAction(state, action, config);
  }

  return state;
};

const completeActiveAction = (
  initialState: GameState,
  initialAction: ActiveAction,
  config: BalanceConfig,
  counters: FullGameCounters,
  diagnostics: FullGameDiagnostics,
  maxGameMinutes: number,
): { state: GameState; activeAction: ActiveAction | null } => {
  let state = initialState;
  let activeAction: ActiveAction | null = initialAction;

  while (
    activeAction !== null &&
    state.terminalReason === null &&
    !state.victory &&
    counters.gameMinutesAdvanced < maxGameMinutes
  ) {
    const currentAction = activeAction;
    const advanced = advanceRunTime(
      state,
      currentAction,
      currentAction.remainingMinutes,
      config,
    );

    state = advanced.state;
    activeAction = advanced.activeAction;
    counters.gameMinutesAdvanced += advanced.advancedMinutes;

    if (
      currentAction.kind === 'DUMPSTER' &&
      state.terminalReason === 'HEALTH_ZERO'
    ) {
      diagnostics.dumpsterHpDeaths += 1;
    }

    if (state.barryInterruptPending) {
      state = resolveBarryPayment(state, config);
      if (state.terminalReason !== null) break;
      continue;
    }

    if (advanced.actionCompleted) {
      state = settleCompletedAction(
        state,
        currentAction,
        config,
        diagnostics,
      );
      activeAction = null;
      break;
    }

    if (advanced.advancedMinutes === 0) {
      throw new Error('Active action made no progress');
    }
  }

  return { state, activeAction };
};

const advanceIdle = (
  initialState: GameState,
  requestedMinutes: number,
  config: BalanceConfig,
  counters: FullGameCounters,
  maxGameMinutes: number,
): GameState => {
  if (!Number.isFinite(requestedMinutes) || requestedMinutes <= 0) {
    throw new RangeError('WAIT minutes must be positive and finite');
  }

  let state = initialState;
  let remaining = requestedMinutes;

  while (
    remaining > 0 &&
    state.terminalReason === null &&
    !state.victory &&
    state.pendingEventId === null &&
    counters.gameMinutesAdvanced < maxGameMinutes
  ) {
    const toCheckpoint = Math.min(
      ...config.time.eventCheckpoints.map((checkpoint) =>
        minutesUntilClockTime(state.clock, checkpoint),
      ),
    );
    const requestedSlice = Math.min(remaining, toCheckpoint);
    const advanced = advanceRunTime(
      state,
      null,
      requestedSlice,
      config,
    );

    state = advanced.state;
    counters.gameMinutesAdvanced += advanced.advancedMinutes;
    remaining -= advanced.advancedMinutes;

    if (state.barryInterruptPending) {
      state = resolveBarryPayment(state, config);
      if (state.terminalReason !== null) break;
    }

    if (state.pendingEventId !== null) break;

    if (advanced.advancedMinutes === 0) {
      throw new Error('Idle time made no progress');
    }
  }

  return state;
};

const assertDecisionAllowed = (
  state: GameState,
  decision: FullGameDecision,
): void => {
  if (
    state.pendingEventId !== null &&
    decision.type !== 'EVENT_CHOICE' &&
    decision.type !== 'STOP'
  ) {
    throw new Error('Pending event must be resolved before another decision');
  }

  if (state.pendingEventId === null && decision.type === 'EVENT_CHOICE') {
    throw new Error('EVENT_CHOICE requires a pending event');
  }
};

export const runFullGame = (
  config: BalanceConfig,
  policy: FullGamePolicy,
  plinkoOutcomeModel: PlinkoOutcomeModel,
  options: FullGameRunnerOptions,
): FullGameRunResult => {
  if (!options.configHash) throw new Error('Full-game runner requires configHash');
  if (!Number.isInteger(options.seed) || options.seed <= 0) {
    throw new RangeError('Full-game runner seed must be a positive integer');
  }

  const maxDecisions = options.maxDecisions ?? 10_000;
  const maxGameMinutes = options.maxGameMinutes ?? 60 * 24 * 60;
  const counters = createCounters();
  const initialGame = createInitialGameState(config, options.seed);
  const diagnostics = createDiagnostics(initialGame.cash);
  let runner: RunnerState = {
    game: initialGame,
    activeAction: null,
    stopped: false,
  };
  let dropIndex = 0;
  const timing = options.execution ? { physics: 0, work: 0, decisions: 0, idle: 0 } : undefined;
  if (timing) diagnostics.activeSeconds = timing;
  const decisionClock = new ActiveTimeAccumulator(config.time.realSecondsPerGameMinute);

  while (true) {
    // Paying the principal is a successful exit, not a bankroll loss during play.
    if (!runner.game.victory) observeCash(diagnostics, runner.game.cash);

    const outcome = getOutcome(
      runner.game,
      runner.stopped,
      counters.decisions >= maxDecisions ||
        counters.gameMinutesAdvanced >= maxGameMinutes,
    );
    if (outcome !== null) {
      return {
        configHash: options.configHash,
        configVersion: config.meta.version,
        seed: options.seed,
        policyId: policy.id,
        plinkoOutcomeModelId: plinkoOutcomeModel.id,
        outcome,
        state: runner.game,
        counters,
        diagnostics,
      };
    }

    if (runner.activeAction !== null) {
      const completed = completeActiveAction(
        runner.game,
        runner.activeAction,
        config,
        counters,
        diagnostics,
        maxGameMinutes,
      );
      runner = {
        ...runner,
        game: completed.state,
        activeAction: completed.activeAction,
      };
      continue;
    }

    if (runner.game.barryInterruptPending) {
      runner = {
        ...runner,
        game: resolveBarryPayment(runner.game, config),
      };
      continue;
    }

    if (options.execution && timing && !runner.game.pendingEventId) {
      const seconds = options.execution.decisionSeconds;
      const minutes = decisionClock.consume(seconds, true);
      timing.decisions += seconds;
      if (minutes > 0) runner.game = advanceIdle(runner.game, minutes, config, counters, maxGameMinutes);
      if (runner.game.terminalReason || runner.game.victory) continue;
    }
    const decision = policy.decide({
      state: runner.game,
      activeAction: runner.activeAction,
      counters,
      decisionIndex: counters.decisions,
      ...(timing ? { activeSeconds: timing.physics + timing.work + timing.decisions + timing.idle } : {}),
    });
    counters.decisions += 1;
    assertDecisionAllowed(runner.game, decision);

    if (decision.type === 'STOP') {
      runner = { ...runner, stopped: true };
      continue;
    }

    if (decision.type === 'WAIT') {
      const beforeMinutes = counters.gameMinutesAdvanced;
      runner = {
        ...runner,
        game: advanceIdle(
          runner.game,
          decision.minutes,
          config,
          counters,
          maxGameMinutes,
        ),
      };
      if (timing) timing.idle += (counters.gameMinutesAdvanced - beforeMinutes) * config.time.realSecondsPerGameMinute;
      continue;
    }

    if (decision.type === 'PAY_MAIN_DEBT') {
      runner = {
        ...runner,
        game: payMainDebt(runner.game),
      };
      continue;
    }

    if (decision.type === 'EVENT_CHOICE') {
      const pendingEventId = runner.game.pendingEventId;
      if (pendingEventId === null) {
        throw new Error('EVENT_CHOICE requires pending event');
      }
      const beforeResolved = runner.game.eventsResolvedThisGameDay;
      const resolved = resolveEventChoice(
        runner.game,
        config,
        pendingEventId,
        decision.choice,
      );
      counters.eventsResolved +=
        resolved.state.eventsResolvedThisGameDay === beforeResolved
          ? 0
          : 1;
      runner = {
        ...runner,
        game: resolved.state,
        activeAction: resolved.activeAction,
      };
      continue;
    }

    if (decision.type === 'WORK') {
      const started = startWork(
        runner.game,
        config,
        decision.jobId,
        decision.level,
      );
      counters.workShifts += 1;
      let workState = started.state;
      if (options.execution && timing) {
        const clock = new WorkMinigameClock(config);
        const seconds = options.execution.workSeconds(decision.jobId);
        for (let elapsed = 0; elapsed < seconds && !workState.terminalReason; elapsed++) {
          const step = clock.advance(workState, Math.min(1, seconds - elapsed) * 1000, config);
          workState = step.state; counters.gameMinutesAdvanced += step.advancedMinutes;
          timing.work += Math.min(1, seconds - elapsed);
          if (workState.barryInterruptPending) workState = resolveBarryPayment(workState, config);
        }
      }
      runner = {
        ...runner,
        game: workState,
        activeAction: setWorkResult(started.action, decision.result),
      };
      continue;
    }

    if (decision.type === 'FOOD') {
      const started = startFood(
        runner.game,
        null,
        null,
        config,
        decision.id,
      );
      counters.foodActions += 1;
      runner = {
        ...runner,
        game: started.state,
        activeAction: started.action,
      };
      continue;
    }

    if (decision.type === 'ENTERTAINMENT') {
      const started = startEntertainment(
        runner.game,
        null,
        null,
        config,
        decision.id,
      );
      counters.entertainmentActions += 1;
      runner = {
        ...runner,
        game: started.state,
        activeAction: started.action,
      };
      continue;
    }

    if (decision.type === 'DUMPSTER') {
      const started = startDumpsterSearch(
        runner.game,
        null,
        null,
        config,
      );
      counters.dumpsterSearches += 1;
      if (started.state.terminalReason === 'HEALTH_ZERO') {
        diagnostics.dumpsterHpDeaths += 1;
      }
      runner = {
        ...runner,
        game: started.state,
        activeAction: started.action,
      };
      continue;
    }

    if (decision.type === 'SHOWER') {
      const started = startShower(
        runner.game,
        null,
        null,
        config,
      );
      counters.showers += 1;
      runner = {
        ...runner,
        game: started.state,
        activeAction: started.action,
      };
      continue;
    }

    if (decision.type === 'SLEEP') {
      counters.sleeps += 1;
      runner = {
        ...runner,
        activeAction: startSleep(runner.game, config),
      };
      continue;
    }

    if (decision.type === 'PLINKO' && options.execution && timing) {
      const session = options.execution.plinko(runner.game, decision.fraction ?? runner.game.plinkoSelectedBetFraction);
      timing.physics += session.seconds;
      counters.gameMinutesAdvanced += session.advancedMinutes;
      counters.plinkoDrops += session.launches;
      for (const result of session.settlements) {
        diagnostics.income.plinko += result.payout;
        diagnostics.largestPlinkoPayout = Math.max(diagnostics.largestPlinkoPayout, result.payout);
      }
      runner.game = session.state;
      continue;
    }
    if (decision.type === 'PLINKO') {
      const committed = commitBareDrop(
        runner.game,
        null,
        config,
        `full-game:${options.seed}:${dropIndex}`,
        decision.fraction,
      );
      observeCash(diagnostics, committed.state.cash);

      const outcome = plinkoOutcomeModel.resolve({
        state: committed.state,
        pendingDrop: committed.pendingDrop,
        config,
        dropIndex,
      });
      if (
        !Number.isFinite(outcome.aggregatePayout) ||
        outcome.aggregatePayout < 0
      ) {
        throw new RangeError('Plinko outcome payout must be finite and non-negative');
      }

      const timed = advancePendingDropTime(
        {
          ...committed.state,
          rngState: outcome.nextRngState >>> 0,
        },
        committed.pendingDrop,
        config,
      );
      counters.gameMinutesAdvanced += timed.advancedMinutes;
      counters.plinkoDrops += 1;
      dropIndex += 1;

      if (timed.state.terminalReason !== null) {
        runner = {
          ...runner,
          game: timed.state,
        };
        continue;
      }

      const settled = settleAggregatePendingDropAndResumeTime(
        timed.state,
        timed.pendingDrop,
        outcome.aggregatePayout,
        config,
      );
      counters.gameMinutesAdvanced +=
        settled.remainingMinutesAdvancedAfterBarry;
      recordIncome(
        diagnostics,
        'plinko',
        settled.payout,
        timed.state.cash,
      );
      diagnostics.largestPlinkoPayout = Math.max(
        diagnostics.largestPlinkoPayout,
        settled.payout,
      );

      runner = {
        ...runner,
        game: settled.state,
      };
      continue;
    }

    if (decision.type === 'BUY_JOB_UPGRADE') {
      counters.purchases += 1;
      const nextGame = purchaseJobUpgrade(
        runner.game,
        null,
        null,
        config,
        decision.jobId,
      );
      diagnostics.upgradeOrder.push(
        `job:${decision.jobId}:L${nextGame.jobLevels[decision.jobId]}`,
      );
      runner = {
        ...runner,
        game: nextGame,
      };
      continue;
    }

    if(decision.type==='AUDIT_BUY_CAPACITY'){
      if(!options.execution?.onAuditCapacityPurchase || !Number.isInteger(decision.price) || decision.price<=0 || !Number.isInteger(decision.capacity)||decision.capacity<3||decision.capacity>6 || runner.game.eventModifiers.plinkoLockRemainingMinutes>0)throw Error('Invalid diagnostic capacity purchase');
      const cash=debitCash(runner.game.cash,decision.price);
      options.execution.onAuditCapacityPurchase(decision.capacity);
      runner={...runner,game:{...runner.game,cash}};
      counters.purchases++;
      diagnostics.upgradeOrder.push(`audit:capacity:${decision.capacity}`);
      continue;
    }
    if (decision.type === 'BUY_PLINKO_MAX_BET') {
      counters.purchases += 1;
      const nextGame = purchaseMaxBetUpgrade(
        runner.game,
        null,
        config,
      );
      diagnostics.upgradeOrder.push(
        `plinko:maxBet:L${nextGame.plinkoMaxBetLevel}`,
      );
      runner = {
        ...runner,
        game: nextGame,
      };
      continue;
    }

    if (decision.type === 'BUY_PLINKO_POCKET') {
      counters.purchases += 1;
      const nextGame = purchasePocketUpgrade(
        runner.game,
        null,
        config,
        decision.track,
      );
      const level =
        decision.track === 'center'
          ? nextGame.plinkoCenterLevel
          : decision.track === 'mid'
            ? nextGame.plinkoMidLevel
            : nextGame.plinkoJackpotLevel;
      diagnostics.upgradeOrder.push(
        `plinko:${decision.track}:L${level}`,
      );
      runner = {
        ...runner,
        game: nextGame,
      };
      continue;
    }

    if (decision.type === 'BUY_PLINKO_SPECIAL') {
      counters.purchases += 1;
      const nextGame = purchaseSpecialUpgrade(
        runner.game,
        null,
        config,
        decision.track,
      );
      const level =
        decision.track === 'amplifier'
          ? nextGame.plinkoAmplifierLevel
          : decision.track === 'return'
            ? nextGame.plinkoReturnLevel
            : decision.track === 'splitter'
              ? nextGame.plinkoSplitterLevel
              : nextGame.plinkoJackpotBiasLevel;
      diagnostics.upgradeOrder.push(
        `plinko:${decision.track}:L${level}`,
      );
      runner = {
        ...runner,
        game: nextGame,
      };
      continue;
    }

    counters.purchases += 1;
    const nextGame = purchaseInsuranceUpgrade(
      runner.game,
      null,
      config,
    );
    diagnostics.upgradeOrder.push(
      `plinko:insurance:L${nextGame.plinkoInsuranceLevel}`,
    );
    runner = {
      ...runner,
      game: nextGame,
    };
  }
};
