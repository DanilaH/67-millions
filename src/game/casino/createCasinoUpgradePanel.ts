import Phaser from 'phaser';
import { isCompactViewport, logicalPointer, sceneViewport } from '../visual/scenePresentation';
import { VISUAL_FONT, visualColor, visualHex } from '../visual/visualTheme';
import type { CasinoUpgradeId, CasinoUpgradePreview } from './casinoUiModel';

export interface CasinoUpgradePanel { render(previews: CasinoUpgradePreview[]): void; }

/** Continuous scrolling; a drag can never commit a purchase. */
export const createCasinoUpgradePanel = (
  scene: Phaser.Scene,
  onPurchase: (id: CasinoUpgradeId) => void,
  parent?: Phaser.GameObjects.Container,
  onInspect: (id: CasinoUpgradeId) => void = () => {},
): CasinoUpgradePanel => {
  const container = scene.add.container(0, 0).setDepth(20);
  parent?.add(container);
  const dynamic: Phaser.GameObjects.GameObject[] = [];
  let previews: CasinoUpgradePreview[] = [];
  let signature = '';
  let offset = 0;
  let drag: { y: number; offset: number; moved: boolean; scrollbar: boolean } | null = null;
  let compact = false, opened = false;
  let top = 170, bottom = 620, rowHeight = 116;
  let left = 935, right = 1265;
  const toggle = scene.add.text(950, 144, 'Улучшения ↓', { fontFamily: VISUAL_FONT.sans, fontSize: '28px', color: visualHex('inkDeep'), backgroundColor: visualHex('mustard'), fixedWidth: 300, fixedHeight: 88, align: 'center', padding: { y: 24 } }).setInteractive({ useHandCursor: true }).on('pointerup', () => { opened = !opened; drag = null; draw(); scene.events.emit('casino-upgrades-toggle'); });
  const maxScroll = () => Math.max(0, previews.length * rowHeight - (bottom - top));
  const text = (x: number, y: number, value: string, size = 17) => scene.add.text(x, y, value, {
    fontFamily: VISUAL_FONT.sans, fontSize: `${size}px`, color: visualHex('textMain'),
  });
  const background = scene.add.rectangle(1100, 366, 330, 532, visualColor('inkPanel'), 0.96)
    .setStrokeStyle(1, visualColor('lineDirty')).setInteractive();
  const title = text(950, 111, 'ПРОКАЧКА АВТОМАТА', 20);
  const status = text(950, 142, '', 17).setColor(visualHex('textMuted'));
  const track = scene.add.graphics();
  container.add([background, title, status, track]);
  const draw = (): void => {
    dynamic.splice(0).forEach(object => object.destroy());
    const visible = !compact || opened;
    background.setVisible(visible); title.setVisible(visible && !compact); status.setVisible(visible); track.setVisible(visible);
    toggle.setVisible(compact).setText(opened ? 'Закрыть ×' : 'Улучшения ↓');
    scene.game.canvas.setAttribute('data-upgrades-open', String(visible));
    if (!visible) return;
    const pending = previews.some(p => p.lockedReason?.includes('DROP'));
    const currentId = previews[Math.floor(offset / rowHeight)]?.id;
    const group = currentId === 'insurance' ? 'Страховка' : ['amplifier', 'return', 'splitter', 'jackpotBias'].includes(currentId ?? '') ? 'Спецпины' : 'Ставки и выплаты';
    status.setText(pending ? 'Покупки — после бросков' : `${group} · листай ↓`);
    offset = Phaser.Math.Clamp(offset, 0, maxScroll());
    scene.game.canvas.setAttribute('data-upgrade-scroll', `${Math.round(offset)}`);
    track.clear().fillStyle(visualColor('lineDirty')).fillRoundedRect(right - 15, top, 5, bottom - top, 2);
    const thumb = (bottom - top) ** 2 / Math.max(bottom - top, previews.length * rowHeight);
    track.fillStyle(visualColor('mustard')).fillRoundedRect(right - 15, top + (bottom - top - thumb) * offset / Math.max(1, maxScroll()), 5, thumb, 2);
    previews.forEach((preview, index) => {
      const y = top + index * rowHeight - offset;
      if (y + rowHeight <= top || y >= bottom) return;
      const cardTop = Math.max(top, y + 1), cardBottom = Math.min(bottom, y + rowHeight - 5);
      const card = scene.add.rectangle((left + right) / 2 - 4, (cardTop + cardBottom) / 2, right - left - 34, cardBottom - cardTop, visualColor('inkRaised'));
      const groupColor = preview.id === 'insurance' ? 'bruise' : ['amplifier', 'return', 'splitter', 'jackpotBias'].includes(preview.id) ? 'cold' : 'mustard';
      card.setStrokeStyle(1, visualColor(groupColor));
      const name = text(left + 23, y + 10, preview.title, compact ? 30 : 19).setFontStyle('bold');
      const level = text(right - 31, y + 10, `${preview.currentLevel}/${preview.maxLevel}`, compact ? 24 : 14).setOrigin(1, 0).setColor(visualHex('textMuted'));
      const effect = text(left + 23, y + (compact ? 53 : 29), preview.nextEffect, compact ? 28 : 18).setWordWrapWidth(compact ? 500 : 276);
      const buy = text(right - 31, y + (compact ? 80 : 82), preview.maxed ? 'Максимум' : `${preview.nextPrice!.toLocaleString('ru-RU')} ₽`, compact ? 28 : 17)
        .setOrigin(1, 0).setFixedSize(compact ? 300 : 0, compact ? 88 : 0).setAlign('center').setPadding(12, compact ? 24 : 7).setBackgroundColor(visualHex(preview.lockedReason ? 'inkPanel' : 'mustard'))
        .setColor(visualHex(preview.lockedReason ? 'textMuted' : 'inkDeep'));
      const hint = text(left + 23, y + (compact ? 130 : 82), preview.maxed ? '' : preview.lockedReason === null ? 'Осмотреть →' : pending ? '' : preview.lockedReason?.startsWith('Не хватает') ? preview.lockedReason : 'Недоступно', compact ? 24 : 14).setWordWrapWidth(compact ? 480 : 145).setColor(visualHex('textMuted'));
      // Text must not escape the scroll window even on renderers that do not
      // support nested container masks. Partial rows keep their clipped backing.
      for (const object of [name, level, effect, buy, hint]) object.setVisible(object.y >= top && object.y + object.height <= bottom);
      container.add([card, name, level, effect, buy, hint]);
      dynamic.push(card, name, level, effect, buy, hint);
    });
    container.bringToTop(toggle);
  };
  container.add(toggle);
  const point = (pointer: Phaser.Input.Pointer) => {
    const p = logicalPointer(scene, pointer); return { x: p.x - container.x, y: p.y };
  };
  background.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
    if ((parent && !parent.visible) || (compact && !opened)) return;
    const p = point(pointer);
    if (p.y >= top && p.y <= bottom) drag = { y: p.y, offset, moved: false, scrollbar: p.x >= right - 21 };
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
    if (p.y < top || p.y > bottom || p.x < left || p.x > right - 27) return;
    const position = p.y - top + offset;
    const rowY = top + Math.floor(position / rowHeight) * rowHeight - offset;
    const selected = previews[Math.floor(position / rowHeight)];
    if (selected && p.x < (compact ? right - 331 : 1138)) {
      onInspect(selected.id);
      if (compact) { opened = false; draw(); scene.events.emit('casino-upgrades-toggle'); }
      return;
    }
    // A partially clipped price is not a hidden purchase target.
    if (rowY + (compact ? 80 : 82) < top || rowY + (compact ? 168 : 114) > bottom) return;
    const preview = previews[Math.floor(position / rowHeight)];
    if (position % rowHeight >= (compact ? 80 : 82) && position % rowHeight <= (compact ? 168 : 114) && preview?.lockedReason === null) onPurchase(preview.id);
  };
  const cancel = () => { drag = null; };
  const wheel = (pointer: Phaser.Input.Pointer, _objects: Phaser.GameObjects.GameObject[], _dx: number, dy: number) => {
    if ((parent && !parent.visible) || (compact && !opened)) return;
    const p = point(pointer);
    if (p.x >= left && p.x <= right && p.y >= top && p.y <= bottom) { offset += dy; draw(); }
  };
  const layout = () => {
    const view = sceneViewport(scene);
    compact = isCompactViewport(scene);
    top = compact ? 242 : 170; bottom = compact ? 688 : 620; rowHeight = compact ? 184 : 116;
    left = compact ? 350 : 935; right = 1265;
    background.setPosition((left + right) / 2, compact ? 416 : 366).setSize(right - left, compact ? 568 : 532);
    status.setPosition(left + 20, compact ? 175 : 142).setFontSize(compact ? 27 : 17);
    container.x = view.left + view.width - 1280;
    draw();
  };
  scene.input.on('pointermove', move); scene.input.on('pointerup', up); scene.input.on('gameout', cancel); scene.input.on('wheel', wheel);
  scene.scale.on('resize', layout); layout();
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.input.off('pointermove', move); scene.input.off('pointerup', up); scene.input.off('gameout', cancel); scene.input.off('wheel', wheel);
    scene.scale.off('resize', layout);
  });
  return { render: nextPreviews => {
    const nextSignature = JSON.stringify(nextPreviews);
    if (nextSignature === signature) return;
    signature = nextSignature; previews = nextPreviews; draw();
  } };
};
