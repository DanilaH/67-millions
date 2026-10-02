import Phaser from 'phaser';
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
  const title = scene.add.text(28, 233, 'ВЫБЕРИ СТАВКУ', {
    fontFamily: VISUAL_FONT.sans, fontSize: '20px', color: visualHex('textMuted'),
  });
  const amount = scene.add.text(28, 316, '', {
    fontFamily: VISUAL_FONT.sans, fontSize: '22px', color: visualHex('textMain'), wordWrap: { width: 284 },
  });
  const drop = scene.add.text(28, 368, 'БРОСИТЬ', {
    fontFamily: VISUAL_FONT.sans, fontSize: '24px', fontStyle: 'bold', color: visualHex('inkDeep'),
    backgroundColor: visualHex('mustard'), fixedWidth: 284, fixedHeight: 46, align: 'center', padding: { y: 7 },
  }).setInteractive({ useHandCursor: true }).on('pointerup', () => {
    const preview = previews.find(entry => entry.fraction === selected);
    if (preview && preview.lockedReason === null) onDrop(preview);
  });
  const buttons = [0, 1, 2].map(index => scene.add.text(28 + index * 98, 263, '', {
    fontFamily: VISUAL_FONT.sans, fontSize: '24px', fixedWidth: 88, fixedHeight: 44,
    align: 'center', padding: { y: 7 },
  }).setInteractive({ useHandCursor: true }).on('pointerup', () => {
    const preview = previews[index];
    if (preview && preview.lockedReason === null) { selected = preview.fraction; draw(); }
  }));
  container.add([title, amount, drop, ...buttons]);
  const draw = (): void => {
    const preview = previews.find(entry => entry.fraction === selected) ?? previews[0];
    if (!preview) return;
    const locked = preview.lockedReason !== null;
    const reason = preview.lockedReason?.includes('DROP') ? 'Дождись конца броска' : preview.lockedReason?.includes('ВРЕМЕННО') ? 'Казино временно закрыто' : preview.lockedReason?.toLocaleLowerCase('ru-RU');
    amount.setText(locked ? reason! : `Спишется ${preview.amount!.toLocaleString('ru-RU')} ₽`)
      .setFontSize(locked ? 18 : 22).setColor(visualHex(locked ? 'warning' : 'textMain'));
    drop.setAlpha(locked ? 0.4 : 1);
    buttons.forEach((button, index) => {
      const entry = previews[index];
      button.setText(entry?.label ?? '').setAlpha(locked ? 0.4 : 1)
        .setBackgroundColor(visualHex(entry?.fraction === selected ? 'mustard' : 'inkRaised'))
        .setColor(visualHex(entry?.fraction === selected ? 'inkDeep' : 'textMain'));
    });
  };
  return { render: (next) => {
    previews = next;
    selected ??= next.find(entry => entry.selected)?.fraction ?? next[0]?.fraction ?? null;
    draw();
  } };
};
