import Phaser from 'phaser';
import { logicalPointer, sceneViewport } from '../visual/scenePresentation';
import { VISUAL_FONT, visualColor, visualHex } from '../visual/visualTheme';
import type { CasinoUpgradeId, CasinoUpgradePreview } from './casinoUiModel';

export interface CasinoUpgradePanel { render(previews: CasinoUpgradePreview[]): void; }

/** Continuous scrolling; a drag can never commit a purchase. */
export const createCasinoUpgradePanel = (
  scene: Phaser.Scene,
  onPurchase: (id: CasinoUpgradeId) => void,
  parent?: Phaser.GameObjects.Container,
): CasinoUpgradePanel => {
  const container = scene.add.container(0, 0).setDepth(20);
  parent?.add(container);
  const dynamic: Phaser.GameObjects.GameObject[] = [];
  let previews: CasinoUpgradePreview[] = [];
  let signature = '';
  let offset = 0;
  let drag: { y: number; offset: number; moved: boolean; scrollbar: boolean } | null = null;
  const top = 170, bottom = 620, rowHeight = 100;
  const maxScroll = () => Math.max(0, previews.length * rowHeight - (bottom - top));
  const text = (x: number, y: number, value: string, size = 17) => scene.add.text(x, y, value, {
    fontFamily: VISUAL_FONT.sans, fontSize: `${size}px`, color: visualHex('textMain'),
  });
  const background = scene.add.rectangle(1100, 366, 330, 532, visualColor('inkPanel'), 0.96)
    .setStrokeStyle(1, visualColor('lineDirty')).setInteractive();
  const title = text(950, 111, 'ПРОКАЧКА АВТОМАТА', 20);
  const status = text(950, 142, '', 14).setColor(visualHex('textMuted'));
  const track = scene.add.graphics();
  const clip = scene.add.graphics().setVisible(false);
  const mask = clip.createGeometryMask();
  container.add([background, title, status, track]);
  const draw = (): void => {
    dynamic.splice(0).forEach(object => object.destroy());
    const pending = previews.some(p => p.lockedReason?.includes('DROP'));
    status.setText(pending ? 'Покупки — после завершения бросков' : 'Прокрути, чтобы увидеть остальные');
    offset = Phaser.Math.Clamp(offset, 0, maxScroll());
    scene.game.canvas.setAttribute('data-upgrade-scroll', `${Math.round(offset)}`);
    track.clear().fillStyle(visualColor('lineDirty')).fillRoundedRect(1250, top, 5, bottom - top, 2);
    const thumb = (bottom - top) ** 2 / Math.max(bottom - top, previews.length * rowHeight);
    track.fillStyle(visualColor('mustard')).fillRoundedRect(1250, top + (bottom - top - thumb) * offset / Math.max(1, maxScroll()), 5, thumb, 2);
    previews.forEach((preview, index) => {
      const y = top + index * rowHeight - offset;
      if (y + rowHeight <= top || y >= bottom) return;
      const card = scene.add.rectangle(1096, y + 48, 296, 94, visualColor('inkRaised'));
      const name = text(958, y + 6, preview.title, 17).setFontStyle('bold');
      const level = text(1234, y + 7, `${preview.currentLevel}/${preview.maxLevel}`, 14).setOrigin(1, 0).setColor(visualHex('textMuted'));
      const effect = text(958, y + 29, preview.nextEffect, 15).setWordWrapWidth(276);
      const buy = text(1234, y + 62, preview.maxed ? 'Максимум' : `${preview.nextPrice!.toLocaleString('ru-RU')} ₽`, 17)
        .setOrigin(1, 0).setPadding(12, 7).setBackgroundColor(visualHex(preview.lockedReason ? 'inkPanel' : 'mustard'))
        .setColor(visualHex(preview.lockedReason ? 'textMuted' : 'inkDeep'));
      const hint = text(958, y + 68, preview.maxed ? '' : preview.lockedReason === null ? 'Купить →' : pending ? '' : preview.lockedReason?.startsWith('Не хватает') ? preview.lockedReason : 'Недоступно', 12).setWordWrapWidth(145).setColor(visualHex('textMuted'));
      for (const object of [card, name, level, effect, buy, hint]) object.setMask(mask);
      container.add([card, name, level, effect, buy, hint]);
      dynamic.push(card, name, level, effect, buy, hint);
    });
  };
  const point = (pointer: Phaser.Input.Pointer) => {
    const p = logicalPointer(scene, pointer); return { x: p.x - container.x, y: p.y };
  };
  background.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
    if (parent && !parent.visible) return;
    const p = point(pointer);
    if (p.y >= top && p.y <= bottom) drag = { y: p.y, offset, moved: false, scrollbar: p.x >= 1244 };
  });
  const move = (pointer: Phaser.Input.Pointer) => {
    if (!drag) return;
    const p = point(pointer);
    if (Math.abs(p.y - drag.y) > 8) drag.moved = true;
    if (drag.moved) {
      offset = drag.offset + (drag.scrollbar ? (p.y - drag.y) * previews.length * rowHeight / (bottom - top) : drag.y - p.y);
      draw();
    }
  };
  const up = (pointer: Phaser.Input.Pointer) => {
    const gesture = drag; drag = null;
    if (!gesture || gesture.moved || gesture.scrollbar || (parent && !parent.visible)) return;
    const p = point(pointer);
    if (p.y < top || p.y > bottom || p.x < 1138 || p.x > 1238) return;
    const position = p.y - top + offset;
    const preview = previews[Math.floor(position / rowHeight)];
    if (position % rowHeight >= 62 && position % rowHeight <= 96 && preview?.lockedReason === null) onPurchase(preview.id);
  };
  const cancel = () => { drag = null; };
  const wheel = (pointer: Phaser.Input.Pointer, _objects: Phaser.GameObjects.GameObject[], _dx: number, dy: number) => {
    if (parent && !parent.visible) return;
    const p = point(pointer);
    if (p.x >= 935 && p.x <= 1265 && p.y >= top && p.y <= bottom) { offset += dy; draw(); }
  };
  const layout = () => {
    const view = sceneViewport(scene);
    container.x = view.left + view.width - 1280;
    clip.clear().fillStyle(0xffffff).fillRect(944 + container.x, top, 300, bottom - top);
    draw();
  };
  scene.input.on('pointermove', move); scene.input.on('pointerup', up); scene.input.on('gameout', cancel); scene.input.on('wheel', wheel);
  scene.scale.on('resize', layout); layout();
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.input.off('pointermove', move); scene.input.off('pointerup', up); scene.input.off('gameout', cancel); scene.input.off('wheel', wheel);
    scene.scale.off('resize', layout); mask.destroy(); clip.destroy();
  });
  return { render: nextPreviews => {
    const nextSignature = JSON.stringify(nextPreviews);
    if (nextSignature === signature) return;
    signature = nextSignature; previews = nextPreviews; draw();
  } };
};
