import Phaser from 'phaser';
import { VISUAL_FONT, visualColor, visualHex } from '../visual/visualTheme';
import type { CasinoUpgradeId, CasinoUpgradePreview } from './casinoUiModel';

export interface CasinoUpgradePanel { render(previews: CasinoUpgradePreview[]): void; }

/** Three compact rows, one-row scrolling, and separate purchase targets. */
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
  const visibleRows = 3;
  const text = (x: number, y: number, value: string, size = 17) => scene.add.text(x, y, value, {
    fontFamily: VISUAL_FONT.sans, fontSize: `${size}px`, color: visualHex('textMain'),
  });
  const background = scene.add.rectangle(1100, 366, 330, 532, visualColor('inkPanel'), 0.98)
    .setStrokeStyle(1, visualColor('lineDirty')).setInteractive();
  const title = text(950, 111, 'Улучшения', 23);
  const status = text(950, 142, '', 14).setColor(visualHex('textMuted'));
  const count = text(1100, 605, '', 15).setOrigin(0.5);
  const previous = text(950, 578, '↑', 25).setFixedSize(76, 48).setAlign('center')
    .setBackgroundColor(visualHex('inkRaised')).setInteractive({ useHandCursor: true });
  const next = text(1178, 578, '↓', 25).setFixedSize(76, 48).setAlign('center')
    .setBackgroundColor(visualHex('inkRaised')).setInteractive({ useHandCursor: true });
  container.add([background, title, status, count, previous, next]);
  const draw = (): void => {
    dynamic.splice(0).forEach(object => object.destroy());
    const pending = previews.some(p => p.lockedReason?.includes('DROP'));
    status.setText(pending ? 'Покупки — после завершения бросков' : 'Эффект следующего уровня');
    count.setText(`${offset + 1}–${Math.min(offset + visibleRows, previews.length)} из ${previews.length}`);
    previous.setAlpha(offset > 0 ? 1 : 0.3);
    next.setAlpha(offset + visibleRows < previews.length ? 1 : 0.3);
    scene.game.canvas.setAttribute('data-upgrade-offset', `${offset}`);
    previews.slice(offset, offset + visibleRows).forEach((preview, index) => {
      const y = 170 + index * 132;
      const card = scene.add.rectangle(1100, y + 63, 306, 126, visualColor('inkRaised'));
      const name = text(958, y + 6, preview.title, 17).setFontStyle('bold');
      const level = text(1238, y + 7, `${preview.currentLevel}/${preview.maxLevel}`, 14).setOrigin(1, 0).setColor(visualHex('textMuted'));
      const effect = text(958, y + 30, preview.nextEffect, 16).setWordWrapWidth(282);
      const buy = text(1238, y + 80, preview.maxed ? 'Максимум' : `${preview.nextPrice!.toLocaleString('ru-RU')} ₽`, 16)
        .setOrigin(1, 0).setPadding(12, 12).setBackgroundColor(visualHex(preview.lockedReason ? 'inkPanel' : 'mustard'))
        .setColor(visualHex(preview.lockedReason ? 'textMuted' : 'inkDeep'));
      if (preview.lockedReason === null) buy.setInteractive({ useHandCursor: true }).on('pointerup', () => onPurchase(preview.id));
      const hint = text(958, y + 94, preview.maxed ? 'Улучшено полностью' : preview.lockedReason === null ? 'Купить →' : pending ? '' : preview.lockedReason?.includes('НЕ ХВАТАЕТ') ? 'Не хватает денег' : 'Недоступно', 13).setColor(visualHex('textMuted'));
      container.add([card, name, level, effect, buy, hint]);
      dynamic.push(card, name, level, effect, buy, hint);
    });
  };
  const scroll = (direction: number): void => {
    const nextOffset = Phaser.Math.Clamp(offset + direction, 0, Math.max(0, previews.length - visibleRows));
    if (nextOffset !== offset) { offset = nextOffset; draw(); }
  };
  previous.on('pointerup', () => scroll(-1)); next.on('pointerup', () => scroll(1));
  const wheel = (pointer: Phaser.Input.Pointer, _objects: Phaser.GameObjects.GameObject[], _dx: number, dy: number): void => {
    if (parent && !parent.visible) return;
    if (pointer.x >= 935 && pointer.x <= 1265 && pointer.y >= 100 && pointer.y <= 632) scroll(Math.sign(dy));
  };
  scene.input.on('wheel', wheel);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.input.off('wheel', wheel));
  return { render: nextPreviews => {
    const nextSignature = JSON.stringify(nextPreviews);
    if (nextSignature === signature) return;
    signature = nextSignature; previews = nextPreviews; draw();
  } };
};
