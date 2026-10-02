import Phaser from 'phaser';

import type { ActionPreview } from '../actions/actionPreviews';
import { VISUAL_FONT, visualColor, visualHex } from '../visual/visualTheme';

export interface ActionPanel {
  show(title: string, actions: ActionPreview[]): void;
  hide(): void;
  isVisible(): boolean;
}

export const createActionPanel = (
  scene: Phaser.Scene,
  onBack: () => void,
  onAction: (action: ActionPreview) => void,
): ActionPanel => {
  const container = scene.add
    .container(0, 0)
    .setDepth(200)
    .setVisible(false);
  let lastSignature = '';
  const dynamic: Phaser.GameObjects.GameObject[] = [];

  const backdrop = scene.add.rectangle(
    763,
    380,
    1006,
    520,
    visualColor('inkDeep'),
    0.985,
  );
  backdrop.setStrokeStyle(2, visualColor('lineDirty'), 1);
  backdrop.setInteractive();

  const titleText = scene.add
    .text(300, 138, '', {
      color: visualHex('textMain'),
      fontFamily: VISUAL_FONT.sans,
      fontSize: '24px',
      fontStyle: 'bold',
    })
    .setOrigin(0, 0);

  const back = scene.add
    .text(1225, 136, '[ НАЗАД ]', {
      color: visualHex('textMain'),
      backgroundColor: visualHex('inkRaised'),
      fontFamily: VISUAL_FONT.sans,
      fontSize: '15px',
      padding: { x: 9, y: 6 },
    })
    .setOrigin(1, 0)
    .setInteractive({ useHandCursor: true })
    .on('pointerup', onBack);

  container.add([backdrop, titleText, back]);

  const clearDynamic = (): void => {
    for (const object of dynamic) {
      object.destroy();
    }
    dynamic.length = 0;
  };

  const show = (
    title: string,
    actions: ActionPreview[],
  ): void => {
    const signature = JSON.stringify([title, actions]);
    if (signature === lastSignature && container.visible) return;
    lastSignature = signature;
    clearDynamic();
    titleText.setText(title);

    actions.forEach((action, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = 292 + column * 472;
      const y = 190 + row * 82;
      const width = 444;
      const height = 70;
      const locked = action.lockedReason !== null;

      const card = scene.add
        .rectangle(
          x + width / 2,
          y + height / 2,
          width,
          height,
          locked ? visualColor('inkPanel') : visualColor('inkRaised'),
          1,
        )
        .setStrokeStyle(
          2,
          locked ? visualColor('lineDirty') : visualColor('cold'),
          1,
        );

      const titleObject = scene.add.text(
        x + 12,
        y + 8,
        action.title,
        {
          color: locked ? visualHex('textMuted') : visualHex('textMain'),
          fontFamily: VISUAL_FONT.sans,
          fontSize: '15px',
          fontStyle: 'bold',
        },
      );

      const summaryObject = scene.add.text(
        x + 12,
        y + 30,
        action.summary.slice(0, 2).join('  ·  '),
        {
          color: visualHex('textMuted'),
          fontFamily: VISUAL_FONT.sans,
          fontSize: '13px',
          wordWrap: { width: width - 24 },
        },
      );

      const lockObject = scene.add
        .text(
          x + width - 10,
          y + 8,
          locked
            ? action.lockedReason!
            : '[ ВЫБРАТЬ ]',
          {
            color: locked ? visualHex('warning') : visualHex('mustard'),
            fontFamily: VISUAL_FONT.sans,
            fontSize: '11px',
            align: 'right',
          },
        )
        .setOrigin(1, 0);

      if (!locked) {
        card
          .setInteractive({ useHandCursor: true })
          .on('pointerup', () => onAction(action));
      }

      container.add([
        card,
        titleObject,
        summaryObject,
        lockObject,
      ]);
      dynamic.push(
        card,
        titleObject,
        summaryObject,
        lockObject,
      );
    });

    container.setVisible(true);
  };

  return {
    show,
    hide: () => {
      container.setVisible(false);
      clearDynamic();
    },
    isVisible: () => container.visible,
  };
};
