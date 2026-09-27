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

  private casinoLayer?: Phaser.GameObjects.Container;
  private mapLayer?: Phaser.GameObjects.Container;
  private graphics?: Phaser.GameObjects.Graphics;
  private infoText?: Phaser.GameObjects.Text;
  private statusText?: Phaser.GameObjects.Text;
  private mapText?: Phaser.GameObjects.Text;
  private mapMessageText?: Phaser.GameObjects.Text;
  private mapMode = false;
  private lastResultMessage = '';

  public constructor() {
    super('plinko-debug');
  }

  public create(): void {
    this.casinoLayer = this.add.container(0, 0);
    this.mapLayer = this.add.container(0, 0).setVisible(false);

    this.graphics = this.add.graphics();
    this.casinoLayer.add(this.graphics);

    this.infoText = this.add.text(28, 20, 'Loading Plinko state…', {
      color: '#f4f6f8',
      fontFamily: 'ui-monospace, monospace',
      fontSize: '16px',
      lineSpacing: 5,
    });
    this.casinoLayer.add(this.infoText);

    this.statusText = this.add
      .text(680, 28, '', {
        color: '#f4f6f8',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        wordWrap: { width: 560 },
      })
      .setOrigin(0, 0);
    this.casinoLayer.add(this.statusText);

    this.installMapLayer();
    void this.initialize();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.runtime?.destroy();
      this.runtime = null;
      this.balls.clear();
    });
  }

  public update(): void {
    if (!this.graphics || this.mapMode) return;

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
    this.installCasinoControls();
    this.renderAll();

    if (this.save.pendingDrop) {
      this.showStatus(
        'PENDING DROP FOUND. Exact active-physics restore is T029; this build will not reroll or refund it.',
      );
    }
  }

  private installCasinoControls(): void {
    if (!this.casinoLayer) return;

    const fractions: BetFraction[] = [0.25, 0.5, 1];
    fractions.forEach((fraction, index) => {
      const button = this.add
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
      this.casinoLayer!.add(button);
    });

    const leaveButton = this.add
      .text(500, 650, '[ MAP / LEAVE CASINO ]', {
        color: '#f4f6f8',
        backgroundColor: '#252a31',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '17px',
        padding: { x: 10, y: 8 },
      })
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.leaveCasino());
    this.casinoLayer.add(leaveButton);

    const backButton = this.add
      .text(790, 650, '[ BACK TO M1 ]', {
        color: '#f4f6f8',
        backgroundColor: '#252a31',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '17px',
        padding: { x: 10, y: 8 },
      })
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => {
        if (this.save?.pendingDrop) {
          this.showStatus('Resolve the pending Drop before leaving the Plinko runtime.');
          return;
        }
        this.scene.start('bootstrap');
      });
    this.casinoLayer.add(backButton);
  }

  private installMapLayer(): void {
    if (!this.mapLayer) return;

    const title = this.add
      .text(40, 36, 'MAP / READ-ONLY WHILE PLINKO RESOLVES', {
        color: '#f4f6f8',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '24px',
      })
      .setOrigin(0, 0);

    this.mapText = this.add
      .text(40, 100, '', {
        color: '#f4f6f8',
        fontFamily: 'ui-monospace, monospace',
        fontSize: '18px',
        lineSpacing: 6,
      })
      .setOrigin(0, 0);

    this.mapMessageText = this.add
      .text(40, 330, '', {
        color: '#f4f6f8',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '17px',
        wordWrap: { width: 900 },
      })
      .setOrigin(0, 0);

    const returnButton = this.add
      .text(40, 620, '[ RETURN TO CASINO ]', {
        color: '#f4f6f8',
        backgroundColor: '#252a31',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '17px',
        padding: { x: 10, y: 8 },
      })
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.returnToCasino());

    this.mapLayer.add([title, this.mapText, this.mapMessageText, returnButton]);
  }

  private leaveCasino(): void {
    if (!this.save) return;

    if (!this.save.pendingDrop) {
      this.scene.start('bootstrap');
      return;
    }

    this.mapMode = true;
    this.casinoLayer?.setVisible(false);
    this.mapLayer?.setVisible(true);
    this.lastResultMessage =
      'Drop is still physically resolving off-screen. All gameplay/cash actions are intentionally unavailable.';
    this.renderMap();
  }

  private returnToCasino(): void {
    this.mapMode = false;
    this.mapLayer?.setVisible(false);
    this.casinoLayer?.setVisible(true);
    this.renderCasino();
  }

  private async commitAndSpawn(fraction: BetFraction): Promise<void> {
    if (!this.save || !this.repository || !this.runtime || !this.random) return;
    if (this.save.activeAction) {
      this.showStatus('Finish the active non-Plinko action first.');
      return;
    }

    try {
      const dropId =
        `${this.save.game.clock.gameDayIndex}:${this.save.game.clock.minuteOfDay}:${this.save.game.rngState}`;
      const committed = commitBareDrop(
        this.save.game,
        this.save.pendingDrop,
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
      this.renderAll();
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

    this.lastResultMessage =
      `PAYOUT: stake ${pending.originalStake} ₽ → ${result.payout} ₽ (${result.multiplier}x)${result.losing ? ' / Happiness -1' : ''}`;
    this.showStatus(this.lastResultMessage);
    this.renderAll();
  }

  private renderAll(): void {
    this.renderCasino();
    this.renderMap();
  }

  private renderCasino(): void {
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

  private renderMap(): void {
    if (!this.mapText || !this.mapMessageText || !this.save) return;

    this.mapText.setText([
      `Cash: ${this.save.game.cash.toLocaleString('ru-RU')} ₽`,
      `Principal: ${this.save.game.mainDebt.toLocaleString('ru-RU')} ₽`,
      `HP: ${this.save.game.needs.health.toFixed(1)}`,
      `Satiety: ${this.save.game.needs.satiety.toFixed(1)}`,
      `Energy: ${this.save.game.needs.energy.toFixed(1)}`,
      `Happiness: ${this.save.game.needs.happiness.toFixed(1)}`,
      `Pending Drop: ${this.save.pendingDrop ? `${this.save.pendingDrop.originalStake} ₽ resolving` : 'none'}`,
    ]);

    this.mapMessageText.setText(
      this.lastResultMessage ||
        (this.save.pendingDrop
          ? 'Drop is resolving. Read-only inspection only.'
          : 'No active Drop.'),
    );
  }

  private showStatus(message: string): void {
    this.statusText?.setText(message);
  }

  private installPocketLabels(): void {
    if (!this.runtime || !this.casinoLayer) return;

    this.runtime.layout.pocketCenters.forEach((pocket, index) => {
      const label = this.add
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
      this.casinoLayer!.add(label);
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
