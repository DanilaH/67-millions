import Phaser from 'phaser';
import { addProductionImage } from '../visual/productionArt';

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
  const map = addProductionImage(scene, 'map', 640, 360, 1280, 720);
  const source = map.texture.getSourceImage();
  const cover = Math.max(1280 / source.width, 720 / source.height);
  map.setDisplaySize(source.width * cover, source.height * cover);
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


    for (const location of locations) {
      const isSelected = location.id === selected;
      const accent = visualColor(
        LOCATION_ACCENT[location.id],
      );

      graphics.fillStyle(visualColor('inkPanel'), enabled ? 0.92 : 0.5);
      graphics.fillRoundedRect(location.x - 92, location.y - 27, 184, 54, 16);
      graphics.lineStyle(isSelected ? 3 : 1, accent, enabled ? 0.9 : 0.35);
      graphics.strokeRoundedRect(location.x - 92, location.y - 27, 184, 54, 16);
      graphics.fillStyle(accent, 1);
      graphics.fillTriangle(location.x - 7, location.y + 28, location.x + 7, location.y + 28, location.x, location.y + 38);

    }
  };

  for (const location of locations) {
    const button = scene.add
      .text(
        location.x,
        location.y,
        location.label,
        {
          color: visualHex('textMain'),
          fontFamily: VISUAL_FONT.sans,
          fontSize: location.label.length > 15 ? '16px' : '18px',
          fontStyle: 'bold',
          align: 'center',
        },
      )
      .setOrigin(0.5)
      .setDepth(2)
      .setInteractive({
        hitArea: new Phaser.Geom.Rectangle(0, 0, 184, 108),
        hitAreaCallback: (_area: unknown, x: number, y: number) =>
          Math.abs(x - button.width / 2) <= 92 && Math.abs(y - button.height / 2) <= 54,
        useHandCursor: true,
      })
      .on('pointerup', () => {
        if (!enabled) return;
        selected = location.id;
        draw();
        onSelect(location);
      });

    if (button.width > 164) button.setFontSize(Math.floor(Number.parseFloat(button.style.fontSize as string) * 164 / button.width));
    buttons.set(location.id, button);
  }

  draw();

  return {
    setEnabled: (value) => {
      enabled = value;
      for (const button of buttons.values()) {
        if (enabled) {
          if (button.input) button.input.enabled = true;
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
