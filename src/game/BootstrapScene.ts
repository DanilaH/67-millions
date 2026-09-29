import Phaser from 'phaser';

import type { ActiveAction } from '../core/actions/ActiveAction';
import {
  applyTimedPaidCompletion,
  startTimedPaidAction,
  type TimedPaidActionDefinition,
} from '../core/actions/timedPaidAction';
import { getBarryPayment, resolveBarryPayment } from '../core/barry/barry';
import { canPayMainDebt, payMainDebt } from '../core/economy/mainDebt';
import { createLocalSaveRepository } from '../core/save/repository';
import { SAVE_VERSION, type SaveState } from '../core/save/SaveState';
import type { PendingDrop } from '../core/plinko-rules/drop';
import { startSleep } from '../core/sleep/sleep';
import {
  createInitialGameState,
  restartGame,
  type GameState,
} from '../core/state/GameState';
import { ActiveTimeAccumulator } from '../core/time/ActiveTimeAccumulator';
import { formatClockTime } from '../core/time/GameClock';
import { advanceRunTime } from '../core/time/runTime';
import {
  setWorkResult,
  settleWork,
  startWork,
} from '../core/work/work';
import { balance } from '../config/balance';
import { isPlinkoPerfMode } from '../app/perfMode';

export const GAME_PRESENTABLE_EVENT = 'bootstrap:game-presentable';

const createRunSeed = (): number => {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] || 1;
};

const cheapFoodDefinition = (): TimedPaidActionDefinition => {
  const food = balance.food.find((entry) => entry.id === 'FOOD_01');
  if (!food) throw new Error('FOOD_01 missing from balance config');

  return {
    id: food.id,
    price: food.price,
    durationMinutes: food.durationMinutes,
    completionNeedsDelta: {
      satiety: food.satiety,
      happiness: food.happiness,
      energy: food.energy,
      health: food.hp,
    },
  };
};

export class BootstrapScene extends Phaser.Scene {
  private state: GameState | null = null;
  private activeAction: ActiveAction | null = null;
  private pendingDrop: PendingDrop | null = null;
  private repository: ReturnType<typeof createLocalSaveRepository> | null = null;
  private readonly activeTime = new ActiveTimeAccumulator(
    balance.time.realSecondsPerGameMinute,
  );
  private stateText?: Phaser.GameObjects.Text;
  private messageText?: Phaser.GameObjects.Text;
  private controls: Phaser.GameObjects.Text[] = [];

  public constructor() {
    super('bootstrap');
  }

  public create(): void {
    const { width, height } = this.scale;
    this.add
      .text(width / 2, 36, '67 МИЛЛИОНОВ — M1 DEBUG SLICE', {
        color: '#f4f6f8',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '24px',
      })
      .setOrigin(0.5, 0);

    this.stateText = this.add.text(36, 88, 'Loading save…', {
      color: '#f4f6f8',
      fontFamily: 'ui-monospace, monospace',
      fontSize: '18px',
      lineSpacing: 5,
    });

    this.messageText = this.add.text(36, height - 50, '', {
      color: '#f4f6f8',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '16px',
    });

    void this.initialize();
  }

  public update(_time: number, deltaMs: number): void {
    if (
      !this.state ||
      this.state.barryInterruptPending ||
      this.state.terminalReason !== null ||
      this.state.victory
    ) {
      return;
    }

    const minutes = this.activeTime.consume(deltaMs / 1000, true);
    if (minutes > 0) this.advance(minutes);
  }

  private async initialize(): Promise<void> {
    const initialSeed = createRunSeed();
    this.repository = createLocalSaveRepository(() =>
      createInitialGameState(balance, initialSeed),
    );

    try {
      const save = await this.repository.load();
      this.state = save.game;
      this.activeAction = save.activeAction;
      this.pendingDrop = save.pendingDrop;

      if (isPlinkoPerfMode()) {
        this.game.events.emit(GAME_PRESENTABLE_EVENT);
        this.scene.start('plinko-debug');
        return;
      }

      if (
        this.activeAction?.kind === 'WORK' &&
        this.activeAction.actionId === 'dishes' &&
        this.activeAction.result === null
      ) {
        this.game.events.emit(GAME_PRESENTABLE_EVENT);
        this.scene.start('dishes');
        return;
      }

      if (
        this.activeAction?.kind === 'WORK' &&
        this.activeAction.actionId === 'trash' &&
        this.activeAction.result === null
      ) {
        this.game.events.emit(GAME_PRESENTABLE_EVENT);
        this.scene.start('trash');
        return;
      }

      if (
        this.activeAction?.kind === 'WORK' &&
        this.activeAction.actionId === 'courier' &&
        this.activeAction.result === null
      ) {
        this.game.events.emit(GAME_PRESENTABLE_EVENT);
        this.scene.start('courier');
        return;
      }

      this.installControls();
      this.render();
      this.game.events.emit(GAME_PRESENTABLE_EVENT);
    } catch (error: unknown) {
      this.showMessage(
        `SAVE ERROR: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.stateText?.setText('Save is corrupt/incompatible. It was not overwritten.');
      this.game.events.emit(GAME_PRESENTABLE_EVENT);
    }
  }

  private installControls(): void {
    const items: Array<[string, () => void]> = [
      ['+60m', () => this.advance(60)],
      ['Courier L1 (success)', () => this.startCourier()],
      ['Dishes minigame', () => this.startDishes()],
      ['Trash minigame', () => this.startTrash()],
      ['Courier minigame', () => this.startCourierMinigame()],
      ['Eat FOOD_01', () => this.startCheapFood()],
      ['Sleep 7h', () => this.startSleeping()],
      ['Finish active action', () => this.finishActiveAction()],
      ['PAY BARRY', () => this.payBarry()],
      ['PAY 67M', () => this.payPrincipal()],
      ['Restart run', () => this.restart()],
      ['M2 Plinko probe', () => this.scene.start('plinko-debug')],
    ];

    items.forEach(([label, handler], index) => {
      const x = 36 + (index % 2) * 280;
      const y = 360 + Math.floor(index / 2) * 54;
      const button = this.add
        .text(x, y, `[ ${label} ]`, {
          color: '#f4f6f8',
          backgroundColor: '#252a31',
          fontFamily: 'system-ui, sans-serif',
          fontSize: '17px',
          padding: { x: 10, y: 8 },
        })
        .setInteractive({ useHandCursor: true })
        .on('pointerup', () => this.guard(handler));
      this.controls.push(button);
    });
  }

  private guard(action: () => void): void {
    try {
      action();
      this.render();
    } catch (error: unknown) {
      this.showMessage(error instanceof Error ? error.message : String(error));
    }
  }

  private advance(minutes: number): void {
    if (!this.state) return;

    const previousAction = this.activeAction;
    const result = advanceRunTime(
      this.state,
      this.activeAction,
      minutes,
      balance,
    );

    this.state = result.state;
    this.activeAction = result.activeAction;

    if (
      result.actionCompleted &&
      previousAction &&
      this.state.terminalReason === null
    ) {
      this.settleCompletedAction(previousAction);
    }

    void this.persist();
    this.render();
  }

  private settleCompletedAction(action: ActiveAction): void {
    if (!this.state) return;

    if (action.kind === 'WORK') {
      this.state = settleWork(this.state, action, balance);
      return;
    }

    if (action.kind === 'TIMED_PAID' && action.actionId === 'FOOD_01') {
      this.state = applyTimedPaidCompletion(
        this.state,
        cheapFoodDefinition(),
        balance,
      );
    }
  }

  private startCourier(): void {
    if (!this.state || this.activeAction || this.pendingDrop) {
      throw new Error('Finish the current action first');
    }

    const started = startWork(this.state, balance, 'courier', 1);
    this.state = started.state;
    this.activeAction = setWorkResult(started.action, 'SUCCESS');
    this.showMessage('Courier result stored as SUCCESS; salary waits for completion.');
    void this.persist();
  }

  private startDishes(): void {
    if (!this.state || this.activeAction || this.pendingDrop) {
      throw new Error('Finish the current action first');
    }

    const level = this.state.jobLevels.dishes;
    const started = startWork(
      this.state,
      balance,
      'dishes',
      level,
    );
    this.state = started.state;
    this.activeAction = started.action;
    this.showMessage(
      'Dishes costs reserved. Complete the skill minigame for the work result.',
    );

    void this.persist()
      .then(() => this.repository?.flush())
      .then(() => this.scene.start('dishes'))
      .catch((error: unknown) => {
        this.showMessage(
          error instanceof Error ? error.message : String(error),
        );
      });
  }

  private startTrash(): void {
    if (!this.state || this.activeAction || this.pendingDrop) {
      throw new Error('Finish the current action first');
    }

    const level = this.state.jobLevels.trash;
    const started = startWork(
      this.state,
      balance,
      'trash',
      level,
    );
    this.state = started.state;
    this.activeAction = started.action;
    this.showMessage(
      'Trash costs reserved. Complete the skill minigame for the work result.',
    );

    void this.persist()
      .then(() => this.repository?.flush())
      .then(() => this.scene.start('trash'))
      .catch((error: unknown) => {
        this.showMessage(
          error instanceof Error ? error.message : String(error),
        );
      });
  }

  private startCourierMinigame(): void {
    if (!this.state || this.activeAction || this.pendingDrop) {
      throw new Error('Finish the current action first');
    }

    const level = this.state.jobLevels.courier;
    const started = startWork(
      this.state,
      balance,
      'courier',
      level,
    );
    this.state = started.state;
    this.activeAction = started.action;
    this.showMessage(
      'Courier costs reserved. Draw and validate the route for the work result.',
    );

    void this.persist()
      .then(() => this.repository?.flush())
      .then(() => this.scene.start('courier'))
      .catch((error: unknown) => {
        this.showMessage(
          error instanceof Error ? error.message : String(error),
        );
      });
  }

  private startCheapFood(): void {
    if (!this.state || this.activeAction || this.pendingDrop) {
      throw new Error('Finish the current action first');
    }

    const started = startTimedPaidAction(this.state, cheapFoodDefinition());
    this.state = started.state;
    this.activeAction = started.action;
    this.showMessage('FOOD_01 paid upfront; stats apply only at completion.');
    void this.persist();
  }

  private startSleeping(): void {
    if (!this.state || this.activeAction || this.pendingDrop) {
      throw new Error('Finish the current action first');
    }

    this.activeAction = startSleep(this.state, balance);
    this.showMessage('Sleep started. Barry will end it at 09:00.');
    void this.persist();
  }

  private finishActiveAction(): void {
    if (this.pendingDrop) throw new Error('Pending Plinko Drop locks other actions');
    if (!this.activeAction) throw new Error('No active action');
    this.advance(this.activeAction.remainingMinutes);
  }

  private payBarry(): void {
    if (!this.state) return;
    this.state = resolveBarryPayment(this.state, balance);
    this.showMessage(
      this.state.terminalReason === 'BARRY_PAYMENT_FAILED'
        ? 'GAME OVER: Barry payment failed.'
        : 'Barry paid.',
    );

    if (
      this.state.terminalReason === null &&
      this.activeAction?.remainingMinutes === 0
    ) {
      this.advance(0);
    }

    void this.persist();
  }

  private payPrincipal(): void {
    if (!this.state) return;
    if (this.pendingDrop) throw new Error('Pending Plinko Drop locks cash mutations');
    if (!canPayMainDebt(this.state)) {
      throw new Error('Need 67,000,000 ₽ cash and no pending Barry flow');
    }
    this.state = payMainDebt(this.state);
    this.showMessage('VICTORY: principal paid manually.');
    void this.persist();
  }

  private restart(): void {
    if (!this.state) return;
    this.state = restartGame(balance, createRunSeed());
    this.activeAction = null;
    this.pendingDrop = null;
    this.showMessage('Fresh run created with a new seed.');
    void this.persist();
  }

  private async persist(): Promise<void> {
    if (!this.repository || !this.state) return;
    const save: SaveState = {
      version: SAVE_VERSION,
      game: this.state,
      activeAction: this.activeAction,
      pendingDrop: this.pendingDrop,
    };
    await this.repository.write(save);
  }

  private render(): void {
    if (!this.state || !this.stateText) return;

    const nextBarry = getBarryPayment(balance, this.state.barryPaymentIndex);
    const action = this.activeAction
      ? `${this.activeAction.kind}:${this.activeAction.actionId} ${Math.ceil(this.activeAction.remainingMinutes)}m`
      : 'none';

    this.stateText.setText([
      `Day: ${this.state.clock.gameDayIndex}   Time: ${formatClockTime(this.state.clock.minuteOfDay)}`,
      `Cash: ${this.state.cash.toLocaleString('ru-RU')} ₽`,
      `Next Barry: ${nextBarry.toLocaleString('ru-RU')} ₽`,
      `Principal: ${this.state.mainDebt.toLocaleString('ru-RU')} ₽`,
      `HP ${this.state.needs.health.toFixed(1)} | Satiety ${this.state.needs.satiety.toFixed(1)} | Energy ${this.state.needs.energy.toFixed(1)} | Happiness ${this.state.needs.happiness.toFixed(1)}`,
      `Work payout x${this.state.workPayoutMultiplier.toFixed(2)} | Slept ${this.state.sleepMinutesCurrentGameDay}m`,
      `Active: ${action}`,
      `Pending Drop: ${this.pendingDrop ? `${this.pendingDrop.dropId} / stake ${this.pendingDrop.originalStake} ₽` : 'none'}`,
      `Barry interrupt: ${this.state.barryInterruptPending ? 'YES' : 'no'}`,
      `Terminal: ${this.state.terminalReason ?? 'no'} | Victory: ${this.state.victory ? 'YES' : 'no'}`,
    ]);
  }

  private showMessage(message: string): void {
    this.messageText?.setText(message);
  }
}
