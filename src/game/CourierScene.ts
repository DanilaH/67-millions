import { createWorkBackdrop } from './work/createWorkBackdrop';
import { installScenePresentation, logicalPointer } from './visual/scenePresentation';
import { publishWorkFeedback } from './actions/actionFeedback';
import { showInteractionFeedback } from './work/showInteractionFeedback';
import Phaser from 'phaser';
import { GAME_PRESENTABLE_EVENT } from '../app/presentable';
import { preloadProductionArt, addProductionImage } from './visual/productionArt';

import { balance } from '../config/balance';
import { SceneAudio } from '../audio/SceneAudio';
import type { WorkActiveAction } from '../core/actions/ActiveAction';
import { resolveBarryPayment } from '../core/barry/barry';
import type { SaveRepository } from '../core/save/repository';
import { SAVE_VERSION, type SaveState } from '../core/save/SaveState';
import { completeWorkSkill } from '../core/work/skillCompletion';
import { WorkMinigameClock } from '../core/work/WorkMinigameClock';
import { recordTutorialMilestone } from './tutorial/tutorialProgress';
import { getSceneSaveRepository } from './save/sceneSaveRepository';
import { VISUAL_FONT, visualColor, visualHex } from './visual/visualTheme';
import {
  createBarryMinigameOverlay,
  type BarryMinigameOverlay,
} from './work/createBarryMinigameOverlay';
import {
  courierSegmentCrossesBuilding,
  courierRouteCrossesBuilding,
  appendCourierRoutePoint,
  canBeginCourierRoute,
  createCourierSession,
  cancelCourierRoute,
  releaseCourierRoute,
  advanceCourierSession,
  type CourierSession,
} from '../minigames/courier/courierModel';

const isCourierAction = (
  action: SaveState['activeAction'],
): action is WorkActiveAction =>
  action?.kind === 'WORK' &&
  action.actionId === 'courier' &&
  action.result === null;

const deriveCourierSeed = (
  save: SaveState,
  action: WorkActiveAction,
): number => {
  const mixed =
    save.game.rngState ^
    Math.imul(action.startedAtGameDayIndex + 1, 0x9e3779b1) ^
    Math.imul(action.startedAtMinuteOfDay + 1, 0x85ebca6b) ^
    Math.imul(action.level, 0xc2b2ae35);
  return (mixed >>> 0) || 1;
};

export class CourierScene extends Phaser.Scene {
  private repository: SaveRepository | null = null;
  private save: SaveState | null = null;
  private session: CourierSession | null = null;
  private graphics?: Phaser.GameObjects.Graphics;
  private statusText?: Phaser.GameObjects.Text;
  private drawing = false;
  private completionInFlight = false;
  private saveWriteChain: Promise<void> = Promise.resolve();
  private minigameClock = new WorkMinigameClock(balance);
  private barryOverlay?: BarryMinigameOverlay;
  private audio: SceneAudio | null = null;

  private obstacleImages: Phaser.GameObjects.Image[] = [];
  private courierImage: Phaser.GameObjects.Image | undefined;

  public constructor() {
    super('courier');
  }

  public preload(): void {
    preloadProductionArt(this, ['courier', 'crate', 'courier-icon', 'barry-due', 'barry-paid']);
  }

  public create(): void {
    installScenePresentation(this);
    this.save = null;
    this.session = null;
    this.completionInFlight = false;
    this.saveWriteChain = Promise.resolve();
    this.minigameClock = new WorkMinigameClock(balance);
    this.drawing = false;
    this.obstacleImages = [];
    this.courierImage = undefined;
    createWorkBackdrop(this, 'courier');
    const width = balance.plinko.geometry.logicalViewportWidth;

    this.audio = new SceneAudio(this, 'work');

    this.add
      .text(width / 2, 24, 'КУРЬЕРСКИЙ МАРШРУТ', {
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
        'Доведи линию от зелёной зоны до синей и отпусти.',
        {
          color: visualHex('textMuted'),
          fontFamily: VISUAL_FONT.sans,
          fontSize: '26px',
        },
      )
      .setOrigin(0.5, 0);

    this.graphics = this.add.graphics().setDepth(1);
    const zoneLabel = (x: number, text: string, color: string) => this.add.text(x, 450, text, {
      fontFamily: VISUAL_FONT.sans, fontSize: '26px', fontStyle: 'bold', color,
      backgroundColor: visualHex('inkPanel'), padding: { x: 10, y: 4 },
    }).setOrigin(0.5, 0).setDepth(2);
    zoneLabel(180, 'СТАРТ', visualHex('good'));
    zoneLabel(1100, 'ФИНИШ', visualHex('cold'));
    this.barryOverlay = createBarryMinigameOverlay(
      this,
      balance,
      () => {
        void this.payBarry();
      },
    );

    this.statusText = this.add
      .text(width / 2, 646, '', {
        color: visualHex('textMain'),
        fontFamily: VISUAL_FONT.sans,
        fontSize: '26px',
        wordWrap: { width: 1120 },
        align: 'center',
      })
      .setOrigin(0.5, 0);

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
      this.drawing = false;
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
      this.drawing = false;
      this.completionInFlight = true;
      this.statusText?.setText(
        `GAME OVER: ${this.save.game.terminalReason ?? 'terminal'}`,
      );
      this.time.delayedCall(700, () => {
        this.scene.start('bootstrap');
      });
      return;
    }

    if (clock.interruptedByBarry) {
      this.drawing = false;
      this.barryOverlay?.show(this.save.game);
      this.render();
      return;
    }

    this.barryOverlay?.hide();
    if (this.session.started) {
      this.session = advanceCourierSession(this.session, deltaMs);
      this.render();
      if (this.session.result !== null) void this.completeDelivery();
    }
  }

  private async initialize(): Promise<void> {
    this.repository = getSceneSaveRepository(this);

    try {
      const save = await this.repository.load();
      if (!isCourierAction(save.activeAction)) {
        throw new Error(
          'Courier scene requires an unresolved courier WORK action',
        );
      }
      if (save.pendingDrop !== null) {
        throw new Error('Courier cannot run while a Drop is pending');
      }

      this.save = save;
      this.session = createCourierSession(
        balance,
        deriveCourierSeed(save, save.activeAction),
      );
      this.render();
      this.game.canvas.setAttribute('aria-label', 'Курьерский маршрут');
      this.game.events.emit(GAME_PRESENTABLE_EVENT);
    } catch (error: unknown) {
      this.completionInFlight = true;
      this.statusText?.setText(
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
      this.session.started ||
      this.completionInFlight ||
      this.save?.game.barryInterruptPending
    ) {
      return;
    }

    const point = logicalPointer(this, pointer);
    if (!canBeginCourierRoute(this.session, point)) return;
    this.session = cancelCourierRoute(this.session);

    this.drawing = true;
    this.session = appendCourierRoutePoint(
      this.session,
      point,
    );
    this.audio?.play('courierDraw');
    this.render();
  };

  private readonly handlePointerMove = (
    pointer: Phaser.Input.Pointer,
  ): void => {
    if (
      !this.session ||
      !this.drawing ||
      !pointer.isDown ||
      this.session.started ||
      this.save?.game.barryInterruptPending
    ) {
      return;
    }

    this.session = appendCourierRoutePoint(
      this.session,
      logicalPointer(this, pointer),
    );
    this.audio?.play('courierDraw');
    this.render();
  };

  private readonly handlePointerUp = (pointer: Phaser.Input.Pointer): void => {
    if (!this.drawing || !this.session) return;
    this.drawing = false;
    if (courierRouteCrossesBuilding(this.session)) {
      showInteractionFeedback(this, 640, 575, 'ОБЪЕДЬ ЗДАНИЯ', 'warning');
    }
    this.session = this.save?.game.barryInterruptPending
      ? cancelCourierRoute(this.session)
      : releaseCourierRoute(this.session, logicalPointer(this, pointer));
    this.render();
  };

  private async payBarry(): Promise<void> {
    if (
      !this.save ||
      !this.repository ||
      !this.save.game.barryInterruptPending
    ) {
      return;
    }

    const previousPaymentIndex =
      this.save.game.barryPaymentIndex;
    const cashBefore = this.save.game.cash;
    this.save = {
      ...this.save,
      game: resolveBarryPayment(
        this.save.game,
        balance,
      ),
    };

    if (
      this.save.game.terminalReason === null &&
      this.save.game.barryPaymentIndex >
        previousPaymentIndex
    ) {
      recordTutorialMilestone('BARRY_PAID');
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

    this.saveWriteChain = this.saveWriteChain.then(async () => {
      await repository.write(snapshot);
      if (flush) await repository.flush();
    });

    await this.saveWriteChain;
  }

  private async completeDelivery(): Promise<void> {
    if (!this.session || this.session.result === null || this.completionInFlight ||
        !this.save || !isCourierAction(this.save.activeAction)) return;

    this.completionInFlight = true;
    showInteractionFeedback(this, this.session.position.x, this.session.position.y - 50, this.session.result === 'SUCCESS' ? 'ДОСТАВЛЕНО!' : this.session.failureReason?.includes('врезался') ? 'СТОЛКНОВЕНИЕ!' : 'НЕ ДОШЁЛ ДО ФИНИША', this.session.result === 'SUCCESS' ? 'mustard' : 'warning');
    this.courierImage?.setTint(this.session.result === 'SUCCESS' ? 0xcde6af : 0xe28474);
    const skillResult = this.session.result;
    const unresolvedAction = this.save.activeAction;
    const settledAction = { ...unresolvedAction, result: skillResult };
    this.save = { ...this.save, activeAction: settledAction };
    await this.persistRuntime(true);
    const beforeCompletion = this.save.game;
    const cashBefore = this.save.game.cash;
    const completion = completeWorkSkill(
      this.save.game,
      unresolvedAction,
      skillResult,
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
    }

    this.audio?.play(
      skillResult === 'SUCCESS'
        ? 'courierSuccess'
        : 'courierFail',
    );
    if (completion.state.cash > cashBefore) {
      this.audio?.play('cashGain');
    }

    await this.persistRuntime(true);

    publishWorkFeedback(settledAction, beforeCompletion, completion);

    const message =
      skillResult === 'SUCCESS'
        ? 'УСПЕХ — заказ доставлен.'
        : `ПРОВАЛ — ${this.session.failureReason ?? 'маршрут не прошёл проверку'}.`;
    const shift =
      completion.shiftCompleted
        ? 'Смена завершена.'
        : completion.state.barryInterruptPending
          ? 'Смена остановлена Барри.'
          : 'Смена сохранена с остатком времени.';

    this.statusText?.setText(`${message} ${shift}`);
    this.render();

    this.time.delayedCall(850, () => {
      this.scene.start('bootstrap');
    });
  }

  private render(): void {
    if (!this.session || !this.graphics) return;

    const graphics = this.graphics;
    graphics.clear();

    for (const [index, obstacle] of this.session.obstacles.entries()) {
      const image = this.obstacleImages[index] ?? (this.obstacleImages[index] = addProductionImage(this, 'crate', obstacle.x, obstacle.y, obstacle.width, obstacle.height, 0));
      image.setPosition(obstacle.x, obstacle.y).setDisplaySize(obstacle.width, obstacle.height);
      graphics.fillStyle(visualColor('rust'), 0.08);
      graphics.fillRoundedRect(
        obstacle.x - obstacle.width / 2,
        obstacle.y - obstacle.height / 2,
        obstacle.width,
        obstacle.height,
        14,
      );
      graphics.lineStyle(4, visualColor('warning'), 0.92);
      graphics.strokeRoundedRect(
        obstacle.x - obstacle.width / 2,
        obstacle.y - obstacle.height / 2,
        obstacle.width,
        obstacle.height,
        14,
      );
    }

    this.courierImage ??= addProductionImage(this, 'courier-icon', this.session.start.x, this.session.start.y, 72, 72, 2);
    this.courierImage.setPosition(this.session.position.x, this.session.position.y).setRotation(this.session.heading + Math.PI / 2);
    this.game.canvas.setAttribute('data-courier-started', String(this.session.started));
    for (const [point, radius, color] of [
      [this.session.start, this.session.startRadius, visualColor('good')],
      [this.session.finish, this.session.finishRadius, visualColor('cold')],
    ] as const) {
      graphics.fillStyle(color, 0.12).fillCircle(point.x, point.y, radius);
      graphics.lineStyle(5, color, 1).strokeCircle(point.x, point.y, radius);
    }

    if (this.session.route.length > 0) {
      for (
        let index = 1;
        index < this.session.route.length;
        index += 1
      ) {
        const previous = this.session.route[index - 1]!;
        const point = this.session.route[index]!;
        graphics.lineStyle(this.session.routeThickness,
          courierSegmentCrossesBuilding(previous, point) || this.session.result === 'FAILURE'
            ? visualColor('warning') : visualColor('mustard'), 0.9);
        graphics.strokeLineShape(
          new Phaser.Geom.Line(
            previous.x,
            previous.y,
            point.x,
            point.y,
          ),
        );
      }
    }

    if (!this.completionInFlight) {
      const suffix =
        this.session.started
          ? 'Курьер в пути…'
          : this.session.route.length === 0
          ? 'Начни в зелёной зоне.'
          : courierRouteCrossesBuilding(this.session)
          ? 'Здесь здание — рисуй по улице.'
          : 'Отпусти в синей зоне, чтобы отправить курьера.';
      this.statusText?.setText(suffix);
    }
  }
}
