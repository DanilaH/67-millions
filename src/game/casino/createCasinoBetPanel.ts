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

  let lastSignature = '';
  const dynamic: Phaser.GameObjects.GameObject[] = [];

  const title = scene.add
    .text(28, 246, 'БЫСТРАЯ СТАВКА', {
      color: visualHex('textMuted'),
      fontFamily: VISUAL_FONT.sans,
      fontSize: '13px',
      fontStyle: 'bold',
    });

  const lockText = scene.add
    .text(28, 213, '', {
      color: visualHex('warning'),
      fontFamily: VISUAL_FONT.sans,
      fontSize: '12px',
      wordWrap: { width: 285 },
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
      const signature = JSON.stringify(previews);
      if (signature === lastSignature && container.visible) return;
      lastSignature = signature;
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
            28,
            274 + index * 46,
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
              fontSize: '16px',
              fixedWidth: 284,
              fixedHeight: 44,
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
