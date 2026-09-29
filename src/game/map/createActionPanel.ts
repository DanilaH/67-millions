import Phaser from 'phaser';

import type { ActionPreview } from '../actions/actionPreviews';

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
  const dynamic: Phaser.GameObjects.GameObject[] = [];

  const backdrop = scene.add.rectangle(
    763,
    380,
    1006,
    520,
    0x0d1217,
    0.985,
  );
  backdrop.setStrokeStyle(2, 0x46515b, 1);
  backdrop.setInteractive();

  const titleText = scene.add
    .text(300, 138, '', {
      color: '#f4f6f8',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '24px',
      fontStyle: 'bold',
    })
    .setOrigin(0, 0);

  const back = scene.add
    .text(1225, 136, '[ НАЗАД ]', {
      color: '#f4f6f8',
      backgroundColor: '#283039',
      fontFamily: 'system-ui, sans-serif',
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
          locked ? 0x191d22 : 0x202a31,
          1,
        )
        .setStrokeStyle(
          2,
          locked ? 0x3c4248 : 0x536674,
          1,
        );

      const titleObject = scene.add.text(
        x + 12,
        y + 8,
        action.title,
        {
          color: locked ? '#8e969e' : '#f4f6f8',
          fontFamily: 'system-ui, sans-serif',
          fontSize: '15px',
          fontStyle: 'bold',
        },
      );

      const summaryObject = scene.add.text(
        x + 12,
        y + 30,
        action.summary.slice(0, 2).join('  ·  '),
        {
          color: locked ? '#747c84' : '#abb5bf',
          fontFamily: 'system-ui, sans-serif',
          fontSize: '11px',
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
            color: locked ? '#c17a72' : '#d8bf82',
            fontFamily: 'system-ui, sans-serif',
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
