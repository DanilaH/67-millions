import Phaser from 'phaser';

import { balance } from '../config/balance';
import {
  commitBareDrop,
  settleBareDrop,
  type BetFraction,
} from '../core/plinko-rules/drop';
import { SeededRandom } from '../core/rng/SeededRandom';
import { createLocalSaveRepository } from '../core/save/repository';
import { SAVE_VERSION, type SaveState } from '../core/save/SaveState';
import { createInitialGameState } from '../core/state/GameState';
import {
  createBarePlinko,
  type BarePlinkoRuntime,
} from '../phaser/plinko/createBarePlinko';

const createRunSeed = (): number => {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] || 1;
};

export class PlinkoDebugScene extends Phaser.Scene {
  private runtime: BarePlinkoRuntime | null = null;
  private random: SeededRandom | null = null;
  private save: SaveState | null = null;
  private repository: ReturnType<typeof createLocalSaveRepository> | null = null;
  private readonly balls = new Set<MatterJS.BodyType>();
  private infoText?: Phaser.GameObjects.Text;
  private graphics?: Phaser.GameObjects.Graphics;

  public constructor() {
    super('plinko-debug');
  }

  public create(): void {
    this.graphics = this.add.graphics();
    this.infoText = this.add.text(28, 20, 'Loading Plinko state…', {
      color: '#f4f6f8',
      fontFamily: 'ui-monospace, monospace',
      fontSize: '16px',
      lineSpacing: 5,
    });

    void this.initialize();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.runtime?.destroy();
      this.runtime = null;
      this.balls.clear();
    });
  }

  public update(): void {
    if (!this.graphics) return;

    this.graphics.clear();
    this.drawStaticBoard();

    this.graphics.fillStyle(0xf4f6f8, 1);
    for (const ball of this.balls) {
      this.graphics.fillCircle(
        ball.position.x,
        ball.position.y,
        balance.plinko.geometry.ballRadius,
      );
    }
  }

  private async initialize(): Promise<void> {
    const initialSeed = createRunSeed();
    this.repository = createLocalSaveRepository(() =>
      createInitialGameState(balance, initialSeed),
    );
    this.save = await this.repository.load();

    this.random = new SeededRandom(
      this.save.pendingDrop?.rngStateAtCommit ?? this.save.game.rngState,
    );
    this.runtime = createBarePlinko(this, balance, this.random, {
      onPocket: (index, body) => {
        void this.resolvePocket(index, body);
      },
    });

    this.drawStaticBoard();
    this.installPocketLabels();
    this.installControls();
    this.render();

    if (this.save.pendingDrop) {
      this.showStatus(
        'PENDING DROP FOUND. Exact active-physics restore is reserved for T029; no reroll/refund is allowed.',
      );
    }
  }

  private installControls(): void {
    const fractions: BetFraction[] = [0.25, 0.5, 1];
    fractions.forEach((fraction, index) => {
      this.add
        .text(28 + index * 155, 650, `[ DROP ${fraction * 100}% ]`, {
          color: '#f4f6f8',
          backgroundColor: '#252a31',
          fontFamily: 'system-ui, sans-serif',
          fontSize: '17px',
          padding: { x: 10, y: 8 },
        })
        .setInteractive({ useHandCursor: true })
        .on('pointerup', () => {
          void this.commitAndSpawn(fraction);
        });
    });

    this.add
      .text(535, 650, '[ BACK ]', {
        color: '#f4f6f8',
        backgroundColor: '#252a31',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '17px',
        padding: { x: 10, y: 8 },
      })
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => {
        if (this.save?.pendingDrop) {
          this.showStatus('Active Drop cannot be destroyed. Hidden-Casino continuation is T024.');
          return;
        }
        this.scene.start('bootstrap');
      });
  }

  private async commitAndSpawn(fraction: BetFraction): Promise<void> {
    if (!this.save || !this.repository || !this.runtime || !this.random) return;
    if (this.save.pendingDrop) {
      this.showStatus('A Drop is already pending.');
      return;
    }
    if (this.save.activeAction) {
      this.showStatus('Finish the active non-Plinko action first.');
      return;
    }

    try {
      const dropId =
        `${this.save.game.clock.gameDayIndex}:${this.save.game.clock.minuteOfDay}:${this.save.game.rngState}`;
      const committed = commitBareDrop(
        this.save.game,
        balance,
        dropId,
        fraction,
      );

      this.save = {
        ...this.save,
        version: SAVE_VERSION,
        game: committed.state,
        pendingDrop: committed.pendingDrop,
      };

      // Stake + pendingDrop are durable before physical outcome generation.
      await this.repository.write(this.save);
      await this.repository.flush();

      const body = this.runtime.spawnBall();
      this.balls.add(body);

      this.save = {
        ...this.save,
        game: {
          ...this.save.game,
          rngState: this.random.snapshot().state,
        },
      };
      await this.repository.write(this.save);
      this.render();
    } catch (error: unknown) {
      this.showStatus(error instanceof Error ? error.message : String(error));
    }
  }

  private async resolvePocket(
    index: number,
    body: MatterJS.BodyType,
  ): Promise<void> {
    if (!this.save || !this.repository || !this.save.pendingDrop) return;

    const pending = this.save.pendingDrop;
    const result = settleBareDrop(this.save.game, pending, index, balance);

    this.balls.delete(body);
    this.matter.world.remove(body);

    this.save = {
      ...this.save,
      game: result.state,
      pendingDrop: null,
    };
    await this.repository.write(this.save);
    await this.repository.flush();

    this.showStatus(
      `Drop settled: stake ${pending.originalStake} ₽ → ${result.payout} ₽ (${result.multiplier}x)${result.losing ? ' / losing Drop: Happiness -1' : ''}`,
    );
    this.render();
  }

  private render(): void {
    if (!this.infoText || !this.save) return;

    const maxBet =
      balance.plinko.maxBetLevels.find(
        (entry) => entry.level === this.save!.game.plinkoMaxBetLevel,
      )?.maxBet ?? 0;

    this.infoText.setText([
      `M2 BARE PLINKO / fixed ${balance.plinko.geometry.fixedTimestepHz} Hz`,
      `Cash: ${this.save.game.cash.toLocaleString('ru-RU')} ₽`,
      `Max bet: ${maxBet.toLocaleString('ru-RU')} ₽`,
      `Selected: ${this.save.game.plinkoSelectedBetFraction * 100}%`,
      `Pending: ${this.save.pendingDrop ? `${this.save.pendingDrop.dropId} / ${this.save.pendingDrop.originalStake} ₽` : 'none'}`,
      `Happiness: ${this.save.game.needs.happiness.toFixed(1)}`,
    ]);
  }

  private showStatus(message: string): void {
    this.add
      .text(680, 28, message, {
        color: '#f4f6f8',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        wordWrap: { width: 560 },
      })
      .setOrigin(0, 0);
  }

  private installPocketLabels(): void {
    if (!this.runtime) return;

    this.runtime.layout.pocketCenters.forEach((pocket, index) => {
      this.add
        .text(
          pocket.x,
          this.runtime!.layout.pocketBottomY + 18,
          `${balance.plinko.basePockets[index]}x`,
          {
            color: '#c5ccd5',
            fontFamily: 'ui-monospace, monospace',
            fontSize: '13px',
          },
        )
        .setOrigin(0.5, 0);
    });
  }

  private drawStaticBoard(): void {
    if (!this.graphics || !this.runtime) return;

    const graphics = this.graphics;
    const geometry = balance.plinko.geometry;
    const layout = this.runtime.layout;

    graphics.fillStyle(0x66717f, 1);
    for (const peg of layout.pegs) {
      graphics.fillCircle(peg.x, peg.y, geometry.pegRadius);
    }

    graphics.lineStyle(2, 0x66717f, 1);
    graphics.strokeLineShape(
      new Phaser.Geom.Line(
        layout.leftWallX,
        geometry.topPegY,
        layout.leftWallX,
        geometry.topPegY + geometry.boardAreaHeight,
      ),
    );
    graphics.strokeLineShape(
      new Phaser.Geom.Line(
        layout.rightWallX,
        geometry.topPegY,
        layout.rightWallX,
        geometry.topPegY + geometry.boardAreaHeight,
      ),
    );

    for (let index = 0; index < layout.pocketCenters.length - 1; index += 1) {
      const left = layout.pocketCenters[index]!;
      const right = layout.pocketCenters[index + 1]!;
      const x = (left.x + right.x) / 2;
      graphics.strokeLineShape(
        new Phaser.Geom.Line(x, layout.pocketTopY, x, layout.pocketBottomY),
      );
    }
  }
}
