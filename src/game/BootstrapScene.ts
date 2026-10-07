import { applyDebugCommand, type DebugCommand } from '../core/state/debugCommands';
import { installScenePresentation } from './visual/scenePresentation';
import { consumeWorkFeedback, formatActionFeedback, elapsedFeedbackMinutes } from './actions/actionFeedback';
import { formatCasinoResult } from './casino/casinoPayoutToast';
import Phaser from 'phaser';
import { GAME_PRESENTABLE_EVENT } from '../app/presentable';
import { preloadProductionArt } from './visual/productionArt';

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
import { END_RUN_ADS_KEY, type EndRunAds } from '../app/EndRunAds';
import { GAME_ANALYTICS_KEY, type GameAnalytics } from '../app/analytics/GameAnalytics';
import type { SaveRepository } from '../core/save/repository';
import { createRunSeed } from '../core/random/runSeed';
import { SAVE_VERSION, type SaveState } from '../core/save/SaveState';
import type { PendingDrop } from '../core/plinko-rules/drop';
import { startSleep } from '../core/sleep/sleep';
import {
  restartGame,
  type GameState,
} from '../core/state/GameState';
import { ActiveTimeAccumulator } from '../core/time/ActiveTimeAccumulator';
import { advanceRunTime } from '../core/time/runTime';
import {
  purchaseJobUpgrade,
  settleWork,
  startWork,
} from '../core/work/work';
import { createBarryMinigameOverlay, type BarryMinigameOverlay } from './work/createBarryMinigameOverlay';
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
  buildWorkUpgradePreviews,
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
import { getSceneSaveRepository } from './save/sceneSaveRepository';

export class BootstrapScene extends Phaser.Scene {
  private state: GameState | null = null;
  private activeAction: ActiveAction | null = null;
  private pendingDrop: PendingDrop | null = null;
  private repository: SaveRepository | null = null;
  private workUpgrades = false;
  private barryOverlay?: BarryMinigameOverlay;
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
  private audio: SceneAudio | null = null;
  private contextMode = 'none';
  private actionStart: GameState | null = null;
  private resultTimer: Phaser.Time.TimerEvent | undefined;
  private rummageElapsedMs = 0;
  private rummageView?: Phaser.GameObjects.Container;
  private rummageProgress?: Phaser.GameObjects.Graphics;
  private rummagePaper?: Phaser.GameObjects.Rectangle;
  private static readonly RUMMAGE_DURATION_MS = 3000;

  public constructor() {
    super('bootstrap');
  }

  public preload(): void {
    preloadProductionArt(this, ['map', 'barry-due', 'barry-paid']);
  }

  public create(): void {
    installScenePresentation(this);
    this.state = null;
    this.actionStart = null;
    this.resultTimer = undefined;
    this.activeAction = null;
    this.pendingDrop = null;
    this.selectedLocation = null;
    this.contextMode = 'none';
    this.rummageElapsedMs = 0;

    const height = balance.plinko.geometry.logicalViewportHeight;
    this.barryOverlay = createBarryMinigameOverlay(this, balance, () => this.guard(() => this.payBarry()));

    this.audio = new SceneAudio(this, 'city');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.audio?.dispose();
      this.audio = null;
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
      (action) => this.hud?.setForecast(action?.forecast ?? null),
    );

    this.messageText = this.add.text(280, height - 67, 'Загрузка…', {
      color: visualHex('textMuted'),
      fontFamily: VISUAL_FONT.sans,
      fontSize: '15px',
      wordWrap: { width: 720 },
    });

    this.payoutToastText = this.add
      .text(763, 610, '', {
        color: visualHex('textMain'),
        backgroundColor: visualHex('mold'),
        fontFamily: VISUAL_FONT.mono,
        fontSize: '22px',
        padding: { x: 16, y: 10 },
        wordWrap: { width: 950 },
        fixedWidth: 982,
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
      onRestart: () => { void this.restart().catch((error: unknown) => this.showMessage(String(error))); },
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

    this.rummageProgress = this.add.graphics();
    this.rummagePaper = this.add.rectangle(0, 3, 44, 26, 0xb8aa8b).setAngle(-12);
    this.rummageView = this.add.container(640, 350, [
      this.add.rectangle(0, 0, 420, 230, 0x181b20).setStrokeStyle(2, 0x85744f),
      this.add.text(0, -82, 'Ищем в помойке…', {
        fontFamily: VISUAL_FONT.sans, fontSize: '26px', color: '#f4f6f8',
      }).setOrigin(0.5),
      this.rummagePaper,
      this.add.rectangle(0, 30, 90, 46, 0x58634a).setStrokeStyle(3, 0x98a182),
      this.add.text(0, 72, 'Может попасться что-нибудь полезное', {
        fontFamily: VISUAL_FONT.sans, fontSize: '17px', color: '#c3c5bd',
      }).setOrigin(0.5),
      this.rummageProgress,
    ]).setDepth(850).setVisible(false);

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

    if (this.activeAction?.kind === 'DUMPSTER') {
      // Presentation delays an already-reserved action; only the scheduler owns
      // its 45 minutes, interruption, RNG and loot. Reload restarts presentation.
      this.rummageElapsedMs += deltaMs;
      const progress = Math.min(1, this.rummageElapsedMs / BootstrapScene.RUMMAGE_DURATION_MS);
      this.rummageView?.setVisible(true);
      this.rummagePaper?.setPosition(Math.sin(this.rummageElapsedMs / 85) * 20, -Math.abs(Math.sin(this.rummageElapsedMs / 150)) * 22);
      this.rummageProgress?.clear().fillStyle(0x98a182).fillRect(-180, 98, 360 * progress, 5);
      this.game.canvas.setAttribute('aria-label', 'Поиск в помойке');
      if (progress >= 1) {
        this.rummageView?.setVisible(false);
        this.rummageElapsedMs = 0;
        this.game.canvas.setAttribute('aria-label', 'Карта города');
        this.advance(this.activeAction.remainingMinutes);
      }
      return;
    }

    const minutes = this.activeTime.consume(this.game.loop.rawDelta / 1000, true);
    if (minutes > 0) this.advance(minutes);
  }

  private async initialize(): Promise<void> {
    this.repository = getSceneSaveRepository(this);

    try {
      const save = await this.repository.load();
      this.state = save.game;
      this.activeAction = save.activeAction;
      this.pendingDrop = save.pendingDrop;

      if (isPlinkoPerfMode()) {
        this.scene.start('plinko-debug');
        return;
      }

      if (this.pendingDrop !== null) {
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
        this.scene.start('courier');
        return;
      }

      // Reserved time jumps resume at the saved remainder. Skill input and
      // dumpster presentation have their own resume paths; never reapply costs.
      if (this.activeAction !== null && this.activeAction.kind !== 'DUMPSTER' &&
          !this.state.barryInterruptPending && this.state.terminalReason === null && !this.state.victory) {
        this.advance(this.activeAction.remainingMinutes);
        await this.repository.flush();
      }

      this.showMessage('Выберите локацию.');
      this.render();

      const workFeedback = consumeWorkFeedback();
      if (workFeedback) this.showResultFeedback(workFeedback);
      const payoutToast = consumeCasinoPayoutToast();
      if (payoutToast !== null) {
        this.showCasinoPayoutToast(payoutToast);
      }

      this.game.canvas.setAttribute('aria-label', 'Карта города');
      this.game.events.emit(GAME_PRESENTABLE_EVENT);
    } catch (error: unknown) {
      this.showMessage(
        `SAVE ERROR: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.showMessage('Save is corrupt/incompatible. It was not overwritten.');
      this.game.canvas.setAttribute('aria-label', 'Карта города');
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
      this.audio?.play('casinoEnter');
      this.scene.start('plinko-debug');
      return;
    }

    this.workUpgrades = false;
    this.selectedLocation = id;
    this.mapView?.setSelected(id);
    this.renderSelectedLocation();
    this.renderTutorial();
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
        this.workUpgrades ? 'УЛУЧШЕНИЯ РАБОТ' : 'РАБОТА',
        this.workUpgrades ? buildWorkUpgradePreviews(...args) : buildWorkPreviews(...args),
        { id: 'work-toggle', title: this.workUpgrades ? 'К СМЕНАМ' : 'УЛУЧШИТЬ РАБОТЫ', summary: [], lockedReason: null },
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

    this.payoutToastText?.setVisible(false);
    this.game.canvas.removeAttribute('aria-description');
    this.showMessage(
      'Перед действием видны цена, время, эффект и причина блокировки.',
    );
  }

  private closeActionPanel(): void {
    this.game.canvas.setAttribute('aria-label', 'Карта города');
    this.actionPanel?.hide();
    this.selectedLocation = null;
    this.mapView?.setSelected(null);
    this.renderTutorial();
  }

  private executeAction(action: ActionPreview): void {
    if (action.lockedReason !== null) {
      throw new Error(action.lockedReason);
    }

    const [kind, id] = action.id.split(':');
    if (kind === 'work-toggle') {
      this.workUpgrades = !this.workUpgrades;
      this.renderSelectedLocation();
      return;
    }
    if (kind === 'work-upgrade' && (id === 'dishes' || id === 'trash' || id === 'courier') && this.state) {
      this.state = purchaseJobUpgrade(this.state, this.activeAction, this.pendingDrop, balance, id);
      void this.persist();
      this.renderSelectedLocation();
      return;
    }

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

  private clearContextControls(): void {
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
    if (previousAction && this.actionStart === null) this.actionStart = this.state;
    const before = this.actionStart ?? this.state;
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
    if (previousAction && (result.actionCompleted || this.state.barryInterruptPending || this.state.terminalReason !== null)) {
      this.actionStart = null;
      if (previousAction.kind !== 'EVENT_TIME') {
        const elapsed = elapsedFeedbackMinutes(before.clock, this.state.clock);
        this.showResultFeedback(formatActionFeedback(previousAction, before, this.state, elapsed, result.actionCompleted));
      }
    }
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
            ? `Находка: +${result.cashAward.toLocaleString('ru-RU')} ₽`
            : result.loot === 'CHEAP_FOOD' ? 'Нашёл еду и сразу съел.' : 'Поиск завершён.',
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
      'Смена начинается: отмой тарелки.',
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
      'Смена начинается: собери мешки в контейнер.',
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
      'Смена начинается: нарисуй маршрут доставки.',
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

    this.actionStart = this.state;
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
    void this.persist();
    this.advance(started.action.remainingMinutes);
  }

  private startEntertainmentAction(
    entertainmentId: string,
  ): void {
    if (!this.state) return;

    this.actionStart = this.state;
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
    void this.persist();
    this.advance(started.action.remainingMinutes);
  }

  private startSleeping(): void {
    if (!this.state || this.activeAction || this.pendingDrop) {
      throw new Error('Finish the current action first');
    }

    this.actionStart = this.state;
    this.activeAction = startSleep(this.state, balance);
    this.audio?.play('sleep');
    this.showMessage(
      `Сон: до ${balance.sleep.fullSleepHours} ч, Барри в 09:00 прерывает.`,
    );
    void this.persist();
    this.advance(this.activeAction.remainingMinutes);
  }

  private startDumpster(): void {
    if (!this.state) return;

    this.actionStart = this.state;
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
    void this.persist();
    this.rummageElapsedMs = 0;
    this.render();
  }

  private startShowerAction(): void {
    if (!this.state) return;

    this.actionStart = this.state;
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
    void this.persist();
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
    const choiceState = structuredClone(this.state);
    if (this.state.cash < cashBefore) {
      this.audio?.play('cashSpend');
    }
    this.activeAction = resolved.activeAction;
    void this.persist().then(() => (this.game.registry.get(GAME_ANALYTICS_KEY) as GameAnalytics | undefined)?.track('event_choice', choiceState, { event_id: eventId, choice: choiceId }));
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

  private async restart(): Promise<void> {
    this.payoutToastText?.setVisible(false);
    this.game.canvas.removeAttribute('aria-description');
    this.resultTimer?.remove();
    this.actionStart = null;
    if (!this.state || !this.repository) return;
    const gate = this.game.registry.get(END_RUN_ADS_KEY) as EndRunAds | undefined;
    if (!gate) return;
    await this.persist();
    await this.repository.flush();
    await gate.beforeRestart({ version: SAVE_VERSION, game: this.state, activeAction: this.activeAction, pendingDrop: this.pendingDrop }, () => this.restartRun());
  }

  private restartRun(): void {
    this.state = restartGame(balance, createRunSeed());
    this.activeAction = null;
    this.pendingDrop = null;
    this.runEndOverlay?.hide();
    this.payoutToastText?.setVisible(false);
    this.game.canvas.removeAttribute('aria-description');
    this.closeActionPanel();
    this.clearContextControls();
    this.showMessage('Новый забег начат.');
    void this.persist();
    this.render();
  }

  public async applyPreviewDebug(command: DebugCommand): Promise<void> {
    if (!this.state || !this.repository || this.activeAction || this.pendingDrop) {
      throw new Error('Вернись на карту и дождись завершения действия');
    }
    if (command.kind === 'reset') {
      this.state = restartGame(balance, createRunSeed());
    } else {
      this.state = applyDebugCommand(this.state, command, balance);
    }
    await this.persist();
    await this.repository.flush();
    this.closeActionPanel();
    this.clearContextControls();
    this.render();
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

    this.barryOverlay?.hide();
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
    (this.game.registry.get(GAME_ANALYTICS_KEY) as GameAnalytics | undefined)?.eventShown(presentableEventId, this.state);
    const navigationLocked =
      hardLocked ||
      this.activeAction !== null ||
      this.pendingDrop !== null ||
      presentableEventId !== null;

    this.mapView.setEnabled(!navigationLocked);
    this.mapView.renderState(this.state);
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

    if (this.state.barryInterruptPending && this.state.terminalReason === null && !this.state.victory) {
      this.eventOverlay?.hide();
      if (
        this.runEndOverlay?.getMode() ===
        'principal-confirm'
      ) {
        this.runEndOverlay.hide();
      }
      this.clearContextControls();
      this.barryOverlay?.show(this.state);
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
        'Действие выполняется. Карта временно заблокирована.',
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
      this.payoutToastText?.visible ||
      this.state.terminalReason !== null ||
      this.state.victory ||
      this.state.barryInterruptPending ||
      this.activeAction !== null ||
      this.selectedLocation !== null ||
      this.state.pendingEventId !== null ||
      this.runEndOverlay?.getMode() === 'principal-confirm'
    ) {
      this.tutorialCard.render(null);
      this.messageText?.setVisible(!this.payoutToastText?.visible);
      return;
    }

    const step = deriveTutorialStep(
      loadTutorialProgress(),
    );
    const model = buildTutorialCard(step, 'map');
    this.tutorialCard.render(model);
    this.messageText?.setVisible(model === null);
  }

  private showResultFeedback(message: string): void {
    this.resultTimer?.remove();
    this.game.canvas.setAttribute('aria-description', message);
    this.payoutToastText?.setText(message).setBackgroundColor(visualHex(message.startsWith('ПРОВАЛ') || message.includes('Итог −') ? 'rust' : 'mold')).setVisible(true);
    this.renderTutorial();
    this.resultTimer = this.time.delayedCall(7000, () => {
      this.payoutToastText?.setVisible(false);
      this.game.canvas.removeAttribute('aria-description');
      this.renderTutorial();
    });
  }

  private showCasinoPayoutToast(toast: CasinoPayoutToast): void {
    this.showResultFeedback(formatCasinoResult(toast));
  }

  private showMessage(message: string): void {
    this.messageText?.setText(message);
  }
}
