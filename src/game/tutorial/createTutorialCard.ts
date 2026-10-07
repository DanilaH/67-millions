import Phaser from 'phaser';
import { sceneViewport } from '../visual/scenePresentation';

import { VISUAL_FONT, visualColor, visualHex } from '../visual/visualTheme';
import type { TutorialCardModel } from './tutorialUiModel';

export interface TutorialCard {
  render(model: TutorialCardModel | null): void;
}

export const createTutorialCard = (
  scene: Phaser.Scene,
  onAcknowledge: (step: 'BARRY' | 'NEEDS') => void,
  surface: 'map' | 'casino' = 'map',
): TutorialCard => {
  const casino = surface === 'casino';
  const x = casino ? 20 : 260;
  const y = casino ? 420 : 612;
  const width = casino ? 300 : 1006;
  const height = casino ? 176 : 96;
  const container = scene.add
    .container(0, 0)
    .setDepth(1_500)
    .setVisible(false);

  const panel = scene.add
    .rectangle(
      x + width / 2,
      y + height / 2,
      width,
      height,
      visualColor('inkPanel'),
      0.97,
    )
    .setStrokeStyle(2, visualColor('paperOld'), 1);

  const title = scene.add
    .text(x + 16, y + 10, '', {
      color: visualHex('mustard'),
      fontFamily: VISUAL_FONT.sans,
      fontSize: '20px',
      fontStyle: 'bold',
    })
    .setOrigin(0, 0);

  const body = scene.add
    .text(x + 16, y + 34, '', {
      color: visualHex('textMain'),
      fontFamily: VISUAL_FONT.sans,
      fontSize: '19px',
      wordWrap: { width: casino ? width - 32 : width - 190 },
      lineSpacing: 3,
    })
    .setOrigin(0, 0);

  const acknowledge = scene.add
    .text(x + width - 16, y + height - 48, '[ ПОНЯТНО ]', {
      color: visualHex('inkDeep'),
      backgroundColor: visualHex('mustard'),
      fontFamily: VISUAL_FONT.sans,
      fontSize: '17px',
      fontStyle: 'bold',
      padding: { x: 9, y: 13 },
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

      if (casino) {
        const compact = sceneViewport(scene).scale < 0.8;
        container.setPosition(compact ? sceneViewport(scene).left + sceneViewport(scene).width - 350 : 0, compact ? -160 : 0);
        panel.setSize(width, compact ? 340 : height).setY(y + (compact ? 340 : height) / 2);
        title.setFontSize(compact ? 24 : 20);
        body.setFontSize(compact ? 24 : 19).setY(y + (compact ? 45 : 34));
        acknowledge.setY(y + (compact ? 250 : height - 48)).setFontSize(compact ? 26 : 17).setPadding(9, compact ? 24 : 13);
      }
      currentAcknowledge = model.acknowledge;
      title.setText(model.title);
      body.setText(model.body);
      acknowledge.setVisible(model.acknowledge !== null);
      container.setVisible(true);
    },
  };
};
