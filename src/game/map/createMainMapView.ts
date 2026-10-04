import Phaser from 'phaser';
import { sceneViewport } from '../visual/scenePresentation';
import type { GameState } from '../../core/state/GameState';
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
  deriveMainMapHints,
  type MainMapLocation,
  type MainMapLocationId,
} from './mainMapModel';

export interface MainMapView {
  setEnabled(enabled: boolean): void;
  renderState(state: GameState): void;
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
  const graphics = scene.add.graphics().setDepth(0);
  const locations = deriveMainMapLocations(config);
  // Entrance coordinates on the painted map (normalized, independent of crop).
  const entrances: Record<MainMapLocationId, [number, number]> = {
    work: [0.20, 0.25], food: [0.52, 0.25], home: [0.82, 0.29],
    entertainment: [0.15, 0.75], dumpster: [0.44, 0.79], shower: [0.85, 0.80], casino: [0.61, 0.51],
  };
  const anchors = new Map<MainMapLocationId, { x: number; y: number }>();
  const buildingTargets = new Map<MainMapLocationId, Phaser.GameObjects.Zone>();
  const buttons = new Map<
    MainMapLocationId,
    Phaser.GameObjects.Text
  >();
  const hints = new Map<MainMapLocationId, Phaser.GameObjects.Text>();
  let suggested: MainMapLocationId | null = null;
  let enabled = true;
  let selected: MainMapLocationId | null = null;

  const draw = (): void => {
    graphics.clear();


    for (const location of locations) {
      const isSelected = location.id === selected || location.id === suggested;
      const accent = visualColor(
        LOCATION_ACCENT[location.id],
      );

      const anchor = anchors.get(location.id)!;
      graphics.lineStyle(isSelected ? 3 : 2, accent, enabled ? 1 : 0.4);
      graphics.lineBetween(location.x, location.y + 28, anchor.x, anchor.y);
      graphics.fillStyle(accent, 1); graphics.fillCircle(anchor.x, anchor.y, isSelected ? 8 : 5);
      if (isSelected) { graphics.lineStyle(2, accent, 0.8); graphics.strokeRoundedRect(anchor.x - 45, anchor.y - 42, 90, 65, 8); }
      graphics.fillStyle(visualColor('inkPanel'), enabled ? 0.92 : 0.5);
      graphics.fillRoundedRect(location.x - 92, location.y - 27, 184, 54, 16);
      graphics.lineStyle(isSelected ? 3 : 1, accent, enabled ? 0.9 : 0.35);
      graphics.strokeRoundedRect(location.x - 92, location.y - 27, 184, 54, 16);
      graphics.fillStyle(accent, 1);


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
    const labels: Record<MainMapLocationId, string> = { work: 'Заработать', food: 'Поесть', home: 'Поспать', entertainment: 'Отдохнуть', dumpster: 'Поискать деньги', shower: 'Принять душ', casino: 'Играть в Plinko' };
    hints.set(location.id, scene.add.text(location.x, location.y + 47, labels[location.id], { fontFamily: VISUAL_FONT.sans, fontSize: '16px', color: visualHex('textMain'), backgroundColor: visualHex('inkPanel'), padding: { x: 6, y: 3 } }).setOrigin(0.5, 0).setDepth(2));
  }

  const layout = () => {
    const view = sceneViewport(scene);
    const targets: Record<string, { x: number; y: number }> = {};
    for (const location of locations) {
      const [u, v] = entrances[location.id];
      const anchor = { x: map.x + (u - 0.5) * map.displayWidth, y: map.y + (v - 0.5) * map.displayHeight };
      anchors.set(location.id, anchor);
      location.x = Math.max(view.left + 110, Math.min(view.left + view.width - 110, anchor.x));
      location.y = Math.max(175, anchor.y - 95);
      buttons.get(location.id)!.setPosition(location.x, location.y);
      hints.get(location.id)!.setPosition(location.x, location.y + 29);
      buildingTargets.get(location.id)!.setPosition(anchor.x, anchor.y);
      targets[location.id] = { x: location.x, y: location.y };
    }
    scene.game.canvas.setAttribute('data-map-targets', JSON.stringify(targets));
    draw();
  };
  for (const location of locations) {
    buildingTargets.set(location.id, scene.add.zone(0, 0, 90, 68).setDepth(1).setInteractive({ useHandCursor: true })
      .on('pointerup', () => { if (enabled) { selected = location.id; draw(); onSelect(location); } }));
  }
  layout(); scene.scale.on('resize', layout);
  scene.events.once('shutdown', () => scene.scale.off('resize', layout));

  return {
    renderState: state => {
      const model = deriveMainMapHints(state, config);
      if (suggested !== model.suggested) { suggested = model.suggested; draw(); }
      for (const [id, hint] of hints) {
        hint.setText(model.labels[id]).setColor(visualHex(id === suggested ? 'mustard' : 'textMain'));
      }
    },
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
