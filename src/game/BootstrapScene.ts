import Phaser from 'phaser';

import { balance } from '../config/balance';

export const GAME_PRESENTABLE_EVENT = 'bootstrap:game-presentable';

export class BootstrapScene extends Phaser.Scene {
  public constructor() {
    super('bootstrap');
  }

  public create(): void {
    const { width, height } = this.scale;
    this.add
      .text(
        width / 2,
        height / 2,
        `67 МИЛЛИОНОВ\nM0 BOOTSTRAP READY\nBalance: ${balance.meta.version}`,
        {
          align: 'center',
          color: '#f4f6f8',
          fontFamily: 'system-ui, sans-serif',
          fontSize: '22px',
        },
      )
      .setOrigin(0.5);

    this.game.events.emit(GAME_PRESENTABLE_EVENT);
  }
}
