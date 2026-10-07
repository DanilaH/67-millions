import Phaser from 'phaser';
import { sceneViewport } from '../visual/scenePresentation';
import { VISUAL_FONT, visualHex } from '../visual/visualTheme';
import type { CasinoQuickBetPreview } from './casinoUiModel';

export interface CasinoBetPanel { render(previews: CasinoQuickBetPreview[]): void; }

export const createCasinoBetPanel = (
  scene: Phaser.Scene,
  onDrop: (preview: CasinoQuickBetPreview) => void,
  parent?: Phaser.GameObjects.Container,
): CasinoBetPanel => {
  const container = scene.add.container(0, 0).setDepth(20);
  parent?.add(container);
  let previews: CasinoQuickBetPreview[] = [];
  let selected: CasinoQuickBetPreview['fraction'] | null = null;
  const title = scene.add.text(28, 294, 'СТАВКА ЗА ОДИН ЗАПУСК', {
    fontFamily: VISUAL_FONT.sans, fontSize: '20px', color: visualHex('textMuted'),
  });
  const amount = scene.add.text(28, 332, '', {
    fontFamily: VISUAL_FONT.sans, fontSize: '22px', color: visualHex('textMain'), wordWrap: { width: 284 },
  });
  const drop = scene.add.text(706, 675, 'БРОСИТЬ', {
    fontFamily: VISUAL_FONT.sans, fontSize: '24px', fontStyle: 'bold', color: visualHex('inkDeep'),
    backgroundColor: visualHex('mustard'), fixedWidth: 220, fixedHeight: 42, align: 'center', padding: { y: 7 },
  }).setInteractive({ useHandCursor: true }).on('pointerup', () => {
    const preview = previews.find(entry => entry.fraction === selected);
    if (preview && preview.lockedReason === null) onDrop(preview);
  });
  const buttons = [0, 1, 2].map(index => scene.add.text(356 + index * 114, 675, '', {
    fontFamily: VISUAL_FONT.sans, fontSize: '17px', fixedWidth: 106, fixedHeight: 42,
    align: 'center', padding: { y: 7 },
  }).setInteractive({ useHandCursor: true }).on('pointerup', () => {
    const preview = previews[index];
    if (preview && preview.lockedReason === null) { selected = preview.fraction; draw(); }
  }));
  container.add([title, amount, drop, ...buttons]);
  const draw = (): void => {
    const preview = previews.find(entry => entry.fraction === selected) ?? previews[0];
    if (!preview) return;
    const compact = sceneViewport(scene).scale < 0.8;
    const locked = preview.lockedReason !== null;
    title.setFontSize(compact ? 24 : 20);
    drop.setPosition(compact ? 28 : 706, compact ? 506 : 675).setFixedSize(compact ? 284 : 220, compact ? 88 : 42).setPadding(0, compact ? 26 : 7);
    const targets: Record<string, { x: number; y: number }> = { drop: { x: drop.x + drop.width / 2, y: drop.y + drop.height / 2 } };
    const reason = preview.lockedReason?.includes('DROP') ? 'Дождись конца броска' : preview.lockedReason?.includes('ВРЕМЕННО') ? 'Казино временно закрыто' : preview.lockedReason?.toLocaleLowerCase('ru-RU');
    amount.setText(locked ? reason! : '×1 — вернул ставку\nМеньше ×1 — потерял часть денег')
      .setFontSize(compact ? 24 : 17).setColor(visualHex('textMuted'));
    drop.setText(`Бросить · ${(preview.amount ?? 0).toLocaleString('ru-RU')} ₽`).setFontSize(compact ? 25 : 20);
    drop.setAlpha(locked ? 0.4 : 1);
    buttons.forEach((button, index) => {
      const entry = previews[index];
      button.setPosition(compact ? 28 + index * 96 : 356 + index * 114, compact ? 410 : 675).setFixedSize(compact ? 92 : 106, compact ? 88 : 42).setPadding(0, compact ? 28 : 7);
      targets[`fraction${index}`] = { x: button.x + button.width / 2, y: button.y + button.height / 2 };
      button.setFontSize(compact ? 24 : (entry?.label.length ?? 0) > 9 ? 12 : (entry?.label.length ?? 0) > 7 ? 14 : 17);
      button.setText(entry?.label ?? '').setAlpha(locked ? 0.4 : 1)
        .setBackgroundColor(visualHex(entry?.fraction === selected ? 'mustard' : 'inkRaised'))
        .setColor(visualHex(entry?.fraction === selected ? 'inkDeep' : 'textMain'));
    });
    scene.game.canvas.setAttribute('data-bet-targets', JSON.stringify(targets));
  };
  scene.scale.on('resize', draw);
  scene.events.once('shutdown', () => scene.scale.off('resize', draw));
  return { render: (next) => {
    previews = next;
    selected ??= next.find(entry => entry.selected)?.fraction ?? next[0]?.fraction ?? null;
    draw();
  } };
};
