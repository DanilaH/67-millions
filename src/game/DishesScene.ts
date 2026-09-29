import Phaser from 'phaser';

import { balance } from '../config/balance';
import { SceneAudio } from '../audio/SceneAudio';
import {
  getBarryPaymentDue,
  resolveBarryPayment,
} from '../core/barry/barry';
import type { SaveRepository } from '../core/save/repository';
import { SAVE_VERSION, type SaveState } from '../core/save/SaveState';
import { completeWorkSkill } from '../core/work/skillCompletion';
import { getWorkLevelDefinition } from '../core/work/work';
import { WorkMinigameClock } from '../core/work/WorkMinigameClock';
import { recordTutorialMilestone } from './tutorial/tutorialProgress';
import { getSceneSaveRepository } from './save/sceneSaveRepository';
import {
  getSceneGameAnalytics,
} from './analytics/sceneGameAnalytics';
import type { GameAnalytics } from '../analytics/GameAnalytics';
import { VISUAL_FONT, visualColor, visualHex } from './visual/visualTheme';
import {
  createBarryMinigameOverlay,
  type BarryMinigameOverlay,
} from './work/createBarryMinigameOverlay';
import type { WorkActiveAction } from '../core/actions/ActiveAction';
import {
  advanceDishesSession,
  createDishesSession,
  getDishesCleanPercent,
  getDishesRemainingMs,
  scrubDishes,
  type DishesPoint,
  type DishesSession,
} from '../minigames/dishes/dishesModel';

const isDishesAction = (
  action: SaveState['activeAction'],
): action is WorkActiveAction =>
  action?.kind === 'WORK' &&
  action.actionId === 'dishes' &&
  action.result === null;

export class DishesScene extends Phaser.Scene {
  private repository: SaveRepository | null = null;
  private analytics: GameAnalytics | null = null;
  private save: SaveState | null = null;
  private session: DishesSession | null = null;
  private graphics?: Phaser.GameObjects.Graphics;
  private timerText?: Phaser.GameObjects.Text;
  private progressText?: Phaser.GameObjects.Text;
  private messageText?: Phaser.GameObjects.Text;
  private lastPointer: DishesPoint | null = null;
  private pointerDown = false;
  private completionInFlight = false;
  private saveWriteChain: Promise<void> = Promise.resolve();
  private readonly minigameClock = new WorkMinigameClock(balance);
  private barryOverlay?: BarryMinigameOverlay;
  private audio: SceneAudio | null = null;

  public constructor() {
    super('dishes');
  }

  public create(): void {
    const { width } = this.scale;

    this.audio = new SceneAudio(this, 'work');
    this.analytics = getSceneGameAnalytics(this);

    this.add
      .text(width / 2, 24, 'МОЙКА ПОСУДЫ', {
        color: visualHex('textMain'),
        fontFamily: VISUAL_FONT.sans,
        fontSize: '30px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0);

    this.add
      .text(
        width / 2,
        66,
        'Зажми и води губкой по грязным точкам. Нужно очистить минимум 90%.',
        {
          color: visualHex('textMuted'),
          fontFamily: VISUAL_FONT.sans,
          fontSize: '17px',
        },
      )
      .setOrigin(0.5, 0);

    this.timerText = this.add
      .text(36, 32, '', {
        color: visualHex('textMain'),
        fontFamily: VISUAL_FONT.mono,
        fontSize: '24px',
      })
      .setOrigin(0, 0);

    this.progressText = this.add
      .text(width - 36, 32, '', {
        color: '#f4f6f8',
        fontFamily: 'ui-monospace, monospace',
        fontSize: '24px',
      })
      .setOrigin(1, 0);

    this.messageText = this.add
      .text(width / 2, 662, '', {
        color: visualHex('textMain'),
        fontFamily: VISUAL_FONT.sans,
        fontSize: '20px',
      })
      .setOrigin(0.5, 0);

    this.graphics = this.add.graphics();
    this.barryOverlay = createBarryMinigameOverlay(
      this,
      balance,
      () => {
        void this.payBarry();
      },
    );

    this.input.on('pointerdown', this.handlePointerDown);
    this.input.on('pointermove', this.handlePointerMove);
    this.input.on('pointerup', this.handlePointerUp);
    this.input.on('pointerupoutside', this.handlePointerUp);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('pointerdown', this.handlePointerDown);
      this.input.off('pointermove', this.handlePointerMove);
      this.input.off('pointerup', this.handlePointerUp);
      this.input.off('pointerupoutside', this.handlePointerUp);
      this.audio?.dispose();
      this.audio = null;
    });

    void this.initialize();
  }

  public update(_time: number, deltaMs: number): void {
    if (!this.session || this.completionInFlight || !this.save) return;

    this.audio?.syncBarry(
      this.save.game.barryInterruptPending,
    );
    this.audio?.syncNeeds(
      this.save.game.needs,
      balance.needs.lowThreshold,
    );

    if (this.save.game.barryInterruptPending) {
      this.pointerDown = false;
      this.lastPointer = null;
      this.barryOverlay?.show(this.save.game);
      return;
    }

    const clock = this.minigameClock.advance(
      this.save.game,
      deltaMs,
      balance,
    );

    if (clock.state !== this.save.game) {
      this.save = {
        ...this.save,
        game: clock.state,
      };
      if (clock.advancedMinutes > 0) {
        void this.persistRuntime(
          clock.interruptedByBarry || clock.terminal,
        );
      }
    }

    if (clock.terminal) {
      this.pointerDown = false;
      this.lastPointer = null;
      this.completionInFlight = true;
      this.messageText?.setText(
        `GAME OVER: ${this.save.game.terminalReason ?? 'terminal'}`,
      );
      this.time.delayedCall(700, () => {
        this.scene.start('bootstrap');
      });
      return;
    }

    if (clock.interruptedByBarry) {
      this.pointerDown = false;
      this.lastPointer = null;
      this.barryOverlay?.show(this.save.game);
      this.render();
      return;
    }

    this.barryOverlay?.hide();
    this.session = advanceDishesSession(
      this.session,
      deltaMs,
    );

    if (this.session.result !== null) {
      void this.complete(this.session.result);
      return;
    }

    this.render();
  }

  private async initialize(): Promise<void> {
    this.repository = getSceneSaveRepository(this);

    try {
      const save = await this.repository.load();
      if (!isDishesAction(save.activeAction)) {
        throw new Error(
          'Dishes scene requires an unresolved dishes WORK action',
        );
      }
      if (save.pendingDrop !== null) {
        throw new Error('Dishes cannot run while a Drop is pending');
      }

      this.save = save;
      this.session = createDishesSession(balance);
      this.render();
    } catch (error: unknown) {
      this.completionInFlight = true;
      this.messageText?.setText(
        error instanceof Error ? error.message : String(error),
      );
      this.time.delayedCall(900, () => {
        this.scene.start('bootstrap');
      });
    }
  }

  private readonly handlePointerDown = (
    pointer: Phaser.Input.Pointer,
  ): void => {
    if (
      !this.session ||
      this.session.result !== null ||
      this.save?.game.barryInterruptPending
    ) {
      return;
    }

    this.pointerDown = true;
    const point = { x: pointer.x, y: pointer.y };
    this.lastPointer = point;
    this.session = scrubDishes(
      this.session,
      point,
      point,
    );
    this.audio?.play('dishesScrub');
    this.afterScrub();
  };

  private readonly handlePointerMove = (
    pointer: Phaser.Input.Pointer,
  ): void => {
    if (
      !this.session ||
      this.session.result !== null ||
      !this.pointerDown ||
      !pointer.isDown ||
      this.save?.game.barryInterruptPending
    ) {
      return;
    }

    const point = { x: pointer.x, y: pointer.y };
    const previous = this.lastPointer ?? point;
    this.lastPointer = point;
    this.session = scrubDishes(
      this.session,
      previous,
      point,
    );
    this.audio?.play('dishesScrub');
    this.afterScrub();
  };

  private readonly handlePointerUp = (): void => {
    this.pointerDown = false;
    this.lastPointer = null;
  };

  private afterScrub(): void {
    if (!this.session) return;

    this.render();
    if (this.session.result !== null && !this.completionInFlight) {
      void this.complete(this.session.result);
    }
  }

  private async payBarry(): Promise<void> {
    if (
      !this.save ||
      !this.repository ||
      !this.save.game.barryInterruptPending
    ) {
      return;
    }

    const before = this.save.game;
    const previousPaymentIndex =
      before.barryPaymentIndex;
    const cashBefore = before.cash;
    const due = getBarryPaymentDue(
      before,
      balance,
    );
    this.save = {
      ...this.save,
      game: resolveBarryPayment(
        before,
        balance,
      ),
    };

    if (
      this.save.game.terminalReason === null &&
      this.save.game.barryPaymentIndex >
        previousPaymentIndex
    ) {
      recordTutorialMilestone('BARRY_PAID');
      this.analytics?.track(
        'barry_paid',
        {
          payment_index:
            this.save.game.barryPaymentIndex,
          amount: Math.max(
            due,
            this.save.game.totalBarryPaid -
              before.totalBarryPaid,
          ),
          cash_after: this.save.game.cash,
        },
      );
      if (this.save.game.cash < cashBefore) {
        this.audio?.play('cashSpend');
      }
      this.audio?.syncBarry(false);
    }

    await this.persistRuntime(true);

    if (this.save.game.terminalReason !== null) {
      this.completionInFlight = true;
      this.barryOverlay?.setMessage(
        'Не хватает денег. Забег завершён.',
      );
      this.time.delayedCall(850, () => {
        this.scene.start('bootstrap');
      });
      return;
    }

    this.barryOverlay?.hide();
    this.render();
  }

  private async persistRuntime(flush: boolean): Promise<void> {
    if (!this.repository || !this.save) return;

    const repository = this.repository;
    const snapshot = structuredClone(this.save);
    this.analytics?.observeState(
      snapshot.game,
    );

    this.saveWriteChain = this.saveWriteChain.then(async () => {
      await repository.write(snapshot);
      if (flush) await repository.flush();
    });

    await this.saveWriteChain;
  }

  private async complete(
    result: 'SUCCESS' | 'FAILURE',
  ): Promise<void> {
    if (
      this.completionInFlight ||
      !this.repository ||
      !this.save ||
      !isDishesAction(this.save.activeAction)
    ) {
      return;
    }

    this.completionInFlight = true;
    this.pointerDown = false;

    const action = this.save.activeAction;
    const cashBefore = this.save.game.cash;
    const completion = completeWorkSkill(
      this.save.game,
      action,
      result,
      balance,
    );

    this.save = {
      ...this.save,
      version: SAVE_VERSION,
      game: completion.state,
      activeAction: completion.activeAction,
    };

    if (completion.shiftCompleted) {
      recordTutorialMilestone('WORK_COMPLETED');

      const definition =
        getWorkLevelDefinition(
          balance,
          action.actionId as keyof typeof balance.work.jobs,
          action.level,
        );
      if (result === 'SUCCESS') {
        this.analytics?.track(
          'work_completed',
          {
            job: action.actionId,
            level: action.level,
            payout: Math.max(
              0,
              completion.state.cash -
                cashBefore,
            ),
            cash_after:
              completion.state.cash,
            duration_minutes:
              definition.durationMinutes,
          },
        );
      } else {
        this.analytics?.track(
          'work_failed',
          {
            job: action.actionId,
            level: action.level,
            fine: Math.max(
              0,
              cashBefore -
                completion.state.cash,
            ),
            cash_after:
              completion.state.cash,
            duration_minutes:
              definition.durationMinutes,
          },
        );
      }
    }

    this.audio?.play(
      result === 'SUCCESS'
        ? 'dishesSuccess'
        : 'dishesFail',
    );
    if (completion.state.cash > cashBefore) {
      this.audio?.play('cashGain');
    }

    await this.persistRuntime(true);

    const cleanPercent = this.session
      ? Math.round(getDishesCleanPercent(this.session) * 100)
      : 0;
    const outcome =
      result === 'SUCCESS'
        ? `УСПЕХ — ${cleanPercent}% чисто`
        : `ПРОВАЛ — ${cleanPercent}% чисто`;
    const shift =
      completion.shiftCompleted
        ? 'Смена завершена.'
        : completion.state.barryInterruptPending
          ? 'Смена остановлена Барри.'
          : 'Смена сохранена с остатком времени.';

    this.messageText?.setText(`${outcome}. ${shift}`);
    this.render();

    this.time.delayedCall(700, () => {
      this.scene.start('bootstrap');
    });
  }

  private render(): void {
    if (!this.session || !this.graphics) return;

    const graphics = this.graphics;
    graphics.clear();

    graphics.fillStyle(visualColor('inkPanel'), 1);
    graphics.fillRoundedRect(150, 112, 980, 500, 36);

    graphics.lineStyle(5, visualColor('lineDirty'), 1);
    graphics.strokeRoundedRect(150, 112, 980, 500, 36);

    for (const plate of this.session.plates) {
      graphics.fillStyle(visualColor('paperOld'), 0.95);
      graphics.fillCircle(
        plate.x,
        plate.y,
        plate.radius,
      );

      graphics.lineStyle(5, visualColor('cold'), 0.95);
      graphics.strokeCircle(
        plate.x,
        plate.y,
        plate.radius - 9,
      );
      graphics.lineStyle(2, visualColor('lineDirty'), 0.9);
      graphics.strokeCircle(
        plate.x,
        plate.y,
        plate.radius * 0.45,
      );
    }

    for (const spot of this.session.spots) {
      if (spot.cleaned) continue;
      graphics.fillStyle(visualColor('rust'), 0.95);
      graphics.fillCircle(spot.x, spot.y, 9);
      graphics.fillStyle(visualColor('inkDeep'), 0.72);
      graphics.fillCircle(spot.x + 2, spot.y - 2, 4);
    }

    if (this.pointerDown && this.lastPointer) {
      graphics.lineStyle(3, visualColor('cold'), 0.85);
      graphics.strokeCircle(
        this.lastPointer.x,
        this.lastPointer.y,
        this.session.scrubRadius,
      );
    }

    const remainingSeconds =
      getDishesRemainingMs(this.session) / 1000;
    const cleanPercent =
      getDishesCleanPercent(this.session) * 100;

    this.timerText?.setText(
      `${remainingSeconds.toFixed(1)}s`,
    );
    this.progressText?.setText(
      `ЧИСТО: ${Math.floor(cleanPercent)}%`,
    );

    if (!this.completionInFlight) {
      this.messageText?.setText(
        cleanPercent >= this.session.successCleanPercent * 100
          ? 'Готово!'
          : 'Веди пальцем или мышью по грязи.',
      );
    }
  }
}
