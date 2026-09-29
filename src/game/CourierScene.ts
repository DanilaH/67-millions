import Phaser from 'phaser';

import { balance } from '../config/balance';
import type { WorkActiveAction } from '../core/actions/ActiveAction';
import { resolveBarryPayment } from '../core/barry/barry';
import { createLocalSaveRepository } from '../core/save/repository';
import { SAVE_VERSION, type SaveState } from '../core/save/SaveState';
import { createInitialGameState } from '../core/state/GameState';
import { completeWorkSkill } from '../core/work/skillCompletion';
import { WorkMinigameClock } from '../core/work/WorkMinigameClock';
import {
  createBarryMinigameOverlay,
  type BarryMinigameOverlay,
} from './work/createBarryMinigameOverlay';
import {
  appendCourierRoutePoint,
  canBeginCourierRoute,
  createCourierSession,
  redrawCourierRoute,
  resolveCourierRoute,
  type CourierPoint,
  type CourierSession,
} from '../minigames/courier/courierModel';

const createRunSeed = (): number => {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] || 1;
};

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

const distanceSquared = (
  left: CourierPoint,
  right: CourierPoint,
): number => {
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  return dx * dx + dy * dy;
};

export class CourierScene extends Phaser.Scene {
  private repository:
    | ReturnType<typeof createLocalSaveRepository>
    | null = null;
  private save: SaveState | null = null;
  private session: CourierSession | null = null;
  private graphics?: Phaser.GameObjects.Graphics;
  private statusText?: Phaser.GameObjects.Text;
  private redrawText?: Phaser.GameObjects.Text;
  private drawing = false;
  private completionInFlight = false;
  private readonly minigameClock = new WorkMinigameClock(balance);
  private barryOverlay?: BarryMinigameOverlay;

  public constructor() {
    super('courier');
  }

  public create(): void {
    const { width } = this.scale;

    this.add
      .text(width / 2, 24, 'КУРЬЕРСКИЙ МАРШРУТ', {
        color: '#f4f6f8',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '30px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0);

    this.add
      .text(
        width / 2,
        66,
        'Нарисуй путь от зелёной точки к синей, не задевая препятствия.',
        {
          color: '#aeb7c3',
          fontFamily: 'system-ui, sans-serif',
          fontSize: '17px',
        },
      )
      .setOrigin(0.5, 0);

    this.graphics = this.add.graphics();
    this.barryOverlay = createBarryMinigameOverlay(
      this,
      balance,
      () => {
        void this.payBarry();
      },
    );

    this.statusText = this.add
      .text(width / 2, 660, '', {
        color: '#f4f6f8',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '19px',
      })
      .setOrigin(0.5, 0);

    this.redrawText = this.add
      .text(36, 650, '[ ПЕРЕРИСОВАТЬ ]', {
        color: '#f4f6f8',
        backgroundColor: '#252a31',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '17px',
        padding: { x: 10, y: 8 },
      })
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.redraw());

    this.add
      .text(width - 36, 650, '[ СТАРТ ]', {
        color: '#f4f6f8',
        backgroundColor: '#2b4a36',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '17px',
        padding: { x: 10, y: 8 },
      })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => {
        void this.startDelivery();
      });

    this.input.on('pointerdown', this.handlePointerDown);
    this.input.on('pointermove', this.handlePointerMove);
    this.input.on('pointerup', this.handlePointerUp);
    this.input.on('pointerupoutside', this.handlePointerUp);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('pointerdown', this.handlePointerDown);
      this.input.off('pointermove', this.handlePointerMove);
      this.input.off('pointerup', this.handlePointerUp);
      this.input.off('pointerupoutside', this.handlePointerUp);
    });

    void this.initialize();
  }

  public update(_time: number, deltaMs: number): void {
    if (!this.session || this.completionInFlight || !this.save) return;

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
  }

  private async initialize(): Promise<void> {
    this.repository = createLocalSaveRepository(() =>
      createInitialGameState(balance, createRunSeed()),
    );

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

    const point = { x: pointer.x, y: pointer.y };
    if (this.session.route.length === 0) {
      if (!canBeginCourierRoute(this.session, point)) {
        this.statusText?.setText(
          'Начни линию внутри зелёной зоны.',
        );
        return;
      }
    } else {
      const last = this.session.route.at(-1)!;
      if (distanceSquared(last, point) > 55 * 55) {
        this.statusText?.setText(
          'Продолжай линию от её последней точки.',
        );
        return;
      }
    }

    this.drawing = true;
    this.session = appendCourierRoutePoint(
      this.session,
      point,
    );
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
      { x: pointer.x, y: pointer.y },
    );
    this.render();
  };

  private readonly handlePointerUp = (): void => {
    this.drawing = false;
  };

  private redraw(): void {
    if (
      !this.session ||
      this.completionInFlight ||
      this.save?.game.barryInterruptPending
    ) {
      return;
    }

    const before = this.session.redrawsRemaining;
    this.session = redrawCourierRoute(this.session);
    this.drawing = false;

    this.statusText?.setText(
      before > this.session.redrawsRemaining
        ? 'Маршрут очищен. Это была единственная перерисовка.'
        : 'Перерисовка уже использована.',
    );
    this.render();
  }

  private async payBarry(): Promise<void> {
    if (
      !this.save ||
      !this.repository ||
      !this.save.game.barryInterruptPending
    ) {
      return;
    }

    this.save = {
      ...this.save,
      game: resolveBarryPayment(
        this.save.game,
        balance,
      ),
    };
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
    await this.repository.write(this.save);
    if (flush) await this.repository.flush();
  }

  private async startDelivery(): Promise<void> {
    if (
      !this.session ||
      this.completionInFlight ||
      !this.repository ||
      !this.save ||
      !isCourierAction(this.save.activeAction) ||
      this.save.game.barryInterruptPending
    ) {
      return;
    }

    this.drawing = false;
    this.session = resolveCourierRoute(this.session);

    if (this.session.result === null) return;

    this.completionInFlight = true;
    const skillResult = this.session.result;
    const completion = completeWorkSkill(
      this.save.game,
      this.save.activeAction,
      skillResult,
      balance,
    );

    this.save = {
      ...this.save,
      version: SAVE_VERSION,
      game: completion.state,
      activeAction: completion.activeAction,
    };

    await this.repository.write(this.save);
    await this.repository.flush();

    const message =
      skillResult === 'SUCCESS'
        ? 'УСПЕХ — маршрут проходим.'
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

    graphics.fillStyle(0x101820, 1);
    graphics.fillRoundedRect(100, 105, 1080, 525, 28);
    graphics.lineStyle(4, 0x52606c, 1);
    graphics.strokeRoundedRect(100, 105, 1080, 525, 28);

    for (const obstacle of this.session.obstacles) {
      graphics.fillStyle(0x6a3535, 1);
      graphics.fillRoundedRect(
        obstacle.x - obstacle.width / 2,
        obstacle.y - obstacle.height / 2,
        obstacle.width,
        obstacle.height,
        14,
      );
      graphics.lineStyle(4, 0x9c5757, 1);
      graphics.strokeRoundedRect(
        obstacle.x - obstacle.width / 2,
        obstacle.y - obstacle.height / 2,
        obstacle.width,
        obstacle.height,
        14,
      );
    }

    graphics.fillStyle(0x4fad67, 1);
    graphics.fillCircle(
      this.session.start.x,
      this.session.start.y,
      this.session.startRadius,
    );
    graphics.fillStyle(0x17251b, 1);
    graphics.fillCircle(
      this.session.start.x,
      this.session.start.y,
      22,
    );

    graphics.fillStyle(0x5598d9, 1);
    graphics.fillCircle(
      this.session.finish.x,
      this.session.finish.y,
      this.session.finishRadius,
    );
    graphics.fillStyle(0x172331, 1);
    graphics.fillCircle(
      this.session.finish.x,
      this.session.finish.y,
      24,
    );

    if (this.session.route.length > 0) {
      graphics.lineStyle(
        this.session.routeThickness,
        this.session.result === 'FAILURE'
          ? 0xd66a6a
          : 0xf2d36b,
        0.9,
      );

      for (
        let index = 1;
        index < this.session.route.length;
        index += 1
      ) {
        const previous = this.session.route[index - 1]!;
        const point = this.session.route[index]!;
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

    this.redrawText?.setText(
      `[ ПЕРЕРИСОВАТЬ (${this.session.redrawsRemaining}) ]`,
    );

    if (!this.completionInFlight) {
      const suffix =
        this.session.route.length === 0
          ? 'Начни в зелёной зоне.'
          : 'Нажми СТАРТ для проверки маршрута.';
      this.statusText?.setText(suffix);
    }
  }
}
