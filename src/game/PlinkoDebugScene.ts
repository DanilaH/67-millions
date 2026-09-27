import Phaser from 'phaser';

import { balance } from '../config/balance';
import { SeededRandom } from '../core/rng/SeededRandom';
import {
  createBarePlinko,
  type BarePlinkoRuntime,
} from '../phaser/plinko/createBarePlinko';

export class PlinkoDebugScene extends Phaser.Scene {
  private runtime: BarePlinkoRuntime | null = null;
  private readonly balls = new Set<MatterJS.BodyType>();
  private infoText?: Phaser.GameObjects.Text;
  private graphics?: Phaser.GameObjects.Graphics;

  public constructor() {
    super('plinko-debug');
  }

  public create(): void {
    const random = new SeededRandom(0x67_00_00_01);

    this.graphics = this.add.graphics();
    this.infoText = this.add.text(28, 20, '', {
      color: '#f4f6f8',
      fontFamily: 'ui-monospace, monospace',
      fontSize: '16px',
    });

    this.runtime = createBarePlinko(this, balance, random, {
      onPocket: (index, body) => {
        const multiplier = balance.plinko.basePockets[index];
        this.infoText?.setText(
          `M2 MATTER PROBE  |  pocket ${index} = ${multiplier ?? '?'}x`,
        );
        this.balls.delete(body);
        this.matter.world.remove(body);
      },
    });

    this.drawStaticBoard();

    this.add
      .text(28, 650, '[ DROP TEST BALL ]', {
        color: '#f4f6f8',
        backgroundColor: '#252a31',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '17px',
        padding: { x: 10, y: 8 },
      })
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.dropBall());

    this.add
      .text(270, 650, '[ BACK TO M1 DEBUG ]', {
        color: '#f4f6f8',
        backgroundColor: '#252a31',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '17px',
        padding: { x: 10, y: 8 },
      })
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.scene.start('bootstrap'));

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.runtime?.destroy();
      this.runtime = null;
      this.balls.clear();
    });

    this.infoText.setText(
      `M2 MATTER PROBE  |  ${balance.plinko.rows} rows / ${balance.plinko.basePockets.length} pockets / fixed 60 Hz`,
    );
  }

  public update(): void {
    if (!this.graphics) return;

    const graphics = this.graphics;
    graphics.clear();
    this.drawStaticBoard();

    graphics.fillStyle(0xf4f6f8, 1);
    for (const ball of this.balls) {
      graphics.fillCircle(
        ball.position.x,
        ball.position.y,
        balance.plinko.geometry.ballRadius,
      );
    }
  }

  private dropBall(): void {
    if (!this.runtime || this.balls.size >= balance.plinko.maxActiveBalls) return;
    this.balls.add(this.runtime.spawnBall());
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

    const dividerTop = layout.pocketTopY;
    for (let index = 0; index < layout.pocketCenters.length - 1; index += 1) {
      const left = layout.pocketCenters[index]!;
      const right = layout.pocketCenters[index + 1]!;
      const x = (left.x + right.x) / 2;
      graphics.strokeLineShape(
        new Phaser.Geom.Line(x, dividerTop, x, layout.pocketBottomY),
      );
    }

    layout.pocketCenters.forEach((pocket, index) => {
      this.add
        .text(
          pocket.x,
          layout.pocketBottomY + 18,
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
}
