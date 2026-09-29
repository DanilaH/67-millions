import Phaser from 'phaser';

import type { BalanceConfig } from '../../config/balance.schema';
import {
  deriveMainMapLocations,
  type MainMapLocation,
  type MainMapLocationId,
} from './mainMapModel';

export interface MainMapView {
  setEnabled(enabled: boolean): void;
  setSelected(id: MainMapLocationId | null): void;
}

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

  const draw = (): void => {
    graphics.clear();

    graphics.fillStyle(0x0c1116, 1);
    graphics.fillRoundedRect(260, 120, 1006, 520, 24);
    graphics.lineStyle(2, 0x2c353e, 1);
    graphics.strokeRoundedRect(260, 120, 1006, 520, 24);

    graphics.lineStyle(9, 0x29323a, 0.7);
    graphics.strokeLineShape(
      new Phaser.Geom.Line(360, 325, 1150, 325),
    );
    graphics.strokeLineShape(
      new Phaser.Geom.Line(675, 160, 675, 575),
    );
    graphics.lineStyle(4, 0x20272e, 0.9);
    graphics.strokeLineShape(
      new Phaser.Geom.Line(430, 220, 920, 430),
    );
    graphics.strokeLineShape(
      new Phaser.Geom.Line(430, 430, 920, 220),
    );

    for (const location of locations) {
      const isSelected = location.id === selected;
      graphics.fillStyle(
        isSelected ? 0x39434c : 0x1b2229,
        enabled ? 1 : 0.55,
      );
      graphics.fillRoundedRect(
        location.x - 92,
        location.y - 54,
        184,
        108,
        18,
      );
      graphics.lineStyle(
        isSelected ? 4 : 2,
        isSelected ? 0xd3ad6f : 0x46515b,
        enabled ? 1 : 0.55,
      );
      graphics.strokeRoundedRect(
        location.x - 92,
        location.y - 54,
        184,
        108,
        18,
      );
    }
  };

  for (const location of locations) {
    const button = scene.add
      .text(
        location.x,
        location.y - 18,
        location.label,
        {
          color: '#f4f6f8',
          fontFamily: 'system-ui, sans-serif',
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
          color: '#9da8b4',
          fontFamily: 'system-ui, sans-serif',
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
        color: '#7f8a95',
        fontFamily: 'system-ui, sans-serif',
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
