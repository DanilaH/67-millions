import Phaser from 'phaser';

import type { ActiveAction } from '../core/actions/ActiveAction';
import {
  startDumpsterSearch,
  settleDumpsterSearch,
} from '../core/actions/dumpster';
import {
  startEntertainment,
  startFood,
  settleRecoveryAction,
} from '../core/actions/foodEntertainment';
import {
  startShower,
  settleShower,
} from '../core/actions/shower';
import { resolveBarryPayment } from '../core/barry/barry';
import {
  resolveEventChoice,
  type EventChoiceId,
} from '../core/events/eventEffects';
import {
  getPresentablePendingEventId,
} from '../core/events/eventScheduler';
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
import { SceneAudio } from '../audio/SceneAudio';
import { isPlinkoPerfMode } from '../app/perfMode';
import {
  buildDumpsterPreviews,
  buildEntertainmentPreviews,
  buildFoodPreviews,
  buildShowerPreviews,
  buildSleepPreviews,
  buildWorkPreviews,
  type ActionPreview,
} from './actions/actionPreviews';
import {
  createActionPanel,
  type ActionPanel,
} from './map/createActionPanel';
import {
  createMainMapView,
  type MainMapView,
} from './map/createMainMapView';
import type { MainMapLocationId } from './map/mainMapModel';
import {
  consumeCasinoPayoutToast,
  type CasinoPayoutToast,
} from './casino/casinoPayoutToast';
import {
  createRunEndOverlay,
  type RunEndOverlay,
} from './end/createRunEndOverlay';
import {
  derivePrincipalConfirmation,
  deriveRunEndSummary,
} from './end/runEndModel';
import { PersistentHud } from './ui/PersistentHud';
import {
  acknowledgeCurrentTutorialInfo,
  deriveTutorialStep,
  loadTutorialProgress,
  recordTutorialMilestone,
} from './tutorial/tutorialProgress';
import { buildTutorialCard } from './tutorial/tutorialUiModel';
import {
  createTutorialCard,
  type TutorialCard,
} from './tutorial/createTutorialCard';
import {
  BARRY_CONTENT,
  getEntertainmentContent,
  getFoodContent,
} from './content/contentCatalog';
import {
  createEventOverlay,
  type EventOverlay,
} from './events/createEventOverlay';
import { buildEventPresentation } from './events/eventUiModel';
import { VISUAL_FONT, visualHex } from './visual/visualTheme';

export const GAME_PRESENTABLE_EVENT = 'bootstrap:game-presentable';

const createRunSeed = (): number => {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] || 1;
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
  private actionPanel?: ActionPanel;
  private selectedLocation: MainMapLocationId | null = null;
  private messageText?: Phaser.GameObjects.Text;
  private payoutToastText?: Phaser.GameObjects.Text;
  private principalButton?: Phaser.GameObjects.Text;
  private runEndOverlay?: RunEndOverlay;
  private tutorialCard?: TutorialCard;
  private eventOverlay?: EventOverlay;
  private audio?: SceneAudio;
  private contextControls: Phaser.GameObjects.Text[] = [];
  private contextMode = 'none';

  public constructor() {
    super('bootstrap');
  }

  public create(): void {
    const { height } = this.scale;

    this.audio = new SceneAudio(this, 'city');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.audio?.dispose();
      this.audio = undefined;
    });

    this.hud = new PersistentHud(this, balance);
    this.mapView = createMainMapView(
      this,
      balance,
      (location) => this.selectLocation(location.id),
    );
    this.actionPanel = createActionPanel(
      this,
      () => this.closeActionPanel(),
      (action) => this.guard(() => this.executeAction(action)),
    );

    this.messageText = this.add.text(280, height - 67, 'Загрузка…', {
      color: visualHex('textMuted'),
      fontFamily: VISUAL_FONT.sans,
      fontSize: '15px',
      wordWrap: { width: 720 },
    });

    this.payoutToastText = this.add
      .text(760, 116, '', {
        color: visualHex('textMain'),
        backgroundColor: visualHex('mold'),
        fontFamily: VISUAL_FONT.mono,
        fontSize: '15px',
        padding: { x: 14, y: 10 },
        wordWrap: { width: 440 },
      })
      .setOrigin(0.5, 0)
      .setDepth(800)
      .setVisible(false);

    this.principalButton = this.add
      .text(1240, 66, '[ ПОГАСИТЬ 67М ]', {
        color: visualHex('textMain'),
        backgroundColor: visualHex('rust'),
        fontFamily: VISUAL_FONT.sans,
        fontSize: '13px',
        padding: { x: 8, y: 5 },
      })
      .setOrigin(1, 0)
      .setDepth(600)
      .setVisible(false)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () =>
        this.guard(() => this.openPrincipalConfirmation()),
      );

    this.runEndOverlay = createRunEndOverlay(this, {
      onRestart: () => this.guard(() => this.restart()),
      onConfirmPrincipal: () =>
        this.guard(() => this.payPrincipal()),
      onCancelPrincipal: () => {
        this.runEndOverlay?.hide();
        this.render();
      },
    });

    this.tutorialCard = createTutorialCard(
      this,
      (step) => {
        acknowledgeCurrentTutorialInfo(step);
        this.renderTutorial();
      },
    );

    this.eventOverlay = createEventOverlay(
      this,
      (choice) =>
        this.guard(() =>
          this.resolvePendingEventChoice(choice.id),
        ),
    );

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

      const payoutToast = consumeCasinoPayoutToast();
      if (payoutToast !== null) {
        this.showCasinoPayoutToast(payoutToast);
      }

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
      this.pendingDrop !== null ||
      this.state.pendingEventId !== null
    ) {
      this.showMessage(
        'Сначала заверши обязательный текущий flow.',
      );
      return;
    }

    if (id === 'casino') {
      this.closeActionPanel();
      this.scene.start('plinko-debug');
      return;
    }

    this.selectedLocation = id;
    this.mapView?.setSelected(id);
    this.renderSelectedLocation();
  }

  private renderSelectedLocation(): void {
    if (
      !this.state ||
      !this.actionPanel ||
      this.selectedLocation === null
    ) {
      return;
    }

    const args = [
      this.state,
      this.activeAction,
      this.pendingDrop,
      balance,
    ] as const;

    if (this.selectedLocation === 'work') {
      this.actionPanel.show(
        'РАБОТА',
        buildWorkPreviews(...args),
      );
    } else if (this.selectedLocation === 'food') {
      this.actionPanel.show(
        'ЕДА',
        buildFoodPreviews(...args),
      );
    } else if (this.selectedLocation === 'home') {
      this.actionPanel.show(
        'ДОМ / СОН',
        buildSleepPreviews(...args),
      );
    } else if (this.selectedLocation === 'entertainment') {
      this.actionPanel.show(
        'РАЗВЛЕЧЕНИЯ',
        buildEntertainmentPreviews(...args),
      );
    } else if (this.selectedLocation === 'dumpster') {
      this.actionPanel.show(
        'ПОМОЙКА',
        buildDumpsterPreviews(...args),
      );
    } else if (this.selectedLocation === 'shower') {
      this.actionPanel.show(
        'ДУШ',
        buildShowerPreviews(...args),
      );
    }

    this.showMessage(
      'Перед действием видны цена, время, эффект и причина блокировки.',
    );
  }

  private closeActionPanel(): void {
    this.actionPanel?.hide();
    this.selectedLocation = null;
    this.mapView?.setSelected(null);
  }

  private executeAction(action: ActionPreview): void {
    if (action.lockedReason !== null) {
      throw new Error(action.lockedReason);
    }

    const [kind, id] = action.id.split(':');

    if (kind === 'work' && id === 'dishes') {
      this.closeActionPanel();
      this.startDishes();
      return;
    }
    if (kind === 'work' && id === 'trash') {
      this.closeActionPanel();
      this.startTrash();
      return;
    }
    if (kind === 'work' && id === 'courier') {
      this.closeActionPanel();
      this.startCourierMinigame();
      return;
    }
    if (kind === 'food' && id) {
      this.closeActionPanel();
      this.startFoodAction(id);
      return;
    }
    if (kind === 'entertainment' && id) {
      this.closeActionPanel();
      this.startEntertainmentAction(id);
      return;
    }
    if (action.id === 'sleep') {
      this.closeActionPanel();
      this.startSleeping();
      return;
    }
    if (action.id === 'dumpster') {
      this.closeActionPanel();
      this.startDumpster();
      return;
    }
    if (action.id === 'shower') {
      this.closeActionPanel();
      this.startShowerAction();
      return;
    }

    throw new Error(`Unknown action preview: ${action.id}`);
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
            color: visualHex('textMain'),
            backgroundColor: visualHex('inkRaised'),
            fontFamily: VISUAL_FONT.sans,
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
      recordTutorialMilestone('WORK_COMPLETED');
      return;
    }

    if (action.kind === 'TIMED_PAID') {
      this.state =
        action.actionId === 'SHOWER'
          ? settleShower(this.state, action, balance)
          : settleRecoveryAction(this.state, action, balance);

      if (
        balance.food.some(
          (entry) => entry.id === action.actionId,
        )
      ) {
        recordTutorialMilestone('RECOVERY_USED');
      }
      return;
    }

    if (action.kind === 'SLEEP') {
      recordTutorialMilestone('RECOVERY_USED');
      this.audio?.play('wake');
      return;
    }

    if (action.kind === 'DUMPSTER') {
      const result = settleDumpsterSearch(
        this.state,
        balance,
      );
      this.state = result.state;
      if (result.cashAward > 0) {
        this.audio?.play('cashGain');
      }
      this.showMessage(
        result.loot === 'EMPTY'
          ? 'Помойка: пусто.'
          : result.cashAward > 0
            ? `Помойка: ${result.loot} · +${result.cashAward.toLocaleString('ru-RU')} ₽`
            : `Помойка: ${result.loot}`,
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

  private startFoodAction(foodId: string): void {
    if (!this.state) return;

    const cashBefore = this.state.cash;
    const started = startFood(
      this.state,
      this.activeAction,
      this.pendingDrop,
      balance,
      foodId,
    );
    this.state = started.state;
    this.activeAction = started.action;
    if (this.state.cash < cashBefore) {
      this.audio?.play('cashSpend');
    }
    this.showMessage(
      `${getFoodContent(foodId).title}: оплачено, эффект после ${started.action.remainingMinutes} мин.`,
    );
    this.advance(started.action.remainingMinutes);
  }

  private startEntertainmentAction(
    entertainmentId: string,
  ): void {
    if (!this.state) return;

    const cashBefore = this.state.cash;
    const started = startEntertainment(
      this.state,
      this.activeAction,
      this.pendingDrop,
      balance,
      entertainmentId,
    );
    this.state = started.state;
    this.activeAction = started.action;
    if (this.state.cash < cashBefore) {
      this.audio?.play('cashSpend');
    }
    this.showMessage(
      `${getEntertainmentContent(entertainmentId).title}: действие начато.`,
    );
    this.advance(started.action.remainingMinutes);
  }

  private startSleeping(): void {
    if (!this.state || this.activeAction || this.pendingDrop) {
      throw new Error('Finish the current action first');
    }

    this.activeAction = startSleep(this.state, balance);
    this.audio?.play('sleep');
    this.showMessage(
      `Сон: до ${balance.sleep.fullSleepHours} ч, Барри в 09:00 прерывает.`,
    );
    this.advance(this.activeAction.remainingMinutes);
  }

  private startDumpster(): void {
    if (!this.state) return;

    this.audio?.play('dumpster');
    const started = startDumpsterSearch(
      this.state,
      this.activeAction,
      this.pendingDrop,
      balance,
    );
    this.state = started.state;
    this.activeAction = started.action;
    this.showMessage(
      `Помойка: энергия -${started.energySpent}, счастье -${started.happinessSpent.toFixed(1)}, HP -${started.healthSpent.toFixed(1)}.`,
    );
    this.advance(started.action.remainingMinutes);
  }

  private startShowerAction(): void {
    if (!this.state) return;

    const cashBefore = this.state.cash;
    const started = startShower(
      this.state,
      this.activeAction,
      this.pendingDrop,
      balance,
    );
    this.state = started.state;
    this.activeAction = started.action;
    if (this.state.cash < cashBefore) {
      this.audio?.play('cashSpend');
    }
    this.showMessage('Душ оплачен.');
    this.advance(started.action.remainingMinutes);
  }

  private payBarry(): void {
    if (!this.state) return;

    const previousPaymentIndex =
      this.state.barryPaymentIndex;
    this.state = resolveBarryPayment(this.state, balance);

    if (
      this.state.terminalReason === null &&
      this.state.barryPaymentIndex > previousPaymentIndex
    ) {
      recordTutorialMilestone('BARRY_PAID');
      this.audio?.play('cashSpend');
    }

    this.showMessage(
      this.state.terminalReason === 'BARRY_PAYMENT_FAILED'
        ? BARRY_CONTENT.failed
        : BARRY_CONTENT.paid,
    );

    if (
      this.state.terminalReason === null &&
      this.activeAction !== null
    ) {
      this.advance(this.activeAction.remainingMinutes);
      return;
    }

    void this.persist();
    this.render();
  }

  private resolvePendingEventChoice(
    choiceId: EventChoiceId,
  ): void {
    if (!this.state) return;

    const eventId = getPresentablePendingEventId(
      this.state,
      {
        skillInputActive: false,
        pendingDropActive: this.pendingDrop !== null,
        activeActionBlocking: this.activeAction !== null,
      },
    );

    if (eventId === null) {
      throw new Error('Нет события, доступного для выбора.');
    }

    const cashBefore = this.state.cash;
    const resolved = resolveEventChoice(
      this.state,
      balance,
      eventId,
      choiceId,
    );

    this.state = resolved.state;
    if (this.state.cash < cashBefore) {
      this.audio?.play('cashSpend');
    }
    this.activeAction = resolved.activeAction;
    this.eventOverlay?.hide();

    const lockedSuffix =
      resolved.lockedJobId === null
        ? ''
        : ` · временно закрыта работа: ${resolved.lockedJobId}`;
    this.showMessage(
      `Событие разрешено: вариант ${choiceId.toUpperCase()}${lockedSuffix}`,
    );

    if (resolved.activeAction !== null) {
      this.advance(
        resolved.activeAction.remainingMinutes,
      );
      return;
    }

    void this.persist();
    this.render();
  }

  private openPrincipalConfirmation(): void {
    if (!this.state) return;
    if (this.pendingDrop) {
      throw new Error(
        'Pending Plinko Drop locks cash mutations',
      );
    }

    const confirmation = derivePrincipalConfirmation(
      this.state,
      balance,
    );
    this.runEndOverlay?.showPrincipalConfirmation(
      confirmation,
    );
  }

  private payPrincipal(): void {
    if (!this.state) return;
    if (this.pendingDrop) {
      throw new Error(
        'Pending Plinko Drop locks cash mutations',
      );
    }
    if (!canPayMainDebt(this.state)) {
      this.runEndOverlay?.hide();
      throw new Error(
        'Need 67,000,000 ₽ cash and no pending Barry flow',
      );
    }

    this.state = payMainDebt(this.state);
    this.audio?.play('cashSpend');
    void this.persist();
  }

  private restart(): void {
    if (!this.state) return;

    this.state = restartGame(balance, createRunSeed());
    this.activeAction = null;
    this.pendingDrop = null;
    this.runEndOverlay?.hide();
    this.payoutToastText?.setVisible(false);
    this.closeActionPanel();
    this.clearContextControls();
    this.showMessage('Новый забег начат.');
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

    this.audio?.syncBarry(this.state.barryInterruptPending);
    this.audio?.syncNeeds(
      this.state.needs,
      balance.needs.lowThreshold,
    );

    this.hud.render(this.state);
    this.renderTutorial();

    const hardLocked =
      this.state.barryInterruptPending ||
      this.state.terminalReason !== null ||
      this.state.victory;
    const presentableEventId =
      getPresentablePendingEventId(
        this.state,
        {
          skillInputActive: false,
          pendingDropActive: this.pendingDrop !== null,
          activeActionBlocking: this.activeAction !== null,
        },
      );
    const navigationLocked =
      hardLocked ||
      this.activeAction !== null ||
      this.pendingDrop !== null ||
      presentableEventId !== null;

    this.mapView.setEnabled(!navigationLocked);
    this.principalButton?.setVisible(
      !navigationLocked &&
        canPayMainDebt(this.state),
    );

    if (navigationLocked && this.actionPanel?.isVisible()) {
      this.closeActionPanel();
    } else if (
      !navigationLocked &&
      this.selectedLocation !== null &&
      this.actionPanel?.isVisible()
    ) {
      this.renderSelectedLocation();
    }

    if (this.state.barryInterruptPending) {
      this.eventOverlay?.hide();
      if (
        this.runEndOverlay?.getMode() ===
        'principal-confirm'
      ) {
        this.runEndOverlay.hide();
      }
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
      this.eventOverlay?.hide();
      if (this.contextMode !== 'terminal') {
        this.clearContextControls();
        this.contextMode = 'terminal';
      }
      this.runEndOverlay?.showSummary(
        deriveRunEndSummary(this.state, balance),
      );
      this.showMessage(
        this.state.victory
          ? 'Победа: основной долг погашен.'
          : 'Забег завершён.',
      );
      return;
    }

    if (this.runEndOverlay?.getMode() === 'summary') {
      this.runEndOverlay.hide();
    }

    if (this.activeAction !== null) {
      this.eventOverlay?.hide();
      if (this.contextMode !== 'active') {
        this.clearContextControls();
        this.contextMode = 'active';
      }
      this.showMessage(
        `Активное действие: ${this.activeAction.actionId}. Карта временно заблокирована.`,
      );
      return;
    }

    if (presentableEventId !== null) {
      if (
        this.runEndOverlay?.getMode() ===
        'principal-confirm'
      ) {
        this.runEndOverlay.hide();
      }
      this.clearContextControls();
      this.closeActionPanel();
      this.eventOverlay?.show(
        buildEventPresentation(
          this.state,
          balance,
          presentableEventId,
        ),
      );
      this.showMessage(
        'Событие требует решения перед следующим действием.',
      );
      return;
    }

    this.eventOverlay?.hide();

    if (
      this.contextMode === 'barry' ||
      this.contextMode === 'terminal' ||
      this.contextMode === 'active'
    ) {
      this.clearContextControls();
    }
  }

  private renderTutorial(): void {
    if (!this.state || !this.tutorialCard) return;

    if (
      this.state.terminalReason !== null ||
      this.state.victory
    ) {
      this.tutorialCard.render(null);
      return;
    }

    const step = deriveTutorialStep(
      loadTutorialProgress(),
    );
    this.tutorialCard.render(
      buildTutorialCard(step, 'map'),
    );
  }

  private showCasinoPayoutToast(
    toast: CasinoPayoutToast,
  ): void {
    const insurance = toast.insuranceApplied
      ? ` · страховка +${toast.insuranceTopUp.toLocaleString('ru-RU')} ₽`
      : '';

    this.payoutToastText
      ?.setText(
        `PLINKO · ${toast.stake.toLocaleString('ru-RU')} ₽ → ${toast.payout.toLocaleString('ru-RU')} ₽ · ${toast.multiplier.toFixed(2)}x${insurance}`,
      )
      .setBackgroundColor(
        toast.losing ? visualHex('rust') : visualHex('mold'),
      )
      .setVisible(true);

    this.time.delayedCall(3_500, () => {
      this.payoutToastText?.setVisible(false);
    });
  }

  private showMessage(message: string): void {
    this.messageText?.setText(message);
  }
}
