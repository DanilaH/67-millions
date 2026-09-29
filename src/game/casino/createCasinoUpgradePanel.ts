import Phaser from 'phaser';

import type {
  CasinoUpgradeId,
  CasinoUpgradePreview,
} from './casinoUiModel';

export interface CasinoUpgradePanel {
  render(previews: CasinoUpgradePreview[]): void;
}

export const createCasinoUpgradePanel = (
  scene: Phaser.Scene,
  onPurchase: (id: CasinoUpgradeId) => void,
): CasinoUpgradePanel => {
  const container = scene.add
    .container(0, 0)
    .setDepth(20);
  const dynamic: Phaser.GameObjects.GameObject[] = [];

  const background = scene.add
    .rectangle(1100, 350, 330, 500, 0x10151b, 0.96)
    .setStrokeStyle(2, 0x3c4853, 1);

  const title = scene.add
    .text(950, 112, 'АПГРЕЙДЫ', {
      color: '#f4f6f8',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '18px',
      fontStyle: 'bold',
    })
    .setOrigin(0, 0);

  container.add([background, title]);

  const clearDynamic = (): void => {
    for (const object of dynamic) {
      object.destroy();
    }
    dynamic.length = 0;
  };

  return {
    render: (previews) => {
      clearDynamic();

      previews.forEach((preview, index) => {
        const y = 146 + index * 50;
        const locked = preview.lockedReason !== null;
        const row = scene.add
          .rectangle(
            1100,
            y + 20,
            304,
            44,
            locked ? 0x171c21 : 0x202930,
            1,
          )
          .setStrokeStyle(
            1,
            locked ? 0x353b41 : 0x50616f,
            1,
          );

        const name = scene.add.text(
          958,
          y + 6,
          `${preview.title}  L${preview.currentLevel}/${preview.maxLevel}`,
          {
            color: locked ? '#969da4' : '#f4f6f8',
            fontFamily: 'system-ui, sans-serif',
            fontSize: '12px',
            fontStyle: 'bold',
          },
        );

        const detail = scene.add.text(
          958,
          y + 24,
          preview.detail,
          {
            color: '#89939c',
            fontFamily: 'system-ui, sans-serif',
            fontSize: '10px',
          },
        );

        const action = scene.add
          .text(
            1242,
            y + 8,
            preview.maxed
              ? 'MAX'
              : locked
                ? preview.lockedReason!
                : `${preview.nextPrice!.toLocaleString('ru-RU')} ₽`,
            {
              color: locked ? '#c2766d' : '#d9bf7d',
              fontFamily: 'ui-monospace, monospace',
              fontSize: '10px',
              align: 'right',
              wordWrap: { width: 126 },
            },
          )
          .setOrigin(1, 0);

        if (!locked) {
          row
            .setInteractive({ useHandCursor: true })
            .on('pointerup', () => onPurchase(preview.id));
          action
            .setInteractive({ useHandCursor: true })
            .on('pointerup', () => onPurchase(preview.id));
        }

        container.add([row, name, detail, action]);
        dynamic.push(row, name, detail, action);
      });
    },
  };
};
