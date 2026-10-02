import Phaser from 'phaser';
import { GAME_PRESENTABLE_EVENT } from '../app/presentable';
import { preloadProductionArt, addProductionImage } from './visual/productionArt';

import { balance } from '../config/balance';
import { SceneAudio } from '../audio/SceneAudio';
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
import type { WorkActiveAction } from '../core/actions/ActiveAction';
import {
  advanceDishesSession,
  createDishesSession,
  DISHES_INTERACTION,
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
  private minigameClock = new WorkMinigameClock(balance);
  private barryOverlay?: BarryMinigameOverlay;
  private audio: SceneAudio | null = null;

  private plateImages: Phaser.GameObjects.Image[] = [];

  private dirtTexture?: Phaser.Textures.CanvasTexture;
  private renderedSpots: DishesSession['spots'] | null = null;

  public constructor() {
    super('dishes');
  }

  public preload(): void {
    preloadProductionArt(this, ['dishes', 'plate', 'barry-due', 'barry-paid']);
  }

  public create(): void {
    this.save = null;
    this.session = null;
    this.completionInFlight = false;
    this.saveWriteChain = Promise.resolve();
    this.minigameClock = new WorkMinigameClock(balance);
    this.pointerDown = false;
    this.lastPointer = null;
    this.plateImages = [];
    this.renderedSpots = null;
    const dirtKey = '67m:dishes-dirt';
    if (this.textures.exists(dirtKey)) this.textures.remove(dirtKey);
    const tileSize = 128;
    this.dirtTexture = this.textures.createCanvas(dirtKey, tileSize * DISHES_INTERACTION.plates.length, tileSize)!;
    DISHES_INTERACTION.plates.forEach((plate, index) => {
      const frame = `plate-${index}`;
      this.dirtTexture!.add(frame, 0, index * tileSize, 0, tileSize, tileSize);
      this.add.image(plate.x, plate.y, dirtKey, frame).setDepth(1);
    });
    addProductionImage(this, 'dishes', 640, 375, 1080, 525);
    const { width } = this.scale;

    this.audio = new SceneAudio(this, 'work');

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
        'Зажми и води губкой по слою грязи. Нужно очистить минимум 90%.',
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

    this.graphics = this.add.graphics().setDepth(2);
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
      this.game.canvas.setAttribute('aria-label', 'Мойка посуды');
      this.game.events.emit(GAME_PRESENTABLE_EVENT);
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

    const unresolvedAction = this.save.activeAction;
    const settledAction = { ...unresolvedAction, result: result };
    this.save = { ...this.save, activeAction: settledAction };
    await this.persistRuntime(true);
    const cashBefore = this.save.game.cash;
    const completion = completeWorkSkill(
      this.save.game,
      unresolvedAction,
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

    graphics.fillStyle(visualColor('inkPanel'), 0.12);
    graphics.fillRoundedRect(150, 112, 980, 500, 36);

    graphics.lineStyle(5, visualColor('lineDirty'), 1);
    graphics.strokeRoundedRect(150, 112, 980, 500, 36);

    this.session.plates.forEach((plate, index) => {
      const image = this.plateImages[index] ?? (this.plateImages[index] = addProductionImage(this, 'plate', plate.x, plate.y, plate.radius * 2.25, plate.radius * 2.25, 0));
      image.setPosition(plate.x, plate.y);
    });

    if (this.dirtTexture && this.renderedSpots !== this.session.spots) {
      const context = this.dirtTexture.context;
      if (this.renderedSpots === null) context.clearRect(0, 0, this.dirtTexture.width, this.dirtTexture.height);
      const size = DISHES_INTERACTION.dirtCellSize;
      for (const [index, spot] of this.session.spots.entries()) {
        const plate = this.session.plates[spot.plateIndex]!;
        const x = spot.x - plate.x + 64 + spot.plateIndex * 128 - size / 2;
        const y = spot.y - plate.y + 64 - size / 2;
        if (this.renderedSpots !== null) {
          if (spot.cleaned && !this.renderedSpots[index]!.cleaned) context.clearRect(x, y, size, size);
          continue;
        }
        if (spot.cleaned) continue;
        // Continuous greasy film with deterministic mottling and fine grain.
        const grain = Math.sin(spot.x * 12.9898 + spot.y * 78.233) * 43758.5453;
        const noise = grain - Math.floor(grain);
        const stain = (Math.sin(spot.x * 0.073) * Math.cos(spot.y * 0.097) + 1) / 2;
        context.fillStyle = `rgba(${75 + Math.floor(noise * 28)}, ${43 + Math.floor(stain * 27)}, 24, ${0.72 + stain * 0.24})`;
        context.fillRect(x, y, size, size);
      }
      this.dirtTexture.refresh();
      this.renderedSpots = this.session.spots;
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
