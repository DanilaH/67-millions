import Phaser from 'phaser';

import { VISUAL_FONT, visualHex } from '../visual/visualTheme';

import type {
  CasinoQuickBetPreview,
} from './casinoUiModel';

export interface CasinoBetPanel {
  render(previews: CasinoQuickBetPreview[]): void;
}

export const createCasinoBetPanel = (
  scene: Phaser.Scene,
  onDrop: (preview: CasinoQuickBetPreview) => void,
  parent?: Phaser.GameObjects.Container,
): CasinoBetPanel => {
  const container = scene.add
    .container(0, 0)
    .setDepth(20);
  parent?.add(container);

  const dynamic: Phaser.GameObjects.GameObject[] = [];

  const title = scene.add
    .text(28, 610, 'БЫСТРАЯ СТАВКА', {
      color: visualHex('textMuted'),
      fontFamily: VISUAL_FONT.sans,
      fontSize: '13px',
      fontStyle: 'bold',
    });

  const lockText = scene.add
    .text(510, 615, '', {
      color: visualHex('warning'),
      fontFamily: VISUAL_FONT.sans,
      fontSize: '12px',
      wordWrap: { width: 380 },
    });

  container.add([title, lockText]);

  const clearDynamic = (): void => {
    for (const object of dynamic) {
      object.destroy();
    }
    dynamic.length = 0;
  };

  return {
    render: (previews) => {
      clearDynamic();

      const sharedLock =
        previews.find((preview) => preview.lockedReason !== null)
          ?.lockedReason ?? null;
      lockText.setText(sharedLock ?? '');

      previews.forEach((preview, index) => {
        const locked = preview.lockedReason !== null;
        const selected = preview.selected;

        const button = scene.add
          .text(
            28 + index * 155,
            642,
            preview.amount === null
              ? `[ ${preview.label} ]`
              : `[ ${preview.label} · ${preview.amount.toLocaleString('ru-RU')} ₽ ]`,
            {
              color: locked
                ? visualHex('textMuted')
                : selected
                  ? visualHex('inkDeep')
                  : visualHex('textMain'),
              backgroundColor: locked
                ? visualHex('inkPanel')
                : selected
                  ? visualHex('mustard')
                  : visualHex('inkRaised'),
              fontFamily: VISUAL_FONT.sans,
              fontSize: '14px',
              fontStyle: selected ? 'bold' : 'normal',
              padding: { x: 10, y: 8 },
            },
          );

        if (!locked) {
          button
            .setInteractive({ useHandCursor: true })
            .on('pointerup', () => onDrop(preview));
        }

        container.add(button);
        dynamic.push(button);
      });
    },
  };
};
