import Phaser from 'phaser';

import { balance } from '../config/balance';
import type { WorkActiveAction } from '../core/actions/ActiveAction';
import { createLocalSaveRepository } from '../core/save/repository';
import { SAVE_VERSION, type SaveState } from '../core/save/SaveState';
import { createInitialGameState } from '../core/state/GameState';
import { completeWorkSkill } from '../core/work/skillCompletion';
import {
  advanceTrashSession,
  createTrashSession,
  dropTrashBag,
  findTrashBagAtPoint,
  getAcceptedTrashBagCount,
  getTrashRemainingMs,
  moveTrashBag,
  type TrashSession,
} from '../minigames/trash/trashModel';

const createRunSeed = (): number => {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] || 1;
};

const isTrashAction = (
  action: SaveState['activeAction'],
): action is WorkActiveAction =>
  action?.kind === 'WORK' &&
  action.actionId === 'trash' &&
  action.result === null;

export class TrashScene extends Phaser.Scene {
  private repository:
    | ReturnType<typeof createLocalSaveRepository>
    | null = null;
  private save: SaveState | null = null;
  private session: TrashSession | null = null;
  private graphics?: Phaser.GameObjects.Graphics;
  private timerText?: Phaser.GameObjects.Text;
  private progressText?: Phaser.GameObjects.Text;
  private messageText?: Phaser.GameObjects.Text;
  private heldBagId: string | null = null;
  private completionInFlight = false;

  public constructor() {
    super('trash');
  }

  public create(): void {
    const { width } = this.scale;

    this.add
      .text(width / 2, 24, 'ВЫНЕСТИ МУСОР', {
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
        'Перетащи все 5 мешков в контейнер. Зоны захвата и приёма расширены.',
        {
          color: '#aeb7c3',
          fontFamily: 'system-ui, sans-serif',
          fontSize: '17px',
        },
      )
      .setOrigin(0.5, 0);

    this.timerText = this.add
      .text(36, 32, '', {
        color: '#f4f6f8',
        fontFamily: 'ui-monospace, monospace',
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
        color: '#f4f6f8',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '20px',
      })
      .setOrigin(0.5, 0);

    this.graphics = this.add.graphics();

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
    if (!this.session || this.completionInFlight) return;

    this.session = advanceTrashSession(
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
    this.repository = createLocalSaveRepository(() =>
      createInitialGameState(balance, createRunSeed()),
    );

    try {
      const save = await this.repository.load();
      if (!isTrashAction(save.activeAction)) {
        throw new Error(
          'Trash scene requires an unresolved trash WORK action',
        );
      }
      if (save.pendingDrop !== null) {
        throw new Error('Trash cannot run while a Drop is pending');
      }

      this.save = save;
      this.session = createTrashSession(balance);
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
    if (!this.session || this.session.result !== null) return;

    this.heldBagId = findTrashBagAtPoint(
      this.session,
      { x: pointer.x, y: pointer.y },
    );

    if (this.heldBagId !== null) {
      this.session = moveTrashBag(
        this.session,
        this.heldBagId,
        { x: pointer.x, y: pointer.y },
      );
      this.render();
    }
  };

  private readonly handlePointerMove = (
    pointer: Phaser.Input.Pointer,
  ): void => {
    if (
      !this.session ||
      this.session.result !== null ||
      this.heldBagId === null ||
      !pointer.isDown
    ) {
      return;
    }

    this.session = moveTrashBag(
      this.session,
      this.heldBagId,
      { x: pointer.x, y: pointer.y },
    );
    this.render();
  };

  private readonly handlePointerUp = (
    pointer: Phaser.Input.Pointer,
  ): void => {
    if (
      !this.session ||
      this.session.result !== null ||
      this.heldBagId === null
    ) {
      this.heldBagId = null;
      return;
    }

    const bagId = this.heldBagId;
    this.heldBagId = null;
    this.session = dropTrashBag(
      this.session,
      bagId,
      { x: pointer.x, y: pointer.y },
    );

    this.render();

    if (this.session.result !== null) {
      void this.complete(this.session.result);
    }
  };

  private async complete(
    result: 'SUCCESS' | 'FAILURE',
  ): Promise<void> {
    if (
      this.completionInFlight ||
      !this.repository ||
      !this.save ||
      !isTrashAction(this.save.activeAction)
    ) {
      return;
    }

    this.completionInFlight = true;
    this.heldBagId = null;

    const completion = completeWorkSkill(
      this.save.game,
      this.save.activeAction,
      result,
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

    const accepted = this.session
      ? getAcceptedTrashBagCount(this.session)
      : 0;
    const total = this.session?.bags.length ?? 0;
    const outcome =
      result === 'SUCCESS'
        ? `УСПЕХ — ${accepted}/${total} мешков`
        : `ПРОВАЛ — ${accepted}/${total} мешков`;
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

    graphics.fillStyle(0x14181b, 1);
    graphics.fillRoundedRect(80, 120, 650, 510, 32);
    graphics.lineStyle(4, 0x5b646e, 1);
    graphics.strokeRoundedRect(80, 120, 650, 510, 32);

    const target = this.session.target;
    graphics.fillStyle(0x26352f, 1);
    graphics.fillRoundedRect(
      target.x,
      target.y,
      target.width,
      target.height,
      20,
    );
    graphics.lineStyle(7, 0x667d70, 1);
    graphics.strokeRoundedRect(
      target.x,
      target.y,
      target.width,
      target.height,
      20,
    );
    graphics.fillStyle(0x34463f, 1);
    graphics.fillRect(
      target.x - 12,
      target.y - 24,
      target.width + 24,
      32,
    );

    for (const bag of this.session.bags) {
      if (bag.accepted) continue;

      const held = bag.id === this.heldBagId;
      graphics.fillStyle(
        held ? 0xd3bc75 : 0x80745f,
        1,
      );
      graphics.fillRoundedRect(
        bag.x - 35,
        bag.y - 42,
        70,
        84,
        18,
      );
      graphics.fillStyle(0x4c4437, 1);
      graphics.fillTriangle(
        bag.x - 17,
        bag.y - 40,
        bag.x + 17,
        bag.y - 40,
        bag.x,
        bag.y - 60,
      );

      if (held) {
        graphics.lineStyle(2, 0x69d6ff, 0.7);
        graphics.strokeCircle(
          bag.x,
          bag.y,
          this.session.grabRadius,
        );
      }
    }

    const remainingSeconds =
      getTrashRemainingMs(this.session) / 1000;
    const accepted =
      getAcceptedTrashBagCount(this.session);

    this.timerText?.setText(
      `${remainingSeconds.toFixed(1)}s`,
    );
    this.progressText?.setText(
      `В КОНТЕЙНЕРЕ: ${accepted}/${this.session.bags.length}`,
    );

    if (!this.completionInFlight) {
      this.messageText?.setText(
        this.heldBagId
          ? 'Тащи мешок в контейнер.'
          : 'Нажми рядом с мешком и перетащи.',
      );
    }
  }
}
