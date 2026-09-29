import Phaser from 'phaser';

import type { ActiveAction } from '../core/actions/ActiveAction';
import {
  applyTimedPaidCompletion,
  startTimedPaidAction,
  type TimedPaidActionDefinition,
} from '../core/actions/timedPaidAction';
import { resolveBarryPayment } from '../core/barry/barry';
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
import { advanceRunTime } from '../core/time/runTime';
import {
  settleWork,
  startWork,
} from '../core/work/work';
import { balance } from '../config/balance';
import { isPlinkoPerfMode } from '../app/perfMode';
import {
  createMainMapView,
  type MainMapView,
} from './map/createMainMapView';
import type { MainMapLocationId } from './map/mainMapModel';
import { PersistentHud } from './ui/PersistentHud';

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
  private hud?: PersistentHud;
  private mapView?: MainMapView;
  private messageText?: Phaser.GameObjects.Text;
  private principalButton?: Phaser.GameObjects.Text;
  private contextControls: Phaser.GameObjects.Text[] = [];
  private contextMode = 'none';

  public constructor() {
    super('bootstrap');
  }

  public create(): void {
    const { height } = this.scale;

    this.hud = new PersistentHud(this, balance);
    this.mapView = createMainMapView(
      this,
      balance,
      (location) => this.selectLocation(location.id),
    );

    this.messageText = this.add.text(280, height - 67, 'Загрузка…', {
      color: '#d0d6dd',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '15px',
      wordWrap: { width: 720 },
    });

    this.principalButton = this.add
      .text(1240, 66, '[ ПОГАСИТЬ 67М ]', {
        color: '#f4f6f8',
        backgroundColor: '#5a4630',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        padding: { x: 8, y: 5 },
      })
      .setOrigin(1, 0)
      .setDepth(600)
      .setVisible(false)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.guard(() => this.payPrincipal()));

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
        this.state.terminalReason === null &&
        !this.state.victory &&
        this.activeAction?.kind === 'WORK' &&
        this.activeAction.actionId === 'dishes' &&
        this.activeAction.result === null
      ) {
        this.game.events.emit(GAME_PRESENTABLE_EVENT);
        this.scene.start('dishes');
        return;
      }

      if (
        this.state.terminalReason === null &&
        !this.state.victory &&
        this.activeAction?.kind === 'WORK' &&
        this.activeAction.actionId === 'trash' &&
        this.activeAction.result === null
      ) {
        this.game.events.emit(GAME_PRESENTABLE_EVENT);
        this.scene.start('trash');
        return;
      }

      if (
        this.state.terminalReason === null &&
        !this.state.victory &&
        this.activeAction?.kind === 'WORK' &&
        this.activeAction.actionId === 'courier' &&
        this.activeAction.result === null
      ) {
        this.game.events.emit(GAME_PRESENTABLE_EVENT);
        this.scene.start('courier');
        return;
      }

      this.render();
      this.game.events.emit(GAME_PRESENTABLE_EVENT);
    } catch (error: unknown) {
      this.showMessage(
        `SAVE ERROR: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.showMessage('Save is corrupt/incompatible. It was not overwritten.');
      this.game.events.emit(GAME_PRESENTABLE_EVENT);
    }
  }

  private selectLocation(id: MainMapLocationId): void {
    if (!this.state) return;

    if (
      this.state.barryInterruptPending ||
      this.state.terminalReason !== null ||
      this.state.victory ||
      this.activeAction !== null ||
      this.pendingDrop !== null
    ) {
      this.showMessage(
        'Сначала заверши обязательный текущий flow.',
      );
      return;
    }

    if (id === 'casino') {
      this.clearContextControls();
      this.scene.start('plinko-debug');
      return;
    }

    if (id === 'work') {
      this.setContextControls('location:work', [
        ['ПОСУДА', () => this.startDishes()],
        ['МУСОР', () => this.startTrash()],
        ['КУРЬЕР', () => this.startCourierMinigame()],
      ]);
      this.showMessage(
        'Работа. Детальные карточки стоимости/времени/эффекта появятся в T056.',
      );
      return;
    }

    if (id === 'food') {
      this.setContextControls('location:food', [
        ['FOOD_01', () => this.startCheapFood()],
      ]);
      this.showMessage(
        'Еда. Полный список и pre-action preview — T056.',
      );
      return;
    }

    if (id === 'home') {
      this.setContextControls('location:home', [
        ['СПАТЬ 7Ч', () => this.startSleeping()],
      ]);
      this.showMessage(
        'Дом. Сон использует текущий authoritative action lifecycle.',
      );
      return;
    }

    this.clearContextControls();
    this.showMessage(
      'Локация доступна на карте; её action flow добавляется в T056.',
    );
  }

  private setContextControls(
    mode: string,
    items: Array<[string, () => void]>,
  ): void {
    this.clearContextControls();
    this.contextMode = mode;

    items.forEach(([label, handler], index) => {
      const button = this.add
        .text(
          285 + index * 190,
          646,
          `[ ${label} ]`,
          {
            color: '#f4f6f8',
            backgroundColor: '#252d35',
            fontFamily: 'system-ui, sans-serif',
            fontSize: '15px',
            padding: { x: 10, y: 7 },
          },
        )
        .setDepth(20)
        .setInteractive({ useHandCursor: true })
        .on('pointerup', () => this.guard(handler));

      this.contextControls.push(button);
    });
  }

  private clearContextControls(): void {
    for (const control of this.contextControls) {
      control.destroy();
    }
    this.contextControls = [];
    this.contextMode = 'none';
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
    if (!this.state || !this.hud || !this.mapView) return;

    this.hud.render(this.state);

    const hardLocked =
      this.state.barryInterruptPending ||
      this.state.terminalReason !== null ||
      this.state.victory;
    const navigationLocked =
      hardLocked ||
      this.activeAction !== null ||
      this.pendingDrop !== null;

    this.mapView.setEnabled(!navigationLocked);
    this.principalButton?.setVisible(
      !navigationLocked &&
        canPayMainDebt(this.state),
    );

    if (this.state.barryInterruptPending) {
      if (this.contextMode !== 'barry') {
        this.setContextControls('barry', [
          ['ЗАПЛАТИТЬ БАРРИ', () => this.payBarry()],
        ]);
      }
      this.showMessage(
        '09:00. Карта заблокирована до обязательной выплаты Барри.',
      );
      return;
    }

    if (
      this.state.terminalReason !== null ||
      this.state.victory
    ) {
      if (this.contextMode !== 'terminal') {
        this.setContextControls('terminal', [
          ['НОВЫЙ ЗАБЕГ', () => this.restart()],
        ]);
      }
      this.showMessage(
        this.state.victory
          ? 'Долг погашен.'
          : `GAME OVER: ${this.state.terminalReason}`,
      );
      return;
    }

    if (this.activeAction !== null) {
      if (this.contextMode !== 'active') {
        this.clearContextControls();
        this.contextMode = 'active';
      }
      this.showMessage(
        `Активное действие: ${this.activeAction.actionId}. Карта временно заблокирована.`,
      );
      return;
    }

    if (
      this.contextMode === 'barry' ||
      this.contextMode === 'terminal' ||
      this.contextMode === 'active'
    ) {
      this.clearContextControls();
    }
  }

  private showMessage(message: string): void {
    this.messageText?.setText(message);
  }
}
