import Phaser from 'phaser';

import { VISUAL_FONT, visualColor, visualHex } from '../visual/visualTheme';
import type { TutorialCardModel } from './tutorialUiModel';

export interface TutorialCard {
  render(model: TutorialCardModel | null): void;
}

export const createTutorialCard = (
  scene: Phaser.Scene,
  onAcknowledge: (step: 'BARRY' | 'NEEDS') => void,
): TutorialCard => {
  const container = scene.add
    .container(0, 0)
    .setDepth(1_500)
    .setVisible(false);

  const panel = scene.add
    .rectangle(
      620,
      545,
      650,
      118,
      visualColor('inkPanel'),
      0.97,
    )
    .setStrokeStyle(2, visualColor('paperOld'), 1);

  const title = scene.add
    .text(315, 500, '', {
      color: visualHex('mustard'),
      fontFamily: VISUAL_FONT.sans,
      fontSize: '16px',
      fontStyle: 'bold',
    })
    .setOrigin(0, 0);

  const body = scene.add
    .text(315, 526, '', {
      color: visualHex('textMain'),
      fontFamily: VISUAL_FONT.sans,
      fontSize: '14px',
      wordWrap: { width: 500 },
      lineSpacing: 3,
    })
    .setOrigin(0, 0);

  const acknowledge = scene.add
    .text(925, 564, '[ ПОНЯТНО ]', {
      color: visualHex('inkDeep'),
      backgroundColor: visualHex('mustard'),
      fontFamily: VISUAL_FONT.sans,
      fontSize: '13px',
      fontStyle: 'bold',
      padding: { x: 9, y: 6 },
    })
    .setOrigin(1, 0)
    .setInteractive({ useHandCursor: true });

  let currentAcknowledge: 'BARRY' | 'NEEDS' | null = null;

  acknowledge.on('pointerup', () => {
    if (currentAcknowledge !== null) {
      onAcknowledge(currentAcknowledge);
    }
  });

  container.add([
    panel,
    title,
    body,
    acknowledge,
  ]);

  return {
    render: (model) => {
      if (model === null) {
        currentAcknowledge = null;
        container.setVisible(false);
        return;
      }

      currentAcknowledge = model.acknowledge;
      title.setText(model.title);
      body.setText(model.body);
      acknowledge.setVisible(model.acknowledge !== null);
      container.setVisible(true);
    },
  };
};
