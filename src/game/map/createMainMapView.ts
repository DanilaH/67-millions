import Phaser from 'phaser';

import type { BalanceConfig } from '../../config/balance.schema';
import {
  VISUAL_FONT,
  visualColor,
  visualHex,
  type VisualColorToken,
} from '../visual/visualTheme';
import {
  deriveMainMapLocations,
  type MainMapLocation,
  type MainMapLocationId,
} from './mainMapModel';

export interface MainMapView {
  setEnabled(enabled: boolean): void;
  setSelected(id: MainMapLocationId | null): void;
}

const LOCATION_ACCENT: Record<
  MainMapLocationId,
  VisualColorToken
> = {
  work: 'cold',
  food: 'mustard',
  home: 'bruise',
  entertainment: 'paperOld',
  dumpster: 'mold',
  shower: 'cold',
  casino: 'rust',
};

export const createMainMapView = (
  scene: Phaser.Scene,
  config: BalanceConfig,
  onSelect: (location: MainMapLocation) => void,
): MainMapView => {
  const graphics = scene.add.graphics().setDepth(0);
  const locations = deriveMainMapLocations(config);
  const buttons = new Map<
    MainMapLocationId,
    Phaser.GameObjects.Text
  >();
  let enabled = true;
  let selected: MainMapLocationId | null = null;

  const drawBackdrop = (): void => {
    graphics.fillStyle(visualColor('inkDeep'), 1);
    graphics.fillRoundedRect(260, 120, 1006, 520, 24);
    graphics.lineStyle(2, visualColor('lineDirty'), 1);
    graphics.strokeRoundedRect(260, 120, 1006, 520, 24);

    graphics.fillStyle(visualColor('inkPanel'), 0.7);
    graphics.fillRect(285, 145, 956, 450);

    graphics.fillStyle(visualColor('rust'), 0.12);
    graphics.fillRect(292, 152, 235, 92);
    graphics.fillStyle(visualColor('mold'), 0.12);
    graphics.fillRect(1010, 426, 202, 130);
    graphics.fillStyle(visualColor('bruise'), 0.1);
    graphics.fillRect(770, 160, 190, 105);

    graphics.lineStyle(10, visualColor('lineDirty'), 0.4);
    graphics.strokeLineShape(
      new Phaser.Geom.Line(350, 325, 1160, 325),
    );
    graphics.strokeLineShape(
      new Phaser.Geom.Line(675, 150, 675, 585),
    );

    graphics.lineStyle(3, visualColor('inkRaised'), 0.95);
    graphics.strokeLineShape(
      new Phaser.Geom.Line(430, 220, 920, 430),
    );
    graphics.strokeLineShape(
      new Phaser.Geom.Line(430, 430, 920, 220),
    );

    for (let x = 315; x < 1210; x += 72) {
      graphics.fillStyle(visualColor('paperOld'), 0.08);
      graphics.fillCircle(x, 603, 2);
    }
  };

  const draw = (): void => {
    graphics.clear();
    drawBackdrop();

    for (const location of locations) {
      const isSelected = location.id === selected;
      const accent = visualColor(
        LOCATION_ACCENT[location.id],
      );

      graphics.fillStyle(
        isSelected
          ? visualColor('inkRaised')
          : visualColor('inkPanel'),
        enabled ? 0.98 : 0.5,
      );
      graphics.fillRoundedRect(
        location.x - 92,
        location.y - 54,
        184,
        108,
        16,
      );

      graphics.fillStyle(accent, enabled ? 0.94 : 0.32);
      graphics.fillRoundedRect(
        location.x - 92,
        location.y - 54,
        184,
        isSelected ? 9 : 6,
        6,
      );

      graphics.lineStyle(
        isSelected ? 4 : 2,
        isSelected
          ? accent
          : visualColor('lineDirty'),
        enabled ? 1 : 0.48,
      );
      graphics.strokeRoundedRect(
        location.x - 92,
        location.y - 54,
        184,
        108,
        16,
      );

      graphics.fillStyle(accent, enabled ? 0.22 : 0.1);
      graphics.fillCircle(
        location.x - 70,
        location.y + 34,
        isSelected ? 12 : 9,
      );

      if (location.id === 'casino') {
        graphics.lineStyle(3, accent, enabled ? 0.72 : 0.28);
        graphics.strokeLineShape(
          new Phaser.Geom.Line(
            location.x + 58,
            location.y - 33,
            location.x + 58,
            location.y + 31,
          ),
        );
        graphics.fillStyle(accent, enabled ? 0.5 : 0.18);
        graphics.fillCircle(
          location.x + 58,
          location.y - 12,
          5,
        );
        graphics.fillCircle(
          location.x + 58,
          location.y + 5,
          5,
        );
        graphics.fillCircle(
          location.x + 58,
          location.y + 22,
          5,
        );
      }
    }
  };

  for (const location of locations) {
    const button = scene.add
      .text(
        location.x,
        location.y - 18,
        location.label,
        {
          color: visualHex('textMain'),
          fontFamily: VISUAL_FONT.sans,
          fontSize: '18px',
          fontStyle: 'bold',
          align: 'center',
        },
      )
      .setOrigin(0.5)
      .setDepth(2)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => {
        if (!enabled) return;
        selected = location.id;
        draw();
        onSelect(location);
      });

    scene.add
      .text(
        location.x,
        location.y + 18,
        location.description,
        {
          color: visualHex('textMuted'),
          fontFamily: VISUAL_FONT.sans,
          fontSize: '12px',
          align: 'center',
          wordWrap: { width: 155 },
        },
      )
      .setOrigin(0.5)
      .setDepth(2);

    buttons.set(location.id, button);
  }

  scene.add
    .text(
      282,
      596,
      config.time.navigationTimeMinutes === 0
        ? 'Переходы по карте не тратят игровое время'
        : `Переход: ${config.time.navigationTimeMinutes} мин`,
      {
        color: visualHex('textMuted'),
        fontFamily: VISUAL_FONT.sans,
        fontSize: '13px',
      },
    )
    .setDepth(2);

  draw();

  return {
    setEnabled: (value) => {
      enabled = value;
      for (const button of buttons.values()) {
        if (enabled) {
          button.setInteractive({ useHandCursor: true });
        } else {
          button.disableInteractive();
        }
      }
      draw();
    },
    setSelected: (id) => {
      selected = id;
      draw();
    },
  };
};
