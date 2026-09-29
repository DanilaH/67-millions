import Phaser from 'phaser';

import type {
  EventChoicePresentation,
  EventPresentation,
} from './eventUiModel';

export interface EventOverlay {
  show(presentation: EventPresentation): void;
  hide(): void;
  isVisible(): boolean;
}

export const createEventOverlay = (
  scene: Phaser.Scene,
  onChoose: (choice: EventChoicePresentation) => void,
): EventOverlay => {
  const { width, height } = scene.scale;
  let visible = false;
  const choiceObjects: Phaser.GameObjects.GameObject[] = [];

  const container = scene.add
    .container(0, 0)
    .setDepth(1_800)
    .setVisible(false);

  const shade = scene.add
    .rectangle(
      width / 2,
      height / 2,
      width,
      height,
      0x050607,
      0.72,
    )
    .setInteractive();

  const panel = scene.add
    .rectangle(
      width / 2,
      height / 2,
      720,
      420,
      0x171c22,
      1,
    )
    .setStrokeStyle(3, 0x6c5841, 1);

  const kicker = scene.add
    .text(width / 2, 176, 'СОБЫТИЕ', {
      color: '#b99b6e',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '14px',
      fontStyle: 'bold',
    })
    .setOrigin(0.5, 0);

  const title = scene.add
    .text(width / 2, 204, '', {
      color: '#f4f6f8',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '28px',
      fontStyle: 'bold',
      align: 'center',
    })
    .setOrigin(0.5, 0);

  const body = scene.add
    .text(width / 2, 258, '', {
      color: '#cbd2d9',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '17px',
      align: 'center',
      wordWrap: { width: 610 },
      lineSpacing: 4,
    })
    .setOrigin(0.5, 0);

  container.add([shade, panel, kicker, title, body]);

  const clearChoices = (): void => {
    for (const object of choiceObjects) {
      object.destroy();
    }
    choiceObjects.length = 0;
  };

  return {
    show: (presentation) => {
      clearChoices();
      title.setText(presentation.title);
      body.setText(presentation.body);

      presentation.choices.forEach((choice, index) => {
        const y = 372 + index * 86;
        const row = scene.add
          .rectangle(
            width / 2,
            y,
            610,
            68,
            choice.available ? 0x263039 : 0x202428,
            1,
          )
          .setStrokeStyle(
            2,
            choice.available ? 0x576978 : 0x3a4046,
            1,
          );

        const label = scene.add
          .text(
            width / 2 - 280,
            y - 19,
            `${choice.id.toUpperCase()}. ${choice.label}`,
            {
              color: choice.available ? '#f4f6f8' : '#8c939a',
              fontFamily: 'system-ui, sans-serif',
              fontSize: '15px',
              wordWrap: { width: 465 },
            },
          )
          .setOrigin(0, 0);

        const lock = scene.add
          .text(
            width / 2 + 280,
            y - 8,
            choice.lockedReason ?? '[ ВЫБРАТЬ ]',
            {
              color: choice.available ? '#d9bf7d' : '#c2766d',
              fontFamily: 'ui-monospace, monospace',
              fontSize: '12px',
              align: 'right',
            },
          )
          .setOrigin(1, 0);

        if (choice.available) {
          row
            .setInteractive({ useHandCursor: true })
            .on('pointerup', () => onChoose(choice));
          lock
            .setInteractive({ useHandCursor: true })
            .on('pointerup', () => onChoose(choice));
        }

        container.add([row, label, lock]);
        choiceObjects.push(row, label, lock);
      });

      visible = true;
      container.setVisible(true);
    },

    hide: () => {
      visible = false;
      container.setVisible(false);
      clearChoices();
    },

    isVisible: () => visible,
  };
};
