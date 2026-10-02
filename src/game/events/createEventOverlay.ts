import { balance } from '../../config/balance';
import Phaser from 'phaser';

import { VISUAL_FONT, VISUAL_METRICS, visualColor, visualHex } from '../visual/visualTheme';

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
  const width = balance.plinko.geometry.logicalViewportWidth;
  const height = balance.plinko.geometry.logicalViewportHeight;
  let visible = false;
  const choiceObjects: Phaser.GameObjects.GameObject[] = [];

  const container = scene.add
    .container(0, 0)
    .setDepth(VISUAL_METRICS.overlayDepth)
    .setVisible(false);

  const shade = scene.add
    .rectangle(
      width / 2,
      height / 2,
      width,
      height,
      visualColor('inkDeep'),
      0.72,
    )
    .setInteractive();

  const panel = scene.add
    .rectangle(
      width / 2,
      height / 2,
      880,
      500,
      visualColor('inkPanel'),
      1,
    )
    .setStrokeStyle(3, visualColor('rust'), 1);

  const kicker = scene.add
    .text(width / 2, 132, 'СОБЫТИЕ', {
      color: visualHex('paperOld'),
      fontFamily: VISUAL_FONT.sans,
      fontSize: '14px',
      fontStyle: 'bold',
    })
    .setOrigin(0.5, 0);

  const title = scene.add
    .text(width / 2, 160, '', {
      color: visualHex('textMain'),
      fontFamily: VISUAL_FONT.sans,
      fontSize: '28px',
      fontStyle: 'bold',
      align: 'center',
    })
    .setOrigin(0.5, 0);

  const body = scene.add
    .text(width / 2, 214, '', {
      color: visualHex('textMuted'),
      fontFamily: VISUAL_FONT.sans,
      fontSize: '21px',
      align: 'center',
      wordWrap: { width: 760 },
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
        const y = 370 + index * 126;
        const row = scene.add
          .rectangle(
            width / 2,
            y,
            800,
            112,
            choice.available ? visualColor('inkRaised') : visualColor('inkPanel'),
            1,
          )
          .setStrokeStyle(
            2,
            choice.available ? visualColor('cold') : visualColor('lineDirty'),
            1,
          );

        const label = scene.add
          .text(
            width / 2 - 380,
            y - 42,
            `${choice.id.toUpperCase()}. ${choice.label}`,
            {
              color: choice.available ? visualHex('textMain') : visualHex('textMuted'),
              fontFamily: VISUAL_FONT.sans,
              fontSize: '22px',
              wordWrap: { width: 760 },
            },
          )
          .setOrigin(0, 0);

        const lock = scene.add
          .text(
            width / 2 + 380,
            y + 25,
            choice.lockedReason ?? '[ ВЫБРАТЬ ]',
            {
              color: choice.available ? visualHex('mustard') : visualHex('warning'),
              fontFamily: VISUAL_FONT.mono,
              fontSize: '18px',
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
