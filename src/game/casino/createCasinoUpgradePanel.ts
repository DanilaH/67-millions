import Phaser from 'phaser';
import { VISUAL_FONT, visualColor, visualHex } from '../visual/visualTheme';
import type { CasinoUpgradeId, CasinoUpgradePreview } from './casinoUiModel';

export interface CasinoUpgradePanel { render(previews: CasinoUpgradePreview[]): void; }

export const createCasinoUpgradePanel = (
  scene: Phaser.Scene,
  onPurchase: (id: CasinoUpgradeId) => void,
  parent?: Phaser.GameObjects.Container,
): CasinoUpgradePanel => {
  const container = scene.add.container(0, 0).setDepth(20);
  parent?.add(container);
  const dynamic: Phaser.GameObjects.GameObject[] = [];
  let previews: CasinoUpgradePreview[] = [];
  let lastSignature = '';
  let page = 0;
  const background = scene.add.rectangle(1100, 350, 330, 500, visualColor('inkPanel'), 0.98).setStrokeStyle(2, visualColor('cold'), 0.7);
  const title = scene.add.text(950, 111, 'УЛУЧШЕНИЯ', { fontFamily: VISUAL_FONT.sans, fontSize: '24px', color: visualHex('textMain') });
  const count = scene.add.text(1100, 568, '', { fontFamily: VISUAL_FONT.sans, fontSize: '22px', color: visualHex('textMain') }).setOrigin(0.5);
  const previous = scene.add.text(950, 544, '←', { fontSize: '30px', backgroundColor: visualHex('inkRaised'), fixedWidth: 76, fixedHeight: 48, align: 'center' })
    .setInteractive({ useHandCursor: true }).on('pointerup', () => { if (page > 0) { page--; draw(); } });
  const next = scene.add.text(1178, 544, '→', { fontSize: '30px', backgroundColor: visualHex('inkRaised'), fixedWidth: 76, fixedHeight: 48, align: 'center' })
    .setInteractive({ useHandCursor: true }).on('pointerup', () => { if ((page + 1) * 2 < previews.length) { page++; draw(); } });
  container.add([background, title, count, previous, next]);
  const draw = (): void => {
    dynamic.splice(0).forEach(object => object.destroy());
    const pages = Math.ceil(previews.length / 2);
    count.setText(`${page + 1} / ${pages}`);
    previous.setAlpha(page > 0 ? 1 : 0.35); next.setAlpha(page + 1 < pages ? 1 : 0.35);
    scene.game.canvas.setAttribute('data-upgrade-page', `${page + 1}`);
    previews.slice(page * 2, page * 2 + 2).forEach((preview, index) => {
      const y = 149 + index * 192;
      const locked = preview.lockedReason !== null;
      const card = scene.add.rectangle(1100, y + 90, 304, 180, visualColor(locked ? 'inkPanel' : 'inkRaised'))
        .setStrokeStyle(2, visualColor(locked ? 'lineDirty' : 'cold'));
      const name = scene.add.text(958, y + 8, preview.title, { fontFamily: VISUAL_FONT.sans, fontSize: '22px', fontStyle: 'bold', color: visualHex('textMain') });
      const level = scene.add.text(958, y + 36, `Уровень ${preview.currentLevel} / ${preview.maxLevel}`, { fontFamily: VISUAL_FONT.sans, fontSize: '18px', color: visualHex('textMuted') });
      const effect = scene.add.text(958, y + 62, preview.nextEffect, { fontFamily: VISUAL_FONT.sans, fontSize: '19px', color: visualHex('textMain'), wordWrap: { width: 280 } });
      const price = scene.add.text(958, y + 130, preview.maxed ? 'Максимум' : `${locked ? 'Цена' : 'Купить за'} ${preview.nextPrice!.toLocaleString('ru-RU')} ₽`, {
        fontFamily: VISUAL_FONT.sans, fontSize: '21px', color: visualHex(locked ? 'textMuted' : 'mustard'),
      });
      const reason = scene.add.text(958, y + 157, preview.maxed ? '' : preview.lockedReason === null ? 'Нажми на карточку' : preview.lockedReason.includes('DROP') ? 'Дождись конца броска' : preview.lockedReason.toLocaleLowerCase('ru-RU'), {
        fontFamily: VISUAL_FONT.sans, fontSize: '17px', color: visualHex(locked ? 'warning' : 'textMuted'), wordWrap: { width: 280 },
      });
      if (!locked) card.setInteractive({ useHandCursor: true }).on('pointerup', () => onPurchase(preview.id));
      container.add([card, name, level, effect, price, reason]); dynamic.push(card, name, level, effect, price, reason);
    });
  };
  return { render: (nextPreviews) => {
    const signature = JSON.stringify(nextPreviews);
    if (signature === lastSignature) return;
    lastSignature = signature; previews = nextPreviews; draw();
  } };
};
